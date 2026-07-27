/**
 * EditorController — Monaco Adapter & UI Event Handler.
 *
 * Acts as the thin adapter between the toolbar UI and MonacoManager.
 * All public methods retain their original signatures so ReviewController,
 * RewriteController, and app.js work without changes.
 *
 * Changes from original:
 *   - this.codeInput (textarea) replaced with window.Editor.manager calls.
 *   - Language change also calls window.Editor.manager.setLanguage().
 *   - Drag-and-drop attached to #monaco-editor-container div.
 *   - updateMetrics() reads from Monaco instead of textarea.value.
 *   - Initialization waits for 'monaco-ready' event if Monaco not yet loaded.
 *
 * Unchanged:
 *   - Constructor signature.
 *   - getEditorData() return shape.
 *   - All public method names and behaviors.
 *   - populateDropdowns(), setupFileInput(), handleFileImport(), etc.
 *
 * Per Architecture (docs/02-Architecture.md, Section 26).
 * Per Rules (docs/03-Rules.md, JS-001).
 */

"use strict";

const SAMPLE_CODE = {
    python: `import sqlite3

def get_user(username, password):
    # WARNING: Vulnerable to SQL Injection
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    query = "SELECT * FROM users WHERE username='" + username + "' AND password='" + password + "'"
    cursor.execute(query)
    return cursor.fetchone()

def process_data(items):
    total = 0
    for item in items:
        if item['price'] > 0:
            total += item['price'] * 1.18
    return round(total, 2)

# Example usage
user = get_user("admin", "password123")
print("User:", user)`,

    javascript: `const express = require('express');
const app = express();

// WARNING: No input validation
app.get('/user', (req, res) => {
    const userId = req.query.id;
    const query = \`SELECT * FROM users WHERE id = \${userId}\`;

    db.query(query, (err, results) => {
        res.json(results);
    });
});

function processOrders(orders) {
    let result = [];
    for (let i = 0; i < orders.length; i++) {
        if (orders[i].status === 'pending') {
            result.push({ id: orders[i].id, total: orders[i].amount * 1.1 });
        }
    }
    return result;
}`,

    java: `public class CustomerService {
    private Connection conn;

    // WARNING: Hardcoded credentials
    private static final String DB_PASS = "admin123";

    public String getCustomer(String customerId) {
        String query = "SELECT * FROM customers WHERE id = " + customerId;
        try {
            Statement stmt = conn.createStatement();
            ResultSet rs = stmt.executeQuery(query);
            return rs.getString("name");
        } catch (SQLException e) {
            e.printStackTrace();
            return null;
        }
    }

    public double calculateDiscount(double price, int customerYears) {
        if (customerYears > 5) {
            return price * 0.85;
        } else if (customerYears > 2) {
            return price * 0.92;
        }
        return price;
    }
}`,

    typescript: `interface User {
    id: number;
    username: string;
    password: string;  // WARNING: Storing plain text password
}

class AuthService {
    private users: User[] = [];

    login(username: string, password: string): User | null {
        // WARNING: Linear scan — use a Map for O(1) lookup
        return this.users.find(u =>
            u.username === username && u.password === password
        ) || null;
    }

    addUser(user: User): void {
        this.users.push(user);  // No duplicate check
    }
}`,

    go: `package main

import (
    "database/sql"
    "fmt"
    "net/http"
)

// WARNING: SQL Injection vulnerability
func getUser(db *sql.DB, username string) {
    query := fmt.Sprintf("SELECT * FROM users WHERE name='%s'", username)
    rows, err := db.Query(query)
    if err != nil {
        panic(err)  // WARNING: panic in production code
    }
    defer rows.Close()
}

func handler(w http.ResponseWriter, r *http.Request) {
    name := r.URL.Query().Get("name")
    getUser(nil, name)
    fmt.Fprintf(w, "Hello, %s!", name)  // WARNING: XSS vulnerability
}`,
};

