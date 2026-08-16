# Sistem Keuangan dan Program Kerja — GKI Camar

Bagian pertama: masuk, peran, kelola akun, dan data induk badan pelayanan.

## Menjalankan di StackBlitz

1. Buka `stackblitz.com`, pilih **Create new project**, lalu template **Vite React**.
2. Hapus berkas contoh bawaannya.
3. Unggah seluruh isi folder ini, pertahankan struktur foldernya.
4. StackBlitz memasang dependensi sendiri. Tunggu sampai pratinjau muncul.

Kalau lebih mudah, unggah proyek ini ke GitHub lalu buka lewat
`stackblitz.com/github/NAMA-ANDA/NAMA-REPO`.

## Menyiapkan Firebase sebelum dipakai

### 1. Nyalakan Authentication

Firebase Console → Authentication → Get started → Sign-in method →
aktifkan **Email/Password**. Jangan aktifkan pendaftaran mandiri lewat cara lain;
akun dibuat super user, bukan didaftarkan sendiri.

### 2. Buat Firestore

Firebase Console → Firestore Database → Create database → pilih lokasi
**asia-southeast2 (Jakarta)** supaya lebih cepat diakses dari Indonesia.
Mulai dengan mode produksi, karena aturannya akan diganti pada langkah berikut.

### 3. Pasang aturan keamanan

Salin isi `firestore.rules` ke Firebase Console → Firestore Database → Rules → Publish.
Salin isi `storage.rules` ke menu Storage → Rules → Publish.

Ini langkah paling penting. Tanpa aturan ini, data antar badan pelayanan tidak terlindungi.

### 4. Buat super user pertama

Ini satu-satunya akun yang dibuat manual, karena belum ada siapa pun yang bisa
mendaftarkannya.

1. Authentication → Users → **Add user**. Isi email dan sandi.
2. Salin **User UID** yang muncul di daftar.
3. Firestore Database → **Start collection** dengan nama `pengguna`.
4. Document ID diisi UID tadi, lalu isi kolomnya:

| Kolom | Tipe | Nilai |
|---|---|---|
| `nama` | string | nama lengkap Anda |
| `email` | string | email yang sama |
| `peran` | string | `super` |
| `bp` | array | kosongkan |
| `aktif` | boolean | `true` |
| `sandiAwal` | boolean | `false` |

Setelah itu masuk lewat aplikasi. Akun berikutnya dibuat dari menu Kelola akun.

### 5. Storage (kalau memakai lampiran LPJ)

Storage mewajibkan paket Blaze. Pasang **budget alert** dulu di
Google Cloud Console → Billing → Budgets & alerts, misalnya di angka lima dolar.
Selama pemakaian di bawah 5 GB penyimpanan dan 100 GB transfer per bulan,
tagihannya tetap nol.

## Lima peran

| Peran | Melihat | Mengubah |
|---|---|---|
| `super` | Semua | Semua, termasuk data induk dan akun |
| `ketua` | Semua | Menyetujui PBO bendahara, memberi izin khusus |
| `bendahara` | Semua | Seluruh keuangan, verifikasi PBO dan LPJ |
| `pembina` | Semua | Program kerja badan pelayanan binaannya |
| `pengurus` | Program kerja semua badan pelayanan, keuangan miliknya sendiri | PBO dan LPJ miliknya |

Pengurus tidak dapat membuka posisi keuangan gereja. Ini dijaga dua lapis:
menu disembunyikan di aplikasi, dan `firestore.rules` menolak permintaannya di peladen.

## Struktur data Firestore

```
pengguna/{uid}            nama, email, peran, bp[], aktif, sandiAwal
badanPelayanan/{kode}     nama, jenis, urut, aktif
pengaturan/{dok}          profil gereja, tahun pelayanan berjalan
programKerja/{id}         tahunPelayanan, bp, kegiatan[], status
pbo/{id}                  bp, periodeAnggaran, baris[], status
lpj/{id}                  bp, periodeAnggaran, baris[], evaluasi, lampiran[], status
transaksi/{id}            buku kas gereja
rapb/{tahunPelayanan}     pagu belanja dan target penerimaan
kewajiban/{id}            kewajiban berulang untuk proyeksi kas
jejak/{id}                catatan perubahan, hanya bisa ditambah
```

## Yang menyusul

Bagian kedua menambah program kerja beserta verifikasi pembina.
Bagian ketiga menambah PBO dan LPJ dengan unggahan berkas terkompresi.
Bagian keempat memindahkan seluruh modul keuangan yang sudah jadi.
