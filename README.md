# Kurban Digital — Yayasan Bhakti Nusa Tenggara

Platform terpadu untuk mengelola dan memantau dokumentasi penyembelihan hewan qurban secara real-time. Idul Adha 1447 H / 2026 M.

---

## Arsitektur

```
Frontend (Vercel)          Backend (Google Apps Script)
─────────────────          ────────────────────────────
index.html                 Code.gs  ←→  Google Sheets (DB)
admin/index.html    ──→    api/proxy.js  ──→  Apps Script URL
user/index.html                          ↕
pekurban/index.html                  Google Drive (foto)
```

- **Frontend** — HTML/CSS/JS statis, di-deploy di Vercel
- **Backend** — Google Apps Script sebagai REST API, terhubung ke Google Sheets sebagai database dan Google Drive sebagai penyimpanan foto
- **Proxy** — `api/proxy.js` (Vercel serverless function) meneruskan request ke Apps Script URL agar API key tidak terekspos di frontend

---

## Struktur Project

```
├── index.html              # Halaman utama — pilih portal
├── admin/
│   └── index.html          # Portal Admin (dashboard, CRUD hewan & user)
├── user/
│   └── index.html          # Portal Panitia (upload foto, dokumentasi)
├── pekurban/
│   └── index.html          # Portal Pekurban (cek status & unduh sertifikat)
├── api/
│   └── proxy.js            # Vercel serverless proxy ke Apps Script
├── assets/
│   ├── css/style.css
│   ├── js/api.js           # Helper callApi()
│   └── fonts/              # Lucide icon font
├── kebutuhan backend/
│   └── Code.gs             # Google Apps Script (backend lengkap)
├── vercel.json
└── .env.local              # APPS_SCRIPT_URL (tidak di-commit)
```

---

## Portal & Akses

| Portal | URL | Akses |
|---|---|---|
| Pilih Portal | `/` | Publik |
| Panitia | `/user` | Login (role: user) |
| Administrator | `/admin` | Login (role: admin) |
| Pekurban | `/pekurban` | Publik — cari nama sendiri |

---

## Keamanan

### Lapisan perlindungan yang sudah diterapkan

| Lapisan | Mekanisme |
|---|---|
| CORS | Hanya domain di `ALLOWED_ORIGINS` yang bisa akses `/api/proxy` |
| Action whitelist | Proxy menolak semua action yang tidak ada di daftar izin |
| Rate limiting | Maks. 60 request/menit per IP (in-memory, per Vercel instance) |
| Body size limit | Payload maks. 10 MB per request |
| Security headers | `X-Frame-Options`, `X-Content-Type-Options`, `CSP`, dll via `vercel.json` |
| Session expiry | Token frontend expired setelah 8 jam, auto-logout setiap 1 menit |
| Backend auth | Setiap API call admin/panitia divalidasi ulang di Apps Script (`isAdmin`/`isValidUser`) |
| Error masking | Error internal tidak dikirim ke client, hanya pesan generik |
| Env vars | `APPS_SCRIPT_URL` hanya ada di server (Vercel env), tidak pernah ke browser |

### Yang perlu kamu lakukan sebelum deploy

1. **Set `ALLOWED_ORIGINS`** di Vercel dashboard → Settings → Environment Variables:
   ```
   ALLOWED_ORIGINS=https://namadomain.vercel.app
   ```
   Ganti dengan domain Vercel kamu yang sebenarnya.

2. **Pastikan Apps Script** di-deploy dengan akses **"Anyone"** tapi URL-nya **tidak dipublikasikan** — hanya proxy yang tahu URL-nya.

3. **Ganti semua password default** di sheet Akun sebelum go-live.

4. **Aktifkan 2FA** di akun Google yang memiliki spreadsheet dan Apps Script.

5. **Batasi akses sheet** — hanya akun Google pemilik yang perlu edit akses. Jangan share spreadsheet ke publik.

### Keterbatasan yang perlu diketahui

