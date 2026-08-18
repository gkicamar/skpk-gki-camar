import React, { useEffect, useMemo, useState } from 'react';
import {
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { useAuth } from '../konteks/Auth.jsx';
import { DAFTAR_PERAN, PERAN, butuhBP, namaPeran } from '../util/peran.js';
import { susunHierarki } from './Beranda.jsx';
import {
  UserPlus, Pencil, Trash2, Search, ShieldCheck, ShieldOff, X, Save, Info, Copy, KeyRound,
} from 'lucide-react';

export default function KelolaPengguna({ beritahu }) {
  const { kirimSetelUlang } = useAuth();
  const [pengguna, setPengguna] = useState([]);
  const [bp, setBp] = useState([]);
  const [cari, setCari] = useState('');
  const [saring, setSaring] = useState('semua');
  const [form, setForm] = useState(null);
  const [konfirmasi, setKonfirmasi] = useState(null);
  const [konfirmasiSandi, setKonfirmasiSandi] = useState(null);

  useEffect(() => onSnapshot(collection(db, 'pengguna'), (s) =>
    setPengguna(s.docs.map((d) => ({ uid: d.id, ...d.data() })))), []);

  useEffect(() => onSnapshot(collection(db, 'badanPelayanan'), (s) =>
    setBp(s.docs.map((d) => ({ kode: d.id, ...d.data() })))), []);


  const daftar = useMemo(() => pengguna
    .filter((p) => saring === 'semua' || p.peran === saring)
    .filter((p) => (p.nama || '').toLowerCase().includes(cari.toLowerCase())
                || (p.email || '').toLowerCase().includes(cari.toLowerCase()))
    .sort((a, b) => {
      const u = ['super', 'ketua', 'bendahara', 'pembina', 'pengurus'];
      return u.indexOf(a.peran) - u.indexOf(b.peran) || (a.nama || '').localeCompare(b.nama || '');
    }), [pengguna, cari, saring]);

  const simpan = async (isi) => {
    const { uid, ...data } = isi;
    await setDoc(doc(db, 'pengguna', uid), {
      ...data,
      diperbarui: serverTimestamp(),
      ...(form?.baru ? { dibuat: serverTimestamp(), sandiAwal: true } : {}),
    }, { merge: true });
    setForm(null);
    beritahu(form?.baru ? 'Akun terdaftar di sistem' : 'Akun diperbarui');
  };

  const ubahAktif = async (p) => {
    await updateDoc(doc(db, 'pengguna', p.uid), { aktif: !p.aktif, diperbarui: serverTimestamp() });
    beritahu(p.aktif ? `${p.nama} dinonaktifkan` : `${p.nama} diaktifkan`);
  };

  const namaBP = (k) => bp.find((b) => b.kode === k)?.nama || k;

  // Kata sandi tersimpan teracak dan tidak bisa dibaca siapa pun, termasuk
  // super user. Yang bisa dilakukan hanya mengirim tautan setel ulang.
  const setelUlang = async (p) => {
    try {
      await kirimSetelUlang(p.email);
      beritahu(`Tautan setel ulang dikirim ke ${p.email}`);
    } catch (e) {
      beritahu('Gagal mengirim tautan. Periksa alamat emailnya.', 'info');
    }
    setKonfirmasiSandi(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-10">
      <div className="bg-white rounded-lg border border-stone-200 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={15} />
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama atau email…"
            className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-md text-sm" />
        </div>
        <select value={saring} onChange={(e) => setSaring(e.target.value)}
          className="border border-stone-300 rounded-md px-3 py-2 text-sm bg-white">
          <option value="semua">Semua peran</option>
          {DAFTAR_PERAN.map((p) => <option key={p.kode} value={p.kode}>{p.nama}</option>)}
        </select>
        <button onClick={() => setForm({ baru: true, uid: '', nama: '', email: '', peran: 'pengurus', bp: [], aktif: true })}
          className="px-3 py-2 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800 flex items-center gap-1.5">
          <UserPlus size={15} /> Daftarkan akun
        </button>
      </div>

      <p className="text-[12px] bg-stone-50 border border-stone-200 text-stone-700 px-3 py-2.5 rounded flex items-start gap-1.5">
        <Info size={14} className="mt-px shrink-0" />
        Akun dibuat dua langkah. Pertama buat email dan sandi di Firebase Console pada menu Authentication,
        lalu salin UID-nya ke sini beserta peran dan badan pelayanannya.
        Pakai alamat bertanda plus seperti gkicamar+bendahara@gmail.com supaya seluruh tautan setel ulang
        sandi masuk ke satu kotak surat yang Anda pegang.
      </p>

      <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-stone-500 border-b border-stone-200 bg-stone-50">
                <th className="text-left font-normal px-4 py-2.5">Nama dan email</th>
                <th className="text-left font-normal px-4 py-2.5 w-56">Peran</th>
                <th className="text-left font-normal px-4 py-2.5">Badan pelayanan</th>
                <th className="text-center font-normal px-4 py-2.5 w-24">Status</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {daftar.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-stone-500">
                  Belum ada akun terdaftar.
                </td></tr>
              )}
              {daftar.map((p) => (
                <tr key={p.uid} className={`border-b border-stone-50 ${p.aktif ? '' : 'bg-stone-50/60'}`}>
                  <td className="px-4 py-2.5">
                    <p className={p.aktif ? '' : 'text-stone-400'}>{p.nama || '—'}</p>
                    <p className="text-[11px] text-stone-500">{p.email}</p>
                    {p.sandiAwal && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800">masih sandi bawaan</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[11px] px-2 py-0.5 rounded ${PERAN[p.peran]?.warna || 'bg-stone-100'}`}>
                      {namaPeran(p.peran)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-stone-600 text-[13px]">
                    {butuhBP(p.peran)
                      ? (p.bp?.length ? p.bp.map(namaBP).join(', ') : <span className="text-amber-700">belum ditetapkan</span>)
                      : <span className="text-stone-400">seluruh gereja</span>}

                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button onClick={() => ubahAktif(p)} title={p.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                      className={`text-[11px] px-2 py-1 rounded inline-flex items-center gap-1 ${
                        p.aktif ? 'bg-teal-50 text-teal-800' : 'bg-stone-200 text-stone-600'}`}>
                      {p.aktif ? <ShieldCheck size={12} /> : <ShieldOff size={12} />}
                      {p.aktif ? 'aktif' : 'nonaktif'}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => setKonfirmasiSandi(p)} title="Kirim tautan setel ulang sandi"
                        className="p-1.5 text-stone-400 hover:text-amber-700"><KeyRound size={14} /></button>
                      <button onClick={() => setForm({ ...p, baru: false })}
                        className="p-1.5 text-stone-400 hover:text-teal-700"><Pencil size={14} /></button>
                      <button onClick={() => setKonfirmasi(p)}
                        className="p-1.5 text-stone-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {form && <FormAkun isi={form} bp={bp} onBatal={() => setForm(null)} onSimpan={simpan} />}

      {konfirmasiSandi && (
        <div className="fixed inset-0 bg-stone-900/40 flex items-start justify-center p-4 py-10 z-50 overflow-y-auto overscroll-contain">
          <div className="bg-white rounded-lg w-full max-w-sm p-5 my-auto mx-auto">
            <h3 className="text-base font-medium mb-1.5">Setel ulang kata sandi</h3>
            <p className="text-sm text-stone-600 mb-3">
              Tautan setel ulang akan dikirim ke {konfirmasiSandi.email}.
              Kata sandi tidak bisa dilihat siapa pun, termasuk Anda, jadi ini satu-satunya cara.
            </p>
            <p className="text-[12px] bg-stone-50 text-stone-700 px-3 py-2 rounded mb-4">
              Kalau alamat itu memakai tanda plus pada Gmail Anda, tautannya masuk ke kotak surat Anda sendiri
              dan tinggal diteruskan ke yang bersangkutan.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setKonfirmasiSandi(null)}
                className="px-3 py-2 text-sm border border-stone-300 rounded-md hover:bg-stone-50">Batal</button>
              <button onClick={() => setelUlang(konfirmasiSandi)}
                className="px-3 py-2 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800">Kirim tautan</button>
            </div>
          </div>
        </div>
      )}

      {konfirmasi && (
        <div className="fixed inset-0 bg-stone-900/40 flex items-start justify-center p-4 z-50 overflow-y-auto overscroll-contain">
          <div className="bg-white rounded-lg w-full max-w-sm p-5">
            <h3 className="text-base font-medium mb-1.5">Hapus akun dari sistem?</h3>
            <p className="text-sm text-stone-600 mb-4">
              {konfirmasi.nama} tidak lagi bisa masuk. Akun email di Firebase Authentication
              tetap ada dan perlu dihapus terpisah bila memang tidak dipakai lagi.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setKonfirmasi(null)}
                className="px-3 py-2 text-sm border border-stone-300 rounded-md hover:bg-stone-50">Batal</button>
              <button onClick={async () => {
                await deleteDoc(doc(db, 'pengguna', konfirmasi.uid));
                setKonfirmasi(null); beritahu('Akun dihapus dari sistem');
              }} className="px-3 py-2 text-sm bg-red-700 text-white rounded-md hover:bg-red-800">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormAkun({ isi, bp, onBatal, onSimpan }) {
  const [d, setD] = useState({ ...isi });
  const perluBP = butuhBP(d.peran);
  const sah = d.uid.trim().length > 12 && d.nama.trim() && d.email.trim() && (!perluBP || d.bp.length > 0);

  const alihBP = (kode) => setD((v) => ({
    ...v,
    bp: v.bp.includes(kode) ? v.bp.filter((x) => x !== kode) : [...v.bp, kode],
  }));

  const { divisi, anak } = susunHierarki(bp.filter((b) => b.aktif !== false));

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-start justify-center z-50 overflow-y-auto overscroll-contain">
      <div className="bg-white w-full max-w-lg my-0 md:my-8 md:rounded-lg">
        <div className="px-5 py-4 border-b border-stone-200 flex justify-between items-center">
          <h3 className="text-base font-medium">{isi.baru ? 'Daftarkan akun' : 'Ubah akun'}</h3>
          <button onClick={onBatal} className="text-stone-400 hover:text-stone-700"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {isi.baru && (
            <div className="bg-stone-50 rounded-md px-4 py-3 text-[12px] text-stone-700 space-y-1.5">
              <p className="font-medium flex items-center gap-1.5"><Copy size={13} /> Sebelum mengisi ini</p>
              <p>Buka Firebase Console, menu Authentication, tekan Add user. Isi email dan sandi awal.
                 Setelah tersimpan, salin nilai User UID dari daftar dan tempelkan di kolom pertama.</p>
            </div>
          )}

          <div>
            <label className="block text-[11px] text-stone-500 mb-1">User UID dari Firebase Authentication</label>
            <input value={d.uid} disabled={!isi.baru}
              onChange={(e) => setD({ ...d, uid: e.target.value.trim() })}
              placeholder="misalnya 3kJ9xQ2mNbRfT7wLpZ..."
              className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm font-mono disabled:bg-stone-100" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-stone-500 mb-1">Nama lengkap</label>
              <input value={d.nama} onChange={(e) => setD({ ...d, nama: e.target.value })}
                className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-[11px] text-stone-500 mb-1">Email</label>
              <input type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value.trim() })}
                className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-stone-500 mb-1.5">Peran</label>
            <div className="space-y-1.5">
              {DAFTAR_PERAN.map((p) => (
                <label key={p.kode}
                  className={`flex items-start gap-2.5 px-3 py-2 border rounded-md cursor-pointer ${
                    d.peran === p.kode ? 'border-teal-600 bg-teal-50' : 'border-stone-200 hover:bg-stone-50'}`}>
                  <input type="radio" name="peran" checked={d.peran === p.kode}
                    onChange={() => setD({ ...d, peran: p.kode, bp: butuhBP(p.kode) ? d.bp : [] })}
                    className="mt-0.5" />
                  <span className="min-w-0">
                    <span className="text-sm block">{p.nama}</span>
                    <span className="text-[11px] text-stone-500 block">{p.ringkas}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {perluBP && (
            <div>
              <label className="block text-[11px] text-stone-500 mb-1.5">
                {d.peran === 'pembina' ? 'Badan pelayanan yang dibina' : 'Badan pelayanan tempat bertugas'}
              </label>
              {bp.length === 0 ? (
                <p className="text-[12px] bg-amber-50 text-amber-900 px-3 py-2 rounded">
                  Daftar badan pelayanan masih kosong. Isi dulu di menu Data induk.
                </p>
              ) : (
                <div className="space-y-3">
                  {divisi.map((dv) => (
                    <div key={dv.kode}>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <button type="button" onClick={() => alihBP(dv.kode)}
                          className={`text-[12px] px-2.5 py-1.5 rounded-md border ${
                            d.bp.includes(dv.kode)
                              ? 'border-teal-600 bg-teal-50 text-teal-900'
                              : 'border-stone-300 hover:bg-stone-50'}`}>
                          {dv.nama}
                        </button>
                        {anak(dv.kode).length > 0 && (
                          <button type="button"
                            onClick={() => {
                              const semua = [dv.kode, ...anak(dv.kode).map((x) => x.kode)];
                              const lengkap = semua.every((k) => d.bp.includes(k));
                              setD((v) => ({
                                ...v,
                                bp: lengkap ? v.bp.filter((k) => !semua.includes(k))
                                  : [...new Set([...v.bp, ...semua])],
                              }));
                            }}
                            className="text-[11px] px-2 py-1 text-stone-500 hover:text-teal-700 underline">
                            pilih se-divisi
                          </button>
                        )}
                      </div>
                      {anak(dv.kode).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5 pl-4">
                          {anak(dv.kode).map((a) => (
                            <button key={a.kode} type="button" onClick={() => alihBP(a.kode)}
                              className={`text-[12px] px-2.5 py-1.5 rounded-md border ${
                                d.bp.includes(a.kode)
                                  ? 'border-teal-600 bg-teal-50 text-teal-900'
                                  : 'border-stone-300 hover:bg-stone-50'}`}>
                              {a.nama}{a.rahasia ? ' · rahasia' : ''}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {d.bp.length === 0 && bp.length > 0 && (
                <p className="text-[11px] text-amber-700 mt-1.5">Pilih sedikitnya satu badan pelayanan.</p>
              )}
            </div>
          )}

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={d.aktif} onChange={(e) => setD({ ...d, aktif: e.target.checked })} />
            <span className="text-sm">Akun aktif dan boleh masuk</span>
          </label>
        </div>

        <div className="px-5 py-4 border-t border-stone-200 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onBatal} className="px-3 py-2 text-sm border border-stone-300 rounded-md hover:bg-stone-50">Batal</button>
          <button onClick={() => onSimpan({ uid: d.uid, nama: d.nama.trim(), email: d.email, peran: d.peran, bp: d.bp, aktif: d.aktif })}
            disabled={!sah}
            className="px-4 py-2 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800 disabled:bg-stone-300 flex items-center gap-1.5">
            <Save size={15} /> Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
