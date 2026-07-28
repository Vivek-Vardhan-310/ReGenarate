/**
 * DOM Renderer Module.
 *
 * Converts structured response data into HTML cards, Markdown output,
 * code comparison containers, syntax highlighting via Highlight.js,
 * and loading UI.
 *
 * Per Architecture (docs/02-Architecture.md, Section 26):
 * - Converts backend JSON payloads into HTML elements.
 * - Integrates Marked.js and Highlight.js per FR-008 & FR-009.
 */

"use strict";

class Renderer {
    /**
     * Initializes Marked.js configuration with Highlight.js integration.
     */
    static initMarked() {
        if (typeof window.marked !== "undefined" && window.marked.setOptions) {
            window.marked.setOptions({
                gfm: true,
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
            // Enhance headers with icons and alert styling for Phase 13 debugging
            htmlContent = htmlContent
                .replace(/<h1>Detected Runtime Issues<\/h1>/gi, '<h1 class="text-rose-400 font-bold border-l-4 border-rose-500 pl-3 py-1 bg-rose-500/10 rounded-r-md">🚨 Detected Runtime Issues</h1>')
                .replace(/<h1>Probable Cause<\/h1>/gi, '<h1 class="text-amber-400 font-bold border-l-4 border-amber-500 pl-3 py-1 bg-amber-500/10 rounded-r-md">🔍 Probable Cause</h1>')
                .replace(/<h1>Suggested Fix<\/h1>/gi, '<h1 class="text-emerald-400 font-bold border-l-4 border-emerald-500 pl-3 py-1 bg-emerald-500/10 rounded-r-md">💡 Suggested Fix</h1>')
                .replace(/<h1>Improved Code<\/h1>/gi, '<h1 class="text-primary-300 font-bold border-l-4 border-primary-500 pl-3 py-1 bg-primary-500/10 rounded-r-md">✨ Improved Code</h1>');
        } else {
            const div = document.createElement("div");
            div.textContent = markdownText;
            htmlContent = `<pre class="whitespace-pre-wrap font-mono text-sm">${div.innerHTML}</pre>`;
        }

        return htmlContent;
    }

    /**
     * Downloads text content as a file.
     * @param {string} filename
     * @param {string} content
     * @param {string} mimeType
     */
    static downloadFile(filename, content, mimeType = "text/plain") {
        if (!content) return;
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Updates the Review Panel with review findings.
     * @param {string} reviewMarkdown - Markdown content from backend.
     */
    static renderReviewResult(reviewMarkdown) {
        const reviewContainer = document.getElementById("review-content");
        const reviewSection = document.getElementById("review-section");
        const copyReviewBtn = document.getElementById("copy-review-btn");
        const downloadReviewBtn = document.getElementById("download-review-btn");

        if (reviewContainer) {
            reviewContainer.innerHTML = `
                <div class="prose prose-invert max-w-none text-surface-200 text-sm leading-relaxed space-y-4">
                    ${Renderer.renderMarkdown(reviewMarkdown)}
                </div>
            `;

            // Trigger Highlight.js syntax highlighting on all code blocks in the review
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

        if (downloadReviewBtn) {
            downloadReviewBtn.onclick = () => {
                Renderer.downloadFile("code_review_findings.md", reviewMarkdown, "text/markdown");
                if (window.notifications) {
                    window.notifications.success("Downloaded 'code_review_findings.md'");
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
     * @param {string} rewrittenCode - Optimized code string from backend.
     * @param {string} language - Code language.
     */
    static renderRewriteResult(rewrittenCode, language = "code") {
        const rewriteContainer = document.getElementById("rewrite-content");
        const rewriteSection = document.getElementById("rewrite-section");
        const downloadRewriteBtn = document.getElementById("download-rewrite-btn");

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

            // Trigger Highlight.js syntax highlighting
            const codeBlock = rewriteContainer.querySelector("code");
            if (codeBlock && typeof window.hljs !== "undefined") {
                window.hljs.highlightElement(codeBlock);
            }

            // Attach copy listener
            const copyBtn = document.getElementById("copy-rewrite-btn");
            if (copyBtn) {
                copyBtn.addEventListener("click", () => {
                    if (window.ClipboardManager) {
                        window.ClipboardManager.copy(rewrittenCode, "Rewritten Code");
                    }
                });
            }
        }

        if (downloadRewriteBtn) {
            const extMap = {
                python: "py", java: "java", javascript: "js", typescript: "ts",
                c: "c", cpp: "cpp", csharp: "cs", go: "go", rust: "rs", php: "php",
                ruby: "rb", kotlin: "kt", swift: "swift", scala: "scala", sql: "sql",
                html: "html", css: "css", xml: "xml", json: "json", yaml: "yaml",
            };
            const ext = extMap[String(language).toLowerCase()] || "txt";
            const filename = `rewritten_code.${ext}`;

            downloadRewriteBtn.onclick = () => {
                Renderer.downloadFile(filename, rewrittenCode, "text/plain");
                if (window.notifications) {
                    window.notifications.success(`Downloaded '${filename}'`);
                }
            };
        }

        if (rewriteSection) {
            rewriteSection.classList.remove("hidden");
            rewriteSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }

    /**
     * Controls global loading overlay / button loading state.
     * @param {boolean} isLoading - Loading status.
     * @param {string} message - Status text.
     */
    static setLoading(isLoading, message = "Processing AI Request...") {
        const overlay = document.getElementById("loading-overlay");
        const loadingText = document.getElementById("loading-text");
        const reviewBtn = document.getElementById("review-btn");
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

        if (loadingText && message) {
            loadingText.textContent = message;
        }

        if (reviewBtn) reviewBtn.disabled = isLoading;
        if (rewriteBtn) rewriteBtn.disabled = isLoading;
    }
}

// Initialize Marked configuration on load
Renderer.initMarked();

window.Renderer = Renderer;
