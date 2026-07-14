# Donasi MuslimSolo.id

Website open donasi (crowdfunding) untuk muslimsolo.id. Situs statis (HTML/CSS/JS) yang
di-deploy ke GitHub Pages, dengan Google Apps Script sebagai API dan Google Spreadsheet
sebagai database.

## Arsitektur

```
Donatur / Admin (browser)
        │
        ▼
GitHub Pages  ──►  donasi.muslimsolo.id   (situs statis: HTML/CSS/JS)
        │
        ▼  (fetch JSON)
Google Apps Script Web App   (apps-script/Code.gs)
        │
        ├──►  Google Spreadsheet   (campaigns, donations, payment, admin, lpj)
        └──►  Google Drive         (penyimpanan bukti transfer)
```

## Struktur File

```
index.html            Landing page (daftar campaign aktif)
detail.html           Detail campaign
donasi.html           Alur donasi: nominal → pembayaran → konfirmasi → sukses
admin.html            Login & dashboard verifikasi admin
assets/css/style.css  Styling (mobile-first, crowdfunding style)
assets/js/config.js   Konfigurasi (API_URL, WRITE_TOKEN) — WAJIB diisi
assets/js/utils.js    Helper umum
assets/js/api.js      Klien API ke Apps Script
assets/js/landing.js  Logika landing page
assets/js/detail.js   Logika halaman detail
assets/js/donasi.js   Logika alur donasi
assets/js/admin.js    Logika admin console
apps-script/Code.gs   Backend Google Apps Script
CNAME                 Domain kustom GitHub Pages
.nojekyll             Menonaktifkan pemrosesan Jekyll
```

## Langkah Setup

### 1. Buat Google Spreadsheet

Buat spreadsheet baru dengan 5 sheet berikut. **Baris pertama harus berisi nama kolom persis seperti di bawah** (huruf kecil).

**Sheet `campaigns`**

| id | title | slug | description | target_amount | current_amount | deadline | status | image | fund_usage |
|----|-------|------|-------------|---------------|----------------|----------|--------|-------|------------|

- `id`: unik (mis. `1`, `2`).
- `target_amount`, `current_amount`: angka (tanpa titik/Rp). `current_amount` dihitung otomatis dari donasi VERIFIED, tidak perlu diisi manual.
- `deadline`: tanggal (mis. `2026-12-31`).
- `status`: `ACTIVE`, `COMPLETED`, atau `CLOSED`. Isi awal `ACTIVE`.
- `image`: URL gambar banner.
- `fund_usage`: penjelasan penggunaan dana (opsional).

**Sheet `donations`**

| id | campaign_id | name | amount | payment_method | proof_image | status | created_at | note |
|----|-------------|------|--------|----------------|-------------|--------|------------|------|

Sheet ini diisi otomatis oleh sistem. Cukup buat baris header-nya.

**Sheet `payment`** (satu baris data)

| bank_name | account_number | account_name | qris_image |
|-----------|----------------|--------------|------------|
| BCA | 1234567890 | Kemuslimahan Masjid Al-Ikhlas | https://.../qris.png |

**Sheet `admin`**

| username | password |
|----------|----------|

Biarkan kosong; akun dibuat lewat fungsi `setupAdmin()` (password disimpan ter-hash).

**Sheet `lpj`**

| id | title | campaign_id | date | amount | description | image | created_at |
|----|-------|-------------|------|--------|-------------|-------|------------|

- `id`: unik (mis. `1`, `2`).
- `title`: judul pengadaan.
- `campaign_id`: id program terkait (opsional, boleh kosong).
- `date`: tanggal pengadaan (mis. `2026-06-20`).
- `amount`: nominal dana terpakai (angka, tanpa titik/Rp).
- `image`: URL bukti/nota (diisi otomatis bila upload dari admin).

Cukup buat baris header-nya; data diisi lewat dashboard admin (tab **LPJ**).

### 2. Pasang Apps Script

1. Di spreadsheet: **Extensions → Apps Script**.
2. Hapus isi default, tempel seluruh isi `apps-script/Code.gs`.
3. **Project Settings → Script Properties**, tambahkan:
   - `WRITE_TOKEN` — string acak rahasia (mis. hasil generator password).
   - `PROOF_FOLDER_ID` — (opsional) id folder Drive untuk menyimpan bukti. Jika kosong, folder "Donasi MuslimSolo - Bukti" dibuat otomatis.
   - `ADMIN_EMAIL` — (opsional) email penerima notifikasi donasi baru.
   - `SPREADSHEET_ID` — (opsional) hanya jika skrip tidak terikat ke spreadsheet.
