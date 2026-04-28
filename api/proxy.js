// ============================================================
//  PROXY — Security Layer (Zero Trust)
//  Frontend → Proxy (JWT + validasi) → GAS (secret + user)
// ============================================================

import { SignJWT, jwtVerify } from 'jose';

// ── Konfigurasi ──────────────────────────────────────────────
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
const GAS_SECRET      = process.env.GAS_SECRET;
const JWT_SECRET_RAW  = process.env.JWT_SECRET;
const JWT_EXPIRY      = '8h';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

// ── Action whitelist ─────────────────────────────────────────
const PUBLIC_ACTIONS = new Set([
  'login',
  'getPublicStats',
  'searchPekurban',
  'getPekurbanDetail',
  'getDokumentasiWilayah',
]);

const ADMIN_ONLY_ACTIONS = new Set([
  'getAdminData',
  'addHewan', 'updateHewan', 'deleteHewan',
  'addUser',  'updateUser',  'deleteUser',
]);

const USER_ACTIONS = new Set([
  'getHewan',
  'uploadFoto',
  'getDokumentasi',
  'uploadDokumentasi',
  'getFileById',      // menggantikan getPhotoAsBase64 & getDokFotoById
]);

const ALLOWED_ACTIONS = new Set([
  ...PUBLIC_ACTIONS,
  ...ADMIN_ONLY_ACTIONS,
  ...USER_ACTIONS,
]);

// ── MIME whitelist ───────────────────────────────────────────
const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_VIDEO_MIMES = new Set(['video/mp4', 'video/webm']);
const MAX_IMAGE_BYTES = 5  * 1024 * 1024;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

// ── Rate limiting (in-memory) ────────────────────────────────
const rateMap = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT_IP  = 60;
const RATE_LIMIT_USER = 40;

function checkRate(key, limit) {
  const now   = Date.now();
  const entry = rateMap.get(key);
  if (!entry || now - entry.start > RATE_WINDOW_MS) {
    rateMap.set(key, { start: now, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}

setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW_MS * 2;
  for (const [k, v] of rateMap) if (v.start < cutoff) rateMap.delete(k);
}, RATE_WINDOW_MS * 5);

// ── JWT ──────────────────────────────────────────────────────
function jwtKey() {
  return new TextEncoder().encode(JWT_SECRET_RAW);
}

async function signJwt(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(jwtKey());
}

async function verifyJwt(token) {
  const { payload } = await jwtVerify(token, jwtKey());
  return payload;
}

// ── Input validation ─────────────────────────────────────────
function str(v, max = 500) {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}

function validateUploadFoto(body) {
  if (!str(body.nomor_hewan, 50))  return 'nomor_hewan tidak valid';
  if (!['hidup','ditumbangkan','mati'].includes(body.jenis_foto)) return 'jenis_foto tidak valid';
  if (!str(body.mimeType, 50))     return 'mimeType tidak valid';
  if (!ALLOWED_IMAGE_MIMES.has(body.mimeType)) return 'Tipe file tidak diizinkan';
  if (!str(body.base64Data, 10_000_000))        return 'base64Data tidak valid';
  if (Math.ceil(body.base64Data.length * 0.75) > MAX_IMAGE_BYTES) return 'Foto melebihi 5 MB';
  return null;
}

function validateUploadDokumentasi(body) {
  if (!str(body.instansi, 200))          return 'instansi tidak valid';
  if (!str(body.wilayah, 200))           return 'wilayah tidak valid';
  if (!str(body.jenis_dokumentasi, 100)) return 'jenis_dokumentasi tidak valid';
  if (!Array.isArray(body.files) || body.files.length === 0) return 'files tidak valid';
  for (const f of body.files) {
    if (!str(f.mimeType, 50)) return 'mimeType file tidak valid';
    const isImg = ALLOWED_IMAGE_MIMES.has(f.mimeType);
    const isVid = ALLOWED_VIDEO_MIMES.has(f.mimeType);
    if (!isImg && !isVid) return `Tipe tidak diizinkan: ${f.mimeType}`;
    const max  = isVid ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (Math.ceil((f.base64Data || '').length * 0.75) > max) return `File terlalu besar: ${f.fileName}`;
    if (f.fileName) f.fileName = f.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
  }
  return null;
}

function validateHewan(h) {
  if (!h || typeof h !== 'object')  return 'Data hewan tidak valid';
  if (!str(h.nomor_hewan, 50))      return 'nomor_hewan tidak valid';
  if (!str(h.jenis_hewan, 50))      return 'jenis_hewan tidak valid';
  if (!str(h.instansi, 200))        return 'instansi tidak valid';
  if (!str(h.wilayah, 200))         return 'wilayah tidak valid';
  return null;
}

function validateUserData(u) {
  if (!u || typeof u !== 'object')          return 'Data user tidak valid';
  if (!str(u.email, 200))                   return 'email tidak valid';
  if (!str(u.username, 100))                return 'username tidak valid';
  if (!['admin','user'].includes(u.role))   return 'role tidak valid';
  return null;
}

// ── Kirim ke GAS — TIDAK pernah kirim data mentah dari frontend ──
async function callGas(action, data, user = null) {
  if (!APPS_SCRIPT_URL || !GAS_SECRET) throw new Error('Konfigurasi server tidak lengkap');
  const res  = await fetch(`${APPS_SCRIPT_URL}?action=${encodeURIComponent(action)}`, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body:    JSON.stringify({ secret: GAS_SECRET, data, user }),
  });
  return JSON.parse(await res.text());
}

