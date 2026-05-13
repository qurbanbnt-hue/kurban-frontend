# Kurban Digital — Yayasan Bhakti Nusa Tenggara

Platform terpadu untuk mengelola dokumentasi penyembelihan hewan qurban dan sistem distribusi kupon kurban untuk masjid penerima manfaat. Idul Adha 1447 H / 2026 M.

---

## Arsitektur

```
Browser (HTML/CSS/JS)
        │
        │  JWT (Authorization: Bearer)
        ▼
api/proxy.js  ──  Vercel Serverless
        │
        │  GAS_SECRET + user object
        ▼
Google Apps Script  ──  Google Sheets (database)
                    └─  Google Drive (foto & file KK)
```

- **Frontend** — HTML/CSS/JS statis, di-deploy di Vercel CDN
- **Proxy** — `api/proxy.js` sebagai security layer: JWT auth, RBAC, validasi input, rate limiting
- **Backend** — Google Apps Script: logika bisnis, baca/tulis Sheets, upload ke Drive
- **Database** — Google Sheets (9 sheet)
- **Storage** — Google Drive (foto hewan, KK, foto bukti pengambilan)

---

## Struktur Project

```
├── index.html                  # Landing page — pilih portal
├── admin/index.html            # Portal Administrator
├── user/index.html             # Portal Panitia + Scan Kupon
├── pekurban/index.html         # Portal Pekurban (publik)
├── masjid/index.html           # Portal Masjid — daftar & kupon
├── api/
│   └── proxy.js                # Vercel serverless — security layer
├── assets/
│   ├── css/style.css
│   ├── js/
│   │   ├── api.js              # callApi(), esc(), debounce(), cache
│   │   └── auth.js             # initAuth(), startSessionWatcher()
│   ├── fonts/                  # Lucide icon font
│   └── images/
│       ├── logo/
│       ├── bg_desktop/
│       ├── bg_mobile/
│       └── Icon/
├── backend/
│   └── Code.gs                 # Google Apps Script (backend)
├── vercel.json
├── package.json
└── .env.local                  # Secrets lokal (tidak di-commit)
```

---

## Portal & Akses

| Portal | URL | Akses |
|---|---|---|
| Landing | `/` | Publik |
| Masjid | `/masjid` | OTP WhatsApp — session token |
| Panitia | `/user` | JWT — role: user |
| Administrator | `/admin` | JWT — role: admin |
| Pekurban | `/pekurban` | Publik — cari nama sendiri |

---

## Fitur Utama

### Sistem Kupon Masjid (Fitur Baru)

Alur lengkap distribusi sapi kurban ke masjid penerima manfaat:

1. **Pendaftaran masjid** via WhatsApp OTP — tanpa username/password
2. **Upload KK** dengan OCR otomatis — deteksi nomor KK 16 digit, cegah duplikasi lintas masjid
3. **Konfirmasi anggota** manual jika OCR tidak sempurna
4. **Review admin** — verifikasi KK, tetapkan jatah sapi
5. **Kupon digital** dengan QR code unik per masjid
6. **Scan & konfirmasi** di lokasi pemotongan — wajib foto bukti

### Dokumentasi Hewan Qurban

- Upload foto 3 fase: hidup → ditumbangkan → disembelih
- Tracking per hewan, instansi, dan wilayah
- Portal pekurban untuk cek status hewan sendiri

---

## Keamanan

### Lapisan perlindungan

