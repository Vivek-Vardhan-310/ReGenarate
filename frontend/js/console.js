/**
 * Integrated Execution Console Controller Module.
 *
 * Manages execution output display: stdout, stderr, exit code, execution duration,
 * status badge rendering, tab toggling, auto scrolling, output clearing, and output copying.
 *
 * Per Architecture (docs/02-Architecture.md) & Phase 11 Specification (docs/04-Phases.md).
 */

"use strict";

class ConsoleController {
    constructor() {
        this.consoleSection = document.getElementById("console-section");
        this.statusPill = document.getElementById("console-status-pill");
        this.exitCodeSpan = document.getElementById("console-exit-code");
        this.durationSpan = document.getElementById("console-duration");
        this.stdoutInput = document.getElementById("console-stdout");
        this.stderrInput = document.getElementById("console-stderr");
        this.stdoutContainer = document.getElementById("stdout-container");
        this.stderrContainer = document.getElementById("stderr-container");
        this.tabStdoutBtn = document.getElementById("tab-stdout-btn");
        this.tabStderrBtn = document.getElementById("tab-stderr-btn");
        this.copyBtn = document.getElementById("copy-console-btn");
        this.clearBtn = document.getElementById("clear-console-btn");
        this.toggleBtn = document.getElementById("toggle-console-btn");
        this.toggleIcon = document.getElementById("toggle-console-icon");
        this.consoleBody = document.getElementById("console-body");

        this.executionState = {
            status: "not_executed",
            exitCode: 0,
            stdout: "",
            stderr: "",
            executionTimeMs: 0,
            sourceHash: null,
            isStale: false,
        };

        this.activeTab = "stdout";
        this.isCollapsed = false;
    }

    init() {
        this.bindEvents();
        this.render();
    }

    bindEvents() {
        if (this.copyBtn) {
            this.copyBtn.addEventListener("click", () => this.copyOutput());
        }

        if (this.clearBtn) {
            this.clearBtn.addEventListener("click", () => this.clearConsole());
        }

        if (this.toggleBtn) {
            this.toggleBtn.addEventListener("click", () => this.toggleCollapse());
        }

        if (this.tabStdoutBtn) {
            this.tabStdoutBtn.addEventListener("click", () => this.switchTab("stdout"));
        }

        if (this.tabStderrBtn) {
            this.tabStderrBtn.addEventListener("click", () => this.switchTab("stderr"));
        }
    }

    computeHash(code) {
        if (typeof code !== "string" || !code) return "";
        let hash = 0x811c9dc5;
        for (let i = 0; i < code.length; i++) {
            hash ^= code.charCodeAt(i);
            hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        }
        return (hash >>> 0).toString(16);
    }

    setExecutionResult(result = {}, code = null) {
        const sourceHash = code !== null ? this.computeHash(code) : null;
        this.executionState = {
            status: result.status || "not_executed",
            exitCode: typeof result.exit_code === "number" ? result.exit_code : (typeof result.exitCode === "number" ? result.exitCode : 0),
            stdout: result.stdout || "",
            stderr: result.stderr || "",
            executionTimeMs: result.execution_time_ms || result.executionTimeMs || 0,
            sourceHash: sourceHash,
            isStale: false,
        };

        // If stderr exists and stdout is empty, default to stderr tab
        if (this.executionState.stderr && !this.executionState.stdout) {
            this.activeTab = "stderr";
        } else {
            this.activeTab = "stdout";
        }

        this.render();
    }

    checkStaleness(currentCode) {
        if (this.executionState.sourceHash !== null) {
            const currentHash = this.computeHash(currentCode);
            if (currentHash !== this.executionState.sourceHash) {
                this.executionState.isStale = true;
            }
        }
    }

    getExecutionData() {
        if (this.executionState.isStale || (this.executionState.status === "not_executed" && !this.executionState.stdout && !this.executionState.stderr)) {
            return null;
        }

        return {
            status: this.executionState.status,
            exit_code: this.executionState.exitCode,
            stdout: this.executionState.stdout,
            stderr: this.executionState.stderr,
            execution_time_ms: this.executionState.executionTimeMs,
        };
    }

