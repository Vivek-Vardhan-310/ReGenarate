/**
 * Quick Fix Controller.
 *
 * Orchestrates the Quick Fix workflow.
 * Responsibilities:
 * - Handle explain() and quickFix() actions from issue cards.
 * - Call API.submitQuickFix().
 * - Render and manage the Quick Fix Preview Panel.
 * - Apply fixes to Monaco via Editor.manager.
 */

"use strict";

const ReviewActions = (() => {

    let _currentIssue = null;
    let _currentQuickFixData = null;

    // DOM Elements
    const _previewSection = document.getElementById("quick-fix-preview-section");
    const _issueTitleEl = document.getElementById("quick-fix-issue-title");
    const _explanationEl = document.getElementById("quick-fix-explanation");
    const _diffContainer = document.getElementById("quick-fix-diff-container");
    const _applyBtn = document.getElementById("quick-fix-apply-btn");
    const _cancelBtn = document.getElementById("quick-fix-cancel-btn");
    const _retryBtn = document.getElementById("quick-fix-retry-btn");

    function _init() {
        if (_applyBtn) _applyBtn.addEventListener("click", apply);
        if (_cancelBtn) _cancelBtn.addEventListener("click", cancel);
        if (_retryBtn) _retryBtn.addEventListener("click", () => quickFix(_currentIssue.id));
    }

    /**
     * Toggles the explanation section for an issue (repurposing the old Show Fix logic).
     * @param {number} issueId
     */
    function explain(issueId) {
        const issue = window.ReviewState.getIssueById(issueId);
        if (!issue) return;
        
        // Find the fix section within the DOM
        const fixSection = document.getElementById(`fix-${issueId}`);
        const btn = document.querySelector(`.btn-explain[data-issue-id="${issueId}"]`);
        
        if (!fixSection || !btn) return;
        
        const isHidden = fixSection.hidden;
        fixSection.hidden = !isHidden;
        
        if (isHidden) {
            btn.innerHTML = "💬 Hide Explanation";
        } else {
            btn.innerHTML = "💬 Explain";
        }
        
        // Ensure card is highlighted
        if (window.Findings) {
            window.Findings.setActiveIssue(issueId);
        }
        if (window.Editor && window.Editor.navigation) {
            window.Editor.navigation.jumpToIssue(issue);
        }
    }

    /**
     * Initiates the Quick Fix workflow for a specific issue.
     * @param {number} issueId
     */
    async function quickFix(issueId) {
        const issue = window.ReviewState.getIssueById(issueId);
        if (!issue) return;

        _currentIssue = issue;

        // 1. Highlight the issue card and jump to lines in Monaco
        if (window.Findings) window.Findings.setActiveIssue(issueId);
        if (window.Editor && window.Editor.navigation) window.Editor.navigation.jumpToIssue(issue);

        // 2. Disable all quick fix buttons and show loading state on the clicked one
        const btn = document.querySelector(`.btn-quick-fix[data-issue-id="${issueId}"]`);
        const originalText = btn ? btn.innerHTML : "⚡ Quick Fix";
        _setButtonsDisabled(true);
        
        if (btn) {
            btn.innerHTML = "⏳ Generating...";
        }

        // Hide retry button if it was shown from a previous error
        _retryBtn.classList.add("hidden");

        const language = document.getElementById("language-select").value || "python";
        const code = window.Editor.manager.getValue();

        try {
            // 3. Call API
            const response = await window.apiClient.submitQuickFix({
                language: language,
                code: code,
                issue: issue
            });

            if (response && response.success && response.data) {
                _currentQuickFixData = response.data;
                _renderPreview(issue, _currentQuickFixData);
            } else {
                _renderError(issue, response.data ? response.data.explanation : response.message);
            }
        } catch (err) {
            console.error("Quick Fix request failed:", err);
            _renderError(issue, err.message || "An unexpected network error occurred.");
        } finally {
            // Restore button text
            if (btn) {
                btn.innerHTML = originalText;
            }
            _setButtonsDisabled(false);
        }
    }

    function _setButtonsDisabled(disabled) {
        document.querySelectorAll(".btn-quick-fix").forEach(btn => {
            btn.disabled = disabled;
        });
    }

    function _esc(text) {
        if (!text) return "";
        const div = document.createElement("div");
        div.textContent = String(text);
        return div.innerHTML;
    }

    /**
     * Renders the preview panel.
     */
    function _renderPreview(issue, data) {
        _previewSection.classList.remove("hidden");
        _previewSection.scrollIntoView({ behavior: "smooth", block: "center" });

        // Build Title
        _issueTitleEl.innerHTML = `${_esc(issue.severity.toUpperCase())} &mdash; ${_esc(issue.title)}`;
        
        // Build Explanation
        _explanationEl.innerHTML = `<p class="mb-2"><strong>AI Explanation:</strong> ${_esc(data.explanation)}</p>`;
        
        // Build Diff
        let diffHtml = "";
        if (data.changedLines && data.changedLines.length > 0) {
            data.changedLines.forEach(change => {
                const lineRange = change.line === change.endLine ? `Line ${change.line}` : `Lines ${change.line}-${change.endLine}`;
                diffHtml += `<div class="mb-4">`;
                diffHtml += `<div class="text-xs text-surface-400 mb-1 px-2 border-b border-surface-800 pb-1">${lineRange}</div>`;
                
                if (change.old) {
                    const oldLines = change.old.split("\n");
                    oldLines.forEach(l => diffHtml += `<span class="diff-old">- ${_esc(l)}</span>`);
                }
                if (change.new) {
                    const newLines = change.new.split("\n");
                    newLines.forEach(l => diffHtml += `<span class="diff-new">+ ${_esc(l)}</span>`);
                }
                diffHtml += `</div>`;
            });
        } else {
            diffHtml = `<div class="p-3 text-surface-400 italic">No line-specific diff available. Full file will be replaced.</div>`;
        }
        
        _diffContainer.innerHTML = diffHtml;
        _applyBtn.classList.remove("hidden");
    }

    /**
     * Renders an error inside the preview panel.
     */
    function _renderError(issue, message) {
        _previewSection.classList.remove("hidden");
        _previewSection.scrollIntoView({ behavior: "smooth", block: "center" });

        _issueTitleEl.innerHTML = `<span class="text-red-400">Failed to Generate Quick Fix</span>`;
        _explanationEl.innerHTML = `<p class="text-red-300">${_esc(message)}</p>`;
        _diffContainer.innerHTML = "";
        
        _applyBtn.classList.add("hidden");
        _retryBtn.classList.remove("hidden");
    }

    /**
     * Applies the fix to the Monaco Editor.
     */
    function apply() {
        if (!_currentQuickFixData || !_currentIssue) return;

        // Apply via MonacoManager
        window.Editor.manager.applyEdits(_currentQuickFixData.changedLines, _currentQuickFixData.fixedCode);
        
        // Clear diagnostics & markers to avoid stale squiggles
        if (window.Editor.diagnostics) {
            window.Editor.diagnostics.clearDiagnostics();
        }
        cancel(); // Close the preview panel
        
        if (window.notifications) {
            window.notifications.show("Quick Fix applied successfully! Diagnostics have been cleared. Run Generate Review when you're ready to analyze the updated code.", "success");
        }
    }

    /**
     * Cancels the preview and hides it.
     */
    function cancel() {
        _previewSection.classList.add("hidden");
        _currentQuickFixData = null;
        _currentIssue = null;
        _retryBtn.classList.add("hidden");
    }

    // Initialize DOM events on load
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", _init);
    } else {
        _init();
    }

    return {
        explain,
        quickFix,
        apply,
        cancel
    };

})();

window.ReviewActions = ReviewActions;
