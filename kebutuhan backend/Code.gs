// ============================================================
//  KONFIGURASI
// ============================================================
const NAMA_SHEET_DB          = "Database";
const NAMA_SHEET_LAPORAN     = "Laporan";
const NAMA_SHEET_AKUN        = "Akun";
const NAMA_SHEET_DOKUMENTASI = "DokumentasiInstansi";
const ROOT_FOLDER_ID         = "1RPDv3Jj9srfMvV0Wvv5wkD182klzSWNA";

// ============================================================
//  ENTRY POINT (Web App API)
// ============================================================
function doGet(e)  { return handleApiRequest(e); }
function doPost(e) { return handleApiRequest(e); }

function handleApiRequest(e) {
  try {
    const action = e.parameter.action;
    let postData = {};
    if (e.postData && e.postData.contents) {
      try { postData = JSON.parse(e.postData.contents); } catch (err) {}
    }

    let result;
    switch (action) {
      case 'login':             result = doLogin(postData.email, postData.password); break;
      case 'getPublicStats':    result = getPublicStats(); break;
      case 'getHewan':          result = getDataForUi(postData.email); break;
      case 'uploadFoto':        result = uploadFotoJenis(postData); break;
      case 'getDokumentasi':    result = getDokumentasiInstansi(postData.email); break;
      case 'uploadDokumentasi': result = uploadDokumentasiInstansi(postData); break;
      case 'getAdminData':      result = getAdminData(postData.email); break;
      case 'addHewan':          result = addHewan(postData.email, postData.hewan); break;
      case 'updateHewan':       result = updateHewan(postData.email, postData.hewan); break;
      case 'deleteHewan':       result = deleteHewan(postData.email, postData.nomor_hewan); break;
      case 'addUser':           result = addUser(postData.email, postData.newUser); break;
      case 'updateUser':        result = updateUser(postData.email, postData.user); break;
      case 'deleteUser':        result = deleteUser(postData.email, postData.targetEmail); break;
      // ── Portal Pekurban ──
      case 'searchPekurban':    result = searchPekurban(postData.query); break;
      case 'getPekurbanDetail': result = getPekurbanDetail(postData.nama, postData.nomor_hewan); break;
      case 'getPhotoAsBase64':  result = getPhotoAsBase64(postData.fileUrl); break;
      default:                  result = { success: false, error: "Action tidak dikenal" };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
//  HELPER FUNCTIONS
// ============================================================
function hashPass(plainText) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    plainText.toString(),
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function isValidUser(email) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_AKUN);
    if (!sheet) return false;
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i] && data[i][0] && String(data[i][0]).trim().toLowerCase() === email.toLowerCase()) return true;
    }
    return false;
  } catch (e) { return false; }
}

function isAdmin(email) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_AKUN);
    if (!sheet) return false;
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[0]) continue;
      if (String(row[0]).trim().toLowerCase() === email.toLowerCase()) {
        return (row[3] ? String(row[3]).trim().toLowerCase() : 'user') === 'admin';
      }
    }
    return false;
  } catch (e) { return false; }
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
//  LOGIN
// ============================================================
function doLogin(email, password) {
  try {
    if (!email || !password) return { success: false, error: "Email dan password harus diisi" };
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_AKUN);
    if (!sheet) return { success: false, error: "Sheet Akun tidak ditemukan" };
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return { success: false, error: "Sheet Akun kosong" };

    const hashedInput = hashPass(password);
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      const validEmail  = row[0] ? String(row[0]).trim() : '';
      const storedPass  = row[1] ? String(row[1]).trim() : '';
      const username    = row[2] ? String(row[2]).trim() : (validEmail ? validEmail.split('@')[0] : '');
      const role        = row[3] ? String(row[3]).trim().toLowerCase() : 'user';
      if (!validEmail || !storedPass) continue;
      if (validEmail.toLowerCase() !== email.toLowerCase()) continue;
      const passMatch = storedPass.length === 64 ? storedPass === hashedInput : storedPass === password;
      if (passMatch) return { success: true, email: validEmail, username, role };
    }
    return { success: false, error: "Email atau password salah" };
  } catch (err) { return { success: false, error: err.toString() }; }
}

// ============================================================
//  DATA HEWAN (untuk User Portal)
// ============================================================
function getDataForUi(email) {
  try {
    if (!email || !isValidUser(email)) return { success: false, error: "Akses ditolak" };
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
  } catch (err) { return { success: false, error: err.toString() }; }
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
  } catch (err) { return { success: false, error: err.toString() }; }
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
  } catch (err) { return { success: false, error: err.toString() }; }
}

