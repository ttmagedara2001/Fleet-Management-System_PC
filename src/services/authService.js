/**
 * Simple Auto-Login Authentication Service
 *
 * Hardcoded credentials for automatic login on dashboard open.
 * Calls /get-token API and returns JWT token.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const CREDENTIALS = {
  email: import.meta.env.VITE_USER_EMAIL,
  password: import.meta.env.VITE_USER_PASSWORD,
};

/**
 * Auto-login: Calls /user/get-token API with credentials from .env
 * Returns a promise that resolves when login is complete
 */
export async function login() {
  console.log("🔐 AUTO-LOGIN: Initiating authentication...");
  try {
    const response = await fetch(`${API_BASE_URL}/user/get-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        email: CREDENTIALS.email,
        password: CREDENTIALS.password,
      }),
    });
    if (!response.ok) {
      console.error("❌ Authentication Failed");
      throw new Error(`Login failed: ${response.status}`);
    }
    console.log("✅ AUTHENTICATION SUCCESSFUL");
    return true;
  } catch (error) {
    console.error("❌ AUTHENTICATION ERROR:", error.message);
    throw error;
  }
}

// Immediately perform auto-login on module load
export const autoLoginPromise = login();

// No-op for getToken/clearTokens: all auth is now cookie-based
export function getToken() {
  return null;
}
export function clearTokens() {
  console.log("🧹 Tokens cleared (noop, cookie-based auth)");
}

export default { login, getToken, clearTokens };
