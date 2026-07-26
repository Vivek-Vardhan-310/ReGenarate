/**
 * Code Editor Controller Module.
 *
 * Manages editor UI interactions: language selection, review focus selection,
 * debounced line numbering & character counting, sample code loading, and editor state.
 *
 * Per Architecture (docs/02-Architecture.md, Section 33) & Phase 7 Optimization:
 * - Debounces editor input handlers to prevent layout thrashing.
 */

"use strict";

const SAMPLE_CODE = {
    python: `def calculate_total(items):\n    # Calculate total price with tax\n    total = 0\n    for item in items:\n        if item['price'] > 0:\n            total += item['price'] * 1.18\n    return round(total, 2)\n\n# Example usage\nproducts = [{'name': 'Book', 'price': 25.0}, {'name': 'Pen', 'price': 5.0}]\nprint("Total:", calculate_total(products))`,
    javascript: `function processOrders(orders) {\n  let result = [];\n  for (let i = 0; i < orders.length; i++) {\n    if (orders[i].status === 'pending') {\n      result.push({\n        id: orders[i].id,\n        total: orders[i].amount * 1.1\n      });\n    }\n  }\n  return result;\n}`,
    java: `public class CustomerService {\n    public double calculateDiscount(double price, int customerYears) {\n        if (customerYears > 5) {\n            return price * 0.85;\n        } else if (customerYears > 2) {\n            return price * 0.92;\n        }\n        return price;\n    }\n}`,
};

class EditorController {
    constructor() {
        this.languageSelect = document.getElementById("language-select");
        this.focusSelect = document.getElementById("focus-select");
        this.codeInput = document.getElementById("code-input");
        this.charCounter = document.getElementById("char-count");
        this.lineCounter = document.getElementById("line-count");
        this.sampleBtn = document.getElementById("load-sample-btn");
        this.clearBtn = document.getElementById("clear-editor-btn");
        this.openFileBtn = document.getElementById("open-file-btn");
        this.fileInput = document.getElementById("file-input");
        this.importedBadge = document.getElementById("imported-file-badge");
        this.importedFilename = document.getElementById("imported-filename");
        this.removeFileBtn = document.getElementById("remove-file-btn");
        this.importedFile = null;
        this._debounceTimeout = null;
    }

    init() {
        this.populateDropdowns();
        this.setupFileInput();
        this.bindEvents();
        this.updateMetrics();
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
            // Set accept attribute generated from centralized language configuration
            this.fileInput.accept = window.InputValidator.getAcceptAttribute();
        }
    }

    bindEvents() {
        if (this.codeInput) {
            // Debounced input handler (150ms) to prevent input lag
            this.codeInput.addEventListener("input", () => this.debouncedUpdateMetrics(150));

            // Drag and Drop support
            this.codeInput.addEventListener("dragover", (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.codeInput.classList.add("border-primary-500", "bg-surface-900");
            });

            this.codeInput.addEventListener("dragleave", (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.codeInput.classList.remove("border-primary-500", "bg-surface-900");
            });

            this.codeInput.addEventListener("drop", (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.codeInput.classList.remove("border-primary-500", "bg-surface-900");

                if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    this.handleFileImport(e.dataTransfer.files[0]);
                }
            });
        }

        if (this.openFileBtn && this.fileInput) {
            this.openFileBtn.addEventListener("click", () => {
                this.fileInput.click();
            });

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
                if (window.appState) {
                    window.appState.editor.language = selectedLang;
                }
            });
        }
    }

    handleFileImport(file) {
        if (!file) return;

        // 1. Pre-flight file validation using centralized validator
        const validation = window.InputValidator.validateImportedFile(file);
        if (!validation.isValid) {
            if (this.fileInput) this.fileInput.value = "";
            if (window.notifications) {
                window.notifications.error(validation.message);
            }
            return;
        }

        // 2. Read file using FileReader
        const reader = new FileReader();

        reader.onload = (e) => {
            const content = e.target.result;
            if (this.codeInput) {
                this.codeInput.value = content;
                this.updateMetrics();

                // 3. Automatic language detection
                const detectedLang = validation.detectedLanguage;
                if (detectedLang && this.languageSelect) {
                    const hasOption = Array.from(this.languageSelect.options).some(
                        (opt) => opt.value === detectedLang
                    );
                    if (hasOption) {
                        this.languageSelect.value = detectedLang;
                        if (window.appState) {
                            window.appState.editor.language = detectedLang;
                        }
                    }
                }

                // 4. Update imported file badge UI
                this.importedFile = file.name;
                if (this.importedFilename) {
                    this.importedFilename.textContent = file.name;
                }
                if (this.importedBadge) {
                    this.importedBadge.classList.remove("hidden");
                    this.importedBadge.classList.add("flex");
                }

                // 5. Notify user of successful import
                if (window.notifications) {
                    const langLabel = detectedLang ? detectedLang.toUpperCase() : "File";
                    window.notifications.success(`Imported '${file.name}' (Auto-detected ${langLabel})`);
                }
            }

            // Reset input so re-opening same file triggers change event
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
        if (this.importedFilename) {
            this.importedFilename.textContent = "";
        }
    }

    debouncedUpdateMetrics(delayMs = 150) {
        clearTimeout(this._debounceTimeout);
        this._debounceTimeout = setTimeout(() => this.updateMetrics(), delayMs);
    }

    updateMetrics() {
        const code = this.codeInput ? this.codeInput.value : "";
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

        if (this.codeInput) {
            this.codeInput.value = sample;
            this.updateMetrics();
            if (window.notifications) {
                window.notifications.info(`Loaded sample ${currentLang.toUpperCase()} code.`);
            }
        }
    }

    clearEditor() {
        this.removeImportedFile();
        if (this.codeInput) {
            this.codeInput.value = "";
            this.updateMetrics();
            if (window.notifications) {
                window.notifications.info("Editor cleared.");
            }
        }
    }

    getEditorData() {
        return {
            language: this.languageSelect ? this.languageSelect.value : "",
            reviewFocus: this.focusSelect ? this.focusSelect.value : "",
            code: this.codeInput ? this.codeInput.value : "",
            importedFile: this.importedFile,
        };
    }
}

window.EditorController = EditorController;