| Lapisan | Implementasi |
|---|---|
| Autentikasi panitia/admin | JWT HS256, expire 8 jam |
| Autentikasi masjid | OTP WhatsApp + session token UUID (bukan JWT) |
| Session token masjid | UUID acak di-generate saat OTP berhasil, disimpan di Sheets |
| OTP storage | SHA-256 hash sebelum disimpan ke sheet — tidak plain text |
| OTP rate limit | Max 3 kirim per 15 menit per masjid |
| OTP comparison | Timing-safe comparison (cegah timing attack) |
| Zero trust | Proxy tidak percaya `email`/`role` dari frontend — hanya dari JWT |
| RBAC | Admin-only actions diblokir di proxy sebelum sampai ke GAS |
| GAS secret | Setiap request ke GAS wajib menyertakan `SCRIPT_SECRET` |
| Action whitelist | Proxy menolak semua action di luar daftar izin |
| Input validation | Proxy validasi tipe, panjang, format sebelum teruskan ke GAS |
| File validation | MIME whitelist (jpg/png/webp), size limit 5MB per file |
| XSS protection | Semua data server di-escape via `esc()` sebelum masuk innerHTML |
| Rate limiting | 60 req/menit per IP + 40 req/menit per user (in-memory) |
| GAS rate limiting | CacheService — 60 req/menit per user di sisi GAS |
| Race condition KK | LockService — cegah duplikasi nomor KK saat upload bersamaan |
| Race condition kupon | LockService + double-check status di dalam lock |
| CORS | Hanya domain di `ALLOWED_ORIGINS` yang diizinkan |
| Security headers | CSP, X-Frame-Options, Permissions-Policy, dll via `vercel.json` |
| Kamera | `Permissions-Policy: camera=(self)` hanya di `/user` (scan QR) |
| CDN cache | Static assets cache 1 tahun, API no-store |
| Error masking | Error internal hanya di log server, client hanya dapat pesan generik |
| Password | SHA-256 + salt + 500 iterasi |

### Keterbatasan

- Rate limiting in-memory — tidak persistent lintas Vercel instance.
- JWT disimpan di `localStorage` — cukup untuk use case internal.
- Session masjid disimpan di `localStorage` dengan expiry 7 hari.

---

## Setup & Deployment

### 1. Google Sheets

Buat spreadsheet baru. Sheet untuk fitur hewan qurban dibuat manual, sheet untuk kupon masjid dibuat otomatis via `setupKuponSheets()`.

**Sheet manual (hewan qurban):**

**`Database`** — `nomor_hewan | jenis_hewan | daftar_pekurban | jumlah_pekurban | instansi | wilayah`

**`Laporan`** — `nomor_hewan | jenis_hewan | daftar_pekurban | jumlah_pekurban | instansi | wilayah | url_hidup | tgl_hidup | url_ditumbangkan | tgl_ditumbangkan | url_mati | tgl_mati | uploader_hidup | uploader_ditumbangkan | uploader_mati`

**`Akun`** — `email | password_hash | username | role (admin/user) | salt`

**`DokumentasiInstansi`** — `instansi | wilayah | jenis | folderUrl | tglUpload | uploader | catatan`

**Sheet otomatis (kupon masjid)** — dibuat oleh `setupKuponSheets()`:
- `PendaftaranMasjid` — data masjid, status, token sesi
- `DataKK` — record KK per masjid, hasil OCR
- `KuponMasjid` — kupon QR code per masjid
- `SesiOTP` — OTP hash + rate limit tracking
- `KonfigSistem` — periode pendaftaran, nomor diblokir

### 2. Google Apps Script

