import { apiRequest, patchJson, postJson } from './apiClient';

function userIdQuery(userId) {
    return new URLSearchParams({ userId }).toString();
}

export function fetchNotifications(userId, options = {}) {
    const { limit = 30, offset, scope, ...requestOptions } = options;
    const query = new URLSearchParams({ userId, limit });
    if (offset !== undefined) query.set('offset', offset);
    if (scope) query.set('scope', scope);

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

export function fetchNotificationPushPublicKey(options = {}) {
    return apiRequest('/notifications/push/public-key', options);
}

export function fetchNotificationPushStatus(userId, options = {}) {
    return apiRequest(`/notifications/push/status?${userIdQuery(userId)}`, options);
}

export function saveNotificationPushSubscription(userId, subscription) {
    return postJson('/notifications/push/subscribe', {
        user_id: userId,
        subscription,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
    });
}

export function disableNotificationPushSubscription(userId, endpoint = '') {
    return postJson('/notifications/push/unsubscribe', {
        user_id: userId,
        endpoint
    });
}

export function runNotificationReminders(payload = {}, options = {}) {
    return postJson('/notifications/reminders/run', payload, options);
}
