// ============================================================
//  KONFIGURASI
// ============================================================
const NAMA_SHEET_DB          = "Database";
const NAMA_SHEET_LAPORAN     = "Laporan";
const NAMA_SHEET_AKUN        = "Akun";
const NAMA_SHEET_DOKUMENTASI = "DokumentasiInstansi";
const ROOT_FOLDER_ID         = "GANTI_DENGAN_ID_FOLDER_DRIVE_KAMU";

// Secret key — harus sama persis dengan GAS_SECRET di .env Vercel
// Simpan di Script Properties: File → Project Properties → Script Properties
// Key: SCRIPT_SECRET  Value: (sama dengan GAS_SECRET di Vercel)
const SCRIPT_SECRET = PropertiesService.getScriptProperties().getProperty('SCRIPT_SECRET') || '';

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

    // ── Validasi secret — tolak semua request tanpa secret yang benar ──
    if (!SCRIPT_SECRET || body.secret !== SCRIPT_SECRET) {
      return jsonResponse({ success: false, error: 'Akses ditolak' });
    }

    // data = payload dari proxy, user = objek user terverifikasi dari JWT
    const data = body.data || {};
    const user = body.user || null; // { email, role } — sudah diverifikasi proxy

    // ── Rate limiting per user via CacheService ──
    if (user && !checkGasRateLimit(user.email)) {
      return jsonResponse({ success: false, error: 'Terlalu banyak permintaan' });
    }

    let result;
    switch (action) {
      // Public — tidak butuh user
      case 'verifyCredentials':     result = verifyCredentials(data.email, data.password); break;
      case 'getPublicStats':        result = getPublicStats(); break;
      case 'searchPekurban':        result = searchPekurban(data.query); break;
      case 'getPekurbanDetail':     result = getPekurbanDetail(data.nama, data.nomor_hewan); break;
      case 'getDokumentasiWilayah': result = getDokumentasiWilayah(data.wilayah); break;

      // User — butuh user terverifikasi
      case 'getHewan':          result = requireUser(user) || getDataForUi(user.email); break;
      case 'uploadFoto':        result = requireUser(user) || uploadFotoJenis(data, user); break;
      case 'getDokumentasi':    result = requireUser(user) || getDokumentasiInstansi(user.email); break;
      case 'uploadDokumentasi': result = requireUser(user) || uploadDokumentasiInstansi(data, user); break;
      case 'getFileById':       result = requireUser(user) || getFileById(data.fileId, user); break;

      // Admin only — butuh role admin
      case 'getAdminData':  result = requireAdmin(user) || getAdminData(user.email); break;
      case 'addHewan':      result = requireAdmin(user) || addHewan(user.email, data.hewan); break;
      case 'updateHewan':   result = requireAdmin(user) || updateHewan(user.email, data.hewan); break;
      case 'deleteHewan':   result = requireAdmin(user) || deleteHewan(user.email, data.nomor_hewan); break;
      case 'addUser':       result = requireAdmin(user) || addUser(user.email, data.newUser); break;
      case 'updateUser':    result = requireAdmin(user) || updateUser(user.email, data.user); break;
      case 'deleteUser':    result = requireAdmin(user) || deleteUser(user.email, data.targetEmail); break;

      default: result = { success: false, error: 'Action tidak dikenal' };
    }

    return jsonResponse(result);

  } catch (err) {
    Logger.log('GAS Error: ' + err.toString());
    return jsonResponse({ success: false, error: 'Internal server error' });
  }
}

// ── Helper: buat response JSON ────────────────────────────────
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Helper: cek user terverifikasi ────────────────────────────
function requireUser(user) {
  if (!user || !user.email || !user.role) {
    return { success: false, error: 'Autentikasi diperlukan' };
  }
  return null; // null = lolos, lanjut eksekusi
}

// ── Helper: cek role admin ────────────────────────────────────
function requireAdmin(user) {
  const check = requireUser(user);
  if (check) return check;
  if (user.role !== 'admin') return { success: false, error: 'Akses ditolak' };
  return null;
}

