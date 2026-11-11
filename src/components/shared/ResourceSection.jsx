import ErrorBoundary from './ErrorBoundary.jsx';
import SectionErrorState from './SectionErrorState.jsx';

export default function ResourceSection({ resource, title, children }) {
    if (resource.error) return <SectionErrorState title={`${title} could not be loaded`} error={resource.error} onRetry={resource.retry} retrying={resource.refreshing} retryLabel={`Retry ${title.toLowerCase()}`} />;
    if (resource.loading) return <div role="status" className="section-error-state">Loading {title.toLowerCase()}…</div>;
    return <ErrorBoundary title={`${title} could not be displayed`} scope="resource-section">{children}</ErrorBoundary>;
}
