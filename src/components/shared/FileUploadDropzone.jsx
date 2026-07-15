import { useEffect, useMemo } from 'react';
import { CheckCircle2, FileText, Image as ImageIcon, Upload, X } from 'lucide-react';

function formatFileSize(bytes) {
    const size = Number(bytes || 0);
    if (size <= 0) return '0 B';

    const units = ['B', 'KB', 'MB'];
    const unitIndex = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
    const value = size / Math.pow(1024, unitIndex);

    return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
}

function isImageFile(file) {
    return String(file?.type || '').startsWith('image/');
}

function FilePreview({ file, index, onRemove }) {
    const isImage = isImageFile(file);
    const objectUrl = useMemo(() => {
        return isImage && file ? URL.createObjectURL(file) : '';
    }, [file, isImage]);

    useEffect(() => {
        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [objectUrl]);

    return (
        <div className="group relative min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="aspect-square bg-slate-50">
                {isImage && objectUrl ? (
                    <img src={objectUrl} alt={file.name} className="size-full object-cover" />
                ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-2 p-3 text-center">
                        {isImage ? (
                            <ImageIcon className="size-8 text-slate-300" />
                        ) : (
                            <FileText className="size-8 text-slate-300" />
                        )}
                        <span className="max-w-full truncate text-xs font-bold text-slate-500">
                            {file?.name || 'Selected file'}
                        </span>
                    </div>
                )}
            </div>
            <div className="space-y-1 border-t border-slate-100 px-2 py-2 text-left">
                <div className="flex min-w-0 items-center gap-1.5">
                    <CheckCircle2 className="size-3 shrink-0 text-emerald-500" />
                    <p className="min-w-0 truncate text-xs font-bold text-slate-700">{file?.name}</p>
                </div>
                <p className="text-[11px] font-semibold text-slate-400">{formatFileSize(file?.size)}</p>
            </div>
            <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute right-1.5 top-1.5 rounded-full bg-red-500 p-1 text-white shadow transition hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-200"
                aria-label={`Remove ${file?.name || 'file'}`}
            >
                <X className="size-3.5" />
            </button>
        </div>
    );
}

export default function FileUploadDropzone({
    id,
    accept,
    files = [],
    multiple = false,
    disabled = false,
    label = 'Click to upload',
    helper = 'Images or PDF documents',
    onFilesSelected,
    onRemove,
    className = ''
}) {
    const selectedFiles = useMemo(() => files.filter(Boolean), [files]);

    const handleChange = (event) => {
        const nextFiles = Array.from(event.target.files || []);
        if (nextFiles.length > 0) {
            onFilesSelected(nextFiles, event);
        }
        event.target.value = '';
    };

    return (
        <div
            className={`rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-4 transition-colors hover:border-blue-400 ${className}`}
        >
            <input
                id={id}
                type="file"
                accept={accept}
                multiple={multiple}
                disabled={disabled}
                onChange={handleChange}
                className="hidden"
            />

            {selectedFiles.length > 0 && (
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {selectedFiles.map((file, index) => (
                        <FilePreview
                            key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                            file={file}
                            index={index}
                            onRemove={onRemove}
                        />
                    ))}
                </div>
            )}

            <label
                htmlFor={id}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-6 text-center transition-colors hover:border-blue-300 ${disabled ? 'pointer-events-none opacity-60' : ''}`}
            >
                <Upload className="mb-2 size-8 text-slate-400" />
                <span className="text-sm font-bold text-blue-600">
                    {selectedFiles.length > 0 ? (multiple ? 'Add more files' : 'Replace file') : label}
                </span>
                <span className="mt-1 text-xs font-medium text-slate-400">{helper}</span>
            </label>
        </div>
    );
}
