/**
 * Application Bootstrap Module.
 *
 * Initializes the frontend application when the DOM is ready.
 * Registers all component controllers and connects API services.
 *
 * Per Architecture (docs/02-Architecture.md, Section 26):
 * - app.js bootstraps the application.
 * - Initializes all components.
 *
 * Per Rules (docs/03-Rules.md, JS-001):
 * - No business logic inside HTML.
 * - Event listeners attached programmatically.
 */

"use strict";

const APP_CONFIG = {
    apiBaseUrl: "http://localhost:8000/api/v1",
    appName: "AI Code Review & Rewrite Agent",
    version: "1.0.0",
};

/**
 * Global Application State
 */
window.appState = {
    editor: {
        code: "",
        language: "python",
        reviewFocus: "general",
    },
    review: {
        data: null,
        isLoading: false,
    },
    rewrite: {
        data: null,
        isLoading: false,
    },
};

/**
 * Initializes all controllers when DOM is ready.
 */
async function initializeApp() {
    console.info(`[${APP_CONFIG.appName}] v${APP_CONFIG.version} — Initializing...`);

    // 1. Initialize Console Controller (Phase 11)
    const consoleController = new window.ConsoleController();
    consoleController.init();
    window.consoleController = consoleController;

    // 2. Initialize Editor Controller
    const editorController = new window.EditorController(consoleController);
    editorController.init();

    // 3. Initialize Review Controller
    const reviewController = new window.ReviewController(editorController);
    reviewController.init();

    // 4. Initialize Rewrite Controller
    const rewriteController = new window.RewriteController(editorController);
    rewriteController.init();

    // 5. Verify Backend Health asynchronously
    checkBackendHealth();

    console.info(`[${APP_CONFIG.appName}] Application initialized successfully.`);
}

/**
 * Verifies API server connectivity.
 */
async function checkBackendHealth() {
    const healthBadge = document.getElementById("api-status-badge");
    try {
        const response = await window.apiClient.checkHealth();
        if (response.success) {
            console.info("[Health Check] Backend is operational:", response.data);
            if (healthBadge) {
                healthBadge.className = "text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
                healthBadge.textContent = "● API Online";
            }
        }
    } catch (error) {
        console.warn("[Health Check] Backend offline or unreachable.");
        if (healthBadge) {
            healthBadge.className = "text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20";
            healthBadge.textContent = "○ API Offline";
        }
    }
}

// Attach listener on DOMContentLoaded
document.addEventListener("DOMContentLoaded", initializeApp);
