# Dokumen Requirements: Sistem Barcode Kupon Kurban

## Pendahuluan

Sistem Barcode Kupon Kurban adalah fitur baru yang memungkinkan masjid-masjid mendaftar sebagai penerima manfaat kurban dengan mengunggah data Kartu Keluarga (KK) calon penerima. Sistem menggunakan OCR untuk mendeteksi nomor KK dan mencegah duplikasi. Admin menentukan jatah sapi berdasarkan jumlah KK valid, dan sistem menghasilkan kupon digital dengan QR code unik untuk setiap masjid. Kupon digunakan saat pengambilan sapi di lokasi pemotongan terpusat, dengan verifikasi scan dan foto bukti wajib untuk mencegah kecurangan.

Fitur ini menambahkan alur kerja baru ke dalam aplikasi Kurban Digital yang sudah ada, dengan portal baru untuk masjid (`masjid/index.html`) dan ekstensi portal admin serta portal panitia.

## Glosarium

- **Portal_Masjid**: Antarmuka web (`masjid/index.html`) untuk perwakilan masjid mendaftar, upload KK, dan melihat kupon.
- **Portal_Admin**: Antarmuka web (`admin/index.html`) untuk admin mengelola pendaftaran, menetapkan jatah, dan menerbitkan kupon.
- **Portal_Lokasi**: Antarmuka web (`user/index.html`) untuk panitia di lokasi pemotongan melakukan scan dan konfirmasi pengambilan kupon.
- **Sistem**: Keseluruhan sistem Barcode Kupon Kurban, mencakup frontend, Proxy API, dan Google Apps Script backend.
- **OCR_Service**: Komponen Google Apps Script yang mengekstrak teks dari gambar KK menggunakan Google Drive OCR API.
- **LockService**: Komponen GAS `LockService.getScriptLock()` yang menjamin atomisitas operasi kritis.
- **Token_Sesi**: Objek JSON yang disimpan di `localStorage` browser masjid berisi `masjid_id`, `nama_masjid`, `telepon_pic`, `expiry`, dan `last_active`.
- **OTP**: Kode One-Time Password 6 digit yang dikirim via WhatsApp ke nomor PIC masjid untuk autentikasi.
- **KK**: Kartu Keluarga — dokumen resmi Indonesia berisi nomor KK 16 digit dan daftar anggota keluarga.
- **PIC**: Person In Charge — perwakilan masjid yang bertanggung jawab atas pendaftaran.
- **Kupon**: Dokumen digital dan fisik berisi QR code unik yang menjadi bukti hak pengambilan sapi kurban.
- **Jatah_Sapi**: Jumlah ekor sapi yang ditetapkan admin untuk satu masjid berdasarkan jumlah KK valid.
- **Nama_Normalized**: Versi nama masjid dalam huruf kecil, tanpa tanda baca (`-`, `.`, `'`), dengan spasi tunggal — digunakan untuk deteksi duplikat.
- **Discrepancy_Note**: Catatan otomatis yang menjelaskan perbedaan antara jumlah anggota yang tertera di KK dan yang berhasil di-parse OCR.
- **Masjid_Diblokir**: Masjid yang telah diblokir admin sehingga tidak dapat mendaftar ulang, upload KK, atau mengakses portal masjid.
- **Nomor_Diblokir**: Nomor WhatsApp yang telah diblokir admin sehingga tidak dapat digunakan untuk mendaftar atau login ke portal masjid.

---

## Requirements

### Requirement 1: Autentikasi Satu Halaman via OTP WhatsApp

**User Story:** Sebagai perwakilan masjid, saya ingin masuk ke portal dengan satu alur cerdas menggunakan nomor WhatsApp, sehingga saya tidak perlu mengingat username/password dan proses login atau pendaftaran berjalan mulus dalam satu halaman.

#### Acceptance Criteria

