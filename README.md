# Kurban Digital — Yayasan Bhakti Nusa Tenggara

Platform terpadu untuk mengelola dan memantau dokumentasi penyembelihan hewan qurban secara real-time. Idul Adha 1447 H / 2026 M.

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
                    └─  Google Drive (penyimpanan foto)
```

- **Frontend** — HTML/CSS/JS statis, di-deploy di Vercel CDN
- **Proxy** — `api/proxy.js` sebagai security layer: JWT auth, RBAC, validasi input, rate limiting
- **Backend** — Google Apps Script: logika bisnis, baca/tulis Sheets, upload ke Drive
- **Database** — Google Sheets (4 sheet)
- **Storage** — Google Drive (foto hewan, dokumentasi instansi)

---

## Struktur Project

```
├── index.html                  # Landing page — pilih portal
├── admin/index.html            # Portal Administrator
├── user/index.html             # Portal Panitia
├── pekurban/index.html         # Portal Pekurban (publik)
├── api/
│   └── proxy.js                # Vercel serverless — security layer
├── assets/
│   ├── css/style.css
│   ├── js/
│   │   └── api.js              # callApi(), esc(), debounce(), cache
│   ├── fonts/                  # Lucide icon font
│   └── images/
│       ├── logo/
│       ├── bg_desktop/
│       ├── bg_mobile/
│       └── Icon/               # icon_sapi, icon_kambing, dll
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
| Panitia | `/user` | JWT — role: user |
| Administrator | `/admin` | JWT — role: admin |
| Pekurban | `/pekurban` | Publik — cari nama sendiri |

---

## Keamanan

### Lapisan perlindungan

| Lapisan | Implementasi |
|---|---|
| Autentikasi | JWT HS256, expire 8 jam, dibuat di proxy |
| Zero trust | Proxy tidak percaya `email`/`role` dari frontend — hanya dari JWT |
| RBAC | Admin-only actions diblokir di proxy sebelum sampai ke GAS |
| GAS secret | Setiap request ke GAS wajib menyertakan `SCRIPT_SECRET` |
| Action whitelist | Proxy menolak semua action di luar daftar izin |
| Input validation | Proxy validasi tipe, panjang, format sebelum teruskan ke GAS |
| File validation | MIME whitelist (jpg/png/webp/mp4), size limit (foto 5MB, video 20MB) |
| XSS protection | Semua data server di-escape via `esc()` sebelum masuk innerHTML |
| Rate limiting | 60 req/menit per IP + 40 req/menit per user (in-memory) |
| GAS rate limiting | CacheService — 60 req/menit per user di sisi GAS |
| Concurrent upload | Lock per hewan via CacheService — cegah race condition |
| CORS | Hanya domain di `ALLOWED_ORIGINS` yang diizinkan |
| Security headers | CSP, X-Frame-Options, X-Content-Type-Options, dll via `vercel.json` |
| CDN cache | Static assets cache 1 tahun, API no-store |
| Error masking | Error internal hanya di log server, client hanya dapat pesan generik |
| Password | SHA-256 + salt + 500 iterasi, backward-compatible dengan hash lama |

### Keterbatasan

