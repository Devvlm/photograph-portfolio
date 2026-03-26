/**
 * Authentication Service
 * Handles admin authentication with Cloudflare Worker API
 * Password-only authentication (no email required)
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

export const authService = {
  /**
   * Sign in with password only
   * @param {string} password
   * @returns {Promise<Object>}
   */
  async signIn(password) {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(error.error || 'Invalid password');
    }

    const data = await response.json();

    // Store token and expiry
    localStorage.setItem('admin_token', data.token);
    localStorage.setItem('admin_token_expiry', String(Date.now() + data.expiresIn * 1000));

    return data;
  },

  /**
   * Sign out the current user
   * @returns {Promise<void>}
   */
  async signOut() {
    // Clear local storage
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_token_expiry');

    // Optionally notify the server (JWT is stateless, so this is mainly for logging)
    try {
      const token = this.getToken();
      if (token) {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      // Ignore logout errors, token is already cleared
      console.warn('Logout notification failed:', error);
    }
  },

  /**
   * Get the current token
   * @returns {string|null}
   */
  getToken() {
    const token = localStorage.getItem('admin_token');
    const expiry = localStorage.getItem('admin_token_expiry');

    if (!token || !expiry) {
      return null;
    }

    // Check if token is expired
    if (Date.now() > parseInt(expiry, 10)) {
      this.signOut();
      return null;
    }

    return token;
  },

  /**
   * Get the current session (compatibility method)
   * @returns {Promise<Object|null>}
   */
  async getSession() {
    const token = this.getToken();
    if (!token) return null;

    // Verify token with server
    try {
      const response = await fetch(`${API_BASE}/api/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        this.signOut();
        return null;
      }

      const data = await response.json();
      return { user: data.user, token };
    } catch (error) {
      console.error('Session verification failed:', error);
      return null;
    }
  },

  /**
   * Check if user is authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    return !!this.getToken();
  },

  /**
   * Get authorization headers for API calls
   * @returns {Object}
   */
  getAuthHeaders() {
    const token = this.getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  },

  /**
   * Subscribe to auth state changes (compatibility method)
   * Note: This is simplified compared to Supabase's real-time updates
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  onAuthStateChange(callback) {
    // Check initial state
    const token = this.getToken();
    if (token) {
      callback('SIGNED_IN', { user: { sub: 'admin' }, token });
    }

    // Set up periodic check for token expiry
    const interval = setInterval(() => {
      const currentToken = this.getToken();
      if (!currentToken && token) {
        callback('SIGNED_OUT', null);
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }
};
