import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '../../ui/button';

const scriptLoads = new Map();
const MEETING_TOOLBAR_BUTTONS = [
    'microphone',
    'camera',
    'desktop',
    'chat',
    'raisehand',
    'tileview',
    'select-background',
    'settings',
    'hangup'
];

function applyMeetingDisplayMode(api, compact) {
    if (!api || typeof api.executeCommand !== 'function') return;

    try {
        api.executeCommand('overwriteConfig', {
            toolbarButtons: compact ? [] : MEETING_TOOLBAR_BUTTONS
        });
    } catch (error) {
        console.warn('Could not update the compact 8x8 meeting controls:', error);
    }
}

function parseJaaSMeetingUrl(meetingUrl) {
    try {
        const url = new URL(meetingUrl);
        if (url.hostname.toLowerCase() !== '8x8.vc') {
            return null;
        }

        const segments = url.pathname.split('/').filter(Boolean);
        if (segments.length < 2) {
            return null;
        }

        const [appId, ...roomSegments] = segments;
        const room = roomSegments.map(decodeURIComponent).join('/');

        if (!appId.startsWith('vpaas-magic-cookie-') || !room) {
            return null;
        }

        return {
            appId,
            roomName: `${appId}/${room}`,
            scriptUrl: `https://8x8.vc/${appId}/external_api.js`
        };
    } catch {
        return null;
    }
}

function findExternalApiScript(scriptUrl) {
    return Array.from(document.scripts).find(
        (script) => script.dataset.jaasExternalApi === scriptUrl
    );
}

function loadJaaSExternalApi(scriptUrl) {
    if (typeof window.JitsiMeetExternalAPI === 'function') {
        return Promise.resolve();
    }

    if (scriptLoads.has(scriptUrl)) {
        return scriptLoads.get(scriptUrl);
    }

    const loadPromise = new Promise((resolve, reject) => {
        const existingScript = findExternalApiScript(scriptUrl);
        const script = existingScript || document.createElement('script');

        const handleLoad = () => {
            if (typeof window.JitsiMeetExternalAPI !== 'function') {
                reject(new Error('The 8x8 meeting library loaded without exposing the IFrame API.'));
                return;
            }

            script.dataset.jaasLoaded = 'true';
            resolve();
        };
        const handleError = () => {
            reject(new Error('The 8x8 meeting library could not be loaded.'));
        };

        script.addEventListener('load', handleLoad, { once: true });
        script.addEventListener('error', handleError, { once: true });

        if (!existingScript) {
            script.src = scriptUrl;
            script.async = true;
            script.dataset.jaasExternalApi = scriptUrl;
            document.head.appendChild(script);
        } else if (script.dataset.jaasLoaded === 'true') {
            handleLoad();
        }
    }).catch((error) => {
        scriptLoads.delete(scriptUrl);
        throw error;
    });

    scriptLoads.set(scriptUrl, loadPromise);
    return loadPromise;
}

function resetJaaSExternalApi(scriptUrl) {
    scriptLoads.delete(scriptUrl);

    const script = findExternalApiScript(scriptUrl);
    if (script && typeof window.JitsiMeetExternalAPI !== 'function') {
        script.remove();
    }
}

export function JaaSMeeting({
    meetingUrl,
    jwt = '',
    displayName = '',
    email = '',
    title = 'Online consultation',
    onConferenceLeft,
    compact = false,
    className = ''
}) {
    const parentNodeRef = useRef(null);
    const apiRef = useRef(null);
    const compactRef = useRef(compact);
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [status, setStatus] = useState('loading');
    const [errorMessage, setErrorMessage] = useState('');
    const jaasMeeting = useMemo(() => parseJaaSMeetingUrl(meetingUrl), [meetingUrl]);

    useEffect(() => {
        if (!jaasMeeting) {
            return undefined;
        }

        let disposed = false;
        let api = null;

        loadJaaSExternalApi(jaasMeeting.scriptUrl)
            .then(() => {
                if (disposed || !parentNodeRef.current) {
                    return;
                }

                parentNodeRef.current.replaceChildren();
                const options = {
                    roomName: jaasMeeting.roomName,
                    parentNode: parentNodeRef.current,
                    width: '100%',
                    height: '100%',
                    configOverwrite: {
                        prejoinPageEnabled: false,
                        toolbarButtons: compactRef.current ? [] : MEETING_TOOLBAR_BUTTONS
                    }
                };

                if (jwt) {
                    options.jwt = jwt;
                } else if (displayName || email) {
                    options.userInfo = {
                        displayName: displayName || undefined,
                        email: email || undefined
                    };
                }

                api = new window.JitsiMeetExternalAPI('8x8.vc', options);
                apiRef.current = api;
                applyMeetingDisplayMode(api, compactRef.current);

                const handleConferenceLeft = () => {
                    if (!disposed) {
                        onConferenceLeft?.();
                    }
                };

                api.addEventListener('videoConferenceLeft', handleConferenceLeft);
                api.addEventListener('readyToClose', handleConferenceLeft);
                setStatus('ready');
            })
            .catch((error) => {
                if (disposed) return;

                console.error('Failed to initialize 8x8 JaaS:', error);
                setErrorMessage('The video meeting could not be opened. Please try again.');
                setStatus('error');
            });

        return () => {
            disposed = true;
            if (api) {
                api.dispose();
            }
            if (apiRef.current === api) {
                apiRef.current = null;
            }
        };
    }, [displayName, email, jaasMeeting, jwt, loadAttempt, onConferenceLeft]);

    useEffect(() => {
        compactRef.current = compact;
        applyMeetingDisplayMode(apiRef.current, compact);
    }, [compact]);

    if (!jaasMeeting) {
        return (
            <iframe
                title={title}
                src={meetingUrl}
                allow="camera; microphone; fullscreen; display-capture; autoplay"
                className={`h-full w-full border-0 ${className}`}
            />
        );
    }

    const retry = () => {
        resetJaaSExternalApi(jaasMeeting.scriptUrl);
        setStatus('loading');
        setErrorMessage('');
        setLoadAttempt((attempt) => attempt + 1);
    };

    return (
        <div className={`relative h-full w-full bg-black ${className}`} aria-label={title}>
            <div ref={parentNodeRef} className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full [&>iframe]:border-0" />

            {status === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-white">
                    <div className="flex items-center gap-3 text-sm font-medium text-white/80">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Connecting to 8x8 JaaS...
                    </div>
                </div>
            )}

            {status === 'error' && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950 p-6 text-center text-white">
                    <div className="max-w-sm">
                        <TriangleAlert className="mx-auto h-9 w-9 text-amber-300" />
                        <p className="mt-3 text-sm font-semibold">Meeting connection failed</p>
                        <p className="mt-1 text-xs leading-5 text-white/60">{errorMessage}</p>
                        <Button
                            type="button"
                            size="sm"
                            onClick={retry}
                            className="mt-4 bg-blue-600 text-white hover:bg-blue-700"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Try again
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