1. WHEN Portal_Masjid dimuat dan Token_Sesi valid ada di `localStorage`, THE Portal_Masjid SHALL langsung menampilkan dashboard masjid tanpa meminta input apapun.
2. WHEN Portal_Masjid dimuat dan tidak ada Token_Sesi valid di `localStorage`, THE Portal_Masjid SHALL menampilkan satu form input nomor WhatsApp dengan tombol "Lanjut".
3. WHEN perwakilan masjid memasukkan nomor WhatsApp yang sudah terdaftar dan menekan "Lanjut", THE Sistem SHALL mengirim OTP 6 digit ke nomor tersebut dan menampilkan form input OTP.
4. WHEN perwakilan masjid memasukkan nomor WhatsApp yang belum terdaftar dan menekan "Lanjut", THE Sistem SHALL menampilkan form pendaftaran masjid dengan nomor WhatsApp sudah terisi otomatis.
5. WHEN perwakilan masjid berhasil memverifikasi OTP, THE Sistem SHALL menyimpan Token_Sesi ke `localStorage` dengan masa berlaku 7 hari dan mengarahkan ke dashboard masjid.
6. WHEN Token_Sesi di `localStorage` sudah melewati tanggal `expiry`, THE Portal_Masjid SHALL menghapus Token_Sesi dan menampilkan form input nomor WhatsApp.
7. IF WhatsApp API tidak dapat diakses saat pengiriman OTP, THEN THE Sistem SHALL mengembalikan pesan error dan tidak menyimpan OTP ke sistem.
8. WHEN nomor WhatsApp yang dimasukkan terdaftar di daftar `NomorDiblokir`, THE Sistem SHALL menolak request dengan pesan "Nomor WhatsApp ini tidak dapat digunakan."

---

### Requirement 2: Pendaftaran Masjid Baru

**User Story:** Sebagai perwakilan masjid yang belum terdaftar, saya ingin mendaftarkan masjid saya dengan mengisi data lengkap, sehingga masjid saya dapat berpartisipasi dalam program kurban.

#### Acceptance Criteria

1. WHEN perwakilan masjid mengisi form pendaftaran dan menekan submit, THE Sistem SHALL memvalidasi bahwa `nama_masjid` tidak kosong (maksimum 200 karakter), `telepon_pic` sesuai format nomor Indonesia (`08xx` atau `+628xx`), serta `kecamatan` dan `kabupaten` tidak kosong.
2. WHEN nama masjid yang didaftarkan identik (setelah normalisasi) dengan nama masjid yang sudah terdaftar di kecamatan yang sama, THE Sistem SHALL menolak pendaftaran dengan pesan error yang menyebutkan nama masjid yang sudah ada.
3. WHEN nama masjid yang didaftarkan memiliki kemiripan ≥ 85% (Jaro-Winkler) dengan nama masjid yang sudah terdaftar di kecamatan yang sama, THE Sistem SHALL menolak pendaftaran dengan pesan error yang menyebutkan nama masjid yang mirip.
4. WHEN nama masjid yang didaftarkan memiliki kemiripan ≥ 85% dengan nama masjid di kecamatan yang berbeda, THE Sistem SHALL mengizinkan pendaftaran.
5. WHEN pendaftaran masjid berhasil, THE Sistem SHALL menyimpan data masjid dengan `status: "draft"`, `masjid_id` unik berformat `MSJ-YYYY-NNN`, dan `nama_normalized` yang di-generate otomatis dari `nama_masjid`.
6. WHEN pendaftaran masjid berhasil, THE Sistem SHALL mengirim OTP 6 digit ke nomor WhatsApp PIC dan menampilkan form input OTP.
7. WHILE periode pendaftaran ditutup admin, THE Sistem SHALL menolak semua request pendaftaran masjid baru dengan pesan "Periode pendaftaran sudah ditutup".
8. WHEN nomor WhatsApp yang digunakan untuk mendaftar terdaftar di daftar `NomorDiblokir`, THE Sistem SHALL menolak pendaftaran dengan pesan "Nomor WhatsApp ini tidak dapat digunakan untuk mendaftar."

---

### Requirement 3: Upload Kartu Keluarga dengan OCR

**User Story:** Sebagai perwakilan masjid, saya ingin mengunggah foto Kartu Keluarga satu per satu, sehingga sistem dapat memvalidasi data KK secara otomatis dan menghitung jatah sapi yang layak diterima masjid saya.

#### Acceptance Criteria

