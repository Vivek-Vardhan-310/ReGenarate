/**
 * ReviewEvents — Typed Internal Event Bus.
 *
 * Decouples all frontend modules from direct function calls.
 * Every module subscribes to events it cares about and reacts
 * independently, making future features trivial to bolt on.
 *
 * Defined Events:
 *   QuickFixApplied     { issueUuid, changedLines, oldCode, newCode, fixData }
 *   IssueResolved       { issueUuid, severity }
 *   IssueRelocated      { issueUuid, oldLine, newLine, confidence, confidenceScore }
 *   IssueStale          { issueUuid }
 *   ReviewUpdated       { issues, severityCounts, reviewVersion }
 *   DiagnosticsUpdated  {}
 *   ReviewVersionChanged { version }
 *
 * Exposed as: window.ReviewEvents
 */

"use strict";

const ReviewEvents = (() => {

    /** @type {Map<string, Set<Function>>} */
    const _listeners = new Map();

    /**
     * Subscribe to an event.
     * @param {string} event
     * @param {Function} handler
     */
    function on(event, handler) {
        if (!_listeners.has(event)) {
            _listeners.set(event, new Set());
        }
        _listeners.get(event).add(handler);
    }

    /**
     * Unsubscribe from an event.
     * @param {string} event
     * @param {Function} handler
     */
    function off(event, handler) {
        if (_listeners.has(event)) {
            _listeners.get(event).delete(handler);
        }
    }

    /**
     * Emit an event, calling all registered handlers.
     * Handler errors are caught and logged so one bad handler
     * cannot prevent others from running.
     * @param {string} event
     * @param {*} data
     */
    function emit(event, data) {
        console.log(`[EventBus] ${event} received`);
        if (!_listeners.has(event)) return;
        _listeners.get(event).forEach((handler) => {
            try {
                handler(data);
            } catch (err) {
                console.error(`[ReviewEvents] Handler error for "${event}":`, err);
            }
        });
    }

    /**
     * Subscribe once — automatically unsubscribes after the first call.
     * @param {string} event
     * @param {Function} handler
     */
    function once(event, handler) {
        const wrapper = (data) => {
            off(event, wrapper);
            handler(data);
        };
        on(event, wrapper);
    }

    return { on, off, emit, once };

})();

window.ReviewEvents = ReviewEvents;
