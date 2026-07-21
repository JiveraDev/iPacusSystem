import { useEffect, useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { fetchProtectedImageObjectUrl } from '../../lib/image';

export default function ProtectedImage({
    src,
    alt = '',
    className = '',
    fallbackClassName = '',
    onError,
    onLoadError,
    ...props
}) {
    const [displaySrc, setDisplaySrc] = useState('');
    const [failedSrc, setFailedSrc] = useState('');
    const onLoadErrorRef = useRef(onLoadError);
    const hasError = Boolean(displaySrc && failedSrc === displaySrc);

    useEffect(() => {
        onLoadErrorRef.current = onLoadError;
    }, [onLoadError]);

    useEffect(() => {
        let isActive = true;
        let objectUrl = '';

        if (!src) {
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
                    onLoadErrorRef.current?.();
                }
            });

        return () => {
            isActive = false;
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [src]);

    if (!displaySrc || hasError) {
        return (
            <div className={`flex items-center justify-center bg-slate-100 text-slate-400 ${fallbackClassName || className}`}>
                <ImageOff className="size-5" />
            </div>
        );
    }

    return (
        <img
            {...props}
            src={displaySrc}
            alt={alt}
            className={className}
            onError={(event) => {
                setFailedSrc(displaySrc);
                onLoadErrorRef.current?.(event);
                onError?.(event);
            }}
        />
    );
}
