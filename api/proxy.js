// ============================================================
//  PROXY — Security Layer
//  Semua request frontend masuk sini dulu sebelum ke GAS.
//  Proxy bertanggung jawab atas:
//    - JWT authentication & issuance
//    - RBAC (role-based access control)
//    - Input validation
//    - File upload validation
//    - Rate limiting
//    - Meneruskan request ke GAS dengan GAS_SECRET
// ============================================================

import { SignJWT, jwtVerify } from 'jose';

// ── Konfigurasi ──────────────────────────────────────────────
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
const GAS_SECRET      = process.env.GAS_SECRET;
const JWT_SECRET_RAW  = process.env.JWT_SECRET;
const JWT_EXPIRY      = '8h';

// Domain yang diizinkan
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

// Action yang boleh diakses tanpa token
const PUBLIC_ACTIONS = new Set([
  'login',
  'getPublicStats',
  'searchPekurban',
  'getPekurbanDetail',
  'getDokumentasiWilayah',
]);

// Action yang hanya boleh diakses role admin
const ADMIN_ONLY_ACTIONS = new Set([
  'getAdminData',
  'addHewan',
  'updateHewan',
  'deleteHewan',
  'addUser',
  'updateUser',
  'deleteUser',
]);

// Semua action yang diizinkan (whitelist)
const ALLOWED_ACTIONS = new Set([
  ...PUBLIC_ACTIONS,
  ...ADMIN_ONLY_ACTIONS,
  'getHewan',
  'uploadFoto',
  'getDokumentasi',
  'uploadDokumentasi',
  'getPhotoAsBase64',
  'getDokFotoById',
]);

// MIME type yang diizinkan untuk upload
const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_VIDEO_MIMES = new Set(['video/mp4', 'video/webm']);
const MAX_IMAGE_BYTES = 5  * 1024 * 1024; // 5 MB
const MAX_VIDEO_BYTES = 20 * 1024 * 1024; // 20 MB

// ── Rate Limiting (in-memory per instance) ───────────────────
const rateMap = new Map();
const RATE_WINDOW = 60_000;
const RATE_LIMIT  = 60;