    switchTab(tabName) {
        this.activeTab = tabName;
        if (tabName === "stdout") {
            if (this.stdoutContainer) this.stdoutContainer.classList.remove("hidden");
            if (this.stderrContainer) this.stderrContainer.classList.add("hidden");

            if (this.tabStdoutBtn) {
                this.tabStdoutBtn.className = "px-2 py-0.5 rounded text-xs font-semibold bg-primary-500/20 text-primary-300 border border-primary-500/30";
            }
            if (this.tabStderrBtn) {
                this.tabStderrBtn.className = "px-2 py-0.5 rounded text-xs font-semibold text-surface-400 hover:text-white";
            }
        } else {
            if (this.stdoutContainer) this.stdoutContainer.classList.add("hidden");
            if (this.stderrContainer) this.stderrContainer.classList.remove("hidden");

            if (this.tabStderrBtn) {
                this.tabStderrBtn.className = "px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30";
            }
            if (this.tabStdoutBtn) {
                this.tabStdoutBtn.className = "px-2 py-0.5 rounded text-xs font-semibold text-surface-400 hover:text-white";
            }
        }
    }

    toggleCollapse() {
        this.isCollapsed = !this.isCollapsed;
        if (this.consoleBody) {
            if (this.isCollapsed) {
                this.consoleBody.classList.add("hidden");
                if (this.toggleIcon) this.toggleIcon.textContent = "▲";
            } else {
                this.consoleBody.classList.remove("hidden");
                if (this.toggleIcon) this.toggleIcon.textContent = "▼";
            }
        }
    }

    clearConsole() {
        this.executionState = {
            status: "not_executed",
            exitCode: 0,
            stdout: "",
            stderr: "",
            executionTimeMs: 0,
            sourceHash: null,
            isStale: false,
        };
        this.activeTab = "stdout";
        this.render();
        if (window.notifications) {
            window.notifications.info("Console cleared.");
        }
    }

    copyOutput() {
        const textToCopy = [
            `Status: ${this.executionState.status} (Exit Code: ${this.executionState.exitCode})`,
            this.executionState.stdout ? `--- STDOUT ---\n${this.executionState.stdout}` : "",
            this.executionState.stderr ? `--- STDERR ---\n${this.executionState.stderr}` : "",
        ]
            .filter(Boolean)
            .join("\n\n");

        if (!textToCopy) {
            if (window.notifications) {
                window.notifications.warning("Console output is empty.");
            }
            return;
        }

        if (window.ClipboardHelper) {
            window.ClipboardHelper.copyToClipboard(textToCopy, "Console output copied to clipboard!");
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                if (window.notifications) {
                    window.notifications.success("Console output copied to clipboard!");
                }
            });
        }
    }

    render() {
        // 1. Update text inputs
        if (this.stdoutInput) {
            this.stdoutInput.value = this.executionState.stdout;
            this.stdoutInput.scrollTop = this.stdoutInput.scrollHeight;
        }

        if (this.stderrInput) {
            this.stderrInput.value = this.executionState.stderr;
            this.stderrInput.scrollTop = this.stderrInput.scrollHeight;
        }

        // 2. Update status pill
        if (this.statusPill) {
            const status = this.executionState.status;
            if (status === "success") {
                this.statusPill.textContent = "Success";
                this.statusPill.className = "text-xs bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/20 font-mono";
            } else if (status === "failed") {
                this.statusPill.textContent = "Failed";
                this.statusPill.className = "text-xs bg-rose-500/10 text-rose-400 px-2.5 py-0.5 rounded-full border border-rose-500/20 font-mono";
            } else {
                this.statusPill.textContent = "Not Executed";
                this.statusPill.className = "text-xs bg-surface-800 text-surface-200 px-2.5 py-0.5 rounded-full border border-surface-700 font-mono";
            }
        }

        // 3. Update meta stats
        if (this.exitCodeSpan) {
            this.exitCodeSpan.textContent = `Exit Code: ${this.executionState.exitCode}`;
        }
        if (this.durationSpan) {
            this.durationSpan.textContent = `Duration: ${this.executionState.executionTimeMs}ms`;
        }

        // 4. Update tab visibility
        this.switchTab(this.activeTab);
    }
}

window.ConsoleController = ConsoleController;
