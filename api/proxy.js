// ============================================================
//  PROXY — Vercel Serverless Function
//  Meneruskan request ke Google Apps Script
// ============================================================

// Daftar action yang diizinkan — tolak semua yang tidak ada di sini
const ALLOWED_ACTIONS = new Set([
  'login',
  'getPublicStats',
  'getHewan',
  'uploadFoto',
  'getDokumentasi',
  'uploadDokumentasi',
  'getAdminData',
  'addHewan',
  'updateHewan',
  'deleteHewan',
  'addUser',
  'updateUser',
  'deleteUser',
  'searchPekurban',
  'getPekurbanDetail',
  'getPhotoAsBase64',
  'getDokumentasiWilayah',
  'getDokFotoById',
]);

// Domain yang diizinkan mengakses API ini
// Isi dengan domain Vercel kamu, contoh: 'https://kurban.vercel.app'
// Kosongkan array untuk menonaktifkan CORS restriction (tidak disarankan di production)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Rate limiting sederhana — in-memory per instance Vercel
// Untuk production skala besar gunakan Upstash Redis
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 menit
const RATE_LIMIT_MAX       = 60;     // max 60 request per menit per IP

function checkRateLimit(ip) {
  const now  = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return true;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return false;
  return true;
}

// Bersihkan map secara berkala agar tidak memory leak
setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS * 2;
  for (const [ip, entry] of rateLimitMap) {
    if (entry.start < cutoff) rateLimitMap.delete(ip);
  }
}, RATE_LIMIT_WINDOW_MS * 5);

export default async function handler(req, res) {
  // ── Security headers ──────────────────────────────────────
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // ── CORS ─────────────────────────────────────────────────
  const origin = req.headers.origin || '';
  const corsOrigin = ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)
    ? origin || '*'
    : 'null';

  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // ── Rate limiting ─────────────────────────────────────────
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';

  if (!checkRateLimit(ip)) {
    return res.status(429).json({ success: false, error: 'Terlalu banyak permintaan. Coba lagi sebentar.' });
  }

  // ── Validasi action ───────────────────────────────────────
  const { action } = req.query;
  if (!action || !ALLOWED_ACTIONS.has(action)) {
    return res.status(400).json({ success: false, error: 'Action tidak valid' });
  }

  // ── Batasi ukuran body (10 MB) ────────────────────────────
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > 10 * 1024 * 1024) {
    return res.status(413).json({ success: false, error: 'Payload terlalu besar (maks. 10 MB)' });
  }

  // ── Cek konfigurasi ───────────────────────────────────────
  const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
  if (!APPS_SCRIPT_URL) {
    return res.status(500).json({ success: false, error: 'Konfigurasi server tidak lengkap' });
  }

  // ── Forward ke Apps Script ────────────────────────────────
  try {
    const response = await fetch(`${APPS_SCRIPT_URL}?action=${encodeURIComponent(action)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(req.body),
    });

    const text = await response.text();

    try {
      const json = JSON.parse(text);
      return res.status(200).json(json);
    } catch {
      // Jangan bocorkan isi response mentah ke client
      console.error('[proxy] Apps Script non-JSON response, length:', text.length);
      return res.status(502).json({ success: false, error: 'Respons server tidak valid' });
    }
  } catch (error) {
    console.error('[proxy] Fetch error:', error.message);
    return res.status(503).json({ success: false, error: 'Gagal terhubung ke server' });
  }
}
