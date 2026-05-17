import { RefObject, useEffect, useLayoutEffect, useRef } from 'react';

const SCROLL_THRESHOLD = 150;

export const useChatScroll = <T extends HTMLElement>(
    messages: unknown[],
    containerRef: RefObject<T>,
    isVisible: boolean = true
): void => {
    const previousMessageCount = useRef<number>(0);
    const hasInitialScrolled = useRef<boolean>(false);

    useLayoutEffect(() => {
        if (isVisible && messages.length > 0 && !hasInitialScrolled.current) {
            const container = containerRef.current;
            if (container) {
                container.scrollTop = container.scrollHeight;
                hasInitialScrolled.current = true;
                previousMessageCount.current = messages.length;
            }
        }
    }, [isVisible, messages.length, containerRef]);

    useEffect(() => {
        if (!isVisible || messages.length === 0) {
            previousMessageCount.current = messages.length;
            return;
        }
        const messageCount = messages.length;
        const hasNewMessages = messageCount > previousMessageCount.current;
        if (hasNewMessages) {
            const container = containerRef.current as
                | (HTMLElement & { scrollTop: number; scrollHeight: number; clientHeight: number })
                | null;
            if (container) {
                const isUserAtBottom = () => {
                    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
                    return distanceFromBottom < SCROLL_THRESHOLD;
                };
                requestAnimationFrame(() => {
                    if (container && (isUserAtBottom() || previousMessageCount.current === 0)) {
                        container.scrollTop = container.scrollHeight;
                    }
                    previousMessageCount.current = messageCount;
                });
            }
        } else {
            previousMessageCount.current = messageCount;
        }
    }, [messages.length, isVisible, containerRef]);
};
