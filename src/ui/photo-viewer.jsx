import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Dialog, DialogContent } from './dialog';
import { fetchProtectedImageObjectUrl, resolveImageUrl } from '../lib/image';

function downloadFileName(src, alt) {
    const sourcePath = String(src || '').split(/[?#]/)[0];
    const sourceExtension = sourcePath.match(/\.(png|jpe?g|gif|webp)$/i)?.[1]?.toLowerCase();
    const extension = sourceExtension === 'jpeg' ? 'jpg' : (sourceExtension || 'png');
    const baseName = String(alt || 'image')
        .trim()
        .replace(/[^a-z0-9_-]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase() || 'image';

    return `${baseName}.${extension}`;
}

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

    const handleDownload = () => {
        if (!displaySrc || hasImageError) {
            return;
        }

        const link = document.createElement('a');
        link.href = displaySrc;
        link.download = downloadFileName(src, alt);
        link.rel = 'noreferrer';
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="theme-static-light flex h-[80vh] w-[90vw] max-w-4xl flex-col items-center justify-center gap-3 border-none bg-transparent p-0 shadow-none">
                <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                    {displaySrc && !hasImageError ? (
                        <img
                            src={displaySrc}
                            alt={alt}
                            className="max-h-full max-w-full cursor-zoom-in object-contain"
                            onError={() => setFailedSrc(displaySrc)}
                        />
                    ) : (
                        <div className="rounded-lg bg-white px-5 py-4 text-center text-sm font-semibold text-slate-600 shadow">
                            Image preview is unavailable.
                        </div>
                    )}
                </div>
                {displaySrc && !hasImageError ? (
                    <button
                        type="button"
                        onClick={handleDownload}
                        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-black text-slate-800 shadow transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#155dfc] focus:ring-offset-2"
                    >
                        <Download className="size-4" />
                        Download image
                    </button>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