class EditorController {
    constructor() {
        this.languageSelect  = document.getElementById("language-select");
        this.focusSelect     = document.getElementById("focus-select");
        this.charCounter     = document.getElementById("char-count");
        this.lineCounter     = document.getElementById("line-count");
        this.sampleBtn       = document.getElementById("load-sample-btn");
        this.clearBtn        = document.getElementById("clear-editor-btn");
        this.openFileBtn     = document.getElementById("open-file-btn");
        this.fileInput       = document.getElementById("file-input");
        this.importedBadge   = document.getElementById("imported-file-badge");
        this.importedFilename= document.getElementById("imported-filename");
        this.removeFileBtn   = document.getElementById("remove-file-btn");
        this.editorContainer = document.getElementById("monaco-editor-container");
        this.importedFile    = null;
        this._debounceTimeout= null;
    }

    init() {
        this.populateDropdowns();
        this.setupFileInput();

        // Monaco may already be ready, or may still be loading.
        if (window.Editor && window.Editor.manager && window.Editor.manager.isReady()) {
            this._onMonacoReady();
        } else {
            window.addEventListener("monaco-ready", () => this._onMonacoReady(), { once: true });
        }
    }

    /**
     * Called once Monaco is initialized. Binds all events that depend on the editor.
     */
    _onMonacoReady() {
        this.bindEvents();
        this.updateMetrics();

        // Subscribe to Monaco content changes for metrics update.
        const editor = window.Editor.manager.getEditor();
        if (editor) {
            editor.onDidChangeModelContent(() => this.debouncedUpdateMetrics(150));
        }
    }

    populateDropdowns() {
        if (this.languageSelect && window.SUPPORTED_LANGUAGES_LIST) {
            this.languageSelect.innerHTML = '<option value="" disabled selected>Select Language...</option>';
            window.SUPPORTED_LANGUAGES_LIST.forEach((lang) => {
                const opt = document.createElement("option");
                opt.value = lang.id;
                opt.textContent = lang.name;
                this.languageSelect.appendChild(opt);
            });
            this.languageSelect.value = "python";
        }

        if (this.focusSelect && window.SUPPORTED_FOCUS_LIST) {
            this.focusSelect.innerHTML = '<option value="" disabled selected>Select Focus Area...</option>';
            window.SUPPORTED_FOCUS_LIST.forEach((focus) => {
                const opt = document.createElement("option");
                opt.value = focus.id;
                opt.textContent = focus.name;
                this.focusSelect.appendChild(opt);
            });
            this.focusSelect.value = "general";
        }
    }

    setupFileInput() {
        if (this.fileInput && window.InputValidator && window.InputValidator.getAcceptAttribute) {
            this.fileInput.accept = window.InputValidator.getAcceptAttribute();
        }
    }

    bindEvents() {
        // Drag and drop on the Monaco container (not on the editor's internal DOM)
        if (this.editorContainer) {
            this.editorContainer.addEventListener("dragover", (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.editorContainer.classList.add("drag-over");
            });

            this.editorContainer.addEventListener("dragleave", (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.editorContainer.classList.remove("drag-over");
            });

            this.editorContainer.addEventListener("drop", (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.editorContainer.classList.remove("drag-over");
                if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    this.handleFileImport(e.dataTransfer.files[0]);
                }
            });
        }

        if (this.openFileBtn && this.fileInput) {
            this.openFileBtn.addEventListener("click", () => this.fileInput.click());
            this.fileInput.addEventListener("change", () => {
                if (this.fileInput.files && this.fileInput.files.length > 0) {
                    this.handleFileImport(this.fileInput.files[0]);
                }
            });
        }

        if (this.removeFileBtn) {
            this.removeFileBtn.addEventListener("click", () => this.removeImportedFile());
        }

        if (this.sampleBtn) {
            this.sampleBtn.addEventListener("click", () => this.loadSampleCode());
        }

        if (this.clearBtn) {
            this.clearBtn.addEventListener("click", () => this.clearEditor());
        }

