import { useCallback, useEffect, useState } from 'react';
import {
    BOOKING_PRICE_PROJECTION_STORAGE_KEY,
    BOOKING_PRICE_PROJECTION_UPDATED_EVENT,
    readBookingPriceProjectionConfig,
    resetBookingPriceProjectionConfig,
    saveBookingPriceProjectionConfig
} from '../lib/servicePriceProjections';

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

    const saveConfig = useCallback((nextConfig) => {
        const normalized = saveBookingPriceProjectionConfig(nextConfig);
        setConfig(normalized);
        return normalized;
    }, []);

    const resetConfig = useCallback(() => {
        const normalized = resetBookingPriceProjectionConfig();
        setConfig(normalized);
        return normalized;
    }, []);

    return {
        config,
        saveConfig,
        resetConfig
    };
}
