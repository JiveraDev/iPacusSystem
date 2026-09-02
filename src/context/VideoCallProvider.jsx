import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Maximize2, Minimize2, Video, X } from 'lucide-react';
import { Button } from '../ui/button';
import { formatDisplayDateTime } from '../lib/date';
import { useNavigate } from '../components/dashboardRouter.jsx';
import { JaaSMeeting } from '../components/shared/JaaSMeeting.jsx';

const STORAGE_KEY = 'ipawcus-active-video-call';

const VideoCallContext = createContext(null);

function readStoredCallState() {
    try {
        const stored = sessionStorage.getItem(STORAGE_KEY);

        if (!stored) {
            return { activeCall: null, isMinimized: false };
        }

        const parsed = JSON.parse(stored);

        if (!parsed?.activeCall?.meetingUrl) {
            return { activeCall: null, isMinimized: false };
        }

        return {
            activeCall: parsed.activeCall,
            isMinimized: Boolean(parsed.isMinimized)
        };
    } catch {
        return { activeCall: null, isMinimized: false };
    }
}

function normalizeCall(call) {
    if (!call?.meetingUrl) {
        return null;
    }

    const consultationId = call.consultationId ?? call.onlineConsultationId ?? call.id;

    return {
        consultationId: consultationId ? String(consultationId) : '',
        role: call.role || 'pet_owner',
        meetingUrl: call.meetingUrl,
        meetingJwt: call.meetingJwt || '',
        meetingCode: call.meetingCode || '',
        title: call.title || 'Online Consultation',
        petName: call.petName || '',
        ownerName: call.ownerName || '',
        veterinarianName: call.veterinarianName || '',
        displayName: call.displayName || '',
        email: call.email || '',
        scheduledStart: call.scheduledStart || '',
        returnPath: call.returnPath || '',
        startedAt: new Date().toISOString()
    };
}

function isSameCall(currentCall, nextCall) {
    if (!currentCall || !nextCall) {
        return false;
    }

    if (currentCall.meetingUrl && currentCall.meetingUrl === nextCall.meetingUrl) {
        return true;
    }

    return Boolean(currentCall.consultationId && currentCall.consultationId === nextCall.consultationId);
}

