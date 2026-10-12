import { useEffect, useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { fetchProtectedImageObjectUrl } from '../../lib/image';

export default function ProtectedImage(props) {
    return <ProtectedImageSource key={props.src || ''} {...props} />;
}

function ProtectedImageSource({
    src,
    alt = '',
    className = '',
    fallbackClassName = '',
    onError,
    onLoadError,
    ...props
}) {
    const [image, setImage] = useState({ source: null, url: '', status: 'loading' });
    const onLoadErrorRef = useRef(onLoadError);
    const currentImage = !src ? { url: '', status: 'unavailable' } : image.source === src ? image : { url: '', status: 'loading' };

    useEffect(() => {
        onLoadErrorRef.current = onLoadError;
    }, [onLoadError]);

    useEffect(() => {
        let isActive = true;
        let objectUrl = '';
        if (!src) return undefined;
        const controller = new AbortController();

        fetchProtectedImageObjectUrl(src, { signal: controller.signal })
            .then((nextSrc) => {
                // Local previews belong to their form. Only release blobs fetched here.
                const ownedObjectUrl = nextSrc?.startsWith('blob:') && nextSrc !== String(src).trim() ? nextSrc : '';
                if (!isActive) {
                    if (ownedObjectUrl) URL.revokeObjectURL(ownedObjectUrl);
                    return;
                }
                objectUrl = ownedObjectUrl;
                setImage({ source: src, url: nextSrc || '', status: nextSrc ? 'ready' : 'unavailable' });
            })
            .catch(() => {
                if (isActive) {
                    setImage({ source: src, url: '', status: 'unavailable' });
                    onLoadErrorRef.current?.();
                }
            });

        return () => {
            isActive = false;
            controller.abort();
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [src]);

    if (!currentImage.url || currentImage.status === 'unavailable') {
        return (
            <div
                data-protected-image-state={currentImage.status}
                role={alt ? 'img' : undefined}
                aria-label={alt || undefined}
                className={`flex items-center justify-center bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 ${fallbackClassName || className}`}
            >
                <ImageOff className="size-5" aria-hidden="true" />
            </div>
        );
    }

    return (
        <img
            {...props}
            data-protected-image-state="ready"
            src={currentImage.url}
            alt={alt}
            className={className}
            onError={(event) => {
                setImage(previous => previous.source === src ? { ...previous, status: 'unavailable' } : previous);
                onLoadErrorRef.current?.(event);
                onError?.(event);
            }}
        />
    );
}
