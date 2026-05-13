# Rencana Implementasi: Sistem Barcode Kupon Kurban

## Tasks

- [x] 1. Setup Struktur Data Google Sheets dan Google Drive
  - [x] 1.1 Buat sheet `PendaftaranMasjid` dengan kolom: masjid_id, nama_masjid, nama_normalized, alamat, kecamatan, kabupaten, nama_pic, telepon_pic, status, tgl_daftar, jumlah_kk_valid, jumlah_sapi_jatah, tgl_penetapan, admin_penetap, token_issued_at, token_revoked_at, alasan_blokir, admin_pemblokir, tgl_diblokir
  - [x] 1.2 Buat sheet `DataKK` dengan kolom: kk_id, masjid_id, nomor_kk, file_id, status_ocr, nama_kepala, anggota_json, jumlah_anggota_tertera, jumlah_anggota_parsed, discrepancy_note, anggota_dikonfirmasi_manual, tgl_upload, uploader
  - [x] 1.3 Buat sheet `KuponMasjid` dengan kolom: kupon_id, masjid_id, kode_kupon, qr_data, jumlah_sapi, status, tgl_terbit, tgl_digunakan, petugas_scan, lokasi_scan, foto_bukti_id, foto_bukti_url
  - [x] 1.4 Buat sheet `SesiOTP` dengan kolom: masjid_id, otp_code, otp_expiry, tgl_kirim
  - [x] 1.5 Buat sheet `KonfigSistem` dengan kolom: kunci, nilai, tgl_update, admin_update — isi baris awal: periode_pendaftaran_buka=true, tgl_tutup_pendaftaran=null, nomor_diblokir=[]
  - [x] 1.6 Buat folder Google Drive: `KK/` (untuk file KK per masjid) dan `BuktiFoto/` (untuk foto bukti pengambilan)

