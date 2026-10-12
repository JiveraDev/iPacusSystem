import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { authenticateWithGoogle } from '../../services/googleAuthService.js';
import { getUserFacingErrorMessage } from '../../lib/errorPresentation.js';

const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client';
const GOOGLE_LOAD_TIMEOUT_MS = 12000;

let googleScriptPromise;
let initializedClientId = '';
let activeCredentialHandler = null;

function loadGoogleIdentityScript() {
    if (window.google?.accounts?.id) {
        return Promise.resolve(window.google);
    }

    if (googleScriptPromise) {
        return googleScriptPromise;
    }

    googleScriptPromise = new Promise((resolve, reject) => {
        let script = document.querySelector(`script[src="${GOOGLE_IDENTITY_SCRIPT}"]`);
        if (script?.dataset.ipawcusGoogleState === 'failed') {
            script.remove();
            script = null;
        }

        const isExistingScript = Boolean(script);
        script ||= document.createElement('script');
        let settled = false;

        const cleanup = () => {
            window.clearTimeout(timeoutId);
            script.removeEventListener('load', handleLoad);
            script.removeEventListener('error', handleError);
        };
        const finish = (callback) => {
            if (settled) return;
            settled = true;
            cleanup();
            callback();
        };
        const handleLoad = () => {
            if (window.google?.accounts?.id) {
                script.dataset.ipawcusGoogleState = 'ready';
                finish(() => resolve(window.google));
                return;
            }

            script.dataset.ipawcusGoogleState = 'failed';
            finish(() => reject(new Error('Google Identity Services did not initialize.')));
        };
        const handleError = () => {
            script.dataset.ipawcusGoogleState = 'failed';
            finish(() => reject(new Error('Google Identity Services could not be loaded.')));
        };
        const timeoutId = window.setTimeout(() => {
            script.dataset.ipawcusGoogleState = 'failed';
            script.remove();
            finish(() => reject(new Error('Google Identity Services took too long to load.')));
        }, GOOGLE_LOAD_TIMEOUT_MS);

        script.addEventListener('load', handleLoad, { once: true });
        script.addEventListener('error', handleError, { once: true });

        if (!isExistingScript) {
            script.src = GOOGLE_IDENTITY_SCRIPT;
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        }
    }).catch((error) => {
        googleScriptPromise = undefined;
        throw error;
    });

    return googleScriptPromise;
}

function initializeGoogleIdentity(clientId) {
    if (initializedClientId === clientId) {
        return;
    }

    window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => activeCredentialHandler?.(response),
        auto_select: false,
        cancel_on_tap_outside: true,
        use_fedcm_for_button: true,
        button_auto_select: false,
    });
    initializedClientId = clientId;
}

export default function GoogleContinueButton({
    authenticate = authenticateWithGoogle,
    onAuthenticated,
    onOnboarding,
    onResult,
}) {
    const containerRef = useRef(null);
    const handlerRef = useRef(null);
    const submissionInFlightRef = useRef(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [loadAttempt, setLoadAttempt] = useState(0);
    const clientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();

    useEffect(() => {
        let isMounted = true;
        let resizeObserver;
        let renderedWidth = 0;

        setIsLoading(true);
        setErrorMessage('');

        const handleCredential = async (googleResponse) => {
            if (!isMounted || !googleResponse?.credential || submissionInFlightRef.current) {
                return;
            }

            submissionInFlightRef.current = true;
            setIsSubmitting(true);
            setErrorMessage('');

            try {
                const result = await authenticate(googleResponse.credential);
                if (!isMounted) return;

                if (onResult) {
                    onResult(result);
                    return;
                }

                if (result?.status === 'authenticated') {
                    onAuthenticated?.(result);
                    return;
                }

                if (result?.status === 'onboarding_required') {
                    onOnboarding?.(result);
                    return;
                }

                throw new Error('Google returned an unexpected sign-in response.');
            } catch (error) {
                if (!isMounted) return;
                setErrorMessage(getUserFacingErrorMessage(
                    error,
                    'Google sign-in could not be completed. Please try again.',
                    { context: 'Google authentication details were hidden from the user interface.' }
                ));
            } finally {
                submissionInFlightRef.current = false;
                if (isMounted) setIsSubmitting(false);
            }
        };

        handlerRef.current = handleCredential;

        if (!clientId) {
            setIsLoading(false);
            setErrorMessage('Continue with Google is not configured yet.');
            return () => {
                isMounted = false;
            };
        }

        loadGoogleIdentityScript()
            .then(() => {
                if (!isMounted || !containerRef.current) return;

                initializeGoogleIdentity(clientId);
                activeCredentialHandler = handlerRef.current;

                const renderButton = () => {
                    if (!containerRef.current || !window.google?.accounts?.id) return;
                    const availableWidth = Math.floor(containerRef.current.getBoundingClientRect().width || 320);
                    const buttonWidth = Math.max(1, Math.min(400, availableWidth));
                    if (renderedWidth === buttonWidth && containerRef.current.childElementCount > 0) return;
                    renderedWidth = buttonWidth;
                    containerRef.current.replaceChildren();
                    window.google.accounts.id.renderButton(containerRef.current, {
                        type: 'standard',
                        theme: 'outline',
                        size: 'large',
                        text: 'continue_with',
                        locale: 'en',
                        shape: 'rectangular',
                        logo_alignment: 'left',
                        width: buttonWidth,
                    });
                };

                renderButton();
                resizeObserver = new ResizeObserver(renderButton);
                resizeObserver.observe(containerRef.current);
                setIsLoading(false);
            })
            .catch((error) => {
                if (!isMounted) return;
                setIsLoading(false);
                setErrorMessage(getUserFacingErrorMessage(
                    error,
                    'Continue with Google could not be loaded. Please refresh and try again.',
                    { context: 'Google Identity Services failed to load.' }
                ));
            });

        return () => {
            isMounted = false;
            resizeObserver?.disconnect();
            if (activeCredentialHandler === handlerRef.current) {
                activeCredentialHandler = null;
            }
        };
    }, [authenticate, clientId, loadAttempt, onAuthenticated, onOnboarding, onResult]);

    return (
        <div className="space-y-2">
            <div
                className={`relative flex min-h-11 w-full items-center justify-center ${isSubmitting ? 'pointer-events-none opacity-70' : ''}`}
                aria-busy={isLoading || isSubmitting}
            >
                <div ref={containerRef} className="flex w-full items-center justify-center" />
                {(isLoading || isSubmitting) && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-600">
                        <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                        {isSubmitting ? 'Signing in securely...' : 'Loading Google...'}
                    </div>
                )}
            </div>
            {errorMessage && (
                <div className="space-y-2 text-center">
                    <p className="text-xs leading-5 text-red-600" role="alert">
                        {errorMessage}
                    </p>
                    {!window.google?.accounts?.id && clientId ? (
                        <button
                            type="button"
                            className="text-xs font-bold text-[#155dfc] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155dfc] focus-visible:ring-offset-2"
                            onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                        >
                            Try loading Google again
                        </button>
                    ) : null}
                </div>
            )}
        </div>
    );
}
