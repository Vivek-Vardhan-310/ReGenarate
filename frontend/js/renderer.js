/**
 * DOM Renderer Module.
 *
 * Converts structured response data into HTML cards, Markdown output,
 * code comparison containers, syntax highlighting via Highlight.js,
 * and loading UI.
 *
 * Changes from original:
 *   - renderReviewResult(markdown) UNCHANGED — legacy markdown path works as before.
 *   - renderStructuredReview(data) ADDED — renders structured AI response with
 *     severity dashboard, grouped findings, strengths, recommendations.
 *     Delegates to SeverityCards and Findings modules.
 *
 * Per Architecture (docs/02-Architecture.md, Section 26):
 *   - Converts backend JSON payloads into HTML elements.
 *   - Integrates Marked.js and Highlight.js per FR-008 & FR-009.
 */

"use strict";

class Renderer {
    /**
     * Initializes Marked.js configuration with Highlight.js integration.
     */
    static initMarked() {
        if (typeof window.marked !== "undefined" && window.marked.setOptions) {
            window.marked.setOptions({
                gfm:    true,
                breaks: true,
            });
        }
    }

    /**
     * Renders Markdown text into safe HTML and triggers Highlight.js.
     *
     * @param {string} markdownText - Raw markdown string.
     * @returns {string} Safe HTML string.
     */
    static renderMarkdown(markdownText) {
        if (!markdownText) return "";
        let htmlContent = "";

        if (typeof window.marked !== "undefined" && window.marked.parse) {
            htmlContent = window.marked.parse(markdownText);
        } else {
            const div = document.createElement("div");
            div.textContent = markdownText;
            htmlContent = `<pre class="whitespace-pre-wrap font-mono text-sm">${div.innerHTML}</pre>`;
        }

        return htmlContent;
    }