- Rate limiting in-memory — tidak persistent lintas Vercel instance. Untuk skala besar gunakan [Upstash Redis](https://upstash.com).
- JWT disimpan di `localStorage` — cukup untuk use case internal.
- GAS URL bisa muncul di Vercel logs. Rotasi deployment secara berkala jika diperlukan.

---

## Setup & Deployment

### 1. Google Sheets

Buat spreadsheet dengan 4 sheet:

**`Database`**
| A | B | C | D | E | F |
|---|---|---|---|---|---|
| nomor_hewan | jenis_hewan | daftar_pekurban | jumlah_pekurban | instansi | wilayah |

> Primary key: kombinasi `nomor_hewan + instansi + jenis_hewan`. Sapi dan kambing boleh punya nomor yang sama selama instansinya berbeda atau jenisnya berbeda.
>
> Untuk sapi dengan beberapa pekurban, pisahkan nama dengan koma: `PAK JOKO, PAK ANWAR, BU KARTINI`

**`Laporan`**
| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| nomor_hewan | jenis_hewan | daftar_pekurban | jumlah_pekurban | instansi | wilayah | url_hidup | tgl_hidup | url_ditumbangkan | tgl_ditumbangkan | url_mati | tgl_mati | uploader_hidup | uploader_ditumbangkan | uploader_mati |

**`Akun`**
| A | B | C | D | E |
|---|---|---|---|---|
| email | password_hash | username | role (admin/user) | salt |

> Password disimpan sebagai hash SHA-256 + salt (500 iterasi). Gunakan fungsi `hashPasswordsKeSheet()` di Apps Script untuk hash password dari plaintext.

**`DokumentasiInstansi`**
| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| instansi | wilayah | jenis | folderUrl | tglUpload | uploader | catatan |

### 2. Google Apps Script

1. Buka spreadsheet → **Extensions → Apps Script**
2. Hapus kode default, paste isi `backend/Code.gs`
3. Isi `ROOT_FOLDER_ID` dengan ID folder Google Drive tujuan penyimpanan foto
4. Tambahkan Script Property:
   - **Project Settings → Script Properties → Add property**
   - Key: `SCRIPT_SECRET` — Value: string acak 32+ karakter (sama dengan `GAS_SECRET` di Vercel)
5. **Deploy → New deployment → Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Salin URL deployment

### 3. Vercel

Set environment variables di **Vercel Dashboard → Settings → Environment Variables**:

| Key | Value |
|---|---|
| `APPS_SCRIPT_URL` | URL deployment Apps Script |
| `GAS_SECRET` | String acak 32+ karakter |
| `JWT_SECRET` | String acak 32+ karakter (berbeda dari GAS_SECRET) |
| `ALLOWED_ORIGINS` | `https://namadomain.vercel.app` |

Generate secret key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Lokal

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

### Publik

| Action | Body | Keterangan |
|---|---|---|
| `login` | `{ email, password }` | Verifikasi kredensial, kembalikan JWT |
| `getPublicStats` | `{}` | Statistik publik |
| `searchPekurban` | `{ query }` | Cari nama pekurban (min. 2 karakter) |
| `getPekurbanDetail` | `{ nama, nomor_hewan, instansi }` | Detail hewan + status foto |
| `getDokumentasiWilayah` | `{ wilayah }` | Daftar file dokumentasi per wilayah |

### Panitia (JWT role: user)

| Action | Body | Keterangan |
|---|---|---|
| `getHewan` | `{}` | Semua hewan + status foto |
| `uploadFoto` | `{ nomor_hewan, jenis_hewan, instansi, jenis_foto, base64Data, mimeType }` | Upload foto hewan |
| `getDokumentasi` | `{}` | Riwayat dokumentasi instansi |
| `uploadDokumentasi` | `{ instansi, wilayah, jenis_dokumentasi, files[] }` | Upload foto/video dokumentasi |
| `getFileById` | `{ fileId }` | Ambil file Drive sebagai base64 (foto) atau preview URL (video) |

### Admin (JWT role: admin)

| Action | Body | Keterangan |
|---|---|---|
| `getAdminData` | `{}` | Semua hewan + user + statistik |
| `addHewan` | `{ hewan }` | Tambah hewan baru |
| `updateHewan` | `{ hewan }` | Edit data hewan |
| `deleteHewan` | `{ nomor_hewan, instansi }` | Hapus hewan + folder Drive |
| `addUser` | `{ newUser }` | Tambah akun |
| `updateUser` | `{ user }` | Edit akun |
| `deleteUser` | `{ targetEmail }` | Hapus akun |

---

## Fitur Portal Pekurban

- **Dashboard publik** — statistik total hewan, sudah dipotong, jumlah pekurban, wilayah
- **Pencarian privat** — ketik nama sendiri, nama pekurban lain tidak muncul
- **Privasi sapi** — nama pekurban dipisah koma di sheet, masing-masing hanya melihat namanya sendiri
- **Profil pekurban** — nomor hewan, instansi, wilayah, timeline status sembelih (3 fase)
- **Foto dokumentasi** — tampil langsung di web app via base64, ada tombol unduh
- **Dokumentasi wilayah** — foto pencacahan & penyaluran dari wilayah yang sama
- **Sertifikat** — preview sertifikat terima kasih (unduh dalam pengembangan)
- **Desktop layout** — 3 kolom penuh layar, mobile tetap scroll vertikal

---

## Utilitas Backend

Jalankan dari editor Apps Script (satu kali):

| Fungsi | Kegunaan |
|---|---|
| `hashPasswordsKeSheet()` | Hash semua password plaintext di sheet Akun (dengan salt) |
| `syncLaporanFromDatabase()` | Sinkronisasi baris Database → Laporan (data lama) |
| `syncDokumentasiInstansi()` | Sinkronisasi instansi unik → DokumentasiInstansi |
| `testSearchPekurban()` | Test pencarian pekurban dari editor |

---

## Struktur Folder Google Drive

```
ROOT_FOLDER/
└── {instansi}/
    └── {wilayah}/
        └── {jenis_hewan}/
            └── {nomor_hewan}/
                ├── 001_hidup_1234567890.jpg
                ├── 001_ditumbangkan_1234567891.jpg
                └── 001_mati_1234567892.jpg
```

---

## Checklist Sebelum Go-Live

- [ ] `ROOT_FOLDER_ID` diisi di Code.gs (jangan push ke GitHub)
- [ ] `SCRIPT_SECRET` diset di Script Properties GAS
- [ ] Semua env vars diset di Vercel dashboard
- [ ] Password akun di-hash via `hashPasswordsKeSheet()`
- [ ] Apps Script di-deploy ulang setelah update Code.gs
- [ ] 2FA aktif di akun Google pemilik spreadsheet
- [ ] Spreadsheet tidak di-share ke publik
- [ ] `.env.local` tidak ter-commit (cek dengan `git status`)
