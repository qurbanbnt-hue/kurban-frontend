// ============================================================
//  KONFIGURASI
// ============================================================
const NAMA_SHEET_DB          = "Database";
const NAMA_SHEET_LAPORAN     = "Laporan";
const NAMA_SHEET_AKUN        = "Akun";
const NAMA_SHEET_DOKUMENTASI = "DokumentasiInstansi";
const ROOT_FOLDER_ID         = "1RPDv3Jj9srfMvV0Wvv5wkD182klzSWNA";

const SCRIPT_SECRET = PropertiesService.getScriptProperties().getProperty('SCRIPT_SECRET') || '';

// ── Konstanta Sheet Kupon Masjid ──────────────────────────────────
const NAMA_SHEET_PENDAFTARAN_MASJID = "PendaftaranMasjid";
const NAMA_SHEET_DATA_KK            = "DataKK";
const NAMA_SHEET_KUPON_MASJID       = "KuponMasjid";
const NAMA_SHEET_SESI_OTP           = "SesiOTP";
const NAMA_SHEET_KONFIG_SISTEM      = "KonfigSistem";
const FOLDER_KK_NAME                = "KK";
const FOLDER_BUKTI_FOTO_NAME        = "BuktiFoto";

// Fonnte WhatsApp API
const FONNTE_API_URL   = "https://api.fonnte.com/send";
const FONNTE_API_TOKEN = PropertiesService.getScriptProperties().getProperty('FONNTE_API_TOKEN') || '';

// ============================================================
//  ENTRY POINT
// ============================================================
function doGet(e)  { return handleApiRequest(e); }
function doPost(e) { return handleApiRequest(e); }

function handleApiRequest(e) {
  try {
    const action = e.parameter.action;
    let body = {};
    if (e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents); } catch (err) {}
    }

    if (!SCRIPT_SECRET || body.secret !== SCRIPT_SECRET) {
      return jsonResponse({ success: false, error: 'Akses ditolak' });
    }

    const data = body.data || {};
    const user = body.user || null;

    if (user && !checkGasRateLimit(user.email)) {
      return jsonResponse({ success: false, error: 'Terlalu banyak permintaan' });
    }

    let result;
    switch (action) {
      case 'verifyCredentials':     result = verifyCredentials(data.email, data.password); break;
      case 'getPublicStats':        result = getPublicStats(); break;
      case 'searchPekurban':        result = searchPekurban(data.query); break;
      case 'getPekurbanDetail':     result = getPekurbanDetail(data.nama, data.nomor_hewan, data.instansi); break;
      case 'getDokumentasiWilayah': result = getDokumentasiWilayah(data.wilayah); break;

      case 'getHewan':          result = requireUser(user) || getDataForUi(user.email); break;
      case 'uploadFoto':        result = requireUser(user) || uploadFotoJenis(data, user); break;
      case 'getDokumentasi':    result = requireUser(user) || getDokumentasiInstansi(user.email); break;
      case 'uploadDokumentasi': result = requireUser(user) || uploadDokumentasiInstansi(data, user); break;
      case 'getFileById':       result = requireUser(user) || getFileById(data.fileId, user); break;

      case 'getAdminData':  result = requireAdmin(user) || getAdminData(user.email); break;
      case 'addHewan':      result = requireAdmin(user) || addHewan(user.email, data.hewan); break;
      case 'updateHewan':   result = requireAdmin(user) || updateHewan(user.email, data.hewan); break;
      case 'deleteHewan':   result = requireAdmin(user) || deleteHewan(user.email, data.nomor_hewan, data.instansi); break;
      case 'addUser':       result = requireAdmin(user) || addUser(user.email, data.newUser); break;
      case 'updateUser':    result = requireAdmin(user) || updateUser(user.email, data.user); break;
      case 'deleteUser':    result = requireAdmin(user) || deleteUser(user.email, data.targetEmail); break;

      // Kupon Masjid — Public (no auth)
      case 'checkNomorWA':   result = checkNomorWA(data.telepon_pic); break;
      case 'registerMasjid': result = registerMasjid(data); break;
      case 'verifyOTP':      result = verifyOTP(data.masjid_id, data.otp_code); break;
      case 'requestOTP':     result = requestOTP(data.telepon_pic); break;
      case 'getKonfigSistem': result = getKonfigSistem(); break;

      // Kupon Masjid — Masjid (token sesi)
      case 'uploadKK': result = processUploadKK(data.masjid_id, { base64Data: data.file_base64, mimeType: data.mime_type, fileName: data.file_name }, data.session_token); break;
      case 'konfirmasiAnggota': result = konfirmasiAnggota(data.masjid_id, data.kk_id, data.anggota_data, data.session_token, data.alamat_kk); break;
      case 'konfirmasiAnggotaManual': result = konfirmasiAnggotaManual(data.masjid_id, data.kk_id, data.nomor_kk, data.anggota_data, data.session_token, data.alamat_kk); break;
      case 'konfirmasiSelesaiUpload': result = konfirmasiSelesaiUpload(data.masjid_id, data.session_token); break;
      case 'getKuponMasjid': result = getKuponMasjidByMasjidId(data.masjid_id, data.session_token); break;
      case 'getDashboardMasjid': result = getDashboardMasjid(data.masjid_id, data.session_token); break;

      // Kupon Masjid — Admin (dengan pagination)
      case 'getRegistrations': result = requireAdmin(user) || getRegistrations(data.page, data.limit); break;
      case 'getKKDetail': result = requireAdmin(user) || getKKDetailByMasjid(data.masjid_id, data.page, data.limit); break;
      case 'getKKPerluVerifikasi': result = requireAdmin(user) || getKKPerluVerifikasiByMasjid(data.masjid_id, data.page, data.limit); break;
      case 'resolveKKVerifikasi': result = requireAdmin(user) || resolveKKVerifikasi(data.kk_id, data.action, data.koreksi_data, user.email); break;
      case 'setJatah': result = requireAdmin(user) || setJatah(data.masjid_id, data.jumlah_sapi, user.email); break;
      case 'togglePeriodePendaftaran': result = requireAdmin(user) || togglePeriodePendaftaran(data.buka, user.email); break;
      case 'revokeTokenMasjid': result = requireAdmin(user) || revokeTokenMasjid(data.masjid_id, user.email); break;
      case 'updateNomorWAMasjid': result = requireAdmin(user) || updateNomorWAMasjid(data.masjid_id, data.nomor_wa_baru, user.email); break;
      case 'hapusMasjid': result = requireAdmin(user) || hapusMasjid(data.masjid_id, user.email); break;
      case 'blokirMasjid': result = requireAdmin(user) || blokirMasjid(data.masjid_id, data.alasan, user.email); break;
      case 'bukaBlokirMasjid': result = requireAdmin(user) || bukaBlokirMasjid(data.masjid_id, user.email); break;
      case 'blokirNomorWA': result = requireAdmin(user) || blokirNomorWA(data.nomor_wa, user.email); break;
      case 'bukaBlokirNomorWA': result = requireAdmin(user) || bukaBlokirNomorWA(data.nomor_wa, user.email); break;
      case 'getNomorDiblokir': result = requireAdmin(user) || getNomorDiblokir(); break;
      case 'rejectRegistration': result = requireAdmin(user) || rejectRegistration(data.masjid_id, data.alasan); break;

      // Kupon Masjid — Panitia Lokasi
      case 'validateKupon': result = requireUser(user) || validateKupon(data.kode_kupon, user.email); break;
      case 'konfirmasiPengambilan': result = requireUser(user) || konfirmasiPengambilan(data.kupon_id, data.foto_bukti_base64, data.mime_type, user.email); break;

      default: result = { success: false, error: 'Action tidak dikenal' };
    }

    return jsonResponse(result);

  } catch (err) {
    logSecure('API Error', err.toString());
    return jsonResponse({ success: false, error: 'Internal server error' });
  }
}

// ── Helper: buat response JSON ────────────────────────────────
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Sanitized logging (no sensitive data) ─────────────────────
function logSecure(action, message) {
  const timestamp = new Date().toISOString();
  Logger.log(`[${timestamp}] ${action}: ${message}`);
  // Note: Avoid logging passwords, tokens, or personal data
}

// ── Helper: cek user terverifikasi ────────────────────────────
function requireUser(user) {
  if (!user || !user.email || !user.role) {
    logSecure('requireUser', 'User auth required but not provided');
    return { success: false, error: 'Autentikasi diperlukan' };
  }
  return null;
}

// ── Helper: cek role admin ────────────────────────────────────
function requireAdmin(user) {
  const check = requireUser(user);
  if (check) return check;
  if (user.role !== 'admin') {
    logSecure('requireAdmin', `Non-admin user ${user.email.split('@')[0]}@*** tried admin action`);
    return { success: false, error: 'Akses ditolak' };
  }
  return null;
}

// ── Rate limiting GAS via CacheService ───────────────────────
function checkGasRateLimit(email) {
  const cache = CacheService.getScriptCache();
  const key   = 'rl_' + email;
  const count = parseInt(cache.get(key) || '0', 10);
  if (count >= 60) return false;
  cache.put(key, String(count + 1), 60);
  return true;
}

// ============================================================
//  SETUP KUPON SHEETS DAN FOLDER
// ============================================================

function setupKuponSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // PendaftaranMasjid
  let sheet = ss.getSheetByName(NAMA_SHEET_PENDAFTARAN_MASJID);
  if (!sheet) {
    sheet = ss.insertSheet(NAMA_SHEET_PENDAFTARAN_MASJID);
    sheet.appendRow([
      'masjid_id', 'nama_masjid', 'nama_normalized', 'alamat', 'kecamatan', 'kabupaten',
      'nama_pic', 'telepon_pic', 'status', 'tgl_daftar', 'jumlah_kk_valid',
      'jumlah_sapi_jatah', 'tgl_penetapan', 'admin_penetap',
      'token_issued_at', 'token_revoked_at',
      'alasan_blokir', 'admin_pemblokir', 'tgl_diblokir', 'status_sebelum_blokir',
      'session_token'
    ]);
  }

  // DataKK
  sheet = ss.getSheetByName(NAMA_SHEET_DATA_KK);
  if (!sheet) {
    sheet = ss.insertSheet(NAMA_SHEET_DATA_KK);
    sheet.appendRow([
      'kk_id', 'masjid_id', 'nomor_kk', 'file_id', 'status_ocr',
      'nama_kepala', 'alamat_kk', 'anggota_json', 'jumlah_anggota_tertera',
      'jumlah_anggota_parsed', 'discrepancy_note',
      'anggota_dikonfirmasi_manual', 'tgl_upload', 'uploader'
    ]);
  }

  // KuponMasjid
  sheet = ss.getSheetByName(NAMA_SHEET_KUPON_MASJID);
  if (!sheet) {
    sheet = ss.insertSheet(NAMA_SHEET_KUPON_MASJID);
    sheet.appendRow([
      'kupon_id', 'masjid_id', 'kode_kupon', 'qr_data', 'jumlah_sapi',
      'status', 'tgl_terbit', 'tgl_digunakan', 'petugas_scan',
      'lokasi_scan', 'foto_bukti_id', 'foto_bukti_url'
    ]);
  }

  // SesiOTP
  sheet = ss.getSheetByName(NAMA_SHEET_SESI_OTP);
  if (!sheet) {
    sheet = ss.insertSheet(NAMA_SHEET_SESI_OTP);
    sheet.appendRow(['masjid_id', 'otp_hash', 'otp_expiry', 'tgl_kirim', 'attempt_count', 'otp_send_count', 'otp_send_window_start']);
  }

  // KonfigSistem
  sheet = ss.getSheetByName(NAMA_SHEET_KONFIG_SISTEM);
  if (!sheet) {
    sheet = ss.insertSheet(NAMA_SHEET_KONFIG_SISTEM);
    sheet.appendRow(['kunci', 'nilai', 'tgl_update', 'admin_update']);
    const now = new Date().toISOString();
    sheet.appendRow(['periode_pendaftaran_buka', 'true', now, 'system']);
    sheet.appendRow(['tgl_tutup_pendaftaran', '', now, 'system']);
    sheet.appendRow(['nomor_diblokir', '[]', now, 'system']);
  }

  // Folder Drive
  const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
  const kkFolders = rootFolder.getFoldersByName(FOLDER_KK_NAME);
  if (!kkFolders.hasNext()) rootFolder.createFolder(FOLDER_KK_NAME);
  const buktiFolders = rootFolder.getFoldersByName(FOLDER_BUKTI_FOTO_NAME);
  if (!buktiFolders.hasNext()) rootFolder.createFolder(FOLDER_BUKTI_FOTO_NAME);

  return { success: true, message: 'Setup sheet dan folder selesai' };
}

// ============================================================
//  UTILITAS DAN HELPER FUNCTIONS — KUPON MASJID
// ============================================================

// ── 2.1 normalizeName ─────────────────────────────────────────
function normalizeName(nama) {
  if (!nama) return '';
  return nama
    .toLowerCase()
    .replace(/[-.']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── 2.2 jaroWinklerSimilarity ─────────────────────────────────
function jaroWinklerSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  const len1 = s1.length;
  const len2 = s2.length;
  const matchDist = Math.max(Math.floor(Math.max(len1, len2) / 2) - 1, 0);

  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDist);
    const end   = Math.min(i + matchDist + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

  let prefix = 0;
  const maxPrefix = Math.min(4, Math.min(len1, len2));
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

// ── 2.3 processWithLock ───────────────────────────────────────
function processWithLock(operation, timeoutMs) {
  timeoutMs = timeoutMs || 10000;
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(timeoutMs);
    return operation();
  } catch (e) {
    if (e.message && e.message.includes('Could not obtain lock')) {
      return { success: false, error: 'Server sedang sibuk, silakan coba lagi dalam beberapa detik' };
    }
    throw e;
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

// ── 2.3.1 sanitizeSheetValue — Cegah formula injection ─────────
function sanitizeSheetValue(val) {
  // Jika bukan string, return as-is
  if (typeof val !== 'string') return val;
  if (val === '') return val;

  // Cek karakter berbahaya di awal string
  const dangerous = ['=', '+', '-', '@', '|', '\t', '\r'];
  
  if (dangerous.includes(val[0])) {
    // Prefix dengan single quote untuk treat sebagai text
    val = "'" + val;
  }

  return val;
}

// ── 2.4 CRUD: PendaftaranMasjid ───────────────────────────────

function getMasjidById(masjidId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_PENDAFTARAN_MASJID);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(masjidId).trim()) {
      return rowToMasjidObj(headers, data[i]);
    }
  }
  return null;
}

function getMasjidByTelepon(telepon) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_PENDAFTARAN_MASJID);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const teleponNorm = normalizeTelepon(telepon);
  for (let i = 1; i < data.length; i++) {
    if (normalizeTelepon(String(data[i][7])) === teleponNorm) {
      return rowToMasjidObj(headers, data[i]);
    }
  }
  return null;
}

// normalizeTelepon — standarisasi format nomor WA ke 08xx
// Menangani: 081234, +6281234, 6281234, 81234 → 081234
function normalizeTelepon(telepon) {
  if (!telepon) return '';
  let t = String(telepon).trim().replace(/\s+/g, '');
  // Hapus karakter non-digit kecuali +
  t = t.replace(/[^\d+]/g, '');
  // +628xx → 08xx
  if (t.startsWith('+628')) return '0' + t.slice(3);
  // 628xx → 08xx
  if (t.startsWith('628')) return '0' + t.slice(2);
  // 8xx (tanpa 0 di depan, seperti yang tersimpan di sheet sebagai angka) → 08xx
  if (t.startsWith('8') && !t.startsWith('08')) return '0' + t;
  return t;
}

function getAllMasjid() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_PENDAFTARAN_MASJID);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  const result = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) result.push(rowToMasjidObj(headers, data[i]));
  }
  return result;
}

function rowToMasjidObj(headers, row) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ''; });
  // Konversi tipe
  obj.jumlah_kk_valid   = Number(obj.jumlah_kk_valid)   || 0;
  obj.jumlah_sapi_jatah = Number(obj.jumlah_sapi_jatah) || 0;
  return obj;
}

function saveMasjidRecord(masjidData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_PENDAFTARAN_MASJID);
  sheet.appendRow([
    sanitizeSheetValue(masjidData.masjid_id),
    sanitizeSheetValue(masjidData.nama_masjid),
    sanitizeSheetValue(masjidData.nama_normalized),
    sanitizeSheetValue(masjidData.alamat),
    sanitizeSheetValue(masjidData.kecamatan),
    sanitizeSheetValue(masjidData.kabupaten),
    sanitizeSheetValue(masjidData.nama_pic),
    sanitizeSheetValue(masjidData.telepon_pic),
    sanitizeSheetValue(masjidData.status || 'draft'),
    sanitizeSheetValue(masjidData.tgl_daftar || new Date().toISOString()),
    masjidData.jumlah_kk_valid || 0,
    sanitizeSheetValue(masjidData.jumlah_sapi_jatah || ''),
    sanitizeSheetValue(masjidData.tgl_penetapan || ''),
    sanitizeSheetValue(masjidData.admin_penetap || ''),
    sanitizeSheetValue(masjidData.token_issued_at || ''),
    sanitizeSheetValue(masjidData.token_revoked_at || ''),
    sanitizeSheetValue(masjidData.alasan_blokir || ''),
    sanitizeSheetValue(masjidData.admin_pemblokir || ''),
    sanitizeSheetValue(masjidData.tgl_diblokir || ''),
    sanitizeSheetValue(masjidData.status_sebelum_blokir || ''),
    sanitizeSheetValue(masjidData.session_token || '')
  ]);
}

function updateMasjidField(masjidId, fieldName, value) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_PENDAFTARAN_MASJID);
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const colIdx = headers.indexOf(fieldName);
  if (colIdx === -1) return false;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(masjidId).trim()) {
      sheet.getRange(i + 1, colIdx + 1).setValue(value);
      SpreadsheetApp.flush();
      return true;
    }
  }
  return false;
}

