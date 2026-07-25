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
        this._debounceTimeout = null;
    }

    init() {
        this.populateDropdowns();
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

    bindEvents() {
        if (this.codeInput) {
            // Debounced input handler (150ms) to prevent input lag
            this.codeInput.addEventListener("input", () => this.debouncedUpdateMetrics(150));
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
        };
    }
}

window.EditorController = EditorController;
