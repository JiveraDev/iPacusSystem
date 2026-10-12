import { useEffect, useState, useSyncExternalStore } from 'react';
import { Download, ExternalLink, FileText, Loader2, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Button, buttonVariants } from '../../ui/button';
import {
    closeDocumentPreview,
    completeDocumentPreview,
    getDocumentPreview,
    loadDocumentPreviewSource,
    subscribeDocumentPreview
} from '../../lib/documentPreview.js';

export default function ProtectedDocumentPreview() {
    const preview = useSyncExternalStore(subscribeDocumentPreview, getDocumentPreview, () => null);
    return (
        <Dialog open={Boolean(preview)} onOpenChange={open => !open && closeDocumentPreview(preview?.id)}>
            <DialogContent className="flex h-[88dvh] max-h-[960px] w-[calc(100vw-2rem)] max-w-6xl flex-col gap-4 overflow-hidden border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
                {preview ? <DocumentPreviewContent key={preview.id} preview={preview} /> : null}
            </DialogContent>
        </Dialog>
    );
}

function DocumentPreviewContent({ preview }) {
    const [attempt, setAttempt] = useState(0);
    const [file, setFile] = useState({ status: 'loading', attempt: 0 });
    const [displayFailed, setDisplayFailed] = useState(false);
    const currentFile = file.attempt === attempt ? file : { status: 'loading' };
    const isReady = currentFile.status === 'ready';
    const isPdf = currentFile.mimeType === 'application/pdf';
    const canDisplayPdf = typeof navigator === 'undefined' || navigator.pdfViewerEnabled !== false;
    const cannotDisplay = displayFailed || (isReady && isPdf && !canDisplayPdf);

    useEffect(() => {
        let active = true;
        let ownedObjectUrl = '';
        const controller = new AbortController();
        loadDocumentPreviewSource(preview.source, { signal: controller.signal })
            .then(nextFile => {
                if (!active) {
                    if (nextFile.owned) URL.revokeObjectURL(nextFile.url);
                    return;
                }
                ownedObjectUrl = nextFile.owned ? nextFile.url : '';
                setFile({ ...nextFile, status: 'ready', attempt });
                setDisplayFailed(false);
                completeDocumentPreview(preview.id);
            })
            .catch(error => {
                if (!active) return;
                setFile({ status: 'error', attempt });
                completeDocumentPreview(preview.id, error);
            });

        return () => {
            active = false;
            controller.abort();
            if (ownedObjectUrl) URL.revokeObjectURL(ownedObjectUrl);
        };
    }, [attempt, preview.id, preview.source]);

    return (
        <>
            <DialogHeader className="shrink-0 pr-7 text-left">
                <DialogTitle className="dark:text-slate-100">{preview.title || 'Document Preview'}</DialogTitle>
                <DialogDescription className="break-words dark:text-slate-400">
                    {currentFile.fileName || 'Loading the selected document.'}
                </DialogDescription>
            </DialogHeader>
            {isReady ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <a href={currentFile.url} download={currentFile.fileName} className={buttonVariants({ variant: 'outline', size: 'sm', className: 'dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800' })}>
                        <Download className="size-4" /> Download {isPdf ? 'PDF' : 'image'}
                    </a>
                    <a href={currentFile.url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'outline', size: 'sm', className: 'dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800' })}>
                        <ExternalLink className="size-4" /> Open in new tab
                    </a>
                </div>
            ) : null}
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-950">
                {isReady && !cannotDisplay ? (
                    isPdf ? (
                        <iframe
                            src={currentFile.url}
                            title={preview.title || currentFile.fileName || 'PDF document preview'}
                            className="h-full w-full border-0 bg-white"
                            onError={() => setDisplayFailed(true)}
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center p-3">
                            <img src={currentFile.url} alt={preview.title || currentFile.fileName} className="max-h-full max-w-full object-contain" onError={() => setDisplayFailed(true)} />
                        </div>
                    )
                ) : (
                    <div role="status" className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-slate-600 dark:text-slate-300">
                        {currentFile.status === 'loading' ? <Loader2 className="size-6 animate-spin" /> : <FileText className="size-7" />}
                        <p>{currentFile.status === 'loading' ? 'Loading document preview...' : cannotDisplay ? 'The browser could not display this document. You can download it or open it in a new tab.' : 'The document could not be loaded. Check your connection and try again.'}</p>
                        {currentFile.status !== 'loading' && (currentFile.status === 'error' || canDisplayPdf) ? (
                            <Button type="button" variant="outline" size="sm" className="dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800" onClick={() => setAttempt(value => value + 1)}>
                                <RotateCcw className="size-4" /> Retry preview
                            </Button>
                        ) : null}
                    </div>
                )}
            </div>
        </>
    );
}
