/**
 * Centralized API Client Module.
 *
 * Per Architecture (docs/02-Architecture.md, Section 26):
 * - Responsible ONLY for backend HTTP communication.
 * - Centralizes GET, POST, Timeout, Retry, and Error Handling.
 * - Performs NO DOM manipulation.
 *
 * Per Rules (docs/03-Rules.md, JS-004):
 * - Never duplicate API requests across modules.
 * - api.js is the single networking layer for the application.
 */

"use strict";

class ApiClient {
    /**
     * Constructs the ApiClient instance.
     * @param {string} baseUrl - Base URL for the API endpoints.
     * @param {number} defaultTimeoutMs - Default request timeout in milliseconds.
     */
    constructor(baseUrl = null, defaultTimeoutMs = 35000) {
        if (!baseUrl) {
            const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
            const defaultHost = isLocal ? "http://localhost:8000" : "https://regenarate.onrender.com";
            const envUrl = (typeof window !== "undefined" && window.VITE_API_URL) || (typeof window !== "undefined" && window.ENV && window.ENV.VITE_API_URL);
            baseUrl = envUrl ? (envUrl.endsWith("/api/v1") ? envUrl : `${envUrl}/api/v1`) : `${defaultHost}/api/v1`;
        }
        this.baseUrl = baseUrl;
        this.defaultTimeoutMs = defaultTimeoutMs;
    }

    /**
     * Executes an HTTP request with timeout protection and structured error handling.
     *
     * @param {string} endpoint - Relative endpoint path (e.g. '/health').
     * @param {Object} options - Fetch options (method, headers, body).
     * @returns {Promise<Object>} Response JSON payload.
     * @throws {Error} Structured error object on network failure or API error.
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || this.defaultTimeoutMs);

        const config = {
            method: options.method || "GET",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                ...(options.headers || {}),
            },
            signal: controller.signal,
        };

        if (options.body) {
            config.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url, config);
            clearTimeout(timeoutId);

            const contentType = response.headers.get("content-type");
            let data = {};

            if (contentType && contentType.includes("application/json")) {
                data = await response.json();
            } else {
                data = { success: false, message: await response.text() };
            }

            if (!response.ok) {
                const errorMessage = data.error?.message || data.message || `HTTP ${response.status}: ${response.statusText}`;
                const errorCode = data.error?.code || `HTTP_${response.status}`;

                const error = new Error(errorMessage);
                error.code = errorCode;
                error.status = response.status;
                error.data = data;
                throw error;
            }

            return data;
        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === "AbortError") {
                const timeoutError = new Error("The request timed out. The server took too long to respond.");
                timeoutError.code = "TIMEOUT_ERROR";
                timeoutError.status = 408;
                throw timeoutError;
            }

            if (!error.code) {
                error.code = "NETWORK_ERROR";
                error.message = error.message || "Failed to connect to the backend server. Is the API running?";
            }

            throw error;
        }
    }

    /**
     * Performs GET /health check request.
     * @returns {Promise<Object>} Health response payload.
     */
    async checkHealth() {
        return this.request("/health", { method: "GET" });
    }

    /**
     * Performs POST /review request.
     * @param {Object} payload - { language, review_focus, code }
     * @returns {Promise<Object>} Review response payload.
     */
    async submitReview(payload) {
        return this.request("/review", {
            method: "POST",
            body: payload,
        });
    }

    /**
     * Performs POST /rewrite request.
     * @param {Object} payload - { language, code }
     * @returns {Promise<Object>} Rewrite response payload.
     */
    async submitRewrite(payload) {
        return this.request("/rewrite", {
            method: "POST",
            body: payload,
        });
    }

    /**
     * Performs POST /quick-fix request.
     * @param {Object} payload - { language, code, issue }
     * @returns {Promise<Object>} Quick fix response payload.
     */
    async submitQuickFix(payload) {
        return this.request("/quick-fix", {
            method: "POST",
            body: payload,
        });
    }
}

// Global API Client Singleton
window.apiClient = new ApiClient();
