// ============================================================
//  PROXY — Security Layer (Zero Trust)
//  Frontend → Proxy (JWT + validasi) → GAS (secret + user)
// ============================================================

import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';

// ── Konfigurasi ──────────────────────────────────────────────
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
const GAS_SECRET      = process.env.GAS_SECRET;
const JWT_SECRET_RAW  = process.env.JWT_SECRET;
const CSRF_SECRET     = process.env.CSRF_SECRET || 'default-csrf-secret-change-in-prod';
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
  // Kupon Masjid — public (no JWT required)
  'checkNomorWA', 'registerMasjid', 'verifyOTP', 'requestOTP', 'getKonfigSistem',
]);

const ADMIN_ONLY_ACTIONS = new Set([
  'getAdminData',
  'addHewan', 'updateHewan', 'deleteHewan',
  'addUser',  'updateUser',  'deleteUser',
  // Kupon Masjid — admin only
  'getRegistrations', 'getKKDetail', 'getKKPerluVerifikasi', 'resolveKKVerifikasi',
  'setJatah', 'togglePeriodePendaftaran', 'revokeTokenMasjid', 'updateNomorWAMasjid',
  'hapusMasjid', 'blokirMasjid', 'bukaBlokirMasjid', 'blokirNomorWA', 'bukaBlokirNomorWA',
  'getNomorDiblokir', 'rejectRegistration',
]);

const USER_ACTIONS = new Set([
  'getHewan',
  'uploadFoto',
  'getDokumentasi',
  'uploadDokumentasi',
  'getFileById',
  // Kupon Masjid — panitia lokasi (JWT required, role user/admin)
  'validateKupon', 'konfirmasiPengambilan',
]);

// Kupon Masjid — masjid actions (JWT required, any role)
const MASJID_ACTIONS = new Set([
  'uploadKK', 'konfirmasiAnggota', 'konfirmasiAnggotaManual', 'konfirmasiSelesaiUpload', 'getKuponMasjid', 'getDashboardMasjid',
]);

const ALLOWED_ACTIONS = new Set([
  ...PUBLIC_ACTIONS,
  ...ADMIN_ONLY_ACTIONS,
  ...USER_ACTIONS,
  ...MASJID_ACTIONS,
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

// ── CSRF Token Generation ────────────────────────────────────
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

function validateCsrfToken(token, expectedToken) {
  if (!token || !expectedToken) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken));
}

// ── Request ID Tracking (for audit logging) ──────────────────
function generateRequestId() {
  return crypto.randomBytes(12).toString('hex');
}

