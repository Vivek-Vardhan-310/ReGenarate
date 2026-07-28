/**
 * FingerprintEngine — Issue Location Fingerprinting & Relocation.
 *
 * Computes stable fingerprints for issues at review time, then matches
 * them against updated code after edits to produce accurate relocations.
 *
 * Matching priority (tried in order):
 *   1. Exact text match           → HIGH   (score 0.95)
 *   2. Normalized text match      → HIGH   (score 0.88)
 *   3. Hash match (FNV-1a)        → HIGH   (score 0.86)
 *   4. Context match (both sides) → MEDIUM (score 0.72)
 *   5. Partial context match      → MEDIUM (score 0.60)
 *   6. Line shift (below edit)    → LOW    (score 0.45)
 *   7. Issue is above edit        → HIGH   (score 0.92, unchanged)
 *   8. No match                   → UNKNOWN (score 0.0)
 *
 * Hash algorithm: FNV-1a 32-bit (fast, sync, well-distributed).
 * Normalization: collapse whitespace → lowercase → trim.
 *
 * Design note: SHA-256 (SubtleCrypto) would be ideal for collision
 * resistance but is async. FNV-1a is acceptable for this use case
 * (duplicate detection, not cryptographic security). Can be upgraded
 * to Web Crypto SHA-256 in a future async init phase if needed.
 *
 * Exposed as: window.FingerprintEngine
 */

"use strict";

