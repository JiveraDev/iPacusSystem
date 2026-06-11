import { API_BASE_URL } from './apiClient';
import {
    disableNotificationPushSubscription,
    fetchNotificationPushPublicKey,
    fetchNotificationPushStatus,
    saveNotificationPushSubscription
} from './notificationService';

const PUSH_WORKER_PATH = '/ipawcus-push-sw.js';

function browserPushAvailable() {
    return typeof window !== 'undefined'
        && typeof navigator !== 'undefined'
        && 'serviceWorker' in navigator
        && 'PushManager' in window
        && 'Notification' in window;
}

function base64UrlToUint8Array(value) {
    const padding = '='.repeat((4 - value.length % 4) % 4);
    const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    const output = new Uint8Array(raw.length);

    for (let index = 0; index < raw.length; index += 1) {
        output[index] = raw.charCodeAt(index);
    }

    return output;
}

async function getExistingRegistration() {
    if (!browserPushAvailable()) return null;

    return navigator.serviceWorker.getRegistration('/');
}

async function registerPushWorker() {
    const registration = await navigator.serviceWorker.register(PUSH_WORKER_PATH);
    await navigator.serviceWorker.ready;

    return registration;
}

export async function syncPushContext(userId) {
    if (!browserPushAvailable() || !userId) {
        return;
    }

    const registration = await getExistingRegistration();
    const worker = registration?.active || registration?.waiting || registration?.installing || navigator.serviceWorker.controller;

    if (worker) {
        worker.postMessage({
            type: 'IPAWCUS_PUSH_CONTEXT',
            userId,
            apiBase: API_BASE_URL || window.location.origin,
            appOrigin: window.location.origin
        });
    }
}

export async function getBrowserPushState(userId) {
    if (!browserPushAvailable()) {
        return {
            supported: false,
            permission: 'unsupported',
            configured: false,
            hasSubscription: false,
            activeSubscriptions: 0
        };
    }

    const registration = await getExistingRegistration();
    const subscription = registration ? await registration.pushManager.getSubscription() : null;
    let serverStatus = {
        configured: false,
        needsSetup: true,
        activeSubscriptions: 0
    };

    if (userId) {
        try {
            const data = await fetchNotificationPushStatus(userId);
            serverStatus = data.push || serverStatus;
        } catch (error) {
            serverStatus = {
                ...serverStatus,
                error: error.message || 'Browser notification status could not be loaded.'
            };
        }
    }

    return {
        supported: true,
        secure: window.isSecureContext,
        permission: Notification.permission,
        configured: Boolean(serverStatus.configured),
        needsSetup: Boolean(serverStatus.needsSetup),
        hasSubscription: Boolean(subscription),
        activeSubscriptions: Number(serverStatus.activeSubscriptions || 0),
        enabled: Notification.permission === 'granted' && Boolean(subscription) && Number(serverStatus.activeSubscriptions || 0) > 0,
        error: serverStatus.error || ''
    };
}

export async function enableBrowserPush(userId) {
    if (!browserPushAvailable()) {
        throw new Error('Browser notifications are not available in this browser.');
    }

    if (!window.isSecureContext) {
        throw new Error('Browser notifications need HTTPS before this device can receive alerts.');
    }

    const publicKeyData = await fetchNotificationPushPublicKey();
    const pushConfig = publicKeyData.push || {};

    if (!pushConfig.enabled || !pushConfig.publicKey) {
        throw new Error('Browser notifications need to be set up on the server first.');
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        throw new Error(permission === 'denied'
            ? 'Browser notifications are blocked. Allow them in your browser site settings, then try again.'
            : 'Browser notifications were not allowed yet.');
    }

    const registration = await registerPushWorker();
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64UrlToUint8Array(pushConfig.publicKey)
        });
    }

    await saveNotificationPushSubscription(userId, subscription.toJSON());
    await syncPushContext(userId);

    return getBrowserPushState(userId);
}

export async function disableBrowserPush(userId) {
    let endpoint = '';

    if (browserPushAvailable()) {
        const registration = await getExistingRegistration();
        const subscription = registration ? await registration.pushManager.getSubscription() : null;

        endpoint = subscription?.endpoint || '';
        if (subscription) {
            await subscription.unsubscribe();
        }
    }

    await disableNotificationPushSubscription(userId, endpoint);

    return getBrowserPushState(userId);
}