        if (this.languageSelect) {
            this.languageSelect.addEventListener("change", () => {
                const selectedLang = this.languageSelect.value;

                // Update Monaco language mode.
                if (window.Editor && window.Editor.manager) {
                    window.Editor.manager.setLanguage(selectedLang);
                }

                // Update global app state.
                if (window.appState) {
                    window.appState.editor.language = selectedLang;
                }
            });
        }
    }

    handleFileImport(file) {
        if (!file) return;

        const validation = window.InputValidator.validateImportedFile(file);
        if (!validation.isValid) {
            if (this.fileInput) this.fileInput.value = "";
            if (window.notifications) {
                window.notifications.error(validation.message);
            }
            return;
        }

        const reader = new FileReader();

        reader.onload = (e) => {
            const content = e.target.result;

            if (window.Editor && window.Editor.manager) {
                window.Editor.manager.setValue(content);
                this.updateMetrics();

                // Auto-detect language and update Monaco + selector.
                const detectedLang = validation.detectedLanguage;
                if (detectedLang && this.languageSelect) {
                    const hasOption = Array.from(this.languageSelect.options).some(
                        (opt) => opt.value === detectedLang
                    );
                    if (hasOption) {
                        this.languageSelect.value = detectedLang;
                        window.Editor.manager.setLanguage(detectedLang);
                        if (window.appState) {
                            window.appState.editor.language = detectedLang;
                        }
                    }
                }

                this.importedFile = file.name;
                if (this.importedFilename) this.importedFilename.textContent = file.name;
                if (this.importedBadge) {
                    this.importedBadge.classList.remove("hidden");
                    this.importedBadge.classList.add("flex");
                }

                if (window.notifications) {
                    const langLabel = detectedLang ? detectedLang.toUpperCase() : "File";
                    window.notifications.success(`Imported '${file.name}' (Auto-detected ${langLabel})`);
                }
            }

            if (this.fileInput) this.fileInput.value = "";
        };

        reader.onerror = () => {
            if (this.fileInput) this.fileInput.value = "";
            if (window.notifications) {
                window.notifications.error("Failed to read file. The file may be corrupt or unreadable.");
            }
        };

        reader.readAsText(file);
    }

    removeImportedFile() {
        this.importedFile = null;
        if (this.importedBadge) {
            this.importedBadge.classList.remove("flex");
            this.importedBadge.classList.add("hidden");
        }
        if (this.importedFilename) this.importedFilename.textContent = "";
    }

    debouncedUpdateMetrics(delayMs = 150) {
        clearTimeout(this._debounceTimeout);
        this._debounceTimeout = setTimeout(() => this.updateMetrics(), delayMs);
    }

    updateMetrics() {
        // Read from Monaco instead of textarea.value.
        const code = (window.Editor && window.Editor.manager)
            ? window.Editor.manager.getValue()
            : "";

        const charCount = code.length;
        const lineCount = code ? code.split("\n").length : 0;

        if (this.charCounter) {
            this.charCounter.textContent = `${charCount.toLocaleString()} chars`;
        }
        if (this.lineCounter) {
            this.lineCounter.textContent = `${lineCount.toLocaleString()} lines`;
        }

        if (window.appState) {
            window.appState.editor.code = code;
        }
    }

    loadSampleCode() {
        this.removeImportedFile();
        const currentLang = this.languageSelect ? this.languageSelect.value : "python";
        const sample = SAMPLE_CODE[currentLang] || SAMPLE_CODE.python;

        if (window.Editor && window.Editor.manager) {
            window.Editor.manager.setValue(sample);
            this.updateMetrics();
            if (window.notifications) {
                window.notifications.info(`Loaded sample ${currentLang.toUpperCase()} code.`);
            }
        }
    }

    clearEditor() {
        this.removeImportedFile();
        if (window.Editor && window.Editor.manager) {
            window.Editor.manager.setValue("");
            this.updateMetrics();

            // Also clear any diagnostics from the previous review.
            if (window.Editor.diagnostics) {
                window.Editor.diagnostics.clearDiagnostics();
            }
            if (window.ReviewState) {
                window.ReviewState.clear();
            }

            if (window.notifications) {
                window.notifications.info("Editor cleared.");
            }
        }
    }

    /**
     * Returns editor data for API submission.
     * Signature unchanged — ReviewController and RewriteController use this.
     *
     * @returns {{ language: string, reviewFocus: string, code: string, importedFile: string|null }}
     */
    getEditorData() {
        return {
            language:    this.languageSelect ? this.languageSelect.value : "",
            reviewFocus: this.focusSelect    ? this.focusSelect.value    : "",
            code: (window.Editor && window.Editor.manager)
                ? window.Editor.manager.getValue()
                : "",
            importedFile: this.importedFile,
        };
    }
}

window.EditorController = EditorController;