const FingerprintEngine = (() => {

    // ── Hash ──────────────────────────────────────────────────────────────────

    /**
     * FNV-1a 32-bit hash. Fast, sync, good distribution.
     * @param {string} str
     * @returns {string} 8-character hex string
     */
    function _fnv1a(str) {
        let h = 0x811c9dc5 >>> 0;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 0x01000193) >>> 0;
        }
        return h.toString(16).padStart(8, "0");
    }

    // ── Normalization ─────────────────────────────────────────────────────────

    /**
     * Normalizes text for stable fingerprint comparison.
     * Survives re-indentation, trailing space changes, and case differences.
     * @param {string} text
     * @returns {string}
     */
    function _normalize(text) {
        if (!text) return "";
        return text
            .replace(/\s+/g, " ") // collapse all whitespace runs to single space
            .trim()
            .toLowerCase();
    }

    // ── Public: Compute ───────────────────────────────────────────────────────

    /**
     * Computes a fingerprint for an issue against the current source code.
     *
     * @param {Object} issue - Issue with .line and .endLine (1-based).
     * @param {string[]} lines - Source split into lines (0-indexed array).
     * @returns {Object} Fingerprint object.
     */
    function compute(issue, lines) {
        const startIdx = Math.max(0, (issue.line || 1) - 1);
        const endIdx   = Math.max(startIdx, Math.min((issue.endLine || issue.line || 1) - 1, lines.length - 1));

        const issueLines = lines.slice(startIdx, endIdx + 1);
        const text           = issueLines.join("\n");
        const normalizedText = _normalize(text);
        const hash           = _fnv1a(normalizedText);

        // Context: up to 2 lines before and 2 lines after
        const ctxBefore = _normalize(lines.slice(Math.max(0, startIdx - 2), startIdx).join("\n"));
        const ctxAfter  = _normalize(lines.slice(endIdx + 1, Math.min(lines.length, endIdx + 3)).join("\n"));

        // Byte offsets (approximate — used for overlap detection)
        let startOffset = 0;
        for (let i = 0; i < startIdx; i++) startOffset += lines[i].length + 1;
        let endOffset = startOffset;
        for (let i = startIdx; i <= endIdx; i++) endOffset += lines[i].length + 1;

        return { text, normalizedText, hash, contextBefore: ctxBefore, contextAfter: ctxAfter, startOffset, endOffset };
    }

    // ── Public: Locate ────────────────────────────────────────────────────────

    /**
     * Attempts to locate a fingerprinted issue in updated source code.
     *
     * @param {Object} fingerprint       - Issue fingerprint (from compute()).
     * @param {string[]} newLines        - Updated source split into lines (0-indexed).
     * @param {number} issueStartLine    - Current 1-based line of the issue (pre-edit).
     * @param {number} lineDelta         - newLineCount - oldLineCount.
     * @param {{ startLine: number, endLine: number }} editedRegion - 1-based edit extent.
     * @returns {{ newLine, newEndLine, confidence, confidenceScore }}
     */
    function locate(fingerprint, newLines, issueStartLine, lineDelta, editedRegion) {
        const issueLineCount = (fingerprint.text.split("\n").length) || 1;
        const maxStart = Math.max(0, newLines.length - issueLineCount);

        // ── 1. Exact text match ───────────────────────────────────────────────
        for (let i = 0; i <= maxStart; i++) {
            if (newLines.slice(i, i + issueLineCount).join("\n") === fingerprint.text) {
                return { newLine: i + 1, newEndLine: i + issueLineCount, confidence: "HIGH", confidenceScore: 0.95 };
            }
        }

        // ── 2. Normalized text match ──────────────────────────────────────────
        for (let i = 0; i <= maxStart; i++) {
            if (_normalize(newLines.slice(i, i + issueLineCount).join("\n")) === fingerprint.normalizedText) {
                return { newLine: i + 1, newEndLine: i + issueLineCount, confidence: "HIGH", confidenceScore: 0.88 };
            }
        }

        // ── 3. Hash match ─────────────────────────────────────────────────────
        for (let i = 0; i <= maxStart; i++) {
            if (_fnv1a(_normalize(newLines.slice(i, i + issueLineCount).join("\n"))) === fingerprint.hash) {
                return { newLine: i + 1, newEndLine: i + issueLineCount, confidence: "HIGH", confidenceScore: 0.86 };
            }
        }

        // ── 4. Context match ──────────────────────────────────────────────────
        const hasBefore = !!fingerprint.contextBefore;
        const hasAfter  = !!fingerprint.contextAfter;

        if (hasBefore || hasAfter) {
            for (let i = 0; i < newLines.length; i++) {
                const ctxBefore = _normalize(newLines.slice(Math.max(0, i - 2), i).join("\n"));
                const ctxAfter  = _normalize(newLines.slice(i + issueLineCount, Math.min(newLines.length, i + issueLineCount + 2)).join("\n"));

                const beforeOk = !hasBefore || ctxBefore === fingerprint.contextBefore;
                const afterOk  = !hasAfter  || ctxAfter  === fingerprint.contextAfter;

                if (beforeOk && afterOk) {
                    return { newLine: i + 1, newEndLine: i + issueLineCount, confidence: "MEDIUM", confidenceScore: 0.72 };
                }
                if (beforeOk || afterOk) {
                    return { newLine: i + 1, newEndLine: i + issueLineCount, confidence: "MEDIUM", confidenceScore: 0.60 };
                }
            }
        }

        // ── 5. Line shift — issue is BELOW the edit ────────────────────────────
        if (issueStartLine > editedRegion.endLine) {
            const shifted = issueStartLine + lineDelta;
            if (shifted >= 1 && shifted <= newLines.length) {
                return { newLine: shifted, newEndLine: shifted + issueLineCount - 1, confidence: "LOW", confidenceScore: 0.45 };
            }
        }

        // ── 6. Issue is entirely ABOVE the edit — it doesn't move ─────────────
        if (issueStartLine < editedRegion.startLine) {
            return { newLine: issueStartLine, newEndLine: issueStartLine + issueLineCount - 1, confidence: "HIGH", confidenceScore: 0.92 };
        }

        // ── 7. Fallback: cannot locate ────────────────────────────────────────
        return { newLine: issueStartLine, newEndLine: issueStartLine + issueLineCount - 1, confidence: "UNKNOWN", confidenceScore: 0.0 };
    }

    // ── Public: Overlap Detection ─────────────────────────────────────────────

    /**
     * Returns true if an issue's line range overlaps with the edited region.
     * Overlap means the issue may have been partially or fully overwritten.
     *
     * @param {Object} issue - Issue with .line and .endLine (1-based).
     * @param {{ startLine: number, endLine: number }} editedRegion
     * @returns {boolean}
     */
    function overlapsEdit(issue, editedRegion) {
        const iStart = issue.line    || 1;
        const iEnd   = issue.endLine || issue.line || 1;
        return iStart <= editedRegion.endLine && iEnd >= editedRegion.startLine;
    }

    // ── Export ────────────────────────────────────────────────────────────────

    return {
        compute,
        locate,
        overlapsEdit,
        normalize: _normalize,
        hash: _fnv1a,
    };

})();

window.FingerprintEngine = FingerprintEngine;
