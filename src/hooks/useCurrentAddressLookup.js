import { useCallback, useEffect, useRef, useState } from 'react';
import { reverseGeocodeAddress } from '../services/addressAutocomplete.js';
import { getUserFacingErrorMessage } from '../lib/errorPresentation.js';

function getLocationErrorMessage(error) {
    if (error?.name === 'AbortError') {
        return '';
    }

    if (error?.code === 1) {
        return 'Location permission was denied. Allow location access or enter the address manually.';
    }

    if (error?.code === 2) {
        return 'Your current location is unavailable. Check device location services or enter the address manually.';
    }

    if (error?.code === 3) {
        return 'Location lookup timed out. Try again or enter the address manually.';
    }

    return getUserFacingErrorMessage(
        error,
        'Could not determine your current address. Please enter it manually.',
        { context: 'Address lookup details were hidden from the user interface.' }
    );
}

function requestBrowserPosition() {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000,
        });
    });
}

export function useCurrentAddressLookup(onAddressResolved) {
    const [isLocatingAddress, setIsLocatingAddress] = useState(false);
    const [locationFeedback, setLocationFeedback] = useState({ type: '', message: '' });
    const callbackRef = useRef(onAddressResolved);
    const requestRef = useRef({ id: 0, controller: null });

    useEffect(() => {
        callbackRef.current = onAddressResolved;
    }, [onAddressResolved]);

    useEffect(() => () => {
        requestRef.current.id += 1;
        requestRef.current.controller?.abort();
    }, []);

    const clearLocationFeedback = useCallback(() => {
        setLocationFeedback({ type: '', message: '' });
    }, []);

    const useCurrentLocation = useCallback(async () => {
        if (!navigator.geolocation) {
            setLocationFeedback({
                type: 'error',
                message: 'This browser does not support location lookup. Please enter the address manually.',
            });
            return;
        }

        requestRef.current.controller?.abort();
        const requestId = requestRef.current.id + 1;
        const controller = new AbortController();
        requestRef.current = { id: requestId, controller };

        setIsLocatingAddress(true);
        setLocationFeedback({ type: '', message: '' });

        try {
            const position = await requestBrowserPosition();

            if (requestRef.current.id !== requestId) {
                return;
            }

            const result = await reverseGeocodeAddress(
                position.coords.latitude,
                position.coords.longitude,
                controller.signal
            );

            if (requestRef.current.id !== requestId) {
                return;
            }

            callbackRef.current?.(result);
            setLocationFeedback({
                type: 'success',
                message: 'Current address added. You can edit it before continuing.',
            });
        } catch (error) {
            if (requestRef.current.id !== requestId || error?.name === 'AbortError') {
                return;
            }

            setLocationFeedback({
                type: 'error',
                message: getLocationErrorMessage(error),
            });
        } finally {
            if (requestRef.current.id === requestId) {
                setIsLocatingAddress(false);
            }
        }
    }, []);

    return {
        clearLocationFeedback,
        isLocatingAddress,
        locationFeedback,
        useCurrentLocation,
    };
}
