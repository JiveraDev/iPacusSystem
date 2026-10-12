import { useCallback, useState } from 'react';
import { CircleCheck, Link2, Loader2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '../../ui/dialog.jsx';
import { toast } from '../../reusecomponent/toast.jsx';
import { useAutoRefresh } from '../../hooks/useAutoRefresh.js';
import {
    connectGoogleAccount,
    getGoogleConnectionStatus,
} from '../../services/googleAuthService.js';
import GoogleContinueButton from './GoogleContinueButton.jsx';

export default function GoogleAccountLinkControl() {
    const [connection, setConnection] = useState({ linked: false, providerEmail: '' });
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [loadError, setLoadError] = useState('');

    const loadConnection = useCallback(async ({ isAutoRefresh = false } = {}) => {
        if (!isAutoRefresh) setIsLoading(true);

        try {
            const result = await getGoogleConnectionStatus({ dedupe: false });
            setConnection({
                linked: Boolean(result?.linked),
                providerEmail: result?.providerEmail || '',
            });
            setLoadError('');
        } catch (error) {
            if (!isAutoRefresh) {
                setLoadError(error.message || 'The Google connection status could not be loaded.');
            }
            throw error;
        } finally {
            if (!isAutoRefresh) setIsLoading(false);
        }
    }, []);

    useAutoRefresh(loadConnection, { refreshKey: 'google-account-link-control' });

    const handleLinked = useCallback((result) => {
        setConnection({
            linked: true,
            providerEmail: result?.providerEmail || '',
        });
        setLoadError('');
        setIsDialogOpen(false);
        toast.success('Google is now connected to your iPawcus account.');
    }, []);

    if (isLoading) {
        return (
            <span
                className="inline-flex size-7 items-center justify-center text-slate-400"
                aria-label="Checking Google connection"
                title="Checking Google connection"
            >
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            </span>
        );
    }

    if (connection.linked) {
        return (
            <span
                className="inline-flex size-7 items-center justify-center rounded-md text-emerald-600 dark:text-emerald-400"
                aria-label="Google connected"
                title={connection.providerEmail ? `Google connected: ${connection.providerEmail}` : 'Google connected'}
            >
                <CircleCheck className="size-4" aria-hidden="true" />
            </span>
        );
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setIsDialogOpen(true)}
                className="inline-flex size-7 items-center justify-center rounded-md text-[#155dfc] transition-[background-color,transform] duration-150 hover:bg-blue-50 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155dfc] focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none dark:hover:bg-blue-950/40"
                aria-label="Connect this account to Google"
                title="Connect Google"
            >
                <Link2 className="size-4" aria-hidden="true" />
            </button>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Connect Google</DialogTitle>
                        <DialogDescription>
                            Choose the Google account that uses the same email address as your iPawcus account.
                        </DialogDescription>
                    </DialogHeader>

                    <GoogleContinueButton
                        authenticate={connectGoogleAccount}
                        onResult={handleLinked}
                    />

                    {loadError && (
                        <p className="text-sm text-red-600 dark:text-red-400" role="alert">{loadError}</p>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
