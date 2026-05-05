import React from 'react';
import { Dialog, DialogContent } from './dialog';

export function PhotoViewer({ src, alt, open, onOpenChange }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl w-[90vw] h-[80vh] flex items-center justify-center p-0 bg-transparent border-none shadow-none">
                <img
                    src={src}
                    alt={alt}
                    className="max-w-full max-h-full object-contain cursor-zoom-in"
                />
            </DialogContent>
        </Dialog>
    );
}