function updateMasjidFields(masjidId, fieldsObj) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_PENDAFTARAN_MASJID);
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(masjidId).trim()) {
      // Use batch update instead of individual setValue calls
      const updates = [];
      const updateCols = [];
      Object.keys(fieldsObj).forEach(field => {
        const colIdx = headers.indexOf(field);
        if (colIdx !== -1) {
          updates.push([sanitizeSheetValue(fieldsObj[field])]);
          updateCols.push(colIdx + 1);
        }
      });
      
      if (updates.length > 0) {
        // Set all values in the row at once
        const row = i + 1;
        updates.forEach((val, idx) => {
          sheet.getRange(row, updateCols[idx]).setValue(val[0]);
        });
      }
      
      // Critical: flush and verify the update
      SpreadsheetApp.flush();
      // Double-check: read back the data to ensure it was written
      Utilities.sleep(100);
      const verifyData = sheet.getDataRange().getValues();
      for (const field in fieldsObj) {
        const colIdx = headers.indexOf(field);
        if (colIdx !== -1 && String(verifyData[i][colIdx]) !== String(fieldsObj[field])) {
          // If value doesn't match, try again
          sheet.getRange(i + 1, colIdx + 1).setValue(sanitizeSheetValue(fieldsObj[field]));
          SpreadsheetApp.flush();
        }
      }
      return true;
    }
  }
  return false;
}

function incrementJumlahKKValid(masjidId, delta) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_PENDAFTARAN_MASJID);
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const colIdx = headers.indexOf('jumlah_kk_valid');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(masjidId).trim()) {
      const current = Number(data[i][colIdx]) || 0;
      sheet.getRange(i + 1, colIdx + 1).setValue(current + delta);
      SpreadsheetApp.flush();
      return true;
    }
  }
  return false;
}

function deleteMasjidRecord(masjidId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_PENDAFTARAN_MASJID);
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(masjidId).trim()) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

// ── CRUD: DataKK ──────────────────────────────────────────────

function getKKById(kkId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_DATA_KK);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(kkId).trim()) {
      return rowToKKObj(headers, data[i]);
    }
  }
  return null;
}

function getKKByMasjid(masjidId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_DATA_KK);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const result = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(masjidId).trim()) {
      result.push(rowToKKObj(headers, data[i]));
    }
  }
  return result;
}

function checkDuplicateNomorKK(nomorKK) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_DATA_KK);
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][2]).trim() === String(nomorKK).trim()) return true;
  }
  return false;
}

function rowToKKObj(headers, row) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ''; });
  obj.jumlah_anggota_tertera = obj.jumlah_anggota_tertera !== '' ? Number(obj.jumlah_anggota_tertera) : null;
  obj.jumlah_anggota_parsed  = Number(obj.jumlah_anggota_parsed) || 0;
  obj.anggota_dikonfirmasi_manual = obj.anggota_dikonfirmasi_manual === true || obj.anggota_dikonfirmasi_manual === 'true';
  return obj;
}

function namaKepalaDariAnggota_(anggotaData, namaOverride) {
  if (namaOverride != null && String(namaOverride).trim()) return String(namaOverride).trim().slice(0, 200);
  if (anggotaData && anggotaData[0] && anggotaData[0].nama) return String(anggotaData[0].nama).trim().slice(0, 200);
  return '';
}

function saveKKRecord(masjidId, fileId, nomorKK, statusOcr, anggotaData, jumlahTertera, jumlahParsed, discrepancyNote, anggotaDikonfirmasiManual, alamatKK, namaKepalaOpt) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_DATA_KK);
  const year  = new Date().getFullYear();
  const kkId = 'KK-' + year + '-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  const anggotaJson = anggotaData ? JSON.stringify(anggotaData) : '[]';
  const namaKepala = namaKepalaDariAnggota_(anggotaData, namaKepalaOpt);
  sheet.appendRow([
    sanitizeSheetValue(kkId),
    sanitizeSheetValue(masjidId),
    sanitizeSheetValue(nomorKK || ''),
    sanitizeSheetValue(fileId || ''),
    sanitizeSheetValue(statusOcr),
    sanitizeSheetValue(namaKepala),
    sanitizeSheetValue(alamatKK || ''),
    sanitizeSheetValue(anggotaJson),
    jumlahTertera !== null && jumlahTertera !== undefined ? jumlahTertera : '',
    jumlahParsed || 0,
    sanitizeSheetValue(discrepancyNote || ''),
    anggotaDikonfirmasiManual ? true : false,
    new Date().toISOString(),
    sanitizeSheetValue('')
  ]);
  return kkId;
}

function updateKKRecord(kkId, fieldsObj) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_DATA_KK);
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(kkId).trim()) {
      Object.keys(fieldsObj).forEach(field => {
        const colIdx = headers.indexOf(field);
        if (colIdx !== -1) sheet.getRange(i + 1, colIdx + 1).setValue(sanitizeSheetValue(fieldsObj[field]));
      });
      SpreadsheetApp.flush();
      return true;
    }
  }
  return false;
}

function deleteKKByMasjid(masjidId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_DATA_KK);
  if (!sheet) return 0;
  const data = sheet.getDataRange().getValues();
  let deleted = 0;
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][1]).trim() === String(masjidId).trim()) {
      sheet.deleteRow(i + 1);
      deleted++;
    }
  }
  return deleted;
}

// ── CRUD: KuponMasjid ─────────────────────────────────────────

function getKuponById(kuponId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_KUPON_MASJID);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(kuponId).trim()) {
      return rowToKuponObj(headers, data[i]);
    }
  }
  return null;
}

function getKuponByKode(kodeKupon) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_KUPON_MASJID);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][2]).trim() === String(kodeKupon).trim()) {
      return rowToKuponObj(headers, data[i]);
    }
  }
  return null;
}

function getActiveKuponByMasjid(masjidId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_KUPON_MASJID);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(masjidId).trim() && String(data[i][5]).trim() === 'aktif') {
      return rowToKuponObj(headers, data[i]);
    }
  }
  return null;
}

function isKodeKuponExists(kodeKupon) {
  return getKuponByKode(kodeKupon) !== null;
}

function rowToKuponObj(headers, row) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ''; });
  obj.jumlah_sapi = Number(obj.jumlah_sapi) || 0;
  return obj;
}

function saveKuponRecord(kuponData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_KUPON_MASJID);
  sheet.appendRow([
    sanitizeSheetValue(kuponData.kupon_id),
    sanitizeSheetValue(kuponData.masjid_id),
    sanitizeSheetValue(kuponData.kode_kupon),
    sanitizeSheetValue(kuponData.qr_data),
    kuponData.jumlah_sapi,
    sanitizeSheetValue(kuponData.status || 'aktif'),
    sanitizeSheetValue(kuponData.tgl_terbit || new Date().toISOString()),
    '', '', '', '', ''
  ]);
}

function updateKuponRecord(kuponId, fieldsObj) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_KUPON_MASJID);
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(kuponId).trim()) {
      Object.keys(fieldsObj).forEach(field => {
        const colIdx = headers.indexOf(field);
        if (colIdx !== -1) sheet.getRange(i + 1, colIdx + 1).setValue(sanitizeSheetValue(fieldsObj[field]));
      });
      return true;
    }
  }
  return false;
}

// ── CRUD: SesiOTP ─────────────────────────────────────────────

function getOTPByMasjidId(masjidId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_SESI_OTP);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(masjidId).trim()) {
      return rowToOTPObj(headers, data[i]);
    }
  }
  return null;
}

function rowToOTPObj(headers, row) {
  return {
    masjid_id:              String(row[0]),
    otp_code:               String(row[1]),
    otp_expiry:             row[2] ? new Date(row[2]) : null,
    tgl_kirim:              row[3] ? new Date(row[3]) : null,
    attempt_count:          Number(row[4]) || 0,
    otp_send_count:         Number(row[5]) || 0,
    otp_send_window_start:  row[6] ? new Date(row[6]) : null
  };
}

function saveOTP(masjidId, otpCode, otpExpiry) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_SESI_OTP);
  // Hapus OTP lama jika ada
  deleteOTP(masjidId);
  sheet.appendRow([masjidId, hashOTP(otpCode), otpExpiry.toISOString(), new Date().toISOString(), 0, 1, new Date().toISOString()]);
}

function deleteOTP(masjidId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_SESI_OTP);
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]).trim() === String(masjidId).trim()) {
      sheet.deleteRow(i + 1);
    }
  }
}

function incrementOTPAttempt(masjidId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_SESI_OTP);
  if (!sheet) return 0;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(masjidId).trim()) {
      const newCount = (Number(data[i][4]) || 0) + 1;
      sheet.getRange(i + 1, 5).setValue(newCount);
      SpreadsheetApp.flush();
      return newCount;
    }
  }
  return 0;
}

// ── 2.5 CRUD: KonfigSistem ────────────────────────────────────

// _getKonfigSistemRaw — internal use only, returns raw config object
function _getKonfigSistemRaw() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_KONFIG_SISTEM);
  if (!sheet) return { periode_pendaftaran_buka: true, tgl_tutup_pendaftaran: null, nomor_diblokir: [] };
  const data = sheet.getDataRange().getValues();
  const config = {};
  for (let i = 1; i < data.length; i++) {
    const kunci = String(data[i][0]).trim();
    const nilai = data[i][1];
    config[kunci] = nilai;
  }
  let nomorDiblokir = [];
  try {
    if (config['nomor_diblokir']) {
      nomorDiblokir = JSON.parse(String(config['nomor_diblokir']));
      if (!Array.isArray(nomorDiblokir)) nomorDiblokir = [];
    }
  } catch (e) {
    Logger.log('getKonfigSistem: JSON parse error untuk nomor_diblokir: ' + e);
    nomorDiblokir = [];
  }
  return {
    periode_pendaftaran_buka: config['periode_pendaftaran_buka'] === 'true' || config['periode_pendaftaran_buka'] === true,
    tgl_tutup_pendaftaran:    config['tgl_tutup_pendaftaran'] || null,
    nomor_diblokir:           nomorDiblokir
  };
}

// getKonfigSistem — API-facing, returns {success: true, config: {...}}
function getKonfigSistem() {
  try {
    const raw = _getKonfigSistemRaw();
    return { success: true, config: raw };
  } catch (err) {
    Logger.log('getKonfigSistem error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

function updateKonfigSistem(kunci, nilai, adminEmail) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_KONFIG_SISTEM);
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  const now  = new Date().toISOString();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(kunci).trim()) {
      sheet.getRange(i + 1, 2).setValue(sanitizeSheetValue(nilai));
      sheet.getRange(i + 1, 3).setValue(sanitizeSheetValue(now));
      sheet.getRange(i + 1, 4).setValue(sanitizeSheetValue(adminEmail || ''));
      return true;
    }
  }
  // Tambah baris baru jika kunci belum ada
  sheet.appendRow([sanitizeSheetValue(kunci), sanitizeSheetValue(nilai), sanitizeSheetValue(now), sanitizeSheetValue(adminEmail || '')]);
  return true;
}

// ============================================================
//  HELPER FUNCTIONS
// ============================================================

function hashPass(plainText, salt) {
  if (!salt) salt = Utilities.base64Encode(Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(Date.now()) + Math.random(),
    Utilities.Charset.UTF_8
  )).slice(0, 16);

  let hash = plainText + salt;
  for (let i = 0; i < 500; i++) {
    const bytes = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      hash,
      Utilities.Charset.UTF_8
    );
    hash = bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
  }
  return { hash, salt };
}

function verifyPassword(plainText, storedHash, storedSalt) {
  if (!storedSalt) {
    const bytes = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256, plainText, Utilities.Charset.UTF_8
    );
    const legacyHash = bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
    return legacyHash === storedHash;
  }
  const { hash } = hashPass(plainText, storedSalt);
  return hash === storedHash;
}

// ── Primary key: nomor_hewan + instansi + jenis_hewan ────────
function matchHewan(row, nomor_hewan, instansi, jenis_hewan) {
  const rowNomor  = row[0] ? String(row[0]).trim().toUpperCase() : '';
  const rowJenis  = row[1] ? String(row[1]).trim().toUpperCase() : '';
  const rowInst   = row[4] ? String(row[4]).trim().toUpperCase() : '';
  return rowNomor === String(nomor_hewan  || '').trim().toUpperCase() &&
         rowInst  === String(instansi     || '').trim().toUpperCase() &&
         rowJenis === String(jenis_hewan  || '').trim().toUpperCase();
}

function matchLaporan(row, nomor_hewan, instansi, jenis_hewan) {
  const rowNomor = row[0] ? String(row[0]).trim().toUpperCase() : '';
  const rowJenis = row[1] ? String(row[1]).trim().toUpperCase() : '';
  const rowInst  = row[4] ? String(row[4]).trim().toUpperCase() : '';
  return rowNomor === String(nomor_hewan  || '').trim().toUpperCase() &&
         rowInst  === String(instansi     || '').trim().toUpperCase() &&
         rowJenis === String(jenis_hewan  || '').trim().toUpperCase();
}

function safeVal(v) {
  if (!v && v !== 0) return '';
  if (v instanceof Date) return v.toISOString();
  return v.toString();
}

function getOrCreateFolder(parent, folderName) {
  const name = folderName ? folderName.toString().trim() : 'Lainnya';
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

function splitNamaPekurban(raw) {
  if (!raw) return [];
  return String(raw).split(',').map(n => n.trim()).filter(n => n.length > 0);
}

// ============================================================
//  PUBLIC STATS
// ============================================================
function getPublicStats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dbSheet      = ss.getSheetByName(NAMA_SHEET_DB);
  const laporanSheet = ss.getSheetByName(NAMA_SHEET_LAPORAN);

  let totalHewan = 0, totalPekurban = 0, totalSelesai = 0;
  const wilayahSet = new Set();

  if (dbSheet) {
    const data = dbSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[0]) continue;
      totalHewan++;
      const names = splitNamaPekurban(row[2]);
      if (names.length > 0) {
        totalPekurban += names.length;
      } else {
        const jumlah = Number(row[3]) || 0;
        totalPekurban += jumlah;
      }
      if (row[5]) wilayahSet.add(String(row[5]));
    }
  }

  if (laporanSheet) {
    const data = laporanSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row && row[6] && row[8] && row[10]) totalSelesai++;
    }
  }

  return {
    totalHewan:    totalHewan,
    totalInstansi: wilayahSet.size,
    totalPekurban: totalPekurban,
    totalSelesai:  totalSelesai
  };
}

