/**
 * ReviewState — Centralized AI Review Data Store.
 *
 * Single source of truth for the current AI review session.
 * All modules read data exclusively from this store.
 *
 * v2 additions (additive — all v1 callers continue to work):
 *   - Issue UUIDs (permanent, never change during session lifetime)
 *   - Issue lifecycle status: OPEN | FIXED | STALE | UNKNOWN_LOCATION | IGNORED
 *   - Review versioning: reviewVersion increments on each Apply Fix
 *   - Per-issue: createdReviewVersion, lastUpdatedVersion, locationConfidence,
 *                locationConfidenceScore, fingerprint
 *   - UUID-based Map for O(1) lookups alongside the legacy id-based Map
 *   - removeIssue(uuid) → marks FIXED (non-destructive)
 *   - updateIssue(uuid, patch) → partial field update
 *   - deduplicateIssues() → removes same (title + ruleId + normalizedText)
 *   - getSeverityCounts() → derives from active issues (OPEN + UNKNOWN + STALE)
 *   - getActiveIssues() → all non-FIXED, non-IGNORED
 *
 * Does NOT:
 *   - Trigger rendering.
 *   - Touch the DOM.
 *   - Make API calls.
 *
 * Exposed as: window.ReviewState
 */

"use strict";

const ReviewState = (() => {

    // ── Internal State ────────────────────────────────────────────────────────

    let _data = null;

    /** Incremented on each Apply Fix. Starts at 1 when a review is set. */
    let _reviewVersion = 0;

    /** @type {Map<number, Object>}  legacy id → issue */
    let _issueById  = new Map();

    /** @type {Map<string, Object>}  uuid → issue */
    let _issueByUuid = new Map();

    /** @type {Map<number, Object[]>}  lineNumber → issues[] */
    let _issuesByLine = new Map();

    // ── Private: UUID generator ───────────────────────────────────────────────

    function _uuidv4() {
        // RFC 4122 §4.4 compliant UUID v4
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    // ── Private: Cache builders ───────────────────────────────────────────────

    function _buildCaches() {
        _issueById.clear();
        _issueByUuid.clear();
        _issuesByLine.clear();

        if (!_data || !Array.isArray(_data.issues)) return;

        _data.issues.forEach((issue) => {
            _issueById.set(issue.id, issue);
            _issueByUuid.set(issue.uuid, issue);

            const line = issue.line;
            if (line != null) {
                if (!_issuesByLine.has(line)) _issuesByLine.set(line, []);
                _issuesByLine.get(line).push(issue);
            }
        });
    }

    /**
     * Enriches raw backend issues with frontend-only lifecycle fields.
     * Called once inside set(). Idempotent — skips already-enriched issues.
     */
    function _enrichIssues(issues) {
        return issues.map((issue, idx) => ({
            // Preserve all backend fields
            ...issue,

            // ── Stable identifier (never changes) ──────────────────────────
            uuid: issue.uuid || _uuidv4(),

            // ── Lifecycle ─────────────────────────────────────────────────
            status: issue.status || "OPEN",

            // ── Location confidence ───────────────────────────────────────
            locationConfidence:      issue.locationConfidence      || "UNKNOWN",
            locationConfidenceScore: issue.locationConfidenceScore ?? 0.0,

            // ── Fingerprint (computed lazily by LiveSync) ─────────────────
            fingerprint: issue.fingerprint || null,

            // ── Versioning ────────────────────────────────────────────────
            createdReviewVersion:  issue.createdReviewVersion  || _reviewVersion,
            lastUpdatedVersion:    issue.lastUpdatedVersion    || _reviewVersion,
        }));
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Stores the full AI response, enriches issues with lifecycle fields,
     * rebuilds lookup caches, and resets the review version to 1.
     *
     * @param {Object} data - Backend response (structured or legacy).
     */
    function set(data) {
        _reviewVersion = 1;
        _data = data ? { ...data } : null;

        if (_data && Array.isArray(_data.issues)) {
            _data.issues = _enrichIssues(_data.issues);
        }

        _buildCaches();
    }

    /** @returns {Object|null} Full stored data. */
    function get() { return _data; }

    /**
     * Returns true if the response contains structured issue data.
     * @returns {boolean}
     */
    function hasStructuredData() {
        return !!(_data && Array.isArray(_data.issues) && "issues" in _data);
    }

    /**
     * Returns ALL issues (including FIXED/IGNORED/STALE).
     * Most callers should use getActiveIssues() instead.
     * @returns {Object[]}
     */
    function getIssues() {
        if (!_data || !Array.isArray(_data.issues)) return [];
        return _data.issues;
    }

    /**
     * Returns issues that are visible/active (OPEN | UNKNOWN_LOCATION | STALE).
     * Excludes FIXED and IGNORED issues.
     * @returns {Object[]}
     */
    function getActiveIssues() {
        return getIssues().filter((i) =>
            i.status === "OPEN" || i.status === "UNKNOWN_LOCATION" || i.status === "STALE"
        );
    }

    /**
     * Returns issues that should show Monaco markers (OPEN only).
     * UNKNOWN_LOCATION and STALE issues get a warning badge but no marker.
     * @returns {Object[]}
     */
    function getDiagnosticIssues() {
        return getIssues().filter((i) => i.status === "OPEN");
    }

    /** O(1) lookup by legacy numeric id. @returns {Object|null} */
    function getIssueById(id) { return _issueById.get(id) || null; }

    /** O(1) lookup by UUID. @returns {Object|null} */
    function getIssueByUuid(uuid) { return _issueByUuid.get(uuid) || null; }

    /** O(1) lookup by line number. @returns {Object[]} */
    function getIssuesByLine(lineNumber) { return _issuesByLine.get(lineNumber) || []; }

    /** @returns {Object[]} */
    function getIssuesBySeverity(severity) {
        return getIssues().filter((i) => i.severity === severity);
    }

    /**
     * Derives severity counts from ACTIVE issues only (OPEN + UNKNOWN + STALE).
     * Always accurate after Quick Fixes.
     * @returns {{ critical, high, medium, low }}
     */
    function getSeverityCounts() {
        console.log("[ReviewState] severity updated");
        const counts = { high: 0, medium: 0, low: 0 };
        getActiveIssues().forEach((issue) => {
            const sev = issue.severity;
            if (sev in counts) counts[sev]++;
        });
        return counts;
    }

    /** @returns {string} */
    function getSummary() { return (_data && _data.summary) ? _data.summary : ""; }

    /** @returns {string[]} */
    function getStrengths() {
        if (!_data || !Array.isArray(_data.strengths)) return [];
        return _data.strengths;
    }

    /** @returns {string[]} */
    function getRecommendations() {
        if (!_data || !Array.isArray(_data.recommendations)) return [];
        return _data.recommendations;
    }

    /** @returns {string} */
    function getMarkdown() {
        if (!_data) return "";
        return _data.markdown || _data.review || "";
    }

    // ── Versioning ────────────────────────────────────────────────────────────

    /** @returns {number} Current review version. */
    function getVersion() { return _reviewVersion; }

    /**
     * Increments the review version (called by LiveSync after each Apply Fix).
     * @returns {number} New version number.
     */
    function incrementVersion() {
        _reviewVersion++;
        return _reviewVersion;
    }

    // ── Mutation API ──────────────────────────────────────────────────────────

    /**
     * Applies a partial update to an issue by UUID.
     * Rebuilds the affected caches after the update.
     *
     * @param {string} uuid - Issue UUID.
     * @param {Object} patch - Fields to update (shallow merge).
     * @returns {boolean} True if the issue was found and updated.
     */
    function updateIssue(uuid, patch) {
        console.log("[ReviewState] issue updated");
        const issue = _issueByUuid.get(uuid);
        if (!issue) {
            console.warn("[ReviewState] updateIssue: UUID not found:", uuid);
            return false;
        }

        Object.assign(issue, patch);

        // Rebuild line-based cache since line may have changed
        _issuesByLine.clear();
        getIssues().forEach((i) => {
            const line = i.line;
            if (line != null) {
                if (!_issuesByLine.has(line)) _issuesByLine.set(line, []);
                _issuesByLine.get(line).push(i);
            }
        });

        return true;
    }

    /**
     * Marks an issue as FIXED (non-destructive — the issue stays in the array
     * for history and undo support, it's simply hidden from the active UI).
     *
     * @param {string} uuid - Issue UUID.
     */
    function removeIssue(uuid) {
        updateIssue(uuid, { status: "FIXED", lastUpdatedVersion: _reviewVersion });
    }

    /**
     * Removes duplicate issues by (title + ruleId + normalizedText fingerprint).
     * When duplicates are found, the one with the highest locationConfidenceScore
     * is kept; the others are marked FIXED.
     */
    function deduplicateIssues() {
        const issues = getIssues();
        /** @type {Map<string, Object>} dedup key → winner issue */
        const seen = new Map();

        issues.forEach((issue) => {
            if (issue.status === "FIXED" || issue.status === "IGNORED") return;

            const normText = (issue.fingerprint && issue.fingerprint.normalizedText)
                || (window.FingerprintEngine ? window.FingerprintEngine.normalize(issue.title + issue.description) : issue.title);

            const key = `${issue.ruleId || ""}::${issue.title}::${normText}`;

            if (!seen.has(key)) {
                seen.set(key, issue);
            } else {
                const existing = seen.get(key);
                // Keep highest confidence
                if ((issue.locationConfidenceScore || 0) > (existing.locationConfidenceScore || 0)) {
                    // Mark the lower-confidence one as FIXED
                    Object.assign(existing, { status: "FIXED", lastUpdatedVersion: _reviewVersion });
                    seen.set(key, issue);
                } else {
                    Object.assign(issue, { status: "FIXED", lastUpdatedVersion: _reviewVersion });
                }
            }
        });

        // Rebuild caches after potential changes
        _buildCaches();
    }

    /**
     * Resets all state. Called before each new review request.
     */
    function clear() {
        _data = null;
        _reviewVersion = 0;
        _issueById.clear();
        _issueByUuid.clear();
        _issuesByLine.clear();
    }

    // ── Export ────────────────────────────────────────────────────────────────

    return {
        // Core
        set,
        get,
        clear,
        hasStructuredData,

        // Issue getters
        getIssues,
        getActiveIssues,
        getDiagnosticIssues,
        getIssueById,
        getIssueByUuid,
        getIssuesByLine,
        getIssuesBySeverity,

        // Aggregates
        getSeverityCounts,
        getSummary,
        getStrengths,
        getRecommendations,
        getMarkdown,

        // Versioning
        getVersion,
        incrementVersion,

        // Mutations
        updateIssue,
        removeIssue,
        deduplicateIssues,
    };

})();

window.ReviewState = ReviewState;
