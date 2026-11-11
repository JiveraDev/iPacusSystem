import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { createSectionResource } from '../lib/sectionResource.js';
import { useAutoRefresh } from './useAutoRefresh.js';
import { classifyError } from '../lib/errorPolicy.js';

export function useSectionResource(key, loader, { enabled = true, initialData = null, validate, onSuccess, intervalMs = 4000 } = {}) {
    const loaderRef = useRef(loader);
    const validationRef = useRef(validate);
    const successRef = useRef(onSuccess);
    useLayoutEffect(() => { loaderRef.current = loader; validationRef.current = validate; successRef.current = onSuccess; });
    const resource = useMemo(() => createSectionResource(options => loaderRef.current(options), {
        initialData,
        validate: value => validationRef.current ? validationRef.current(value) : value,
        onSuccess: value => successRef.current?.(value),
    // The key owns the resource lifetime. Loaders/validators intentionally use the latest closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [key]);
    useEffect(() => { resource.activate(); return () => resource.dispose(); }, [resource]);
    const state = useSyncExternalStore(resource.subscribe, resource.getSnapshot, resource.getSnapshot);
    const canAutoRefresh = enabled && (!state.error || classifyError(state.error).retryable);
    useAutoRefresh(resource.refresh, { enabled: canAutoRefresh, intervalMs, refreshKey: key });
    return { ...state, retry: resource.refresh, updateData: resource.updateData, getSnapshot: resource.getSnapshot };
}
