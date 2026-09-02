import { useCallback, useEffect, useState } from 'react';
import { BellOff, BellRing, Loader2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { toast } from '../../reusecomponent/toast.jsx';
import { getUserFacingErrorMessage } from '../../lib/errorPresentation.js';
import { fetchNotificationPreferences } from '../../services/notificationService';
import {
    BROWSER_PUSH_SETTING_CHANGED_EVENT,
    getBrowserPushState,
    setBrowserPushEnabledForAccount
} from '../../services/pushNotificationService';

function getUserId(user) {
    return user?.id || user?.user_id || user?.userId || '';
}

export default function BrowserNotificationButton({ user }) {
    const userId = getUserId(user);
    const [preferences, setPreferences] = useState(null);
    const [browserState, setBrowserState] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);

    const loadState = useCallback(async () => {
        if (!userId) return;

        try {
            const [preferencesData, nextBrowserState] = await Promise.all([
                fetchNotificationPreferences(userId),
                getBrowserPushState(userId)
            ]);
            setPreferences(preferencesData.preferences || {});
            setBrowserState(nextBrowserState);
        } catch (error) {
            console.error('[iPawcus push] Notification viewer push state failed to load.', error);
        }
    }, [userId]);

    useEffect(() => {
        loadState();
    }, [loadState]);

    useEffect(() => {
        const handleSettingChange = (event) => {
            if (event.detail?.preferences) setPreferences(event.detail.preferences);
            if (event.detail?.browserState) setBrowserState(event.detail.browserState);
        };

        window.addEventListener(BROWSER_PUSH_SETTING_CHANGED_EVENT, handleSettingChange);
        return () => window.removeEventListener(BROWSER_PUSH_SETTING_CHANGED_EVENT, handleSettingChange);
    }, []);

    const isEnabled = Boolean(preferences?.browser_push_enabled && browserState?.enabled);
    const isUnavailable = browserState && (
        !browserState.supported
        || browserState.secure === false
        || !browserState.configured
    );
    const label = isEnabled
        ? 'Turn off browser notifications'
        : browserState?.permission === 'denied'
            ? 'Browser notifications are blocked in site settings'
            : 'Turn on browser notifications';

    const handleToggle = async () => {
        if (!userId || isUpdating) return;

        if (browserState?.permission === 'denied') {
            toast.info('Notifications are blocked for this site. Allow them in your browser site settings, then try again.');
            return;
        }

        if (isUnavailable) {
            toast.error(browserState?.secure === false
                ? 'Browser notifications require the secure HTTPS website.'
                : 'Browser notifications are not available on this device yet.');
            return;
        }

        setIsUpdating(true);
        try {
            const result = await setBrowserPushEnabledForAccount(userId, !isEnabled, preferences || {});
            setPreferences(result.preferences);
            setBrowserState(result.browserState);
            toast.success(!isEnabled
                ? 'Browser notifications are now on for this account.'
                : 'Browser notifications are now off for this account.');
        } catch (error) {
            console.error('[iPawcus push] Notification viewer push toggle failed.', error);
            const message = getUserFacingErrorMessage(
                error,
                'Browser notifications could not be updated.',
                { log: false }
            );
            if (/blocked|not allowed/i.test(message)) {
                toast.info(message);
            } else {
                toast.error(message);
            }
            await loadState();
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleToggle}
            disabled={isUpdating || !userId || !browserState}
            aria-label={label}
            aria-pressed={isEnabled}
            title={label}
            className={`size-8 rounded-full p-0 ${isEnabled
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'}`}
        >
            {isUpdating
                ? <Loader2 className="size-4 animate-spin" />
                : isEnabled
                    ? <BellRing className="size-4" />
                    : <BellOff className="size-4" />}
        </Button>
    );
}
