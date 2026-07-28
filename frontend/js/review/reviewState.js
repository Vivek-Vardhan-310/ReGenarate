/**
 * ReviewState — Centralized AI Review Data Store.
 *
 * Single source of truth for the current AI review response.
 * All modules (DiagnosticsManager, Renderer, SeverityCards, Findings,
 * NavigationManager) read data exclusively from this module.
 *
 * Responsibilities:
 *   - Store the full structured AI response.
 *   - Expose typed getters for each sub-component.
 *   - Expose O(1) id-based and line-based lookups via Map caches.
 *   - Expose helper queries (by severity, by line, etc.)
 *   - Expose clear() for resetting between sessions.
 *
 * Does NOT:
 *   - Trigger rendering.
 *   - Touch the DOM.
 *   - Make API calls.
 */

"use strict";

const ReviewState = (() => {

    // ── Internal State ───────────────────────────────────────────────────────

    let _data = null; // Full backend response data object

    /** @type {Map<number, Object>} id → issue */
    let _issueById = new Map();

    /** @type {Map<number, Object[]>} lineNumber → issues[] */
    let _issuesByLine = new Map();

    // ── Private Helpers ──────────────────────────────────────────────────────

    /**
     * Rebuilds internal lookup caches after state is set.
     * Enables O(1) lookups without repeated array scans.
     */
    function _buildCaches() {
        _issueById.clear();
        _issuesByLine.clear();

        if (!_data || !Array.isArray(_data.issues)) return;

        _data.issues.forEach((issue) => {
            // id-based cache
            _issueById.set(issue.id, issue);

            // line-based cache (multiple issues can share a line)
            const lineNum = issue.line;
            if (!_issuesByLine.has(lineNum)) {
                _issuesByLine.set(lineNum, []);
            }
            _issuesByLine.get(lineNum).push(issue);
        });
    }

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * Stores the full AI response and rebuilds lookup caches.
     *
     * Expected shape (structured):
     * {
     *   summary:         string,
     *   severity:        { critical: n, high: n, medium: n, low: n },
     *   issues:          Issue[],
     *   strengths:       string[],
     *   recommendations: string[],
     *   markdown:        string   // optional — full markdown fallback
     * }
     *
     * Legacy shape: { review: string } — hasStructuredData() returns false.
     *
     * @param {Object} data - Backend response data object.
     */
    function set(data) {
        _data = data || null;
        _buildCaches();
    }

    /**
     * Returns the full stored data object.
     * @returns {Object|null}
     */
    function get() {
        return _data;
    }

    /**
     * Returns true if the response contains structured issue data.
     * Falls back to markdown rendering when false.
     * @returns {boolean}
     */
    function hasStructuredData() {
        return !!(
            _data &&
            Array.isArray(_data.issues) &&
            _data.issues.length >= 0 &&
            "issues" in _data
        );
    }

    /**
     * Returns the full issues array (empty array if none).
     * @returns {Object[]}
     */
    function getIssues() {
        if (!_data || !Array.isArray(_data.issues)) return [];
        return _data.issues;
    }

    /**
     * Returns a single issue by its unique id. O(1) via Map cache.
     * @param {number} id
     * @returns {Object|null}
     */
    function getIssueById(id) {
        return _issueById.get(id) || null;
    }

    /**
     * Returns all issues on a given line number. O(1) via Map cache.
     * Multiple issues can share a line — returns all of them.
     * @param {number} lineNumber
     * @returns {Object[]}
     */
    function getIssuesByLine(lineNumber) {
        return _issuesByLine.get(lineNumber) || [];
    }

    /**
     * Returns all issues matching the given severity level.
     * @param {string} severity - "critical" | "high" | "medium" | "low"
     * @returns {Object[]}
     */
    function getIssuesBySeverity(severity) {
        return getIssues().filter((issue) => issue.severity === severity);
    }

    /**
     * Returns severity counts as a normalized object.
     * Uses backend-provided counts if present, otherwise counts from issues array.
     * @returns {{ critical: number, high: number, medium: number, low: number }}
     */
    function getSeverityCounts() {
        // Prefer backend-provided counts (authoritative)
        if (_data && _data.severity && typeof _data.severity === "object") {
            return {
                critical: _data.severity.critical || 0,
                high:     _data.severity.high     || 0,
                medium:   _data.severity.medium   || 0,
                low:      _data.severity.low      || 0,
            };
        }

        // Derive from issues array as fallback
        const counts = { critical: 0, high: 0, medium: 0, low: 0 };
        getIssues().forEach((issue) => {
            const sev = issue.severity;
            if (sev in counts) counts[sev]++;
        });
        return counts;
    }

    /**
     * Returns the summary text (empty string if unavailable).
     * @returns {string}
     */
    function getSummary() {
        return (_data && _data.summary) ? _data.summary : "";
    }

    /**
     * Returns the strengths array (empty array if unavailable).
     * @returns {string[]}
     */
    function getStrengths() {
        if (!_data || !Array.isArray(_data.strengths)) return [];
        return _data.strengths;
    }

    /**
     * Returns the recommendations array (empty array if unavailable).
     * @returns {string[]}
     */
    function getRecommendations() {
        if (!_data || !Array.isArray(_data.recommendations)) return [];
        return _data.recommendations;
    }

    /**
     * Returns the raw markdown string for legacy rendering.
     * @returns {string}
     */
    function getMarkdown() {
        if (!_data) return "";
        return _data.markdown || _data.review || "";
    }

    /**
     * Resets all state. Called before each new review request.
     */
    function clear() {
        _data = null;
        _issueById.clear();
        _issuesByLine.clear();
    }

    // ── Export ───────────────────────────────────────────────────────────────

    return {
        set,
        get,
        hasStructuredData,
        getIssues,
        getIssueById,
        getIssuesByLine,
        getIssuesBySeverity,
        getSeverityCounts,
        getSummary,
        getStrengths,
        getRecommendations,
        getMarkdown,
        clear,
    };

})();

window.ReviewState = ReviewState;