// ============================================================
//  VERIFIKASI KREDENSIAL (dipanggil proxy untuk login)
// ============================================================
function verifyCredentials(email, password) {
  try {
    if (!email || !password) return { success: false, error: 'Internal server error' };
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_AKUN);
    if (!sheet) return { success: false, error: 'Internal server error' };
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[0]) continue;
      const storedEmail = String(row[0]).trim();
      const storedHash  = row[1] ? String(row[1]).trim() : '';
      const storedSalt  = row[4] ? String(row[4]).trim() : '';
      const username    = row[2] ? String(row[2]).trim() : storedEmail.split('@')[0];
      const role        = row[3] ? String(row[3]).trim().toLowerCase() : 'user';

      if (storedEmail.toLowerCase() !== email.toLowerCase()) continue;
      if (!storedHash) continue;

      if (verifyPassword(password, storedHash, storedSalt)) {
        return { success: true, email: storedEmail, username, role };
      } else {
        return { success: false, error: 'Kredensial tidak valid' };
      }
    }
    return { success: false, error: 'Kredensial tidak valid' };
  } catch (err) {
    Logger.log('verifyCredentials error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

// ============================================================
//  DATA HEWAN (untuk User Portal)
// ============================================================
function getDataForUi(email) {
  try {
    const ss           = SpreadsheetApp.getActiveSpreadsheet();
    const dbSheet      = ss.getSheetByName(NAMA_SHEET_DB);
    const laporanSheet = ss.getSheetByName(NAMA_SHEET_LAPORAN);
    if (!dbSheet) return { success: false, error: 'Sheet Database tidak ditemukan' };

    const dbData    = dbSheet.getDataRange().getValues();
    const statusMap = {};
    if (laporanSheet) {
      const lapData = laporanSheet.getDataRange().getValues();
      for (let i = 1; i < lapData.length; i++) {
        const row = lapData[i];
        if (!row || !row[0]) continue;
        const key = `${String(row[0]).trim().toUpperCase()}|${String(row[4]||'').trim().toUpperCase()}|${String(row[1]||'').trim().toUpperCase()}`;
        statusMap[key] = {
          url_hidup:        safeVal(row[6]),  tgl_hidup:        safeVal(row[7]),  uploader_hidup:        safeVal(row[12]),
          url_ditumbangkan: safeVal(row[8]),  tgl_ditumbangkan: safeVal(row[9]),  uploader_ditumbangkan: safeVal(row[13]),
          url_mati:         safeVal(row[10]), tgl_mati:         safeVal(row[11]), uploader_mati:         safeVal(row[14])
        };
      }
    }

    const result = [];
    for (let i = 1; i < dbData.length; i++) {
      const row = dbData[i];
      if (!row || !row[0]) continue;
      const nomor   = String(row[0]).trim();
      const jenis   = row[1] ? String(row[1]).trim() : 'Sapi';
      const instansi = row[4] ? String(row[4]).trim() : '';
      const key     = `${nomor.toUpperCase()}|${instansi.toUpperCase()}|${jenis.toUpperCase()}`;
      result.push({
        nomor_hewan:     nomor,
        jenis_hewan:     jenis,
        daftar_pekurban: row[2] ? String(row[2]) : '',
        jumlah_pekurban: row[3] ? Number(row[3]) : 1,
        instansi:        instansi,
        wilayah:         row[5] ? String(row[5]) : '',
        status:          statusMap[key] || { url_hidup: '', url_ditumbangkan: '', url_mati: '' }
      });
    }
    return { success: true, data: result };
  } catch (err) { Logger.log(err.toString()); return { success: false, error: 'Internal server error' }; }
}

// ============================================================
//  PORTAL PEKURBAN — SEARCH
// ============================================================
function searchPekurban(query) {
  try {
    if (!query || query.trim().length < 2) {
      return { success: false, error: "Masukkan minimal 2 karakter" };
    }

    const ss      = SpreadsheetApp.getActiveSpreadsheet();
    const dbSheet = ss.getSheetByName(NAMA_SHEET_DB);
    if (!dbSheet) return { success: false, error: "Sheet Database tidak ditemukan" };

    const q       = query.trim().toLowerCase();
    const dbData  = dbSheet.getDataRange().getValues();
    const results = [];

    for (let i = 1; i < dbData.length; i++) {
      const row = dbData[i];
      if (!row || !row[0]) continue;

      const nomor    = String(row[0]);
      const jenis    = row[1] ? String(row[1]) : 'Sapi';
      const instansi = row[4] ? String(row[4]) : '';
      const wilayah  = row[5] ? String(row[5]) : '';
      const rawNama  = row[2] ? String(row[2]) : '';

      const namaList = splitNamaPekurban(rawNama);

      namaList.forEach(nama => {
        if (nama.toLowerCase().includes(q)) {
          results.push({
            nama_pekurban: nama,
            nomor_hewan:   nomor,
            jenis_hewan:   jenis,
            instansi:      instansi,
            wilayah:       wilayah
          });
        }
      });
    }

    if (results.length === 0) return { success: false, error: "Nama tidak ditemukan" };
    return { success: true, data: results };
  } catch (err) { Logger.log(err.toString()); return { success: false, error: "Internal server error" }; }
}

// ============================================================
//  PORTAL PEKURBAN — DETAIL PROFIL
// ============================================================
function getPekurbanDetail(nama, nomor_hewan, instansi) {
  try {
    if (!nama || !nomor_hewan) return { success: false, error: 'Parameter tidak lengkap' };

    const ss      = SpreadsheetApp.getActiveSpreadsheet();
    const dbSheet = ss.getSheetByName(NAMA_SHEET_DB);
    if (!dbSheet) return { success: false, error: 'Sheet Database tidak ditemukan' };

    const dbData = dbSheet.getDataRange().getValues();
    let hewanRow = null;
    for (let i = 1; i < dbData.length; i++) {
      const row = dbData[i];
      if (!row || !row[0]) continue;
      const nomorMatch = String(row[0]).trim().toUpperCase() === String(nomor_hewan).trim().toUpperCase();
      const instansiMatch = !instansi || String(row[4]||'').trim().toUpperCase() === String(instansi).trim().toUpperCase();
      if (nomorMatch && instansiMatch) { hewanRow = row; break; }
    }
    if (!hewanRow) return { success: false, error: 'Hewan tidak ditemukan' };

    const namaList = splitNamaPekurban(hewanRow[2]);
    const namaValid = namaList.some(n => n.toLowerCase() === nama.trim().toLowerCase());
    if (!namaValid) return { success: false, error: 'Nama pekurban tidak terdaftar pada hewan ini' };

    const jenis    = hewanRow[1] ? String(hewanRow[1]).trim() : 'Sapi';
    const inst     = hewanRow[4] ? String(hewanRow[4]).trim() : '';
    const status   = getHewanStatus(ss, String(hewanRow[0]).trim(), inst, jenis);

    return {
      success: true,
      data: {
        nama_pekurban: nama.trim(),
        nomor_hewan:   String(hewanRow[0]).trim(),
        jenis_hewan:   jenis,
        instansi:      inst,
        wilayah:       hewanRow[5] ? String(hewanRow[5]).trim() : '',
        status
      }
    };
  } catch (err) { Logger.log(err.toString()); return { success: false, error: 'Internal server error' }; }
}

// ============================================================
// ============================================================
//  AKSES FILE
// ============================================================
function getFileById(fileId, user) {
  try {
    if (!fileId || typeof fileId !== 'string' || fileId.length > 100) {
      return { success: false, error: 'fileId tidak valid' };
    }
    if (!/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) {
      return { success: false, error: 'fileId tidak valid' };
    }

    const file     = DriveApp.getFileById(fileId);
    const mimeType = file.getMimeType();
    const fileName = file.getName();

    if (mimeType.startsWith('video/')) {
      return {
        success:  true,
        type:     'video',
        mimeType: mimeType,
        fileName: fileName,
        embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      };
    }

    if (mimeType.startsWith('image/')) {
      const blob   = file.getBlob();
      const base64 = Utilities.base64Encode(blob.getBytes());
      return { success: true, type: 'image', base64, mimeType, fileName };
    }

    return { success: false, error: 'Tipe file tidak didukung' };
  } catch (err) {
    Logger.log('getFileById error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

// ============================================================
//  UPLOAD FOTO HEWAN (Panitia)
// ============================================================
function uploadFotoJenis(data, user) {
  const { nomor_hewan, jenis_foto, base64Data, mimeType } = data;
  const username = data.username || user.email;

  const cache    = CacheService.getScriptCache();
  const lockKey  = `upload_lock_${String(nomor_hewan).trim().toUpperCase()}_${String(data.instansi||'').trim().toUpperCase()}_${String(data.jenis_hewan||'').trim().toUpperCase()}`;
  const maxWait  = 10;

  for (let i = 0; i < maxWait; i++) {
    if (!cache.get(lockKey)) {
      cache.put(lockKey, '1', 30);
      break;
    }
    if (i === maxWait - 1) {
      return { success: false, error: 'Server sedang sibuk untuk hewan ini, coba lagi sebentar' };
    }
    Utilities.sleep(1000);
  }

  try {
    const ss      = SpreadsheetApp.getActiveSpreadsheet();
    const dbSheet = ss.getSheetByName(NAMA_SHEET_DB);
    const dbData  = dbSheet.getDataRange().getValues();

    let hewanData = null;
    for (let i = 1; i < dbData.length; i++) {
      if (dbData[i][0] && String(dbData[i][0]) === nomor_hewan) {
        hewanData = {
          jenis_hewan:     dbData[i][1] ? String(dbData[i][1]) : 'Sapi',
          instansi:        dbData[i][4] ? String(dbData[i][4]) : '',
          wilayah:         dbData[i][5] ? String(dbData[i][5]) : '',
          daftar_pekurban: dbData[i][2] ? String(dbData[i][2]) : '',
          jumlah_pekurban: dbData[i][3] ? Number(dbData[i][3]) : 1
        };
        break;
      }
    }
    if (!hewanData) return { success: false, error: 'Nomor hewan tidak ditemukan' };

    const rootFolder     = DriveApp.getFolderById(ROOT_FOLDER_ID);
    const instansiFolder = getOrCreateFolder(rootFolder, hewanData.instansi);
    const wilayahFolder  = getOrCreateFolder(instansiFolder, hewanData.wilayah);
    const jenisFolder    = getOrCreateFolder(wilayahFolder, hewanData.jenis_hewan);
    const nomorFolder    = getOrCreateFolder(jenisFolder, nomor_hewan);

    const ext      = mimeType.split('/')[1] || 'jpg';
    const fileName = `${nomor_hewan}_${jenis_foto}_${new Date().getTime()}.${ext}`;
    const blob     = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType);
    blob.setName(fileName);
    const newFile  = nomorFolder.createFile(blob);
    const fileUrl  = newFile.getUrl();

    const laporanSheet = ss.getSheetByName(NAMA_SHEET_LAPORAN);
    if (!laporanSheet) return { success: false, error: 'Sheet Laporan tidak ditemukan' };

    const laporanData = laporanSheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < laporanData.length; i++) {
      if (matchLaporan(laporanData[i], nomor_hewan, hewanData.instansi, hewanData.jenis_hewan)) {
        rowIndex = i + 1; break;
      }
    }
    if (rowIndex === -1) {
      laporanSheet.appendRow([nomor_hewan, hewanData.jenis_hewan, hewanData.daftar_pekurban,
        hewanData.jumlah_pekurban, hewanData.instansi, hewanData.wilayah,
        '', '', '', '', '', '', '', '']);
      rowIndex = laporanSheet.getLastRow();
    }

    const colMap = {
      hidup:        { urlCol: 7,  tglCol: 8,  uploaderCol: 13 },
      ditumbangkan: { urlCol: 9,  tglCol: 10, uploaderCol: 14 },
      mati:         { urlCol: 11, tglCol: 12, uploaderCol: 15 }
    };
    const cols = colMap[jenis_foto];
    laporanSheet.getRange(rowIndex, cols.urlCol).setValue(fileUrl);
    laporanSheet.getRange(rowIndex, cols.tglCol).setValue(new Date());
    laporanSheet.getRange(rowIndex, cols.uploaderCol).setValue(username);

    return { success: true, fileUrl };
  } catch (err) {
    Logger.log(err.toString());
    return { success: false, error: 'Internal server error' };
  } finally {
    cache.remove(lockKey);
  }
}

// ============================================================
//  UPLOAD DOKUMENTASI INSTANSI (Panitia)
// ============================================================
function uploadDokumentasiInstansi(data, user) {
  try {
    const { instansi, wilayah, jenis_dokumentasi, files } = data;
    const username = data.username || user.email;

    const ss         = SpreadsheetApp.getActiveSpreadsheet();
    const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
    const jenisFolder = getOrCreateFolder(
      getOrCreateFolder(getOrCreateFolder(rootFolder, instansi), wilayah),
      jenis_dokumentasi
    );
    const fotoFolder  = getOrCreateFolder(jenisFolder, 'Foto');
    const videoFolder = getOrCreateFolder(jenisFolder, 'Video');

    let fotoCount = 0, videoCount = 0;
    files.forEach(f => {
      const blob = Utilities.newBlob(Utilities.base64Decode(f.base64Data), f.mimeType);
      blob.setName(f.fileName.replace(/[^a-zA-Z0-9._-]/g, '_'));
      if (f.mimeType.startsWith('image/')) { fotoFolder.createFile(blob); fotoCount++; }
      else { videoFolder.createFile(blob); videoCount++; }
    });

    const sheet = ss.getSheetByName(NAMA_SHEET_DOKUMENTASI);
    if (!sheet) return { success: false, error: "Sheet DokumentasiInstansi tidak ditemukan" };

    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === instansi && data[i][1] === wilayah && data[i][2] === jenis_dokumentasi) {
        rowIndex = i + 1; break;
      }
    }
    const folderUrl = jenisFolder.getUrl();
    const now       = new Date();
    if (rowIndex === -1) {
      sheet.appendRow([instansi, wilayah, jenis_dokumentasi, folderUrl, now, username, `Foto: ${fotoCount}, Video: ${videoCount}`]);
    } else {
      sheet.getRange(rowIndex, 4).setValue(folderUrl);
      sheet.getRange(rowIndex, 5).setValue(now);
      sheet.getRange(rowIndex, 6).setValue(username);
      sheet.getRange(rowIndex, 7).setValue(`Foto: ${fotoCount}, Video: ${videoCount} (update)`);
    }
    return { success: true, fotoCount, videoCount };
  } catch (err) { Logger.log(err.toString()); return { success: false, error: "Internal server error" }; }
}

// ============================================================
//  DOKUMENTASI INSTANSI (READ)
// ============================================================
function getDokumentasiInstansi(email) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_DOKUMENTASI);
    if (!sheet) return { success: true, data: [] };
    const data   = sheet.getDataRange().getValues();
    const result = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[0] || !row[1] || !row[2]) continue;
      result.push({
        instansi:  String(row[0]), wilayah: String(row[1]), jenis: String(row[2]),
        folderUrl: row[3] ? String(row[3]) : '', tglUpload: safeVal(row[4]),
        uploader:  row[5] ? String(row[5]) : '', catatan: row[6] ? String(row[6]) : ''
      });
    }
    return { success: true, data: result };
  } catch (err) { Logger.log(err.toString()); return { success: false, error: "Internal server error" }; }
}

// ============================================================
//  ADMIN — GET ALL DATA
// ============================================================
function getAdminData(adminEmail) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const akunSheet = ss.getSheetByName(NAMA_SHEET_AKUN);
  const users = [];
  if (akunSheet) {
    const data = akunSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[0]) continue;
      users.push({
        email:    String(row[0]),
        username: row[2] ? String(row[2]) : '',
        role:     row[3] ? String(row[3]).toLowerCase() : 'user'
      });
    }
  }

  const dbSheet = ss.getSheetByName(NAMA_SHEET_DB);
  const hewan   = [];
  let totalSelesai = 0;
  if (dbSheet) {
    const data = dbSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[0]) continue;
      const nomor   = String(row[0]).trim();
      const jenis   = row[1] ? String(row[1]).trim() : 'Sapi';
      const instansi = row[4] ? String(row[4]).trim() : '';
      const status   = getHewanStatus(ss, nomor, instansi, jenis);
      const progress = (status.url_hidup ? 1 : 0) + (status.url_ditumbangkan ? 1 : 0) + (status.url_mati ? 1 : 0);
      if (progress === 3) totalSelesai++;
      hewan.push({
        nomor_hewan:     nomor,
        jenis_hewan:     jenis,
        daftar_pekurban: row[2] ? String(row[2]) : '',
        jumlah_pekurban: row[3] ? Number(row[3]) : 1,
        instansi:        instansi,
        wilayah:         row[5] ? String(row[5]) : '',
        status, progress
      });
    }
  }

  return {
    success: true, users, hewan,
    stats: { totalHewan: hewan.length, totalUsers: users.length, selesai: totalSelesai }
  };
}

function getHewanStatus(ss, nomorHewan, instansi, jenisHewan) {
  const empty = {
    url_hidup: '', tgl_hidup: '', uploader_hidup: '',
    url_ditumbangkan: '', tgl_ditumbangkan: '', uploader_ditumbangkan: '',
    url_mati: '', tgl_mati: '', uploader_mati: ''
  };
  const laporanSheet = ss.getSheetByName(NAMA_SHEET_LAPORAN);
  if (!laporanSheet) return empty;
  const data = laporanSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (matchLaporan(row, nomorHewan, instansi, jenisHewan)) {
      return {
        url_hidup:        safeVal(row[6]),  tgl_hidup:        safeVal(row[7]),  uploader_hidup:        safeVal(row[12]),
        url_ditumbangkan: safeVal(row[8]),  tgl_ditumbangkan: safeVal(row[9]),  uploader_ditumbangkan: safeVal(row[13]),
        url_mati:         safeVal(row[10]), tgl_mati:         safeVal(row[11]), uploader_mati:         safeVal(row[14])
      };
    }
  }
  return empty;
}

// ============================================================
//  ADMIN — CRUD HEWAN
// ============================================================
function addHewan(adminEmail, hewan) {
  try {
    const ss           = SpreadsheetApp.getActiveSpreadsheet();
    const dbSheet      = ss.getSheetByName(NAMA_SHEET_DB);
    const laporanSheet = ss.getSheetByName(NAMA_SHEET_LAPORAN);

    const dbData = dbSheet.getDataRange().getValues();
    for (let i = 1; i < dbData.length; i++) {
      if (matchHewan(dbData[i], hewan.nomor_hewan, hewan.instansi, hewan.jenis_hewan)) {
        return { success: false, error: 'Hewan dengan nomor, instansi, dan jenis yang sama sudah ada' };
      }
    }

    dbSheet.appendRow([hewan.nomor_hewan, hewan.jenis_hewan, hewan.daftar_pekurban,
      hewan.jumlah_pekurban, hewan.instansi, hewan.wilayah]);

    if (laporanSheet) {
      laporanSheet.appendRow([hewan.nomor_hewan, hewan.jenis_hewan, hewan.daftar_pekurban,
        hewan.jumlah_pekurban, hewan.instansi, hewan.wilayah,
        '', '', '', '', '', '', '', '']);
    }
    return { success: true };
  } catch (err) { Logger.log(err.toString()); return { success: false, error: 'Internal server error' }; }
}

function updateHewan(adminEmail, hewan) {
  try {
    const ss           = SpreadsheetApp.getActiveSpreadsheet();
    const sheet        = ss.getSheetByName(NAMA_SHEET_DB);
    const laporanSheet = ss.getSheetByName(NAMA_SHEET_LAPORAN);
    const data  = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (matchHewan(data[i], hewan.nomor_hewan, hewan.instansi, hewan.jenis_hewan)) {
        sheet.getRange(i+1, 2).setValue(hewan.jenis_hewan);
        sheet.getRange(i+1, 3).setValue(hewan.daftar_pekurban);
        sheet.getRange(i+1, 4).setValue(hewan.jumlah_pekurban);
        sheet.getRange(i+1, 5).setValue(hewan.instansi);
        sheet.getRange(i+1, 6).setValue(hewan.wilayah);

        // Sinkronkan juga ke sheet Laporan (kolom 3=pekurban, 4=jumlah, 5=instansi, 6=wilayah)
        if (laporanSheet) {
          const lapData = laporanSheet.getDataRange().getValues();
          for (let j = 1; j < lapData.length; j++) {
            if (matchLaporan(lapData[j], hewan.nomor_hewan, hewan.instansi, hewan.jenis_hewan)) {
              laporanSheet.getRange(j+1, 3).setValue(hewan.daftar_pekurban);
              laporanSheet.getRange(j+1, 4).setValue(hewan.jumlah_pekurban);
              laporanSheet.getRange(j+1, 5).setValue(hewan.instansi);
              laporanSheet.getRange(j+1, 6).setValue(hewan.wilayah);
              break;
            }
          }
        }

        return { success: true };
      }
    }
    return { success: false, error: 'Hewan tidak ditemukan' };
  } catch (err) { Logger.log(err.toString()); return { success: false, error: 'Internal server error' }; }
}

