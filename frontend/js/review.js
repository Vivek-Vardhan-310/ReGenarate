/**
 * Review Controller Module.
 *
 * Controls the review workflow: input collection, validation, API request,
 * loading state toggle, and rendering review output.
 *
 * Per Architecture (docs/02-Architecture.md, Section 26):
 * - Manages review user interactions.
 */

"use strict";

class ReviewController {
    constructor(editorController) {
        this.editor = editorController;
        this.reviewBtn = document.getElementById("review-btn");
    }

    init() {
        if (this.reviewBtn) {
            this.reviewBtn.addEventListener("click", () => this.handleReview());
        }
    }

    async handleReview() {
        const inputData = this.editor.getEditorData();

        // 1. Client-Side Validation
        const validation = window.InputValidator.validateReviewInput(inputData);
        if (!validation.isValid) {
            if (window.notifications) {
                window.notifications.error(validation.message);
            }
            return;
        }

        // 2. Set Loading State
        window.Renderer.setLoading(true, "Analyzing source code with AI...");

        try {
            // 3. API Submission
            const response = await window.apiClient.submitReview({
                language: inputData.language,
                review_focus: inputData.reviewFocus,
                code: inputData.code,
            });

            // 4. Render Result
            if (response.success && response.data) {
                window.Renderer.renderReviewResult(response.data.review);
                if (window.notifications) {
                    window.notifications.success("Code review generated successfully!");
                }
            } else {
                throw new Error(response.message || "Failed to generate review.");
            }
        } catch (error) {
            console.error("[Review Error]", error);
            if (window.notifications) {
                window.notifications.error(error.message || "Failed to complete review request.");
            }
        } finally {
            // 5. Clear Loading State
            window.Renderer.setLoading(false);
        }
    }
}

window.ReviewController = ReviewController;
