import { apiRequest } from './apiClient';

export async function uploadImageFile(file, type = 'booking_concern', options = {}) {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('type', type);

    const data = await apiRequest('/upload', {
        method: 'POST',
        body: formData,
        ...options
    });

    return data.relative_url || data.protected_url || data.url;
}

export function dataUrlToFile(dataUrl, fileName) {
    const [header, base64Value = ''] = String(dataUrl || '').split(',');
    const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
    const binary = atob(base64Value);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }

    const extension = mime.includes('png') ? 'png' : 'jpg';
    return new File([bytes], `${fileName}.${extension}`, { type: mime });
}

export async function uploadDataUrlImage(dataUrl, type, fileNamePrefix, options = {}) {
    const file = dataUrlToFile(dataUrl, `${fileNamePrefix}_${Date.now()}`);
    const data = await uploadFormData(buildImageFormData(file, type), options);

    return data.relative_url || data.url || null;
}

function buildImageFormData(file, type) {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('type', type);

    return formData;
}

export function uploadFormData(formData, options = {}) {
    return apiRequest('/upload', {
        method: 'POST',
        body: formData,
        ...options
    });
}

export function deleteUpload(payload) {
    return apiRequest('/upload/delete', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
}
