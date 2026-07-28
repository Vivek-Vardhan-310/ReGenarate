/**
 * LiveSync — Post-Edit Review State Synchronization.
 *
 * Listens to QuickFixApplied events and runs a full synchronization pipeline:
 *   1.  Increment review version
 *   2.  Mark resolved issue as FIXED
 *   3.  Detect overlapping issues → STALE
 *   4.  Fingerprint-relocate remaining OPEN issues (lazy fingerprint init)
 *   5.  Deduplicate ReviewState
 *   6.  Refresh Monaco diagnostics (OPEN issues only)
 *   7.  Surgical DOM: removeCard() + updateCard() + updateCount()
 *   8.  Emit ReviewUpdated + ReviewVersionChanged
 *
 * processEdits() accepts an ARRAY of edits for future Apply All support.
 * Today it's always a single-item list.
 *
 * Telemetry is tracked internally and accessible via getStats().
 *
 * Depends on: ReviewEvents, ReviewState, FingerprintEngine,
 *             Editor.diagnostics, Findings, SeverityCards
 *
 * Exposed as: window.LiveSync
 */

"use strict";

const LiveSync = (() => {

    // ── Telemetry ─────────────────────────────────────────────────────────────

    const _stats = {
        totalFixesApplied:    0,
        fingerprintHigh:      0,
        fingerprintMedium:    0,
        fingerprintLow:       0,
        fingerprintUnknown:   0,
        overlapDetections:    0,
        staleMarkings:        0,
        deduplicationsRun:    0,
    };

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Derives the edited line region from changedLines (pre-edit 1-based coords).
     * @param {Array} changedLines
     * @returns {{ startLine: number, endLine: number }}
     */
    function _editedRegion(changedLines) {
        if (!changedLines || changedLines.length === 0) return { startLine: 1, endLine: 1 };
        const starts = changedLines.map((c) => c.line    || 1);
        const ends   = changedLines.map((c) => c.endLine || c.line || 1);
        return { startLine: Math.min(...starts), endLine: Math.max(...ends) };
    }

    /**
     * Computes line delta between old and new code.
     * @param {string} oldCode
     * @param {string} newCode
     * @returns {number}
     */
    function _lineDelta(oldCode, newCode) {
        return newCode.split("\n").length - oldCode.split("\n").length;
    }

    // ── Core Pipeline ─────────────────────────────────────────────────────────

    /**
     * Main entry point. Accepts a list of edits for future Apply All.
     * Each edit: { issueUuid, changedLines, oldCode, newCode, fixData }
     *
     * @param {Array<Object>} edits
     */
    function processEdits(edits) {
        if (!window.ReviewState || !edits || edits.length === 0) return;
        edits.forEach((edit) => _processSingleEdit(edit));
    }

    /**
     * Processes one applied Quick Fix through the full sync pipeline.
     * Wrapped in try/catch so no silent failures escape to the user.
     */
    function _processSingleEdit(edit) {
        try {
            _runPipeline(edit);
        } catch (err) {
            console.error("[LiveSync] Pipeline threw an uncaught exception:", err);
        }
    }

    function _runPipeline({ issueUuid, changedLines, oldCode, newCode, fixData }) {
        const state = window.ReviewState;

        if (!state) {
            console.error("[LiveSync] window.ReviewState is not available.");
            return;
        }
        if (!window.FingerprintEngine) {
            console.error("[LiveSync] window.FingerprintEngine is not available.");
            return;
        }
        if (!window.ReviewEvents) {
            console.error("[LiveSync] window.ReviewEvents is not available.");
            return;
        }

        console.info(`[LiveSync] Pipeline start — UUID=${issueUuid}`);
        console.log("[LiveSync] locating issue UUID ...");

        // ── 1. Find the resolved issue ────────────────────────────────────────
        const fixedIssue = state.getIssueByUuid(issueUuid);
        if (!fixedIssue) {
            console.error(
                `[LiveSync] getIssueByUuid returned null for UUID="${issueUuid}". ` +
                `All known UUIDs: [${state.getIssues().map(i => i.uuid).join(", ")}]`
            );
            return;
        }
        console.log("[LiveSync] issue found");
        const fixedSeverity = fixedIssue.severity;

        // ── 2. Increment version & mark FIXED ─────────────────────────────────
        console.log("[LiveSync] status OPEN -> FIXED");
        const newVersion = state.incrementVersion();
        state.updateIssue(issueUuid, { status: "FIXED", lastUpdatedVersion: newVersion });
        window.ReviewEvents.emit("IssueResolved", { issueUuid, severity: fixedSeverity });
        _stats.totalFixesApplied++;

        // ── 3. Compute edit metadata ──────────────────────────────────────────
        const editedRegion = _editedRegion(changedLines);
        const delta        = _lineDelta(oldCode, newCode);
        const oldLines     = oldCode.split("\n");
        const newLines     = newCode.split("\n");

        // ── 4. Process remaining OPEN issues ──────────────────────────────────
        const openIssues = state.getIssues().filter((i) => i.status === "OPEN");

        openIssues.forEach((issue) => {
            // ── Overlap detection ─────────────────────────────────────────────
            if (window.FingerprintEngine.overlapsEdit(issue, editedRegion)) {
                _stats.overlapDetections++;
                _stats.staleMarkings++;
                state.updateIssue(issue.uuid, {
                    status: "STALE",
                    locationConfidence:      "UNKNOWN",
                    locationConfidenceScore: 0.0,
                    lastUpdatedVersion:      newVersion,
                });
                window.ReviewEvents.emit("IssueStale", { issueUuid: issue.uuid });
                return;
            }

            // ── Lazy fingerprint init (computed from oldCode on first fix) ────
            if (!issue.fingerprint || !issue.fingerprint.hash) {
                const fp = window.FingerprintEngine.compute(issue, oldLines);
                state.updateIssue(issue.uuid, { fingerprint: fp });
            }

            // ── Fingerprint relocation ────────────────────────────────────────
            const fp     = state.getIssueByUuid(issue.uuid).fingerprint;
            const result = window.FingerprintEngine.locate(fp, newLines, issue.line, delta, editedRegion);

            // Telemetry
            if      (result.confidence === "HIGH")    _stats.fingerprintHigh++;
            else if (result.confidence === "MEDIUM")  _stats.fingerprintMedium++;
            else if (result.confidence === "LOW")     _stats.fingerprintLow++;
            else                                       _stats.fingerprintUnknown++;

            const newStatus = result.confidence === "UNKNOWN" ? "UNKNOWN_LOCATION" : "OPEN";
            const oldLine   = issue.line;

            state.updateIssue(issue.uuid, {
                line:                    result.newLine,
                endLine:                 result.newEndLine,
                locationConfidence:      result.confidence,
                locationConfidenceScore: result.confidenceScore,
                status:                  newStatus,
                lastUpdatedVersion:      newVersion,
            });

            if (result.newLine !== oldLine) {
                window.ReviewEvents.emit("IssueRelocated", {
                    issueUuid:       issue.uuid,
                    oldLine,
                    newLine:         result.newLine,
                    confidence:      result.confidence,
                    confidenceScore: result.confidenceScore,
                });
            }
        });

        // ── 5. Deduplicate ────────────────────────────────────────────────────
        state.deduplicateIssues();
        _stats.deduplicationsRun++;

        // ── 6. Refresh Monaco diagnostics (OPEN issues only) ──────────────────
        _refreshDiagnostics();

        // ── 7. Surgical DOM updates ───────────────────────────────────────────
        _updatePanel(fixedIssue, fixedSeverity, state);

        // ── 8. Emit lifecycle events ──────────────────────────────────────────
        window.ReviewEvents.emit("ReviewUpdated", {
            issues:         state.getIssues(),
            severityCounts: state.getSeverityCounts(),
            reviewVersion:  state.getVersion(),
        });

        window.ReviewEvents.emit("ReviewVersionChanged", { version: state.getVersion() });

        _logSyncSummary(fixedIssue, editedRegion, delta, newVersion);
        console.info(`[LiveSync] Pipeline complete — UUID=${issueUuid}, version=${newVersion}`);

        console.log("====================================================");
        console.log("ReviewState.getActiveIssues():", state.getActiveIssues());
        console.log("ReviewState.getIssues():", state.getIssues());
        console.log("ReviewState.getSeverityCounts():", state.getSeverityCounts());
        console.log("====================================================");
    }

    // ── DOM Helpers ───────────────────────────────────────────────────────────

    function _refreshDiagnostics() {
        console.log("[Diagnostics] refresh()");
        if (!window.Editor || !window.Editor.diagnostics) return;
        // Only OPEN issues get Monaco markers; UNKNOWN/STALE/FIXED get none.
        window.Editor.diagnostics.setDiagnostics(window.ReviewState.getDiagnosticIssues());
        window.ReviewEvents.emit("DiagnosticsUpdated", {});
    }

    function _updatePanel(fixedIssue, fixedSeverity, state) {
        // 1. Remove the resolved card
        if (window.Findings) {
            window.Findings.removeCard(fixedIssue.uuid);
        }

        // 2. Update severity count on the dashboard card
        if (window.SeverityCards) {
            const counts = state.getSeverityCounts();
            window.SeverityCards.updateCount(fixedSeverity, counts[fixedSeverity] || 0);
        }

        // 3. Update line badges and warning badges on remaining cards
        state.getActiveIssues().forEach((issue) => {
            if (window.Findings) {
                window.Findings.updateCard(issue);
            }
        });
    }

    function _logSyncSummary(fixedIssue, editedRegion, delta, version) {
        const s = _stats;
        console.info(
            `[LiveSync] v${version} | Fixed: "${fixedIssue.title}" | ` +
            `Edit: L${editedRegion.startLine}-${editedRegion.endLine} Δ${delta} | ` +
            `High:${s.fingerprintHigh} Med:${s.fingerprintMedium} ` +
            `Low:${s.fingerprintLow} Unknown:${s.fingerprintUnknown} ` +
            `Stale:${s.staleMarkings} Overlaps:${s.overlapDetections}`
        );
    }

    // ── Init ──────────────────────────────────────────────────────────────────

    function init() {
        if (!window.ReviewEvents) {
            console.error("[LiveSync] FATAL: window.ReviewEvents is not defined at init time. Check that eventBus.js loads before liveSync.js.");
            return;
        }

        // React to Quick Fix completions
        window.ReviewEvents.on("QuickFixApplied", (data) => {
            console.log("[LiveSync] started");
            console.info("[LiveSync] Received QuickFixApplied event.", data);
            processEdits([data]);
            console.log("[LiveSync] completed");
        });

        console.info("[LiveSync] Initialized and listening for QuickFixApplied.");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    // ── Export ────────────────────────────────────────────────────────────────

    return {
        processEdits,
        getStats: () => ({ ..._stats }),
    };

})();

window.LiveSync = LiveSync;
