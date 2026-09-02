import { useCallback, useEffect, useState } from 'react';
import {
    BOOKING_PRICE_PROJECTION_STORAGE_KEY,
    BOOKING_PRICE_PROJECTION_UPDATED_EVENT,
    readBookingPriceProjectionConfig,
    resetBookingPriceProjectionConfig,
    saveBookingPriceProjectionConfig
} from '../lib/servicePriceProjections';
import { fetchServiceDisplaySettings, saveServiceDisplaySettings } from '../services/serviceCatalogService';
import { useAutoRefresh } from './useAutoRefresh';

export function useBookingPriceProjections() {
    const [config, setConfig] = useState(() => readBookingPriceProjectionConfig());

    useEffect(() => {
        const syncConfig = (event) => {
            setConfig(event?.detail || readBookingPriceProjectionConfig());
        };

        const syncStorage = (event) => {
            if (!event || event.key === null || event.key === BOOKING_PRICE_PROJECTION_STORAGE_KEY) {
                setConfig(readBookingPriceProjectionConfig());
            }
        };

        window.addEventListener(BOOKING_PRICE_PROJECTION_UPDATED_EVENT, syncConfig);
        window.addEventListener('storage', syncStorage);

        return () => {
            window.removeEventListener(BOOKING_PRICE_PROJECTION_UPDATED_EVENT, syncConfig);
            window.removeEventListener('storage', syncStorage);
        };
    }, []);

    const refreshSharedConfig = useCallback(async () => {
        const response = await fetchServiceDisplaySettings();
        if (!response?.config) return;
        const normalized = saveBookingPriceProjectionConfig(response.config);
        setConfig(normalized);
    }, []);

    useAutoRefresh(refreshSharedConfig, { refreshKey: 'service-display-settings' });

    const saveConfig = useCallback(async (nextConfig) => {
        const normalized = saveBookingPriceProjectionConfig(nextConfig, { persist: false });
        await saveServiceDisplaySettings(normalized);
        const persisted = saveBookingPriceProjectionConfig(normalized);
        setConfig(persisted);
        return persisted;
    }, []);

    const resetConfig = useCallback(async () => {
        const normalized = resetBookingPriceProjectionConfig({ persist: false });
        await saveServiceDisplaySettings(normalized);
        const persisted = saveBookingPriceProjectionConfig(normalized);
        setConfig(persisted);
        return persisted;
    }, []);

    return {
        config,
        saveConfig,
        resetConfig
    };
}
