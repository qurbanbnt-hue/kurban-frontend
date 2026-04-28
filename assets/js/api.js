const API_BASE_URL = '/api/proxy';

async function callApi(action, data = {}) {
  try {
    const headers = { 'Content-Type': 'application/json' };

    // Sertakan JWT jika ada di localStorage
    const token = localStorage.getItem('authToken');
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}?action=${action}`, {
      method:  'POST',
      headers: headers,
      body:    JSON.stringify(data),
    });

    if (response.status === 401) {
      // Token expired atau tidak valid — paksa logout
      localStorage.clear();
      window.location.href = '/';
      return { success: false, error: 'Sesi berakhir' };
    }

    return await response.json();
  } catch (error) {
    return { success: false, error: 'Gagal terhubung ke server' };
  }
}
