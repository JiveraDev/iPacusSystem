import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent } from './dialog';
import { fetchProtectedImageObjectUrl, resolveImageUrl } from '../lib/image';

export function PhotoViewer({ src, alt, open, onOpenChange }) {
    const resolvedSrc = useMemo(() => resolveImageUrl(src) || '', [src]);
    const [displaySrc, setDisplaySrc] = useState('');
    const [failedSrc, setFailedSrc] = useState('');
    const hasImageError = failedSrc === displaySrc;

    useEffect(() => {
        let isActive = true;
        let objectUrl = '';

        if (!open || !src) {
            Promise.resolve().then(() => {
                if (isActive) {
                    setDisplaySrc('');
                    setFailedSrc('');
                }
            });
            return undefined;
        }

        Promise.resolve().then(() => {
            if (isActive) {
                setFailedSrc('');
            }
        });

        fetchProtectedImageObjectUrl(src)
            .then((nextSrc) => {
                if (!isActive) {
                    if (nextSrc?.startsWith('blob:')) {
                        URL.revokeObjectURL(nextSrc);
                    }
                    return;
                }

                objectUrl = nextSrc?.startsWith('blob:') ? nextSrc : '';
                setDisplaySrc(nextSrc || '');
            })
            .catch(() => {
                if (isActive) {
                    setDisplaySrc('');
                }
            });

        return () => {
            isActive = false;
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [open, src, resolvedSrc]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="theme-static-light max-w-4xl w-[90vw] h-[80vh] flex items-center justify-center p-0 bg-transparent border-none shadow-none">
                {displaySrc && !hasImageError ? (
                    <img
                        src={displaySrc}
                        alt={alt}
                        className="max-w-full max-h-full object-contain cursor-zoom-in"
                        onError={() => setFailedSrc(displaySrc)}
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
