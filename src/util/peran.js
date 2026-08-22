// Lima peran, sesuai struktur GKI Camar.
// Urutan di sini menentukan urutan tampil di layar kelola pengguna.

export const PERAN = {
  super: {
    kode: 'super',
    nama: 'Super user',
    ringkas: 'Menangani seluruh akses dan modifikasi sistem',
    warna: 'bg-stone-800 text-white',
  },
  ketua: {
    kode: 'ketua',
    nama: 'Ketua Majelis Jemaat',
    ringkas: 'Menyetujui PBO bendahara dan memberi izin khusus',
    warna: 'bg-purple-50 text-purple-900',
  },
  bendahara: {
    kode: 'bendahara',
    nama: 'Bendahara Majelis Jemaat',
    ringkas: 'Memverifikasi PBO dan LPJ, mengelola seluruh keuangan',
    warna: 'bg-teal-50 text-teal-900',
  },
  pembina: {
    kode: 'pembina',
    nama: 'Majelis Jemaat pembina',
    ringkas: 'Memverifikasi program kerja badan pelayanan binaannya',
    warna: 'bg-blue-50 text-blue-900',
  },
  pengurus: {
    kode: 'pengurus',
    nama: 'Pengurus Badan Pelayanan',
    ringkas: 'Menyusun program kerja, mengajukan PBO, melaporkan LPJ',
    warna: 'bg-amber-50 text-amber-900',
  },
};

export const DAFTAR_PERAN = Object.values(PERAN);

// Peran yang boleh melihat posisi keuangan gereja.
// Pengurus badan pelayanan sengaja tidak termasuk.
export const majelis = (p) => ['super', 'ketua', 'bendahara', 'pembina'].includes(p);

export const butuhBP = (p) => p === 'pengurus' || p === 'pembina';

export const namaPeran = (p) => PERAN[p]?.nama || 'Tidak dikenal';

// Kewenangan per layar. Dipakai untuk menyusun menu dan menjaga rute.
// Ini lapisan kenyamanan, bukan pengamanan — pengamanan sebenarnya
// ada di firestore.rules yang dijalankan di sisi peladen.
export const AKSES = {
  beranda:       ['super', 'ketua', 'bendahara', 'pembina', 'pengurus'],
  programKerja:  ['super', 'ketua', 'bendahara', 'pembina', 'pengurus'],
  pbo:           ['super', 'ketua', 'bendahara', 'pembina', 'pengurus'],
  lpj:           ['super', 'ketua', 'bendahara', 'pembina', 'pengurus'],
  evaluasi:      ['super', 'ketua', 'bendahara', 'pembina', 'pengurus'],
  keuangan:      ['super', 'ketua', 'bendahara', 'pembina'],
  anggaran:      ['super', 'ketua', 'bendahara', 'pembina'],
  penggunaAkun:  ['super'],
  pengaturan:    ['super'],
};

export const boleh = (layar, p) => (AKSES[layar] || []).includes(p);
