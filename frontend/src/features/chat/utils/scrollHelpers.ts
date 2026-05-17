// src/utils/scrollHelpers.ts

const SCROLL_THRESHOLD = 150;

/**
 * Check if user is scrolled near the bottom of a container
 */
export function isUserAtBottom(container: HTMLElement | null): boolean {
    if (!container) return true;

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceFromBottom < SCROLL_THRESHOLD;
}

/**
 * Scroll container to bottom with RAF for smooth scrolling
 */
export function scrollToBottom(container: HTMLElement | null): void {
    if (!container) return;

    container.scrollTop = container.scrollHeight;
    requestAnimationFrame(() => {
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    });
}

/**
 * Scroll to bottom with double RAF for initial scroll
 */
export function scrollToBottomInitial(container: HTMLElement | null): void {
    if (!container) return;

    requestAnimationFrame(() => {
        if (container) {
            container.scrollTop = container.scrollHeight;
            requestAnimationFrame(() => {
                if (container) {
                    container.scrollTop = container.scrollHeight;
                }
            });
        }
    });
}

/**
 * Auto-scroll if user is at bottom
 */
export function autoScrollIfAtBottom(container: HTMLElement | null, wasAtBottom: boolean): void {
    if (!container || !wasAtBottom) return;

    requestAnimationFrame(() => {
        scrollToBottom(container);
    });
}
