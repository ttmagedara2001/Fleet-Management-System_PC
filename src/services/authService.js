/**
 * Simple Auto-Login Authentication Service
 * 
 * Hardcoded credentials for automatic login on dashboard open.
 * Calls /get-token API and returns JWT token.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Credentials from environment variables for auto-login
const CREDENTIALS = {
    email: import.meta.env.VITE_USER_EMAIL,
    password: import.meta.env.VITE_USER_PASSWORD
};

/**
 * Auto-login: Calls /get-token API with hardcoded credentials
 * @returns {Promise<{jwtToken: string, refreshToken: string}>}
 */
export async function login() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 AUTO-LOGIN: Initiating API call...');
    console.log('📧 Email:', CREDENTIALS.email);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
        const response = await fetch(`${API_BASE_URL}/get-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                email: CREDENTIALS.email,
                password: CREDENTIALS.password
            })
        });

        console.log('📨 Response Status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Login Failed:', errorText);
            throw new Error(`Login failed: ${response.status}`);
        }

        const data = await response.json();
        
        // Extract tokens (handle different response structures)
        const jwtToken = data.data?.jwtToken || data.jwtToken || data.token;
        const refreshToken = data.data?.refreshToken || data.refreshToken;

        if (!jwtToken) {
            throw new Error('No JWT token in response');
        }

        // Store token
        localStorage.setItem('jwtToken', jwtToken);
        if (refreshToken) {
            localStorage.setItem('refreshToken', refreshToken);
        }

        console.log('✅ LOGIN SUCCESSFUL!');
        console.log('🎫 JWT Token acquired (length:', jwtToken.length, ')');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        return { jwtToken, refreshToken };

    } catch (error) {
        console.error('❌ AUTO-LOGIN ERROR:', error.message);
        throw error;
    }
}

/**
 * Get stored JWT token
 */
export function getToken() {
    return localStorage.getItem('jwtToken');
}

/**
 * Clear stored tokens
 */
export function clearTokens() {
    localStorage.removeItem('jwtToken');
    localStorage.removeItem('refreshToken');
    console.log('🧹 Tokens cleared');
}

export default { login, getToken, clearTokens };