export function VideoCallProvider({ children }) {
    const [callState, setCallState] = useState(readStoredCallState);
    const meetingRef = useRef(null);

    useEffect(() => {
        try {
            if (!callState.activeCall) {
                sessionStorage.removeItem(STORAGE_KEY);
                return;
            }

            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(callState));
        } catch {
            // Session persistence is a convenience only; the mounted iframe keeps the live call.
        }
    }, [callState]);

    const startCall = useCallback((call, options = {}) => {
        setCallState((current) => {
            const nextCall = normalizeCall(call);

            if (!nextCall) {
                return current;
            }

            const sameCall = isSameCall(current.activeCall, nextCall);
            const mergedCall = sameCall
                ? {
                    ...current.activeCall,
                    ...nextCall,
                    meetingJwt: current.activeCall.meetingJwt || nextCall.meetingJwt,
                    startedAt: current.activeCall.startedAt
                }
                : nextCall;

            return {
                activeCall: mergedCall,
                isMinimized: sameCall
                    ? current.isMinimized
                    : Boolean(options.minimized)
            };
        });
    }, []);

    const minimizeCall = useCallback(() => {
        setCallState((current) => ({ ...current, isMinimized: true }));
    }, []);

    const maximizeCall = useCallback(() => {
        setCallState((current) => ({ ...current, isMinimized: false }));
    }, []);

    const endCall = useCallback(() => {
        setCallState({ activeCall: null, isMinimized: false });
    }, []);

    const captureRemoteParticipant = useCallback(() => {
        if (!meetingRef.current?.captureRemoteParticipant) {
            return Promise.reject(new Error('The meeting is not ready for capture yet.'));
        }
        return meetingRef.current.captureRemoteParticipant();
    }, []);

    const value = useMemo(() => ({
        activeCall: callState.activeCall,
        isMinimized: callState.isMinimized,
        startCall,
        minimizeCall,
        maximizeCall,
        endCall,
        captureRemoteParticipant
    }), [callState.activeCall, callState.isMinimized, captureRemoteParticipant, endCall, maximizeCall, minimizeCall, startCall]);

    return (
        <VideoCallContext.Provider value={value}>
            {children}
            <FloatingVideoCall meetingRef={meetingRef} />
        </VideoCallContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useVideoCall() {
    const context = useContext(VideoCallContext);

    if (!context) {
        throw new Error('useVideoCall must be used inside VideoCallProvider');
    }

    return context;
}

function FloatingVideoCall({ meetingRef }) {
    const navigate = useNavigate();
    const { activeCall, isMinimized, minimizeCall, maximizeCall, endCall } = useVideoCall();
    const [dockRect, setDockRect] = useState(null);
    const currentPath = typeof window === 'undefined' ? '' : window.location.pathname;

    useEffect(() => {
        let animationFrame = null;
        let resizeObserver = null;

        const scheduleRect = (nextRect) => {
            if (animationFrame !== null) {
                window.cancelAnimationFrame(animationFrame);
            }

            animationFrame = window.requestAnimationFrame(() => {
                setDockRect((current) => {
                    if (
                        current?.top === nextRect?.top
                        && current?.left === nextRect?.left
                        && current?.width === nextRect?.width
                        && current?.height === nextRect?.height
                    ) {
                        return current;
                    }

                    return nextRect;
                });
            });
        };

        if (!activeCall?.consultationId || isMinimized) {
            scheduleRect(null);
            return () => {
                if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
            };
        }

        const dockTarget = Array.from(document.querySelectorAll('[data-video-call-dock]')).find(
            (element) => element.dataset.videoCallDock === String(activeCall.consultationId)
        );

        if (!dockTarget) {
            scheduleRect(null);
            return () => {
                if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
            };
        }

        const updateDockRect = () => {
            if (!dockTarget.isConnected) {
                scheduleRect(null);
                return;
            }

            const rect = dockTarget.getBoundingClientRect();
            scheduleRect({
                top: Math.round(rect.top),
                left: Math.round(rect.left),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
            });
        };

        updateDockRect();
        resizeObserver = new ResizeObserver(updateDockRect);
        resizeObserver.observe(dockTarget);
        window.addEventListener('resize', updateDockRect);
        window.addEventListener('scroll', updateDockRect, true);

        return () => {
            if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
            resizeObserver?.disconnect();
            window.removeEventListener('resize', updateDockRect);
            window.removeEventListener('scroll', updateDockRect, true);
        };
    }, [activeCall?.consultationId, currentPath, isMinimized]);

    useEffect(() => {
        if (!activeCall?.meetingUrl || isMinimized || !activeCall.returnPath) {
            return undefined;
        }

        const hasDockTarget = Array.from(document.querySelectorAll('[data-video-call-dock]')).some(
            (element) => element.dataset.videoCallDock === String(activeCall.consultationId)
        );
        if (hasDockTarget) {
            return undefined;
        }

        const minimizeFrame = window.requestAnimationFrame(minimizeCall);
        return () => window.cancelAnimationFrame(minimizeFrame);
    }, [activeCall?.consultationId, activeCall?.meetingUrl, activeCall?.returnPath, currentPath, isMinimized, minimizeCall]);

    if (!activeCall?.meetingUrl) {
        return null;
    }

    const participantName = activeCall.role === 'veterinarian'
        ? activeCall.ownerName
        : activeCall.veterinarianName;
    const subtitle = [
        activeCall.petName || 'Online consultation',
        participantName,
        activeCall.scheduledStart ? formatDisplayDateTime(activeCall.scheduledStart) : ''
    ].filter(Boolean).join(' • ');
    const callTitle = activeCall.petName
        ? `${activeCall.petName} consultation`
        : activeCall.title;
    const isDocked = Boolean(dockRect) && !isMinimized;
    const shellClassName = isMinimized
        ? 'group fixed right-3 top-20 z-[70] aspect-video w-44 overflow-hidden rounded-2xl border border-white/20 bg-black text-white shadow-2xl ring-1 ring-slate-950/20 transition-[width,height,transform] duration-200 sm:right-5 sm:top-5 sm:w-60'
        : isDocked
            ? 'fixed z-[35] overflow-hidden rounded-xl bg-black text-white shadow-inner'
            : 'fixed inset-2 z-[70] overflow-hidden rounded-xl border border-slate-700 bg-[#0f172a] text-white shadow-2xl transition-all duration-300 sm:inset-4 lg:inset-6';
    const shellStyle = isDocked
        ? {
            top: `${dockRect.top}px`,
            left: `${dockRect.left}px`,
            width: `${dockRect.width}px`,
            height: `${dockRect.height}px`
        }
        : undefined;

    const openWorkspace = () => {
        if (activeCall.returnPath) {
            navigate(activeCall.returnPath);
        }
    };

    const restoreCall = () => {
        openWorkspace();
        window.requestAnimationFrame(maximizeCall);
    };

    return (
        <section className={shellClassName} style={shellStyle} aria-label="Active online consultation">
            <div className="relative flex h-full min-h-0 flex-col">
                {!isMinimized && !isDocked && (
                    <header className="flex min-h-14 items-center gap-3 border-b border-white/10 px-3 py-2 sm:px-4">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-100">
                            <Video className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{callTitle}</p>
                            <p className="truncate text-xs text-white/60">{subtitle || activeCall.meetingCode || 'Live room'}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                            {activeCall.returnPath && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={openWorkspace}
                                    className="size-9 text-white hover:bg-white/10"
                                    aria-label="Open consultation workspace"
                                    title="Open consultation workspace"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                            )}
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={minimizeCall}
                                className="size-9 text-white hover:bg-white/10"
                                aria-label="Minimize call"
                                title="Minimize call"
                            >
                                <Minimize2 className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={endCall}
                                className="size-9 shrink-0 rounded-full border border-red-400/40 bg-red-600 text-white shadow-sm hover:bg-red-700 hover:text-white focus-visible:ring-red-300"
                                aria-label="Close call"
                                title="Close call"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </header>
                )}

                <div className="min-h-0 flex-1 bg-black">
                    <JaaSMeeting
                        ref={meetingRef}
                        key={activeCall.meetingUrl}
                        title="8x8 JaaS online consultation"
                        meetingUrl={activeCall.meetingUrl}
                        jwt={activeCall.meetingJwt}
                        displayName={activeCall.displayName}
                        email={activeCall.email}
                        onConferenceLeft={endCall}
                        compact={isMinimized}
                        className={isMinimized ? 'pointer-events-none select-none' : ''}
                    />
                </div>

                {isMinimized && (
                    <button
                        type="button"
                        onClick={restoreCall}
                        className="absolute inset-0 cursor-pointer bg-gradient-to-t from-black/35 via-transparent to-black/10 opacity-100 outline-none ring-inset transition hover:from-black/50 focus-visible:ring-2 focus-visible:ring-blue-400"
                        aria-label={`Return to ${callTitle}`}
                        title="Return to consultation"
                    >
                        <span className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full border border-white/20 bg-black/65 text-white shadow-lg backdrop-blur">
                            <Maximize2 className="size-4" aria-hidden="true" />
                        </span>
                        <span className="absolute bottom-2 left-2 size-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(0,0,0,0.35)]" aria-hidden="true" />
                    </button>
                )}

                {!isMinimized && !isDocked && (
                    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-3 text-xs text-white/60">
                        <span className="truncate">{activeCall.meetingCode || 'Private consultation room'}</span>
                        <div className="flex items-center gap-2">
                            {activeCall.returnPath && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={openWorkspace}
                                    className="text-white hover:bg-white/10"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                    Workspace
                                </Button>
                            )}
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={minimizeCall}
                                className="text-white hover:bg-white/10"
                            >
                                <Minimize2 className="h-4 w-4" />
                                Minimize
                            </Button>
                        </div>
                    </footer>
                )}
            </div>
        </section>
    );
}
