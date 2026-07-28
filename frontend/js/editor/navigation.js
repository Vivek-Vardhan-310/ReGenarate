/**
 * NavigationManager — Editor Navigation & Bidirectional Synchronization.
 *
 * Responsibilities:
 *   - Jump to a specific issue (by issue object) or raw line number.
 *   - Jump to the first issue of a given severity.
 *   - Subscribe to Monaco cursor position changes and sync the review panel.
 *   - Debounce cursor events to avoid unnecessary re-renders.
 *
 * Does NOT:
 *   - Store issue data (→ ReviewState).
 *   - Apply markers or decorations (→ DiagnosticsManager).
 *   - Render any HTML (→ Findings / SeverityCards).
 *
 * Navigation uses issue.id as the primary key — not just line numbers.
 * Multiple issues on the same line are supported; the first matching issue
 * wins for cursor→panel sync (can be refined later).
 *
 * Apply Fix future hook:
 *   applyFix(issue) is scaffolded but does nothing yet.
 *   When implemented it will call editor.executeEdits() with the correct
 *   range and fixSnippet from the issue object.
 *
 * Exposed as: window.Editor.navigation
 */

"use strict";

const NavigationManager = (() => {

    // ── Internal State ────────────────────────────────────────────────────────

    /** Debounce timer handle for cursor sync. */
    let _syncTimeout = null;

    /** Cursor change event disposable — stored so it can be disposed/replaced. */
    let _cursorDisposable = null;

    // ── Private Helpers ───────────────────────────────────────────────────────

    /**
     * Returns the Monaco editor instance.
     * @returns {import('monaco-editor').editor.IStandaloneCodeEditor|null}
     */
    function _getEditor() {
        return window.Editor && window.Editor.manager
            ? window.Editor.manager.getEditor()
            : null;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Jumps the editor to the exact position of an issue.
     * Uses issue.id (not line number) as the authoritative identifier,
     * passing the full issue object to Findings.setActiveIssue().
     *
     * @param {Object} issue - Full issue object from ReviewState.
     */
    function jumpToIssue(issue) {
        if (!issue) return;
        const editor = _getEditor();
        if (!editor) return;

        const lineNumber = issue.line   || 1;
        const column     = issue.column || 1;

        editor.revealLineInCenter(lineNumber);
        editor.setPosition({ lineNumber, column });
        editor.focus();

        // Sync review panel — highlight the corresponding issue card.
        if (window.Findings) {
            window.Findings.setActiveIssue(issue.id);
        }
    }

    /**
     * Jumps the editor to a raw line number (used by severity card clicks).
     * Does not update the review panel active state.
     *
     * @param {number} lineNumber
     */
    function jumpToLine(lineNumber) {
        const editor = _getEditor();
        if (!editor || !lineNumber) return;

        editor.revealLineInCenter(lineNumber);
        editor.setPosition({ lineNumber, column: 1 });
        editor.focus();
    }

    /**
     * Jumps to the first issue of a given severity level.
     * Reads from ReviewState — NavigationManager does not store issue data.
     *
     * @param {string} severity - "critical" | "high" | "medium" | "low"
     */
    function jumpToFirstIssueOfSeverity(severity) {
        if (!window.ReviewState) return;
        const issues = window.ReviewState.getIssuesBySeverity(severity);
        if (issues.length > 0) {
            jumpToIssue(issues[0]);
        }
    }

    /**
     * Sets up bidirectional cursor → review panel synchronization.
     *
     * Subscribes to Monaco's onDidChangeCursorPosition event.
     * When the cursor moves to a line that contains an AI issue,
     * the corresponding issue card in the review panel is highlighted.
     *
     * Debounced at 120ms to avoid hammering the DOM on every keystroke.
     *
     * Calling setupCursorSync() a second time safely disposes the previous
     * listener before registering a new one (e.g. after a new review).
     */
    function setupCursorSync() {
        const editor = _getEditor();
        if (!editor) return;

        // Dispose previous listener to avoid duplicate subscriptions.
        if (_cursorDisposable) {
            _cursorDisposable.dispose();
            _cursorDisposable = null;
        }

        _cursorDisposable = editor.onDidChangeCursorPosition((event) => {
            clearTimeout(_syncTimeout);
            _syncTimeout = setTimeout(() => {
                _handleCursorChange(event.position.lineNumber);
            }, 120);
        });
    }

    /**
     * Tears down cursor synchronization.
     * Call when the review panel is cleared or a new review starts.
     */
    function teardownCursorSync() {
        clearTimeout(_syncTimeout);
        if (_cursorDisposable) {
            _cursorDisposable.dispose();
            _cursorDisposable = null;
        }
    }

    /**
     * Handles a cursor position change.
     * Finds issues on the current line and highlights the first one.
     *
     * @param {number} lineNumber - Current cursor line.
     */
    function _handleCursorChange(lineNumber) {
        if (!window.ReviewState) return;

        const issues = window.ReviewState.getIssuesByLine(lineNumber);
        if (issues.length === 0) return;

        // Highlight the first issue on this line in the review panel.
        if (window.Findings) {
            window.Findings.setActiveIssue(issues[0].id);
        }
    }

    /**
     * Apply Fix — future hook (no-op today).
     *
     * When implemented, this will call editor.executeEdits() with the correct
     * edit range and fixSnippet from the issue. fixType determines the edit mode:
     *   - "replace" → replaces the range with fixSnippet
     *   - "insert"  → inserts fixSnippet before the line
     *   - "delete"  → deletes the range
     *   - "refactor"→ opens a diff view (future)
     *
     * No architectural changes will be required — just fill in the body.
     *
     * @param {Object} issue - Full issue object (must have fixSnippet, fixType, line, column, endLine, endColumn).
     */
    function applyFix(issue) { // eslint-disable-line no-unused-vars
        // TODO: Implement in Apply Fix phase.
        // const editor = _getEditor();
        // if (!editor || !issue || !issue.fixSnippet) return;
        // const range = new window.monaco.Range(
        //     issue.line, issue.column, issue.endLine || issue.line, issue.endColumn || 100
        // );
        // editor.executeEdits('apply-fix', [{ range, text: issue.fixSnippet }]);
        // editor.focus();
        console.info("[NavigationManager] applyFix is not yet implemented.");
    }

    // ── Export ────────────────────────────────────────────────────────────────

    return {
        jumpToIssue,
        jumpToLine,
        jumpToFirstIssueOfSeverity,
        setupCursorSync,
        teardownCursorSync,
        applyFix,
    };

})();

// Attach to the window.Editor namespace.
window.Editor = window.Editor || {};
window.Editor.navigation = NavigationManager;
