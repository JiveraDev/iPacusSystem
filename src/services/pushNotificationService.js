import { getApiUrl } from './apiClient';
import { getPwaServiceWorkerUrl, isPwaActivated } from '../pwa/pwaConfig';
import {
    disableNotificationPushSubscription,
    fetchNotificationPushPublicKey,
    fetchNotificationPushStatus,
    saveNotificationPushSubscription
} from './notificationService';

function browserPushAvailable() {
    return typeof window !== 'undefined'
        && typeof navigator !== 'undefined'
        && 'serviceWorker' in navigator
        && 'PushManager' in window
        && 'Notification' in window;
}

function logPushError(message, error) {
    console.error(`[iPawcus push] ${message}`, error);
}

function serviceWorkerDiagnostics(registration) {
    return {
        secureContext: window.isSecureContext,
        origin: window.location.origin,
        notificationPermission: Notification.permission,
        workerScope: registration?.scope || '',
        activeState: registration?.active?.state || '',
        waitingState: registration?.waiting?.state || '',
        installingState: registration?.installing?.state || '',
        hasPushManager: Boolean(registration?.pushManager),
        controllerState: navigator.serviceWorker.controller?.state || ''
    };
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
    let registration;

    try {
        registration = await navigator.serviceWorker.register(
            getPwaServiceWorkerUrl({ pwaEnabled: isPwaActivated() }),
            { scope: '/' }
        );
        await navigator.serviceWorker.ready;
    } catch (error) {
        logPushError('Service worker registration failed.', error);
        throw new Error('Browser notification service could not start on this site.');
    }

    return registration;
}

export async function syncPushContext(userId) {
    if (!browserPushAvailable() || !userId) {
        return;
    }

    const registration = await getExistingRegistration().catch((error) => {
        logPushError('Existing service worker registration could not be read.', error);
        return null;
    });
    const worker = registration?.active || registration?.waiting || registration?.installing || navigator.serviceWorker.controller;

    if (worker) {
        worker.postMessage({
            type: 'IPAWCUS_PUSH_CONTEXT',
            userId,
            apiBase: getApiUrl('', { apiPrefix: true }),
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

    let registration = null;
    let subscription = null;
    let browserError = '';

    try {
        registration = await getExistingRegistration();
        subscription = registration?.pushManager ? await registration.pushManager.getSubscription() : null;
    } catch (error) {
        logPushError('Browser push subscription state could not be checked.', error);
        browserError = error.message || 'Browser notification service could not be checked.';
    }

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
            logPushError('Push status API request failed.', error);
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
        error: browserError || serverStatus.error || ''
    };
}

export async function enableBrowserPush(userId) {
    if (!browserPushAvailable()) {
        logPushError('Browser push APIs are not available.', { userId });
        throw new Error('Browser notifications are not available in this browser.');
    }

    if (!window.isSecureContext) {
        logPushError('Browser push requires a secure context.', { protocol: window.location.protocol, hostname: window.location.hostname });
        throw new Error('Browser notifications need HTTPS before this device can receive alerts.');
    }

    let publicKeyData;
    try {
        publicKeyData = await fetchNotificationPushPublicKey();
    } catch (error) {
        logPushError('Push public key API request failed.', error);
        throw error;
    }
    const pushConfig = publicKeyData.push || {};

    if (!pushConfig.enabled || !pushConfig.publicKey) {
        logPushError('Push VAPID configuration is incomplete.', pushConfig);
        throw new Error('Browser notifications need to be set up on the server first.');
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        logPushError('Browser notification permission was not granted.', { permission });
        throw new Error(permission === 'denied'
            ? 'Browser notifications are blocked. Allow them in your browser site settings, then try again.'
            : 'Browser notifications were not allowed yet.');
    }

    const registration = await registerPushWorker();
    if (!registration.pushManager) {
        logPushError('Registered service worker has no PushManager.', registration);
        throw new Error('Browser notifications are not available in this browser.');
    }

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
        const applicationServerKey = base64UrlToUint8Array(pushConfig.publicKey);

        try {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey
            });
        } catch (error) {
            logPushError('Browser push subscription request failed.', {
                error,
                diagnostics: serviceWorkerDiagnostics(registration),
                publicKeyLength: String(pushConfig.publicKey || '').length,
                applicationServerKeyBytes: applicationServerKey.byteLength
            });
            throw new Error(error.message || 'Browser push subscription failed.');
        }
    }

    try {
        await saveNotificationPushSubscription(userId, subscription.toJSON());
    } catch (error) {
        logPushError('Push subscription could not be saved to the server.', error);
        throw error;
    }
    await syncPushContext(userId);

    return getBrowserPushState(userId);
}

export async function disableBrowserPush(userId) {
    let endpoint = '';

    if (browserPushAvailable()) {
        const registration = await getExistingRegistration().catch((error) => {
            logPushError('Existing service worker registration could not be read before disabling push.', error);
            return null;
        });
        const subscription = registration?.pushManager
            ? await registration.pushManager.getSubscription().catch((error) => {
                logPushError('Existing push subscription could not be read before disabling push.', error);
                return null;
            })
            : null;

        endpoint = subscription?.endpoint || '';
        if (subscription) {
            await subscription.unsubscribe();
        }
    }

    try {
        await disableNotificationPushSubscription(userId, endpoint);
    } catch (error) {
        logPushError('Push subscription could not be disabled on the server.', error);
        throw error;
    }

    return getBrowserPushState(userId);
}
