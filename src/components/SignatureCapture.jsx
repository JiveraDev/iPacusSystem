import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, LockKeyhole, PenLine } from 'lucide-react';

const INK_COLOR = '#0f172a';
const INK_WIDTH = 2.5;

function configureContext(canvas) {
    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = INK_COLOR;
    context.fillStyle = INK_COLOR;
    context.lineWidth = INK_WIDTH;
    return context;
}

function drawStoredSignature(canvas, signature) {
    const context = configureContext(canvas);
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const width = canvas.width / ratio;
    const height = canvas.height / ratio;

    context.clearRect(0, 0, width, height);
    if (!signature) {
        return;
    }

    const image = new Image();
    image.onload = () => {
        context.clearRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
    };
    image.src = signature;
}

export default function SignatureCapture({ onSignatureChange, signature, disabled = false }) {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const drawingRef = useRef(false);
    const movedRef = useRef(false);
    const signatureRef = useRef(signature || '');
    const [isDrawing, setIsDrawing] = useState(false);
    const hasInk = Boolean(signature) || isDrawing;

    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) {
            return;
        }

        const rect = container.getBoundingClientRect();
        const width = Math.max(1, Math.round(rect.width));
        const height = Math.max(1, Math.round(rect.height));
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const nextWidth = Math.round(width * ratio);
        const nextHeight = Math.round(height * ratio);

        if (canvas.width === nextWidth && canvas.height === nextHeight) {
            return;
        }

        canvas.width = nextWidth;
        canvas.height = nextHeight;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const context = canvas.getContext('2d');
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        drawStoredSignature(canvas, signatureRef.current);
    }, []);

    useEffect(() => {
        resizeCanvas();

        const container = containerRef.current;
        if (!container || typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', resizeCanvas);
            return () => window.removeEventListener('resize', resizeCanvas);
        }

        const observer = new ResizeObserver(resizeCanvas);
        observer.observe(container);
        return () => observer.disconnect();
    }, [resizeCanvas]);

    useEffect(() => {
        const nextSignature = signature || '';
        if (nextSignature === signatureRef.current) {
            return;
        }

        signatureRef.current = nextSignature;
        if (canvasRef.current) {
            drawStoredSignature(canvasRef.current, nextSignature);
        }
    }, [signature]);

    const pointerPosition = (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
    };

    const startDrawing = (event) => {
        if (disabled || event.button !== 0) {
            return;
        }

        event.preventDefault();
        const canvas = event.currentTarget;
        const point = pointerPosition(event);
        const context = configureContext(canvas);

        canvas.focus();
        canvas.setPointerCapture(event.pointerId);
        context.beginPath();
        context.moveTo(point.x, point.y);
        drawingRef.current = true;
        movedRef.current = false;
        setIsDrawing(true);
    };

    const continueDrawing = (event) => {
        if (!drawingRef.current || disabled) {
            return;
        }

        event.preventDefault();
        const canvas = event.currentTarget;
        const point = pointerPosition(event);
        const context = configureContext(canvas);
        context.lineTo(point.x, point.y);
        context.stroke();
        movedRef.current = true;
    };

    const finishDrawing = (event) => {
        if (!drawingRef.current) {
            return;
        }

        event.preventDefault();
        const canvas = event.currentTarget;
        const context = configureContext(canvas);

        if (!movedRef.current) {
            const point = pointerPosition(event);
            context.beginPath();
            context.arc(point.x, point.y, INK_WIDTH / 2, 0, Math.PI * 2);
            context.fill();
        }

        context.closePath();
        drawingRef.current = false;
        setIsDrawing(false);

        if (canvas.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
        }

        const dataUrl = canvas.toDataURL('image/png');
        signatureRef.current = dataUrl;
        onSignatureChange?.(dataUrl);
    };

    return (
        <div className="w-full">
            <div
                ref={containerRef}
                className={`relative h-52 overflow-hidden rounded-xl border-2 bg-white shadow-sm transition-[border-color,box-shadow] duration-200 sm:h-60 ${
                    disabled
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900'
                        : isDrawing
                            ? 'border-[#155dfc] shadow-[0_0_0_4px_rgba(21,93,252,0.12)]'
                            : hasInk
                                ? 'border-blue-200 dark:border-blue-800'
                                : 'border-dashed border-slate-300 hover:border-blue-300 dark:border-slate-600 dark:hover:border-blue-700'
                }`}
            >
                <canvas
                    ref={canvasRef}
                    role="img"
                    aria-label={disabled ? 'Signature area unavailable' : 'Draw your signature inside this area'}
                    aria-disabled={disabled}
                    tabIndex={disabled ? -1 : 0}
                    onPointerDown={startDrawing}
                    onPointerMove={continueDrawing}
                    onPointerUp={finishDrawing}
                    onPointerCancel={finishDrawing}
                    onContextMenu={(event) => event.preventDefault()}
                    className={`absolute inset-0 size-full touch-none select-none outline-none transition-opacity focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-blue-200 ${
                        disabled ? 'pointer-events-none opacity-35' : 'cursor-crosshair opacity-100'
                    }`}
                />

                {!hasInk && !disabled && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-slate-400">
                        <span className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                            <PenLine className="size-5" aria-hidden="true" />
                        </span>
                        <p className="mt-3 text-sm font-bold text-slate-600">Sign inside this box</p>
                        <p className="mt-1 text-xs font-medium text-slate-400">Use your finger, stylus, or mouse</p>
                    </div>
                )}

                {disabled && !hasInk && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                        <LockKeyhole className="size-6 text-amber-500" aria-hidden="true" />
                        <p className="mt-2 text-sm font-bold text-slate-600 dark:text-slate-300">Signature unavailable</p>
                        <p className="mt-1 text-xs font-medium text-slate-400">Complete the required consent step first.</p>
                    </div>
                )}

                {hasInk && !disabled && (
                    <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/95 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700 shadow-sm">
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        Signature captured
                    </div>
                )}

                <div className="pointer-events-none absolute inset-x-6 bottom-5 border-b border-slate-200" aria-hidden="true" />
            </div>
        </div>
    );
}
