import React, { useState } from 'react';
import {
  Menu, X, Home, ClipboardList, HandCoins, FileText,
  Wallet, Target, Users, Settings, LogOut,
} from 'lucide-react';
import { Logo } from './Dasar.jsx';
import { useAuth } from '../konteks/Auth.jsx';
import { boleh, namaPeran, PERAN } from '../util/peran.js';

const MENU = [
  { id: 'beranda',      label: 'Beranda',         ikon: Home,          layar: 'beranda',      grup: 'Utama' },
  { id: 'programKerja', label: 'Program kerja',   ikon: ClipboardList, layar: 'programKerja', grup: 'Pelayanan' },
  { id: 'pbo',          label: 'PBO',             ikon: HandCoins,     layar: 'pbo',          grup: 'Pelayanan' },
  { id: 'lpj',          label: 'LPJ',             ikon: FileText,      layar: 'lpj',          grup: 'Pelayanan' },
  { id: 'keuangan',     label: 'Keuangan gereja', ikon: Wallet,        layar: 'keuangan',     grup: 'Majelis' },
  { id: 'anggaran',     label: 'Anggaran',        ikon: Target,        layar: 'anggaran',     grup: 'Majelis' },
  { id: 'pengguna',     label: 'Kelola akun',     ikon: Users,         layar: 'penggunaAkun', grup: 'Atur' },
  { id: 'pengaturan',   label: 'Data induk',      ikon: Settings,      layar: 'pengaturan',   grup: 'Atur' },
];

export default function Kerangka({ tab, setTab, children }) {
  const { profil, peran, keluar } = useAuth();
  const [buka, setBuka] = useState(false);

  const menu = MENU.filter((m) => boleh(m.layar, peran));
  const grup = [...new Set(menu.map((m) => m.grup))];
  const aktif = menu.find((m) => m.id === tab) || menu[0];

  return (
    <div className="flex h-full bg-stone-100 font-sans text-stone-900 overflow-hidden tabular-nums">
      {buka && (
        <div onClick={() => setBuka(false)}
          className="fixed inset-0 bg-stone-900/40 z-30 lg:hidden no-print" />
      )}

      <aside className={`w-60 bg-stone-900 text-stone-400 flex flex-col shrink-0 no-print fixed lg:static inset-y-0 left-0 z-40 transition-transform duration-200 ${buka ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="px-5 py-5 border-b border-stone-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Logo ukuran={28} />
            <div className="min-w-0">
              <h1 className="text-sm font-medium text-white leading-tight truncate">GKI Camar</h1>
              <p className="text-[11px] text-stone-500 truncate">Keuangan dan program kerja</p>
            </div>
          </div>
          <button onClick={() => setBuka(false)} aria-label="Tutup menu"
            className="lg:hidden text-stone-500 hover:text-white shrink-0"><X size={18} /></button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {grup.map((g) => (
            <div key={g}>
              <p className="px-5 pt-4 pb-1.5 text-[10px] uppercase tracking-wider text-stone-600">{g}</p>
              {menu.filter((m) => m.grup === g).map((m) => {
                const Ikon = m.ikon;
                return (
                  <button key={m.id} onClick={() => { setTab(m.id); setBuka(false); }}
                    className={`w-full text-left px-5 py-3 lg:py-2.5 flex items-center gap-3 text-sm ${
                      tab === m.id
                        ? 'bg-stone-800 text-white border-l-2 border-teal-500'
                        : 'border-l-2 border-transparent hover:bg-stone-800/50 hover:text-stone-200'
                    }`}>
                    <Ikon size={16} /> {m.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-stone-800">
          <p className="text-sm text-white truncate">{profil?.nama || '—'}</p>
          <p className="text-[11px] text-stone-500 mb-2.5">{namaPeran(peran)}</p>
          <button onClick={keluar}
            className="text-[12px] text-stone-400 hover:text-white flex items-center gap-1.5">
            <LogOut size={13} /> Keluar
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="bg-white border-b border-stone-200 px-4 lg:px-7 py-3 lg:py-3.5 flex justify-between items-center gap-3 shrink-0 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setBuka(true)} aria-label="Buka menu"
              className="lg:hidden p-2 -ml-2 text-stone-600 hover:text-stone-900 shrink-0"><Menu size={20} /></button>
            <div className="min-w-0">
              <h2 className="text-base font-medium truncate">{aktif?.label}</h2>
              <p className="text-xs text-stone-500 truncate">GKI Camar Bekasi</p>
            </div>
          </div>
          <span className={`text-[11px] px-2 py-1 rounded shrink-0 ${PERAN[peran]?.warna || 'bg-stone-100 text-stone-700'}`}>
            {namaPeran(peran)}
          </span>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 lg:p-7 print-scroll">
          {children}
        </div>
      </main>
    </div>
  );
}
