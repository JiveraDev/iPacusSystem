import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

export default function SubmissionStatus({
    active,
    ...props
}) {
    if (!active) {
        return null;
    }

    return <ActiveSubmissionStatus {...props} />;
}

function ActiveSubmissionStatus({
    label = 'Sending request...',
    slowLabel = 'Still sending...',
    message = 'Please keep this page open and do not submit again.',
    slowMessage = 'The connection is slow, but the request is still processing. Please wait for the final result before retrying.',
    delayMs = 5000,
    className = ''
}) {
    const [isSlow, setIsSlow] = useState(false);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => setIsSlow(true), delayMs);
        return () => window.clearTimeout(timeoutId);
    }, [delayMs]);

    return (
        <div
            className={`flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 ${className}`}
            role="status"
            aria-live="polite"
        >
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-600" />
            <div>
                <p className="font-semibold">{isSlow ? slowLabel : label}</p>
                <p className="mt-1 text-xs text-blue-800">{isSlow ? slowMessage : message}</p>
            </div>
        </div>
    );
}