1. WHEN perwakilan masjid mengunggah file KK, THE Sistem SHALL memvalidasi bahwa tipe file adalah JPEG, PNG, atau WEBP dan ukuran tidak melebihi 5 MB sebelum meneruskan ke backend.
2. WHEN file KK diterima backend, THE OCR_Service SHALL mengekstrak nomor KK 16 digit dan jumlah anggota keluarga yang tertera dari gambar.
3. WHEN OCR berhasil mengekstrak nomor KK, THE Sistem SHALL memvalidasi bahwa nomor KK terdiri dari tepat 16 digit angka dengan kode wilayah yang valid.
4. WHEN nomor KK yang diekstrak sudah terdaftar di sistem (lintas masjid), THE Sistem SHALL menyimpan record DataKK dengan `status_ocr: "duplikat"` dan tidak menambah `jumlah_kk_valid` masjid.
5. WHEN OCR gagal mengekstrak nomor KK dari gambar, THE Sistem SHALL menyimpan record DataKK dengan `status_ocr: "gagal_ocr"` dan tidak menambah `jumlah_kk_valid` masjid.
6. WHEN OCR berhasil mengekstrak nomor KK tetapi jumlah anggota yang di-parse tidak cocok dengan yang tertera, THEN THE Sistem SHALL menyimpan record DataKK dengan `status_ocr: "perlu_konfirmasi_anggota"`, menyertakan `foto_url` dan `anggota_parsial` dalam response, dan tidak menambah `jumlah_kk_valid` masjid.
7. WHEN OCR berhasil mengekstrak nomor KK dan jumlah anggota cocok, THE Sistem SHALL menyimpan record DataKK dengan `status_ocr: "valid"` dan menambah `jumlah_kk_valid` masjid sebesar 1.
8. WHILE status masjid bukan `"draft"`, THE Sistem SHALL menolak semua request upload KK dengan pesan error yang menyebutkan status masjid saat ini.
9. WHILE periode pendaftaran ditutup admin, THE Sistem SHALL menolak semua request upload KK dengan pesan "Periode pendaftaran sudah ditutup".
10. THE Sistem SHALL memastikan operasi cek duplikasi nomor KK dan penyimpanan record baru bersifat atomik menggunakan LockService, sehingga tidak ada dua record dengan nomor KK yang sama yang tersimpan secara bersamaan.

---

### Requirement 4: Konfirmasi Data Anggota Secara Manual

**User Story:** Sebagai perwakilan masjid, saya ingin mengisi atau mengoreksi data anggota keluarga secara manual ketika OCR tidak berhasil membaca semua data, sehingga KK tetap dapat dihitung sebagai valid tanpa harus menunggu review admin.

#### Acceptance Criteria

1. WHEN KK memiliki `status_ocr: "perlu_konfirmasi_anggota"`, THE Portal_Masjid SHALL menampilkan form konfirmasi anggota inline di halaman yang sama, menampilkan foto KK dan tabel input anggota yang sudah terisi sebagian dari hasil OCR.
2. WHEN perwakilan masjid mengisi data anggota dan menekan "Konfirmasi Data Anggota", THE Sistem SHALL memvalidasi bahwa setiap anggota memiliki `nama` (tidak kosong), `jk` ("L" atau "P"), dan `umur` (0–150).
3. WHEN konfirmasi data anggota berhasil, THE Sistem SHALL mengubah `status_ocr` KK dari `"perlu_konfirmasi_anggota"` menjadi `"valid"`, menyimpan `anggota_json` dengan data yang dikonfirmasi, menetapkan `anggota_dikonfirmasi_manual: true`, dan menambah `jumlah_kk_valid` masjid sebesar 1.
4. IF perwakilan masjid mencoba submit konfirmasi dengan array anggota kosong, THEN THE Sistem SHALL menolak request dengan pesan "Minimal 1 anggota harus diisi" dan tidak mengubah status KK.
5. IF konfirmasiAnggota dipanggil untuk KK yang `status_ocr`-nya bukan `"perlu_konfirmasi_anggota"`, THEN THE Sistem SHALL menolak request dengan pesan error yang sesuai.

---

### Requirement 5: Konfirmasi Selesai Upload

**User Story:** Sebagai perwakilan masjid, saya ingin mengkonfirmasi bahwa saya sudah selesai mengunggah semua KK, sehingga admin dapat mulai mereview pendaftaran saya.

#### Acceptance Criteria