// ============================================================
//  PORTAL PEKURBAN — AMBIL FOTO SEBAGAI BASE64
//  Mengambil file dari Google Drive dan mengembalikannya
//  sebagai base64 agar foto tampil langsung di web app
//  tanpa redirect ke Drive.
// ============================================================
function getPhotoAsBase64(fileUrl) {
  try {
    if (!fileUrl) return { success: false, error: "URL tidak diberikan" };

    // Ekstrak file ID dari URL Drive
    let fileId = null;
    const patterns = [
      /\/file\/d\/([a-zA-Z0-9_-]+)/,
      /id=([a-zA-Z0-9_-]+)/,
      /\/d\/([a-zA-Z0-9_-]+)/
    ];
    for (const p of patterns) {
      const m = fileUrl.match(p);
      if (m) { fileId = m[1]; break; }
    }
    if (!fileId) {
      // Coba ambil ID dari string panjang
      const m = fileUrl.match(/[-\w]{25,}/);
      if (m) fileId = m[0];
    }
    if (!fileId) return { success: false, error: "File ID tidak ditemukan dari URL" };

    const file     = DriveApp.getFileById(fileId);
    const blob     = file.getBlob();
    const base64   = Utilities.base64Encode(blob.getBytes());
    const mimeType = blob.getContentType();
    const fileName = file.getName();

    return { success: true, base64, mimeType, fileName };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// ============================================================
//  UPLOAD FOTO HEWAN (Panitia)
// ============================================================
function uploadFotoJenis(params) {
  try {
    const { email, username, nomor_hewan, jenis_foto, base64Data, mimeType } = params;
    if (!email || !isValidUser(email)) return { success: false, error: "Akses ditolak" };
    if (!['hidup','ditumbangkan','mati'].includes(jenis_foto)) return { success: false, error: "Jenis foto tidak valid" };

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
  } catch (err) { return { success: false, error: err.toString() }; }
}

// ============================================================
//  UPLOAD DOKUMENTASI INSTANSI (Panitia)
// ============================================================
function uploadDokumentasiInstansi(params) {
  try {
    const { email, username, instansi, wilayah, jenis_dokumentasi, files } = params;
    if (!email || !isValidUser(email)) return { success: false, error: "Akses ditolak" };
    if (!files || files.length === 0) return { success: false, error: "Tidak ada file" };

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
  } catch (err) { return { success: false, error: err.toString() }; }
}

// ============================================================
//  DOKUMENTASI INSTANSI (READ)
// ============================================================
function getDokumentasiInstansi(email) {
  try {
    if (!email || !isValidUser(email)) return { success: false, error: "Akses ditolak" };
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
  } catch (err) { return { success: false, error: err.toString() }; }
}

// ============================================================
//  ADMIN — GET ALL DATA
// ============================================================
function getAdminData(adminEmail) {
  if (!isAdmin(adminEmail)) return { success: false, error: "Akses ditolak" };
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
  if (!isAdmin(adminEmail)) return { success: false, error: "Akses ditolak" };
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
  } catch (err) { return { success: false, error: err.toString() }; }
}

function updateHewan(adminEmail, hewan) {
  if (!isAdmin(adminEmail)) return { success: false, error: "Akses ditolak" };
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
  } catch (err) { return { success: false, error: err.toString() }; }
}

function deleteHewan(adminEmail, nomor_hewan) {
  if (!isAdmin(adminEmail)) return { success: false, error: "Akses ditolak" };
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
  } catch (err) { return { success: false, error: err.toString() }; }
}

// ============================================================
//  ADMIN — CRUD USER
// ============================================================
function addUser(adminEmail, newUser) {
  if (!isAdmin(adminEmail)) return { success: false, error: "Akses ditolak" };
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_AKUN);
    const data  = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && String(data[i][0]).toLowerCase() === newUser.email.toLowerCase()) {
        return { success: false, error: "Email sudah terdaftar" };
      }
    }
    sheet.appendRow([newUser.email, newUser.password ? hashPass(newUser.password) : '', newUser.username, newUser.role || 'user']);
    return { success: true };
  } catch (err) { return { success: false, error: err.toString() }; }
}

function updateUser(adminEmail, user) {
  if (!isAdmin(adminEmail)) return { success: false, error: "Akses ditolak" };
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_AKUN);
    const data  = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && String(data[i][0]).toLowerCase() === user.email.toLowerCase()) {
        if (user.username) sheet.getRange(i+1, 3).setValue(user.username);
        if (user.role)     sheet.getRange(i+1, 4).setValue(user.role);
        if (user.password) sheet.getRange(i+1, 2).setValue(hashPass(user.password));
        return { success: true };
      }
    }
    return { success: false, error: "User tidak ditemukan" };
  } catch (err) { return { success: false, error: err.toString() }; }
}

function deleteUser(adminEmail, targetEmail) {
  if (!isAdmin(adminEmail)) return { success: false, error: "Akses ditolak" };
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
  } catch (err) { return { success: false, error: err.toString() }; }
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
//  HASH PASSWORD LANGSUNG KE SHEET AKUN
//  Cara pakai:
//    1. Buka sheet Akun, isi kolom A (email), kolom B (password PLAINTEXT)
//    2. Klik Run → hashPasswordsKeSheet
//    3. Kolom B otomatis terganti dengan hash SHA-256
//    4. Selesai — password plaintext tidak tersimpan lagi
// ============================================================
function hashPasswordsKeSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NAMA_SHEET_AKUN);
  if (!sheet) { Logger.log('❌ Sheet Akun tidak ditemukan'); return; }

  const data = sheet.getDataRange().getValues();
  let diproses = 0;
  let dilewati = 0;

  for (let i = 1; i < data.length; i++) {
    const row      = data[i];
    const email    = row[0] ? String(row[0]).trim() : '';
    const password = row[1] ? String(row[1]).trim() : '';

    if (!email || !password) continue;

    // Kalau sudah 64 karakter hex → sudah di-hash, lewati
    if (/^[a-f0-9]{64}$/.test(password)) {
      Logger.log(`⏭️  [baris ${i+1}] ${email} — sudah di-hash, dilewati`);
      dilewati++;
      continue;
    }

    const hash = hashPass(password);
    sheet.getRange(i + 1, 2).setValue(hash);
    Logger.log(`✅ [baris ${i+1}] ${email} — password berhasil di-hash`);
    diproses++;
  }

  Logger.log(`\nSelesai. ${diproses} password di-hash, ${dilewati} dilewati (sudah hash).`);
}
