const API_BASE_URL = '/api/proxy';

// Cache sederhana untuk GET-like actions (public stats, data hewan)
const _cache = new Map();
const CACHE_TTL = 60_000; // 1 menit

const CACHEABLE_ACTIONS = new Set(['getPublicStats', 'getHewan', 'getDokumentasi']);

async function callApi(action, data = {}, { skipCache = false } = {}) {
  // Cek cache untuk action yang bisa di-cache
  if (!skipCache && CACHEABLE_ACTIONS.has(action)) {
    const cached = _cache.get(action);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return cached.data;
    }
  }

  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('authToken');
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let lastError;
  // Retry 1x untuk network error (bukan 4xx/5xx)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(`${API_BASE_URL}?action=${action}`, {
        method:  'POST',
        headers: headers,
        body:    JSON.stringify(data),
      });

      if (response.status === 401) {
        localStorage.clear();
        window.location.href = '/';
        return { success: false, error: 'Sesi berakhir' };
      }

      const result = await response.json();

      // Simpan ke cache jika berhasil
      if (result.success && CACHEABLE_ACTIONS.has(action)) {
        _cache.set(action, { ts: Date.now(), data: result });
      }

      return result;
    } catch (err) {
      lastError = err;
      if (attempt === 0) await new Promise(r => setTimeout(r, 800)); // tunggu 800ms sebelum retry
    }
  }

  return { success: false, error: 'Gagal terhubung ke server' };
}

// Invalidasi cache (dipanggil setelah mutasi data)
function invalidateCache(action) {
  if (action) {
    _cache.delete(action);
  } else {
    _cache.clear();
  }
}

// Debounce utility — dipakai untuk search input
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
