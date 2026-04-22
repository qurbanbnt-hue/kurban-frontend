const API_BASE_URL = '/api/proxy';

async function callApi(action, data = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}?action=${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, error: 'Gagal terhubung ke server' };
  }
}

function checkAuth() {
  const email = localStorage.getItem('userEmail');
  const role = localStorage.getItem('userRole');
  const expiry = Number(localStorage.getItem('loginExpiry'));
  if (!email || !role || isNaN(expiry) || Date.now() > expiry) {
    localStorage.clear();
    return null;
  }
  return { email, role, username: localStorage.getItem('username') };
}