function deleteHewan(adminEmail, nomor_hewan, instansi) {
  try {
    const ss           = SpreadsheetApp.getActiveSpreadsheet();
    const dbSheet      = ss.getSheetByName(NAMA_SHEET_DB);
    const laporanSheet = ss.getSheetByName(NAMA_SHEET_LAPORAN);

    let hewanData = null;
    const dbData  = dbSheet.getDataRange().getValues();
    for (let i = 1; i < dbData.length; i++) {
      const row = dbData[i];
      if (row[0] && String(row[0]).trim().toUpperCase() === String(nomor_hewan).trim().toUpperCase() &&
          row[4] && String(row[4]).trim().toUpperCase() === String(instansi || '').trim().toUpperCase()) {
        hewanData = {
          jenis_hewan: String(row[1] || 'Sapi'),
          instansi:    String(row[4] || ''),
          wilayah:     String(row[5] || '')
        };
        break;
      }
    }

    if (hewanData) {
      try {
        const rootFolder  = DriveApp.getFolderById(ROOT_FOLDER_ID);
        const jenisFolder = getOrCreateFolder(
          getOrCreateFolder(getOrCreateFolder(rootFolder, hewanData.instansi), hewanData.wilayah),
          hewanData.jenis_hewan
        );
        const nomorFolders = jenisFolder.getFoldersByName(nomor_hewan);
        while (nomorFolders.hasNext()) {
          const folder = nomorFolders.next();
          const files  = folder.getFiles();
          while (files.hasNext()) files.next().setTrashed(true);
          folder.setTrashed(true);
        }
      } catch (driveErr) { Logger.log('Drive folder tidak ditemukan: ' + driveErr); }
    }

    for (let i = dbData.length - 1; i >= 1; i--) {
      if (matchHewan(dbData[i], nomor_hewan, instansi, hewanData?.jenis_hewan || '')) {
        dbSheet.deleteRow(i + 1); break;
      }
    }

    if (laporanSheet) {
      const lapData = laporanSheet.getDataRange().getValues();
      for (let i = lapData.length - 1; i >= 1; i--) {
        if (matchLaporan(lapData[i], nomor_hewan, instansi, hewanData?.jenis_hewan || '')) {
          laporanSheet.deleteRow(i + 1); break;
        }
      }
    }
    return { success: true };
  } catch (err) { Logger.log(err.toString()); return { success: false, error: 'Internal server error' }; }
}

// ============================================================
//  ADMIN — CRUD USER
// ============================================================
function addUser(adminEmail, newUser) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_AKUN);
    const data  = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && String(data[i][0]).toLowerCase() === newUser.email.toLowerCase()) {
        return { success: false, error: 'Email sudah terdaftar' };
      }
    }
    let hashVal = '', saltVal = '';
    if (newUser.password) {
      const result = hashPass(newUser.password, null);
      hashVal = result.hash;
      saltVal = result.salt;
    }
    sheet.appendRow([newUser.email, hashVal, newUser.username, newUser.role || 'user', saltVal]);
    return { success: true };
  } catch (err) { Logger.log(err.toString()); return { success: false, error: 'Internal server error' }; }
}

function updateUser(adminEmail, user) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_AKUN);
    const data  = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && String(data[i][0]).toLowerCase() === user.email.toLowerCase()) {
        if (user.username) sheet.getRange(i+1, 3).setValue(user.username);
        if (user.role)     sheet.getRange(i+1, 4).setValue(user.role);
        if (user.password) {
          const { hash, salt } = hashPass(user.password, null);
          sheet.getRange(i+1, 2).setValue(hash);
          sheet.getRange(i+1, 5).setValue(salt);
        }
        return { success: true };
      }
    }
    return { success: false, error: 'User tidak ditemukan' };
  } catch (err) { Logger.log(err.toString()); return { success: false, error: 'Internal server error' }; }
}

function deleteUser(adminEmail, targetEmail) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_AKUN);
    const data  = sheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][0] && String(data[i][0]).toLowerCase() === targetEmail.toLowerCase()) {
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { success: false, error: "User tidak ditemukan" };
  } catch (err) { Logger.log(err.toString()); return { success: false, error: "Internal server error" }; }
}

// ============================================================
//  MIGRASI / UTILITAS — Jalankan SATU KALI dari editor
// ============================================================

// migrasiTambahKolomAlamatKK
// ─────────────────────────────────────────────────────────────
// Sheet DataKK lama punya 13 kolom (tanpa alamat_kk):
//   kk_id | masjid_id | nomor_kk | file_id | status_ocr |
//   nama_kepala | anggota_json | jumlah_anggota_tertera |
//   jumlah_anggota_parsed | discrepancy_note |
//   anggota_dikonfirmasi_manual | tgl_upload | uploader
//
// Code.gs mengharapkan 14 kolom dengan alamat_kk di kolom 7
// (index 6), antara nama_kepala dan anggota_json:
//   kk_id | masjid_id | nomor_kk | file_id | status_ocr |
//   nama_kepala | alamat_kk | anggota_json | jumlah_anggota_tertera |
//   jumlah_anggota_parsed | discrepancy_note |
//   anggota_dikonfirmasi_manual | tgl_upload | uploader
//
// Cara pakai: buka Apps Script editor → pilih fungsi ini → Run
// ─────────────────────────────────────────────────────────────
function migrasiTambahKolomAlamatKK() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(NAMA_SHEET_DATA_KK);

  if (!sheet) {
    Logger.log('❌ Sheet DataKK tidak ditemukan. Jalankan setupKuponSheets() terlebih dahulu.');
    return;
  }

  const data    = sheet.getDataRange().getValues();
  const headers = data[0];

  // Cek apakah kolom alamat_kk sudah ada
  if (headers.includes('alamat_kk')) {
    Logger.log('✅ Kolom alamat_kk sudah ada di posisi ' + (headers.indexOf('alamat_kk') + 1) + '. Tidak perlu migrasi.');
    return;
  }

  // Validasi header lama sesuai ekspektasi (13 kolom tanpa alamat_kk)
  const expectedOld = [
    'kk_id', 'masjid_id', 'nomor_kk', 'file_id', 'status_ocr',
    'nama_kepala', 'anggota_json', 'jumlah_anggota_tertera',
    'jumlah_anggota_parsed', 'discrepancy_note',
    'anggota_dikonfirmasi_manual', 'tgl_upload', 'uploader'
  ];

  const isOldFormat = expectedOld.every((col, i) => headers[i] === col);
  if (!isOldFormat) {
    Logger.log('⚠️  Header sheet tidak sesuai format lama yang diharapkan.');
    Logger.log('Header saat ini: ' + JSON.stringify(headers));
    Logger.log('Header yang diharapkan: ' + JSON.stringify(expectedOld));
    Logger.log('Periksa sheet secara manual sebelum menjalankan migrasi.');
    return;
  }

  Logger.log('🔄 Memulai migrasi DataKK: menambah kolom alamat_kk di posisi 7...');
  Logger.log('Total baris data (tidak termasuk header): ' + (data.length - 1));

  // Sisipkan kolom baru di posisi 7 (kolom G, index 6 = antara nama_kepala dan anggota_json)
  // insertColumnAfter(columnPosition) — posisi 1-based
  // nama_kepala ada di kolom 6, jadi sisipkan setelah kolom 6
  sheet.insertColumnAfter(6);

  // Set header kolom baru
  sheet.getRange(1, 7).setValue('alamat_kk');

  // Isi semua baris data dengan string kosong (nilai default)
  const totalRows = data.length - 1; // tidak termasuk header
  if (totalRows > 0) {
    sheet.getRange(2, 7, totalRows, 1).setValue('');
  }

  SpreadsheetApp.flush();

  // Verifikasi hasil
  const newHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Logger.log('✅ Migrasi selesai!');
  Logger.log('Header baru: ' + JSON.stringify(newHeaders));
  Logger.log('Total kolom sekarang: ' + newHeaders.length);

  // Validasi urutan akhir
  const expectedNew = [
    'kk_id', 'masjid_id', 'nomor_kk', 'file_id', 'status_ocr',
    'nama_kepala', 'alamat_kk', 'anggota_json', 'jumlah_anggota_tertera',
    'jumlah_anggota_parsed', 'discrepancy_note',
    'anggota_dikonfirmasi_manual', 'tgl_upload', 'uploader'
  ];
  const isValid = expectedNew.every((col, i) => newHeaders[i] === col);
  if (isValid) {
    Logger.log('✅ Urutan kolom sudah benar dan sesuai dengan yang diharapkan Code.gs.');
  } else {
    Logger.log('⚠️  Urutan kolom tidak sesuai ekspektasi. Periksa sheet secara manual.');
    Logger.log('Yang diharapkan: ' + JSON.stringify(expectedNew));
  }
}

function syncLaporanFromDatabase() {
  const ss           = SpreadsheetApp.getActiveSpreadsheet();
  const dbSheet      = ss.getSheetByName(NAMA_SHEET_DB);
  const laporanSheet = ss.getSheetByName(NAMA_SHEET_LAPORAN);
  if (!dbSheet)      { Logger.log("❌ Sheet Database tidak ditemukan"); return; }
  if (!laporanSheet) { Logger.log("❌ Sheet Laporan tidak ditemukan"); return; }

  const dbData      = dbSheet.getDataRange().getValues();
  const laporanData = laporanSheet.getDataRange().getValues();
  let addedCount    = 0;

  for (let i = 1; i < dbData.length; i++) {
    const row = dbData[i];
    if (!row[0]) continue;
    const nomor  = String(row[0]);
    let exists   = false;
    for (let j = 1; j < laporanData.length; j++) {
      if (laporanData[j][0] && String(laporanData[j][0]) === nomor) { exists = true; break; }
    }
    if (!exists) {
      laporanSheet.appendRow([nomor, row[1]||'Sapi', row[2]||'', row[3]||1, row[4]||'', row[5]||'',
        '', '', '', '', '', '', '', '']);
      addedCount++;
    }
  }
  Logger.log(`✅ Sinkronisasi Laporan selesai. ${addedCount} baris baru ditambahkan.`);
}

function syncDokumentasiInstansi() {
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const dbSheet = ss.getSheetByName(NAMA_SHEET_DB);
  const dokSheet = ss.getSheetByName(NAMA_SHEET_DOKUMENTASI);
  if (!dbSheet)  { Logger.log("❌ Sheet Database tidak ditemukan"); return; }
  if (!dokSheet) { Logger.log("❌ Sheet DokumentasiInstansi tidak ditemukan"); return; }

  const dbData  = dbSheet.getDataRange().getValues();
  const dokData = dokSheet.getDataRange().getValues();
  const pairs   = new Set();

  for (let i = 1; i < dbData.length; i++) {
    const row = dbData[i];
    if (row[4] && row[5]) pairs.add(JSON.stringify({ instansi: String(row[4]), wilayah: String(row[5]) }));
  }

  const jenisDok = ['Pencacahan', 'Penyaluran'];
  let addedCount = 0;
  pairs.forEach(pair => {
    const { instansi, wilayah } = JSON.parse(pair);
    jenisDok.forEach(jenis => {
      let exists = false;
      for (let j = 1; j < dokData.length; j++) {
        if (dokData[j][0] === instansi && dokData[j][1] === wilayah && dokData[j][2] === jenis) { exists = true; break; }
      }
      if (!exists) {
        dokSheet.appendRow([instansi, wilayah, jenis, '', '', '', `Migrasi ${new Date().toLocaleDateString('id-ID')}`]);
        addedCount++;
      }
    });
  });
  Logger.log(`✅ Sinkronisasi DokumentasiInstansi selesai. ${addedCount} baris baru ditambahkan.`);
}

// ── DEBUG: Test OCR pada file KK tertentu ─────────────────────
// Cara pakai: isi FILE_ID dengan ID file di Google Drive, lalu Run
function debugOCRKK() {
  const FILE_ID = '1Ftevenpk2f7hfjC9BFXcV3xPrRdwK9ji'; // Ganti dengan ID file KK di Drive
  Logger.log('=== DEBUG OCR KK ===');
  Logger.log('File ID: ' + FILE_ID);

  const result = extractNomorKK(FILE_ID);
  Logger.log('OCR Result: ' + JSON.stringify(result));

  if (result.raw_text) {
    Logger.log('=== RAW TEXT (500 karakter pertama) ===');
    Logger.log(result.raw_text.substring(0, 500));
    Logger.log('=== SEMUA ANGKA 16 DIGIT DITEMUKAN ===');
    const allSixteen = result.raw_text.match(/\d{16}/g);
    Logger.log(JSON.stringify(allSixteen));
    
    Logger.log('=== PARSING TESTS ===');
    const jumlahTertera = parseJumlahAnggotaTertera(result.raw_text);
    Logger.log('Jumlah Anggota Tertera: ' + jumlahTertera);
    
    const anggota = parseAnggotaKeluarga(result.raw_text);
    Logger.log('Anggota Parsed (' + anggota.length + '): ' + JSON.stringify(anggota));
    
    const alamat = parseAlamatKK(result.raw_text);
    Logger.log('Alamat Parsed: ' + alamat);
    Logger.log('=== END DEBUG ===');
  }
}

// ============================================================
//  HASH PASSWORD LANGSUNG KE SHEET AKUN (dengan salt)
// ============================================================
function hashPasswordsKeSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_AKUN);
  if (!sheet) { Logger.log('❌ Sheet Akun tidak ditemukan'); return; }

  const data = sheet.getDataRange().getValues();
  let diproses = 0, dilewati = 0;

  for (let i = 1; i < data.length; i++) {
    const row      = data[i];
    const email    = row[0] ? String(row[0]).trim() : '';
    const password = row[1] ? String(row[1]).trim() : '';
    const saltCol  = row[4] ? String(row[4]).trim() : '';

    if (!email || !password) continue;

    if (saltCol && /^[a-f0-9]{64}$/.test(password)) {
      Logger.log(`⏭️  [baris ${i+1}] ${email} — sudah di-hash dengan salt, dilewati`);
      dilewati++;
      continue;
    }

    const { hash, salt } = hashPass(password, null);
    sheet.getRange(i + 1, 2).setValue(hash);
    sheet.getRange(i + 1, 5).setValue(salt);
    Logger.log(`✅ [baris ${i+1}] ${email} — password berhasil di-hash dengan salt`);
    diproses++;
  }

  Logger.log(`\nSelesai. ${diproses} password di-hash, ${dilewati} dilewati.`);
}

// ============================================================
//  PORTAL PEKURBAN — DOKUMENTASI WILAYAH
// ============================================================
function getDokumentasiWilayah(wilayah) {
  try {
    if (!wilayah) return { success: false, error: 'Wilayah tidak diberikan' };

    const ss      = SpreadsheetApp.getActiveSpreadsheet();
    const dokSheet = ss.getSheetByName(NAMA_SHEET_DOKUMENTASI);
    if (!dokSheet) return { success: true, data: [] };

    const data   = dokSheet.getDataRange().getValues();
    const result = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0] || !row[1] || !row[2]) continue;
      if (String(row[1]).trim().toUpperCase() !== wilayah.trim().toUpperCase()) continue;

      const folderUrl = row[3] ? String(row[3]).trim() : '';
      if (!folderUrl || !folderUrl.startsWith('http')) continue;

      const jenis    = String(row[2]);
      const instansi = String(row[0]);

      try {
        const fileId = extractFileIdFromUrl(folderUrl);
        if (!fileId) continue;

        const folder = DriveApp.getFolderById(fileId);
        const files  = [];

        const fotoFolders = folder.getFoldersByName('Foto');
        const fotoFolder  = fotoFolders.hasNext() ? fotoFolders.next() : folder;
        const fileIter    = fotoFolder.getFiles();

        let count = 0;
        while (fileIter.hasNext() && count < 10) {
          const f = fileIter.next();
          if (f.getMimeType().startsWith('image/')) {
            files.push({
              fileId:   f.getId(),
              fileName: f.getName(),
              mimeType: f.getMimeType(),
              type:     'image'
            });
            count++;
          }
        }

        const videoFolders = folder.getFoldersByName('Video');
        const videoFolder  = videoFolders.hasNext() ? videoFolders.next() : null;
        if (videoFolder) {
          const videoIter = videoFolder.getFiles();
          let vCount = 0;
          while (videoIter.hasNext() && vCount < 5) {
            const f = videoIter.next();
            if (f.getMimeType().startsWith('video/')) {
              files.push({
                fileId:   f.getId(),
                fileName: f.getName(),
                mimeType: f.getMimeType(),
                type:     'video'
              });
              vCount++;
            }
          }
        }

        if (files.length > 0) {
          result.push({ instansi, wilayah: String(row[1]), jenis, files });
        }
      } catch (driveErr) {
        Logger.log('Gagal akses folder: ' + driveErr);
      }
    }

    return { success: true, data: result };
  } catch (err) {
    Logger.log(err.toString()); return { success: false, error: "Internal server error" };
  }
}

function extractFileIdFromUrl(url) {
  if (!url) return null;
  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  const m = url.match(/[-\w]{25,}/);
  return m ? m[0] : null;
}
// ============================================================
//  TASK 3: AUTENTIKASI OTP WHATSAPP
// ============================================================

