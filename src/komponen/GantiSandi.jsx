import React, { useState } from 'react';
import { KeyRound, X, Save, CheckCircle2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../konteks/Auth.jsx';

/**
 * Dialog ubah kata sandi untuk pengguna yang sedang masuk.
 * Firebase mensyaratkan sandi lama sebagai bukti kepemilikan sebelum
 * mengizinkan penggantian, jadi kolom itu tidak bisa dilewati.
 */
export default function GantiSandi({ onTutup }) {
  const { gantiSandi, profil } = useAuth();
  const [lama, setLama] = useState('');
  const [baru, setBaru] = useState('');
  const [ulang, setUlang] = useState('');
  const [lihat, setLihat] = useState(false);
  const [galat, setGalat] = useState('');
  const [selesai, setSelesai] = useState(false);
  const [proses, setProses] = useState(false);

  const cukupPanjang = baru.length >= 8;
  const samaDenganLama = baru.length > 0 && baru === lama;
  const cocok = ulang.length > 0 && baru === ulang;
  const sah = lama && cukupPanjang && cocok && !samaDenganLama;

  const kirim = async (e) => {
    e.preventDefault();
    setGalat('');
    setProses(true);
    try {
      await gantiSandi(lama, baru);
      setSelesai(true);
    } catch (err) {
      setGalat({
        'auth/invalid-credential': 'Kata sandi lama tidak cocok.',
        'auth/wrong-password': 'Kata sandi lama tidak cocok.',
        'auth/weak-password': 'Kata sandi baru terlalu mudah ditebak.',
        'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi beberapa menit.',
      }[err.code] || 'Gagal mengganti sandi. Coba lagi.');
    }
    setProses(false);
  };

  if (selesai) {
    return (
      <div className="fixed inset-0 bg-stone-900/40 flex items-start justify-center p-4 py-10 z-50 overflow-y-auto overscroll-contain">
        <div className="bg-white rounded-lg w-full max-w-sm p-6 my-auto mx-auto text-center">
          <CheckCircle2 size={22} className="text-teal-700 mx-auto mb-3" />
          <h3 className="text-base font-medium mb-1.5">Kata sandi diganti</h3>
          <p className="text-sm text-stone-600 mb-5">
            Mulai sekarang pakai kata sandi baru untuk masuk. Simpan baik-baik,
            karena tidak ada yang bisa melihatnya kembali.
          </p>
          <button onClick={onTutup}
            className="px-4 py-2 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800">Selesai</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-start justify-center p-4 py-10 z-50 overflow-y-auto overscroll-contain">
      <form onSubmit={kirim} className="bg-white rounded-lg w-full max-w-sm my-auto mx-auto">
        <div className="px-5 py-4 border-b border-stone-200 flex justify-between items-center">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
              <KeyRound size={16} className="text-stone-600" />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-medium">Ubah kata sandi</h3>
              <p className="text-[11px] text-stone-500 truncate">{profil?.email}</p>
            </div>
          </div>
          <button type="button" onClick={onTutup} className="text-stone-400 hover:text-stone-700 shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] text-stone-500 mb-1">Kata sandi lama</label>
            <input type="password" value={lama} autoComplete="current-password"
              onChange={(e) => { setLama(e.target.value); setGalat(''); }}
              className="w-full border border-stone-300 rounded-md px-3 py-2.5 text-sm focus:border-teal-600 outline-none" />
          </div>

          <div>
            <label className="block text-[11px] text-stone-500 mb-1">Kata sandi baru</label>
            <div className="relative">
              <input type={lihat ? 'text' : 'password'} value={baru} autoComplete="new-password"
                onChange={(e) => { setBaru(e.target.value); setGalat(''); }}
                className="w-full border border-stone-300 rounded-md pl-3 pr-10 py-2.5 text-sm focus:border-teal-600 outline-none" />
              <button type="button" onClick={() => setLihat((v) => !v)}
                aria-label={lihat ? 'Sembunyikan' : 'Tampilkan'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-stone-400 hover:text-stone-700">
                {lihat ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {baru && !cukupPanjang && <p className="text-[11px] text-amber-700 mt-1">Minimal delapan karakter.</p>}
            {samaDenganLama && <p className="text-[11px] text-amber-700 mt-1">Harus berbeda dari sandi lama.</p>}
          </div>

          <div>
            <label className="block text-[11px] text-stone-500 mb-1">Ulangi kata sandi baru</label>
            <input type={lihat ? 'text' : 'password'} value={ulang} autoComplete="new-password"
              onChange={(e) => { setUlang(e.target.value); setGalat(''); }}
              className="w-full border border-stone-300 rounded-md px-3 py-2.5 text-sm focus:border-teal-600 outline-none" />
            {ulang && !cocok && <p className="text-[11px] text-red-700 mt-1">Belum sama.</p>}
          </div>

          {galat && (
            <p className="text-[12px] bg-red-50 text-red-900 px-3 py-2 rounded flex items-start gap-1.5">
              <AlertTriangle size={14} className="mt-px shrink-0" /> {galat}
            </p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-stone-200 flex justify-end gap-2">
          <button type="button" onClick={onTutup}
            className="px-3 py-2 text-sm border border-stone-300 rounded-md hover:bg-stone-50">Batal</button>
          <button type="submit" disabled={!sah || proses}
            className="px-4 py-2 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800 disabled:bg-stone-300 flex items-center gap-1.5">
            <Save size={15} /> {proses ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>
    </div>
  );
}