// ── Sanitized Logging (no sensitive data) ────────────────────
function logSecure(requestId, message, sensitiveData = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${requestId}] ${message}`;
  if (process.env.NODE_ENV === 'development') {
    console.log(logMessage);
    if (sensitiveData) console.log('DEBUG:', sensitiveData);
  } else {
    // Production: send to logging service without sensitive data
    console.log(logMessage);
  }
}

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
  if (!str(body.jenis_hewan, 50))  return 'jenis_hewan tidak valid';
  if (!str(body.instansi, 200))    return 'instansi tidak valid';
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

function validateUploadKK(body) {
  const mimeType = String(body.mime_type || '');
  if (!ALLOWED_IMAGE_MIMES.has(mimeType)) return 'Tipe file tidak diizinkan. Gunakan JPEG, PNG, atau WEBP.';
  const base64 = String(body.file_base64 || '');
  if (Math.ceil(base64.length * 0.75) > MAX_IMAGE_BYTES) return 'Ukuran file melebihi 5 MB';
  return null;
}

function validatePagination(body) {
  const page = Number(body.page) || 1;
  const limit = Number(body.limit) || 50;
  if (page < 1) return 'page harus >= 1';
  if (limit < 1 || limit > 500) return 'limit harus antara 1-500';
  return null;
}

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
  const requestId = generateRequestId();
  
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Request-ID', requestId);
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'");
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  const origin = req.headers.origin || '';
  const allowedOrigin = ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)
    ? origin || '*' : 'null';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ success: false, error: 'Method tidak diizinkan' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRate(`ip:${ip}`, RATE_LIMIT_IP)) {
    res.setHeader('Retry-After', '60');
    logSecure(requestId, `RATE_LIMIT_IP exceeded for IP: ${ip}`);
    return res.status(429).json({ success: false, error: 'Terlalu banyak permintaan' });
  }

  const { action } = req.query;
  if (!action || !ALLOWED_ACTIONS.has(action)) {
    logSecure(requestId, `Invalid action attempted: ${action}`);
    return res.status(400).json({ success: false, error: 'Action tidak valid' });
  }

  const body = req.body || {};

  // ── Validasi ukuran body dari konten aktual ──
  const bodySize = Buffer.byteLength(JSON.stringify(body), 'utf8');
  if (bodySize > 25 * 1024 * 1024) {
    logSecure(requestId, `Payload too large: ${bodySize} bytes`);
    return res.status(413).json({ success: false, error: 'Payload terlalu besar' });
  }

  if (action === 'login') {
    const { email, password } = body;
    if (!str(email, 200) || !str(password, 200)) {
      logSecure(requestId, 'Login: Missing email or password');
      return res.status(400).json({ success: false, error: 'Email dan password harus diisi' });
    }
    try {
      const result = await callGas('verifyCredentials', {
        email: email.trim().toLowerCase(),
        password,
      }, null);

      if (!result.success) {
        logSecure(requestId, `Login failed: invalid credentials for email ${email.split('@')[0]}@***`);
        // Add 2s delay on failed login to slow down brute force
        await new Promise(r => setTimeout(r, 2000));
        return res.status(401).json({ success: false, error: 'Email atau password salah' });
      }

      const token = await signJwt({
        email:    result.email,
        role:     result.role,
        username: result.username,
      });

      logSecure(requestId, `Login success: ${result.email.split('@')[0]}@***, role: ${result.role}`);

      // Set httpOnly, Secure, SameSite cookie (recommended for production)
      // Note: SPA should use localStorage + Bearer token, OR use this secure cookie approach
      res.setHeader('Set-Cookie', [
        `authToken=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`,
        `userEmail=${encodeURIComponent(result.email)}; Path=/; Secure; SameSite=Strict; Max-Age=28800`,
      ]);

      return res.status(200).json({
        success:  true,
        token,
        email:    result.email,
        username: result.username,
        role:     result.role,
      });
    } catch (err) {
      logSecure(requestId, `Login error: ${err.message}`);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  if (PUBLIC_ACTIONS.has(action)) {
    const safeData = sanitizePublicData(action, body);
    try {
      const result = await callGas(action, safeData, null);
      return res.status(200).json(result);
    } catch {
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  // ── MASJID_ACTIONS — tidak perlu JWT, hanya session_token ────
  if (MASJID_ACTIONS.has(action)) {
    const safeData = buildSafeData(action, body);
    try {
      const result = await callGas(action, safeData, null);
      return res.status(200).json(result);
    } catch (err) {
      logSecure(requestId, `MASJID_ACTION error for ${action}: ${err.message}`);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  // ── PROTECTED — wajib JWT ────────────────────────────────────
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    logSecure(requestId, `Missing or invalid auth header for action: ${action}`);
    return res.status(401).json({ success: false, error: 'Token tidak ditemukan' });
  }

  let user;
  try {
    user = await verifyJwt(authHeader.slice(7));
  } catch (err) {
    logSecure(requestId, `JWT verification failed: ${err.message}`);
    return res.status(401).json({ success: false, error: 'Token tidak valid atau expired' });
  }

  if (!checkRate(`user:${user.email}`, RATE_LIMIT_USER)) {
    res.setHeader('Retry-After', '60');
    logSecure(requestId, `RATE_LIMIT_USER exceeded for user: ${user.email.split('@')[0]}@***`);
    return res.status(429).json({ success: false, error: 'Terlalu banyak permintaan' });
  }

  if (ADMIN_ONLY_ACTIONS.has(action) && user.role !== 'admin') {
    logSecure(requestId, `Unauthorized access attempt: user ${user.email.split('@')[0]}@*** tried ${action}`);
    return res.status(403).json({ success: false, error: 'Akses ditolak' });
  }

  let err = null;
  if (action === 'uploadFoto')        err = validateUploadFoto(body);
  if (action === 'uploadDokumentasi') err = validateUploadDokumentasi(body);
  if (action === 'addHewan')          err = validateHewan(body.hewan);
  if (action === 'updateHewan')       err = validateHewan(body.hewan);
  if (action === 'addUser')           err = validateUserData(body.newUser);
  if (action === 'updateUser')        err = validateUserData(body.user);
  if (action === 'getFileById' && !str(body.fileId, 100)) err = 'fileId tidak valid';
  if (action === 'uploadKK')          err = validateUploadKK(body);
  // Add pagination validation for list endpoints
  if (['getRegistrations', 'getKKDetail', 'getKKPerluVerifikasi'].includes(action)) {
    err = validatePagination(body);
  }

  if (err) {
    logSecure(requestId, `Validation error for ${action}: ${err}`);
    return res.status(400).json({ success: false, error: err });
  }

  const safeData = buildSafeData(action, body);

  try {
    logSecure(requestId, `Processing ${action} for ${user.email.split('@')[0]}@***`);
    const result = await callGas(action, safeData, {
      email: user.email,
      role:  user.role,
    });
    return res.status(200).json(result);
  } catch (err) {
    logSecure(requestId, `GAS call error for ${action}: ${err.message}`);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

function sanitizePublicData(action, body) {
  if (action === 'searchPekurban')    return { query: String(body.query || '').slice(0, 100) };
  if (action === 'getPekurbanDetail') return {
    nama:        String(body.nama        || '').slice(0, 200),
    nomor_hewan: String(body.nomor_hewan || '').slice(0, 50),
    instansi:    String(body.instansi    || '').slice(0, 200),
  };
  if (action === 'getDokumentasiWilayah') return { wilayah: String(body.wilayah || '').slice(0, 200) };
  // Kupon Masjid public actions
  if (action === 'checkNomorWA') {
    const telepon = String(body.telepon_pic || '').trim();
    if (!/^(\+628|08)\d{7,13}$/.test(telepon)) return {};
    return { telepon_pic: telepon.slice(0, 20) };
  }
  if (action === 'requestOTP') {
    const telepon = String(body.telepon_pic || '').trim();
    if (!/^(\+628|08)\d{7,13}$/.test(telepon)) return {};
    return { telepon_pic: telepon.slice(0, 20) };
  }
  if (action === 'getKonfigSistem') return {};
  if (action === 'verifyOTP')       return { masjid_id: String(body.masjid_id || '').slice(0, 20), otp_code: String(body.otp_code || '').slice(0, 6) };
  if (action === 'registerMasjid')  return {
    nama_masjid: String(body.nama_masjid || '').slice(0, 200),
    alamat:      String(body.alamat      || '').slice(0, 500),
    kecamatan:   String(body.kecamatan   || '').slice(0, 100),
    kabupaten:   String(body.kabupaten   || '').slice(0, 100),
    nama_pic:    String(body.nama_pic    || '').slice(0, 200),
    telepon_pic: String(body.telepon_pic || '').slice(0, 20),
  };
  return {};
}

function buildSafeData(action, body) {
  switch (action) {
    case 'getHewan':
    case 'getDokumentasi':
    case 'getAdminData':
      return {};

    case 'uploadFoto':
      return {
        nomor_hewan: body.nomor_hewan,
        jenis_hewan: body.jenis_hewan,
        instansi:    body.instansi,
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
      return {
        nomor_hewan: String(body.nomor_hewan || '').slice(0, 50),
        instansi:    String(body.instansi    || '').slice(0, 200),
      };

    case 'addUser':
      return { newUser: body.newUser };

    case 'updateUser':
      return { user: body.user };

    case 'deleteUser':
      return { targetEmail: String(body.targetEmail || '').slice(0, 200) };

    case 'getFileById':
      return { fileId: String(body.fileId || '').slice(0, 100) };

    // ── Kupon Masjid — Masjid ────────────────────────────────
    case 'uploadKK': {
      const mimeType = String(body.mime_type || '').slice(0, 50);
      if (!ALLOWED_IMAGE_MIMES.has(mimeType)) return {};
      const base64 = String(body.file_base64 || '');
      if (Math.ceil(base64.length * 0.75) > MAX_IMAGE_BYTES) return {};
      return {
        masjid_id:     String(body.masjid_id     || '').slice(0, 20),
        session_token: String(body.session_token || '').slice(0, 40),
        file_base64:   base64,
        mime_type:     mimeType,
        file_name:     String(body.file_name || '').slice(0, 200)
      };
    }
    case 'konfirmasiAnggota':
      return {
        masjid_id:     String(body.masjid_id     || '').slice(0, 20),
        session_token: String(body.session_token || '').slice(0, 40),
        kk_id:         String(body.kk_id         || '').slice(0, 30),
        alamat_kk:     String(body.alamat_kk     || '').trim().slice(0, 500),
        anggota_data:  Array.isArray(body.anggota_data) ? body.anggota_data.slice(0, 50).map(a => ({ nama: String(a.nama || '').slice(0, 200), jk: String(a.jk || '').slice(0, 1), umur: Number(a.umur) || 0 })) : [],
      };
    case 'konfirmasiAnggotaManual':
      return {
        masjid_id:     String(body.masjid_id     || '').slice(0, 20),
        session_token: String(body.session_token || '').slice(0, 40),
        kk_id:         String(body.kk_id         || '').slice(0, 30),
        nomor_kk:      String(body.nomor_kk      || '').replace(/\D/g, '').slice(0, 16),
        alamat_kk:     String(body.alamat_kk     || '').trim().slice(0, 500),
        anggota_data:  Array.isArray(body.anggota_data) ? body.anggota_data.slice(0, 50).map(a => ({ nama: String(a.nama || '').slice(0, 200), jk: String(a.jk || '').slice(0, 1), umur: Number(a.umur) || 0 })) : [],
      };
    case 'konfirmasiSelesaiUpload':
      return {
        masjid_id:     String(body.masjid_id     || '').slice(0, 20),
        session_token: String(body.session_token || '').slice(0, 40)
      };
    case 'getKuponMasjid':
      return {
        masjid_id:     String(body.masjid_id     || '').slice(0, 20),
        session_token: String(body.session_token || '').slice(0, 40)
      };
    case 'getDashboardMasjid':
      return {
        masjid_id:     String(body.masjid_id     || '').slice(0, 20),
        session_token: String(body.session_token || '').slice(0, 40)
      };

    // ── Kupon Masjid — Admin ─────────────────────────────────
    case 'getRegistrations': return {};
    case 'getKKDetail':          return { masjid_id: String(body.masjid_id || '').slice(0, 20) };
    case 'getKKPerluVerifikasi': return { masjid_id: String(body.masjid_id || '').slice(0, 20) };
    case 'resolveKKVerifikasi':  return { kk_id: String(body.kk_id || '').slice(0, 30), action: String(body.action || '').slice(0, 10), koreksi_data: body.koreksi_data || undefined };
    case 'setJatah': {
      const jumlahSapi = parseInt(body.jumlah_sapi, 10);
      if (!Number.isInteger(jumlahSapi) || jumlahSapi <= 0) return {};
      return { masjid_id: String(body.masjid_id || '').slice(0, 20), jumlah_sapi: jumlahSapi };
    }
    case 'togglePeriodePendaftaran': return { buka: body.buka === true || body.buka === 'true' };
    case 'revokeTokenMasjid':    return { masjid_id: String(body.masjid_id || '').slice(0, 20) };
    case 'updateNomorWAMasjid': {
      const nomorBaru = String(body.nomor_wa_baru || '').trim();
      if (!/^(\+62|08)\d{8,12}$/.test(nomorBaru)) return {};
      return { masjid_id: String(body.masjid_id || '').slice(0, 20), nomor_wa_baru: nomorBaru };
    }
    case 'hapusMasjid':          return { masjid_id: String(body.masjid_id || '').slice(0, 20) };
    case 'blokirMasjid':         return { masjid_id: String(body.masjid_id || '').slice(0, 20), alasan: String(body.alasan || '').slice(0, 500) };
    case 'bukaBlokirMasjid':     return { masjid_id: String(body.masjid_id || '').slice(0, 20) };
    case 'blokirNomorWA':        return { nomor_wa: String(body.nomor_wa || '').slice(0, 20) };
    case 'bukaBlokirNomorWA':    return { nomor_wa: String(body.nomor_wa || '').slice(0, 20) };
    case 'getNomorDiblokir':     return {};
    case 'rejectRegistration':   return { masjid_id: String(body.masjid_id || '').slice(0, 20), alasan: String(body.alasan || '').slice(0, 500) };

    // ── Kupon Masjid — Panitia Lokasi ────────────────────────
    case 'validateKupon':        return { kode_kupon: String(body.kode_kupon || '').slice(0, 50) };
    case 'konfirmasiPengambilan': {
      const fotoMime = String(body.mime_type || '').slice(0, 50);
      if (!ALLOWED_IMAGE_MIMES.has(fotoMime)) return {};
      const fotoBase64 = String(body.foto_bukti_base64 || '');
      if (Math.ceil(fotoBase64.length * 0.75) > 10 * 1024 * 1024) return {};
      return { kupon_id: String(body.kupon_id || '').slice(0, 30), foto_bukti_base64: fotoBase64, mime_type: fotoMime };
    }

    default:
      return {};
  }
}
