import React, { useState } from 'react';
import { CheckCircle2, Info, ShieldOff, Loader } from 'lucide-react';
import { useAuth } from './konteks/Auth.jsx';
import Masuk, { GantiSandiAwal } from './komponen/Masuk.jsx';
import Kerangka from './komponen/Kerangka.jsx';
import { Beranda, DataInduk } from './halaman/Beranda.jsx';
import KelolaPengguna from './halaman/KelolaPengguna.jsx';
import ProgramKerja from './halaman/ProgramKerja.jsx';
import { boleh } from './util/peran.js';

export default function App() {
  const { userAuth, profil, memuat, peran, aktif, keluar } = useAuth();
  const [tab, setTab] = useState('beranda');
  const [toast, setToast] = useState(null);

  const beritahu = (pesan, tipe = 'baik') => {
    setToast({ pesan, tipe });
    setTimeout(() => setToast(null), 3400);
  };

  if (memuat) {
    return (
      <div className="min-h-full flex items-center justify-center bg-stone-100 font-sans">
        <p className="text-sm text-stone-500 flex items-center gap-2">
          <Loader size={15} className="animate-spin" /> Memuat…
        </p>
      </div>
    );
  }

  if (!userAuth) return <Masuk />;

  // Sudah masuk lewat Firebase Authentication tetapi belum didaftarkan
  // di koleksi pengguna, atau akunnya dinonaktifkan.
  if (!profil || !aktif) {
    return (
      <div className="min-h-full flex items-center justify-center bg-stone-100 p-4 font-sans">
        <div className="bg-white rounded-lg border border-stone-200 p-6 max-w-sm text-center">
          <ShieldOff size={22} className="text-stone-400 mx-auto mb-3" />
          <h2 className="text-base font-medium mb-1.5">
            {profil ? 'Akun belum diaktifkan' : 'Akun belum terdaftar'}
          </h2>
          <p className="text-sm text-stone-600 mb-5">
            {profil
              ? 'Akun Anda ada tetapi belum diaktifkan super user.'
              : 'Email Anda sudah terdaftar di sistem masuk, tetapi peran dan badan pelayanannya belum ditetapkan.'}
            {' '}Hubungi super user untuk melanjutkan.
          </p>
          <button onClick={keluar}
            className="px-4 py-2 text-sm border border-stone-300 rounded-md hover:bg-stone-50">Keluar</button>
        </div>
      </div>
    );
  }

  if (profil.sandiAwal) return <GantiSandiAwal />;

  const layar = { beranda: 'beranda', pengguna: 'penggunaAkun', pengaturan: 'pengaturan' }[tab] || tab;
  const bolehMasuk = boleh(layar, peran);

  return (
    <>
      <Kerangka tab={tab} setTab={setTab}>
        {!bolehMasuk ? (
          <BelumBerhak />
        ) : tab === 'beranda' ? (
          <Beranda setTab={setTab} />
        ) : tab === 'programKerja' ? (
          <ProgramKerja beritahu={beritahu} />
        ) : tab === 'pengguna' ? (
          <KelolaPengguna beritahu={beritahu} />
        ) : tab === 'pengaturan' ? (
          <DataInduk beritahu={beritahu} />
        ) : (
          <BelumDibangun tab={tab} />
        )}
      </Kerangka>

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 no-print">
          <div className={`px-4 py-3 rounded-lg text-sm text-white flex items-center gap-2 ${
            toast.tipe === 'baik' ? 'bg-teal-800' : 'bg-stone-800'}`}>
            {toast.tipe === 'baik' ? <CheckCircle2 size={16} /> : <Info size={16} />} {toast.pesan}
          </div>
        </div>
      )}
    </>
  );
}

function BelumBerhak() {
  return (
    <div className="max-w-md mx-auto bg-white rounded-lg border border-stone-200 p-6 text-center">
      <ShieldOff size={20} className="text-stone-400 mx-auto mb-3" />
      <h3 className="text-base font-medium mb-1">Tidak tersedia untuk peran Anda</h3>
      <p className="text-sm text-stone-600">Bagian ini hanya dapat dibuka oleh Majelis Jemaat.</p>
    </div>
  );
}

const NAMA_LAYAR = {
  programKerja: 'Program kerja',
  pbo: 'PBO',
  lpj: 'LPJ',
  keuangan: 'Keuangan gereja',
  anggaran: 'Anggaran',
};

function BelumDibangun({ tab }) {
  return (
    <div className="max-w-md mx-auto bg-white rounded-lg border border-stone-200 p-6 text-center">
      <Info size={20} className="text-stone-400 mx-auto mb-3" />
      <h3 className="text-base font-medium mb-1">{NAMA_LAYAR[tab] || 'Bagian ini'} menyusul</h3>
      <p className="text-sm text-stone-600">
        Bagian pertama mencakup masuk, peran, kelola akun, dan data induk badan pelayanan.
        Program kerja, PBO, dan LPJ dikerjakan pada bagian berikutnya.
      </p>
    </div>
  );
}
