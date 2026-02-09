/**
 * Authentication Service (Cookie-Based)
 *
 * The server uses HTTP-only cookies for auth.
 * - POST /get-token sets the session cookie via Set-Cookie header.
 * - POST /get-new-token refreshes the session cookie.
 * - All subsequent requests carry the cookie automatically
 *   (fetch with credentials:"include", axios with withCredentials:true).
 *
 * We keep a simple localStorage flag so the React context knows
 * whether the user has successfully authenticated in this session.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const CREDENTIALS = {
  email: import.meta.env.VITE_USER_EMAIL,
  password: import.meta.env.VITE_USER_PASSWORD,
};

const AUTH_FLAG = "fabrix_authenticated";

/**
 * POST /get-token – authenticate with email + password.
 * The server responds with Set-Cookie; no JWT is stored client-side.
 */
export async function login() {
  console.log("🔐 AUTO-LOGIN: Initiating authentication...");
  try {
    const response = await fetch(`${API_BASE_URL}/get-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include", // send & receive cookies
      body: JSON.stringify({
        email: CREDENTIALS.email,
        password: CREDENTIALS.password,
      }),
    });

    // Read body as text first (server may return empty body)
    const text = await response.text();

    if (!response.ok) {
      console.error("❌ Authentication Failed:", response.status, text);
      throw new Error(`Login failed: ${response.status}`);
    }

    // Mark as authenticated (cookie is managed by the browser)
    localStorage.setItem(AUTH_FLAG, "true");
    console.log("✅ AUTHENTICATION SUCCESSFUL (cookie-based)");
    return true;
  } catch (error) {
    console.error("❌ AUTHENTICATION ERROR:", error.message);
    throw error;
  }
}

/**
 * POST /get-new-token – refresh the session cookie.
 * Called automatically by the axios 401 interceptor.
 * Returns true on success, false on failure.
 */
export async function refreshSession() {
  try {
    console.log("🔄 Refreshing session cookie via /get-new-token...");
    const response = await fetch(`${API_BASE_URL}/get-new-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      console.error("❌ Session refresh failed:", response.status);
      return false;
    }

    console.log("✅ Session cookie refreshed");
    return true;
  } catch (error) {
    console.error("❌ Session refresh error:", error.message);
    return false;
  }
}

/**
 * Check if the user has authenticated in this session.
 * Returns a truthy string so AuthContext can use !!getToken() as isAuthenticated.
 */
export function getToken() {
  return localStorage.getItem(AUTH_FLAG) || null;
}

/**
 * Clear the auth flag (logout). The cookie will expire on its own
 * or be cleared by the server.
 */
export function clearTokens() {
  localStorage.removeItem(AUTH_FLAG);
  console.log("🧹 Auth flag cleared");
}

export default { login, refreshSession, getToken, clearTokens };
