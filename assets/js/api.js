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