// ============================================================
//  AUTH HELPERS — Shared across Admin & User portals
//  Key localStorage: authToken, userEmail, username,
//                    userRole, loginExpiry
// ============================================================

/**
 * Ambil semua data auth dari localStorage.
 * @returns {{ token: string|null, email: string|null, username: string|null, role: string|null, expiry: number }}
 */
function getAuthData() {
  try {
    return {
      token:    localStorage.getItem('authToken'),
      email:    localStorage.getItem('userEmail'),
      username: localStorage.getItem('username'),
      role:     localStorage.getItem('userRole'),
      expiry:   Number(localStorage.getItem('loginExpiry') || '0'),
    };
  } catch (e) {
    return { token: null, email: null, username: null, role: null, expiry: 0 };
  }
}

/**
 * Cek sesi dan redirect ke landing page jika tidak valid.
 * @param {string|null} requiredRole - 'admin', 'user', atau null (tidak cek role)
 * @returns {{ token, email, username, role, expiry }|null} — null jika sudah di-redirect
 */
function initAuth(requiredRole) {
  const auth = getAuthData();

  // Tidak ada token, email, atau sesi sudah expired
  if (!auth.token || !auth.email || isNaN(auth.expiry) || Date.now() > auth.expiry) {
    localStorage.clear();
    window.location.href = '/';
    return null;
  }

  // Role tidak sesuai
  if (requiredRole && auth.role !== requiredRole) {
    localStorage.clear();
    window.location.href = '/';
    return null;
  }

  return auth;
}

/**
 * Logout: hapus semua data auth dan redirect ke landing page.
 */
function logout() {
  localStorage.clear();
  window.location.href = '/';
}

/**
 * Auto-logout saat sesi expired. Cek setiap intervalMs milidetik.
 * @param {number} expiredAt  - timestamp expiry dalam milidetik
 * @param {number} intervalMs - interval pengecekan (default: 60000 ms)
 * @returns {number} intervalId — bisa dipakai untuk clearInterval jika perlu
 */
function startSessionWatcher(expiredAt, intervalMs) {
  intervalMs = intervalMs || 60000;
  return setInterval(function () {
    if (Date.now() > expiredAt) {
      logout();
    }
  }, intervalMs);
}
