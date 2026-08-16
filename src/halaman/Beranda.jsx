import React, { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { useAuth } from '../konteks/Auth.jsx';
import { majelis, namaPeran } from '../util/peran.js';
import { Plus, Pencil, Trash2, X, Save, Info, Users, ClipboardList, HandCoins, FileText } from 'lucide-react';

export function Beranda({ setTab }) {
  const { profil, peran, bpSaya } = useAuth();
  const [bp, setBp] = useState([]);

  useEffect(() => onSnapshot(collection(db, 'badanPelayanan'), (s) =>
    setBp(s.docs.map((d) => ({ kode: d.id, ...d.data() })))), []);

  const namaBP = (k) => bp.find((b) => b.kode === k)?.nama || k;
  const milik = bpSaya.map(namaBP);

  const langkah = peran === 'pengurus' ? [
    { ikon: ClipboardList, judul: 'Susun program kerja', isi: 'Daftar kegiatan setahun beserta rencana biaya per bulan. Diverifikasi pembina sebelum bisa dipakai.', tab: 'programKerja' },
    { ikon: HandCoins, judul: 'Ajukan PBO', isi: 'Uraiannya diambil dari program kerja yang sudah disetujui. Diverifikasi bendahara.', tab: 'pbo' },
    { ikon: FileText, judul: 'Laporkan LPJ', isi: 'Biaya terpakai, sisa, evaluasi, dan foto nota. LPJ bulan lalu harus masuk sebelum PBO baru.', tab: 'lpj' },
  ] : [
    { ikon: ClipboardList, judul: 'Verifikasi program kerja', isi: 'Periksa dan sahkan rencana badan pelayanan sebelum tahun pelayanan berjalan.', tab: 'programKerja' },
    { ikon: HandCoins, judul: 'Verifikasi PBO', isi: 'Periksa pengajuan bulanan terhadap program kerja dan sisa pagu.', tab: 'pbo' },
    { ikon: FileText, judul: 'Verifikasi LPJ', isi: 'Cocokkan realisasi, sisa yang dikembalikan, dan kelengkapan bukti.', tab: 'lpj' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-10">
      <div className="bg-white rounded-lg border border-stone-200 p-5">
        <p className="text-[11px] text-stone-500">Selamat datang</p>
        <h2 className="text-lg font-medium">{profil?.nama}</h2>
        <p className="text-sm text-stone-600 mt-0.5">{namaPeran(peran)}</p>
        {milik.length > 0 && (
          <p className="text-[12px] text-stone-500 mt-2">
            {peran === 'pembina' ? 'Membina' : 'Bertugas di'} {milik.join(', ')}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {langkah.map((l) => {
          const Ikon = l.ikon;
          return (
            <button key={l.judul} onClick={() => setTab(l.tab)}
              className="bg-white rounded-lg border border-stone-200 p-4 text-left hover:border-stone-300">
              <Ikon size={18} className="text-teal-700 mb-2.5" />
              <p className="text-sm font-medium">{l.judul}</p>
              <p className="text-[12px] text-stone-600 mt-1">{l.isi}</p>
            </button>
          );
        })}
      </div>

      {!majelis(peran) && (
        <p className="text-[12px] bg-stone-50 border border-stone-200 text-stone-700 px-3 py-2.5 rounded flex items-start gap-1.5">
          <Info size={14} className="mt-px shrink-0" />
          Posisi keuangan gereja hanya dapat dilihat Majelis Jemaat. Anda melihat data badan pelayanan
          sendiri, dan program kerja badan pelayanan lain sebagai bahan belajar.
        </p>
      )}
    </div>
  );
}

// Data induk badan pelayanan. Hanya super user yang boleh mengubah.
export function DataInduk({ beritahu }) {
  const [bp, setBp] = useState([]);
  const [form, setForm] = useState(null);
  const [hapus, setHapus] = useState(null);

  useEffect(() => onSnapshot(collection(db, 'badanPelayanan'), (s) =>
    setBp(s.docs.map((d) => ({ kode: d.id, ...d.data() })).sort((a, b) => a.urut - b.urut))), []);

  const simpan = async (d) => {
    await setDoc(doc(db, 'badanPelayanan', d.kode), {
      nama: d.nama, jenis: d.jenis, urut: Number(d.urut) || 99,
      aktif: d.aktif, diperbarui: serverTimestamp(),
    }, { merge: true });
    setForm(null);
    beritahu('Badan pelayanan tersimpan');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-10">
      <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-100 flex justify-between items-center gap-3">
          <div>
            <h3 className="text-sm font-medium">Badan pelayanan</h3>
            <p className="text-[11px] text-stone-500">Dasar seluruh program kerja, PBO, dan LPJ</p>
          </div>
          <button onClick={() => setForm({ baru: true, kode: '', nama: '', jenis: 'Komisi', urut: bp.length + 1, aktif: true })}
            className="px-2.5 py-1.5 text-xs border border-stone-300 rounded-md hover:bg-stone-50 flex items-center gap-1 shrink-0">
            <Plus size={13} /> Tambah
          </button>
        </div>

        {bp.length === 0 ? (
          <p className="px-4 py-12 text-sm text-stone-500 text-center">
            Belum ada badan pelayanan. Tambahkan dulu sebelum mendaftarkan akun pengurus.
          </p>
        ) : (
          <div className="divide-y divide-stone-50">
            {bp.map((b) => (
              <div key={b.kode} className="px-4 py-2.5 flex justify-between items-center gap-3">
                <div className="min-w-0">
                  <p className={`text-sm truncate ${b.aktif ? '' : 'text-stone-400'}`}>{b.nama}</p>
                  <p className="text-[11px] text-stone-500">{b.kode} · {b.jenis}{b.aktif ? '' : ' · nonaktif'}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setForm({ ...b, baru: false })}
                    className="p-1.5 text-stone-400 hover:text-teal-700"><Pencil size={14} /></button>
                  <button onClick={() => setHapus(b)}
                    className="p-1.5 text-stone-400 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {form && <FormBP isi={form} adaKode={bp.map((b) => b.kode)} onBatal={() => setForm(null)} onSimpan={simpan} />}

      {hapus && (
        <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-sm p-5">
            <h3 className="text-base font-medium mb-1.5">Hapus badan pelayanan?</h3>
            <p className="text-sm text-stone-600 mb-4">
              {hapus.nama} akan hilang dari daftar pilihan. Program kerja, PBO, dan LPJ lama tetap tersimpan.
              Untuk badan pelayanan yang sudah tidak berjalan, sebaiknya dinonaktifkan saja, bukan dihapus.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setHapus(null)} className="px-3 py-2 text-sm border border-stone-300 rounded-md hover:bg-stone-50">Batal</button>
              <button onClick={async () => { await deleteDoc(doc(db, 'badanPelayanan', hapus.kode)); setHapus(null); beritahu('Badan pelayanan dihapus'); }}
                className="px-3 py-2 text-sm bg-red-700 text-white rounded-md hover:bg-red-800">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormBP({ isi, adaKode, onBatal, onSimpan }) {
  const [d, setD] = useState({ ...isi });
  const bentrok = isi.baru && d.kode && adaKode.includes(d.kode.toUpperCase());
  const sah = d.kode.trim() && d.nama.trim() && !bentrok;

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-start md:items-center justify-center md:p-4 z-50 overflow-y-auto">
      <div className="bg-white w-full max-w-md min-h-full md:min-h-0 md:my-6 md:rounded-lg">
        <div className="px-5 py-4 border-b border-stone-200 flex justify-between items-center">
          <h3 className="text-base font-medium">{isi.baru ? 'Tambah badan pelayanan' : 'Ubah badan pelayanan'}</h3>
          <button onClick={onBatal} className="text-stone-400 hover:text-stone-700"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-stone-500 mb-1">Kode</label>
              <input value={d.kode} disabled={!isi.baru}
                onChange={(e) => setD({ ...d, kode: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12) })}
                placeholder="BID-PO"
                className={`w-full border rounded-md px-3 py-2 text-sm font-mono disabled:bg-stone-100 ${bentrok ? 'border-red-400' : 'border-stone-300'}`} />
              {bentrok && <p className="text-[11px] text-red-700 mt-1">sudah dipakai</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] text-stone-500 mb-1">Nama</label>
              <input value={d.nama} onChange={(e) => setD({ ...d, nama: e.target.value })}
                placeholder="Bidang Persekutuan dan Organisasi"
                className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-stone-500 mb-1">Jenis</label>
              <select value={d.jenis} onChange={(e) => setD({ ...d, jenis: e.target.value })}
                className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm bg-white">
                {['Bidang', 'Komisi', 'Wilayah', 'Struktural', 'Lainnya'].map((j) => <option key={j}>{j}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-stone-500 mb-1">Urutan tampil</label>
              <input type="number" value={d.urut} onChange={(e) => setD({ ...d, urut: e.target.value })}
                className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm" />
            </div>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={d.aktif} onChange={(e) => setD({ ...d, aktif: e.target.checked })} />
            <span className="text-sm">Aktif pada tahun pelayanan berjalan</span>
          </label>
        </div>
        <div className="px-5 py-4 border-t border-stone-200 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onBatal} className="px-3 py-2 text-sm border border-stone-300 rounded-md hover:bg-stone-50">Batal</button>
          <button onClick={() => onSimpan({ ...d, kode: d.kode.toUpperCase() })} disabled={!sah}
            className="px-4 py-2 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800 disabled:bg-stone-300 flex items-center gap-1.5">
            <Save size={15} /> Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
