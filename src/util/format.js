export const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export const rp = (n) =>
  'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(Number(n) || 0));

export const rpSingkat = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e9) return (v < 0 ? '−' : '') + 'Rp ' + (Math.abs(v) / 1e9).toFixed(1).replace('.', ',') + ' M';
  if (Math.abs(v) >= 1e6) return (v < 0 ? '−' : '') + 'Rp ' + (Math.abs(v) / 1e6).toFixed(1).replace('.', ',') + ' jt';
  if (Math.abs(v) >= 1e3) return (v < 0 ? '−' : '') + 'Rp ' + Math.round(Math.abs(v) / 1e3) + ' rb';
  return rp(v);
};

export const hariIni = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Tahun pelayanan GKI berjalan April sampai Maret tahun berikutnya.
export const periodeTP = (tahun) => {
  const keluar = [];
  for (let i = 3; i <= 11; i++) keluar.push(`${tahun}-${String(i + 1).padStart(2, '0')}`);
  for (let i = 0; i <= 2; i++) keluar.push(`${tahun + 1}-${String(i + 1).padStart(2, '0')}`);
  return keluar;
};

export const labelPeriode = (p) => {
  if (!p) return '—';
  const [y, m] = p.split('-');
  return `${NAMA_BULAN[Number(m) - 1]} ${y}`;
};

export const labelBulanPendek = (p) => {
  if (!p) return '—';
  const [y, m] = p.split('-');
  return `${NAMA_BULAN[Number(m) - 1].slice(0, 3)} ${y.slice(-2)}`;
};

export const tanggalPanjang = (t) => {
  if (!t) return '—';
  const [y, m, d] = t.split('-');
  return `${Number(d)} ${NAMA_BULAN[Number(m) - 1].slice(0, 3)} ${y}`;
};

// Tahun pelayanan yang sedang berjalan pada tanggal tertentu.
export const tpBerjalan = (tgl = hariIni()) => {
  const [y, m] = tgl.split('-').map(Number);
  return m >= 4 ? y : y - 1;
};

// Nilai satu bulan pada program kerja bisa berupa angka rupiah,
// huruf X untuk kegiatan tanpa anggaran, atau kosong.
export const bacaNilaiBulan = (masukan) => {
  const t = String(masukan ?? '').trim();
  if (t === '') return null;
  if (t.toUpperCase() === 'X') return 'X';
  const angka = Number(t.replace(/[^0-9]/g, ''));
  return Number.isFinite(angka) && angka > 0 ? angka : null;
};

export const tulisNilaiBulan = (nilai) => {
  if (nilai === 'X') return 'X';
  if (typeof nilai === 'number' && nilai > 0) return String(nilai);
  return '';
};

export const jumlahBulan = (bulan = {}) =>
  Object.values(bulan).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);

// Pemisah ribuan gaya Indonesia. Dipakai saat mengetik nominal supaya
// tidak tertukar dengan pemisah desimal.
export const formatRibuan = (nilai) => {
  const digit = String(nilai ?? '').replace(/[^0-9]/g, '');
  if (!digit) return '';
  return digit.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export const angkaDari = (teks) => {
  const digit = String(teks ?? '').replace(/[^0-9]/g, '');
  return digit ? Number(digit) : 0;
};
