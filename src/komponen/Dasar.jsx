import React, { useState } from 'react';
import { Landmark } from 'lucide-react';
import { formatRibuan, angkaDari } from '../util/format.js';

/**
 * Logo gereja. Menaruh berkas di public/logo-gereja.png akan menggantikan
 * lambang bawaan. Kalau berkasnya tidak ada, lambang bawaan yang dipakai,
 * jadi aplikasi tetap jalan tanpa perlu menyiapkan gambar lebih dulu.
 */
export function Logo({ ukuran = 28, bulat = 'rounded' }) {
  const [gagal, setGagal] = useState(false);

  if (gagal) {
    return (
      <span className={`${bulat} bg-teal-700 flex items-center justify-center shrink-0`}
        style={{ width: ukuran, height: ukuran }}>
        <Landmark size={Math.round(ukuran * 0.55)} className="text-white" />
      </span>
    );
  }

  return (
    <img src="/logo-gereja.png" alt="Logo gereja" onError={() => setGagal(true)}
      className={`${bulat} object-contain bg-white shrink-0`}
      style={{ width: ukuran, height: ukuran }} />
  );
}

/**
 * Kotak isian nominal rupiah. Angka dirapikan dengan titik ribuan sambil
 * diketik, dan hanya menerima digit, sehingga tidak ada risiko nilai
 * terbaca sebagai desimal.
 */
export function InputRupiah({ nilai, onUbah, className = '', ...sisa }) {
  const [tampil, setTampil] = useState(formatRibuan(nilai || ''));

  const ketik = (e) => {
    const rapi = formatRibuan(e.target.value);
    setTampil(rapi);
    onUbah(angkaDari(rapi));
  };

  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-stone-400 pointer-events-none">Rp</span>
      <input value={tampil} onChange={ketik} inputMode="numeric" autoComplete="off"
        className={`w-full border border-stone-300 rounded-md pl-8 pr-3 py-2 text-sm text-right focus:border-teal-600 outline-none ${className}`}
        {...sisa} />
    </div>
  );
}

/**
 * Sel satu bulan pada program kerja. Menerima angka rupiah dengan titik
 * ribuan, atau huruf X untuk kegiatan yang dijalankan tanpa anggaran.
 */
export function SelBulan({ nilai, kunci, onUbah }) {
  const awal = nilai === 'X' ? 'X' : (typeof nilai === 'number' && nilai > 0 ? formatRibuan(nilai) : '');
  const [tampil, setTampil] = useState(awal);
  const [fokus, setFokus] = useState(false);

  // Sinkronkan ketika nilai dari luar berubah, misalnya berpindah badan pelayanan.
  React.useEffect(() => { if (!fokus) setTampil(awal); }, [awal, fokus]);

  const ketik = (e) => {
    const mentah = e.target.value.trim();
    if (/^[xX]$/.test(mentah)) { setTampil('X'); return; }
    setTampil(formatRibuan(mentah));
  };

  const lepas = () => {
    setFokus(false);
    if (tampil === 'X') { onUbah('X'); return; }
    const n = angkaDari(tampil);
    onUbah(n > 0 ? n : null);
    setTampil(n > 0 ? formatRibuan(n) : '');
  };

  const tandaX = tampil === 'X';

  if (kunci) {
    return (
      <div className={`w-full border rounded px-1.5 py-1.5 text-[11px] ${
        nilai === 'X' ? 'border-blue-200 bg-blue-50 text-blue-900 text-center'
          : nilai ? 'border-stone-200 bg-white text-right'
          : 'border-stone-100 bg-stone-50 text-stone-300 text-right'}`}>
        {nilai === 'X' ? 'X' : nilai ? formatRibuan(nilai) : '—'}
      </div>
    );
  }

  return (
    <input value={tampil} onChange={ketik} onFocus={() => setFokus(true)} onBlur={lepas}
      inputMode="numeric" autoComplete="off" placeholder="—"
      className={`w-full border rounded px-1.5 py-1.5 text-[11px] focus:border-teal-600 outline-none ${
        tandaX ? 'border-blue-300 bg-blue-50 text-blue-900 text-center font-medium'
          : 'border-stone-300 text-right'}`} />
  );
}
