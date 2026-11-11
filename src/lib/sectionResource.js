import { classifyError, isCancelledRequest } from './errorPolicy.js';

export function createSectionResource(load, { initialData = null, validate = value => value, onSuccess, now = () => new Date().toISOString() } = {}) {
    let state = { data: initialData, error: null, loading: true, refreshing: false, hasData: false, stale: false, lastSuccess: null };
    let active = true;
    let serial = 0;
    let running = null;
    let controller = null;
    const listeners = new Set();
    const publish = changes => {
        state = { ...state, ...changes };
        listeners.forEach(listener => listener());
    };
    const refresh = ({ isAutoRefresh = false } = {}) => {
        if (!active) return Promise.resolve(false);
        if (running) return running;
        const version = ++serial;
        controller = new AbortController();
        const signal = controller.signal;
        publish({ loading: !state.hasData, refreshing: state.hasData || !isAutoRefresh });
        running = Promise.resolve().then(() => load({ signal, isAutoRefresh })).then(validate).then(data => {
            if (!active || version !== serial) return false;
            onSuccess?.(data);
            publish({ data, error: null, hasData: true, stale: false, lastSuccess: now(), loading: false, refreshing: false });
            return true;
        }).catch(error => {
            if (!active || version !== serial) return false;
            if (isCancelledRequest(error)) {
                publish({ loading: false, refreshing: false });
                return false;
            }
            const clear = classifyError(error).clearData;
            publish({ error, loading: false, refreshing: false, stale: state.hasData && !clear,
                ...(clear ? { data: initialData, hasData: false, lastSuccess: null } : {}) });
            return false;
        }).finally(() => {
            if (version === serial) { running = null; controller = null; }
        });
        return running;
    };
    return {
        refresh,
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
        getSnapshot: () => state,
        updateData(update) {
            if (!active) return;
            serial += 1; controller?.abort(); controller = null; running = null;
            publish({ data: typeof update === 'function' ? update(state.data) : update, loading: false, refreshing: false });
        },
        activate() { active = true; },
        dispose() { active = false; serial += 1; controller?.abort(); controller = null; running = null; },
    };
}