    /**
     * LEGACY PATH — UNCHANGED.
     * Updates the Review Panel with a markdown review string.
     * Called when backend returns { review: "markdown string" } format.
     *
     * @param {string} reviewMarkdown - Markdown content from backend.
     */
    static renderReviewResult(reviewMarkdown) {
        const reviewContainer = document.getElementById("review-content");
        const reviewSection   = document.getElementById("review-section");
        const copyReviewBtn   = document.getElementById("copy-review-btn");

        if (reviewContainer) {
            reviewContainer.innerHTML = `
                <div class="prose prose-invert max-w-none text-surface-200 text-sm leading-relaxed space-y-4">
                    ${Renderer.renderMarkdown(reviewMarkdown)}
                </div>
            `;

            if (typeof window.hljs !== "undefined") {
                reviewContainer.querySelectorAll("pre code").forEach((block) => {
                    window.hljs.highlightElement(block);
                });
            }
        }

        if (copyReviewBtn) {
            copyReviewBtn.onclick = () => {
                if (window.ClipboardManager) {
                    window.ClipboardManager.copy(reviewMarkdown, "Code Review");
                }
            };
        }

        if (reviewSection) {
            reviewSection.classList.remove("hidden");
            reviewSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }

    /**
     * NEW — Structured Review Renderer.
     * Renders a fully structured AI review response using the new IDE-style layout:
     *   Summary → Severity Dashboard → Strengths → Grouped Findings → Recommendations
     *
     * Delegates card rendering to SeverityCards and Findings modules.
     * Falls back to renderReviewResult() if required modules are unavailable.
     *
     * @param {Object} data - Full structured review data from ReviewState.get().
     */
    static renderStructuredReview(data) {
        const reviewContainer = document.getElementById("review-content");
        const reviewSection   = document.getElementById("review-section");
        const copyReviewBtn   = document.getElementById("copy-review-btn");

        if (!reviewContainer) return;

        // ── Build HTML sections ──────────────────────────────────────────────

        const summaryHtml = data.summary ? `
            <div class="review-summary-block">
                <h4 class="review-section-title">📝 Summary</h4>
                <p class="review-summary-text">${Renderer._esc(data.summary)}</p>
            </div>
        ` : "";

        const strengthsHtml = (data.strengths && data.strengths.length > 0) ? `
            <div class="review-strengths-block">
                <h4 class="review-section-title">✅ Strengths</h4>
                <ul class="review-list">
                    ${data.strengths.map((s) => `<li>${Renderer._esc(s)}</li>`).join("")}
                </ul>
            </div>
        ` : "";

        const recommendationsHtml = (data.recommendations && data.recommendations.length > 0) ? `
            <div class="review-recommendations-block">
                <h4 class="review-section-title">🔧 Recommendations</h4>
                <ul class="review-list">
                    ${data.recommendations.map((r) => `<li>${Renderer._esc(r)}</li>`).join("")}
                </ul>
            </div>
        ` : "";

        // ── Assemble main layout ─────────────────────────────────────────────

        reviewContainer.innerHTML = `
            <div class="structured-review">
                ${summaryHtml}

                <div id="severity-dashboard-container" class="review-severity-dashboard">
                    <!-- SeverityCards.render() populates this -->
                </div>

                ${strengthsHtml}

                <div class="review-findings-section">
                    <h4 class="review-section-title">🔍 Findings</h4>
                    <div id="findings-container">
                        <!-- Findings.render() populates this -->
                    </div>
                </div>

                ${recommendationsHtml}
            </div>
        `;

        // ── Delegate to sub-modules ──────────────────────────────────────────

        if (window.SeverityCards) {
            const dashboardContainer = document.getElementById("severity-dashboard-container");
            const counts = window.ReviewState ? window.ReviewState.getSeverityCounts() : data.severity;
            window.SeverityCards.render(dashboardContainer, counts);
        }

        if (window.Findings) {
            const findingsContainer = document.getElementById("findings-container");
            const issues = window.ReviewState ? window.ReviewState.getIssues() : (data.issues || []);
            window.Findings.render(findingsContainer, issues);
        }

        // ── Copy button wires to markdown fallback or full data ──────────────
        if (copyReviewBtn) {
            const copyText = data.markdown || data.review || JSON.stringify(data, null, 2);
            copyReviewBtn.onclick = () => {
                if (window.ClipboardManager) {
                    window.ClipboardManager.copy(copyText, "Code Review");
                }
            };
        }

        if (reviewSection) {
            reviewSection.classList.remove("hidden");
            reviewSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }

    /**
     * Updates the Rewrite Panel with rewritten source code.
     * UNCHANGED from original.
     *
     * @param {string} rewrittenCode - Optimized code string from backend.
     * @param {string} language - Code language.
     */
    static renderRewriteResult(rewrittenCode, language = "code") {
        const rewriteContainer = document.getElementById("rewrite-content");
        const rewriteSection   = document.getElementById("rewrite-section");

        if (rewriteContainer) {
            const escapedDiv = document.createElement("div");
            escapedDiv.textContent = rewrittenCode;

            rewriteContainer.innerHTML = `
                <div class="relative group">
                    <button type="button" id="copy-rewrite-btn"
                        class="absolute top-3 right-3 z-10 px-3 py-1.5 bg-surface-800/90 hover:bg-surface-700 text-xs text-white rounded-md border border-surface-700 flex items-center space-x-1 backdrop-blur-sm transition-colors shadow-md">
                        <span>📋 Copy Code</span>
                    </button>
                    <pre class="bg-surface-950 p-4 rounded-lg overflow-x-auto text-sm font-mono border border-surface-800 text-primary-200"><code class="language-${language}">${escapedDiv.innerHTML}</code></pre>
                </div>
            `;

            const codeBlock = rewriteContainer.querySelector("code");
            if (codeBlock && typeof window.hljs !== "undefined") {
                window.hljs.highlightElement(codeBlock);
            }

            const copyBtn = document.getElementById("copy-rewrite-btn");
            if (copyBtn) {
                copyBtn.addEventListener("click", () => {
                    if (window.ClipboardManager) {
                        window.ClipboardManager.copy(rewrittenCode, "Rewritten Code");
                    }
                });
            }
        }

        if (rewriteSection) {
            rewriteSection.classList.remove("hidden");
            rewriteSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }

    /**
     * Controls global loading overlay / button loading state.
     * UNCHANGED from original.
     *
     * @param {boolean} isLoading - Loading status.
     * @param {string} message - Status text.
     */
    static setLoading(isLoading, message = "Processing AI Request...") {
        const overlay    = document.getElementById("loading-overlay");
        const loadingText= document.getElementById("loading-text");
        const reviewBtn  = document.getElementById("review-btn");
        const rewriteBtn = document.getElementById("rewrite-btn");

        if (overlay) {
            if (isLoading) {
                overlay.classList.remove("hidden");
                overlay.classList.add("flex");
            } else {
                overlay.classList.add("hidden");
                overlay.classList.remove("flex");
            }
        }

        if (loadingText && message) loadingText.textContent = message;
        if (reviewBtn)  reviewBtn.disabled  = isLoading;
        if (rewriteBtn) rewriteBtn.disabled = isLoading;
    }

    /**
     * XSS-safe text escaping for structured content rendering.
     * @param {string} text
     * @returns {string}
     */
    static _esc(text) {
        if (!text) return "";
        const div = document.createElement("div");
        div.textContent = String(text);
        return div.innerHTML;
    }
}

// Initialize Marked configuration on load
Renderer.initMarked();

window.Renderer = Renderer;
