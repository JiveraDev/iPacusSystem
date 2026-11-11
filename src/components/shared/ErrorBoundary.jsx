import { Component, Fragment } from 'react';
import SectionErrorState from './SectionErrorState.jsx';

function SectionRenderer({ render }) { return render(); }

export default class ErrorBoundary extends Component {
    state = { failed: false, attempt: 0 };
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch() {
        // Never log component props, raw errors, stack traces, or clinical data.
        console.error('[iPawcus] A rendering error was contained.', { scope: this.props.scope || 'section' });
    }
    componentDidUpdate(previous) {
        if (this.state.failed && previous.resetKey !== this.props.resetKey) this.reset();
    }
    reset = () => this.setState((state) => ({ failed: false, attempt: state.attempt + 1 }));
    render() {
        if (this.state.failed) {
            if (this.props.root) return (
                <main className="root-error-state" role="alert">
                    <h1>iPawcus could not display this page</h1>
                    <p>Reload the application to try again.</p>
                    <button type="button" onClick={() => window.location.reload()}>Reload application</button>
                </main>
            );
            return <SectionErrorState title={this.props.title || 'This section could not be displayed'} onRetry={this.reset} retryLabel="Retry display">
                {this.props.onDismiss ? <button type="button" className="section-error-reload" onClick={this.props.onDismiss}>Close this panel</button> : null}
                <button type="button" className="section-error-reload" onClick={() => window.location.reload()}>Reload application if retry does not help</button>
            </SectionErrorState>;
        }
        return <Fragment key={this.state.attempt}>{typeof this.props.children === 'function' ? <SectionRenderer render={this.props.children} /> : this.props.children}</Fragment>;
    }
}
