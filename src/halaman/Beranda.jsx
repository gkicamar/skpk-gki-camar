import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { useAuth } from '../konteks/Auth.jsx';
import { majelis, namaPeran } from '../util/peran.js';
import {
  Plus, Pencil, Trash2, X, Save, Info, ClipboardList, HandCoins, FileText,
  EyeOff, CornerDownRight, Building2,
} from 'lucide-react';

// Divisi berdiri sendiri tanpa induk. Departemen selalu punya induk divisi.
export const JENIS_DIVISI = ['Bidang', 'Struktural'];
export const JENIS_DEPARTEMEN = ['Komisi', 'Wilayah', 'Sub Bidang', 'Pokja', 'Panitia', 'Lainnya'];

export function susunHierarki(bp) {
  const divisi = bp.filter((b) => !b.divisi).sort((a, b) => (a.urut || 99) - (b.urut || 99));
  const anak = (kode) => bp.filter((b) => b.divisi === kode).sort((a, b) => (a.urut || 99) - (b.urut || 99));
  const yatim = bp.filter((b) => b.divisi && !bp.some((x) => x.kode === b.divisi));
  return { divisi, anak, yatim };
}

/* ═══════════════ BERANDA ═══════════════ */

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
          sendiri, dan program kerja badan pelayanan lain yang tidak ditandai rahasia.
        </p>
      )}
    </div>
  );
}

/* ═══════════════ DATA INDUK ═══════════════ */

