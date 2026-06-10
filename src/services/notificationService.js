import { apiRequest, patchJson, postJson } from './apiClient';

function userIdQuery(userId) {
    return new URLSearchParams({ userId }).toString();
}

export function fetchNotifications(userId, options = {}) {
    const { limit = 30, ...requestOptions } = options;
    const query = new URLSearchParams({ userId, limit });

    return apiRequest(`/notifications?${query.toString()}`, requestOptions);
}

export function markNotificationRead(notificationId, userId) {
    return patchJson(`/notifications/${notificationId}/read`, { user_id: userId });
}

export function markAllNotificationsRead(userId) {
    return postJson('/notifications/read-all', { user_id: userId });
}

export function fetchNotificationPreferences(userId, options = {}) {
    return apiRequest(`/notifications/preferences?${userIdQuery(userId)}`, options);
}

export function saveNotificationPreferences(userId, preferences) {
    return postJson('/notifications/preferences', {
        user_id: userId,
        preferences
    });
}

export function runNotificationReminders(payload = {}, options = {}) {
    return postJson('/notifications/reminders/run', payload, options);
}