// 3.1 checkNomorWA — cek nomor WA, kirim OTP jika terdaftar
function checkNomorWA(teleponPic) {
  try {
    if (!teleponPic || !/^(\+62|08)\d{8,12}$/.test(String(teleponPic).trim())) {
      return { success: false, error: 'Format nomor WhatsApp tidak valid' };
    }
    const telepon = normalizeTelepon(String(teleponPic).trim());

    // Cek NomorDiblokir
    const config = _getKonfigSistemRaw();
    if (config.nomor_diblokir && config.nomor_diblokir.includes(telepon)) {
      return { success: false, error: 'Nomor WhatsApp ini tidak dapat digunakan.' };
    }

    const masjid = getMasjidByTelepon(telepon);
    if (masjid) {
      // Cek status diblokir
      if (masjid.status === 'diblokir') {
        return { success: false, error: 'Akun masjid Anda telah diblokir. Hubungi admin untuk informasi lebih lanjut.' };
      }
      // Nomor terdaftar → kirim OTP
      const otpResult = sendOTPWhatsApp(masjid.masjid_id, telepon);
      if (!otpResult.success) return otpResult;
      return { success: true, terdaftar: true, masjid_id: masjid.masjid_id, nama_masjid: masjid.nama_masjid };
    } else {
      return { success: true, terdaftar: false };
    }
  } catch (err) {
    Logger.log('checkNomorWA error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

// 3.2 sendOTPWhatsApp — generate OTP 6 digit, simpan, kirim via Fonnte
function sendOTPWhatsApp(masjidId, teleponPic) {
  try {
    // 31.2 Cek rate limit OTP per masjid (max 3 kirim per 15 menit)
    const rateLimitCheck = checkOTPRateLimit(masjidId);
    if (!rateLimitCheck.allowed) {
      return { success: false, error: rateLimitCheck.error };
    }

    // Generate OTP 6 digit
    const otpCode   = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 menit

    // Simpan OTP ke sheet
    saveOTP(masjidId, otpCode, otpExpiry);
    updateOTPSendCount(masjidId, rateLimitCheck.newCount);

    // Kirim via Fonnte API
    const pesan = 'Kode OTP pendaftaran masjid Anda: ' + otpCode +
                  '. Berlaku 15 menit. Jangan bagikan kode ini kepada siapapun.';

    if (!FONNTE_API_TOKEN) {
      Logger.log('FONNTE_API_TOKEN tidak dikonfigurasi — OTP: ' + otpCode);
      return { success: true }; // Dev mode: log saja
    }

    const response = UrlFetchApp.fetch(FONNTE_API_URL, {
      method:  'POST',
      headers: { 'Authorization': FONNTE_API_TOKEN },
      payload: { target: teleponPic, message: pesan },
      muteHttpExceptions: true
    });

    const code = response.getResponseCode();
    if (code !== 200) {
      deleteOTP(masjidId);
      return { success: false, error: 'Gagal mengirim OTP via WhatsApp' };
    }

    return { success: true };
  } catch (err) {
    Logger.log('sendOTPWhatsApp error: ' + err.toString());
    try { deleteOTP(masjidId); } catch (e2) {}
    return { success: false, error: 'Gagal mengirim OTP via WhatsApp' };
  }
}

// 31.2 checkOTPRateLimit — max 3 kirim OTP per 15 menit per masjid
function checkOTPRateLimit(masjidId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_SESI_OTP);
  if (!sheet) return { allowed: true, newCount: 1 };

  const data = sheet.getDataRange().getValues();
  const WINDOW_MS = 15 * 60 * 1000; // 15 menit
  const MAX_SENDS = 3;
  const now = Date.now();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() !== String(masjidId).trim()) continue;

    const sendCount      = Number(data[i][5]) || 0;
    const windowStartRaw = data[i][6];
    const windowStart    = windowStartRaw ? new Date(windowStartRaw).getTime() : 0;

    // Jika window sudah lewat 15 menit, reset
    if (now - windowStart > WINDOW_MS) {
      return { allowed: true, newCount: 1 };
    }

    // Masih dalam window — cek count
    if (sendCount >= MAX_SENDS) {
      const sisaMs    = WINDOW_MS - (now - windowStart);
      const sisaMenit = Math.ceil(sisaMs / 60000);
      return {
        allowed: false,
        error:   'Terlalu banyak permintaan OTP. Coba lagi dalam ' + sisaMenit + ' menit.'
      };
    }

    return { allowed: true, newCount: sendCount + 1 };
  }

  // Tidak ada record OTP untuk masjid ini
  return { allowed: true, newCount: 1 };
}

// updateOTPSendCount — update kolom otp_send_count dan otp_send_window_start
function updateOTPSendCount(masjidId, newCount) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_SESI_OTP);
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  const now  = new Date().toISOString();
  const WINDOW_MS = 15 * 60 * 1000;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() !== String(masjidId).trim()) continue;

    const windowStartRaw = data[i][6];
    const windowStart    = windowStartRaw ? new Date(windowStartRaw).getTime() : 0;
    const isNewWindow    = (Date.now() - windowStart > WINDOW_MS) || newCount === 1;

    sheet.getRange(i + 1, 6).setValue(newCount);
    if (isNewWindow) {
      sheet.getRange(i + 1, 7).setValue(now);
    }
    return;
  }
}

// timingSafeEqual — perbandingan string dengan waktu konstan (anti timing attack)
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// hashOTP — SHA-256 hash untuk OTP sebelum disimpan ke sheet
function hashOTP(otpCode) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(otpCode),
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

// 3.3 verifyOTP — validasi OTP, hapus setelah berhasil, update token meta
function verifyOTP(masjidId, otpCode) {
  try {
    if (!masjidId || !otpCode) return { success: false, error: 'Parameter tidak lengkap' };
    if (!/^\d{6}$/.test(String(otpCode).trim())) return { success: false, error: 'Kode OTP tidak valid' };

    const storedOTP = getOTPByMasjidId(masjidId);
    if (!storedOTP) return { success: false, error: 'OTP tidak ditemukan. Silakan request OTP baru.' };

    // Cek expired
    if (new Date() > storedOTP.otp_expiry) {
      deleteOTP(masjidId);
      return { success: false, error: 'OTP sudah kadaluarsa. Silakan request OTP baru.' };
    }

    // Cek max attempt (3x)
    if (storedOTP.attempt_count >= 3) {
      deleteOTP(masjidId);
      return { success: false, error: 'Terlalu banyak percobaan. Silakan request OTP baru.' };
    }

    // Cek kode
    if (!timingSafeEqual(hashOTP(String(otpCode).trim()), storedOTP.otp_code)) {
      incrementOTPAttempt(masjidId);
      return { success: false, error: 'Kode OTP tidak valid.' };
    }

    // OTP valid — hapus dan update token meta
    deleteOTP(masjidId);
    const now = new Date().toISOString();
    // Generate session token kriptografis
    const sessionToken = Utilities.getUuid();
    Logger.log('verifyOTP: Generating token for ' + masjidId + ', token=' + sessionToken);
    updateMasjidFields(masjidId, {
      token_issued_at:  now,
      token_revoked_at: '',
      session_token:    sessionToken
    });
    // Flush to ensure sheet is updated before next operations
    SpreadsheetApp.flush();
    Utilities.sleep(200);

    // Verify the token was actually saved
    const masjidAfterUpdate = getMasjidById(masjidId);
    if (!masjidAfterUpdate || !masjidAfterUpdate.session_token) {
      Logger.log('verifyOTP: ERROR - Token not saved for ' + masjidId);
      return { success: false, error: 'Gagal menyimpan token. Coba login ulang.' };
    }
    Logger.log('verifyOTP: Token verified saved for ' + masjidId + ', stored=' + masjidAfterUpdate.session_token);

    const masjid = masjidAfterUpdate;
    return {
      success:       true,
      masjid_id:     masjidId,
      nama_masjid:   masjid ? masjid.nama_masjid : '',
      telepon_pic:   masjid ? masjid.telepon_pic  : '',
      session_token: sessionToken
    };
  } catch (err) {
    Logger.log('verifyOTP error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

// 3.4 requestOTP — untuk login ulang saat token expired/di-revoke
function requestOTP(teleponPic) {
  try {
    if (!teleponPic) return { success: false, error: 'Nomor WhatsApp diperlukan' };
    const telepon = normalizeTelepon(String(teleponPic).trim());

    const config = _getKonfigSistemRaw();
    if (config.nomor_diblokir && config.nomor_diblokir.includes(telepon)) {
      return { success: false, error: 'Nomor WhatsApp ini tidak dapat digunakan.' };
    }

    const masjid = getMasjidByTelepon(telepon);
    if (!masjid) return { success: false, error: 'Nomor WA tidak ditemukan. Silakan daftar terlebih dahulu.' };
    if (masjid.status === 'diblokir') {
      return { success: false, error: 'Akun masjid Anda telah diblokir. Hubungi admin untuk informasi lebih lanjut.' };
    }

    const otpResult = sendOTPWhatsApp(masjid.masjid_id, telepon);
    if (!otpResult.success) return otpResult;
    return { success: true, masjid_id: masjid.masjid_id };
  } catch (err) {
    Logger.log('requestOTP error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

// 3.5 checkTokenRevoked — cek apakah token di-revoke
function checkTokenRevoked(masjidId, tokenIssuedAt) {
  const masjid = getMasjidById(masjidId);
  if (!masjid) return true;
  if (!masjid.token_revoked_at) return false;
  const revokedAt = new Date(masjid.token_revoked_at);
  const issuedAt  = new Date(tokenIssuedAt);
  return revokedAt > issuedAt;
}

// validateMasjidSession — validasi session token kriptografis masjid
function validateMasjidSession(masjidId, sessionToken) {
  if (!masjidId || !sessionToken) {
    Logger.log('validateMasjidSession: missing masjidId or sessionToken. masjidId=[' + masjidId + '] sessionToken=[' + sessionToken + '] type(masjidId)=' + typeof masjidId + ' type(sessionToken)=' + typeof sessionToken);
    return { valid: false, error: 'TOKEN_REVOKED' };
  }
  const masjid = getMasjidById(masjidId);
  if (!masjid) {
    Logger.log('validateMasjidSession: masjid not found: ' + masjidId);
    return { valid: false, error: 'Masjid tidak ditemukan' };
  }
  if (masjid.status === 'diblokir') {
    Logger.log('validateMasjidSession: masjid is blocked: ' + masjidId);
    return { valid: false, error: 'Akun masjid Anda telah diblokir. Hubungi admin untuk informasi lebih lanjut.' };
  }
  // Cek session token
  const storedToken = String(masjid.session_token || '').trim();
  const incomingToken = String(sessionToken || '').trim();
  if (!storedToken) {
    Logger.log('validateMasjidSession: stored token is empty for ' + masjidId);
    return { valid: false, error: 'TOKEN_REVOKED' };
  }
  if (storedToken !== incomingToken) {
    Logger.log('validateMasjidSession: token mismatch for ' + masjidId + '. stored=[' + storedToken + '] incoming=[' + incomingToken + ']');
    return { valid: false, error: 'TOKEN_REVOKED' };
  }
  // Cek token revoked
  if (masjid.token_revoked_at && masjid.token_issued_at) {
    const revokedAt = new Date(masjid.token_revoked_at);
    const issuedAt  = new Date(masjid.token_issued_at);
    if (!isNaN(revokedAt) && !isNaN(issuedAt) && revokedAt > issuedAt) {
      Logger.log('validateMasjidSession: token was revoked for ' + masjidId);
      return { valid: false, error: 'TOKEN_REVOKED' };
    }
  }
  return { valid: true };
}

// ============================================================
//  TASK 4: PENDAFTARAN MASJID
// ============================================================

// 4.2 validateNamaMasjid — exact match + fuzzy match per kecamatan
function validateNamaMasjid(namaMasjid, kecamatan) {
  const namaInput = normalizeName(namaMasjid);
  const allMasjid = getAllMasjid();

  for (const m of allMasjid) {
    // Exact match (normalized)
    if (m.nama_normalized === namaInput) {
      return { valid: false, error: 'Masjid sudah terdaftar: ' + m.nama_masjid };
    }
  }

  // Fuzzy match dalam kecamatan yang sama
  for (const m of allMasjid) {
    if (String(m.kecamatan).trim().toLowerCase() === String(kecamatan).trim().toLowerCase()) {
      const similarity = jaroWinklerSimilarity(namaInput, m.nama_normalized);
      if (similarity >= 0.85) {
        return { valid: false, error: 'Masjid serupa sudah terdaftar: ' + m.nama_masjid, similar_masjid: m.nama_masjid };
      }
    }
  }

  return { valid: true };
}

// 4.1 registerMasjid — validasi, cek duplikat, simpan, kirim OTP
function registerMasjid(data) {
  try {
    const { nama_masjid, alamat, kecamatan, kabupaten, nama_pic, telepon_pic } = data;

    // Validasi input
    if (!nama_masjid || String(nama_masjid).trim().length === 0 || String(nama_masjid).length > 200) {
      return { success: false, error: 'Nama masjid tidak valid (maks 200 karakter)' };
    }
    if (!telepon_pic || !/^(\+62|08)\d{8,12}$/.test(String(telepon_pic).trim())) {
      return { success: false, error: 'Format nomor WhatsApp tidak valid' };
    }
    if (!kecamatan || String(kecamatan).trim().length === 0) {
      return { success: false, error: 'Kecamatan tidak boleh kosong' };
    }
    if (!kabupaten || String(kabupaten).trim().length === 0) {
      return { success: false, error: 'Kabupaten tidak boleh kosong' };
    }

    const telepon = normalizeTelepon(String(telepon_pic).trim());

    // 4.3 Cek NomorDiblokir
    const config = _getKonfigSistemRaw();
    if (config.nomor_diblokir && config.nomor_diblokir.includes(telepon)) {
      return { success: false, error: 'Nomor WhatsApp ini tidak dapat digunakan untuk mendaftar.' };
    }

    // 4.4 Cek periode pendaftaran
    if (!config.periode_pendaftaran_buka) {
      return { success: false, error: 'Periode pendaftaran sudah ditutup' };
    }

    // Bungkus validasi nama + simpan dalam lock untuk mencegah race condition
    const lockResult = processWithLock(function() {
      // Cek nomor WA sudah terdaftar
      if (getMasjidByTelepon(telepon)) {
        return { success: false, error: 'Nomor WhatsApp sudah terdaftar. Silakan login.' };
      }

      // Validasi nama masjid (duplikat + fuzzy)
      const namaValidasi = validateNamaMasjid(nama_masjid, kecamatan);
      if (!namaValidasi.valid) {
        return { success: false, error: namaValidasi.error };
      }

      // Generate masjid_id — cari sequence tertinggi yang ada untuk tahun ini
      const year = new Date().getFullYear();
      let maxSeq = 0;
      const allMsj = getAllMasjid();
      for (const m of allMsj) {
        const match = String(m.masjid_id).match(/^MSJ-\d{4}-(\d+)$/);
        if (match) {
          const seq = parseInt(match[1], 10);
          if (seq > maxSeq) maxSeq = seq;
        }
      }
      const masjidId = 'MSJ-' + year + '-' + String(maxSeq + 1).padStart(3, '0');

      // Simpan data masjid
      saveMasjidRecord({
        masjid_id:        masjidId,
        nama_masjid:      String(nama_masjid).trim(),
        nama_normalized:  normalizeName(nama_masjid),
        alamat:           String(alamat || '').trim(),
        kecamatan:        String(kecamatan).trim(),
        kabupaten:        String(kabupaten).trim(),
        nama_pic:         String(nama_pic || '').trim(),
        telepon_pic:      telepon,
        status:           'draft',
        tgl_daftar:       new Date().toISOString(),
        jumlah_kk_valid:  0
      });

      return { success: true, masjid_id: masjidId };
    }, 15000);

    if (!lockResult.success) return lockResult;

    const masjidId = lockResult.masjid_id;

    // Kirim OTP (di luar lock karena bisa lambat)
    const otpResult = sendOTPWhatsApp(masjidId, telepon);
    if (!otpResult.success) {
      deleteMasjidRecord(masjidId);
      return otpResult;
    }

    return { success: true, masjid_id: masjidId, pesan: 'OTP dikirim ke WA' };
  } catch (err) {
    Logger.log('registerMasjid error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

// ============================================================
//  TASK 5: UPLOAD KK DAN OCR
// ============================================================

// 5.6 isValidNomorKK — validasi 16 digit + kode wilayah
function isValidNomorKK(nomor) {
  if (!nomor || String(nomor).length !== 16) return false;
  if (!/^\d{16}$/.test(String(nomor))) return false;
  // Kode wilayah: 2 digit pertama harus 11-99 (kode provinsi Indonesia)
  const kodeProvinsi = parseInt(String(nomor).substring(0, 2), 10);
  return kodeProvinsi >= 11 && kodeProvinsi <= 99;
}

// 5.2 parseNomorKK — regex parsing nomor KK dari teks OCR
function parseNomorKK(rawText) {
  if (!rawText) return null;
  const normalized = String(rawText).replace(/\u00a0/g, ' ').replace(/\u2007/g, ' ');

  const patterns = [
    // Format header KK: "No. 5371051505240008" atau "No.5371051505240008"
    /No\.?\s*(\d{16})(?!\d)/i,
    // Format dengan label: "No. KK : 5371051505240008"
    /No\.?\s*KK\s*[:\s]*(\d{16})(?!\d)/i,
    // Format "Nomor KK" atau "Nomor Kartu Keluarga"
    /Nomor\s*(?:Kartu\s*Keluarga|KK)\s*[:\s]*(\d{16})(?!\d)/i,
    // Format NIK KK
    /NIK\s*KK\s*[:\s]*(\d{16})(?!\d)/i,
    // Nomor 16 digit yang berdiri sendiri (tidak diawali/diakhiri digit lain)
    /(?<!\d)(\d{16})(?!\d)/
  ];

  for (const pattern of patterns) {
    // Cari semua match, ambil yang valid
    const matches = normalized.matchAll ? [...normalized.matchAll(new RegExp(pattern.source, pattern.flags + 'g'))] : [];
    if (matches.length > 0) {
      for (const m of matches) {
        const candidate = m[1];
        if (isValidNomorKK(candidate)) return candidate;
      }
    }
    // Fallback ke match pertama
    const match = normalized.match(pattern);
    if (match) {
      const candidate = match[1];
      if (isValidNomorKK(candidate)) return candidate;
    }
  }

  // Last resort: 16 digit berurutan di teks (termasuk versi tanpa spasi)
  const allSixteen = normalized.match(/\d{16}/g);
  if (allSixteen) {
    for (const candidate of allSixteen) {
      if (isValidNomorKK(candidate)) return candidate;
    }
  }
  const compact = normalized.replace(/[\s\u00a0\u2000-\u200b]+/g, '');
  const allSixteenCompact = compact.match(/\d{16}/g);
  if (allSixteenCompact) {
    for (const candidate of allSixteenCompact) {
      if (isValidNomorKK(candidate)) return candidate;
    }
  }

  return null;
}

// 5.3 parseJumlahAnggotaTertera — ekstrak jumlah anggota dari teks KK
function parseJumlahAnggotaTertera(rawText) {
  if (!rawText) return null;
  
  // Pattern 1-2: Cari "Jumlah Anggota Keluarga: X" atau "Jml Anggota: X"
  const patterns = [
    /(?:Jumlah\s*Anggota\s*Keluarga|Jumlah\s*Anggota)[:\s]*(\d{1,3})/i,
    /(?:Jml\.?\s*Anggota)[:\s]*(\d{1,3})/i
  ];
  for (const pattern of patterns) {
    const match = rawText.match(pattern);
    if (match) {
      const angka = parseInt(match[1], 10);
      if (angka >= 1 && angka <= 30) return angka;
    }
  }
  
  // Pattern 3: Coba hitung dari tabel yang dimulai dengan "No Nama Lengkap"
  const tableMatch = rawText.match(/No\s+Nama\s+Lengkap/i);
  if (tableMatch) {
    const tableStart = rawText.indexOf(tableMatch[0]);
    const tableText = rawText.substring(tableStart);
    const anggotaLines = tableText.match(/^\s*(\d{1,2})\s*[A-Z]/gm);
    if (anggotaLines && anggotaLines.length > 0) {
      const nomors = [];
      for (const line of anggotaLines) {
        const num = parseInt(line.match(/\d+/)[0], 10);
        if (num >= 1 && num <= 30) nomors.push(num);
      }
      if (nomors.length > 0) {
        nomors.sort((a, b) => a - b);
        for (let i = nomors.length - 1; i >= 0; i--) {
          if (nomors[i] === i + 1 || i === 0) {
            return nomors[i];
          }
        }
        const maxValid = Math.max(...nomors.filter(n => n <= 20));
        if (maxValid >= 1) return maxValid;
      }
    }
  }
  
  // Pattern 4: Jika tidak ada tabel header, coba cari family member listings di seluruh text
  const footerKeywords = /Dikeluarkan|Ditandatangani|Kepala Dinas|NIP\.|Tanda Tangan|Status Perkawinan|REPUBLIK INDONESIA|Golongan Darah/i;
  const footerPos = rawText.search(footerKeywords);
  const textToSearch = footerPos > 0 ? rawText.substring(0, footerPos) : rawText;
  
  const lines = textToSearch.split('\n');
  const nomors = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(\d{1,2})\s*([A-Z][A-Z\s]{2,})/);
    if (match) {
      const num = parseInt(match[1], 10);
      const nama = match[2].trim();
      if (num >= 1 && num <= 30 && nama.length >= 3 && !/^\d+$/.test(nama)) {
        nomors.push(num);
      }
    }
  }
  
  if (nomors.length > 0) {
    nomors.sort((a, b) => a - b);
    const unique = [...new Set(nomors)];
    let count = 0;
    for (let i = 1; i <= 30; i++) {
      if (unique.includes(i)) count = i;
      else break;
    }
    if (count >= 1) return count;
  }
  
  return null;
}

// 5.4 parseAnggotaKeluarga — parse daftar anggota dari teks OCR
function parseAnggotaKeluarga(rawText) {
  if (!rawText) return [];

  // Normalisasi line endings
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n');

  // Ekstrak urutan gender dari baris NIK
  // Format baris NIK: "XXXXXXXXXXXXXXXX PEREMPUAN KOTA XXXXXXXXXXXXXXXX LAKI-LAKI KOTA ..."
  // Gender muncul dalam urutan yang sama dengan urutan anggota
  const genderOrder = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!/\d{16}/.test(trimmed)) continue;
    if (!/PEREMPUAN|LAKI|LA-LAKI|LA-LANT/i.test(trimmed)) continue;

    const tokens = trimmed.split(/\s+/);
    for (let i = 0; i < tokens.length; i++) {
      if (/^\d{16}$/.test(tokens[i])) {
        const g1 = (tokens[i + 1] || '').toUpperCase();
        const g2 = (tokens[i + 2] || '').toUpperCase();
        if (/PEREMPUAN/.test(g1)) {
          genderOrder.push('P');
        } else if (/LAKI|LA-LAKI|LA-LANT/.test(g1)) {
          genderOrder.push('L');
        } else if (/PEREMPUAN/.test(g2)) {
          genderOrder.push('P');
        } else {
          genderOrder.push('L');
        }
      }
    }
    if (genderOrder.length > 0) break;
  }

  // Cari posisi "Nama Lengkap" sebagai anchor daftar anggota
  // Nama anggota selalu muncul SETELAH header "Nama Lengkap"
  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/Nama\s+Lengkap/i.test(lines[i].trim())) {
      startIdx = i + 1;
      break;
    }
  }

  // Regex pengenal baris anggota
  // Format KK: "1SULASTRI SUHANDA" atau "2 TATANG SUMANDA"
  const nameRegex = /^(\d{1,2})\s*([A-Z][A-Z\s]{2,60}?)$/;

  // Stop HANYA di footer — BUKAN di "REPUBLIK INDONESIA"
  // karena watermark itu muncul SEBELUM nama anggota
  const stopPattern = /Dikeluarkan|Ditandatangani|Status\s+Perkawinan|Kepala\s+Dinas|NIP\.|Tanda\s+Tangan/i;

  const anggota = [];

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (stopPattern.test(line)) break;

    const match = line.match(nameRegex);
    if (!match) continue;

    const nomor = parseInt(match[1], 10);
    const nama  = match[2].trim();

    if (nomor < 1 || nomor > 30) continue;
    if (nama.length < 3) continue;
    if (/^\d+$/.test(nama)) continue;

    // Gender dari urutan NIK line (lebih akurat dari nextLine)
    const jk = genderOrder[anggota.length] || 'L';

    // Umur tidak bisa diekstrak reliabel dari format OCR ini
    // Info umur ada di kolom terpisah yang OCR baca acak-acakan
    // Masjid koreksi saat konfirmasi anggota
    anggota.push({ nama, jk, umur: 0 });
  }

  // Fallback jika "Nama Lengkap" tidak ditemukan sama sekali
  if (anggota.length === 0 && startIdx === 0) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.length < 3) continue;
      if (stopPattern.test(line)) break;
      const match = line.match(nameRegex);
      if (!match) continue;
      const nomor = parseInt(match[1], 10);
      const nama  = match[2].trim();
      if (nomor < 1 || nomor > 30 || nama.length < 3 || /^\d+$/.test(nama)) continue;
      anggota.push({ nama, jk: genderOrder[anggota.length] || 'L', umur: 0 });
    }
  }

  return anggota;
}

