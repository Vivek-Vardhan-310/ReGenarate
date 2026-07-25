/**
 * Notification System Module.
 *
 * Provides non-intrusive toast notifications for feedback (success, info, warning, error).
 * Per Rules (docs/03-Rules.md, CSS-005):
 * - Color meanings must remain consistent: Green=Success, Blue=Info, Yellow=Warning, Red=Error.
 * - Accessible with ARIA roles (`role="alert"` / `aria-live="polite"`).
 */

"use strict";

class NotificationManager {
    constructor() {
        this.container = null;
        this._initContainer();
    }

    _initContainer() {
        let container = document.getElementById("toast-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "toast-container";
            container.className = "fixed bottom-5 right-5 z-50 flex flex-col space-y-3 max-w-md w-full px-4 pointer-events-none";
            container.setAttribute("aria-live", "polite");
            container.setAttribute("aria-atomic", "true");
            document.body.appendChild(container);
        }
        this.container = container;
    }

    /**
     * Shows a toast notification.
     * @param {string} message - Message text.
     * @param {string} type - 'success' | 'info' | 'warning' | 'error'
     * @param {number} durationMs - Auto-dismiss duration in ms (default 4000).
     */
    show(message, type = "info", durationMs = 4000) {
        const toast = document.createElement("div");

        const colorMap = {
            success: "bg-emerald-950 border-emerald-500/50 text-emerald-200 icon-emerald",
            info: "bg-sky-950 border-sky-500/50 text-sky-200 icon-sky",
            warning: "bg-amber-950 border-amber-500/50 text-amber-200 icon-amber",
            error: "bg-rose-950 border-rose-500/50 text-rose-200 icon-rose",
        };

        const iconMap = {
            success: "✓",
            info: "ℹ",
            warning: "⚠",
            error: "✖",
        };

        const styleClasses = colorMap[type] || colorMap.info;
        const iconSymbol = iconMap[type] || iconMap.info;

        toast.className = `pointer-events-auto flex items-center justify-between p-4 rounded-xl border shadow-xl backdrop-blur-md transform transition-all duration-300 translate-y-2 opacity-0 ${styleClasses}`;
        toast.setAttribute("role", type === "error" ? "alert" : "status");

        toast.innerHTML = `
            <div class="flex items-center space-x-3 pr-2">
                <span class="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs bg-white/10 shrink-0">
                    ${iconSymbol}
                </span>
                <span class="text-sm font-medium leading-snug">${message}</span>
            </div>
            <button type="button" class="text-white/60 hover:text-white text-lg font-bold px-2 py-1 focus:outline-none" aria-label="Close notification">
                ×
            </button>
        `;

        const closeBtn = toast.querySelector("button");
        closeBtn.addEventListener("click", () => this.dismiss(toast));

        this.container.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.remove("translate-y-2", "opacity-0");
            toast.classList.add("translate-y-0", "opacity-100");
        });

        if (durationMs > 0) {
            setTimeout(() => this.dismiss(toast), durationMs);
        }
    }

    dismiss(toast) {
        if (!toast || !toast.parentNode) return;
        toast.classList.remove("translate-y-0", "opacity-100");
        toast.classList.add("translate-y-2", "opacity-0");
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    success(msg, duration) { this.show(msg, "success", duration); }
    info(msg, duration) { this.show(msg, "info", duration); }
    warning(msg, duration) { this.show(msg, "warning", duration); }
    error(msg, duration) { this.show(msg, "error", duration); }
}

window.notifications = new NotificationManager();
