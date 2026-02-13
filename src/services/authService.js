/**
 * Authentication Service (JWT + HTTP-only Cookie)
 *
 * Flow:
 * - POST /get-token   → returns JWT in response body; server also sets
 *                        HTTP-only cookies (refresh token, etc.).
 * - POST /get-new-token → refreshes the JWT (cookies carry the refresh token).
 *
 * The JWT is stored in localStorage so it can be attached to every request
 * via an Authorization header, and passed to the WebSocket as a query param.
 * HTTP-only cookies travel automatically (withCredentials / credentials:"include").
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const CREDENTIALS = {
  email: import.meta.env.VITE_USER_EMAIL,
  password: import.meta.env.VITE_USER_PASSWORD,
};

const TOKEN_KEY = "fabrix_jwt_token";

// ── helpers ────────────────────────────────────────────────────────

/**
 * Try to extract the JWT string from whatever the server returns.
 * Handles plain-text tokens AND JSON bodies like { token: "..." }.
 */
function extractToken(text) {
  if (!text) return null;
  const trimmed = text.trim();

  // If it looks like JSON, parse and pull common key names
  if (trimmed.startsWith("{")) {
    try {
      const json = JSON.parse(trimmed);
      return (
        json.token || json.accessToken || json.access_token || json.jwt || null
      );
    } catch {
      return null;
    }
  }

  // Otherwise treat the whole body as the raw JWT
  return trimmed || null;
}

// ── public API ─────────────────────────────────────────────────────

/**
 * POST /get-token – authenticate with email + password.
 * Stores the JWT from the response body so it can be used in
 * Authorization headers and WebSocket connections.
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
      credentials: "include", // receive HTTP-only cookies
      body: JSON.stringify({
        email: CREDENTIALS.email,
        password: CREDENTIALS.password,
      }),
    });

    const text = await response.text();

    if (!response.ok) {
      console.error("❌ Authentication Failed:", response.status, text);
      throw new Error(`Login failed: ${response.status}`);
    }

    const jwt = extractToken(text);
    if (jwt) {
      localStorage.setItem(TOKEN_KEY, jwt);
      console.log("✅ AUTHENTICATION SUCCESSFUL – JWT stored");
    } else {
      // Server may rely solely on cookies; store a flag so the app knows
      // it has authenticated at least once.
      localStorage.setItem(TOKEN_KEY, "__cookie_session__");
      console.log(
        "✅ AUTHENTICATION SUCCESSFUL – cookie-only (no JWT in body)",
      );
    }

    return true;
  } catch (error) {
    console.error("❌ AUTHENTICATION ERROR:", error.message);
    throw error;
  }
}

/**
 * POST /get-new-token – refresh the session.
 * The refresh token travels as an HTTP-only cookie.
 * A new JWT is returned in the response body.
 */
export async function refreshSession() {
  try {
    const currentToken = getToken();
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (currentToken && currentToken !== "__cookie_session__") {
      headers["Authorization"] = `Bearer ${currentToken}`;
    }

    const response = await fetch(`${API_BASE_URL}/get-new-token`, {
      method: "POST",
      headers,
      credentials: "include",
    });

    if (!response.ok) {
      console.error("[Auth] Session refresh failed:", response.status);
      return false;
    }

    const text = await response.text();
    const jwt = extractToken(text);
    if (jwt) {
      localStorage.setItem(TOKEN_KEY, jwt);
    }

    return true;
  } catch (error) {
    console.error("[Auth] Session refresh error:", error.message);
    return false;
  }
}

/**
 * Return the stored JWT (or the cookie-session flag).
 * Used by AuthContext to check isAuthenticated and by the API interceptor
 * to attach the Authorization header.
 */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

/**
 * Clear stored JWT (logout). HTTP-only cookies expire on their own.
 */
export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
}

export default { login, refreshSession, getToken, clearTokens };
