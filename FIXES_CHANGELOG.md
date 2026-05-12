# FIXES_CHANGELOG — Kurban Digital Minor Fixes

Tanggal: 12 Mei 2026  
Engineer: Senior Frontend/Backend (Kiro)

---

## Ringkasan

Empat perbaikan kecil telah diimplementasikan. Tidak ada perubahan pada logika bisnis, fitur, atau struktur API yang sudah berjalan.

---

## PERBAIKAN 1 — Rename Folder "kebutuhan backend" → "backend"

**File dimodifikasi:** `README.md`  
**Operasi filesystem:** Folder `kebutuhan backend/` → `backend/`

### Perubahan:
- Folder `kebutuhan backend` di-rename menjadi `backend` (tanpa spasi)
- `README.md` — diupdate 2 referensi:
  - Struktur project: `├── kebutuhan backend/` → `├── backend/`
  - Instruksi setup GAS: `paste isi 'kebutuhan backend/Code.gs'` → `paste isi 'backend/Code.gs'`
- Tidak ada referensi lama yang tertinggal (diverifikasi dengan grep)

### Alasan:
Nama folder dengan spasi dapat menyebabkan error di terminal, CI/CD pipeline, dan sistem Linux ketika path direferensikan tanpa tanda kutip.

---

## PERBAIKAN 2 — Header Retry-After saat Rate Limit (proxy.js + api.js)

**File dimodifikasi:** `api/proxy.js`, `assets/js/api.js`

### Perubahan di `api/proxy.js`:
- **Rate limit per IP** (baris ~173): ditambahkan `res.setHeader('Retry-After', '60')` sebelum `return res.status(429)`
- **Rate limit per user** (baris ~247): ditambahkan `res.setHeader('Retry-After', '60')` sebelum `return res.status(429)`
- Kedua tempat yang mengembalikan status 429 kini menyertakan header `Retry-After: 60`

### Perubahan di `assets/js/api.js`:
- Ditambahkan penanganan khusus untuk `response.status === 429`:
  ```js
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') || '60';
    throw new Error('Terlalu banyak permintaan. Coba lagi dalam ' + retryAfter + ' detik.');
  }
  ```
- Pesan error kini informatif: menyebutkan berapa detik harus menunggu
- Error ini akan muncul di UI via `showToast()` di masing-masing portal

---

## PERBAIKAN 3 — Validasi Ukuran Body dari Konten Aktual (proxy.js)

**File dimodifikasi:** `api/proxy.js`

### Perubahan:
- **Dihapus:** pengecekan via header `Content-Length` yang bisa dipalsukan oleh client:
  ```js
  // SEBELUM (tidak aman):
  if (parseInt(req.headers['content-length'] || '0', 10) > 25 * 1024 * 1024) { ... }
  ```
- **Diganti** dengan pengecekan dari ukuran body aktual setelah parsing:
  ```js
  // SESUDAH (aman):
  const bodySize = Buffer.byteLength(JSON.stringify(body), 'utf8');
  if (bodySize > 25 * 1024 * 1024) {
    return res.status(413).json({ success: false, error: 'Payload terlalu besar' });
  }
  ```
- Pengecekan diletakkan segera setelah `req.body` tersedia, sebelum validasi action
- Status code diubah dari 400 menjadi **413 (Payload Too Large)** yang lebih semantik

### Alasan:
Header `Content-Length` dikirim oleh client dan bisa dipalsukan. Client bisa mengirim header kecil tapi body besar, melewati pengecekan lama. Pengecekan dari `Buffer.byteLength` menggunakan ukuran aktual setelah body di-parse oleh middleware.

---

## PERBAIKAN 4 — Shared Auth Helpers di auth.js

**File dimodifikasi:** `assets/js/auth.js` (dibuat baru), `admin/index.html`, `user/index.html`

### File baru: `assets/js/auth.js`

Berisi 4 fungsi shared yang sebelumnya ditulis berulang di setiap portal:

| Fungsi | Deskripsi |
|--------|-----------|
| `getAuthData()` | Ambil semua data auth dari localStorage (token, email, username, role, expiry) |
| `initAuth(requiredRole)` | Cek sesi valid + role, redirect ke `/` jika tidak valid, return data auth |
| `logout()` | Hapus semua localStorage dan redirect ke `/` |
| `startSessionWatcher(expiredAt, intervalMs)` | Auto-logout via setInterval saat sesi expired |

Key localStorage yang digunakan (tidak diubah): `authToken`, `userEmail`, `username`, `userRole`, `loginExpiry`

### Perubahan di `admin/index.html`:
- Ditambahkan `<script src="../assets/js/auth.js"></script>` sebelum script utama
- Logika auth inline diganti:
  ```js
  // SEBELUM:
  const email = localStorage.getItem('userEmail');
  const role = localStorage.getItem('userRole');
  const expiry = Number(localStorage.getItem('loginExpiry'));
  if (!email || role !== 'admin' || isNaN(expiry) || Date.now() > expiry) {
    localStorage.clear(); window.location.href = '/';
  }
  
  // SESUDAH:
  const _auth = initAuth('admin');
  if (!_auth) throw new Error('redirect');
  const email = _auth.email; const username = _auth.username; const role = _auth.role;
  ```
- Fungsi `logout()` inline dihapus (sudah ada di `auth.js`)
- `setInterval` auto-logout diganti dengan `startSessionWatcher(_auth.expiry)`

### Perubahan di `user/index.html`:
- Ditambahkan `<script src="../assets/js/auth.js"></script>` sebelum script utama
- Logika auth inline diganti dengan `initAuth(null)` (null = tidak cek role spesifik, user dan admin boleh)
- `logoutBtn` event listener diganti: `() => logout()` (memanggil fungsi dari `auth.js`)
- `setInterval` auto-logout diganti dengan `startSessionWatcher(_auth.expiry)`

### Portal yang tidak diubah:
- `pekurban/index.html` — portal publik, tidak ada auth check, tidak perlu `auth.js`
- `index.html` — landing page dengan logika login sendiri, tidak perlu `auth.js`

---

## File yang Dimodifikasi

| File | Perbaikan |
|------|-----------|
| `README.md` | P1 |
| `api/proxy.js` | P2, P3 |
| `assets/js/api.js` | P2 |
| `assets/js/auth.js` | P4 (dibuat baru) |
| `admin/index.html` | P4 |
| `user/index.html` | P4 |

## File yang Tidak Dimodifikasi

- `pekurban/index.html` — portal publik, tidak ada auth
- `index.html` — landing page dengan login logic sendiri
- `assets/css/style.css` — tidak ada perubahan CSS
- `vercel.json` — tidak ada perubahan konfigurasi
- `kebutuhan backend/Code.gs` → `backend/Code.gs` — tidak ada perubahan isi
