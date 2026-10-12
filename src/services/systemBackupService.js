import { apiFetch, apiRequest, readJsonResponse } from './apiClient.js';

export function fetchSystemBackups(options = {}) {
    return apiRequest('/system-backups', options);
}

function downloadName(response, fallback) {
    const disposition = response.headers.get('Content-Disposition') || '';
    const utfName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const plainName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
    try {
        return decodeURIComponent(utfName || plainName || fallback);
    } catch {
        return plainName || fallback;
    }
}

function reportDownloadProgress(onProgress, details) {
    if (typeof onProgress === 'function') {
        onProgress(details);
    }
}

async function readDownloadBody(response, onProgress) {
    const totalHeader = Number(response.headers.get('Content-Length'));
    const totalBytes = Number.isFinite(totalHeader) && totalHeader > 0 ? totalHeader : 0;

    if (!response.body?.getReader) {
        const blob = await response.blob();
        reportDownloadProgress(onProgress, {
            phase: 'saving',
            percent: 100,
            loadedBytes: blob.size,
            totalBytes: totalBytes || blob.size
        });
        return blob;
    }

    const reader = response.body.getReader();
    const chunks = [];
    let loadedBytes = 0;

    reportDownloadProgress(onProgress, {
        phase: 'transferring',
        percent: totalBytes ? 0 : null,
        loadedBytes,
        totalBytes
    });

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        loadedBytes += value.byteLength;
        reportDownloadProgress(onProgress, {
            phase: 'transferring',
            percent: totalBytes ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : null,
            loadedBytes,
            totalBytes
        });
    }

    reportDownloadProgress(onProgress, {
        phase: 'saving',
        percent: 100,
        loadedBytes,
        totalBytes: totalBytes || loadedBytes
    });

    return new Blob(chunks, {
        type: response.headers.get('Content-Type') || 'application/zip'
    });
}

export async function downloadLocalSystemBackup({ onProgress } = {}) {
    reportDownloadProgress(onProgress, {
        phase: 'preparing',
        percent: null,
        loadedBytes: 0,
        totalBytes: 0
    });

    const response = await apiFetch('/system-backups?action=local-download', {
        method: 'POST',
        timeoutMs: 0,
        dedupe: false
    });
    if (!response.ok) {
        const data = await readJsonResponse(response, {});
        throw new Error(data.message || 'The local backup could not be created and downloaded.');
    }
    const blob = await readDownloadBody(response, onProgress);
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = downloadName(response, 'ipawcus-complete-backup.zip');
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
    reportDownloadProgress(onProgress, {
        phase: 'complete',
        percent: 100,
        loadedBytes: blob.size,
        totalBytes: blob.size
    });
    return anchor.download;
}
