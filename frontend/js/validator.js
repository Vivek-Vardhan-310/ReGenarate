/**
 * Client-Side Input Validator Module.
 *
 * Performs pre-flight input validation before sending API requests.
 * Aligns with backend validation rules (docs/07-API.md, Section 15).
 *
 * Per Rules (docs/03-Rules.md, JS-006):
 * - Business validation belongs in dedicated modules, not UI event handlers.
 */

"use strict";

const SUPPORTED_LANGUAGES_LIST = [
    { id: "python", name: "Python" },
    { id: "java", name: "Java" },
    { id: "javascript", name: "JavaScript" },
    { id: "typescript", name: "TypeScript" },
    { id: "c", name: "C" },
    { id: "cpp", name: "C++" },
    { id: "csharp", name: "C#" },
    { id: "go", name: "Go" },
    { id: "php", name: "PHP" },
    { id: "rust", name: "Rust" },
    { id: "kotlin", name: "Kotlin" },
    { id: "swift", name: "Swift" },
    { id: "sql", name: "SQL" },
    { id: "html", name: "HTML" },
    { id: "css", name: "CSS" },
];

const SUPPORTED_FOCUS_LIST = [
    { id: "general", name: "General Review" },
    { id: "performance", name: "Performance Optimization" },
    { id: "security", name: "Security Audit" },
    { id: "readability", name: "Readability & Clean Code" },
    { id: "best practices", name: "Language Best Practices" },
    { id: "bug detection", name: "Bug Detection" },
    { id: "optimization", name: "Algorithm Optimization" },
];

const MAX_CODE_LENGTH_CLIENT = 50000;

class InputValidator {
    /**
     * Validates review submission input.
     * @param {Object} input - { language, reviewFocus, code }
     * @returns {Object} { isValid: boolean, message: string }
     */
    static validateReviewInput(input) {
        if (!input.language || !input.language.trim()) {
            return { isValid: false, message: "Please select a programming language." };
        }

        if (!input.reviewFocus || !input.reviewFocus.trim()) {
            return { isValid: false, message: "Please select a review focus area." };
        }

        if (!input.code || !input.code.trim()) {
            return { isValid: false, message: "Please enter or paste source code to review." };
        }

        if (input.code.length > MAX_CODE_LENGTH_CLIENT) {
            return {
                isValid: false,
                message: `Source code exceeds maximum length of ${MAX_CODE_LENGTH_CLIENT.toLocaleString()} characters.`,
            };
        }

        return { isValid: true, message: "" };
    }

    /**
     * Validates rewrite submission input.
     * @param {Object} input - { language, code }
     * @returns {Object} { isValid: boolean, message: string }
     */
    static validateRewriteInput(input) {
        if (!input.language || !input.language.trim()) {
            return { isValid: false, message: "Please select a programming language." };
        }

        if (!input.code || !input.code.trim()) {
            return { isValid: false, message: "Please enter or paste source code to rewrite." };
        }

        if (input.code.length > MAX_CODE_LENGTH_CLIENT) {
            return {
                isValid: false,
                message: `Source code exceeds maximum length of ${MAX_CODE_LENGTH_CLIENT.toLocaleString()} characters.`,
            };
        }

        return { isValid: true, message: "" };
    }
}

window.InputValidator = InputValidator;
window.SUPPORTED_LANGUAGES_LIST = SUPPORTED_LANGUAGES_LIST;
window.SUPPORTED_FOCUS_LIST = SUPPORTED_FOCUS_LIST;