// 5.4b parseAlamatKK — ekstrak alamat dari teks OCR KK
function parseAlamatKK(rawText) {
  if (!rawText) return null;

  const lines = rawText.split('\n');

  // Strategy 1: Cari keyword "Alamat" lalu ambil baris berikutnya yang mulai dengan pola jalan
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    if (/^Alamat/i.test(line)) {
      const nextLine = lines[i + 1].trim();
      if (nextLine && /^(JL|JLN|JALAN|KP|KOMP|KOMPLEK|JEMBATAN|GANG|DESA|KELURAHAN|JL\.)/i.test(nextLine)) {
        let alamat = nextLine;
        if (i + 2 < lines.length) {
          const line3 = lines[i + 2].trim();
          if (line3 && /^(RT|RW|No|Nomor|Blok|Dusun|\d{3}\/\d{3})/i.test(line3)) {
            alamat += ', ' + line3;
          }
        }
        return alamat;
      }
    }
  }

  // Strategy 2: Jika tidak ada keyword "Alamat", cari baris yang mulai dengan pola jalan
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && /^(JL|JLN|JALAN|KP|KOMP|KOMPLEK|JEMBATAN|GANG)/i.test(trimmed)) {
      if (trimmed.length >= 5 && !/kepala|nama|jenis/i.test(trimmed)) {
        return trimmed;
      }
    }
  }

  return null;
}
// 5.5 validateAnggotaCount — deteksi discrepancy
function validateAnggotaCount(jumlahTertera, jumlahParsed) {
  if (jumlahTertera === null || jumlahTertera === undefined) {
    return { has_discrepancy: false, note: null };
  }
  if (jumlahTertera === jumlahParsed) {
    return { has_discrepancy: false, note: null };
  }
  const selisih = Math.abs(jumlahTertera - jumlahParsed);
  let note;
  if (jumlahParsed < jumlahTertera) {
    note = 'Tertera ' + jumlahTertera + ' anggota, berhasil di-parse ' + jumlahParsed +
           '. Kemungkinan ' + selisih + ' baris tidak terbaca oleh OCR.';
  } else {
    note = 'Tertera ' + jumlahTertera + ' anggota, berhasil di-parse ' + jumlahParsed +
           '. OCR mungkin membaca baris yang bukan anggota keluarga.';
  }
  return { has_discrepancy: true, note: note };
}

// Plain text dari Google Doc: REST export + retry + fallback DriveApp (OCR baru sering kosong sesaat).
function getGoogleDocPlainTextViaDriveExport_(docId) {
  const url = 'https://www.googleapis.com/drive/v3/files/' +
    encodeURIComponent(docId) +
    '/export?mimeType=' + encodeURIComponent('text/plain');
  const token = ScriptApp.getOAuthToken();
  let lastErr = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) Utilities.sleep(700 + attempt * 450);
    const resp = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    const code = resp.getResponseCode();
    const body = resp.getContentText() || '';
    if (code === 200 && String(body).replace(/\s+/g, '').length > 15) {
      return body;
    }
    lastErr = 'HTTP ' + code + ' len=' + body.length;
    Logger.log('Drive export retry ' + (attempt + 1) + ': ' + lastErr);
  }
  try {
    const f = DriveApp.getFileById(docId);
    const blob = f.getAs(MimeType.PLAIN_TEXT);
    const s = blob.getDataAsString();
    if (s && String(s).replace(/\s+/g, '').length > 15) return s;
    lastErr += '; DriveApp.getAs kosong';
  } catch (e) {
    lastErr += '; DriveApp: ' + e.toString();
  }
  throw new Error('Drive export gagal: ' + lastErr);
}

// 5.1 extractNomorKK — OCR via Google Drive API
function extractNomorKK(fileId) {
  let ocrDocId = null;
  try {
    const sourceFile = DriveApp.getFileById(fileId);
    const blob = sourceFile.getBlob();

    const resource = {
      title: 'ocr_temp_' + Date.now()
    };

    // Retry hingga 3x jika kena rate limit
    let ocrDoc = null;
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        ocrDoc = Drive.Files.insert(resource, blob, {
          ocr: true,
          ocrLanguage: 'id',
          convert: true
        });
        break; // berhasil, keluar loop
      } catch (e) {
        lastErr = e;
        if (e.toString().includes('rate limit') || e.toString().includes('quota')) {
          Logger.log('OCR rate limit, tunggu ' + (attempt + 1) * 5 + ' detik...');
          Utilities.sleep((attempt + 1) * 5000); // tunggu 5s, 10s, 15s
        } else {
          throw e; // error lain, langsung lempar
        }
      }
    }

    if (!ocrDoc) {
      return { success: false, error: 'OCR rate limit. Coba lagi dalam beberapa menit.' };
    }

    ocrDocId = ocrDoc.id;
    Utilities.sleep(600);
    const rawText = getGoogleDocPlainTextViaDriveExport_(ocrDocId);
    Logger.log('OCR raw text (300 chars): ' + rawText.substring(0, 300));

    const nomorKK = parseNomorKK(rawText);
    if (!nomorKK) return { success: false, raw_text: rawText, error: 'Nomor KK tidak ditemukan' };

    const jumlahAnggotaTertera = parseJumlahAnggotaTertera(rawText);

    return {
      success:                true,
      nomor_kk:               nomorKK,
      jumlah_anggota_tertera: jumlahAnggotaTertera,
      raw_text:               rawText
    };
  } catch (err) {
    Logger.log('extractNomorKK error: ' + err.toString());
    return { success: false, error: 'OCR gagal: ' + err.toString() };
  } finally {
    if (ocrDocId) {
      try { Drive.Files.remove(ocrDocId); } catch (e) { Logger.log('Gagal hapus OCR temp: ' + e); }
    }
  }
}