// ── Rate limiting GAS via CacheService ───────────────────────
function checkGasRateLimit(email) {
  const cache = CacheService.getScriptCache();
  const key   = 'rl_' + email;
  const count = parseInt(cache.get(key) || '0', 10);
  if (count >= 60) return false; // max 60 request per menit
  cache.put(key, String(count + 1), 60); // TTL 60 detik
  return true;
}

// ============================================================
//  HELPER FUNCTIONS
// ============================================================

// Hash dengan salt — format simpan: hash|salt
// Iterasi 500x untuk memperlambat brute force
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
    // Legacy: plain SHA-256 tanpa salt (untuk akun lama)
    const bytes = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256, plainText, Utilities.Charset.UTF_8
    );
    const legacyHash = bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
    return legacyHash === storedHash;
  }
  const { hash } = hashPass(plainText, storedSalt);
  return hash === storedHash;
}

// isValidUser dan isAdmin dihapus — autentikasi kini dilakukan di proxy via JWT.
// GAS hanya menerima user object yang sudah diverifikasi proxy.

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

/**
 * Memisahkan string nama pekurban yang dipisah koma.
 * "PAK JOKO, PAK ANWAR, BU KARTINI" → ["PAK JOKO", "PAK ANWAR", "BU KARTINI"]
 */
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
      // Hitung pekurban: untuk sapi bisa lebih dari 1 (split koma)
      const names = splitNamaPekurban(row[2]);
      totalPekurban += names.length > 0 ? names.length : (Number(row[3]) || 1);
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
//  GAS hanya verifikasi — JWT dibuat di proxy, bukan di sini
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
      const storedSalt  = row[4] ? String(row[4]).trim() : ''; // kolom E: salt
      const username    = row[2] ? String(row[2]).trim() : storedEmail.split('@')[0];
      const role        = row[3] ? String(row[3]).trim().toLowerCase() : 'user';

      if (storedEmail.toLowerCase() !== email.toLowerCase()) continue;
      if (!storedHash) continue;

      if (verifyPassword(password, storedHash, storedSalt)) {
        return { success: true, email: storedEmail, username, role };
      } else {
        // Jangan bocorkan alasan gagal
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
    if (!dbSheet) return { success: false, error: "Sheet Database tidak ditemukan" };

    const dbData   = dbSheet.getDataRange().getValues();
    const statusMap = {};
    if (laporanSheet) {
      const lapData = laporanSheet.getDataRange().getValues();
      for (let i = 1; i < lapData.length; i++) {
        const row = lapData[i];
        if (!row || !row[0]) continue;
        statusMap[String(row[0])] = {
          url_hidup:            safeVal(row[6]),  tgl_hidup:            safeVal(row[7]),  uploader_hidup:            safeVal(row[12]),
          url_ditumbangkan:     safeVal(row[8]),  tgl_ditumbangkan:     safeVal(row[9]),  uploader_ditumbangkan:     safeVal(row[13]),
          url_mati:             safeVal(row[10]), tgl_mati:             safeVal(row[11]), uploader_mati:             safeVal(row[14])
        };
      }
    }

    const result = [];
    for (let i = 1; i < dbData.length; i++) {
      const row = dbData[i];
      if (!row || !row[0]) continue;
      const nomor = String(row[0]);
      result.push({
        nomor_hewan:     nomor,
        jenis_hewan:     row[1] ? String(row[1]) : 'Sapi',
        daftar_pekurban: row[2] ? String(row[2]) : '',
        jumlah_pekurban: row[3] ? Number(row[3]) : 1,
        instansi:        row[4] ? String(row[4]) : '',
        wilayah:         row[5] ? String(row[5]) : '',
        status:          statusMap[nomor] || { url_hidup: '', url_ditumbangkan: '', url_mati: '' }
      });
    }
    return { success: true, data: result };
  } catch (err) { Logger.log(err.toString()); return { success: false, error: "Internal server error" }; }
}