4. Buat akun admin: edit fungsi `setupAdmin()` (ganti `username` & `password`), pilih fungsi `setupAdmin`, klik **Run**, izinkan akses. Setelah berhasil, kosongkan kembali nilai password di kode agar tidak tersimpan plaintext.
5. **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Klik Deploy, salin **Web app URL** yang berakhiran `/exec`.

> Setiap kali kode `Code.gs` diubah, buat **deployment baru** atau **Manage deployments → Edit → New version** agar perubahan aktif.

### 3. Konfigurasi Frontend

Edit `assets/js/config.js`:

```js
window.APP_CONFIG = {
  API_URL: "https://script.google.com/macros/s/XXXX/exec", // URL dari langkah 2.5
  WRITE_TOKEN: "samakan-dengan-script-property",
  ...
};
```

`WRITE_TOKEN` harus identik dengan Script Property `WRITE_TOKEN`.

### 4. Deploy ke GitHub Pages

1. Push seluruh isi folder ini ke repository GitHub.
2. **Settings → Pages → Build and deployment**: Source = **Deploy from a branch**, Branch = `main`, folder `/ (root)`.
3. Domain kustom sudah disiapkan via file `CNAME` (`donasi.muslimsolo.id`). Tambahkan record DNS:
   - `CNAME` `donasi` → `USERNAME.github.io`
4. Aktifkan **Enforce HTTPS** setelah sertifikat terbit.

## Fitur Admin

Setelah login, admin memiliki navigasi bawah (bottom nav) ala aplikasi HP dengan empat tab:

- **Verifikasi** — ringkasan statistik dan daftar donasi PENDING dengan tombol Terima/Tolak.
- **Program** — kelola program donasi: tambah, edit, dan hapus campaign (judul, deskripsi, target,
  deadline, status, banner, info penggunaan dana). `current_amount` tetap dihitung otomatis dari
  donasi terverifikasi sehingga tidak bisa/diperlukan diisi manual.
- **LPJ** — kelola Laporan Pertanggungjawaban (LPJ) Pengadaan: tambah, edit, dan hapus laporan
  penggunaan dana (judul, program terkait, tanggal, nominal, rincian, dan foto bukti/nota). Laporan
  tampil publik langsung di halaman beranda (section "Laporan Pertanggungjawaban"), dan
  setiap item dapat dibuka rinciannya di halaman `lpj-detail.html`.
- **Akun** — kelola akun admin: tambah admin baru, ubah password, dan hapus admin. Password selalu
  disimpan sebagai salted hash. Admin terakhir tidak dapat dihapus.

Tombol **Keluar** juga tersedia di navigasi bawah. Semua aksi admin memerlukan Session_Token yang
valid; bila sesi berakhir, admin otomatis diarahkan ke halaman login.

## Alur Donasi (maksimal 5 langkah)

1. Pilih campaign di landing page → **Lihat Detail**.
2. **Donasi Sekarang**.
3. Isi nominal & pilih metode (Transfer / QRIS), lihat instruksi.
4. **Konfirmasi Donasi**: isi nama, upload bukti, kirim.
5. Selesai — donasi berstatus `PENDING` menunggu verifikasi admin.

## Catatan Keamanan

- **Password admin** disimpan sebagai salted SHA-256 hash, bukan plaintext.
- **Validasi & rate limiting** dilakukan di sisi server (Apps Script).
- `WRITE_TOKEN` di situs statis **tidak benar-benar rahasia** (terlihat di source). Ia hanya penghalang dasar. Proteksi nyata untuk aksi admin adalah Session_Token yang terbit setelah login dan kedaluwarsa otomatis.
- Bukti transfer disimpan di Google Drive dengan akses "anyone with link". Jangan menaruh data sensitif lain di folder tersebut.
- Untuk produksi dengan trafik tinggi, pertimbangkan memperketat akses dan menambah verifikasi tambahan.

## Pengujian Cepat (lokal)

Karena situs statis murni, kamu bisa membukanya dengan server statis apa pun, mis.:

```
python -m http.server 8000
```

lalu buka `http://localhost:8000`. Pastikan `config.js` sudah diisi `API_URL` agar data muncul.
