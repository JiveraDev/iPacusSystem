import { ApiError, postJson } from './apiClient';
import { getUserFacingErrorMessage } from '../lib/errorPresentation.js';

export async function registerUser(payload) {
    try {
        return await postJson('/register', payload, { apiPrefix: true });
    } catch (error) {
        const firstError = Object.values(error?.data?.errors || {})
            .flat()
            .find((message) => typeof message === 'string' && message.trim());

        if (firstError) {
            const fallbackMessage = 'Please review your registration details and try again.';
            throw new ApiError(
                getUserFacingErrorMessage(firstError, fallbackMessage, {
                    context: 'Registration error details were hidden from the user interface.'
                }),
                {
                    status: error.status,
                    data: error.data,
                    fallbackMessage
                }
            );
        }

        throw error;
    }
}
