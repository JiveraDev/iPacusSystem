import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../../ui/button';
import { sectionErrorMessage } from '../../lib/errorPolicy.js';
import './errorIsolation.css';

export default function SectionErrorState({ title = 'This section could not be loaded', error, onRetry, retrying = false, retryLabel = 'Retry section', stale = false, children }) {
    return (
        <div className="section-error-state" role="status" data-section-error data-stale={stale || undefined}>
            <AlertCircle className="size-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
                <p className="section-error-title">{title}</p>
                <p>{stale ? 'Showing the last loaded information. Refresh it before making changes.' : sectionErrorMessage(error)}</p>
                {children}
            </div>
            {onRetry ? <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={retrying}><RefreshCw className={`size-4 ${retrying ? 'animate-spin' : ''}`} aria-hidden="true" />{retrying ? 'Retrying…' : retryLabel}</Button> : null}
        </div>
    );
}