1. WHEN perwakilan masjid menekan tombol "Konfirmasi Selesai Upload", THE Portal_Masjid SHALL menampilkan ringkasan jumlah KK yang sudah diupload sebelum konfirmasi final.
2. WHEN perwakilan masjid mengkonfirmasi selesai upload, THE Sistem SHALL mengubah status masjid dari `"draft"` menjadi `"menunggu_review"`.
3. WHEN status masjid berubah menjadi `"menunggu_review"`, THE Portal_Masjid SHALL menonaktifkan tombol upload KK dan menampilkan status "Menunggu Review".
4. IF konfirmasiSelesaiUpload dipanggil saat `jumlah_kk_valid = 0`, THEN THE Sistem SHALL menolak request dengan pesan "Belum ada KK valid yang diupload".
5. IF konfirmasiSelesaiUpload dipanggil saat status masjid bukan `"draft"`, THEN THE Sistem SHALL menolak request dengan pesan error yang sesuai.

---

### Requirement 6: Kontrol Periode Pendaftaran oleh Admin

**User Story:** Sebagai admin, saya ingin mengontrol kapan periode pendaftaran masjid dibuka dan ditutup, sehingga saya dapat mengelola alur pendaftaran sesuai jadwal program kurban.

#### Acceptance Criteria

1. THE Portal_Admin SHALL menampilkan tombol toggle "Buka/Tutup Pendaftaran" beserta status periode pendaftaran saat ini (buka/tutup) dan tanggal tutup jika sudah ditetapkan.
2. WHEN admin menekan tombol toggle untuk menutup periode pendaftaran, THE Sistem SHALL memperbarui `KonfigSistem.periode_pendaftaran_buka` menjadi `false` dan mencatat `tgl_update` serta `admin_update`.
3. WHEN admin menekan tombol toggle untuk membuka periode pendaftaran, THE Sistem SHALL memperbarui `KonfigSistem.periode_pendaftaran_buka` menjadi `true` dan mencatat `tgl_update` serta `admin_update`.
4. WHILE `KonfigSistem.periode_pendaftaran_buka = false`, THE Portal_Masjid SHALL menampilkan banner "Periode pendaftaran sudah ditutup" dan menonaktifkan semua fungsi upload KK dan pendaftaran baru.

---

### Requirement 7: Penetapan Jatah Sapi dan Penerbitan Kupon

**User Story:** Sebagai admin, saya ingin menetapkan jatah sapi untuk setiap masjid dan menerbitkan kupon QR code, sehingga masjid dapat mengambil sapi kurban di lokasi pemotongan.

#### Acceptance Criteria

1. THE Portal_Admin SHALL menampilkan daftar semua pendaftaran masjid beserta status, jumlah KK valid, dan detail KK per masjid.
2. WHEN admin menetapkan jatah sapi untuk masjid, THE Sistem SHALL memvalidasi bahwa `jumlah_sapi` adalah bilangan bulat positif dan masjid belum memiliki kupon aktif.
3. WHEN admin menetapkan jatah sapi, THE Sistem SHALL menghasilkan `kode_kupon` unik berformat `BNT-YYYY-MASJIDID-JUMLAH+S` dan memastikan keunikannya di seluruh sistem.
4. WHEN admin menetapkan jatah sapi, THE Sistem SHALL menghasilkan QR code sebagai gambar PNG base64 menggunakan Google Charts API dan menyimpan kupon dengan `status: "aktif"`.
5. WHEN kupon berhasil diterbitkan, THE Sistem SHALL memperbarui status masjid menjadi `"disetujui"` dan mengisi `jumlah_sapi_jatah` di PendaftaranMasjid.
6. THE Sistem SHALL memastikan setiap masjid hanya memiliki maksimum satu kupon dengan `status: "aktif"` pada satu waktu.
7. WHEN kupon berhasil diterbitkan, THE Portal_Admin SHALL menampilkan preview kupon beserta QR code untuk diunduh atau dicetak.

---

### Requirement 8: Scan dan Validasi Kupon di Lokasi Pemotongan

**User Story:** Sebagai panitia di lokasi pemotongan, saya ingin memvalidasi kupon masjid dengan scan QR code dan mengkonfirmasi pengambilan dengan foto bukti, sehingga distribusi sapi kurban tercatat dengan akurat dan tidak dapat disalahgunakan.

#### Acceptance Criteria