// ── Main handler ──────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store');

  const origin = req.headers.origin || '';
  const allowedOrigin = ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)
    ? origin || '*' : 'null';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ success: false, error: 'Method tidak diizinkan' });

  // Rate limit per IP
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRate(`ip:${ip}`, RATE_LIMIT_IP)) {
    return res.status(429).json({ success: false, error: 'Terlalu banyak permintaan' });
  }

  // Validasi action — whitelist ketat
  const { action } = req.query;
  if (!action || !ALLOWED_ACTIONS.has(action)) {
    return res.status(400).json({ success: false, error: 'Action tidak valid' });
  }

  // Body size limit
  if (parseInt(req.headers['content-length'] || '0', 10) > 25 * 1024 * 1024) {
    return res.status(413).json({ success: false, error: 'Payload terlalu besar' });
  }

  const body = req.body || {};

  // ── LOGIN — proxy yang handle, bukan GAS ─────────────────────
  if (action === 'login') {
    const { email, password } = body;
    if (!str(email, 200) || !str(password, 200)) {
      return res.status(400).json({ success: false, error: 'Email dan password harus diisi' });
    }
    try {
      // Proxy kirim ke GAS hanya untuk verifikasi kredensial
      // GAS tidak generate token — itu tugas proxy
      const result = await callGas('verifyCredentials', {
        email: email.trim().toLowerCase(),
        password,
      }, null);

      if (!result.success) {
        return res.status(401).json({ success: false, error: 'Email atau password salah' });
      }

      // JWT dibuat di proxy — email & role dari GAS, bukan dari body frontend
      const token = await signJwt({
        email:    result.email,
        role:     result.role,
        username: result.username,
      });

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

  // ── PUBLIC ACTIONS ───────────────────────────────────────────
  if (PUBLIC_ACTIONS.has(action)) {
    // Sanitasi: hanya ambil field yang dibutuhkan, buang sisanya
    const safeData = sanitizePublicData(action, body);
    try {
      const result = await callGas(action, safeData, null);
      return res.status(200).json(result);
    } catch {
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  // ── PROTECTED — wajib JWT ────────────────────────────────────
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Token tidak ditemukan' });
  }

  let user;
  try {
    user = await verifyJwt(authHeader.slice(7));
  } catch {
    return res.status(401).json({ success: false, error: 'Token tidak valid atau expired' });
  }

  // Rate limit per user
  if (!checkRate(`user:${user.email}`, RATE_LIMIT_USER)) {
    return res.status(429).json({ success: false, error: 'Terlalu banyak permintaan' });
  }

  // RBAC
  if (ADMIN_ONLY_ACTIONS.has(action) && user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Akses ditolak' });
  }

  // Input validation
  let err = null;
  if (action === 'uploadFoto')        err = validateUploadFoto(body);
  if (action === 'uploadDokumentasi') err = validateUploadDokumentasi(body);
  if (action === 'addHewan')          err = validateHewan(body.hewan);
  if (action === 'updateHewan')       err = validateHewan(body.hewan);
  if (action === 'addUser')           err = validateUserData(body.newUser);
  if (action === 'updateUser')        err = validateUserData(body.user);
  if (action === 'getFileById' && !str(body.fileId, 100)) err = 'fileId tidak valid';

  if (err) return res.status(400).json({ success: false, error: err });

  // Bangun data yang aman — TIDAK pernah forward body mentah
  // email/role dari JWT, bukan dari body frontend
  const safeData = buildSafeData(action, body);

  try {
    const result = await callGas(action, safeData, {
      email: user.email,
      role:  user.role,
    });
    return res.status(200).json(result);
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// ── Sanitasi data public (hanya ambil field yang diperlukan) ──
function sanitizePublicData(action, body) {
  if (action === 'searchPekurban')    return { query: String(body.query || '').slice(0, 100) };
  if (action === 'getPekurbanDetail') return {
    nama:        String(body.nama        || '').slice(0, 200),
    nomor_hewan: String(body.nomor_hewan || '').slice(0, 50),
  };
  if (action === 'getDokumentasiWilayah') return { wilayah: String(body.wilayah || '').slice(0, 200) };
  return {};
}

// ── Bangun data aman per action — tidak forward body mentah ──
function buildSafeData(action, body) {
  switch (action) {
    case 'getHewan':
    case 'getDokumentasi':
    case 'getAdminData':
      return {}; // user dari JWT sudah cukup

    case 'uploadFoto':
      return {
        nomor_hewan: body.nomor_hewan,
        jenis_foto:  body.jenis_foto,
        base64Data:  body.base64Data,
        mimeType:    body.mimeType,
        username:    body.username ? String(body.username).slice(0, 100) : undefined,
      };

    case 'uploadDokumentasi':
      return {
        instansi:          body.instansi,
        wilayah:           body.wilayah,
        jenis_dokumentasi: body.jenis_dokumentasi,
        files:             body.files,
        username:          body.username ? String(body.username).slice(0, 100) : undefined,
      };

    case 'addHewan':
    case 'updateHewan':
      return { hewan: body.hewan };

    case 'deleteHewan':
      return { nomor_hewan: String(body.nomor_hewan || '').slice(0, 50) };

    case 'addUser':
      return { newUser: body.newUser };

    case 'updateUser':
      return { user: body.user };

    case 'deleteUser':
      return { targetEmail: String(body.targetEmail || '').slice(0, 200) };

    case 'getFileById':
      // TIDAK pernah terima fileUrl — hanya fileId
      return { fileId: String(body.fileId || '').slice(0, 100) };

    default:
      return {};
  }
}
