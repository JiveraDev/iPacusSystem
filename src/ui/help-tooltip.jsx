import PropTypes from 'prop-types';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp } from 'lucide-react';

export default function HelpTooltip({ children, label }) {
    const [open, setOpen] = useState(false);
    const [instant, setInstant] = useState(false);
    const [position, setPosition] = useState(null);
    const helpId = useId();
    const triggerRef = useRef(null);
    const tooltipRef = useRef(null);
    const closeTimer = useRef(null);
    const pinned = useRef(false);
    const keyboardFocus = useRef(false);
    const dismissed = useRef(false);

    const cancelClose = useCallback(() => {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
    }, []);

    const dismiss = useCallback(() => {
        cancelClose();
        pinned.current = false;
        dismissed.current = true;
        setOpen(false);
    }, [cancelClose]);

    const leave = () => {
        dismissed.current = false;
        cancelClose();
        if (!pinned.current && !keyboardFocus.current) {
            // Allow the pointer to cross the small gap into the floating text.
            closeTimer.current = window.setTimeout(() => setOpen(false), 120);
        }
    };

    useEffect(() => cancelClose, [cancelClose]);

    useLayoutEffect(() => {
        if (!open) return undefined;
        const place = () => {
            const trigger = triggerRef.current;
            const tooltip = tooltipRef.current;
            if (!trigger || !tooltip) return;
            const rect = trigger.getBoundingClientRect();
            const margin = 8;
            const gap = 6;
            const width = Math.min(336, window.innerWidth - margin * 2);
            const below = window.innerHeight - rect.bottom - margin - gap;
            const above = rect.top - margin - gap;
            const height = Math.min(tooltip.scrollHeight, 256);
            const flip = height > below && above > below;
            const maxHeight = Math.max(0, Math.min(256, flip ? above : below));
            const top = flip ? rect.top - Math.min(height, maxHeight) - gap : rect.bottom + gap;
            if (rect.bottom <= 0 || rect.top >= window.innerHeight) {
                dismiss();
                return;
            }
            setPosition({
                top: Math.max(margin, top),
                left: Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin)),
                width,
                maxHeight,
            });
        };
        place();
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
        observer?.observe(tooltipRef.current);
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
        };
    }, [dismiss, open, children]);

    useEffect(() => {
        if (!open) return undefined;
        const outside = (event) => {
            if (!triggerRef.current?.contains(event.target) && !tooltipRef.current?.contains(event.target)) dismiss();
        };
        const escape = (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            dismiss();
        };
        document.addEventListener('pointerdown', outside);
        document.addEventListener('keydown', escape, true);
        return () => {
            document.removeEventListener('pointerdown', outside);
            document.removeEventListener('keydown', escape, true);
        };
    }, [dismiss, open]);

    const visible = open && Boolean(position);
    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                aria-label={label}
                aria-expanded={open}
                aria-controls={open ? helpId : undefined}
                aria-describedby={open ? helpId : undefined}
                onPointerEnter={(event) => {
                    if (event.pointerType === 'touch' || dismissed.current) return;
                    cancelClose();
                    setInstant(false);
                    setOpen(true);
                }}
                onPointerLeave={leave}
                onFocus={(event) => {
                    keyboardFocus.current = event.currentTarget.matches(':focus-visible');
                    if (keyboardFocus.current) {
                        setInstant(true);
                        dismissed.current = false;
                        cancelClose();
                        setOpen(true);
                    }
                }}
                onBlur={(event) => {
                    keyboardFocus.current = false;
                    if (!tooltipRef.current?.contains(event.relatedTarget) && !tooltipRef.current?.matches(':hover')) dismiss();
                }}
                onClick={(event) => {
                    setInstant(event.detail === 0);
                    if (pinned.current) dismiss();
                    else {
                        cancelClose();
                        dismissed.current = false;
                        pinned.current = true;
                        setOpen(true);
                    }
                }}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
                <CircleHelp className="size-4" aria-hidden="true" />
            </button>
            {typeof document !== 'undefined' && createPortal(
                <div
                    ref={tooltipRef}
                    id={helpId}
                    role="tooltip"
                    aria-hidden={!open}
                    onPointerEnter={cancelClose}
                    onPointerLeave={leave}
                    className="fixed z-[2400] w-[min(21rem,calc(100vw-1rem))] max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-600 shadow-md [transition-property:opacity,visibility] motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    style={{
                        ...position,
                        opacity: visible ? 1 : 0,
                        visibility: visible ? 'visible' : 'hidden',
                        pointerEvents: visible ? 'auto' : 'none',
                        transitionDuration: instant ? '0ms, 0ms' : '120ms, 0ms',
                        transitionDelay: visible || instant ? '0ms, 0ms' : '0ms, 120ms',
                        transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)',
                    }}
                >
                    {children}
                </div>,
                document.body,
            )}
        </>
    );
}

HelpTooltip.propTypes = {
    children: PropTypes.node.isRequired,
    label: PropTypes.string.isRequired,
};
