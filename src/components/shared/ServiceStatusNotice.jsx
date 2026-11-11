import { useCallback, useEffect, useRef, useState } from 'react';
import { checkServerHealth, getServerStatusSnapshot, subscribeToServerStatus } from '../../services/apiClient.js';
import { toast } from '../../reusecomponent/toast.jsx';

export default function ServiceStatusNotice() {
    const [status, setStatus] = useState(getServerStatusSnapshot);
    const wasDown = useRef(status.isDown);
    const retry = useCallback(async () => {
        try { await checkServerHealth(); } catch { /* Local sections retain their own errors. */ }
    }, []);
    useEffect(() => subscribeToServerStatus(setStatus), []);
    useEffect(() => {
        if (status.isDown && !wasDown.current) {
            toast.error(status.message || 'Live services are temporarily unavailable.');
        }
        wasDown.current = status.isDown;
    }, [status]);
    useEffect(() => {
        retry();
        const timer = window.setInterval(retry, 10000);
        return () => window.clearInterval(timer);
    }, [retry]);
    return null;
}
