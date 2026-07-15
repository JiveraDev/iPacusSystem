import { useEffect, useRef } from 'react';

export const AUTO_REFRESH_INTERVAL_MS = 4000;

export function useAutoRefresh(callback, {
    enabled = true,
    intervalMs = AUTO_REFRESH_INTERVAL_MS,
    refreshKey = 'default',
    runOnMount = true,
    pauseWhenHidden = true,
    maxBackoffMs = 30000
} = {}) {
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        if (!enabled) {
            return undefined;
        }

        let isCancelled = false;
        let isRunning = false;
        let timerId = null;
        let failureCount = 0;

        const clearTimer = () => {
            if (timerId) {
                window.clearTimeout(timerId);
                timerId = null;
            }
        };

        const isDocumentHidden = () => (
            pauseWhenHidden
            && typeof document !== 'undefined'
            && document.hidden
        );

        const nextDelay = () => {
            const failures = Math.min(failureCount, 3);
            const delay = intervalMs * Math.max(1, 2 ** failures);

            return Math.min(delay, maxBackoffMs);
        };

        const schedule = (delayMs = intervalMs) => {
            clearTimer();

            if (!isCancelled) {
                timerId = window.setTimeout(() => run(true), delayMs);
            }
        };

        const run = async (isAutoRefresh = false) => {
            if (isCancelled) {
                return;
            }

            if (isRunning) {
                schedule(nextDelay());
                return;
            }

            if (isAutoRefresh && isDocumentHidden()) {
                schedule(intervalMs);
                return;
            }

            clearTimer();
            isRunning = true;
            try {
                await callbackRef.current({ isAutoRefresh });
                failureCount = 0;
            } catch (error) {
                failureCount += 1;
                if (import.meta.env.DEV) {
                    console.warn('Auto-refresh failed:', error);
                }
            } finally {
                isRunning = false;
                schedule(nextDelay());
            }
        };

        if (runOnMount) {
            run(false);
        } else {
            schedule(intervalMs);
        }

        const handleVisibilityChange = () => {
            if (!isDocumentHidden()) {
                failureCount = 0;
                run(true);
            }
        };

        if (pauseWhenHidden && typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', handleVisibilityChange);
        }

        return () => {
            isCancelled = true;
            clearTimer();

            if (pauseWhenHidden && typeof document !== 'undefined') {
                document.removeEventListener('visibilitychange', handleVisibilityChange);
            }
        };
    }, [enabled, intervalMs, refreshKey, runOnMount, pauseWhenHidden, maxBackoffMs]);
}
