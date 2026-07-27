/**
 * DiagnosticsManager — Monaco Markers, Line Decorations & Glyph Icons.
 *
 * Responsibilities:
 *   - Convert AI issues → Monaco IMarkerData[] (squiggly underlines + hover tooltips).
 *   - Apply per-line background color decorations (subtle, non-intrusive).
 *   - Apply glyph margin icons (CSS-only, cross-browser, no emoji OS dependency).
 *   - Clear all diagnostics atomically.
 *
 * Design decisions:
 *   - Markers + decorations always change together → one loop, one state.
 *   - Glyph icons use CSS ::before pseudo-elements (Unicode symbols) not OS emojis.
 *   - All configuration is derived from SEVERITY_CONFIG — no hardcoded per-severity branches.
 *   - _decorationIds are stored for efficient deltaDecorations updates.
 *   - Marker owner is a constant string so we never accidentally clear other owners.
 *
 * Does NOT:
 *   - Store issue data (→ ReviewState).
 *   - Navigate the editor (→ NavigationManager).
 *   - Touch review panel HTML (→ Findings / SeverityCards).
 *
 * Exposed as: window.Editor.diagnostics
 */

"use strict";

const DiagnosticsManager = (() => {

    // ── Constants ─────────────────────────────────────────────────────────────

    /** Marker owner ID — used to scope setModelMarkers calls. */
    const MARKER_OWNER = "ai-review";

    /**
     * Severity configuration — single source of truth.
     * Derived after Monaco loads (monacoSeverity references monaco.MarkerSeverity).
     *
     * @returns {Object.<string, Object>}
     */
    function _buildSeverityConfig() {
        const ms = window.monaco.MarkerSeverity;
        return {
            critical: {
                label:           "Critical",
                monacoSeverity:  ms.Error,
                decorationClass: "issue-line-critical",
                glyphClass:      "issue-glyph-critical",
            },
            high: {
                label:           "High",
                monacoSeverity:  ms.Error,
                decorationClass: "issue-line-high",
                glyphClass:      "issue-glyph-high",
            },
            medium: {
                label:           "Medium",
                monacoSeverity:  ms.Warning,
                decorationClass: "issue-line-medium",
                glyphClass:      "issue-glyph-medium",
            },
            low: {
                label:           "Low",
                monacoSeverity:  ms.Information,
                decorationClass: "issue-line-low",
                glyphClass:      "issue-glyph-low",
            },
        };
    }

    // ── Internal State ────────────────────────────────────────────────────────

    /** Decoration IDs returned by deltaDecorations — used for efficient updates. */
    let _decorationIds = [];

    /** Cached severity config — built once after Monaco loads. */
    let _severityConfig = null;

    // ── Private Helpers ───────────────────────────────────────────────────────

    /**
     * Returns the severity config (lazy-init after Monaco is loaded).
     * @returns {Object}
     */
    function _getConfig() {
        if (!_severityConfig) {
            _severityConfig = _buildSeverityConfig();
        }
        return _severityConfig;
    }

    /**
     * Returns the Monaco editor instance from the manager.
     * @returns {import('monaco-editor').editor.IStandaloneCodeEditor|null}
     */
    function _getEditor() {
        return window.Editor && window.Editor.manager
            ? window.Editor.manager.getEditor()
            : null;
    }

    /**
     * Returns the current ITextModel.
     * @returns {import('monaco-editor').editor.ITextModel|null}
     */
    function _getModel() {
        const editor = _getEditor();
        return editor ? editor.getModel() : null;
    }

    /**
     * Builds the markdown hover message for a marker/glyph.
     * Shown when the user hovers over an underlined region or the glyph icon.
     *
     * @param {Object} issue
     * @param {Object} config - Severity config entry.
     * @returns {string} Markdown string.
     */
    function _buildHoverMessage(issue, config) {
        const parts = [
            `**[${config.label.toUpperCase()}] ${_escapeMarkdown(issue.title)}**`,
            "",
            _escapeMarkdown(issue.description || ""),
        ];

        if (issue.suggestion) {
            parts.push("", `💡 **Suggestion:** ${_escapeMarkdown(issue.suggestion)}`);
        }

        if (issue.category) {
            parts.push("", `📂 *Category: ${_escapeMarkdown(issue.category)}*`);
        }

        return parts.join("\n");
    }

    /**
     * Escapes markdown special characters in plain text.
     * @param {string} text
     * @returns {string}
     */
    function _escapeMarkdown(text) {
        if (!text) return "";
        return text.replace(/[*_`\[\]]/g, "\\$&");
    }

    /**
     * Converts a single issue into a Monaco IMarkerData object.
     *
     * @param {Object} issue
     * @param {Object} config - Severity config entry for this issue.
     * @returns {import('monaco-editor').editor.IMarkerData}
     */
    function _issueToMarker(issue, config) {
        return {
            severity:        config.monacoSeverity,
            message:         _buildHoverMessage(issue, config),
            startLineNumber: issue.line        || 1,
            startColumn:     issue.column      || 1,
            endLineNumber:   issue.endLine     || issue.line || 1,
            endColumn:       issue.endColumn   || (issue.column ? issue.column + 10 : 100),
            // Store issue id as a code so future code actions can match by id.
            code:            String(issue.id),
            source:          "AI Review",
        };
    }

    /**
     * Converts a single issue into a Monaco IDecoration object.
     * Combines line background + glyph margin into one decoration entry.
     *
     * @param {Object} issue
     * @param {Object} config - Severity config entry.
     * @returns {import('monaco-editor').editor.IDecoration}
     */
    function _issueToDecoration(issue, config) {
        const hoverMessage = { value: _buildHoverMessage(issue, config) };
        const lineNumber   = issue.line || 1;

        return {
            range: new window.monaco.Range(lineNumber, 1, lineNumber, 1),
            options: {
                isWholeLine:           true,
                className:             config.decorationClass,

                // Glyph margin (icon column left of line numbers)
                glyphMarginClassName:  config.glyphClass,
                glyphMarginHoverMessage: hoverMessage,

                // Hover tooltip on the full line background
                hoverMessage:          hoverMessage,

                // zIndex — keep below text selection highlights
                zIndex:                10,

                // Stickiness: decoration stays with its line as text is edited
                stickiness: window.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
            },
        };
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Applies a full set of AI diagnostics to the Monaco editor.
     *
     * One loop builds both the markers array and the decorations array,
     * avoiding duplicate iteration over the issues array.
     *
     * @param {Object[]} issues - Array of structured AI issue objects.
     */
    function setDiagnostics(issues) {
        const editor = _getEditor();
        const model  = _getModel();
        if (!editor || !model) {
            console.warn("[DiagnosticsManager] Editor or model not ready.");
            return;
        }

        const config   = _getConfig();
        const markers  = [];
        const decorations = [];

        // One loop — build both markers and decorations simultaneously.
        issues.forEach((issue) => {
            const sev = config[issue.severity] || config.low;

            markers.push(_issueToMarker(issue, sev));
            decorations.push(_issueToDecoration(issue, sev));
        });

        // Apply markers (squiggly underlines + Problems panel integration)
        window.monaco.editor.setModelMarkers(model, MARKER_OWNER, markers);

        // Apply decorations (line backgrounds + glyph icons) — efficient delta update
        _decorationIds = editor.deltaDecorations(_decorationIds, decorations);
    }

    /**
     * Clears all AI-review markers and decorations from the editor.
     * Call before applying a new set of diagnostics or when the editor is cleared.
     */
    function clearDiagnostics() {
        const editor = _getEditor();
        const model  = _getModel();

        if (model) {
            window.monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
        }

        if (editor) {
            _decorationIds = editor.deltaDecorations(_decorationIds, []);
        }
    }

    // ── Export ────────────────────────────────────────────────────────────────

    return {
        setDiagnostics,
        clearDiagnostics,
    };

})();

// Attach to the window.Editor namespace.
window.Editor = window.Editor || {};
window.Editor.diagnostics = DiagnosticsManager;
