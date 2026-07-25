/**
 * Clipboard Module.
 *
 * Provides one-click copy functionality for source code and reviews.
 * Per Functional Requirements (docs/01-PRD.md, FR-010):
 * - Copy reviewed code, rewritten code, and AI explanations with one click.
 * - Instant copy with toast notification confirmation.
 */

"use strict";

class ClipboardManager {
    /**
     * Copies text to the system clipboard using Navigator API.
     * Fallback to execCommand for legacy browser support.
     *
     * @param {string} text - Content to copy.
     * @param {string} label - Name of item being copied (for toast message).
     * @returns {Promise<boolean>} True if successful.
     */
    static async copy(text, label = "Content") {
        if (!text) {
            if (window.notifications) {
                window.notifications.warning("Nothing to copy.");
            }
            return false;
        }

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback for non-HTTPS local environments
                const textarea = document.createElement("textarea");
                textarea.value = text;
                textarea.style.position = "fixed";
                textarea.style.left = "-999999px";
                textarea.style.top = "-999999px";
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                document.execCommand("copy");
                textarea.remove();
            }

            if (window.notifications) {
                window.notifications.success(`${label} copied to clipboard!`);
            }
            return true;
        } catch (error) {
            console.error("Clipboard copy failed:", error);
            if (window.notifications) {
                window.notifications.error(`Failed to copy ${label.toLowerCase()}.`);
            }
            return false;
        }
    }
}

window.ClipboardManager = ClipboardManager;