1. Buka spreadsheet → **Extensions → Apps Script**
2. Hapus kode default, paste isi `backend/Code.gs`
3. Isi `ROOT_FOLDER_ID` di baris pertama dengan ID folder Google Drive tujuan penyimpanan
4. Aktifkan **Drive API**: Services → Drive API v2
5. Tambahkan Script Properties (**Project Settings → Script Properties**):
   - `SCRIPT_SECRET` — string acak 32+ karakter (sama dengan `GAS_SECRET` di Vercel)
   - `FONNTE_API_TOKEN` — token API dari [fonnte.com](https://fonnte.com) untuk kirim OTP WhatsApp
6. Jalankan `setupKuponSheets()` satu kali untuk membuat sheet kupon masjid
7. **Deploy → New deployment → Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
8. Salin URL deployment

### 3. Vercel

Set environment variables di **Vercel Dashboard → Settings → Environment Variables**:

| Key | Value |
|---|---|
| `APPS_SCRIPT_URL` | URL deployment Apps Script dari langkah 2.7 |
| `GAS_SECRET` | String acak 32+ karakter |
| `JWT_SECRET` | String acak 32+ karakter (berbeda dari GAS_SECRET) |
| `ALLOWED_ORIGINS` | `https://namadomain.vercel.app` |

Generate secret key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Buat Akun Admin Pertama

Jalankan fungsi ini satu kali dari editor Apps Script:

```javascript
function buatAdminPertama() {
  const { hash, salt } = hashPass('password_kamu', null);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Akun');
  sheet.appendRow(['admin@email.kamu', hash, 'Admin BNT', 'admin', salt]);
  Logger.log('Admin berhasil dibuat');
}
```

### 5. Lokal (Development)

```bash
npm install
```

Buat `.env.local`:
```
APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
GAS_SECRET=...
JWT_SECRET=...
ALLOWED_ORIGINS=http://localhost:3000
```

```bash
npm run dev
```

---

## API Reference

Semua request: `POST /api/proxy?action=<action>` dengan body JSON.
Protected actions wajib menyertakan header: `Authorization: Bearer <token>`

### Publik (tanpa auth)

| Action | Body | Keterangan |
|---|---|---|
| `login` | `{ email, password }` | Login panitia/admin, kembalikan JWT |
| `getPublicStats` | `{}` | Statistik publik hewan qurban |
| `searchPekurban` | `{ query }` | Cari nama pekurban |
| `getPekurbanDetail` | `{ nama, nomor_hewan, instansi }` | Detail hewan + status foto |
| `getDokumentasiWilayah` | `{ wilayah }` | Dokumentasi per wilayah |
| `checkNomorWA` | `{ telepon_pic }` | Cek nomor WA masjid, kirim OTP jika terdaftar |
| `registerMasjid` | `{ nama_masjid, alamat, kecamatan, kabupaten, nama_pic, telepon_pic }` | Daftar masjid baru |
| `verifyOTP` | `{ masjid_id, otp_code }` | Verifikasi OTP, kembalikan session token |
| `requestOTP` | `{ telepon_pic }` | Kirim ulang OTP |
| `getKonfigSistem` | `{}` | Status periode pendaftaran |

### Masjid (session token di body)

| Action | Body | Keterangan |
|---|---|---|
| `uploadKK` | `{ masjid_id, session_token, file_base64, mime_type, file_name }` | Upload foto KK, OCR otomatis |
| `konfirmasiAnggota` | `{ masjid_id, session_token, kk_id, anggota_data[] }` | Konfirmasi data anggota manual |
| `konfirmasiSelesaiUpload` | `{ masjid_id, session_token }` | Kunci data KK untuk review admin |
| `getKuponMasjid` | `{ masjid_id, session_token }` | Ambil kupon digital + QR code |
| `getDashboardMasjid` | `{ masjid_id, session_token }` | Data lengkap dashboard masjid |

### Panitia (JWT role: user)

| Action | Body | Keterangan |
|---|---|---|
| `getHewan` | `{}` | Semua hewan + status foto |
| `uploadFoto` | `{ nomor_hewan, jenis_hewan, instansi, jenis_foto, base64Data, mimeType }` | Upload foto hewan |
| `getDokumentasi` | `{}` | Riwayat dokumentasi instansi |
| `uploadDokumentasi` | `{ instansi, wilayah, jenis_dokumentasi, files[] }` | Upload dokumentasi |
| `validateKupon` | `{ kode_kupon }` | Validasi kupon (tidak ubah status) |
| `konfirmasiPengambilan` | `{ kupon_id, foto_bukti_base64, mime_type }` | Konfirmasi pengambilan + foto bukti |

### Admin (JWT role: admin)

| Action | Body | Keterangan |
|---|---|---|
| `getAdminData` | `{}` | Semua hewan + user + statistik |
| `addHewan` / `updateHewan` / `deleteHewan` | `{ hewan }` | CRUD hewan |
| `addUser` / `updateUser` / `deleteUser` | `{ user }` | CRUD akun |
| `getRegistrations` | `{}` | Semua pendaftaran masjid |
| `getKKDetail` | `{ masjid_id }` | Detail KK per masjid |
| `getKKPerluVerifikasi` | `{ masjid_id? }` | KK yang perlu review admin |
| `resolveKKVerifikasi` | `{ kk_id, action, koreksi_data? }` | Terima/tolak/koreksi KK |
| `setJatah` | `{ masjid_id, jumlah_sapi }` | Tetapkan jatah + terbitkan kupon |
| `togglePeriodePendaftaran` | `{ buka }` | Buka/tutup periode pendaftaran |
| `revokeTokenMasjid` | `{ masjid_id }` | Paksa logout masjid |
| `updateNomorWAMasjid` | `{ masjid_id, nomor_wa_baru }` | Update nomor WA PIC |
| `hapusMasjid` | `{ masjid_id }` | Hapus masjid + semua KK |
| `blokirMasjid` | `{ masjid_id, alasan }` | Blokir masjid |
| `bukaBlokirMasjid` | `{ masjid_id }` | Buka blokir masjid |
| `blokirNomorWA` | `{ nomor_wa }` | Blokir nomor WA |
| `bukaBlokirNomorWA` | `{ nomor_wa }` | Buka blokir nomor WA |
| `getNomorDiblokir` | `{}` | Daftar nomor WA yang diblokir |
| `rejectRegistration` | `{ masjid_id, alasan }` | Tolak pendaftaran masjid |

---

## Utilitas Backend

Jalankan dari editor Apps Script (satu kali):

| Fungsi | Kegunaan |
|---|---|
| `setupKuponSheets()` | Buat semua sheet kupon masjid + folder Drive |
| `hashPasswordsKeSheet()` | Hash semua password plaintext di sheet Akun |
| `syncLaporanFromDatabase()` | Sinkronisasi baris Database → Laporan |
| `syncDokumentasiInstansi()` | Sinkronisasi instansi unik → DokumentasiInstansi |
| `buatAdminPertama()` | Buat akun admin pertama (tulis manual di editor) |

---

## Struktur Folder Google Drive

```
ROOT_FOLDER/
├── {instansi}/
│   └── {wilayah}/
│       └── {jenis_hewan}/
│           └── {nomor_hewan}/
│               ├── 001_hidup_xxx.jpg
│               ├── 001_ditumbangkan_xxx.jpg
│               └── 001_mati_xxx.jpg
├── KK/
│   └── {masjid_id}/
│       └── kk_{masjid_id}_{timestamp}.jpg
└── BuktiFoto/
    └── {masjid_id}/
        └── bukti_{kupon_id}_{timestamp}.jpg
```

---

## Checklist Sebelum Go-Live

- [ ] `ROOT_FOLDER_ID` diisi di Code.gs
- [ ] `SCRIPT_SECRET` dan `FONNTE_API_TOKEN` diset di Script Properties GAS
- [ ] Drive API v2 diaktifkan di GAS
- [ ] `setupKuponSheets()` sudah dijalankan
- [ ] Akun admin pertama sudah dibuat
- [ ] Semua env vars diset di Vercel dashboard
- [ ] Apps Script di-deploy ulang setelah update Code.gs
- [ ] Test alur lengkap: daftar masjid → OTP → upload KK → kupon → scan
- [ ] 2FA aktif di akun Google pemilik spreadsheet
- [ ] Spreadsheet tidak di-share ke publik
- [ ] `.env.local` tidak ter-commit (`git status`)