export function DataInduk({ beritahu }) {
  const [bp, setBp] = useState([]);
  const [form, setForm] = useState(null);
  const [hapus, setHapus] = useState(null);

  useEffect(() => onSnapshot(collection(db, 'badanPelayanan'), (s) =>
    setBp(s.docs.map((d) => ({ kode: d.id, ...d.data() })))), []);

  const { divisi, anak, yatim } = useMemo(() => susunHierarki(bp), [bp]);

  const simpan = async (d) => {
    await setDoc(doc(db, 'badanPelayanan', d.kode), {
      nama: d.nama.trim(), jenis: d.jenis, divisi: d.divisi || '',
      rahasia: d.rahasia === true, urut: Number(d.urut) || 99,
      aktif: d.aktif, diperbarui: serverTimestamp(),
    }, { merge: true });
    setForm(null);
    beritahu('Badan pelayanan tersimpan');
  };

  const baris = (b, dalam) => (
    <div key={b.kode} className={`px-4 py-2.5 flex justify-between items-center gap-3 ${dalam ? 'pl-10 bg-stone-50/60' : ''}`}>
      <div className="min-w-0 flex items-start gap-2">
        {dalam && <CornerDownRight size={13} className="text-stone-400 mt-1 shrink-0" />}
        <div className="min-w-0">
          <p className={`text-sm truncate flex items-center gap-2 ${b.aktif === false ? 'text-stone-400' : ''}`}>
            {b.nama}
            {b.rahasia && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 inline-flex items-center gap-1 shrink-0">
                <EyeOff size={9} /> rahasia
              </span>
            )}
          </p>
          <p className="text-[11px] text-stone-500">
            {b.kode} · {b.jenis}{b.aktif === false ? ' · nonaktif' : ''}
          </p>
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <button onClick={() => setForm({ ...b, baru: false })}
          className="p-1.5 text-stone-400 hover:text-teal-700"><Pencil size={14} /></button>
        <button onClick={() => setHapus(b)}
          className="p-1.5 text-stone-400 hover:text-red-600"><Trash2 size={14} /></button>
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-10">
      <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-100 flex justify-between items-center gap-3">
          <div>
            <h3 className="text-sm font-medium">Badan pelayanan</h3>
            <p className="text-[11px] text-stone-500">Divisi di tingkat atas, departemen di bawahnya</p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => setForm({ baru: true, kode: '', nama: '', jenis: 'Bidang', divisi: '', rahasia: false, urut: divisi.length + 1, aktif: true })}
              className="px-2.5 py-1.5 text-xs border border-stone-300 rounded-md hover:bg-stone-50 flex items-center gap-1">
              <Building2 size={13} /> Divisi
            </button>
            <button onClick={() => setForm({ baru: true, kode: '', nama: '', jenis: 'Komisi', divisi: divisi[0]?.kode || '', rahasia: false, urut: bp.length + 1, aktif: true })}
              disabled={divisi.length === 0}
              className="px-2.5 py-1.5 text-xs border border-stone-300 rounded-md hover:bg-stone-50 disabled:opacity-40 flex items-center gap-1">
              <Plus size={13} /> Departemen
            </button>
          </div>
        </div>

        {bp.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-stone-500 mb-1">Belum ada badan pelayanan.</p>
            <p className="text-[12px] text-stone-500">Mulai dengan menambahkan divisi, baru departemen di bawahnya.</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {divisi.map((d) => (
              <div key={d.kode}>
                {baris(d, false)}
                {anak(d.kode).map((a) => baris(a, true))}
              </div>
            ))}
            {yatim.length > 0 && (
              <div>
                <p className="px-4 pt-3 pb-1 text-[11px] text-amber-800">
                  Induk divisinya tidak ditemukan, perlu diperbaiki
                </p>
                {yatim.map((a) => baris(a, true))}
              </div>
            )}
          </div>
        )}

        <div className="px-4 py-3 border-t border-stone-100 bg-stone-50">
          <p className="text-[11px] text-stone-600">
            Divisi yang belum punya departemen tetap bisa menyusun program kerja sendiri.
            Kalau nanti tumbuh departemen, tinggal ditambahkan tanpa mengubah yang sudah ada.
          </p>
        </div>
      </div>

      {form && <FormBP isi={form} bp={bp} divisi={divisi} onBatal={() => setForm(null)} onSimpan={simpan} />}

      {hapus && (
        <div className="fixed inset-0 bg-stone-900/40 flex items-start justify-center p-4 z-50 overflow-y-auto overscroll-contain">
          <div className="bg-white rounded-lg w-full max-w-sm p-5">
            <h3 className="text-base font-medium mb-1.5">Hapus badan pelayanan?</h3>
            <p className="text-sm text-stone-600 mb-4">
              {hapus.nama} akan hilang dari daftar pilihan.
              {anak(hapus.kode).length > 0 && ` Ada ${anak(hapus.kode).length} departemen di bawahnya yang akan kehilangan induk.`}
              {' '}Untuk yang sudah tidak berjalan, sebaiknya dinonaktifkan saja supaya riwayatnya tetap ada.
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

function FormBP({ isi, bp, divisi, onBatal, onSimpan }) {
  const [d, setD] = useState({ divisi: '', rahasia: false, ...isi });
  const departemen = Boolean(d.divisi);
  const bentrok = isi.baru && d.kode && bp.some((b) => b.kode === d.kode.toUpperCase());
  const sah = d.kode.trim() && d.nama.trim() && !bentrok;
  const pilihanJenis = departemen ? JENIS_DEPARTEMEN : JENIS_DIVISI;

  const ubahInduk = (kode) => setD((v) => ({
    ...v,
    divisi: kode,
    jenis: kode ? (JENIS_DEPARTEMEN.includes(v.jenis) ? v.jenis : 'Komisi')
      : (JENIS_DIVISI.includes(v.jenis) ? v.jenis : 'Bidang'),
  }));

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-start justify-center z-50 overflow-y-auto overscroll-contain">
      <div className="bg-white w-full max-w-md my-0 md:my-8 md:rounded-lg">
        <div className="px-5 py-4 border-b border-stone-200 flex justify-between items-center">
          <h3 className="text-base font-medium">
            {isi.baru ? (departemen ? 'Tambah departemen' : 'Tambah divisi') : 'Ubah badan pelayanan'}
          </h3>
          <button onClick={onBatal} className="text-stone-400 hover:text-stone-700"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] text-stone-500 mb-1">Induk divisi</label>
            <select value={d.divisi} onChange={(e) => ubahInduk(e.target.value)}
              className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm bg-white">
              <option value="">Tidak ada — ini sebuah divisi</option>
              {divisi.filter((x) => x.kode !== d.kode).map((x) => (
                <option key={x.kode} value={x.kode}>{x.nama}</option>
              ))}
            </select>
            <p className="text-[11px] text-stone-500 mt-1">
              {departemen
                ? 'Departemen punya pengurus sendiri dan mengajukan PBO sendiri'
                : 'Divisi berada di tingkat atas, boleh punya departemen atau berdiri sendiri'}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-stone-500 mb-1">Kode</label>
              <input value={d.kode} disabled={!isi.baru}
                onChange={(e) => setD({ ...d, kode: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 14) })}
                placeholder={departemen ? 'SB-PERSONALIA' : 'BID-SARPEN'}
                className={`w-full border rounded-md px-3 py-2 text-sm font-mono disabled:bg-stone-100 ${bentrok ? 'border-red-400' : 'border-stone-300'}`} />
              {bentrok && <p className="text-[11px] text-red-700 mt-1">sudah dipakai</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] text-stone-500 mb-1">Nama</label>
              <input value={d.nama} onChange={(e) => setD({ ...d, nama: e.target.value })}
                placeholder={departemen ? 'Sub Bidang Personalia' : 'Bidang Sarana Penunjang'}
                className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-stone-500 mb-1">Jenis</label>
              <select value={d.jenis} onChange={(e) => setD({ ...d, jenis: e.target.value })}
                className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm bg-white">
                {pilihanJenis.map((j) => <option key={j}>{j}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-stone-500 mb-1">Urutan tampil</label>
              <input type="number" value={d.urut} onChange={(e) => setD({ ...d, urut: e.target.value })}
                className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm" />
            </div>
          </div>

          <label className={`flex items-start gap-2.5 cursor-pointer px-3 py-2.5 rounded-md border ${
            d.rahasia ? 'border-amber-300 bg-amber-50' : 'border-stone-200'}`}>
            <input type="checkbox" checked={d.rahasia === true}
              onChange={(e) => setD({ ...d, rahasia: e.target.checked })} className="mt-0.5" />
            <span className="min-w-0">
              <span className="text-sm block">Tandai rahasia</span>
              <span className="text-[11px] text-stone-600 block mt-0.5">
                Program kerja, PBO, dan LPJ hanya terbuka bagi pengurusnya sendiri, pembinanya,
                bendahara, ketua, dan super user. Badan pelayanan lain di divisi yang sama pun tidak bisa.
                Pakai untuk remunerasi, JKH, dan gaji karyawan.
              </span>
            </span>
          </label>

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
