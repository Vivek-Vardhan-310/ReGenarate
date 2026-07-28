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

class EditorController {
    constructor(consoleController = null) {
        this.consoleController = consoleController;
        this.languageSelect  = document.getElementById("language-select");
        this.focusSelect     = document.getElementById("focus-select");
        this.charCounter     = document.getElementById("char-count");
        this.lineCounter     = document.getElementById("line-count");
        this.sampleBtn       = document.getElementById("load-sample-btn");
        this.clearBtn        = document.getElementById("clear-editor-btn");
        this.openFileBtn     = document.getElementById("open-file-btn");
        this.reloadFileBtn   = document.getElementById("reload-file-btn");
        this.fileInput       = document.getElementById("file-input");
        this.dropZone        = document.getElementById("editor-dropzone");
        this.dropOverlay     = document.getElementById("drop-overlay");
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
        this.setupDragAndDrop();
        this.updateReloadButtonVisibility();

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

        if (this.reloadFileBtn) {
            this.reloadFileBtn.addEventListener("click", () => this.reloadLastFile());
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

    setupDragAndDrop() {
        if (!this.dropZone) return;

        const showOverlay = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.dropOverlay) {
                this.dropOverlay.classList.remove("hidden");
                this.dropOverlay.classList.add("flex");
            }
        };

        const hideOverlay = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.dropOverlay) {
                this.dropOverlay.classList.add("hidden");
                this.dropOverlay.classList.remove("flex");
            }
        };

        ["dragenter", "dragover"].forEach((eventName) => {
            this.dropZone.addEventListener(eventName, showOverlay, false);
        });

        ["dragleave", "drop"].forEach((eventName) => {
            this.dropZone.addEventListener(eventName, hideOverlay, false);
        });

        this.dropZone.addEventListener("drop", (e) => {
            const dt = e.dataTransfer;
            const files = dt ? dt.files : null;
            if (files && files.length > 0) {
                this.handleFileImport(files[0]);
            }
        });
    }

    updateReloadButtonVisibility() {
        try {
            const lastFileName = localStorage.getItem("regen_last_file_name");
            if (this.reloadFileBtn) {
                if (lastFileName) {
                    this.reloadFileBtn.classList.remove("hidden");
                    this.reloadFileBtn.classList.add("flex");
                    this.reloadFileBtn.title = `Reload last imported file: ${lastFileName}`;
                } else {
                    this.reloadFileBtn.classList.add("hidden");
                    this.reloadFileBtn.classList.remove("flex");
                }
            }
        } catch (e) {
            console.warn("localStorage unavailable for reload button update:", e);
        }
    }

    reloadLastFile() {
        try {
            const lastFileName = localStorage.getItem("regen_last_file_name");
            const lastFileContent = localStorage.getItem("regen_last_file_content");
            const lastFileLang = localStorage.getItem("regen_last_file_lang");

            if (!lastFileName || !lastFileContent) {
                if (window.notifications) {
                    window.notifications.warning("No recent imported file found to reload.");
                }
                return;
            }

            if (this.codeInput) {
                this.codeInput.value = lastFileContent;
                this.updateMetrics();
            }

            if (lastFileLang && this.languageSelect) {
                this.languageSelect.value = lastFileLang;
                if (window.appState) {
                    window.appState.editor.language = lastFileLang;
                }
            }

            this.importedFile = lastFileName;
            if (this.importedFilename) {
                this.importedFilename.textContent = lastFileName;
            }
            if (this.importedBadge) {
                this.importedBadge.classList.remove("hidden");
                this.importedBadge.classList.add("flex");
            }

            if (window.notifications) {
                window.notifications.success(`Reloaded last imported file: '${lastFileName}'`);
            }
        } catch (e) {
            console.error("Failed to reload last file:", e);
            if (window.notifications) {
                window.notifications.error("Failed to reload last file.");
            }
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

                // 5. Store in localStorage for Reload Last File
                try {
                    localStorage.setItem("regen_last_file_name", file.name);
                    localStorage.setItem("regen_last_file_content", content);
                    localStorage.setItem("regen_last_file_lang", detectedLang || "");
                    this.updateReloadButtonVisibility();
                } catch (err) {
                    console.warn("Unable to save recent file to localStorage:", err);
                }

                // 6. Notify user of successful import
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
        const currentLang = this.languageSelect ? this.languageSelect.value : "";
        
        if (!currentLang) {
            if (window.notifications) {
                window.notifications.warning("Please select a programming language first.");
            }
            return;
        }

        const sample = typeof window.getSampleProgram === "function"
            ? window.getSampleProgram(currentLang)
            : (window.samplePrograms ? window.samplePrograms[currentLang] : null);

        if (!sample) {
            if (window.notifications) {
                window.notifications.warning("No sample program is available for this language.");
            }
            return;
        }

        if (window.Editor && window.Editor.manager) {
            window.Editor.manager.setValue(sample);
            this.updateMetrics();

            // Resolve friendly display name for notification
            let langDisplayName = currentLang.toUpperCase();
            if (window.SUPPORTED_LANGUAGES_LIST) {
                const found = window.SUPPORTED_LANGUAGES_LIST.find((l) => l.id === currentLang);
                if (found) langDisplayName = found.name;
            }

            if (window.notifications) {
                window.notifications.info(`Loaded ${langDisplayName} sample code.`);
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
        const consoleCtrl = this.consoleController || window.consoleController;
        const executionData = consoleCtrl ? consoleCtrl.getExecutionData() : null;

        return {
            language:    this.languageSelect ? this.languageSelect.value : "",
            reviewFocus: this.focusSelect    ? this.focusSelect.value    : "",
            code: (window.Editor && window.Editor.manager)
                ? window.Editor.manager.getValue()
                : "",
            importedFile: this.importedFile,
            execution: executionData,
        };
    }
}

window.EditorController = EditorController;