- [x] 2. Utilitas dan Helper Functions (Google Apps Script)
  - [x] 2.1 Implementasi `normalizeName(nama)` — lowercase, strip tanda baca (-, ., '), normalisasi spasi
  - [x] 2.2 Implementasi `jaroWinklerSimilarity(s1, s2)` — algoritma Jaro-Winkler untuk fuzzy matching nama masjid
  - [x] 2.3 Implementasi `processWithLock(operation, timeoutMs)` — wrapper LockService untuk operasi atomik
  - [x] 2.4 Implementasi CRUD helpers untuk setiap sheet (getMasjidById, saveKKRecord, updateKuponRecord, dll.)
  - [x] 2.5 Implementasi `getKonfigSistem()` dan `updateKonfigSistem(kunci, nilai, adminEmail)`
  - [x] 2.6 Tulis property tests untuk `normalizeName`: selalu menghasilkan lowercase tanpa tanda baca berlebih
  - [x] 2.7 Tulis property tests untuk `jaroWinklerSimilarity`: nilai selalu antara 0.0–1.0; identik dengan dirinya sendiri selalu 1.0

- [x] 3. Backend Autentikasi OTP WhatsApp (Google Apps Script)
  - [x] 3.1 Implementasi `checkNomorWA(teleponPic)` — cek apakah nomor WA terdaftar, kirim OTP jika terdaftar
  - [x] 3.2 Implementasi `sendOTPWhatsApp(masjidId, teleponPic)` — generate OTP 6 digit, simpan ke SesiOTP, kirim via Fonnte API
  - [x] 3.3 Implementasi `verifyOTP(masjidId, otpCode)` — validasi OTP, hapus setelah berhasil, update token_issued_at dan reset token_revoked_at
  - [x] 3.4 Implementasi `requestOTP(teleponPic)` — untuk login ulang saat token expired atau di-revoke
  - [x] 3.5 Implementasi pembatasan maksimum 3 percobaan verifikasi OTP per sesi (anti-brute force)
  - [x] 3.6 Tulis property tests untuk `verifyOTP`: OTP yang sudah berhasil diverifikasi tidak ada lagi di SesiOTP (Property 12)

- [x] 4. Backend Pendaftaran Masjid (Google Apps Script)
  - [x] 4.1 Implementasi `registerMasjid(data)` — validasi input, cek duplikasi nama (exact + fuzzy Jaro-Winkler ≥ 85% dalam kecamatan sama), simpan dengan status draft, kirim OTP
  - [x] 4.2 Implementasi `validateNamaMasjid(namaMasjid, kecamatan)` — exact match dan fuzzy match per kecamatan
  - [x] 4.3 Implementasi cek `NomorDiblokir` di `checkNomorWA` dan `registerMasjid`
  - [x] 4.4 Implementasi cek periode pendaftaran di `registerMasjid`
  - [x] 4.5 Tulis property tests untuk `validateNamaMasjid`: masjid dalam kecamatan sama dengan similarity ≥ 0.85 selalu ditolak (Property 10); kecamatan berbeda diizinkan (Property 10)
  - [x] 4.6 Tulis property tests untuk `normalizeName` konsistensi: nama_normalized selalu hasil normalisasi dari nama_masjid (Property 11)

- [x] 5. Backend Upload KK dan OCR (Google Apps Script)
  - [x] 5.1 Implementasi `extractNomorKK(fileId)` — OCR via Google Drive API, ekstrak nomor KK 16 digit
  - [x] 5.2 Implementasi `parseNomorKK(rawText)` — regex parsing nomor KK dari teks OCR
  - [x] 5.3 Implementasi `parseJumlahAnggotaTertera(rawText)` — ekstrak jumlah anggota dari teks KK
  - [x] 5.4 Implementasi `parseAnggotaKeluarga(rawText)` — parse daftar anggota dari teks OCR
  - [x] 5.5 Implementasi `validateAnggotaCount(jumlahTertera, jumlahParsed)` — deteksi discrepancy dan generate discrepancy_note
  - [x] 5.6 Implementasi `isValidNomorKK(nomor)` — validasi 16 digit + kode wilayah valid
  - [x] 5.7 Implementasi `processUploadKK(masjidId, fileData)` — alur lengkap: upload Drive → OCR → cek duplikat (dalam lock) → simpan record dengan status yang sesuai
  - [x] 5.8 Implementasi cek status masjid (harus draft) dan cek periode pendaftaran di `processUploadKK`
  - [x] 5.9 Tulis property tests untuk `parseNomorKK`: selalu mengembalikan string 16 digit atau null
  - [x] 5.10 Tulis property tests untuk `parseJumlahAnggotaTertera`: selalu mengembalikan integer 1–30 atau null
  - [x] 5.11 Tulis property tests untuk `validateAnggotaCount`: jumlah sama → has_discrepancy false; jumlahTertera null → has_discrepancy false (Property 4)
  - [x] 5.12 Tulis property tests untuk `processUploadKK`: upload saat status bukan draft selalu ditolak (Property 13); upload saat periode tutup selalu ditolak (Property 13)

- [x] 6. Backend Konfirmasi Anggota dan Selesai Upload (Google Apps Script)
  - [x] 6.1 Implementasi `konfirmasiAnggota(masjidId, kkId, anggotaData)` — validasi data anggota, update status KK ke valid, increment jumlah_kk_valid
  - [x] 6.2 Implementasi validasi: array anggota tidak kosong, setiap anggota punya nama/jk/umur valid
  - [x] 6.3 Implementasi `konfirmasiSelesaiUpload(masjidId)` — cek jumlah_kk_valid > 0, update status draft → menunggu_review
  - [x] 6.4 Tulis property tests untuk `konfirmasiAnggota`: data valid → status berubah ke valid dan jumlah_kk_valid bertambah 1 (Property 9); data kosong → selalu ditolak; KK bukan perlu_konfirmasi_anggota → ditolak
  - [x] 6.5 Tulis property tests untuk konsistensi jumlah_kk_valid: selalu sama dengan count DataKK dengan status valid/manual (Property 4)

- [x] 7. Checkpoint: Verifikasi Backend Core
  - [x] 7.1 Jalankan semua unit tests dan property tests untuk task 2–6
  - [x] 7.2 Verifikasi keunikan nomor KK: tidak ada dua record DataKK dengan nomor KK sama (Property 1)
  - [x] 7.3 Verifikasi konsistensi jumlah_kk_valid setelah serangkaian upload dan konfirmasi (Property 4)

- [x] 8. Backend Manajemen Token Sesi dan Revoke (Google Apps Script)
  - [x] 8.1 Implementasi `revokeTokenMasjid(masjidId, adminEmail)` — set token_revoked_at ke now()
  - [x] 8.2 Implementasi `checkTokenRevoked(masjidId, tokenIssuedAt)` — cek apakah token_revoked_at > token_issued_at
  - [x] 8.3 Implementasi middleware validasi token di setiap endpoint GAS yang memerlukan autentikasi masjid
  - [x] 8.4 Implementasi `updateNomorWAMasjid(masjidId, nomorWaBaru, adminEmail)` — validasi format + keunikan nomor baru
  - [x] 8.5 Tulis property tests untuk `revokeTokenMasjid`: setelah dipanggil, token_revoked_at > token_issued_at selalu true (Property 16)
  - [x] 8.6 Tulis property tests untuk `verifyOTP` setelah revoke: token_revoked_at di-reset ke null, token_issued_at diperbarui (Property 16)

- [x] 9. Backend Kontrol Periode Pendaftaran dan Manajemen Admin (Google Apps Script)
  - [x] 9.1 Implementasi `togglePeriodePendaftaran(buka, adminEmail)` — update KonfigSistem
  - [x] 9.2 Implementasi `resolveKKVerifikasi(kkId, action, koreksiData, adminEmail)` — terima/tolak/koreksi KK perlu_verifikasi
  - [x] 9.3 Implementasi `rejectRegistration(masjidId, alasan)` — tolak pendaftaran masjid
  - [x] 9.4 Implementasi `getRegistrations()`, `getKKDetail(masjidId)`, `getKKPerluVerifikasi(masjidId)`

- [x] 10. Backend Penetapan Jatah dan Penerbitan Kupon (Google Apps Script)
  - [x] 10.1 Implementasi `generateKuponKode(masjidId, jumlahSapi)` — format BNT-YYYY-MASJIDID-JUMLAHSAPI dengan collision check
  - [x] 10.2 Implementasi `generateQRCode(kodeKupon)` — Google Charts API, return base64 PNG
  - [x] 10.3 Implementasi `setJatah(masjidId, jumlahSapi, adminEmail)` — validasi, generate kupon, update status masjid ke disetujui
  - [x] 10.4 Implementasi cek satu kupon aktif per masjid di `setJatah`
  - [x] 10.5 Tulis property tests untuk `generateKuponKode`: selalu menghasilkan kode berbeda untuk input berbeda (Property 2)
  - [x] 10.6 Tulis property tests untuk keunikan kode kupon: tidak ada dua kupon dengan kode sama (Property 2); satu masjid maksimal satu kupon aktif (Property 3)

- [x] 11. Backend Validasi dan Konfirmasi Pengambilan Kupon (Google Apps Script)
  - [x] 11.1 Implementasi `validateKupon(kodeKupon, petugasEmail)` — cari kupon, cek status, return info masjid tanpa mengubah status
  - [x] 11.2 Implementasi `konfirmasiPengambilan(kuponId, fotoBuktiBase64, mimeType, petugasEmail)` — validasi foto tidak kosong, upload foto ke Drive, update status kupon ke digunakan (dalam lock)
  - [x] 11.3 Implementasi double-check status kupon di dalam lock untuk mencegah race condition
  - [x] 11.4 Tulis property tests untuk `konfirmasiPengambilan`: foto valid + kupon aktif → status berubah ke digunakan, foto_bukti_id tidak null (Property 6, 14); tanpa foto → selalu ditolak (Property 14); kupon sudah digunakan → selalu ditolak (Property 5, 14)
  - [x] 11.5 Tulis property tests untuk irreversibilitas: kupon digunakan tidak bisa kembali ke aktif (Property 5)
  - [x] 11.6 Tulis property tests untuk kelengkapan data scan: kupon digunakan selalu punya tgl_digunakan, petugas_scan, foto_bukti_id, foto_bukti_url (Property 6)

- [x] 12. Backend Moderasi Masjid — Hapus dan Blokir (Google Apps Script)
  - [x] 12.1 Implementasi `hapusMasjid(masjidId, adminEmail)` — cek tidak ada kupon aktif, hapus masjid + semua DataKK
  - [x] 12.2 Implementasi `blokirMasjid(masjidId, alasan, adminEmail)` — set status diblokir, revoke token, catat alasan + admin + tgl
  - [x] 12.3 Implementasi `bukaBlokirMasjid(masjidId, adminEmail)` — kembalikan status ke sebelum diblokir, hapus catatan blokir
  - [x] 12.4 Implementasi `blokirNomorWA(nomorWA, adminEmail)` dan `bukaBlokirNomorWA(nomorWA, adminEmail)` — kelola NomorDiblokir di KonfigSistem
  - [x] 12.5 Implementasi `getNomorDiblokir()` — return daftar nomor WA yang diblokir
  - [x] 12.6 Implementasi cek status diblokir di semua endpoint yang diakses masjid

- [x] 13. Proxy API — Routing dan Validasi (`api/proxy.js`)
  - [x] 13.1 Tambahkan routing untuk action baru: checkNomorWA, registerMasjid, verifyOTP, requestOTP
  - [x] 13.2 Tambahkan routing untuk: uploadKK, konfirmasiAnggota, konfirmasiSelesaiUpload
  - [x] 13.3 Tambahkan routing untuk: getKonfigSistem, togglePeriodePendaftaran
  - [x] 13.4 Tambahkan routing untuk: validateKupon, konfirmasiPengambilan
  - [x] 13.5 Tambahkan routing untuk: getRegistrations, setJatah, getKKDetail, getKKPerluVerifikasi, resolveKKVerifikasi
  - [x] 13.6 Tambahkan routing untuk: revokeTokenMasjid, updateNomorWAMasjid, hapusMasjid, blokirMasjid, bukaBlokirMasjid, blokirNomorWA, bukaBlokirNomorWA, getNomorDiblokir
  - [x] 13.7 Implementasi validasi file (MIME type + ukuran ≤ 5 MB) di proxy untuk action uploadKK
  - [x] 13.8 Implementasi validasi JWT (role: admin) untuk semua endpoint admin
  - [x] 13.9 Implementasi validasi JWT (role: user/admin) untuk validateKupon dan konfirmasiPengambilan

- [x] 14. Checkpoint: Verifikasi Backend Lengkap
  - [x] 14.1 Jalankan integration test: alur pendaftaran → OTP → upload KK → konfirmasi → penetapan jatah → scan kupon
  - [x] 14.2 Verifikasi race condition: dua request upload KK dengan nomor sama bersamaan → hanya satu tersimpan (Property 17)
  - [x] 14.3 Verifikasi race condition: dua request konfirmasiPengambilan bersamaan → hanya satu berhasil (Property 17)
  - [x] 14.4 Verifikasi toggle periode pendaftaran: buka → upload berhasil; tutup → upload ditolak (Property 13)

- [x] 15. Portal Masjid — Struktur HTML dan Manajemen Sesi (`masjid/index.html`)
  - [x] 15.1 Buat file `masjid/index.html` dengan struktur dasar: halaman auth (input nomor WA), halaman OTP, halaman pendaftaran, halaman dashboard
  - [x] 15.2 Implementasi `getSessionToken()` — baca token dari localStorage
  - [x] 15.3 Implementasi `isSessionValid(session)` — cek expiry, auto-refresh jika valid, hapus jika expired
  - [x] 15.4 Implementasi `refreshToken(session)` — perpanjang expiry 7 hari dari now(), update last_active
  - [x] 15.5 Implementasi logika load halaman: cek token → jika valid langsung dashboard; jika tidak tampilkan form nomor WA
  - [x] 15.6 Implementasi handler error TOKEN_REVOKED: hapus token localStorage, tampilkan pesan, redirect ke form nomor WA
  - [x] 15.7 Tulis property tests untuk `refreshToken`: expiry selalu now() + 7 hari setelah dipanggil (Property 15)
  - [x] 15.8 Tulis property tests untuk `isSessionValid`: expiry ≤ now() → selalu return false dan hapus token (Property 15)

- [x] 16. Portal Masjid — Alur OTP dan Pendaftaran
  - [x] 16.1 Implementasi `handleNomorWASubmit(teleponPic)` — panggil checkNomorWA, routing ke form OTP atau form pendaftaran
  - [x] 16.2 Implementasi form pendaftaran masjid dengan validasi client-side (nama, telepon, kecamatan, kabupaten)
  - [x] 16.3 Implementasi `handleRegistrationSubmit(dataMasjid)` — panggil registerMasjid, tampilkan error atau form OTP
  - [x] 16.4 Implementasi `handleOTPSubmit(masjidId, otpCode)` — panggil verifyOTP, simpan token ke localStorage, redirect ke dashboard
  - [x] 16.5 Implementasi tombol "Kirim Ulang OTP" dengan countdown timer
  - [x] 16.6 Implementasi banner "Periode pendaftaran sudah ditutup" berdasarkan getKonfigSistem

- [x] 17. Portal Masjid — Upload KK dan Konfirmasi Anggota
  - [x] 17.1 Implementasi form upload KK: input file (JPEG/PNG/WEBP, max 5 MB), validasi client-side, konversi ke base64
  - [x] 17.2 Implementasi feedback status per file: valid / duplikat / gagal_ocr / perlu_konfirmasi_anggota
  - [x] 17.3 Implementasi form konfirmasi anggota inline: tampilkan foto KK + tabel input anggota (pre-filled dari OCR)
  - [x] 17.4 Implementasi tabel anggota: kolom Nama, Jenis Kelamin (L/P), Umur; tombol "Tambah Anggota"; tombol "Konfirmasi Data Anggota"
  - [x] 17.5 Implementasi counter KK yang sudah diupload secara real-time
  - [x] 17.6 Implementasi tombol "Konfirmasi Selesai Upload" dengan dialog summary sebelum konfirmasi final
  - [x] 17.7 Setelah konfirmasi: nonaktifkan tombol upload, tampilkan status "Menunggu Review"

- [x] 18. Portal Masjid — Tampilan Kupon Digital
  - [x] 18.1 Implementasi `getKuponMasjid(masjidId)` — fetch kupon dari backend
  - [x] 18.2 Tampilkan kupon digital: QR code (dari base64), kode kupon, nama masjid, jumlah sapi jatah
  - [x] 18.3 Implementasi tombol unduh/cetak kupon

- [x] 19. Portal Admin — Tab Manajemen Masjid (`admin/index.html`)
  - [x] 19.1 Tambahkan tab "Kupon Masjid" di portal admin yang sudah ada
  - [x] 19.2 Implementasi tabel daftar pendaftaran masjid: nama, kecamatan, status, jumlah KK valid, tanggal daftar
  - [x] 19.3 Implementasi tombol toggle "Buka/Tutup Pendaftaran" dengan tampilan status dan tanggal tutup
  - [x] 19.4 Implementasi modal detail KK per masjid: tabel KK dengan status OCR, jumlah anggota tertera vs parsed, discrepancy_note
  - [x] 19.5 Implementasi tab/filter "KK Perlu Verifikasi" — tampilkan KK dengan status perlu_verifikasi
  - [x] 19.6 Implementasi form resolusi verifikasi KK: tombol Terima / Tolak / Koreksi
  - [x] 19.7 Implementasi tombol "Revoke Token" per masjid dengan konfirmasi
  - [x] 19.8 Implementasi form update nomor WA PIC masjid

- [x] 20. Portal Admin — Penetapan Jatah dan Preview Kupon
  - [x] 20.1 Implementasi form penetapan jatah sapi per masjid (input jumlah sapi, tombol "Tetapkan Jatah")
  - [x] 20.2 Implementasi preview kupon setelah jatah ditetapkan: tampilkan QR code + kode kupon
  - [x] 20.3 Implementasi layout cetak 6 kupon per halaman A4 (2 kolom × 3 baris) sesuai desain kupon fisik
  - [x] 20.4 Implementasi desain kupon fisik: header biru tua, info masjid, QR code, strip amber, footer merah, disclaimer strip di bawah garis putus-putus

- [x] 21. Portal Admin — Moderasi dan Blokir
  - [x] 21.1 Implementasi tombol "Hapus Masjid" dengan konfirmasi — panggil hapusMasjid
  - [x] 21.2 Implementasi tombol "Blokir Masjid" dengan form alasan — panggil blokirMasjid
  - [x] 21.3 Implementasi tombol "Buka Blokir" untuk masjid yang diblokir — panggil bukaBlokirMasjid
  - [x] 21.4 Implementasi daftar nomor WA yang diblokir dengan tombol "Buka Blokir" per nomor
  - [x] 21.5 Implementasi form blokir nomor WA baru

- [x] 22. Portal Lokasi Pemotongan — Scan QR dan Konfirmasi Pengambilan (`user/index.html`)
  - [x] 22.1 Tambahkan tab "Scan Kupon" di portal panitia yang sudah ada
  - [x] 22.2 Implementasi `initQRScanner(videoElementId, onScanCallback)` menggunakan library jsQR
  - [x] 22.3 Implementasi `stopQRScanner()` — hentikan kamera
  - [x] 22.4 Implementasi input manual kode kupon sebagai fallback
  - [x] 22.5 Implementasi Langkah 1: panggil validateKupon, tampilkan info masjid + jatah sapi (status kupon belum berubah)
  - [x] 22.6 Implementasi Langkah 2: area upload foto dengan instruksi "Foto penerima berdiri di samping mobil pengambilan"
  - [x] 22.7 Implementasi tombol "Konfirmasi Pengambilan" yang hanya aktif setelah foto dipilih
  - [x] 22.8 Implementasi `konfirmasiPengambilan(kuponId, fotoBuktiBase64, mimeType, petugasEmail)` — upload foto + konfirmasi
  - [x] 22.9 Tampilkan sukses setelah konfirmasi berhasil; tampilkan error detail jika kupon sudah digunakan
  - [x] 22.10 Implementasi riwayat scan dalam sesi aktif

- [x] 23. Checkpoint Final: Verifikasi End-to-End
  - [x] 23.1 Jalankan semua property tests — verifikasi semua 17 correctness properties terpenuhi
  - [x] 23.2 Test alur lengkap: pendaftaran masjid → OTP → upload KK → konfirmasi anggota → selesai upload → penetapan jatah → scan kupon → konfirmasi pengambilan dengan foto
  - [x] 23.3 Test alur token: login → auto-refresh → revoke oleh admin → OTP baru → akses normal kembali
  - [x] 23.4 Test moderasi: blokir masjid → request ditolak → buka blokir → akses normal; blokir nomor WA → pendaftaran ditolak
  - [x] 23.5 Test desain kupon fisik: layout 6 per halaman A4, semua elemen teks disclaimer tampil dengan benar

---

## Bug Fixes & Security Patches (Hasil Analisis Kode)

- [ ] 24. Perbaikan Bug Kritis — Backend (Code.gs)
  - [x] 24.1 **[BUG] `getKonfigSistem()` response format mismatch** — Fungsi mengembalikan raw object `{periode_pendaftaran_buka, tgl_tutup_pendaftaran, nomor_diblokir}` tanpa wrapper `{success: true, config: {...}}`, padahal `admin/index.html` dan `masjid/index.html` mengharapkan `cfgRes.success && cfgRes.config`. Perbaiki: ubah return value menjadi `{ success: true, config: { periode_pendaftaran_buka, tgl_tutup_pendaftaran, nomor_diblokir } }`
  - [x] 24.2 **[BUG] `generateKuponKode` regex salah** — Baris `.replace(/MSJ-d+-/, '')` seharusnya `.replace(/MSJ-\d+-/, '')` (missing backslash sebelum `d`). Akibatnya `masjidSeq` tidak ter-strip dengan benar dan kode kupon akan mengandung prefix `MSJ-YYYY-` yang tidak diinginkan.
  - [x] 24.3 **[BUG] `bukaBlokirMasjid` selalu restore ke `'draft'`** — Tidak menyimpan status sebelum diblokir. Masjid yang statusnya `menunggu_review` atau `disetujui` saat diblokir akan kehilangan statusnya. Perbaiki: simpan `status_sebelum_blokir` saat `blokirMasjid` dipanggil, dan restore ke nilai tersebut saat `bukaBlokirMasjid`. Tambahkan kolom `status_sebelum_blokir` di sheet PendaftaranMasjid atau simpan di field `alasan_blokir` sebagai JSON.
  - [x] 24.4 **[BUG] `getDashboardMasjid` tidak diimplementasikan** — `masjid/index.html` memanggil `callApi('getDashboardMasjid', ...)` di fungsi `loadDashboard()`, tapi action ini tidak ada di `proxy.js` (tidak masuk `ALLOWED_ACTIONS`) maupun di `Code.gs` switch-case. Akan menghasilkan error 400 "Action tidak valid" setiap kali portal masjid load dashboard. Perbaiki: implementasikan `getDashboardMasjid(masjidId)` di Code.gs yang mengembalikan data masjid + status KK + kupon, tambahkan ke proxy.js, dan tangani `TOKEN_REVOKED` check di dalamnya.

- [ ] 25. Perbaikan Keamanan — Authorization (Code.gs + proxy.js)
  - [x] 25.1 **[SECURITY] Masjid actions tidak memverifikasi ownership** — `uploadKK`, `konfirmasiAnggota`, `konfirmasiSelesaiUpload`, `getKuponMasjid` masuk `USER_ACTIONS` di proxy.js, artinya panitia (role: user) dengan JWT valid bisa memanggil endpoint ini dengan `masjid_id` sembarang. Di Code.gs, fungsi-fungsi ini tidak memverifikasi bahwa user JWT adalah PIC masjid yang bersangkutan. Perbaiki: pindahkan actions ini ke kategori terpisah `MASJID_ACTIONS` di proxy.js, atau tambahkan validasi di Code.gs bahwa `user.email` (telepon_pic) cocok dengan masjid yang dimaksud. Alternatif: gunakan token sesi masjid (dari localStorage) sebagai parameter tambahan dan validasi di GAS.
  - [x] 25.2 **[SECURITY] `uploadKK` dan `konfirmasiPengambilan` tidak memvalidasi ukuran base64 di GAS** — Proxy memvalidasi ukuran, tapi GAS tidak. Jika GAS dipanggil langsung (bypass proxy), tidak ada validasi ukuran file. Tambahkan validasi ukuran base64 di `processUploadKK` dan `konfirmasiPengambilan` di Code.gs.
  - [x] 25.3 **[SECURITY] `registerMasjid` tidak menggunakan `processWithLock`** — Race condition: dua request pendaftaran dengan nama masjid yang sama bisa lolos validasi duplikat secara bersamaan. Bungkus seluruh alur validasi + simpan di `processWithLock`.
  - [x] 25.4 **[SECURITY] `verifyOTP` tidak menggunakan timing-safe comparison** — Perbandingan string OTP dengan `!==` rentan terhadap timing attack. Gunakan perbandingan karakter-per-karakter dengan waktu konstan, atau tambahkan delay acak kecil sebelum return error.

- [ ] 26. Perbaikan Bug — Frontend (admin/index.html + masjid/index.html)
  - [x] 26.1 **[BUG] `loadKuponMasjid` di admin portal tidak menangani response `getKonfigSistem` yang salah format** — Setelah fix 24.1, pastikan `cfgRes.success && cfgRes.config` sudah benar. Sebelum fix, `updatePeriodeUI` tidak pernah dipanggil karena `cfgRes.config` selalu undefined.
  - [x] 26.2 **[BUG] `checkPeriodePendaftaran` di masjid portal tidak menangani response `getKonfigSistem` yang salah format** — Sama dengan 26.1, `res.config` selalu undefined sebelum fix 24.1. Banner periode tutup tidak pernah tampil.
  - [x] 26.3 **[BUG] `cetakKuponAdmin` menggunakan `_kuponState` yang hanya terisi setelah `submitJatah`** — Jika admin reload halaman atau buka tab kupon masjid tanpa baru saja menetapkan jatah, `_kuponState` akan null dan tombol cetak tidak berfungsi. Perbaiki: load data kupon dari backend saat membuka modal jatah untuk masjid yang sudah `disetujui`, atau tambahkan tombol cetak di tabel masjid yang fetch kupon langsung.
  - [x] 26.4 **[BUG] `openJatahModal` tidak menampilkan kupon yang sudah ada** — Jika masjid sudah punya kupon aktif, modal jatah tetap menampilkan form input jumlah sapi kosong tanpa informasi kupon yang sudah ada. Tambahkan pengecekan: jika masjid sudah `disetujui` dan punya kupon aktif, tampilkan preview kupon langsung tanpa form input.
  - [x] 26.5 **[BUG] `user/index.html` memuat CDN jsQR dua kali** — Script tag `<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js">` muncul dua kali di file. Hapus duplikasi.

- [ ] 27. Perbaikan Bug — Data Integrity (Code.gs)
  - [x] 27.1 **[BUG] `saveKKRecord` menggunakan `sheet.getLastRow()` untuk generate `kk_id`** — Jika ada baris header, `getLastRow()` mengembalikan jumlah baris termasuk header. Saat sheet kosong (hanya header), `count = 1` dan `kk_id = 'KK-YYYY-00001'`. Tapi jika ada concurrent insert, dua record bisa mendapat `kk_id` yang sama. Perbaiki: gunakan timestamp + random suffix, atau gunakan `processWithLock` saat generate ID.
  - [x] 27.2 **[BUG] `setJatah` menggunakan `sheet.getLastRow()` untuk generate `kupon_id`** — Sama dengan 27.1, potensi duplikasi `kupon_id`. Perbaiki dengan cara yang sama.
  - [x] 27.3 **[BUG] `registerMasjid` menggunakan `allMsj.length + 1` untuk generate `masjid_id`** — Jika ada masjid yang dihapus, sequence bisa collision. Contoh: ada 3 masjid (MSJ-001, MSJ-002, MSJ-003), hapus MSJ-002, daftar baru → `allMsj.length = 2`, generate MSJ-003 yang sudah ada. Perbaiki: cari ID tertinggi yang ada dan increment dari sana, atau gunakan UUID/timestamp.
  - [x] 27.4 **[BUG] `extractNomorKK` membuat dokumen OCR temp di ROOT_FOLDER** — Jika proses gagal sebelum `Drive.Files.remove(ocrDoc.id)`, file temp akan tertinggal di Drive dan menumpuk. Tambahkan cleanup di blok `finally` untuk memastikan file temp selalu dihapus.
  - [x] 27.5 **[BUG] `getKonfigSistem` tidak menangani JSON parse error** — `JSON.parse(String(config['nomor_diblokir']))` akan throw jika nilai di sheet corrupt. Bungkus dalam try-catch dan fallback ke `[]`.

- [ ] 28. Perbaikan Minor — UX dan Robustness
  - [x] 28.1 Tambahkan validasi `jumlah_sapi > 0` dan `Number.isInteger(jumlah_sapi)` di `setJatah` di proxy.js (saat ini hanya `Number(body.jumlah_sapi) || 0` yang bisa lolos dengan nilai 0)
  - [x] 28.2 Tambahkan `rejectRegistration` ke `ALLOWED_ACTIONS` di proxy.js — saat ini sudah ada di `ADMIN_ONLY_ACTIONS` tapi perlu dipastikan masuk `ALLOWED_ACTIONS` (sudah via spread, tapi perlu verifikasi)
  - [x] 28.3 Tambahkan penanganan error di `masjid/index.html` saat `loadDashboard` gagal karena `getDashboardMasjid` tidak ada — tampilkan pesan error yang informatif, bukan blank screen
  - [x] 28.4 Tambahkan `Content-Security-Policy` header di proxy.js untuk mencegah XSS di response
  - [x] 28.5 Validasi format `nomor_wa_baru` di proxy.js untuk `updateNomorWAMasjid` — saat ini hanya `.slice(0, 20)` tanpa validasi format Indonesia

- [x] 29. [KRITIS] OTP disimpan plain text di Google Sheets
  - [x] 29.1 Buat fungsi `hashOTP(otpCode)` menggunakan SHA-256 via `Utilities.computeDigest`
  - [x] 29.2 Di `saveOTP`: hash OTP sebelum disimpan ke sheet (`hashOTP(otpCode)`)
  - [x] 29.3 Di `verifyOTP`: bandingkan `hashOTP(inputCode)` dengan nilai di sheet, bukan plain text
  - [x] 29.4 Rename kolom `otp_code` → `otp_hash` di header sheet SesiOTP dan di `setupKuponSheets`

- [x] 30. [KRITIS] Session masjid tidak punya token kriptografis
  - [x] 30.1 Tambah kolom `session_token` di sheet PendaftaranMasjid (`setupKuponSheets` + `saveMasjidRecord`)
  - [x] 30.2 Di `verifyOTP`: generate UUID via `Utilities.getUuid()`, simpan ke `session_token`, return ke client
  - [x] 30.3 Di `revokeTokenMasjid`: set `session_token` ke null/kosong di sheet
  - [x] 30.4 Buat fungsi `validateMasjidSession(masjidId, sessionToken)` di Code.gs
  - [x] 30.5 Panggil `validateMasjidSession` di awal: `uploadKK`, `konfirmasiAnggota`, `konfirmasiSelesaiUpload`, `getKuponMasjid`, `getDashboardMasjid`
  - [x] 30.6 Di `masjid/index.html`: simpan `session_token` ke localStorage saat `verifyOTP` berhasil
  - [x] 30.7 Di `masjid/index.html`: kirim `session_token` di setiap request action masjid
  - [x] 30.8 Di `proxy.js`: tambah `session_token` ke `buildSafeData` untuk semua masjid actions

- [x] 31. [PERINGATAN] Tidak ada rate limit pengiriman OTP per nomor
  - [x] 31.1 Tambah kolom `otp_send_count` dan `otp_send_window_start` di sheet SesiOTP
  - [x] 31.2 Buat fungsi `checkOTPRateLimit(masjidId)` — max 3 kirim per 15 menit per masjid
  - [x] 31.3 Panggil `checkOTPRateLimit` di awal `sendOTPWhatsApp` sebelum generate dan kirim OTP
  - [x] 31.4 Di `proxy.js`: tambah validasi format telepon Indonesia di `sanitizePublicData` untuk `checkNomorWA` dan `requestOTP`

- [-] 32. [PERINGATAN] Google Charts API deprecated — ganti QR generator
  - [ ] 32.1 Ganti `generateQRCode()` di Code.gs dengan `api.qrserver.com` (Opsi B — quick fix)
  - [ ] 32.2 Update `getKuponMasjidByMasjidId` agar regenerate QR via endpoint baru jika `qr_data` lama masih pakai format Google Charts
