/**
 * Findings — Grouped Issue Cards Renderer.
 *
 * Renders AI review issues grouped by severity (Critical → High → Medium → Low).
 * Each issue card contains: severity badge, title, description, line badge,
 * suggestion, and a collapsible "▼ Show Fix" section.
 *
 * Responsibilities:
 *   - Render issue cards grouped by severity.
 *   - Highlight the active card (cursor sync / click sync).
 *   - Scroll the active card into view in the review panel.
 *   - Wire card click → NavigationManager.jumpToIssue().
 *   - Toggle "▼ Show Fix" section collapse/expand.
 *   - Reserve "✔ Apply Fix" slot for future implementation.
 *
 * Does NOT:
 *   - Store issue data (→ ReviewState).
 *   - Navigate (→ NavigationManager).
 *   - Render severity dashboard cards (→ SeverityCards).
 *
 * Exposed as: window.Findings
 */

"use strict";

const Findings = (() => {

    // ── Internal State ────────────────────────────────────────────────────────

    /** Currently active issue id. */
    let _activeId = null;

    /** Container element reference. */
    let _container = null;

    // ── Severity Display Order ────────────────────────────────────────────────

    /** Order in which severity groups are rendered (most critical first). */
    const SEVERITY_ORDER = ["critical", "high", "medium", "low"];

    /** Visual labels and badge styles per severity. */
    const SEVERITY_STYLE = {
        critical: { label: "Critical", badgeClass: "badge-critical", icon: "●" },
        high:     { label: "High",     badgeClass: "badge-high",     icon: "▲" },
        medium:   { label: "Medium",   badgeClass: "badge-medium",   icon: "◆" },
        low:      { label: "Low",      badgeClass: "badge-low",      icon: "ℹ" },
    };

    // ── Private: HTML Builders ────────────────────────────────────────────────

    /**
     * Escapes HTML special characters to prevent XSS in rendered content.
     * @param {string} text
     * @returns {string}
     */
    function _esc(text) {
        if (!text) return "";
        const div = document.createElement("div");
        div.textContent = String(text);
        return div.innerHTML;
    }

    /**
     * Builds the HTML for the "▼ Show Fix" collapsible section.
     * Reserves "✔ Apply Fix" slot for future implementation.
     *
     * @param {Object} issue
     * @returns {string} HTML string.
     */
    function _buildFixSection(issue) {
        const fixId = `fix-${issue.id}`;
        const hasSnippet = !!(issue.fixSnippet);

        const snippetHtml = hasSnippet
            ? `<pre class="fix-snippet"><code>${_esc(issue.fixSnippet)}</code></pre>`
            : `<p class="fix-placeholder">Suggested fix snippet will appear here after AI analysis.</p>`;

        // Store fixType in a data attribute for the future Apply Fix handler.
        const fixTypeAttr = issue.fixType ? `data-fix-type="${_esc(issue.fixType)}"` : "";
        const uuidAttr = issue.uuid ? `data-uuid="${_esc(issue.uuid)}"` : "";

        return `
            <div class="issue-fix-section" id="${fixId}" ${fixTypeAttr} hidden>
                ${snippetHtml}
                <div class="issue-fix-actions">
                    <button type="button"
                        class="btn-explain"
                        data-issue-id="${issue.id}"
                        ${uuidAttr}
                        title="Explain this fix"
                    >
                        💬 Explain
                    </button>
                    <button type="button"
                        class="btn-quick-fix"
                        data-issue-id="${issue.id}"
                        ${uuidAttr}
                        title="Generate and preview Quick Fix"
                    >
                        ⚡ Quick Fix
                    </button>
                </div>
            </div>
        `.trim();
    }

    /**
     * Builds the HTML for a single issue card.
     *
     * @param {Object} issue
     * @returns {string} HTML string.
     */
    function _buildIssueCard(issue) {
        const style    = SEVERITY_STYLE[issue.severity] || SEVERITY_STYLE.low;
        const fixBtnId = `show-fix-${issue.id}`;
        const uuidAttr = issue.uuid ? `data-uuid="${_esc(issue.uuid)}"` : "";

        return `
            <div
                class="issue-card"
                data-issue-id="${issue.id}"
                ${uuidAttr}
                role="button"
                tabindex="0"
                aria-label="${_esc(style.label)} issue: ${_esc(issue.title)} at line ${issue.line || '?'}"
            >
                <div class="issue-card-header">
                    <div class="issue-card-meta">
                        <span class="issue-severity-badge ${style.badgeClass}">
                            ${style.icon} ${_esc(style.label)}
                        </span>
                        <span class="issue-line-badge" title="Line ${issue.line || '?'}">
                            Ln ${issue.line || '?'}
                        </span>
                    </div>
                    <h4 class="issue-title">${_esc(issue.title)}</h4>
                </div>

                <div class="issue-card-body">
                    <p class="issue-description">${_esc(issue.description)}</p>

                    ${issue.suggestion ? `
                        <div class="issue-suggestion">
                            <span class="issue-suggestion-label">💡 Suggestion</span>
                            <p>${_esc(issue.suggestion)}</p>
                        </div>
                    ` : ""}
                </div>

                <div class="issue-card-footer">
                    <button
                        type="button"
                        class="btn-show-fix"
                        id="${fixBtnId}"
                        data-target="fix-${issue.id}"
                        aria-expanded="false"
                        aria-controls="fix-${issue.id}"
                    >
                        <span class="show-fix-chevron">▼</span> Show Fix
                    </button>
                </div>

                ${_buildFixSection(issue)}
            </div>
        `.trim();
    }

    /**
     * Builds the HTML for a severity group section (heading + cards).
     *
     * @param {string} severity
     * @param {Object[]} issues - Issues belonging to this severity.
     * @returns {string} HTML string.
     */
    function _buildGroup(severity, issues) {
        const style = SEVERITY_STYLE[severity] || SEVERITY_STYLE.low;
        const cardsHtml = issues.map(_buildIssueCard).join("");

        return `
            <div class="findings-group" data-severity="${severity}">
                <h4 class="findings-group-heading">
                    <span class="findings-group-icon ${style.badgeClass.replace("badge-", "sev-icon-")}">
                        ${style.icon}
                    </span>
                    ${_esc(style.label)} Issues
                    <span class="findings-group-count">${issues.length}</span>
                </h4>
                <div class="findings-group-cards">
                    ${cardsHtml}
                </div>
            </div>
        `.trim();
    }

    // ── Private: Event Wiring ────────────────────────────────────────────────

    /**
     * Attaches click and keyboard event listeners to all issue cards.
     * Delegates to NavigationManager.jumpToIssue() using ReviewState lookup.
     */
    function _bindCardEvents() {
        if (!_container) return;

        // Issue card click/enter → jump to issue
        _container.querySelectorAll(".issue-card").forEach((card) => {
            const uuid = card.dataset.uuid;

            const handleActivate = () => {
                const issue = window.ReviewState ? window.ReviewState.getIssueByUuid(uuid) : null;
                if (issue && window.Editor && window.Editor.navigation) {
                    window.Editor.navigation.jumpToIssue(issue);
                }
            };

            card.addEventListener("click", (e) => {
                // Don't trigger jump when clicking the Show Fix button itself.
                if (e.target.closest(".btn-show-fix") || e.target.closest(".issue-fix-section")) return;
                handleActivate();
            });

            card.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleActivate();
                }
            });
        });

        // "▼ Show Fix" toggle buttons
        _container.querySelectorAll(".btn-show-fix").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation(); // Don't trigger card jump
                const targetId = btn.dataset.target;
                const fixSection = document.getElementById(targetId);
                if (!fixSection) return;

                const isExpanded = btn.getAttribute("aria-expanded") === "true";

                if (isExpanded) {
                    fixSection.hidden = true;
                    btn.setAttribute("aria-expanded", "false");
                    btn.querySelector(".show-fix-chevron").textContent = "▼";
                    btn.innerHTML = btn.innerHTML.replace("Hide Fix", "Show Fix");
                } else {
                    fixSection.hidden = false;
                    btn.setAttribute("aria-expanded", "true");
                    btn.querySelector(".show-fix-chevron").textContent = "▲";
                    btn.innerHTML = btn.innerHTML.replace("Show Fix", "Hide Fix");
                }
            });
        });

        // Quick Fix Action Buttons
        _container.querySelectorAll(".btn-explain").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const uuid = btn.dataset.uuid;
                if (window.ReviewActions && window.ReviewActions.explain) {
                    window.ReviewActions.explain(uuid);
                }
            });
        });

        _container.querySelectorAll(".btn-quick-fix").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const uuid = btn.dataset.uuid;
                if (window.ReviewActions && window.ReviewActions.quickFix) {
                    window.ReviewActions.quickFix(uuid);
                }
            });
        });
    }

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * Renders all issues grouped by severity into the given container.
     *
     * @param {HTMLElement} container - Target container element.
     * @param {Object[]} issues       - Full array of AI issue objects.
     */
    function render(container, issues) {
        if (!container) return;
        _container = container;
        _activeId  = null;

        if (!issues || issues.length === 0) {
            container.innerHTML = `
                <p class="findings-empty">No issues found in this review.</p>
            `;
            return;
        }

        // Group issues by severity, preserving SEVERITY_ORDER.
        const grouped = {};
        SEVERITY_ORDER.forEach((sev) => { grouped[sev] = []; });
        issues.forEach((issue) => {
            const sev = issue.severity;
            if (grouped[sev]) {
                grouped[sev].push(issue);
            } else {
                // Unknown severity fallback — add to "low".
                grouped.low.push(issue);
            }
        });

        // Build HTML for each severity group that has issues.
        const groupsHtml = SEVERITY_ORDER
            .filter((sev) => grouped[sev].length > 0)
            .map((sev) => _buildGroup(sev, grouped[sev]))
            .join("");

        container.innerHTML = `
            <div class="findings-container">
                ${groupsHtml}
            </div>
        `;

        _bindCardEvents();
    }

    /**
     * Highlights a specific issue card.
     * @param {string} uuid - Issue uuid.
     */
    function setActiveIssue(uuid) {
        if (!_container) return;

        // Avoid unnecessary DOM operations if already active.
        if (_activeId === uuid) return;
        _activeId = uuid;

        _container.querySelectorAll(".issue-card").forEach((card) => {
            if (card.dataset.uuid === uuid) {
                card.classList.add("issue-card-active");
                // Scroll the card into the review panel's visible area.
                card.scrollIntoView({ behavior: "smooth", block: "nearest" });
            } else {
                card.classList.remove("issue-card-active");
            }
        });

        // Also update severity card active state via the issue's severity.
        const issue = window.ReviewState ? window.ReviewState.getIssueByUuid(uuid) : null;
        if (issue && window.SeverityCards) {
            window.SeverityCards.setActive(issue.severity);
        }
    }

    /**
     * Clears the active state from all issue cards.
     */
    function clearActive() {
        if (!_container) return;
        _activeId = null;
        _container.querySelectorAll(".issue-card").forEach((card) => {
            card.classList.remove("issue-card-active");
        });
    }

    // ── Surgical DOM Mutations ────────────────────────────────────────────────

    /**
     * Removes a single issue card by UUID.
     * If the severity group becomes empty after removal, removes the group too.
     * Called by LiveSync after an issue is marked FIXED.
     *
     * @param {string} uuid - Issue UUID.
     */
    function removeCard(uuid) {
        console.log("[Findings] removeCard()");
        if (!_container || !uuid) return;

        const card = _container.querySelector(`[data-uuid="${uuid}"]`);
        if (!card) return;

        const group = card.closest(".findings-group");
        card.remove();

        if (group) {
            const remaining = group.querySelectorAll(".issue-card");
            if (remaining.length === 0) {
                group.remove();
            } else {
                // Update the group count badge
                const countEl = group.querySelector(".findings-group-count");
                if (countEl) countEl.textContent = remaining.length;
            }
        }

        // Show empty-state message if panel is fully resolved
        if (_container && _container.querySelectorAll(".issue-card").length === 0) {
            _container.innerHTML = `<p class="findings-empty">All issues resolved! ✓ Run Generate Review to verify.</p>`;
        }
    }

    /**
     * Updates the line badge and location-confidence badge on an existing card.
     * Called by LiveSync after issue relocation.
     * Does NOT re-render the card — only patches the mutable parts.
     *
     * @param {Object} issue - Updated issue object from ReviewState.
     */
    function updateCard(issue) {
        if (!_container || !issue || !issue.uuid) return;

        const card = _container.querySelector(`[data-uuid="${issue.uuid}"]`);
        if (!card) return;

        // Update line badge
        const lineBadge = card.querySelector(".issue-line-badge");
        if (lineBadge) {
            lineBadge.textContent = `Ln ${issue.line || "?"}`;
            lineBadge.title = `Line ${issue.line || "?"}`;
        }

        // Update aria-label
        const style = SEVERITY_STYLE[issue.severity] || SEVERITY_STYLE.low;
        card.setAttribute(
            "aria-label",
            `${style.label} issue: ${issue.title} at line ${issue.line || "?"}`
        );

        // Remove any existing location warning badge
        const existing = card.querySelector(".location-warning-badge");
        if (existing) existing.remove();

        // Add warning badge for uncertain locations
        if (issue.status === "UNKNOWN_LOCATION") {
            const badge = document.createElement("div");
            badge.className = "location-warning-badge";
            badge.innerHTML = "⚠ Location uncertain — <span>Generate a new Review to re-locate this issue.</span>";
            card.appendChild(badge);
        } else if (issue.status === "STALE") {
            const badge = document.createElement("div");
            badge.className = "location-warning-badge location-warning-stale";
            badge.innerHTML = "⚠ Overlaps with edited region — <span>Generate a new Review for accurate results.</span>";
            card.appendChild(badge);
        }
    }

    // ── Export ───────────────────────────────────────────────────────────────

    return {
        render,
        setActiveIssue,
        clearActive,
        removeCard,
        updateCard,
    };

})();

window.Findings = Findings;
