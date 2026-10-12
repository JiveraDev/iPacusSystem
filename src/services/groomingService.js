import { apiRequest, postJson } from './apiClient';
import { uploadDocumentFile } from './uploadService';

const options = { cache: 'no-store', suppressServerUnavailable: true };
export const fetchGroomingJobs = (reviewsOnly = false) => apiRequest(`/grooming${reviewsOnly ? '?view=reviews' : ''}`, options);
export const fetchGroomingJob = (id) => apiRequest(`/grooming?bookingId=${encodeURIComponent(id)}`, options);
export const updateGroomingJob = (payload) => postJson('/grooming', payload);
export const uploadGroomingPhoto = (file, fields) => uploadDocumentFile(file, 'grooming_photo', { formFields: fields });