1. THE Portal_Lokasi SHALL menyediakan antarmuka scan QR code menggunakan kamera perangkat dan input manual kode kupon sebagai fallback.
2. WHEN panitia berhasil scan QR code, THE Sistem SHALL memvalidasi kupon dan menampilkan informasi masjid (nama, alamat, kecamatan) serta jumlah sapi jatah tanpa mengubah status kupon.
3. WHEN kupon yang di-scan tidak ditemukan di sistem, THE Sistem SHALL menampilkan pesan error "Kupon tidak valid".
4. WHEN kupon yang di-scan sudah berstatus `"digunakan"`, THE Sistem SHALL menampilkan pesan error beserta detail kapan dan oleh siapa kupon digunakan.
5. WHEN kupon valid ditampilkan, THE Portal_Lokasi SHALL menampilkan area upload foto dengan instruksi "Foto penerima berdiri di samping mobil pengambilan" dan tombol "Konfirmasi Pengambilan" yang hanya aktif setelah foto dipilih.
6. WHEN panitia menekan "Konfirmasi Pengambilan" dengan foto yang sudah dipilih, THE Sistem SHALL mengupload foto ke Google Drive, mengubah status kupon menjadi `"digunakan"`, dan mengisi `foto_bukti_id`, `foto_bukti_url`, `tgl_digunakan`, serta `petugas_scan`.
7. IF konfirmasiPengambilan dipanggil tanpa foto bukti, THEN THE Sistem SHALL menolak request dengan pesan "Foto bukti pengambilan wajib diupload" dan tidak mengubah status kupon.
8. IF konfirmasiPengambilan dipanggil untuk kupon yang sudah berstatus `"digunakan"`, THEN THE Sistem SHALL menolak request dengan pesan error yang menyebutkan detail penggunaan sebelumnya.
9. THE Sistem SHALL memastikan operasi validasi dan perubahan status kupon bersifat atomik menggunakan LockService, sehingga tidak ada kupon yang dapat ditandai `"digunakan"` dua kali secara bersamaan.
10. IF upload foto bukti ke Google Drive gagal, THEN THE Sistem SHALL mengembalikan pesan error dan tidak mengubah status kupon, sehingga panitia dapat mencoba ulang.

---

### Requirement 9: Manajemen Token Sesi Masjid

**User Story:** Sebagai perwakilan masjid, saya ingin sesi login saya bertahan selama 7 hari dan diperpanjang otomatis setiap kali saya aktif, sehingga saya tidak perlu login ulang setiap hari selama masa pendaftaran.

#### Acceptance Criteria

1. WHEN Token_Sesi valid digunakan untuk aksi apapun di Portal_Masjid, THE Sistem SHALL memperpanjang `expiry` Token_Sesi menjadi 7 hari dari waktu aksi tersebut dan memperbarui `last_active`.
2. WHEN Token_Sesi tidak digunakan selama 7 hari berturut-turut, THE Portal_Masjid SHALL menghapus Token_Sesi dari `localStorage` dan menampilkan form input nomor WhatsApp.
3. WHEN admin merevoke token sesi masjid, THE Sistem SHALL menetapkan `token_revoked_at` ke waktu saat ini di PendaftaranMasjid.
4. WHEN Portal_Masjid menerima response error `TOKEN_REVOKED` dari server, THE Portal_Masjid SHALL menghapus Token_Sesi dari `localStorage` dan menampilkan pesan "Sesi tidak valid. Silakan login ulang dengan OTP."
5. WHEN OTP baru berhasil diverifikasi setelah token di-revoke, THE Sistem SHALL mereset `token_revoked_at` menjadi `null` dan memperbarui `token_issued_at` ke waktu saat ini.
6. WHILE `token_revoked_at > token_issued_at` untuk suatu masjid, THE Sistem SHALL menolak semua request dari portal masjid tersebut.

---

### Requirement 10: Manajemen OTP WhatsApp

**User Story:** Sebagai perwakilan masjid, saya ingin menerima kode OTP via WhatsApp yang berlaku singkat, sehingga proses autentikasi aman dan tidak dapat disalahgunakan.

#### Acceptance Criteria

