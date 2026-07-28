/**
 * Quick Fix Controller.
 *
 * Orchestrates the Quick Fix workflow:
 *   1. Handle explain() and quickFix() actions from issue cards.
 *   2. Cache Quick Fix previews per-issue UUID (no repeat backend calls).
 *   3. Guard against FIXED / STALE / UNKNOWN_LOCATION issues.
 *   4. Apply fixes to Monaco, then emit QuickFixApplied for LiveSync.
 *
 * Cache invalidation:
 *   - On new Generate Review (ReviewState.clear() is called → cache cleared)
 *   - On issue becoming FIXED / STALE (guard prevents re-use)
 *
 * Exposed as: window.ReviewActions
 */

"use strict";

const ReviewActions = (() => {

    // ── State ─────────────────────────────────────────────────────────────────

    /** Issue UUID currently shown in the preview panel. */
    let _currentIssue = null;

    /** QuickFixData currently loaded into the preview panel. */
    let _currentQuickFixData = null;

    /**
     * Preview cache — keyed by issue UUID.
     * Cleared when ReviewState is reset (new Generate Review).
     * @type {Map<string, Object>}  uuid → QuickFixData
     */
    const _previewCache = new Map();

    // ── DOM Elements ──────────────────────────────────────────────────────────

    const _previewSection = document.getElementById("quick-fix-preview-section");
    const _issueTitleEl   = document.getElementById("quick-fix-issue-title");
    const _explanationEl  = document.getElementById("quick-fix-explanation");
    const _diffContainer  = document.getElementById("quick-fix-diff-container");
    const _applyBtn       = document.getElementById("quick-fix-apply-btn");
    const _cancelBtn      = document.getElementById("quick-fix-cancel-btn");
    const _retryBtn       = document.getElementById("quick-fix-retry-btn");

    // ── Init ──────────────────────────────────────────────────────────────────

    function _init() {
        if (_applyBtn)  _applyBtn.addEventListener("click",  apply);
        if (_cancelBtn) _cancelBtn.addEventListener("click", cancel);
        if (_retryBtn)  _retryBtn.addEventListener("click",  _retryCurrentIssue);

        // Clear preview cache whenever a new review is generated
        if (window.ReviewEvents) {
            window.ReviewEvents.on("ReviewUpdated", () => {
                // Only clear if the version just went back to 1 (new review)
                if (window.ReviewState && window.ReviewState.getVersion() === 1) {
                    _previewCache.clear();
                    console.info("[QuickFix] Preview cache cleared — new review.");
                }
            });
        }
    }

    function _retryCurrentIssue() {
        if (_currentIssue) {
            // Force bypass cache on retry
            _previewCache.delete(_currentIssue.uuid);
            quickFix(_currentIssue.id);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function _esc(text) {
        if (!text) return "";
        const div = document.createElement("div");
        div.textContent = String(text);
        return div.innerHTML;
    }

    function _setButtonsDisabled(disabled) {
        document.querySelectorAll(".btn-quick-fix").forEach((btn) => {
            btn.disabled = disabled;
        });
    }

    // ── Public: explain ───────────────────────────────────────────────────────

    /**
     * Toggles the explanation section for an issue.
     * @param {string} issueUuid
     */
    function explain(issueUuid) {
        const issue = window.ReviewState ? window.ReviewState.getIssueByUuid(issueUuid) : null;
        if (!issue) return;

        const fixSection = document.getElementById(`fix-${issue.id}`);
        const btn        = document.querySelector(`.btn-explain[data-uuid="${issueUuid}"]`);
        if (!fixSection || !btn) return;

        const isHidden = fixSection.hidden;
        fixSection.hidden = !isHidden;
        btn.innerHTML = isHidden ? "💬 Hide Explanation" : "💬 Explain";

        if (window.Findings) window.Findings.setActiveIssue(issueUuid);
        if (window.Editor && window.Editor.navigation) window.Editor.navigation.jumpToIssue(issue);
    }

    // ── Public: quickFix ──────────────────────────────────────────────────────

    /**
     * Initiates the Quick Fix workflow for a specific issue.
     *
     * - If a cached preview exists, shows it immediately (no backend call).
     * - If the issue is FIXED / STALE / UNKNOWN_LOCATION, silently aborts.
     * - Otherwise, calls the backend once and caches the result.
     *
     * @param {string} issueUuid - Immutable identifier for the issue.
     */
    async function quickFix(issueUuid) {
        if (!window.ReviewState) {
            console.warn("[QuickFix] ReviewState not available.");
            return;
        }

        const issue = window.ReviewState.getIssueByUuid(issueUuid);
        if (!issue) {
            console.warn("[QuickFix] Issue not found by UUID:", issueUuid);
            return;
        }

        // ── Guard: do not allow Quick Fix on non-OPEN issues ─────────────────
        if (issue.status && issue.status !== "OPEN") {
            console.info(`[QuickFix] Skipping — issue status is "${issue.status}".`);
            if (window.notifications) {
                window.notifications.show(
                    `This issue is already ${issue.status.toLowerCase()}. No fix needed.`,
                    "info"
                );
            }
            return;
        }

        _currentIssue = issue;

        // Highlight the issue card and jump to line
        if (window.Findings) window.Findings.setActiveIssue(issueUuid);
        if (window.Editor && window.Editor.navigation) window.Editor.navigation.jumpToIssue(issue);

        // ── Cache hit: reuse existing preview, skip backend ───────────────────
        const uuid = issue.uuid;
        if (uuid && _previewCache.has(uuid)) {
            console.info(`[QuickFix] Serving cached preview for UUID: ${uuid}`);
            _currentQuickFixData = _previewCache.get(uuid);
            _renderPreview(issue, _currentQuickFixData);
            return;
        }

        // ── Cache miss: call backend ──────────────────────────────────────────
        const btn          = document.querySelector(`.btn-quick-fix[data-uuid="${issueUuid}"]`);
        const originalText = btn ? btn.innerHTML : "⚡ Quick Fix";
        _setButtonsDisabled(true);
        if (btn) btn.innerHTML = "⏳ Generating...";
        if (_retryBtn) _retryBtn.classList.add("hidden");

        const language = (document.getElementById("language-select") || {}).value || "python";
        const code     = window.Editor && window.Editor.manager ? window.Editor.manager.getValue() : "";

        try {
            const response = await window.apiClient.submitQuickFix({ language, code, issue });

            if (response && response.success && response.data) {
                _currentQuickFixData = response.data;

                // Cache the result so future opens skip the backend
                if (uuid) {
                    _previewCache.set(uuid, response.data);
                    console.info(`[QuickFix] Preview cached for UUID: ${uuid}`);
                }

                _renderPreview(issue, _currentQuickFixData);
            } else {
                _renderError(issue, response && response.data
                    ? response.data.explanation
                    : (response && response.message) || "Unknown error");
            }
        } catch (err) {
            console.error("[QuickFix] Backend request failed:", err);
            _renderError(issue, err.message || "An unexpected network error occurred.");
        } finally {
            if (btn) btn.innerHTML = originalText;
            _setButtonsDisabled(false);
        }
    }

    // ── Preview Rendering ─────────────────────────────────────────────────────

    function _renderPreview(issue, data) {
        if (!_previewSection) return;
        _previewSection.classList.remove("hidden");
        _previewSection.scrollIntoView({ behavior: "smooth", block: "center" });

        if (_issueTitleEl) {
            _issueTitleEl.innerHTML = `${_esc((issue.severity || "").toUpperCase())} &mdash; ${_esc(issue.title)}`;
        }

        if (_explanationEl) {
            _explanationEl.innerHTML = `<p class="mb-2"><strong>AI Explanation:</strong> ${_esc(data.explanation)}</p>`;
        }

        let diffHtml = "";
        if (data.changedLines && data.changedLines.length > 0) {
            data.changedLines.forEach((change) => {
                const rangeLabel = change.line === change.endLine
                    ? `Line ${change.line}`
                    : `Lines ${change.line}–${change.endLine}`;
                diffHtml += `<div class="mb-4">`;
                diffHtml += `<div class="text-xs text-surface-400 mb-1 px-2 border-b border-surface-800 pb-1">${rangeLabel}</div>`;
                if (change.old) {
                    change.old.split("\n").forEach((l) => {
                        diffHtml += `<span class="diff-old">- ${_esc(l)}</span>`;
                    });
                }
                if (change.new) {
                    change.new.split("\n").forEach((l) => {
                        diffHtml += `<span class="diff-new">+ ${_esc(l)}</span>`;
                    });
                }
                diffHtml += `</div>`;
            });
        } else {
            diffHtml = `<div class="p-3 text-surface-400 italic">No line-specific diff available. Full file will be replaced.</div>`;
        }

        if (_diffContainer) _diffContainer.innerHTML = diffHtml;
        if (_applyBtn) _applyBtn.classList.remove("hidden");
    }

    function _renderError(issue, message) {
        if (!_previewSection) return;
        _previewSection.classList.remove("hidden");
        _previewSection.scrollIntoView({ behavior: "smooth", block: "center" });

        if (_issueTitleEl) _issueTitleEl.innerHTML = `<span class="text-red-400">Failed to Generate Quick Fix</span>`;
        if (_explanationEl) _explanationEl.innerHTML = `<p class="text-red-300">${_esc(message)}</p>`;
        if (_diffContainer) _diffContainer.innerHTML = "";
        if (_applyBtn)  _applyBtn.classList.add("hidden");
        if (_retryBtn) _retryBtn.classList.remove("hidden");
    }

    // ── Public: apply ─────────────────────────────────────────────────────────

    /**
     * Applies the fix to Monaco and hands synchronization off to LiveSync
     * via the QuickFixApplied event.
     *
     * IMPORTANT: oldCode is captured BEFORE the edit so LiveSync can compute
     * accurate fingerprints against the code-as-reviewed state.
     */
    function apply() {
        console.log("[QuickFix] Apply clicked");
        if (!_currentQuickFixData || !_currentIssue) {
            console.warn("[QuickFix] apply() called with no active fix data.");
            return;
        }

        // Capture everything needed BEFORE cancel() nulls the refs
        const issueSnapshot  = _currentIssue;
        const fixDataSnapshot = _currentQuickFixData;
        const issueUuid      = issueSnapshot.uuid;
        const changedLines   = fixDataSnapshot.changedLines || [];

        console.info(`[QuickFix] Applying fix for UUID=${issueUuid}, title="${issueSnapshot.title}"`);

        if (!issueUuid) {
            console.error("[QuickFix] Issue UUID is missing — LiveSync will not be able to locate the issue. Check ReviewState.set() was called.");
        }

        // Capture oldCode BEFORE the edit
        const oldCode = window.Editor && window.Editor.manager
            ? window.Editor.manager.getValue()
            : "";

        // Apply edit to Monaco (preserves undo history via executeEdits)
        if (window.Editor && window.Editor.manager) {
            window.Editor.manager.applyEdits(changedLines, fixDataSnapshot.fixedCode);
        }
        console.log("[QuickFix] executeEdits complete");

        // Capture newCode AFTER the edit
        const newCode = window.Editor && window.Editor.manager
            ? window.Editor.manager.getValue()
            : "";

        // Evict from cache — the fix has been applied, no replay needed
        if (issueUuid) _previewCache.delete(issueUuid);

        // Close the preview panel (nulls _currentIssue and _currentQuickFixData)
        cancel();

        // Hand synchronization off to LiveSync
        if (window.ReviewEvents) {
            console.info("[QuickFix] Emitting QuickFixApplied for LiveSync.");
            console.log("[QuickFix] emitting QuickFixApplied");
            window.ReviewEvents.emit("QuickFixApplied", {
                issueUuid,
                changedLines,
                oldCode,
                newCode,
                fixData: fixDataSnapshot,
            });
        } else {
            console.error("[QuickFix] window.ReviewEvents not available — LiveSync will not run!");
        }

        if (window.notifications) {
            window.notifications.show(
                "Quick Fix applied! Panel and diagnostics updated.",
                "success"
            );
        }
    }

    // ── Public: cancel ────────────────────────────────────────────────────────

    /**
     * Closes the preview panel and resets transient state.
     * Does NOT evict the preview cache — cached fixes remain available.
     */
    function cancel() {
        if (_previewSection) _previewSection.classList.add("hidden");
        if (_retryBtn) _retryBtn.classList.add("hidden");
        _currentQuickFixData = null;
        _currentIssue        = null;
    }

    // ── Bootstrap ─────────────────────────────────────────────────────────────

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", _init);
    } else {
        _init();
    }

    // ── Export ────────────────────────────────────────────────────────────────

    return { explain, quickFix, apply, cancel };

})();

window.ReviewActions = ReviewActions;