- Rate limiting bersifat in-memory per Vercel instance — tidak persistent lintas restart/instance. Untuk proteksi lebih kuat gunakan [Upstash Redis](https://upstash.com).
- Autentikasi frontend berbasis `localStorage` — cukup untuk use case internal, bukan untuk data sangat sensitif.
- Apps Script URL bisa ditemukan jika seseorang punya akses ke Vercel logs. Rotasi URL deployment secara berkala jika diperlukan.

---

## Setup & Deployment

### 1. Google Sheets

Buat spreadsheet dengan 4 sheet berikut:

**Sheet: `Database`**
| A | B | C | D | E | F |
|---|---|---|---|---|---|
| nomor_hewan | jenis_hewan | daftar_pekurban | jumlah_pekurban | instansi | wilayah |

> Untuk sapi dengan beberapa pekurban, isi kolom C dengan nama dipisah koma: `PAK JOKO, PAK ANWAR, BU KARTINI`

**Sheet: `Laporan`**
| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| nomor_hewan | jenis_hewan | daftar_pekurban | jumlah_pekurban | instansi | wilayah | url_hidup | tgl_hidup | url_ditumbangkan | tgl_ditumbangkan | url_mati | tgl_mati | uploader_hidup | uploader_ditumbangkan | uploader_mati |

**Sheet: `Akun`**
| A | B | C | D |
|---|---|---|---|
| email | password (SHA-256) | username | role (admin/user) |

**Sheet: `DokumentasiInstansi`**
| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| instansi | wilayah | jenis | folderUrl | tglUpload | uploader | catatan |

### 2. Google Apps Script

1. Buka spreadsheet → **Extensions → Apps Script**
2. Hapus kode default, paste isi `kebutuhan backend/Code.gs`
3. Sesuaikan `ROOT_FOLDER_ID` dengan ID folder Google Drive tujuan penyimpanan foto
4. **Deploy → New deployment → Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Salin URL deployment

### 3. Vercel / Lokal

```bash
npm install
```

Buat file `.env.local`:
```
APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
GAS_SECRET=string_acak_min_32_karakter
JWT_SECRET=string_acak_min_32_karakter_berbeda
ALLOWED_ORIGINS=https://YOUR_VERCEL_DOMAIN.vercel.app
```

Generate secret key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Jalankan dua kali — satu untuk `GAS_SECRET`, satu untuk `JWT_SECRET`.
```bash
npm run dev
```

Deploy ke Vercel: push ke GitHub, lalu set environment variable `APPS_SCRIPT_URL` di dashboard Vercel.

---

## API Reference

Semua request dikirim via `POST /api/proxy?action=<action>` dengan body JSON.

### Publik (tanpa auth)

| Action | Body | Keterangan |
|---|---|---|
| `login` | `{ email, password }` | Login panitia/admin |
| `getPublicStats` | `{}` | Statistik publik (total hewan, pekurban, wilayah) |
| `searchPekurban` | `{ query }` | Cari nama pekurban (min. 2 karakter) |
| `getPekurbanDetail` | `{ nama, nomor_hewan }` | Detail hewan + status foto untuk 1 pekurban |
| `getPhotoAsBase64` | `{ fileUrl }` | Ambil foto Drive sebagai base64 (tanpa redirect) |

### Panitia (butuh `email` valid di sheet Akun)

| Action | Body | Keterangan |
|---|---|---|
| `getHewan` | `{ email }` | Daftar semua hewan + status foto |
| `uploadFoto` | `{ email, username, nomor_hewan, jenis_foto, base64Data, mimeType }` | Upload foto hewan (hidup/ditumbangkan/mati) |
| `getDokumentasi` | `{ email }` | Riwayat dokumentasi instansi |
| `uploadDokumentasi` | `{ email, username, instansi, wilayah, jenis_dokumentasi, files[] }` | Upload foto/video dokumentasi instansi |

### Admin (butuh `email` dengan role `admin`)

| Action | Body | Keterangan |
|---|---|---|
| `getAdminData` | `{ email }` | Semua data hewan + user + statistik |
| `addHewan` | `{ email, hewan }` | Tambah hewan baru |
| `updateHewan` | `{ email, hewan }` | Edit data hewan |
| `deleteHewan` | `{ email, nomor_hewan }` | Hapus hewan + folder Drive-nya |
| `addUser` | `{ email, newUser }` | Tambah akun panitia/admin |
| `updateUser` | `{ email, user }` | Edit akun |
| `deleteUser` | `{ email, targetEmail }` | Hapus akun |

---

## Fitur Portal Pekurban

- **Dashboard publik** — statistik total hewan, sudah dipotong, jumlah pekurban, wilayah
- **Pencarian nama** — ketik nama sendiri, nama pekurban lain tidak akan muncul
- **Privasi sapi** — sapi dengan 7 pekurban (nama dipisah koma di sheet) dipecah jadi entri individual; Pak Joko hanya melihat namanya, bukan Pak Anwar atau Bu Kartini
- **Profil pekurban** — nomor hewan, instansi, wilayah pemotongan, status sembelih (timeline 3 fase)
- **Foto dokumentasi** — tampil langsung di web app (tidak redirect ke Drive), ada tombol unduh
- **Sertifikat** — generate & unduh sertifikat terima kasih (template dalam pengembangan)

---

## Utilitas Backend

Jalankan fungsi berikut **satu kali** dari editor Apps Script untuk sinkronisasi data lama:

```
syncLaporanFromDatabase()     — sinkronisasi baris Database → Laporan
syncDokumentasiInstansi()     — sinkronisasi instansi unik → DokumentasiInstansi
testSearchPekurban()          — test pencarian pekurban dari editor
```

---

## Struktur Folder Google Drive

Foto disimpan otomatis dengan hierarki:

```
ROOT_FOLDER/
└── {instansi}/
    └── {wilayah}/
        └── {jenis_hewan}/
            └── {nomor_hewan}/
                ├── S001_hidup_1234567890.jpg
                ├── S001_ditumbangkan_1234567891.jpg
                └── S001_mati_1234567892.jpg
```
