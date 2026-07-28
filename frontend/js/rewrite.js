/**
 * Rewrite Controller Module.
 *
 * Controls the rewrite workflow: input collection, validation, API request,
 * loading state toggle, and rendering rewritten code output.
 *
 * Per Architecture (docs/02-Architecture.md, Section 26):
 * - Manages rewrite user interactions.
 */

"use strict";

class RewriteController {
    constructor(editorController) {
        this.editor = editorController;
        this.rewriteBtn = document.getElementById("rewrite-btn");
    }

    init() {
        if (this.rewriteBtn) {
            this.rewriteBtn.addEventListener("click", () => this.handleRewrite());
        }
    }

    async handleRewrite() {
        const inputData = this.editor.getEditorData();

        // 1. Client-Side Validation
        const validation = window.InputValidator.validateRewriteInput(inputData);
        if (!validation.isValid) {
            if (window.notifications) {
                window.notifications.error(validation.message);
            }
            return;
        }

        // 2. Set Loading State
        window.Renderer?.setLoading(true, "Generating optimized rewrite with AI...");

        try {
            // 3. API Submission
            const response = await window.apiClient.submitRewrite({
                language: inputData.language,
                code: inputData.code,
            });

            // 4. Render Result
            if (response.success && response.data) {
                window.Renderer?.renderRewriteResult(response.data.rewritten_code, inputData.language);
                if (window.notifications) {
                    window.notifications.success("Code rewrite generated successfully!");
                }
            } else {
                throw new Error(response.message || "Failed to generate rewrite.");
            }
        } catch (error) {
            console.error("[Rewrite Error]", error);
            if (window.notifications) {
                window.notifications.error(error.message || "Failed to complete rewrite request.");
            }
        } finally {
            // 5. Clear Loading State
            window.Renderer?.setLoading(false);
        }
    }
}

window.RewriteController = RewriteController;
