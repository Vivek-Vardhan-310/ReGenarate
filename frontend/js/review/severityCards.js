/**
 * SeverityCards — Severity Dashboard Renderer.
 *
 * Renders four statistic cards (Critical / High / Medium / Low) derived
 * dynamically from SEVERITY_CONFIG. No severity is hardcoded in HTML.
 *
 * Responsibilities:
 *   - Render severity stat cards into a given container.
 *   - Highlight the active card when the editor cursor is on a matching line.
 *   - Wire card click → NavigationManager.jumpToFirstIssueOfSeverity().
 *
 * Does NOT:
 *   - Store issue data (→ ReviewState).
 *   - Navigate (→ NavigationManager).
 *   - Render issue detail cards (→ Findings).
 *
 * Exposed as: window.SeverityCards
 */

"use strict";

const SeverityCards = (() => {

    // ── Severity Configuration ────────────────────────────────────────────────

    /**
     * Single source of truth for severity visual identity.
     * All card rendering derives from this object.
     */
    const SEVERITY_CONFIG = [
        {
            key:         "critical",
            label:       "Critical",
            icon:        "●",          // CSS glyph — same as glyph margin icon
            iconClass:   "sev-icon-critical",
            borderColor: "#ef4444",
            textColor:   "#fca5a5",
            bgColor:     "rgba(239,68,68,0.08)",
        },
        {
            key:         "high",
            label:       "High",
            icon:        "▲",
            iconClass:   "sev-icon-high",
            borderColor: "#f97316",
            textColor:   "#fdba74",
            bgColor:     "rgba(249,115,22,0.08)",
        },
        {
            key:         "medium",
            label:       "Medium",
            icon:        "◆",
            iconClass:   "sev-icon-medium",
            borderColor: "#eab308",
            textColor:   "#fde047",
            bgColor:     "rgba(234,179,8,0.08)",
        },
        {
            key:         "low",
            label:       "Low",
            icon:        "ℹ",
            iconClass:   "sev-icon-low",
            borderColor: "#22c55e",
            textColor:   "#86efac",
            bgColor:     "rgba(34,197,94,0.08)",
        },
    ];

    // ── Internal State ────────────────────────────────────────────────────────

    /** Currently active severity key (set via setActive). */
    let _activeSeverity = null;

    /** Container element reference (set during render). */
    let _container = null;

    // ── Private Helpers ───────────────────────────────────────────────────────

    /**
     * Builds the HTML for a single severity stat card.
     *
     * @param {Object} config - Severity config entry.
     * @param {number} count  - Issue count for this severity.
     * @returns {string} HTML string.
     */
    function _buildCard(config, count) {
        return `
            <button
                type="button"
                class="severity-card"
                data-severity="${config.key}"
                style="border-left-color: ${config.borderColor}; --card-bg: ${config.bgColor};"
                aria-label="Jump to first ${config.label} issue (${count} total)"
                title="Click to jump to first ${config.label} issue"
            >
                <span class="severity-card-icon ${config.iconClass}">${config.icon}</span>
                <span class="severity-card-count" style="color: ${config.textColor};">${count}</span>
                <span class="severity-card-label">${config.label}</span>
            </button>
        `.trim();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Renders the four severity stat cards into the given container element.
     *
     * @param {HTMLElement} container - Target container element.
     * @param {Object} severityCounts - { critical, high, medium, low }
     */
    function render(container, severityCounts) {
        if (!container) return;
        _container = container;
        _activeSeverity = null;

        const counts = severityCounts || { critical: 0, high: 0, medium: 0, low: 0 };

        const cardsHtml = SEVERITY_CONFIG
            .map((config) => _buildCard(config, counts[config.key] || 0))
            .join("");

        container.innerHTML = `
            <div class="severity-dashboard" role="group" aria-label="Issue severity summary">
                ${cardsHtml}
            </div>
        `;

        // Attach click handlers.
        container.querySelectorAll(".severity-card").forEach((card) => {
            card.addEventListener("click", () => {
                const severity = card.dataset.severity;
                setActive(severity);

                if (!window.ReviewState) return;

                const activeIssues = window.ReviewState.getActiveIssues();
                const firstIssue = activeIssues.find(issue => issue.severity === severity);

                if (firstIssue && firstIssue.uuid) {
                    const issueCard = document.querySelector(`.issue-card[data-uuid="${firstIssue.uuid}"]`);
                    if (issueCard) {
                        issueCard.scrollIntoView({ behavior: "smooth", block: "center" });
                        issueCard.classList.add("issue-card-highlight");
                        setTimeout(() => {
                            issueCard.classList.remove("issue-card-highlight");
                        }, 1000);
                    }
                }
            });
        });
    }

    /**
     * Marks the card for the given severity as active.
     * Removes active state from all other cards.
     *
     * @param {string} severity - "critical" | "high" | "medium" | "low"
     */
    function setActive(severity) {
        if (!_container || _activeSeverity === severity) return;
        _activeSeverity = severity;

        _container.querySelectorAll(".severity-card").forEach((card) => {
            if (card.dataset.severity === severity) {
                card.classList.add("severity-card-active");
            } else {
                card.classList.remove("severity-card-active");
            }
        });
    }

    /**
     * Clears all active states from severity cards.
     */
    function clearActive() {
        if (!_container) return;
        _activeSeverity = null;
        _container.querySelectorAll(".severity-card").forEach((card) => {
            card.classList.remove("severity-card-active");
        });
    }

    /**
     * Updates just the numeric count on a single severity card without
     * re-rendering the whole dashboard.
     * Called by LiveSync after a Quick Fix resolves one issue.
     *
     * @param {string} severity - "critical" | "high" | "medium" | "low"
     * @param {number} newCount - New total to display.
     */
    function updateCount(severity, newCount) {
        console.log("[SeverityCards] updateCount()");
        if (!_container) return;
        const card = _container.querySelector(`[data-severity="${severity}"]`);
        if (!card) return;

        const countEl = card.querySelector(".severity-card-count");
        if (countEl) countEl.textContent = newCount;

        // Update aria-label to keep it accurate
        const config = SEVERITY_CONFIG.find((c) => c.key === severity);
        if (config) {
            card.setAttribute(
                "aria-label",
                `Jump to first ${config.label} issue (${newCount} total)`
            );
        }
    }

    /**
     * Exposes the severity config for use by other modules (e.g., Findings).
     * @returns {Object[]}
     */
    function getConfig() {
        return SEVERITY_CONFIG;
    }

    // ── Export ────────────────────────────────────────────────────────────────

    return {
        render,
        setActive,
        clearActive,
        updateCount,
        getConfig,
    };

})();

window.SeverityCards = SeverityCards;
