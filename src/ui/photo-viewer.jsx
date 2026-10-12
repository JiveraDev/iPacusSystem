import { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Dialog, DialogContent } from './dialog';
import { fetchProtectedImageObjectUrl } from '../lib/image';

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
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="theme-static-light flex h-[80vh] w-[90vw] max-w-4xl flex-col gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 pt-14 shadow-2xl sm:p-5 sm:pt-14">
                <PhotoViewerContent key={src || ''} src={src} alt={alt} />
            </DialogContent>
        </Dialog>
    );
}

function PhotoViewerContent({ src, alt }) {
    const [image, setImage] = useState({ url: '', status: src ? 'loading' : 'unavailable' });
    const isReady = image.status === 'ready' && Boolean(image.url);

    useEffect(() => {
        let isActive = true;
        let objectUrl = '';

        if (!src) return undefined;
        const controller = new AbortController();

        fetchProtectedImageObjectUrl(src, { signal: controller.signal })
            .then((nextSrc) => {
                const ownedObjectUrl = nextSrc?.startsWith('blob:') && nextSrc !== String(src).trim() ? nextSrc : '';
                if (!isActive) {
                    if (ownedObjectUrl) URL.revokeObjectURL(ownedObjectUrl);
                    return;
                }

                objectUrl = ownedObjectUrl;
                setImage({ url: nextSrc || '', status: nextSrc ? 'ready' : 'unavailable' });
            })
            .catch(() => {
                if (isActive) setImage({ url: '', status: 'unavailable' });
            });

        return () => {
            isActive = false;
            controller.abort();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [src]);

    const handleDownload = () => {
        if (!isReady) return;

        const link = document.createElement('a');
        link.href = image.url;
        link.download = downloadFileName(src, alt);
        link.rel = 'noreferrer';
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    return (
        <>
            <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-lg bg-slate-100 p-2">
                {isReady ? (
                    <img
                        src={image.url}
                        alt={alt}
                        className="max-h-full max-w-full cursor-zoom-in object-contain"
                        onError={() => setImage({ url: '', status: 'unavailable' })}
                    />
                ) : (
                    <div role="status" className="flex items-center gap-2 rounded-lg bg-white px-5 py-4 text-center text-sm font-semibold text-slate-600 shadow">
                        {image.status === 'loading' && <Loader2 className="size-4 animate-spin" />}
                        {image.status === 'loading' ? 'Loading image preview...' : 'Image preview is unavailable.'}
                    </div>
                )}
            </div>
            {isReady ? (
                <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-black text-slate-800 shadow transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#155dfc] focus:ring-offset-2"
                >
                    <Download className="size-4" />
                    Download image
                </button>
            ) : null}
        </>
    );
}
