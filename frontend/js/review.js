/**
 * Review Controller Module.
 *
 * Controls the review workflow: input collection, validation, API request,
 * loading state toggle, and rendering review output.
 *
 * Changes from original:
 *   - After successful API response, branches on response format:
 *       Structured (has .issues) → ReviewState + diagnostics + structured renderer
 *       Legacy (has .review)     → original markdown renderer (unchanged path)
 *   - Clears previous diagnostics and ReviewState before each new request.
 *   - Sets up cursor sync after structured review is applied.
 *
 * Unchanged:
 *   - Constructor, init(), handleReview() signature.
 *   - Validation logic.
 *   - Loading state management.
 *   - Error handling.
 *   - API call payload.
 *
 * Per Architecture (docs/02-Architecture.md, Section 26):
 *   - Manages review user interactions.
 */

"use strict";

class ReviewController {
    constructor(editorController) {
        this.editor    = editorController;
        this.reviewBtn = document.getElementById("review-btn");
    }

    init() {
        if (this.reviewBtn) {
            this.reviewBtn.addEventListener("click", () => this.handleReview());
        }
    }

    async handleReview() {
        const inputData = this.editor.getEditorData();

        // 1. Client-Side Validation (unchanged)
        const validation = window.InputValidator.validateReviewInput(inputData);
        if (!validation.isValid) {
            if (window.notifications) {
                window.notifications.error(validation.message);
            }
            return;
        }

        // 2. Clear previous review state before new request.
        if (window.ReviewState) {
            window.ReviewState.clear();
        }
        if (window.Editor && window.Editor.diagnostics) {
            window.Editor.diagnostics.clearDiagnostics();
        }
        if (window.Editor && window.Editor.navigation) {
            window.Editor.navigation.teardownCursorSync();
        }

        // 3. Set Loading State (unchanged)
        window.Renderer.setLoading(true, "Analyzing source code with AI...");

        try {
            // 4. API Submission (payload unchanged)
            const response = await window.apiClient.submitReview({
                language:     inputData.language,
                review_focus: inputData.reviewFocus,
                code:         inputData.code,
            });

            // 5. Render Result — dual-mode branching
            if (response.success && response.data) {
                const data = response.data;

                if (data.issues !== undefined) {
                    // ── STRUCTURED PATH (new IDE experience) ──────────────────
                    // Store in ReviewState (single source of truth).
                    window.ReviewState.set(data);

                    // Apply Monaco diagnostics (markers + decorations + glyphs).
                    if (window.Editor && window.Editor.diagnostics) {
                        window.Editor.diagnostics.setDiagnostics(
                            window.ReviewState.getDiagnosticIssues()
                        );
                    }

                    // Render structured review panel.
                    window.Renderer.renderStructuredReview(data);

                    // Enable bidirectional cursor sync.
                    if (window.Editor && window.Editor.navigation) {
                        window.Editor.navigation.setupCursorSync();
                    }

                    if (window.notifications) {
                        const counts = window.ReviewState.getSeverityCounts();
                        const total  = counts.critical + counts.high + counts.medium + counts.low;
                        window.notifications.success(
                            `Review complete — ${total} issue${total !== 1 ? "s" : ""} found.`
                        );
                    }

                } else {
                    // ── LEGACY MARKDOWN PATH (unchanged) ──────────────────────
                    window.Renderer.renderReviewResult(data.review);
                    if (window.notifications) {
                        window.notifications.success("Code review generated successfully!");
                    }
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
            // 6. Clear Loading State (unchanged)
            window.Renderer.setLoading(false);
        }
    }
}

window.ReviewController = ReviewController;
