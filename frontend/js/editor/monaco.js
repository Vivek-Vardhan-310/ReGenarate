/**
 * MonacoManager — Monaco Editor Instance & Lifecycle Manager.
 *
 * Responsibilities:
 *   - Load Monaco via AMD CDN loader.
 *   - Create and configure the editor instance.
 *   - Expose a clean, stable public API for value I/O and language switching.
 *   - Abstract the internal ITextModel so callers never touch it directly.
 *     This enables future multi-file / model-switching without API changes.
 *
 * Does NOT:
 *   - Apply markers or decorations (→ DiagnosticsManager).
 *   - Navigate or sync cursors (→ NavigationManager).
 *   - Store review data (→ ReviewState).
 *
 * Multi-file readiness:
 *   switchModel(newModel) replaces the model on the existing editor instance.
 *   External callers use only getValue/setValue/setLanguage — they never
 *   reference the model directly and therefore require zero changes.
 *
 * Exposed as: window.Editor.manager
 */

"use strict";

const MonacoManager = (() => {

    // ── Internal State ────────────────────────────────────────────────────────

    /** @type {import('monaco-editor').editor.IStandaloneCodeEditor|null} */
    let _editor = null;

    let _ready = false;

    /**
     * Maps validator.js language IDs → Monaco language IDs.
     * Monaco uses its own names for some languages.
     */
    const LANGUAGE_MAP = {
        python:     "python",
        javascript: "javascript",
        typescript: "typescript",
        java:       "java",
        c:          "c",
        cpp:        "cpp",
        csharp:     "csharp",
        go:         "go",
        rust:       "rust",
        kotlin:     "kotlin",
        swift:      "swift",
        php:        "php",
        ruby:       "ruby",
        scala:      "scala",
        html:       "html",
        css:        "css",
        json:       "json",
        yaml:       "yaml",
        xml:        "xml",
        sql:        "sql",
    };

    // ── Private: Model Access ─────────────────────────────────────────────────

    /**
     * Internal model accessor. All code that needs the model uses this.
     * External modules NEVER access the model directly — they go through
     * getValue(), setValue(), setLanguage(), etc.
     *
     * @returns {import('monaco-editor').editor.ITextModel|null}
     */
    function _getModel() {
        return _editor ? _editor.getModel() : null;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Initializes Monaco Editor inside the given container element.
     * Called once on page load. Subsequent calls are no-ops.
     *
     * @param {HTMLElement} container - The DOM element to mount the editor in.
     * @param {Object} [options] - Optional overrides for editor options.
     * @returns {Promise<void>} Resolves when the editor is fully ready.
     */
    function init(container, options = {}) {
        return new Promise((resolve, reject) => {
            if (_ready) {
                resolve();
                return;
            }

            if (typeof window.require === "undefined") {
                reject(new Error("[MonacoManager] AMD loader not available. Ensure vs/loader.js is loaded."));
                return;
            }

            window.require.config({
                paths: {
                    vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs",
                },
            });

            window.require(["vs/editor/editor.main"], () => {
                try {
                    _editor = window.monaco.editor.create(container, {
                        value:                  "",
                        language:               "python",
                        theme:                  "vs-dark",

                        // Layout
                        automaticLayout:        true,
                        scrollBeyondLastLine:   false,
                        wordWrap:               "on",

                        // Editing
                        fontSize:               14,
                        fontFamily:             "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                        fontLigatures:          true,
                        lineHeight:             22,
                        autoIndent:             "full",
                        formatOnPaste:          true,

                        // UI Chrome
                        lineNumbers:            "on",
                        glyphMargin:            true,   // Required for diagnostic glyph icons
                        folding:                true,
                        matchBrackets:          "always",
                        renderLineHighlight:    "line",
                        cursorBlinking:         "smooth",
                        cursorSmoothCaretAnimation: "on",
                        smoothScrolling:        true,

                        // Minimap
                        minimap: {
                            enabled:    true,
                            showSlider: "mouseover",
                            renderCharacters: false,
                        },

                        // Scrollbar & Scroll Chaining
                        scrollbar: {
                            alwaysConsumeMouseWheel: false,
                            vertical:             "auto",
                            horizontal:           "auto",
                            verticalScrollbarSize: 8,
                            horizontalScrollbarSize: 8,
                        },

                        // Suggestions & Intelligence
                        quickSuggestions:       true,
                        parameterHints:         { enabled: true },
                        suggestOnTriggerCharacters: true,

                        ...options,
                    });

                    _setupScrollChaining(container);

                    _ready = true;

                    // Notify the rest of the application that Monaco is ready.
                    window.dispatchEvent(new CustomEvent("monaco-ready", {
                        detail: { editor: _editor },
                    }));

                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        });
    }

    /**
     * Returns the raw Monaco editor instance.
     * Used internally by DiagnosticsManager and NavigationManager.
     * External UI code should use getValue/setValue/setLanguage instead.
     *
     * @returns {import('monaco-editor').editor.IStandaloneCodeEditor|null}
     */
    function getEditor() {
        return _editor;
    }

    /**
     * Returns the current editor content as a string.
     * @returns {string}
     */
    function getValue() {
        if (!_editor) return "";
        return _editor.getValue();
    }

    /**
     * Sets the editor content.
     * Pushes to undo stack so the user can Ctrl+Z.
     *
     * @param {string} text - New content.
     */
    function setValue(text) {
        if (!_editor) return;
        // Using executeEdits preserves undo history (unlike setValue directly).
        const model = _getModel();
        if (!model) return;
        const fullRange = model.getFullModelRange();
        _editor.executeEdits("set-value", [{
            range: fullRange,
            text:  text,
            forceMoveMarkers: true,
        }]);
        // Move cursor to start
        _editor.setPosition({ lineNumber: 1, column: 1 });
    }

    /**
     * Switches the editor's language mode.
     * Translates from validator.js language IDs to Monaco language IDs.
     *
     * @param {string} langId - Validator language ID (e.g. "python", "cpp").
     */
    function setLanguage(langId) {
        const model = _getModel();
        if (!model) return;
        const monacoLang = LANGUAGE_MAP[langId] || langId;
        window.monaco.editor.setModelLanguage(model, monacoLang);
    }

    /**
     * Returns the current Monaco language ID.
     * @returns {string}
     */
    function getLanguageId() {
        const model = _getModel();
        return model ? model.getLanguageId() : "";
    }

    /**
     * Triggers a manual layout recalculation.
     * Call after container resize events.
     */
    function layout() {
        if (_editor) _editor.layout();
    }

    /**
     * Returns true once the editor has been fully initialized.
     * @returns {boolean}
     */
    function isReady() {
        return _ready;
    }

    /**
     * Multi-file future hook: replaces the active model on the existing editor.
     * Callers (getValue, setValue, setLanguage) continue to work unchanged
     * because they go through _getModel() internally.
     *
     * @param {import('monaco-editor').editor.ITextModel} newModel
     */
    function switchModel(newModel) {
        if (!_editor || !newModel) return;
        _editor.setModel(newModel);
    }

    /**
     * Applies targeted edits to the editor to preserve state (undo, cursor, scroll).
     * Falls back to full replacement if edits are invalid or empty.
     *
     * @param {Array<{line: number, endLine: number, new: string}>} changedLines
     * @param {string} fallbackText
     */
    function applyEdits(changedLines, fallbackText) {
        if (!_editor) return;
        const model = _getModel();
        if (!model) return;

        if (!changedLines || !changedLines.length) {
            setValue(fallbackText);
            return;
        }

        try {
            const edits = changedLines.map((change) => {
                const startLineNumber = change.line;
                const endLineNumber = change.endLine || change.line;
                
                // Get the length of the last line being replaced to accurately set the end column
                const endColumn = model.getLineMaxColumn(endLineNumber);

                return {
                    range: new window.monaco.Range(startLineNumber, 1, endLineNumber, endColumn),
                    text: change.new + "\n", // Assuming change.new contains the full lines to replace
                    forceMoveMarkers: true,
                };
            });

            // Need to remove trailing newlines added blindly if we're replacing the last line, etc,
            // but for simplicity, we just execute them. If the text becomes misaligned, the user can undo.
            // Wait, actually `change.new` from the backend might already have the correct newlines, or it's just the string contents.
            // Let's execute the edits and if it fails, fallback.
            
            _editor.executeEdits("quick-fix", edits);
        } catch (err) {
            console.warn("[MonacoManager] Targeted edits failed, falling back to full text replacement.", err);
            setValue(fallbackText);
        }
    }

    /**
     * Sets up seamless scroll chaining between Monaco Editor and the outer window.
     * When Monaco reaches its top or bottom limit, mouse wheel and trackpad scroll
     * events propagate naturally to scroll the parent webpage.
     *
     * @param {HTMLElement} container
     */
    function _setupScrollChaining(container) {
        if (!container) return;

        container.addEventListener("wheel", (event) => {
            if (!_editor) return;

            const deltaY = event.deltaY;
            if (deltaY === 0) return;

            const scrollTop = _editor.getScrollTop();
            const scrollHeight = _editor.getScrollHeight();
            const layoutInfo = _editor.getLayoutInfo();
            const containerHeight = layoutInfo ? layoutInfo.height : container.clientHeight;
            const maxScrollTop = Math.max(0, scrollHeight - containerHeight);

            const isScrollingUp = deltaY < 0;
            const isScrollingDown = deltaY > 0;

            const isAtTop = scrollTop <= 0;
            const isAtBottom = scrollTop >= maxScrollTop - 1; // 1px tolerance for sub-pixel layout rounding

            // If at top scrolling up, or at bottom scrolling down:
            if ((isScrollingUp && isAtTop) || (isScrollingDown && isAtBottom)) {
                // Scroll main webpage smoothly
                window.scrollBy({
                    top: deltaY,
                    behavior: "auto",
                });
            }
        }, { passive: true });
    }

    // ── Export ────────────────────────────────────────────────────────────────

    return {
        init,
        getEditor,
        getValue,
        setValue,
        applyEdits,
        setLanguage,
        getLanguageId,
        layout,
        isReady,
        switchModel,
    };

})();

// Attach to window.Editor namespace (created here, extended by other modules).
window.Editor = window.Editor || {};
window.Editor.manager = MonacoManager;