function checkRate(key) {
  const now   = Date.now();
  const entry = rateMap.get(key);
  if (!entry || now - entry.start > RATE_WINDOW) {
    rateMap.set(key, { start: now, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW * 2;
  for (const [k, v] of rateMap) if (v.start < cutoff) rateMap.delete(k);
}, RATE_WINDOW * 5);

// ── JWT helpers ───────────────────────────────────────────────
function getJwtSecret() {
  return new TextEncoder().encode(JWT_SECRET_RAW);
}

async function signJwt(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(getJwtSecret());
}

async function verifyJwt(token) {
  const { payload } = await jwtVerify(token, getJwtSecret());
  return payload; // { email, role, iat, exp }
}

// ── Input validation helpers ──────────────────────────────────
function isString(v, max = 500) {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}

function validateUploadFoto(body) {
  const { nomor_hewan, jenis_foto, base64Data, mimeType } = body;
  if (!isString(nomor_hewan, 50))  return 'nomor_hewan tidak valid';
  if (!['hidup','ditumbangkan','mati'].includes(jenis_foto)) return 'jenis_foto tidak valid';
  if (!isString(mimeType, 50))     return 'mimeType tidak valid';
  if (!ALLOWED_IMAGE_MIMES.has(mimeType)) return 'Tipe file tidak diizinkan';
  if (!isString(base64Data, 10_000_000)) return 'base64Data tidak valid';
  // Estimasi ukuran dari base64
  const estimatedBytes = Math.ceil(base64Data.length * 0.75);
  if (estimatedBytes > MAX_IMAGE_BYTES) return 'Ukuran foto melebihi 5 MB';
  return null;
}

function validateUploadDokumentasi(body) {
  const { instansi, wilayah, jenis_dokumentasi, files } = body;
  if (!isString(instansi, 200))          return 'instansi tidak valid';
  if (!isString(wilayah, 200))           return 'wilayah tidak valid';
  if (!isString(jenis_dokumentasi, 100)) return 'jenis_dokumentasi tidak valid';
  if (!Array.isArray(files) || files.length === 0) return 'files tidak valid';
  for (const f of files) {
    if (!isString(f.mimeType, 50)) return 'mimeType file tidak valid';
    const isImage = ALLOWED_IMAGE_MIMES.has(f.mimeType);
    const isVideo = ALLOWED_VIDEO_MIMES.has(f.mimeType);
    if (!isImage && !isVideo) return `Tipe file tidak diizinkan: ${f.mimeType}`;
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    const estimatedBytes = Math.ceil((f.base64Data || '').length * 0.75);
    if (estimatedBytes > maxBytes) return `File terlalu besar: ${f.fileName}`;
    // Sanitasi nama file
    if (f.fileName) f.fileName = f.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
  }
  return null;
}

function validateHewan(hewan) {
  if (!hewan || typeof hewan !== 'object') return 'Data hewan tidak valid';
  if (!isString(hewan.nomor_hewan, 50))    return 'nomor_hewan tidak valid';
  if (!isString(hewan.jenis_hewan, 50))    return 'jenis_hewan tidak valid';
  if (!isString(hewan.instansi, 200))      return 'instansi tidak valid';
  if (!isString(hewan.wilayah, 200))       return 'wilayah tidak valid';
  return null;
}

function validateUser(user) {
  if (!user || typeof user !== 'object') return 'Data user tidak valid';
  if (!isString(user.email, 200))        return 'email tidak valid';
  if (!isString(user.username, 100))     return 'username tidak valid';
  if (!['admin','user'].includes(user.role)) return 'role tidak valid';
  return null;
}

// ── Kirim request ke GAS ──────────────────────────────────────
async function callGas(action, data, user = null) {
  if (!APPS_SCRIPT_URL || !GAS_SECRET) {
    throw new Error('Konfigurasi server tidak lengkap');
  }
  const body = { action, data, secret: GAS_SECRET, user };
  const res  = await fetch(`${APPS_SCRIPT_URL}?action=${encodeURIComponent(action)}`, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body:    JSON.stringify(body),
  });
  const text = await res.text();
  return JSON.parse(text);
}

// ── Main handler ──────────────────────────────────────────────
export default async function handler(req, res) {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // CORS
  const origin     = req.headers.origin || '';
  const corsOrigin = ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)
    ? origin || '*' : 'null';
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ success: false, error: 'Method tidak diizinkan' });

  // Rate limiting per IP
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRate(ip)) {
    return res.status(429).json({ success: false, error: 'Terlalu banyak permintaan. Coba lagi sebentar.' });
  }

  // Validasi action
  const { action } = req.query;
  if (!action || !ALLOWED_ACTIONS.has(action)) {
    return res.status(400).json({ success: false, error: 'Action tidak valid' });
  }

  // Body size limit
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > 25 * 1024 * 1024) {
    return res.status(413).json({ success: false, error: 'Payload terlalu besar' });
  }

  const body = req.body || {};

  // ── LOGIN — satu-satunya endpoint yang generate JWT ──────────
  if (action === 'login') {
    const { email, password } = body;
    if (!isString(email, 200) || !isString(password, 200)) {
      return res.status(400).json({ success: false, error: 'Email dan password harus diisi' });
    }
    try {
      const result = await callGas('login', { email: email.trim(), password });
      if (!result.success) {
        return res.status(401).json({ success: false, error: result.error || 'Login gagal' });
      }
      // Generate JWT — email & role dari GAS, bukan dari frontend
      const token = await signJwt({ email: result.email, role: result.role });
      return res.status(200).json({
        success:  true,
        token,
        email:    result.email,
        username: result.username,
        role:     result.role,
      });
    } catch {
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  // ── PUBLIC ACTIONS — tidak perlu token ───────────────────────
  if (PUBLIC_ACTIONS.has(action)) {
    try {
      const result = await callGas(action, body, null);
      return res.status(200).json(result);
    } catch {
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  // ── PROTECTED ACTIONS — wajib JWT ────────────────────────────
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Token tidak ditemukan' });
  }
  const token = authHeader.slice(7);
  let user;
  try {
    user = await verifyJwt(token); // { email, role }
  } catch {
    return res.status(401).json({ success: false, error: 'Token tidak valid atau sudah expired' });
  }

  // Rate limiting per user (lebih ketat dari per IP)
  if (!checkRate(`user:${user.email}`)) {
    return res.status(429).json({ success: false, error: 'Terlalu banyak permintaan' });
  }

  // RBAC — admin only
  if (ADMIN_ONLY_ACTIONS.has(action) && user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Akses ditolak' });
  }

  // ── Input validation per action ───────────────────────────────
  let validationError = null;
  if (action === 'uploadFoto')        validationError = validateUploadFoto(body);
  if (action === 'uploadDokumentasi') validationError = validateUploadDokumentasi(body);
  if (action === 'addHewan')          validationError = validateHewan(body.hewan);
  if (action === 'updateHewan')       validationError = validateHewan(body.hewan);
  if (action === 'addUser')           validationError = validateUser(body.newUser);
  if (action === 'updateUser')        validationError = validateUser(body.user);

  if (validationError) {
    return res.status(400).json({ success: false, error: validationError });
  }

  // ── Teruskan ke GAS dengan user object dari JWT ───────────────
  try {
    // Hapus field email dari body — proxy yang tentukan user, bukan frontend
    const safeBody = { ...body };
    delete safeBody.email; // jangan percaya email dari frontend

    const result = await callGas(action, safeBody, { email: user.email, role: user.role });
    return res.status(200).json(result);
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
