import { useState } from 'react';
import { Eye, ImageOff, Loader2 } from 'lucide-react';
import ProtectedImage from './ProtectedImage.jsx';

export default function UploadImagePreview({
    src,
    alt,
    onPreview,
    imageClassName = 'size-full object-cover'
}) {
    const [image, setImage] = useState({ source: null, status: 'loading' });
    const status = image.source === src ? image.status : src ? 'loading' : 'failed';
    const isReady = status === 'ready';
    const hasFailed = status === 'failed';

    return (
        <button
            type="button"
            onClick={() => isReady && onPreview?.(src)}
            disabled={!isReady}
            className="group relative block size-full overflow-hidden bg-slate-50 text-left disabled:cursor-default"
            aria-label={`View ${alt}`}
        >
            {!isReady && !hasFailed && (
                <span className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-xs font-semibold text-slate-400">
                    <Loader2 className="size-5 animate-spin" />
                    Loading preview
                </span>
            )}
            {hasFailed && (
                <span className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-3 text-center text-xs font-semibold text-amber-700">
                    <ImageOff className="size-5" />
                    Preview unavailable
                </span>
            )}
            <ProtectedImage
                src={src}
                alt={alt}
                className={`${imageClassName} transition ${isReady ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setImage({ source: src, status: 'ready' })}
                onLoadError={() => setImage({ source: src, status: 'failed' })}
            />
            {isReady && (
                <span className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1 rounded-md bg-slate-950/75 px-2 py-1 text-xs font-bold text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
                    <Eye className="size-3" />
                    View
                </span>
            )}
        </button>
    );
}
