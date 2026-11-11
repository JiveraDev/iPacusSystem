// One coordinator owns service health. Feature failures are evidence to probe,
// never permission to unmount healthy content or clear another request's outage.
export function createServiceHealthCoordinator({ probe, onDown, onUp, debounceMs = 500, confirmationMs = 2000 }) {
    let pending = null;
    let timer = null;
    let failures = 0;
    let disposed = false;

    const schedule = (delay) => {
        if (disposed || timer !== null || pending) return;
        timer = setTimeout(() => {
            timer = null;
            check().catch(() => {});
        }, delay);
        timer.unref?.();
    };

    const check = () => {
        if (disposed) return Promise.resolve(null);
        if (pending) return pending;
        if (timer !== null) { clearTimeout(timer); timer = null; }
        pending = Promise.resolve().then(probe).then((result) => {
            if (result?.ok !== true) throw new Error('Service health could not be verified.');
            if (!disposed) { failures = 0; onUp(); }
            return result;
        }).catch((error) => {
            if (!disposed) {
                failures += 1;
                if (failures >= 2) onDown(error);
            }
            throw error;
        }).finally(() => {
            pending = null;
            if (!disposed && failures === 1) schedule(confirmationMs);
        });
        return pending;
    };

    return {
        check,
        reportFailure() { schedule(debounceMs); },
        dispose() { disposed = true; if (timer !== null) clearTimeout(timer); timer = null; },
    };
}