1. WHEN OTP dikirim, THE Sistem SHALL menyimpan OTP 6 digit acak dengan masa berlaku 15 menit sejak dikirim.
2. WHEN perwakilan masjid memasukkan OTP yang benar sebelum expired, THE Sistem SHALL menghapus OTP dari sistem dan menghasilkan Token_Sesi berlaku 7 hari.
3. WHEN perwakilan masjid memasukkan OTP yang salah, THE Sistem SHALL mengembalikan pesan error "Kode OTP tidak valid" tanpa menghapus OTP.
4. WHEN OTP sudah melewati masa berlaku 15 menit, THE Sistem SHALL menolak verifikasi dengan pesan "OTP sudah kadaluarsa" dan menghapus OTP dari sistem.
5. THE Sistem SHALL memastikan OTP yang sudah berhasil diverifikasi tidak dapat digunakan kembali.
6. THE Sistem SHALL membatasi maksimum 3 percobaan verifikasi OTP per sesi untuk mencegah brute force.

---

### Requirement 11: Manajemen Data Masjid oleh Admin

**User Story:** Sebagai admin, saya ingin dapat merevoke token sesi masjid dan memperbarui nomor WhatsApp PIC, sehingga saya dapat membantu masjid yang mengalami masalah akses akibat HP hilang atau nomor tidak aktif.

#### Acceptance Criteria

1. THE Portal_Admin SHALL menampilkan tombol "Revoke Token" untuk setiap masjid dalam daftar pendaftaran.
2. WHEN admin menekan "Revoke Token" untuk suatu masjid, THE Sistem SHALL menetapkan `token_revoked_at` ke waktu saat ini dan menampilkan konfirmasi bahwa masjid harus login ulang dengan OTP.
3. WHEN admin memperbarui nomor WhatsApp PIC masjid, THE Sistem SHALL memvalidasi bahwa nomor baru sesuai format Indonesia dan tidak digunakan oleh masjid lain, lalu memperbarui `telepon_pic` di PendaftaranMasjid.
4. THE Portal_Admin SHALL menampilkan tab atau filter khusus untuk KK dengan `status_ocr: "perlu_verifikasi"` yang memerlukan review admin.
5. WHEN admin memilih aksi "terima" untuk KK `perlu_verifikasi`, THE Sistem SHALL mengubah `status_ocr` menjadi `"valid"` dan menambah `jumlah_kk_valid` masjid sebesar 1.
6. WHEN admin memilih aksi "tolak" untuk KK `perlu_verifikasi`, THE Sistem SHALL mengubah `status_ocr` menjadi `"gagal_ocr"` tanpa mengubah `jumlah_kk_valid`.
7. WHEN admin memilih aksi "koreksi" untuk KK `perlu_verifikasi`, THE Sistem SHALL memperbarui data KK sesuai koreksi, mengubah `status_ocr` menjadi `"manual"`, dan menambah `jumlah_kk_valid` masjid sebesar 1.

---

### Requirement 12: Kupon Digital dan Fisik

**User Story:** Sebagai perwakilan masjid, saya ingin melihat dan mencetak kupon digital dengan QR code, sehingga saya dapat membawa kupon fisik ke lokasi pemotongan untuk pengambilan sapi.

#### Acceptance Criteria

1. WHEN kupon sudah diterbitkan admin, THE Portal_Masjid SHALL menampilkan kupon digital dengan QR code, kode kupon, nama masjid, dan jumlah sapi jatah.
2. THE Kupon_Fisik SHALL menampilkan nama masjid, alamat, kecamatan, nama PIC, nomor WhatsApp PIC, QR code, dan jumlah sapi jatah.
3. THE Kupon_Fisik SHALL menampilkan teks disclaimer tanggung jawab di strip amber: "Wajib foto penerima berdiri di samping mobil pengambilan sebagai bukti. Kupon berlaku 1x — jika jatuh ke tangan yang tidak bertanggung jawab, sepenuhnya menjadi tanggung jawab masjid."
4. THE Kupon_Fisik SHALL menampilkan peringatan di footer merah: "Kupon yang sudah di-scan tidak dapat digunakan kembali."
5. THE Kupon_Fisik SHALL menampilkan disclaimer strip lengkap di bawah garis putus-putus yang menyatakan bahwa Yayasan Bhakti Nusa Tenggara tidak bertanggung jawab atas kehilangan atau penyalahgunaan kupon.
6. THE Portal_Admin SHALL menghasilkan layout cetak 6 kupon per halaman A4 (2 kolom × 3 baris) dalam format PDF-ready.

---

### Requirement 13: Moderasi Masjid — Hapus dan Blokir

**User Story:** Sebagai admin, saya ingin dapat menghapus data masjid yang tidak valid dan memblokir masjid atau nomor WhatsApp yang mencurigakan, sehingga saya dapat mencegah kecurangan dan menjaga integritas program kurban.

