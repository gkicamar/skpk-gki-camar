import React, { useState } from 'react';
import { Landmark, ChevronDown, CornerDownRight, EyeOff, Search } from 'lucide-react';
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

/**
 * Pemilih badan pelayanan. Menggantikan daftar gulung bawaan yang sulit dibaca
 * ketika divisi dan departemennya banyak. Menampilkan pengelompokan, penanda
 * milik sendiri, tanda rahasia, dan pencarian.
 */
export function PilihBP({ nilai, daftar, bpSaya = [], onPilih, label = 'Badan pelayanan' }) {
  const [buka, setBuka] = useState(false);
  const [cari, setCari] = useState('');

  const terpilih = daftar.find((b) => b.kode === nilai);
  const divisi = daftar.filter((b) => !b.divisi).sort((a, b) => (a.urut || 99) - (b.urut || 99));
  const anak = (kode) => daftar.filter((b) => b.divisi === kode).sort((a, b) => (a.urut || 99) - (b.urut || 99));
  const cocok = (b) => !cari.trim() || b.nama.toLowerCase().includes(cari.toLowerCase().trim());

  const induk = terpilih?.divisi ? daftar.find((b) => b.kode === terpilih.divisi) : null;

  const Baris = ({ b, dalam }) => (
    <button type="button"
      onClick={() => { onPilih(b.kode); setBuka(false); setCari(''); }}
      className={`w-full text-left px-3 py-2.5 flex items-center gap-2 hover:bg-stone-50 ${
        b.kode === nilai ? 'bg-teal-50' : ''} ${dalam ? 'pl-9' : ''}`}>
      {dalam && <CornerDownRight size={12} className="text-stone-300 shrink-0 -ml-4" />}
      <span className="min-w-0 flex-1">
        <span className={`text-sm block truncate ${dalam ? '' : 'font-medium'}`}>{b.nama}</span>
        <span className="text-[11px] text-stone-500">{b.jenis}</span>
      </span>
      {b.rahasia && <EyeOff size={12} className="text-amber-700 shrink-0" />}
      {bpSaya.includes(b.kode) && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 shrink-0">milik Anda</span>
      )}
    </button>
  );

  return (
    <div className="relative">
      <label className="block text-[11px] text-stone-500 mb-1">{label}</label>
      <button type="button" onClick={() => setBuka((v) => !v)}
        className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm bg-white text-left flex items-center gap-2 hover:border-stone-400">
        <span className="min-w-0 flex-1">
          {terpilih ? (
            <>
              <span className="block truncate">{terpilih.nama}</span>
              {induk && <span className="text-[11px] text-stone-500 block truncate">di bawah {induk.nama}</span>}
            </>
          ) : <span className="text-stone-400">Pilih badan pelayanan…</span>}
        </span>
        {terpilih?.rahasia && <EyeOff size={13} className="text-amber-700 shrink-0" />}
        <ChevronDown size={15} className={`text-stone-400 shrink-0 transition-transform ${buka ? 'rotate-180' : ''}`} />
      </button>

      {buka && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => { setBuka(false); setCari(''); }} />
          <div className="absolute z-40 mt-1 w-full bg-white border border-stone-200 rounded-lg shadow-lg overflow-hidden">
            <div className="p-2 border-b border-stone-100">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input autoFocus value={cari} onChange={(e) => setCari(e.target.value)}
                  placeholder="Cari nama badan pelayanan…"
                  className="w-full pl-8 pr-2 py-1.5 border border-stone-200 rounded text-sm outline-none focus:border-teal-600" />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto overscroll-contain divide-y divide-stone-50">
              {divisi.length === 0 && (
                <p className="px-3 py-6 text-center text-[13px] text-stone-500">Belum ada badan pelayanan.</p>
              )}
              {divisi.map((d) => {
                const turunan = anak(d.kode).filter(cocok);
                if (!cocok(d) && turunan.length === 0) return null;
                return (
                  <div key={d.kode}>
                    {cocok(d) && <Baris b={d} dalam={false} />}
                    {turunan.map((a) => <Baris key={a.kode} b={a} dalam />)}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