// ============================================================
//  PORTAL PEKURBAN — SEARCH
//  Memisahkan nama pekurban sapi (koma) menjadi entri individual.
//  Setiap pekurban hanya melihat namanya sendiri.
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

      // Pisahkan nama-nama pekurban
      const namaList = splitNamaPekurban(rawNama);

      namaList.forEach(nama => {
        // Hanya tampilkan nama yang cocok dengan query — nama lain tidak terlihat
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
//  Mengembalikan info hewan + status foto untuk 1 pekurban.
// ============================================================
function getPekurbanDetail(nama, nomor_hewan) {
  try {
    if (!nama || !nomor_hewan) return { success: false, error: "Parameter tidak lengkap" };

    const ss      = SpreadsheetApp.getActiveSpreadsheet();
    const dbSheet = ss.getSheetByName(NAMA_SHEET_DB);
    if (!dbSheet) return { success: false, error: "Sheet Database tidak ditemukan" };

    // Cari data hewan di Database
    const dbData = dbSheet.getDataRange().getValues();
    let hewanRow  = null;
    for (let i = 1; i < dbData.length; i++) {
      const row = dbData[i];
      if (row && row[0] && String(row[0]) === nomor_hewan) {
        hewanRow = row;
        break;
      }
    }
    if (!hewanRow) return { success: false, error: "Hewan tidak ditemukan" };

    // Validasi: nama pekurban harus ada di daftar hewan ini
    const namaList = splitNamaPekurban(hewanRow[2]);
    const namaValid = namaList.some(n => n.toLowerCase() === nama.trim().toLowerCase());
    if (!namaValid) return { success: false, error: "Nama pekurban tidak terdaftar pada hewan ini" };

    // Ambil status foto dari Laporan
    const status = getHewanStatus(ss, nomor_hewan);

    return {
      success: true,
      data: {
        nama_pekurban: nama.trim(),
        nomor_hewan:   String(hewanRow[0]),
        jenis_hewan:   hewanRow[1] ? String(hewanRow[1]) : 'Sapi',
        instansi:      hewanRow[4] ? String(hewanRow[4]) : '',
        wilayah:       hewanRow[5] ? String(hewanRow[5]) : '',
        status:        status
      }
    };
  } catch (err) { Logger.log(err.toString()); return { success: false, error: "Internal server error" }; }
}

// ============================================================
// ============================================================
//  AKSES FILE — hanya via fileId, TIDAK pernah via fileUrl
//  Menggantikan getPhotoAsBase64 dan getDokFotoById
// ============================================================
function getFileById(fileId, user) {
  try {
    if (!fileId || typeof fileId !== 'string' || fileId.length > 100) {
      return { success: false, error: 'fileId tidak valid' };
    }
    // Validasi format fileId Drive (hanya alfanumerik, dash, underscore)
    if (!/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) {
      return { success: false, error: 'fileId tidak valid' };
    }

    const file     = DriveApp.getFileById(fileId);
    const mimeType = file.getMimeType();
    const fileName = file.getName();

    // Video: kembalikan preview URL (tidak expose folder)
    if (mimeType.startsWith('video/')) {
      return {
        success:  true,
        type:     'video',
        mimeType: mimeType,
        fileName: fileName,
        embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      };
    }

    // Gambar: kembalikan base64
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
  try {
    const { nomor_hewan, jenis_foto, base64Data, mimeType } = data;
    const username = data.username || user.email;

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
    if (!hewanData) return { success: false, error: "Nomor hewan tidak ditemukan" };

    // Upload ke Drive
    const rootFolder   = DriveApp.getFolderById(ROOT_FOLDER_ID);
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

    // Update sheet Laporan
    const laporanSheet = ss.getSheetByName(NAMA_SHEET_LAPORAN);
    if (!laporanSheet) return { success: false, error: "Sheet Laporan tidak ditemukan" };

    const laporanData = laporanSheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < laporanData.length; i++) {
      if (laporanData[i][0] && String(laporanData[i][0]) === nomor_hewan) { rowIndex = i + 1; break; }
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
  } catch (err) { Logger.log(err.toString()); return { success: false, error: "Internal server error" }; }
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

  // Users
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

  // Hewan + status
  const dbSheet = ss.getSheetByName(NAMA_SHEET_DB);
  const hewan   = [];
  let totalSelesai = 0;
  if (dbSheet) {
    const data = dbSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[0]) continue;
      const nomor    = String(row[0]);
      const status   = getHewanStatus(ss, nomor);
      const progress = (status.url_hidup ? 1 : 0) + (status.url_ditumbangkan ? 1 : 0) + (status.url_mati ? 1 : 0);
      if (progress === 3) totalSelesai++;
      hewan.push({
        nomor_hewan:     nomor,
        jenis_hewan:     row[1] ? String(row[1]) : 'Sapi',
        daftar_pekurban: row[2] ? String(row[2]) : '',
        jumlah_pekurban: row[3] ? Number(row[3]) : 1,
        instansi:        row[4] ? String(row[4]) : '',
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

// Helper: ambil status foto satu hewan dari sheet Laporan
function getHewanStatus(ss, nomorHewan) {
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
    if (row[0] && String(row[0]) === nomorHewan) {
      return {
        url_hidup:            safeVal(row[6]),  tgl_hidup:            safeVal(row[7]),  uploader_hidup:            safeVal(row[12]),
        url_ditumbangkan:     safeVal(row[8]),  tgl_ditumbangkan:     safeVal(row[9]),  uploader_ditumbangkan:     safeVal(row[13]),
        url_mati:             safeVal(row[10]), tgl_mati:             safeVal(row[11]), uploader_mati:             safeVal(row[14])
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

    dbSheet.appendRow([hewan.nomor_hewan, hewan.jenis_hewan, hewan.daftar_pekurban,
      hewan.jumlah_pekurban, hewan.instansi, hewan.wilayah]);

    if (laporanSheet) {
      laporanSheet.appendRow([hewan.nomor_hewan, hewan.jenis_hewan, hewan.daftar_pekurban,
        hewan.jumlah_pekurban, hewan.instansi, hewan.wilayah,
        '', '', '', '', '', '', '', '']);
    }
    return { success: true };
  } catch (err) { Logger.log(err.toString()); return { success: false, error: "Internal server error" }; }
}

function updateHewan(adminEmail, hewan) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_DB);
    const data  = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && String(data[i][0]) === hewan.nomor_hewan) {
        sheet.getRange(i+1, 2).setValue(hewan.jenis_hewan);
        sheet.getRange(i+1, 3).setValue(hewan.daftar_pekurban);
        sheet.getRange(i+1, 4).setValue(hewan.jumlah_pekurban);
        sheet.getRange(i+1, 5).setValue(hewan.instansi);
        sheet.getRange(i+1, 6).setValue(hewan.wilayah);
        return { success: true };
      }
    }
    return { success: false, error: "Hewan tidak ditemukan" };
  } catch (err) { Logger.log(err.toString()); return { success: false, error: "Internal server error" }; }
}

function deleteHewan(adminEmail, nomor_hewan) {
  try {
    const ss           = SpreadsheetApp.getActiveSpreadsheet();
    const dbSheet      = ss.getSheetByName(NAMA_SHEET_DB);
    const laporanSheet = ss.getSheetByName(NAMA_SHEET_LAPORAN);

    // Cari data hewan untuk path folder Drive
    let hewanData = null;
    const dbData  = dbSheet.getDataRange().getValues();
    for (let i = 1; i < dbData.length; i++) {
      if (dbData[i][0] && String(dbData[i][0]) === nomor_hewan) {
        hewanData = { jenis_hewan: String(dbData[i][1] || 'Sapi'), instansi: String(dbData[i][4] || ''), wilayah: String(dbData[i][5] || '') };
        break;
      }
    }

    // Hapus folder Drive
    if (hewanData) {
      try {
        const rootFolder   = DriveApp.getFolderById(ROOT_FOLDER_ID);
        const jenisFolder  = getOrCreateFolder(
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

    // Hapus dari Database
    for (let i = dbData.length - 1; i >= 1; i--) {
      if (dbData[i][0] && String(dbData[i][0]) === nomor_hewan) { dbSheet.deleteRow(i + 1); break; }
    }

    // Hapus dari Laporan
    if (laporanSheet) {
      const lapData = laporanSheet.getDataRange().getValues();
      for (let i = lapData.length - 1; i >= 1; i--) {
        if (lapData[i][0] && String(lapData[i][0]) === nomor_hewan) { laporanSheet.deleteRow(i + 1); break; }
      }
    }
    return { success: true };
  } catch (err) { Logger.log(err.toString()); return { success: false, error: "Internal server error" }; }
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
    // Hash dengan salt — simpan di kolom B (hash) dan kolom E (salt)
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
          sheet.getRange(i+1, 5).setValue(salt); // kolom E: salt
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

/** Sinkronisasi baris Database → Laporan (untuk data lama) */
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

/** Sinkronisasi instansi unik dari Database → DokumentasiInstansi */
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

/**
 * TEST: Jalankan dari editor untuk cek searchPekurban
 */
function testSearchPekurban() {
  const result = searchPekurban("wahyu");
  Logger.log(JSON.stringify(result, null, 2));
}

// ============================================================
//  HASH PASSWORD LANGSUNG KE SHEET AKUN (dengan salt)
//  Cara pakai:
//    1. Buka sheet Akun, isi kolom A (email), kolom B (password PLAINTEXT)
//    2. Klik Run → hashPasswordsKeSheet
//    3. Kolom B = hash, kolom E = salt. Password plaintext hilang.
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

    // Sudah di-hash (ada salt di kolom E) → lewati
    if (saltCol && /^[a-f0-9]{64}$/.test(password)) {
      Logger.log(`⏭️  [baris ${i+1}] ${email} — sudah di-hash dengan salt, dilewati`);
      dilewati++;
      continue;
    }

    const { hash, salt } = hashPass(password, null);
    sheet.getRange(i + 1, 2).setValue(hash);
    sheet.getRange(i + 1, 5).setValue(salt); // kolom E: salt
    Logger.log(`✅ [baris ${i+1}] ${email} — password berhasil di-hash dengan salt`);
    diproses++;
  }

  Logger.log(`\nSelesai. ${diproses} password di-hash, ${dilewati} dilewati.`);
}

// ============================================================
//  PORTAL PEKURBAN — DOKUMENTASI WILAYAH
//  Mengembalikan daftar file foto dari folder Pencacahan & Penyaluran
//  berdasarkan wilayah pekurban, tanpa expose URL Drive langsung.
//  File ID di-encode agar tidak mudah ditebak.
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

      // Ambil file dari folder Drive
      try {
        const fileId = extractFileIdFromUrl(folderUrl);
        if (!fileId) continue;

        const folder = DriveApp.getFolderById(fileId);
        const files  = [];

        // Cari subfolder Foto
        const fotoFolders = folder.getFoldersByName('Foto');
        const fotoFolder  = fotoFolders.hasNext() ? fotoFolders.next() : folder;
        const fileIter    = fotoFolder.getFiles();

        let count = 0;
        while (fileIter.hasNext() && count < 10) { // max 10 foto per jenis
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

        // Juga ambil video (max 5)
        const videoFolders = folder.getFoldersByName('Video');
        const videoFolder  = videoFolders.hasNext() ? videoFolders.next() : null;
        if (videoFolder) {
          const videoIter = videoFolder.getFiles();
          let vCount = 0;
          while (videoIter.hasNext() && vCount < 5) {
            const f = videoIter.next();
            if (f.getMimeType().startsWith('video/')) {
              // Buat file publik sementara untuk streaming (view only, tidak bisa download folder)
              // Hanya expose fileId — tidak ada folder URL
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

// getDokFotoById digabung ke getFileById — lihat fungsi di atas
