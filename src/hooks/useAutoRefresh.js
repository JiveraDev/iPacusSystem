import { useEffect, useRef } from 'react';

export const AUTO_REFRESH_INTERVAL_MS = 4000;

export function useAutoRefresh(callback, {
    enabled = true,
    intervalMs = AUTO_REFRESH_INTERVAL_MS,
    refreshKey = 'default',
    runOnMount = true
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

        const run = async (isAutoRefresh = false) => {
            if (isCancelled || isRunning) {
                return;
            }

            isRunning = true;
            try {
                await callbackRef.current({ isAutoRefresh });
            } finally {
                isRunning = false;
            }
        };

        if (runOnMount) {
            run(false);
        }

        const timerId = window.setInterval(() => run(true), intervalMs);

        return () => {
            isCancelled = true;
            window.clearInterval(timerId);
        };
    }, [enabled, intervalMs, refreshKey, runOnMount]);
}
