import { postJson } from './apiClient';
import { getUserFacingErrorMessage } from '../lib/errorPresentation.js';

export class LoginError extends Error {
    constructor(message, details = {}) {
        super(getUserFacingErrorMessage(message, 'Login failed. Please check your details and try again.', {
            context: 'Login error details were hidden from the user interface.'
        }));
        this.name = "LoginError";
        this.code = details.code || "";
        this.email = details.email || "";
        this.status = details.status || 0;
    }
}

export async function loginUser(payload) {
    let data;

    try {
        data = await postJson('/login', payload, { apiPrefix: true });
    } catch (error) {
        throw new LoginError(error.message, {
            code: error?.data?.code,
            email: error?.data?.email,
            status: error?.status,
        });
    }

    // Return both user and token
    return {
        user: data.user,
        token: data.access_token,
        expiresAt: data.expires_at || ''
    };
}
