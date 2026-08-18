import React, { useState } from 'react';
import { Eye, EyeOff, LogIn, KeyRound, AlertTriangle } from 'lucide-react';
import { Logo } from './Dasar.jsx';
import { useAuth } from '../konteks/Auth.jsx';

export default function Masuk() {
  const { masuk, galat, setGalat } = useAuth();
  const [email, setEmail] = useState('');
  const [sandi, setSandi] = useState('');
  const [lihat, setLihat] = useState(false);
  const [proses, setProses] = useState(false);

  const kirim = async (e) => {
    e.preventDefault();
    if (!email.trim() || !sandi) return;
    setProses(true);
    await masuk(email, sandi);
    setProses(false);
  };

  return (
    <div className="min-h-full bg-stone-100 flex items-start justify-center p-4 py-10 font-sans overflow-y-auto">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-6 justify-center">
          <Logo ukuran={38} bulat="rounded-lg" />
          <div>
            <h1 className="text-base font-medium text-stone-900 leading-tight">GKI Camar</h1>
            <p className="text-[11px] text-stone-500">Keuangan dan program kerja</p>
          </div>
        </div>

        <form onSubmit={kirim} className="bg-white rounded-lg border border-stone-200 p-6 space-y-4">
          <div>
            <label className="block text-[11px] text-stone-500 mb-1">Email</label>
            <input type="email" value={email} autoComplete="username" inputMode="email"
              onChange={(e) => { setEmail(e.target.value); setGalat(''); }}
              className="w-full border border-stone-300 rounded-md px-3 py-2.5 text-sm focus:border-teal-600 outline-none"
              placeholder="nama@contoh.com" />
          </div>

          <div>
            <label className="block text-[11px] text-stone-500 mb-1">Kata sandi</label>
            <div className="relative">
              <input type={lihat ? 'text' : 'password'} value={sandi} autoComplete="current-password"
                onChange={(e) => { setSandi(e.target.value); setGalat(''); }}
                className="w-full border border-stone-300 rounded-md pl-3 pr-10 py-2.5 text-sm focus:border-teal-600 outline-none" />
              <button type="button" onClick={() => setLihat((v) => !v)}
                aria-label={lihat ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-stone-400 hover:text-stone-700">
                {lihat ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {galat && (
            <p className="text-[12px] bg-red-50 text-red-900 px-3 py-2 rounded flex items-start gap-1.5">
              <AlertTriangle size={14} className="mt-px shrink-0" /> {galat}
            </p>
          )}

          <button type="submit" disabled={proses || !email.trim() || !sandi}
            className="w-full px-4 py-2.5 bg-teal-700 text-white rounded-md hover:bg-teal-800 disabled:bg-stone-300 text-sm flex items-center justify-center gap-2">
            <LogIn size={16} /> {proses ? 'Memeriksa…' : 'Masuk'}
          </button>

          <p className="text-[11px] text-stone-500 text-center pt-1">
            Akun dibuatkan super user dan diserahkan saat serah terima jabatan.
            Kalau lupa sandi, hubungi super user untuk disetel ulang.
          </p>
        </form>
      </div>
    </div>
  );
}

// Ditampilkan saat pengguna masih memakai sandi bawaan dari serah terima jabatan.
export function GantiSandiAwal() {
  const { gantiSandi, keluar } = useAuth();
  const [lama, setLama] = useState('');
  const [baru, setBaru] = useState('');
  const [ulang, setUlang] = useState('');
  const [galat, setGalat] = useState('');
  const [proses, setProses] = useState(false);

  const cocok = baru.length >= 8 && baru === ulang;

  const kirim = async (e) => {
    e.preventDefault();
    setGalat('');
    setProses(true);
    try {
      await gantiSandi(lama, baru);
    } catch (err) {
      setGalat(err.code === 'auth/invalid-credential'
        ? 'Sandi lama tidak cocok.'
        : 'Gagal mengganti sandi. Coba lagi.');
    }
    setProses(false);
  };

  return (
    <div className="min-h-full bg-stone-100 flex items-start justify-center p-4 py-10 font-sans overflow-y-auto">
      <form onSubmit={kirim} className="w-full max-w-sm bg-white rounded-lg border border-stone-200 p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
            <KeyRound size={17} className="text-amber-800" />
          </span>
          <div>
            <h2 className="text-base font-medium">Ganti kata sandi</h2>
            <p className="text-[11px] text-stone-500">Wajib sebelum memakai aplikasi</p>
          </div>
        </div>

        <p className="text-[12px] bg-stone-50 text-stone-700 px-3 py-2 rounded">
          Akun ini masih memakai sandi bawaan. Ganti dengan sandi yang hanya Anda ketahui,
          minimal delapan karakter.
        </p>

        {[['Sandi lama', lama, setLama], ['Sandi baru', baru, setBaru], ['Ulangi sandi baru', ulang, setUlang]].map(([l, v, s]) => (
          <div key={l}>
            <label className="block text-[11px] text-stone-500 mb-1">{l}</label>
            <input type="password" value={v} onChange={(e) => s(e.target.value)}
              className="w-full border border-stone-300 rounded-md px-3 py-2.5 text-sm focus:border-teal-600 outline-none" />
          </div>
        ))}

        {baru && baru.length < 8 && <p className="text-[11px] text-amber-700">Sandi baru minimal delapan karakter.</p>}
        {ulang && baru !== ulang && <p className="text-[11px] text-red-700">Ulangan sandi belum sama.</p>}
        {galat && <p className="text-[12px] bg-red-50 text-red-900 px-3 py-2 rounded">{galat}</p>}

        <button type="submit" disabled={!lama || !cocok || proses}
          className="w-full px-4 py-2.5 bg-teal-700 text-white rounded-md hover:bg-teal-800 disabled:bg-stone-300 text-sm">
          {proses ? 'Menyimpan…' : 'Simpan sandi baru'}
        </button>
        <button type="button" onClick={keluar} className="w-full text-[12px] text-stone-500 hover:text-stone-800">
          Keluar
        </button>
      </form>
    </div>
  );
}