#### Acceptance Criteria

1. THE Portal_Admin SHALL menampilkan tombol "Hapus Masjid" untuk setiap masjid dalam daftar pendaftaran, dengan konfirmasi sebelum eksekusi.
2. WHEN admin menghapus masjid yang belum memiliki kupon aktif atau sudah digunakan, THE Sistem SHALL menghapus data masjid beserta semua record DataKK miliknya dari sistem.
3. WHEN admin mencoba menghapus masjid yang memiliki kupon dengan `status: "aktif"`, THE Sistem SHALL menolak penghapusan dengan pesan error yang meminta admin membatalkan kupon terlebih dahulu.
4. THE Portal_Admin SHALL menampilkan tombol "Blokir Masjid" untuk setiap masjid, yang memblokir masjid tanpa menghapus data historisnya.
5. WHEN admin memblokir masjid, THE Sistem SHALL menetapkan `status` masjid menjadi `"diblokir"`, merevoke token sesi aktif, dan mencatat alasan pemblokiran beserta `admin_pemblokir` dan `tgl_diblokir`.
6. WHILE masjid berstatus `"diblokir"`, THE Sistem SHALL menolak semua request dari masjid tersebut (upload KK, konfirmasi, lihat kupon) dengan pesan "Akun masjid Anda telah diblokir. Hubungi admin untuk informasi lebih lanjut."
7. WHEN admin memblokir nomor WhatsApp, THE Sistem SHALL menambahkan nomor tersebut ke daftar `NomorDiblokir` di KonfigSistem.
8. WHILE nomor WhatsApp terdaftar di `NomorDiblokir`, THE Sistem SHALL menolak semua request `checkNomorWA` dan `registerMasjid` yang menggunakan nomor tersebut dengan pesan "Nomor WhatsApp ini tidak dapat digunakan untuk mendaftar."
9. THE Portal_Admin SHALL menampilkan daftar nomor WhatsApp yang diblokir beserta tombol untuk membuka blokir.
10. WHEN admin membuka blokir masjid, THE Sistem SHALL mengubah `status` masjid kembali ke status sebelumnya (`"draft"` atau `"menunggu_review"`) dan menghapus catatan pemblokiran.
11. WHEN admin membuka blokir nomor WhatsApp, THE Sistem SHALL menghapus nomor tersebut dari daftar `NomorDiblokir`.

---

### Requirement 14: Integritas Data dan Konsistensi Sistem

**User Story:** Sebagai admin, saya ingin sistem menjaga konsistensi data secara otomatis, sehingga jumlah KK valid, keunikan nomor KK, dan status kupon selalu akurat tanpa intervensi manual.

#### Acceptance Criteria

1. THE Sistem SHALL memastikan tidak ada dua record DataKK dengan nomor KK yang sama di seluruh sistem.
2. THE Sistem SHALL memastikan tidak ada dua kupon dengan `kode_kupon` yang sama di seluruh sistem.
3. THE Sistem SHALL memastikan nilai `jumlah_kk_valid` di PendaftaranMasjid selalu sama dengan jumlah record DataKK milik masjid tersebut yang memiliki `status_ocr` bernilai `"valid"` atau `"manual"`.
4. THE Sistem SHALL memastikan KK dengan `status_ocr: "perlu_konfirmasi_anggota"` tidak dihitung dalam `jumlah_kk_valid` sampai perwakilan masjid mengkonfirmasi data anggota.
5. THE Sistem SHALL memastikan KK dengan `status_ocr: "perlu_verifikasi"` tidak dihitung dalam `jumlah_kk_valid` sampai admin memutuskan.
6. THE Sistem SHALL memastikan setiap kupon dengan `status: "digunakan"` memiliki `tgl_digunakan`, `petugas_scan`, `foto_bukti_id`, dan `foto_bukti_url` yang terisi.
7. THE Sistem SHALL memastikan status kupon hanya dapat berubah dari `"aktif"` ke `"digunakan"` atau `"dibatalkan"`, dan tidak dapat kembali ke `"aktif"` setelah berubah.
8. THE Sistem SHALL memastikan field `nama_normalized` di PendaftaranMasjid selalu merupakan hasil normalisasi dari `nama_masjid` (huruf kecil, tanpa tanda baca `-`, `.`, `'`, spasi tunggal).
