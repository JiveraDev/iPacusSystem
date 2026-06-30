import { useMemo, useState } from 'react';
import { Dialog, DialogContent } from './dialog';
import { resolveImageUrl } from '../lib/image';

export function PhotoViewer({ src, alt, open, onOpenChange }) {
    const resolvedSrc = useMemo(() => resolveImageUrl(src) || '', [src]);
    const [failedSrc, setFailedSrc] = useState('');
    const hasImageError = failedSrc === resolvedSrc;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="theme-static-light max-w-4xl w-[90vw] h-[80vh] flex items-center justify-center p-0 bg-transparent border-none shadow-none">
                {resolvedSrc && !hasImageError ? (
                    <img
                        src={resolvedSrc}
                        alt={alt}
                        className="max-w-full max-h-full object-contain cursor-zoom-in"
                        onError={() => setFailedSrc(resolvedSrc)}
                    />
                ) : (
                    <div className="rounded-lg bg-white px-5 py-4 text-center text-sm font-semibold text-slate-600 shadow">
                        Image preview is unavailable.
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
