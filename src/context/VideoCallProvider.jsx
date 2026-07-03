import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Maximize2, Minimize2, PhoneOff, Video } from 'lucide-react';
import { Button } from '../ui/button';
import { formatDisplayDateTime } from '../lib/date';
import { useNavigate } from '../components/dashboardRouter.jsx';

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

function normalizeCall(call, currentCall) {
    if (!call?.meetingUrl) {
        return null;
    }

    const consultationId = call.consultationId ?? call.onlineConsultationId ?? call.id;

    return {
        consultationId: consultationId ? String(consultationId) : '',
        role: call.role || currentCall?.role || 'pet_owner',
        meetingUrl: call.meetingUrl,
        meetingCode: call.meetingCode || '',
        title: call.title || currentCall?.title || 'Online Consultation',
        petName: call.petName || '',
        ownerName: call.ownerName || '',
        veterinarianName: call.veterinarianName || '',
        scheduledStart: call.scheduledStart || '',
        returnPath: call.returnPath || currentCall?.returnPath || '',
        startedAt: currentCall?.startedAt || new Date().toISOString()
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
            const nextCall = normalizeCall(call, current.activeCall);

            if (!nextCall) {
                return current;
            }

            const sameCall = isSameCall(current.activeCall, nextCall);
            const mergedCall = sameCall
                ? { ...current.activeCall, ...nextCall, startedAt: current.activeCall.startedAt }
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

    const value = useMemo(() => ({
        activeCall: callState.activeCall,
        isMinimized: callState.isMinimized,
        startCall,
        minimizeCall,
        maximizeCall,
        endCall
    }), [callState.activeCall, callState.isMinimized, endCall, maximizeCall, minimizeCall, startCall]);

    return (
        <VideoCallContext.Provider value={value}>
            {children}
            <FloatingVideoCall />
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

function FloatingVideoCall() {
    const navigate = useNavigate();
    const { activeCall, isMinimized, minimizeCall, maximizeCall, endCall } = useVideoCall();

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
    const shellClassName = isMinimized
        ? 'fixed bottom-3 left-3 right-3 z-[70] h-[18rem] overflow-hidden rounded-lg border border-slate-700 bg-[#0f172a] text-white shadow-2xl transition-all duration-300 sm:left-auto sm:h-[17rem] sm:w-[22rem]'
        : 'fixed inset-2 z-[70] overflow-hidden rounded-lg border border-slate-700 bg-[#0f172a] text-white shadow-2xl transition-all duration-300 sm:inset-4 lg:inset-6';
    const videoClassName = isMinimized
        ? 'h-[10.5rem] min-h-0 flex-1 bg-black sm:h-[9.5rem]'
        : 'min-h-0 flex-1 bg-black';

    const openWorkspace = () => {
        if (activeCall.returnPath) {
            navigate(activeCall.returnPath);
        }
    };

    return (
        <section className={shellClassName} aria-label="Active online consultation">
            <div className="flex h-full min-h-0 flex-col">
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
                            onClick={isMinimized ? maximizeCall : minimizeCall}
                            className="size-9 text-white hover:bg-white/10"
                            aria-label={isMinimized ? 'Expand call' : 'Minimize call'}
                            title={isMinimized ? 'Expand call' : 'Minimize call'}
                        >
                            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={endCall}
                            className="size-9 text-red-100 hover:bg-red-500/20 hover:text-white"
                            aria-label="Leave call"
                            title="Leave call"
                        >
                            <PhoneOff className="h-4 w-4" />
                        </Button>
                    </div>
                </header>

                <div className={videoClassName}>
                    <iframe
                        title="Jitsi online consultation"
                        src={activeCall.meetingUrl}
                        allow="camera; microphone; fullscreen; display-capture; autoplay"
                        className="h-full w-full border-0"
                    />
                </div>

                {!isMinimized && (
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
