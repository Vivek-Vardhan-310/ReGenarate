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
    { id: "python", name: "Python", extensions: [".py", ".pyw"] },
    { id: "java", name: "Java", extensions: [".java"] },
    { id: "javascript", name: "JavaScript", extensions: [".js", ".jsx", ".mjs", ".cjs"] },
    { id: "typescript", name: "TypeScript", extensions: [".ts", ".tsx"] },
    { id: "c", name: "C", extensions: [".c", ".h"] },
    { id: "cpp", name: "C++", extensions: [".cpp", ".cc", ".cxx", ".hpp", ".hxx"] },
    { id: "csharp", name: "C#", extensions: [".cs"] },
    { id: "go", name: "Go", extensions: [".go"] },
    { id: "php", name: "PHP", extensions: [".php"] },
    { id: "rust", name: "Rust", extensions: [".rs"] },
    { id: "kotlin", name: "Kotlin", extensions: [".kt", ".kts"] },
    { id: "swift", name: "Swift", extensions: [".swift"] },
    { id: "sql", name: "SQL", extensions: [".sql"] },
    { id: "html", name: "HTML", extensions: [".html", ".htm"] },
    { id: "css", name: "CSS", extensions: [".css"] },
    { id: "ruby", name: "Ruby", extensions: [".rb"] },
    { id: "scala", name: "Scala", extensions: [".scala", ".sc"] },
    { id: "xml", name: "XML", extensions: [".xml"] },
    { id: "json", name: "JSON", extensions: [".json"] },
    { id: "yaml", name: "YAML", extensions: [".yaml", ".yml"] },
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
     * Retrieves all supported file extensions from the centralized language configuration.
     * @returns {string[]} Array of supported extensions e.g. [".py", ".java", ...]
     */
    static getAllSupportedExtensions() {
        const extensions = [];
        SUPPORTED_LANGUAGES_LIST.forEach((lang) => {
            if (lang.extensions) {
                extensions.push(...lang.extensions);
            }
        });
        return [...new Set(extensions)];
    }

    /**
     * Generates HTML accept attribute value for file picker inputs from centralized configuration.
     * @returns {string} Comma-separated extension string e.g. ".py,.java,.js"
     */
    static getAcceptAttribute() {
        return InputValidator.getAllSupportedExtensions().join(",");
    }

    /**
     * Detects programming language from a file name based on extension.
     * @param {string} filename - The file name (e.g. "main.py")
     * @returns {string|null} The matching language id (e.g. "python") or null if unsupported.
     */
    static detectLanguageFromFilename(filename) {
        if (!filename || typeof filename !== "string") return null;
        const lowerName = filename.toLowerCase();
        const extMatch = lowerName.match(/\.[a-z0-9]+$/i);
        if (!extMatch) return null;
        const ext = extMatch[0];

        const match = SUPPORTED_LANGUAGES_LIST.find(
            (lang) => lang.extensions && lang.extensions.includes(ext)
        );
        return match ? match.id : null;
    }

    /**
     * Validates an imported file before reading.
     * @param {File} file - Browser File object
     * @returns {Object} { isValid: boolean, errorType?: string, message?: string, detectedLanguage?: string|null, extension?: string }
     */
    static validateImportedFile(file) {
        if (!file) {
            return { isValid: false, errorType: "missing", message: "No file selected." };
        }

        const lowerName = file.name ? file.name.toLowerCase() : "";
        const extMatch = lowerName.match(/\.[a-z0-9]+$/i);
        const ext = extMatch ? extMatch[0] : "";

        // Check if extension is supported in centralized configuration
        const allExtensions = InputValidator.getAllSupportedExtensions();
        if (!ext || !allExtensions.includes(ext)) {
            return {
                isValid: false,
                errorType: "unsupported",
                extension: ext || "unknown",
                message: `Unsupported file type '${ext || file.name}'. Please select a supported source code file.`,
            };
        }

        // Check for empty file
        if (file.size === 0) {
            return {
                isValid: false,
                errorType: "empty",
                message: "The selected file is empty.",
            };
        }

        // Check file size limit (50,000 characters/bytes)
        if (file.size > MAX_CODE_LENGTH_CLIENT) {
            return {
                isValid: false,
                errorType: "oversized",
                message: `File size exceeds maximum allowed limit of ${MAX_CODE_LENGTH_CLIENT.toLocaleString()} characters.`,
            };
        }

        const detectedLanguage = InputValidator.detectLanguageFromFilename(file.name);
        return {
            isValid: true,
            detectedLanguage: detectedLanguage,
            extension: ext,
            message: "",
        };
    }

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