// 5.7 + 5.8 processUploadKK — alur lengkap upload KK
function processUploadKK(masjidId, fileData, sessionToken) {
  try {
    if (!masjidId || !fileData) return { success: false, error: 'Parameter tidak lengkap' };

    // Validasi session token
    const sessionCheck = validateMasjidSession(masjidId, sessionToken);
    if (!sessionCheck.valid) return { success: false, error: sessionCheck.error };

    // Validasi ukuran file (max 5MB)
    const base64 = fileData.base64Data || '';
    if (Math.ceil(base64.length * 0.75) > 5 * 1024 * 1024) {
      return { success: false, error: 'Ukuran file melebihi 5 MB' };
    }

    // 5.8 Cek status masjid (harus draft)
    const masjid = getMasjidById(masjidId);
    if (!masjid) return { success: false, error: 'Masjid tidak ditemukan' };

    // Ownership check
    const ownershipCheck = validateMasjidOwnership(masjidId, null);
    if (ownershipCheck) return ownershipCheck;

    if (masjid.status !== 'draft') {
      return { success: false, error: 'Upload tidak diizinkan. Status masjid: ' + masjid.status };
    }

    // Cek periode pendaftaran
    const config = _getKonfigSistemRaw();
    if (!config.periode_pendaftaran_buka) {
      return { success: false, error: 'Periode pendaftaran sudah ditutup' };
    }

    // Upload file ke Google Drive
    const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
    const kkFolder   = getOrCreateFolder(rootFolder, FOLDER_KK_NAME);
    const masjidFolder = getOrCreateFolder(kkFolder, masjidId);

    const ext      = (fileData.mimeType || 'image/jpeg').split('/')[1] || 'jpg';
    const fileName = 'kk_' + masjidId + '_' + Date.now() + '.' + ext;
    const blob     = Utilities.newBlob(Utilities.base64Decode(fileData.base64Data), fileData.mimeType);
    blob.setName(fileName);
    const uploadedFile = masjidFolder.createFile(blob);
    const fileId       = uploadedFile.getId();

    // OCR
    const ocrResult = extractNomorKK(fileId);
    if (!ocrResult.success) {
      // Kasus C: OCR gagal — tetap satu record + file upload; simpan teks parsial bila ada
      let anggotaData = null;
      let alamatKK = '';
      let jumlahTertera = null;
      let jumlahParsed = 0;
      let discNote = null;
      if (ocrResult.raw_text) {
        const raw = ocrResult.raw_text;
        const parsed = parseAnggotaKeluarga(raw);
        if (parsed && parsed.length > 0) {
          anggotaData = parsed;
          jumlahParsed = parsed.length;
        }
        alamatKK = parseAlamatKK(raw) || '';
        jumlahTertera = parseJumlahAnggotaTertera(raw);
        discNote = ocrResult.error ? String(ocrResult.error).slice(0, 300) : null;
      }
      const kkIdGagal = saveKKRecord(masjidId, fileId, null, 'gagal_ocr', anggotaData, jumlahTertera, jumlahParsed, discNote, false, alamatKK || null);
      const fotoUrlGagal = 'https://drive.google.com/file/d/' + fileId + '/view';
      const prefillAnggota = anggotaData && anggotaData.length ? anggotaData : [];
      const namaKepalaGagal = namaKepalaDariAnggota_(anggotaData, '');
      return {
        success:     true,
        status_ocr:  'gagal_ocr',
        kk_id:       kkIdGagal,
        file_id:     fileId,
        foto_url:    fotoUrlGagal,
        nama_kepala: namaKepalaGagal,
        jumlah_anggota_parsed: jumlahParsed,
        jumlah_anggota_tertera: jumlahTertera,
        ocr_prefill: {
          nomor_kk:                 '',
          alamat_kk:                alamatKK || '',
          anggota_parsial:          prefillAnggota,
          jumlah_anggota_tertera:   jumlahTertera,
          ocr_error:                ocrResult.error || ''
        }
      };
    }

    const nomorKK = ocrResult.nomor_kk;

    // Validasi nomor KK harus 16 digit
    if (!nomorKK || !/^\d{16}$/.test(String(nomorKK).trim())) {
      return { success: false, error: 'Nomor KK tidak terbaca. Upload ulang foto KK dengan nomor KK terlihat jelas.' };
    }

    // Cek duplikat + simpan record (dalam lock)
    const result = processWithLock(function() {
      // Double-check duplikat di dalam lock
      if (checkDuplicateNomorKK(nomorKK)) {
        const kkIdDup = saveKKRecord(masjidId, fileId, nomorKK, 'duplikat', null, null, 0, null, false, null);
        return {
          success:    true,
          status_ocr: 'duplikat',
          nomor_kk:   nomorKK,
          kk_id:      kkIdDup,
          file_id:    fileId,
          foto_url:   'https://drive.google.com/file/d/' + fileId + '/view',
          nama_kepala: ''
        };
      }

      // Parse anggota dan alamat
      const anggotaData    = parseAnggotaKeluarga(ocrResult.raw_text);
      const alamatKK       = parseAlamatKK(ocrResult.raw_text);
      const jumlahTertera  = ocrResult.jumlah_anggota_tertera;
      const jumlahParsed   = anggotaData.length;
      
      // DEBUG: Log parsing results
      Logger.log('=== PARSING DEBUG ===');
      Logger.log('Raw text length: ' + (ocrResult.raw_text ? ocrResult.raw_text.length : 0));
      Logger.log('Jumlah tertera: ' + jumlahTertera);
      Logger.log('Jumlah parsed: ' + jumlahParsed);
      Logger.log('Alamat parsed: ' + alamatKK);
      Logger.log('Anggota parsed: ' + JSON.stringify(anggotaData));
      Logger.log('=== END DEBUG ===');
      
      const validasiResult = validateAnggotaCount(jumlahTertera, jumlahParsed);

      if (validasiResult.has_discrepancy || jumlahParsed === 0) {
        // Kasus B: perlu konfirmasi anggota
        const fotoUrl = 'https://drive.google.com/file/d/' + fileId + '/view';
        const kkIdKonf = saveKKRecord(masjidId, fileId, nomorKK, 'perlu_konfirmasi_anggota',
                     anggotaData, jumlahTertera, jumlahParsed, validasiResult.note, false, alamatKK);
        const namaKepalaKonf = namaKepalaDariAnggota_(anggotaData, '');
        return {
          success:          true,
          status_ocr:       'perlu_konfirmasi_anggota',
          kk_id:            kkIdKonf,
          file_id:          fileId,
          nomor_kk:         nomorKK,
          nama_kepala:      namaKepalaKonf,
          anggota_parsial:  anggotaData,
          foto_url:         fotoUrl,
          discrepancy_note: validasiResult.note,
          alamat_kk:        alamatKK,
          jumlah_anggota_parsed:  jumlahParsed,
          jumlah_anggota_tertera: jumlahTertera
        };
      }

      // Kasus A: valid
      const kkIdValid = saveKKRecord(masjidId, fileId, nomorKK, 'valid',
                   anggotaData, jumlahTertera, jumlahParsed, null, false, alamatKK);
      incrementJumlahKKValid(masjidId, 1);
      const namaKepalaValid = namaKepalaDariAnggota_(anggotaData, '');
      return {
        success:                 true,
        status_ocr:              'valid',
        kk_id:                   kkIdValid,
        file_id:                 fileId,
        nomor_kk:                nomorKK,
        nama_kepala:             namaKepalaValid,
        alamat_kk:               alamatKK,
        jumlah_anggota_parsed:  jumlahParsed,
        jumlah_anggota_tertera: jumlahTertera
      };
    });

    return result;
  } catch (err) {
    Logger.log('processUploadKK error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

// ============================================================
//  TASK 6: KONFIRMASI ANGGOTA DAN SELESAI UPLOAD
// ============================================================

// 6.1 + 6.2 konfirmasiAnggota — validasi data anggota, update status KK (alamat_kk opsional = koreksi dari form)
function konfirmasiAnggota(masjidId, kkId, anggotaData, sessionToken, alamatKK) {
  try {
    if (!masjidId || !kkId) return { success: false, error: 'Parameter tidak lengkap' };

    // Validasi session token
    const sessionCheck = validateMasjidSession(masjidId, sessionToken);
    if (!sessionCheck.valid) return { success: false, error: sessionCheck.error };

    // Ownership check
    const ownershipCheck = validateMasjidOwnership(masjidId, null);
    if (ownershipCheck) return ownershipCheck;

    // 6.2 Validasi array anggota tidak kosong
    if (!anggotaData || !Array.isArray(anggotaData) || anggotaData.length === 0) {
      return { success: false, error: 'Minimal 1 anggota harus diisi' };
    }

    // Validasi setiap anggota
    for (const anggota of anggotaData) {
      if (!anggota.nama || String(anggota.nama).trim().length === 0) {
        return { success: false, error: 'Nama anggota tidak boleh kosong' };
      }
      if (!['L', 'P'].includes(String(anggota.jk).toUpperCase())) {
        return { success: false, error: 'Jenis kelamin harus L atau P' };
      }
      const umur = Number(anggota.umur);
      if (isNaN(umur) || umur < 0 || umur > 150) {
        return { success: false, error: 'Umur harus antara 0-150' };
      }
    }

    // Cek KK milik masjid ini dan statusnya perlu_konfirmasi_anggota
    const kkRecord = getKKById(kkId);
    if (!kkRecord) return { success: false, error: 'Data KK tidak ditemukan' };
    if (String(kkRecord.masjid_id).trim() !== String(masjidId).trim()) {
      return { success: false, error: 'KK tidak milik masjid ini' };
    }
    if (kkRecord.status_ocr !== 'perlu_konfirmasi_anggota') {
      return { success: false, error: 'KK tidak dalam status perlu konfirmasi anggota' };
    }

    // Normalisasi data anggota
    const anggotaNorm = anggotaData.map(a => ({
      nama: String(a.nama).trim(),
      jk:   String(a.jk).toUpperCase(),
      umur: Number(a.umur)
    }));

    const updateFields = {
      status_ocr:                  'valid',
      anggota_json:                JSON.stringify(anggotaNorm),
      jumlah_anggota_parsed:       anggotaNorm.length,
      anggota_dikonfirmasi_manual: true,
      nama_kepala:                 namaKepalaDariAnggota_(anggotaNorm, '')
    };
    const alamatStr = String(alamatKK || '').trim();
    if (alamatStr.length >= 5) {
      updateFields.alamat_kk = alamatStr.slice(0, 500);
    }
    updateKKRecord(kkId, updateFields);

    // Tambah jumlah_kk_valid
    incrementJumlahKKValid(masjidId, 1);

    return { success: true, jumlah_anggota: anggotaNorm.length };
  } catch (err) {
    Logger.log('konfirmasiAnggota error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

// konfirmasiAnggotaManual — input manual untuk KK yang gagal OCR
// Menerima nomor_kk manual + alamat KK + data anggota, update record dari gagal_ocr ke valid
function konfirmasiAnggotaManual(masjidId, kkId, nomorKK, anggotaData, sessionToken, alamatKK) {
  try {
    if (!masjidId || !kkId) return { success: false, error: 'Parameter tidak lengkap' };

    // Validasi session token
    const sessionCheck = validateMasjidSession(masjidId, sessionToken);
    if (!sessionCheck.valid) return { success: false, error: sessionCheck.error };

    // Validasi nomor KK
    if (!nomorKK || !/^\d{16}$/.test(String(nomorKK).trim())) {
      return { success: false, error: 'Nomor KK harus tepat 16 digit angka' };
    }
    const nomorKKStr = String(nomorKK).trim();
    if (!isValidNomorKK(nomorKKStr)) {
      return { success: false, error: 'Nomor KK tidak valid (kode wilayah tidak dikenal)' };
    }

    const alamatStr = String(alamatKK || '').trim();
    if (alamatStr.length < 5) {
      return { success: false, error: 'Alamat KK wajib diisi (minimal 5 karakter)' };
    }
    if (alamatStr.length > 500) {
      return { success: false, error: 'Alamat KK maksimal 500 karakter' };
    }

    // Cek duplikat nomor KK
    if (checkDuplicateNomorKK(nomorKKStr)) {
      return { success: false, error: 'Nomor KK ' + nomorKKStr + ' sudah terdaftar di sistem' };
    }

    // Validasi data anggota
    if (!anggotaData || !Array.isArray(anggotaData) || anggotaData.length === 0) {
      return { success: false, error: 'Minimal 1 anggota harus diisi' };
    }
    for (const anggota of anggotaData) {
      if (!anggota.nama || String(anggota.nama).trim().length === 0) {
        return { success: false, error: 'Nama anggota tidak boleh kosong' };
      }
      if (!['L', 'P'].includes(String(anggota.jk).toUpperCase())) {
        return { success: false, error: 'Jenis kelamin harus L atau P' };
      }
      const umur = Number(anggota.umur);
      if (isNaN(umur) || umur < 0 || umur > 150) {
        return { success: false, error: 'Umur harus antara 0-150' };
      }
    }

    // Cek KK milik masjid ini dan statusnya gagal_ocr
    const kkRecord = getKKById(kkId);
    if (!kkRecord) return { success: false, error: 'Data KK tidak ditemukan' };
    if (String(kkRecord.masjid_id).trim() !== String(masjidId).trim()) {
      return { success: false, error: 'KK tidak milik masjid ini' };
    }
    if (kkRecord.status_ocr !== 'gagal_ocr') {
      return { success: false, error: 'KK tidak dalam status gagal OCR' };
    }

    // Normalisasi data anggota
    const anggotaNorm = anggotaData.map(a => ({
      nama: String(a.nama).trim(),
      jk:   String(a.jk).toUpperCase(),
      umur: Number(a.umur)
    }));

    // Update record KK dengan nomor KK manual, alamat, dan data anggota
    updateKKRecord(kkId, {
      nomor_kk:                   nomorKKStr,
      alamat_kk:                  alamatStr,
      nama_kepala:                namaKepalaDariAnggota_(anggotaNorm, ''),
      status_ocr:                 'valid',
      anggota_json:               JSON.stringify(anggotaNorm),
      jumlah_anggota_parsed:      anggotaNorm.length,
      anggota_dikonfirmasi_manual: true
    });

    // Tambah jumlah_kk_valid
    incrementJumlahKKValid(masjidId, 1);

    return { success: true, nomor_kk: nomorKKStr, jumlah_anggota: anggotaNorm.length };
  } catch (err) {
    Logger.log('konfirmasiAnggotaManual error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

// 6.3 konfirmasiSelesaiUpload — cek jumlah_kk_valid > 0, update status
function konfirmasiSelesaiUpload(masjidId, sessionToken) {
  try {
    if (!masjidId) return { success: false, error: 'masjid_id diperlukan' };

    // Validasi session token
    const sessionCheck = validateMasjidSession(masjidId, sessionToken);
    if (!sessionCheck.valid) return { success: false, error: sessionCheck.error };

    const masjid = getMasjidById(masjidId);
    if (!masjid) return { success: false, error: 'Masjid tidak ditemukan' };

    // Ownership check
    const ownershipCheck = validateMasjidOwnership(masjidId, null);
    if (ownershipCheck) return ownershipCheck;

    if (masjid.status !== 'draft') {
      return { success: false, error: 'Konfirmasi hanya bisa dilakukan saat status draft. Status saat ini: ' + masjid.status };
    }

    if (masjid.jumlah_kk_valid === 0) {
      return { success: false, error: 'Belum ada KK valid yang diupload' };
    }

    updateMasjidField(masjidId, 'status', 'menunggu_review');

    return { success: true };
  } catch (err) {
    Logger.log('konfirmasiSelesaiUpload error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}


// ============================================================
//  TASK 8: MANAJEMEN TOKEN SESI DAN REVOKE
// ============================================================

// 8.1 revokeTokenMasjid — set token_revoked_at ke now()
function revokeTokenMasjid(masjidId, adminEmail) {
  try {
    if (!masjidId) return { success: false, error: 'masjid_id diperlukan' };
    const masjid = getMasjidById(masjidId);
    if (!masjid) return { success: false, error: 'Masjid tidak ditemukan' };
    const now = new Date().toISOString();
    updateMasjidFields(masjidId, {
      token_revoked_at: now,
      session_token:    ''
    });
    return { success: true };
  } catch (err) {
    Logger.log('revokeTokenMasjid error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

// 8.2 checkTokenRevoked sudah diimplementasikan di Task 3 (checkTokenRevoked)

// 8.3 Middleware validasi token masjid — dipanggil di endpoint yang butuh auth masjid
function validateMasjidToken(masjidId, tokenIssuedAt) {
  if (!masjidId || !tokenIssuedAt) return { valid: false, error: 'Token tidak valid' };
  const masjid = getMasjidById(masjidId);
  if (!masjid) return { valid: false, error: 'Masjid tidak ditemukan' };
  if (masjid.status === 'diblokir') {
    return { valid: false, error: 'Akun masjid Anda telah diblokir. Hubungi admin untuk informasi lebih lanjut.' };
  }
  if (checkTokenRevoked(masjidId, tokenIssuedAt)) {
    return { valid: false, error: 'TOKEN_REVOKED' };
  }
  return { valid: true, masjid: masjid };
}

// 8.4 updateNomorWAMasjid — validasi format + keunikan nomor baru
function updateNomorWAMasjid(masjidId, nomorWaBaru, adminEmail) {
  try {
    if (!masjidId || !nomorWaBaru) return { success: false, error: 'Parameter tidak lengkap' };
    if (!/^(\+62|08)\d{8,12}$/.test(String(nomorWaBaru).trim())) {
      return { success: false, error: 'Format nomor WhatsApp tidak valid' };
    }
    const nomorBaru = String(nomorWaBaru).trim();
    // Cek keunikan — tidak boleh dipakai masjid lain
    const existing = getMasjidByTelepon(nomorBaru);
    if (existing && String(existing.masjid_id).trim() !== String(masjidId).trim()) {
      return { success: false, error: 'Nomor WhatsApp sudah digunakan oleh masjid lain' };
    }
    updateMasjidField(masjidId, 'telepon_pic', nomorBaru);
    return { success: true };
  } catch (err) {
    Logger.log('updateNomorWAMasjid error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

// ============================================================
//  TASK 9: KONTROL PERIODE PENDAFTARAN DAN MANAJEMEN ADMIN
// ============================================================

// 9.1 togglePeriodePendaftaran — update KonfigSistem
function togglePeriodePendaftaran(buka, adminEmail) {
  try {
    updateKonfigSistem('periode_pendaftaran_buka', buka ? 'true' : 'false', adminEmail);
    return { success: true, periode_pendaftaran_buka: buka };
  } catch (err) {
    Logger.log('togglePeriodePendaftaran error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

// 9.2 resolveKKVerifikasi — terima/tolak/koreksi KK perlu_verifikasi
function resolveKKVerifikasi(kkId, action, koreksiData, adminEmail) {
  try {
    if (!kkId || !action) return { success: false, error: 'Parameter tidak lengkap' };
    const kkRecord = getKKById(kkId);
    if (!kkRecord) return { success: false, error: 'Data KK tidak ditemukan' };
    if (kkRecord.status_ocr !== 'perlu_verifikasi') {
      return { success: false, error: 'KK tidak dalam status perlu verifikasi' };
    }

    if (action === 'terima') {
      updateKKRecord(kkId, { status_ocr: 'valid' });
      incrementJumlahKKValid(kkRecord.masjid_id, 1);
      return { success: true };
    }

    if (action === 'tolak') {
      updateKKRecord(kkId, { status_ocr: 'gagal_ocr' });
      return { success: true };
    }

    if (action === 'koreksi') {
      const updates = { status_ocr: 'manual' };
      if (koreksiData) {
        if (koreksiData.nomor_kk) updates.nomor_kk = koreksiData.nomor_kk;
        if (koreksiData.jumlah_anggota_tertera !== undefined) {
          updates.jumlah_anggota_tertera = koreksiData.jumlah_anggota_tertera;
        }
      }
      updateKKRecord(kkId, updates);
      incrementJumlahKKValid(kkRecord.masjid_id, 1);
      return { success: true };
    }

    return { success: false, error: 'Action tidak valid. Gunakan: terima, tolak, atau koreksi' };
  } catch (err) {
    Logger.log('resolveKKVerifikasi error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

// 9.3 rejectRegistration — tolak pendaftaran masjid
function rejectRegistration(masjidId, alasan) {
  try {
    if (!masjidId) return { success: false, error: 'masjid_id diperlukan' };
    const masjid = getMasjidById(masjidId);
    if (!masjid) return { success: false, error: 'Masjid tidak ditemukan' };
    updateMasjidField(masjidId, 'status', 'ditolak');
    return { success: true };
  } catch (err) {
    Logger.log('rejectRegistration error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

// 9.4 getRegistrations — ambil semua pendaftaran masjid (dengan pagination)
function getRegistrations(page, limit) {
  try {
    page = Math.max(1, Number(page) || 1);
    limit = Math.min(500, Math.max(1, Number(limit) || 50)); // Max 500 per page
    
    const allMasjid = getAllMasjid();
    const total = allMasjid.length;
    const offset = (page - 1) * limit;
    const paginatedData = allMasjid.slice(offset, offset + limit);
    
    return { 
      success: true, 
      data: paginatedData, 
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  } catch (err) {
    logSecure('getRegistrations', 'Error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

// 9.4 getKKDetailByMasjid — detail KK per masjid (dengan pagination)
function getKKDetailByMasjid(masjidId, page, limit) {
  try {
    if (!masjidId) return { success: false, error: 'masjid_id diperlukan' };
    
    page = Math.max(1, Number(page) || 1);
    limit = Math.min(500, Math.max(1, Number(limit) || 50)); // Max 500 per page
    
    const kkList = getKKByMasjid(masjidId);
    const total = kkList.length;
    const offset = (page - 1) * limit;
    const paginatedData = kkList.slice(offset, offset + limit);
    
    return { 
      success: true, 
      data: paginatedData, 
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  } catch (err) {
    logSecure('getKKDetailByMasjid', 'Error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

// 9.4 getKKPerluVerifikasiByMasjid — KK dengan status perlu_verifikasi (dengan pagination)
function getKKPerluVerifikasiByMasjid(masjidId, page, limit) {
  try {
    page = Math.max(1, Number(page) || 1);
    limit = Math.min(500, Math.max(1, Number(limit) || 50)); // Max 500 per page
    
    const kkList = masjidId ? getKKByMasjid(masjidId) : getAllKKPerluVerifikasi();
    const filtered = kkList.filter(kk => kk.status_ocr === 'perlu_verifikasi');
    const total = filtered.length;
    const offset = (page - 1) * limit;
    const paginatedData = filtered.slice(offset, offset + limit);
    
    return { 
      success: true, 
      data: paginatedData, 
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  } catch (err) {
    logSecure('getKKPerluVerifikasiByMasjid', 'Error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

function getAllKKPerluVerifikasi() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_DATA_KK);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const result = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][4]).trim() === 'perlu_verifikasi') {
      result.push(rowToKKObj(headers, data[i]));
    }
  }
  return result;
}

// ============================================================
//  TASK 10: PENETAPAN JATAH DAN PENERBITAN KUPON
// ============================================================

// 10.1 generateKuponKode — format BNT-YYYY-SEQ-TOKEN8 (token acak 8 karakter untuk keamanan)
function generateKuponKode(masjidId, jumlahSapi) {
  const year = new Date().getFullYear();

  // Ambil sequence number masjid (3 digit)
  const masjidSeq = String(masjidId).replace('MSJ-' + year + '-', '').replace(/MSJ-\d+-/, '');

  // Generate token acak 8 karakter — ini yang membuat kode tidak bisa ditebak
  function randomToken(len) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa 0,O,1,I agar tidak ambigu
    let token = '';
    for (let i = 0; i < len; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  // Format: BNT-YYYY-NNN-JUMLAH-TOKEN8
  // Contoh: BNT-2026-001-3S-X7K2M9QP
  let kodeKupon;
  let attempts = 0;
  do {
    const token = randomToken(8);
    kodeKupon = 'BNT-' + year + '-' + masjidSeq + '-' + jumlahSapi + 'S-' + token;
    attempts++;
  } while (isKodeKuponExists(kodeKupon) && attempts < 10);

  if (attempts >= 10) return null;
  return kodeKupon;
}

// 10.2 generateQRCode — api.qrserver.com (pengganti Google Charts yang deprecated)
function generateQRCode(kodeKupon) {
  try {
    // Coba api.qrserver.com (lebih stabil, tidak deprecated)
    const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/' +
                  '?size=300x300&data=' + encodeURIComponent(kodeKupon) +
                  '&format=png&ecc=M&margin=4';
    const response = UrlFetchApp.fetch(qrUrl, { muteHttpExceptions: true });
    if (response.getResponseCode() === 200) {
      return Utilities.base64Encode(response.getContent());
    }
    Logger.log('generateQRCode: api.qrserver.com gagal (HTTP ' + response.getResponseCode() + '), mencoba fallback...');

    // Fallback: Google Charts (mungkin masih aktif)
    const fallbackUrl = 'https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=' +
                        encodeURIComponent(kodeKupon) + '&choe=UTF-8';
    const fallbackResponse = UrlFetchApp.fetch(fallbackUrl, { muteHttpExceptions: true });
    if (fallbackResponse.getResponseCode() === 200) {
      return Utilities.base64Encode(fallbackResponse.getContent());
    }

    Logger.log('generateQRCode: semua endpoint gagal');
    return null;
  } catch (err) {
    Logger.log('generateQRCode error: ' + err.toString());
    return null;
  }
}

// 10.3 + 10.4 setJatah — validasi, generate kupon, update status masjid
function setJatah(masjidId, jumlahSapi, adminEmail) {
  try {
    if (!masjidId || !jumlahSapi) return { success: false, error: 'Parameter tidak lengkap' };

    const jumlah = parseInt(jumlahSapi, 10);
    if (isNaN(jumlah) || jumlah <= 0) {
      return { success: false, error: 'Jumlah sapi harus bilangan bulat positif' };
    }

    const masjid = getMasjidById(masjidId);
    if (!masjid) return { success: false, error: 'Masjid tidak ditemukan' };

    // 10.4 Cek satu kupon aktif per masjid
    const existingKupon = getActiveKuponByMasjid(masjidId);
    if (existingKupon) {
      return { success: false, error: 'Masjid sudah memiliki kupon aktif' };
    }

    // Generate kode kupon unik
    const kodeKupon = generateKuponKode(masjidId, jumlah);
    if (!kodeKupon) return { success: false, error: 'Gagal generate kode kupon unik' };

    // Generate QR Code
    const qrBase64 = generateQRCode(kodeKupon);
    if (!qrBase64) return { success: false, error: 'Gagal generate QR code. Coba lagi.' };

    // Simpan kupon
    const year    = new Date().getFullYear();
    const kuponId = 'KPN-' + year + '-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    saveKuponRecord({
      kupon_id:   kuponId,
      masjid_id:  masjidId,
      kode_kupon: kodeKupon,
      qr_data:    kodeKupon,
      jumlah_sapi: jumlah,
      status:     'aktif',
      tgl_terbit: new Date().toISOString()
    });

    // Update status masjid dan jumlah_sapi_jatah
    updateMasjidFields(masjidId, {
      status:           'disetujui',
      jumlah_sapi_jatah: jumlah,
      tgl_penetapan:    new Date().toISOString(),
      admin_penetap:    adminEmail || ''
    });

    return {
      success: true,
      kupon: {
        kupon_id:   kuponId,
        kode_kupon: kodeKupon,
        qr_base64:  qrBase64,
        jumlah_sapi: jumlah
      }
    };
  } catch (err) {
    Logger.log('setJatah error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

// getKuponMasjidByMasjidId — ambil kupon aktif masjid (untuk portal masjid)
function getKuponMasjidByMasjidId(masjidId, sessionToken) {
  try {
    if (!masjidId) return { success: false, error: 'masjid_id diperlukan' };

    // Validasi session token
    const sessionCheck = validateMasjidSession(masjidId, sessionToken);
    if (!sessionCheck.valid) return { success: false, error: sessionCheck.error };

    // Ownership check
    const ownershipCheck = validateMasjidOwnership(masjidId, null);
    if (ownershipCheck) return ownershipCheck;

    const kupon = getActiveKuponByMasjid(masjidId);
    if (!kupon) {
      // Cek apakah ada kupon yang sudah digunakan
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_KUPON_MASJID);
      if (sheet) {
        const data = sheet.getDataRange().getValues();
        const headers = data[0];
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][1]).trim() === String(masjidId).trim()) {
            return { success: true, kupon: rowToKuponObj(headers, data[i]) };
          }
        }
      }
      return { success: true, kupon: null };
    }

    // Generate QR code fresh jika belum ada
    let qrBase64 = kupon.qr_data;
    if (!qrBase64 || qrBase64 === kupon.kode_kupon) {
      qrBase64 = generateQRCode(kupon.kode_kupon) || '';
    }

    return {
      success: true,
      kupon: {
        kupon_id:    kupon.kupon_id,
        kode_kupon:  kupon.kode_kupon,
        qr_base64:   qrBase64,
        jumlah_sapi: kupon.jumlah_sapi,
        status:      kupon.status,
        tgl_terbit:  kupon.tgl_terbit
      }
    };
  } catch (err) {
    Logger.log('getKuponMasjidByMasjidId error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

// getDashboardMasjid — data lengkap untuk dashboard portal masjid
function getDashboardMasjid(masjidId, sessionToken) {
  try {
    if (!masjidId) return { success: false, error: 'masjid_id diperlukan' };

    // Validasi session token
    const sessionCheck = validateMasjidSession(masjidId, sessionToken);
    if (!sessionCheck.valid) return { success: false, error: sessionCheck.error };

    const masjid = getMasjidById(masjidId);
    if (!masjid) return { success: false, error: 'Masjid tidak ditemukan' };

    // Ownership/status check
    const ownershipCheck = validateMasjidOwnership(masjidId, null);
    if (ownershipCheck) return ownershipCheck;

    const kkList = getKKByMasjid(masjidId);
    const kupon = getActiveKuponByMasjid(masjidId);

    return {
      success: true,
      masjid: {
        masjid_id:         masjid.masjid_id,
        nama_masjid:       masjid.nama_masjid,
        alamat:            masjid.alamat,
        kecamatan:         masjid.kecamatan,
        kabupaten:         masjid.kabupaten,
        nama_pic:          masjid.nama_pic,
        telepon_pic:       masjid.telepon_pic,
        status:            masjid.status,
        jumlah_kk_valid:   masjid.jumlah_kk_valid,
        jumlah_sapi_jatah: masjid.jumlah_sapi_jatah,
        token_issued_at:   masjid.token_issued_at,
        token_revoked_at:  masjid.token_revoked_at
      },
      kk_summary: {
        total:             kkList.length,
        valid:             kkList.filter(k => k.status_ocr === 'valid' || k.status_ocr === 'manual').length,
        duplikat:          kkList.filter(k => k.status_ocr === 'duplikat').length,
        gagal_ocr:         kkList.filter(k => k.status_ocr === 'gagal_ocr').length,
        perlu_konfirmasi:  kkList.filter(k => k.status_ocr === 'perlu_konfirmasi_anggota').length
      },
      kupon: kupon ? {
        kupon_id:    kupon.kupon_id,
        kode_kupon:  kupon.kode_kupon,
        jumlah_sapi: kupon.jumlah_sapi,
        status:      kupon.status,
        tgl_terbit:  kupon.tgl_terbit
      } : null
    };
  } catch (err) {
    Logger.log('getDashboardMasjid error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

// ============================================================
//  TASK 11: VALIDASI DAN KONFIRMASI PENGAMBILAN KUPON
// ============================================================

// 11.1 validateKupon — cari kupon, cek status, return info masjid (TIDAK ubah status)
function validateKupon(kodeKupon, petugasEmail) {
  try {
    if (!kodeKupon) return { success: false, error: 'Kode kupon diperlukan' };

    const kupon = getKuponByKode(String(kodeKupon).trim());
    if (!kupon) return { success: false, error: 'Kupon tidak valid' };

    if (kupon.status === 'digunakan') {
      return {
        success: false,
        error:   'Kupon sudah digunakan',
        detail:  {
          tgl_digunakan: kupon.tgl_digunakan,
          petugas:       kupon.petugas_scan
        }
      };
    }

    if (kupon.status === 'dibatalkan') {
      return { success: false, error: 'Kupon telah dibatalkan' };
    }

    const masjid = getMasjidById(kupon.masjid_id);
    return {
      success:     true,
      valid:       true,
      kupon_id:    kupon.kupon_id,
      kode_kupon:  kupon.kode_kupon,
      jumlah_sapi: kupon.jumlah_sapi,
      masjid: {
        nama_masjid: masjid ? masjid.nama_masjid : '',
        alamat:      masjid ? masjid.alamat      : '',
        kecamatan:   masjid ? masjid.kecamatan   : '',
        nama_pic:    masjid ? masjid.nama_pic     : '',
        telepon_pic: masjid ? masjid.telepon_pic  : ''
      }
    };
  } catch (err) {
    Logger.log('validateKupon error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

// 11.2 + 11.3 konfirmasiPengambilan — upload foto, update status kupon (dalam lock)
function konfirmasiPengambilan(kuponId, fotoBuktiBase64, mimeType, petugasEmail) {
  try {
    if (!kuponId) return { success: false, error: 'kupon_id diperlukan' };
    if (!fotoBuktiBase64 || fotoBuktiBase64.trim() === '') {
      return { success: false, error: 'Foto bukti pengambilan wajib diupload' };
    }
    // Validasi ukuran foto (max 10MB)
    if (Math.ceil(fotoBuktiBase64.length * 0.75) > 10 * 1024 * 1024) {
      return { success: false, error: 'Ukuran foto melebihi 10 MB' };
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      return { success: false, error: 'Tipe file foto tidak valid' };
    }

    // Validasi + update status dalam lock (mencegah race condition)
    const result = processWithLock(function() {
      // 11.3 Double-check status di dalam lock
      const kupon = getKuponById(kuponId);
      if (!kupon) return { success: false, error: 'Kupon tidak ditemukan' };

      if (kupon.status === 'digunakan') {
        return {
          success: false,
          error:   'Kupon sudah digunakan pada ' + kupon.tgl_digunakan + ' oleh ' + kupon.petugas_scan
        };
      }
      if (kupon.status !== 'aktif') {
        return { success: false, error: 'Kupon tidak dapat dikonfirmasi. Status: ' + kupon.status };
      }

      // Upload foto bukti ke Google Drive
      const rootFolder  = DriveApp.getFolderById(ROOT_FOLDER_ID);
      const buktiFolder = getOrCreateFolder(rootFolder, FOLDER_BUKTI_FOTO_NAME);
      const masjidFolder = getOrCreateFolder(buktiFolder, kupon.masjid_id);

      const ext      = (mimeType || 'image/jpeg').split('/')[1] || 'jpg';
      const fileName = 'bukti_' + kuponId + '_' + Date.now() + '.' + ext;
      const blob     = Utilities.newBlob(Utilities.base64Decode(fotoBuktiBase64), mimeType);
      blob.setName(fileName);
      const uploadedFile = masjidFolder.createFile(blob);
      const fileId       = uploadedFile.getId();
      const fileUrl      = 'https://drive.google.com/file/d/' + fileId + '/view';

      // Update status kupon ke "digunakan"
      updateKuponRecord(kuponId, {
        status:        'digunakan',
        tgl_digunakan: new Date().toISOString(),
        petugas_scan:  petugasEmail || '',
        foto_bukti_id: fileId,
        foto_bukti_url: fileUrl
      });

      return { success: true };
    });

    return result;
  } catch (err) {
    Logger.log('konfirmasiPengambilan error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

// ============================================================
//  TASK 12: MODERASI MASJID — HAPUS DAN BLOKIR
// ============================================================

// validateMasjidOwnership — helper untuk validasi masjid ada dan tidak diblokir
function validateMasjidOwnership(masjidId, user) {
  const masjid = getMasjidById(masjidId);
  if (!masjid) return { success: false, error: 'Masjid tidak ditemukan' };
  if (masjid.status === 'diblokir') return { success: false, error: 'Akun masjid Anda telah diblokir. Hubungi admin untuk informasi lebih lanjut.' };
  return null; // null = valid
}

// 12.1 hapusMasjid — cek tidak ada kupon aktif, hapus masjid + semua DataKK
function hapusMasjid(masjidId, adminEmail) {
  try {
    if (!masjidId) return { success: false, error: 'masjid_id diperlukan' };
    const masjid = getMasjidById(masjidId);
    if (!masjid) return { success: false, error: 'Masjid tidak ditemukan' };

    // Cek kupon aktif
    const kuponAktif = getActiveKuponByMasjid(masjidId);
    if (kuponAktif) {
      return { success: false, error: 'Tidak dapat menghapus masjid yang memiliki kupon aktif. Batalkan kupon terlebih dahulu.' };
    }

    // Hapus semua DataKK milik masjid
    deleteKKByMasjid(masjidId);

    // Hapus record masjid
    deleteMasjidRecord(masjidId);

    return { success: true };
  } catch (err) {
    Logger.log('hapusMasjid error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

// 12.2 blokirMasjid — set status diblokir, revoke token, catat alasan
function blokirMasjid(masjidId, alasan, adminEmail) {
  try {
    if (!masjidId) return { success: false, error: 'masjid_id diperlukan' };
    const masjid = getMasjidById(masjidId);
    if (!masjid) return { success: false, error: 'Masjid tidak ditemukan' };

    const now = new Date().toISOString();
    updateMasjidFields(masjidId, {
      status:               'diblokir',
      token_revoked_at:     now,
      alasan_blokir:        alasan || '',
      admin_pemblokir:      adminEmail || '',
      tgl_diblokir:         now,
      status_sebelum_blokir: masjid.status
    });

    return { success: true };
  } catch (err) {
    Logger.log('blokirMasjid error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

// 12.3 bukaBlokirMasjid — kembalikan status ke sebelum diblokir, hapus catatan blokir
function bukaBlokirMasjid(masjidId, adminEmail) {
  try {
    if (!masjidId) return { success: false, error: 'masjid_id diperlukan' };
    const masjid = getMasjidById(masjidId);
    if (!masjid) return { success: false, error: 'Masjid tidak ditemukan' };
    if (masjid.status !== 'diblokir') {
      return { success: false, error: 'Masjid tidak dalam status diblokir' };
    }

    // Kembalikan ke status sebelum diblokir (fallback ke 'draft')
    const statusRestore = masjid.status_sebelum_blokir || 'draft';
    updateMasjidFields(masjidId, {
      status:               statusRestore,
      alasan_blokir:        '',
      admin_pemblokir:      '',
      tgl_diblokir:         '',
      status_sebelum_blokir: ''
    });

    return { success: true };
  } catch (err) {
    Logger.log('bukaBlokirMasjid error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

// 12.4 blokirNomorWA — tambahkan nomor ke NomorDiblokir di KonfigSistem
function blokirNomorWA(nomorWA, adminEmail) {
  try {
    if (!nomorWA) return { success: false, error: 'Nomor WA diperlukan' };
    const config = _getKonfigSistemRaw();
    const daftar = config.nomor_diblokir || [];
    const nomor  = String(nomorWA).trim();
    if (!daftar.includes(nomor)) {
      daftar.push(nomor);
      updateKonfigSistem('nomor_diblokir', JSON.stringify(daftar), adminEmail);
    }
    return { success: true };
  } catch (err) {
    Logger.log('blokirNomorWA error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

// 12.4 bukaBlokirNomorWA — hapus nomor dari NomorDiblokir
function bukaBlokirNomorWA(nomorWA, adminEmail) {
  try {
    if (!nomorWA) return { success: false, error: 'Nomor WA diperlukan' };
    const config = _getKonfigSistemRaw();
    const daftar = (config.nomor_diblokir || []).filter(n => n !== String(nomorWA).trim());
    updateKonfigSistem('nomor_diblokir', JSON.stringify(daftar), adminEmail);
    return { success: true };
  } catch (err) {
    Logger.log('bukaBlokirNomorWA error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}

// 12.5 getNomorDiblokir — return daftar nomor WA yang diblokir
function getNomorDiblokir() {
  try {
    const config = _getKonfigSistemRaw();
    return { success: true, data: config.nomor_diblokir || [] };
  } catch (err) {
    Logger.log('getNomorDiblokir error: ' + err.toString());
    return { success: false, error: 'Internal server error' };
  }
}