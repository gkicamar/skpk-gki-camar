import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, setDoc, getDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { useAuth } from '../konteks/Auth.jsx';
import { SelBulan } from '../komponen/Dasar.jsx';
import { susunHierarki } from './Beranda.jsx';
import {
  rp, rpSingkat, periodeTP, labelBulanPendek, tanggalPanjang,
  tpBerjalan, jumlahBulan, hariIni,
} from '../util/format.js';
import {
  Plus, Pencil, Trash2, X, Save, ChevronDown, ChevronRight, Printer,
  Send, CheckCircle2, Undo2, Lock, CornerDownRight, EyeOff, Layers, Unlock,
} from 'lucide-react';

const STATUS = {
  draf:         { label: 'Draf',         warna: 'bg-stone-100 text-stone-700' },
  diajukan:     { label: 'Diajukan',     warna: 'bg-amber-50 text-amber-900' },
  dikembalikan: { label: 'Dikembalikan', warna: 'bg-red-50 text-red-900' },
  disetujui:    { label: 'Disetujui',    warna: 'bg-teal-50 text-teal-900' },
};

const idProgram = (tahun, bp) => `${tahun}_${bp}`;
const totalDok = (d) => (d?.baris || []).reduce((s, b) => s + jumlahBulan(b.bulan), 0);

export default function ProgramKerja({ beritahu }) {
  const { profil, peran, bpSaya } = useAuth();
  const [bpDaftar, setBpDaftar] = useState([]);
  const [tahun, setTahun] = useState(tpBerjalan());
  const [bpAktif, setBpAktif] = useState('');
  const [dok, setDok] = useState(null);
  const [memuat, setMemuat] = useState(true);
  const [buka, setBuka] = useState(null);
  const [formBaris, setFormBaris] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [hapus, setHapus] = useState(null);
  const [lalu, setLalu] = useState(null);
  const [serumpun, setSerumpun] = useState([]);

  const bulan = useMemo(() => periodeTP(tahun), [tahun]);

  useEffect(() => onSnapshot(collection(db, 'badanPelayanan'), (s) => {
    const d = s.docs.map((x) => ({ kode: x.id, ...x.data() })).filter((x) => x.aktif !== false);
    setBpDaftar(d);
    setBpAktif((v) => (v && d.some((x) => x.kode === v) ? v : (bpSaya[0] || d[0]?.kode || '')));
  }), [bpSaya]);

  const { divisi, anak } = useMemo(() => susunHierarki(bpDaftar), [bpDaftar]);
  const bpObj = bpDaftar.find((b) => b.kode === bpAktif);
  const indukObj = bpDaftar.find((b) => b.kode === bpObj?.divisi);

  useEffect(() => {
    if (!bpAktif) return;
    setMemuat(true);
    return onSnapshot(doc(db, 'programKerja', idProgram(tahun, bpAktif)), (s) => {
      setDok(s.exists() ? { id: s.id, ...s.data() } : null);
      setMemuat(false);
    }, () => setMemuat(false));
  }, [tahun, bpAktif]);

  useEffect(() => {
    if (!bpAktif) return;
    getDoc(doc(db, 'programKerja', idProgram(tahun - 1, bpAktif)))
      .then((s) => setLalu(s.exists() ? totalDok(s.data()) : null))
      .catch(() => setLalu(null));
  }, [tahun, bpAktif]);

  // Rekap satu divisi beserta departemen di bawahnya.
  const kodeDivisi = bpObj?.divisi || bpObj?.kode;
  const anggotaDivisi = useMemo(() => {
    if (!kodeDivisi) return [];
    const induk = bpDaftar.find((b) => b.kode === kodeDivisi);
    return induk ? [induk, ...anak(kodeDivisi)] : anak(kodeDivisi);
  }, [kodeDivisi, bpDaftar, anak]);

  useEffect(() => {
    if (anggotaDivisi.length < 2) { setSerumpun([]); return; }
    return onSnapshot(
      query(collection(db, 'programKerja'), where('tahunPelayanan', '==', tahun)),
      (s) => setSerumpun(s.docs.map((x) => ({ id: x.id, ...x.data() }))
        .filter((r) => anggotaDivisi.some((b) => b.kode === r.bp))),
      () => setSerumpun([]),
    );
  }, [tahun, anggotaDivisi]);

  const milikSaya = bpSaya.includes(bpAktif);
  const status = dok?.status || 'draf';
  const bolehSunting =
    peran === 'super'
    || (peran === 'pembina' && milikSaya)
    || (peran === 'pengurus' && milikSaya && ['draf', 'dikembalikan'].includes(status));
  const bolehVerifikasi = peran === 'super' || (peran === 'pembina' && milikSaya && status === 'diajukan');
  const bolehBukaKembali = (peran === 'super' || (peran === 'pembina' && milikSaya)) && status === 'disetujui';
  const bolehAjukan = peran === 'pengurus' && milikSaya && ['draf', 'dikembalikan'].includes(status);

  const baris = dok?.baris || [];
  const induk = baris.filter((b) => !b.indukId);
  const anakBaris = (id) => baris.filter((b) => b.indukId === id);
  const totalSendiri = (b) => jumlahBulan(b.bulan);
  const totalAnak = (b) => anakBaris(b.id).reduce((s, a) => s + jumlahBulan(a.bulan), 0);
  const totalBaris = (b) => totalSendiri(b) + totalAnak(b);
  const total = totalDok(dok);
  const totalRutin = induk.filter((b) => b.sifat === 'Rutin').reduce((s, b) => s + totalBaris(b), 0);

  const simpanDok = async (perubahan, pesan) => {
    await setDoc(doc(db, 'programKerja', idProgram(tahun, bpAktif)), {
      tahunPelayanan: tahun, bp: bpAktif,
      rahasia: bpObj?.rahasia === true,
      status: dok?.status || 'draf', baris: dok?.baris || [],
      ...perubahan,
      diperbarui: serverTimestamp(), diperbaruiOleh: profil?.nama || '',
    }, { merge: true });
    if (pesan) beritahu(pesan);
  };

  const simpanBaris = async (isi) => {
    const ada = baris.some((b) => b.id === isi.id);
    await simpanDok({ baris: ada ? baris.map((b) => (b.id === isi.id ? isi : b)) : [...baris, isi] },
      ada ? 'Kegiatan diperbarui' : 'Kegiatan ditambahkan');
    setFormBaris(null);
    setBuka(isi.indukId || isi.id);
  };

  const hapusBaris = async (b) => {
    const ikut = [b.id, ...anakBaris(b.id).map((a) => a.id)];
    await simpanDok({ baris: baris.filter((x) => !ikut.includes(x.id)) }, 'Kegiatan dihapus');
    setHapus(null);
  };

  const ubahBulan = async (barisId, periode, nilai) => {
    const baru = baris.map((b) => {
      if (b.id !== barisId) return b;
      const bl = { ...(b.bulan || {}) };
      if (nilai === null) delete bl[periode]; else bl[periode] = nilai;
      return { ...b, bulan: bl };
    });
    await simpanDok({ baris: baru });
  };

  const ajukan = async () => {
    if (baris.length === 0) return beritahu('Belum ada kegiatan untuk diajukan', 'info');
    await simpanDok({ status: 'diajukan', tglDiajukan: hariIni(), catatanPembina: '' },
      'Program kerja diajukan ke pembina');
  };

  const putuskan = async ({ jenis, catatan }) => {
    const riwayat = [...(dok?.riwayat || []), {
      tgl: hariIni(), oleh: profil?.nama || '', tindakan: jenis, catatan,
    }].slice(-20);
    await simpanDok({
      status: jenis === 'setuju' ? 'disetujui' : 'dikembalikan',
      catatanPembina: catatan, diverifikasiOleh: profil?.nama || '', tglVerifikasi: hariIni(), riwayat,
    }, jenis === 'setuju' ? 'Program kerja disetujui'
      : jenis === 'buka' ? 'Dibuka kembali, pengurus bisa merevisi'
      : 'Dikembalikan ke pengurus');
    setDialog(null);
  };

  const tahunPilihan = [tpBerjalan() - 1, tpBerjalan(), tpBerjalan() + 1];

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-10">
      <div className="bg-white rounded-lg border border-stone-200 p-4 flex flex-wrap gap-4 items-end no-print">
        <div className="min-w-[220px] flex-1">
          <label className="block text-[11px] text-stone-500 mb-1">Badan pelayanan</label>
          <select value={bpAktif} onChange={(e) => { setBpAktif(e.target.value); setBuka(null); }}
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm bg-white">
            {divisi.map((d) => (
              <optgroup key={d.kode} label={d.nama}>
                <option value={d.kode}>{d.nama}{bpSaya.includes(d.kode) ? ' · milik Anda' : ''}</option>
                {anak(d.kode).map((a) => (
                  <option key={a.kode} value={a.kode}>
                    {'\u00A0\u00A0'}{a.nama}{a.rahasia ? ' · rahasia' : ''}{bpSaya.includes(a.kode) ? ' · milik Anda' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-stone-500 mb-1">Tahun pelayanan</label>
          <select value={tahun} onChange={(e) => setTahun(Number(e.target.value))}
            className="border border-stone-300 rounded-md px-3 py-2 text-sm bg-white">
            {tahunPilihan.map((t) => <option key={t} value={t}>{t}–{t + 1}</option>)}
          </select>
        </div>
        <button onClick={() => window.print()}
          className="px-3 py-2 text-sm border border-stone-300 rounded-md hover:bg-stone-50 flex items-center gap-1.5">
          <Printer size={15} /> Cetak
        </button>
      </div>

      <div className="bg-white rounded-lg border border-stone-200 p-5 print-flat">
        <div className="flex flex-wrap justify-between items-start gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-medium">Rencana program kerja dan anggaran</h2>
            <p className="text-sm text-stone-600">
              {indukObj ? `${indukObj.nama} · ` : ''}{bpObj?.nama || bpAktif}
            </p>
            <p className="text-[11px] text-stone-500 mt-0.5">
              April {tahun} sampai Maret {tahun + 1}
              {!milikSaya && peran === 'pengurus' && ' · hanya dapat dilihat'}
            </p>
            {bpObj?.rahasia && (
              <p className="text-[11px] text-amber-800 mt-1 inline-flex items-center gap-1">
                <EyeOff size={12} /> Rahasia — badan pelayanan lain tidak dapat membukanya
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <span className={`text-[11px] px-2 py-1 rounded ${STATUS[status].warna}`}>{STATUS[status].label}</span>
            <p className="text-lg font-medium mt-1.5">{rp(total)}</p>
          </div>
        </div>

        {status === 'dikembalikan' && dok?.catatanPembina && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-md px-3 py-2.5 flex items-start gap-2">
            <Undo2 size={15} className="text-red-800 mt-0.5 shrink-0" />
            <div>
              <p className="text-[12px] font-medium text-red-900">Terbuka untuk direvisi</p>
              <p className="text-[12px] text-red-900 mt-0.5">{dok.catatanPembina}</p>
              <p className="text-[11px] text-red-800 mt-1">{dok.diverifikasiOleh} · {tanggalPanjang(dok.tglVerifikasi)}</p>
            </div>
          </div>
        )}

        {status === 'disetujui' && (
          <div className="mt-4 bg-teal-50 border border-teal-200 rounded-md px-3 py-2.5 flex items-start gap-2">
            <CheckCircle2 size={15} className="text-teal-800 mt-0.5 shrink-0" />
            <div>
              <p className="text-[12px] text-teal-900">
                Disetujui {dok?.diverifikasiOleh} pada {tanggalPanjang(dok?.tglVerifikasi)}.
                Uraian kegiatan di bawah menjadi dasar pengajuan PBO.
              </p>
              {dok?.catatanPembina && <p className="text-[12px] text-teal-900 mt-1">{dok.catatanPembina}</p>}
            </div>
          </div>
        )}

        {(bolehAjukan || bolehVerifikasi || bolehBukaKembali) && (
          <div className="mt-4 flex flex-wrap gap-2 no-print">
            {bolehAjukan && (
              <button onClick={ajukan}
                className="px-3 py-2 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800 flex items-center gap-1.5">
                <Send size={15} /> Ajukan ke pembina
              </button>
            )}
            {bolehVerifikasi && (
              <>
                <button onClick={() => setDialog({ jenis: 'setuju' })}
                  className="px-3 py-2 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800 flex items-center gap-1.5">
                  <CheckCircle2 size={15} /> Setujui
                </button>
                <button onClick={() => setDialog({ jenis: 'kembalikan' })}
                  className="px-3 py-2 text-sm border border-red-300 text-red-800 rounded-md hover:bg-red-50 flex items-center gap-1.5">
                  <Undo2 size={15} /> Kembalikan
                </button>
              </>
            )}
            {bolehBukaKembali && (
              <button onClick={() => setDialog({ jenis: 'buka' })}
                className="px-3 py-2 text-sm border border-amber-400 text-amber-900 rounded-md hover:bg-amber-50 flex items-center gap-1.5">
                <Unlock size={15} /> Buka kembali untuk revisi
              </button>
            )}
          </div>
        )}

        {dok?.riwayat?.length > 0 && (
          <details className="mt-4 no-print">
            <summary className="text-[11px] text-stone-500 cursor-pointer hover:text-stone-800">
              Riwayat verifikasi · {dok.riwayat.length} catatan
            </summary>
            <div className="mt-2 space-y-1.5 border-l-2 border-stone-200 pl-3">
              {dok.riwayat.slice().reverse().map((r, i) => (
                <div key={i}>
                  <p className="text-[11px] text-stone-500">
                    {tanggalPanjang(r.tgl)} · {r.oleh} ·{' '}
                    {r.tindakan === 'setuju' ? 'menyetujui' : r.tindakan === 'buka' ? 'membuka kembali' : 'mengembalikan'}
                  </p>
                  {r.catatan && <p className="text-[12px] text-stone-700">{r.catatan}</p>}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Kegiatan rutin', rp(totalRutin)],
          ['Kegiatan non rutin', rp(total - totalRutin)],
          ['Jumlah setahun', rp(total)],
          ['Periode sebelumnya', lalu === null ? 'belum ada data' : rp(lalu)],
        ].map(([l, v]) => (
          <div key={l} className="bg-white rounded-lg border border-stone-200 p-4">
            <p className="text-[11px] text-stone-500 mb-1">{l}</p>
            <p className="text-sm font-medium">{v}</p>
            {l === 'Periode sebelumnya' && lalu > 0 && (
              <p className={`text-[11px] mt-1 ${total - lalu < 0 ? 'text-teal-700' : 'text-amber-700'}`}>
                {total - lalu < 0 ? 'turun' : 'naik'} {rpSingkat(Math.abs(total - lalu))} ·{' '}
                {(((total - lalu) / lalu) * 100).toFixed(1).replace('.', ',')}%
              </p>
            )}
          </div>
        ))}
      </div>

      {serumpun.length > 1 && (
        <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100">
            <h3 className="text-sm font-medium flex items-center gap-1.5">
              <Layers size={15} className="text-stone-500" /> Satu divisi
            </h3>
            <p className="text-[11px] text-stone-500">Divisi beserta departemen di bawahnya</p>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {anggotaDivisi.map((b) => {
                const r = serumpun.find((x) => x.bp === b.kode);
                const st = STATUS[r?.status || 'draf'];
                return (
                  <tr key={b.kode} className={`border-b border-stone-50 ${b.kode === bpAktif ? 'bg-stone-50' : ''}`}>
                    <td className="px-4 py-2">
                      <button onClick={() => setBpAktif(b.kode)} className="text-left hover:text-teal-700">
                        {b.divisi ? '\u00A0\u00A0' : ''}{b.nama}
                        {b.rahasia && <EyeOff size={11} className="inline ml-1.5 text-amber-700" />}
                      </button>
                    </td>
                    <td className="px-4 py-2 w-32">
                      <span className={`text-[11px] px-1.5 py-0.5 rounded ${st.warna}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-2 text-right w-40">{r ? rp(totalDok(r)) : '—'}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-stone-800 bg-stone-50">
                <td className="px-4 py-2.5 font-medium" colSpan={2}>Jumlah satu divisi</td>
                <td className="px-4 py-2.5 text-right font-medium">
                  {rp(serumpun.reduce((s, r) => s + totalDok(r), 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white rounded-lg border border-stone-200 overflow-hidden print-flat">
        <div className="px-4 py-3 border-b border-stone-100 flex justify-between items-center gap-3">
          <div>
            <h3 className="text-sm font-medium">Kegiatan</h3>
            <p className="text-[11px] text-stone-500">
              Kegiatan tanpa anggaran tetap dicatat dengan tanda X supaya ikut dievaluasi
            </p>
          </div>
          {bolehSunting && (
            <button onClick={() => setFormBaris({ baru: true, indukId: null })}
              className="px-2.5 py-1.5 text-xs border border-stone-300 rounded-md hover:bg-stone-50 flex items-center gap-1 shrink-0 no-print">
              <Plus size={13} /> Kegiatan
            </button>
          )}
        </div>

        {memuat ? (
          <p className="px-4 py-12 text-center text-sm text-stone-500">Memuat…</p>
        ) : induk.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-stone-500 mb-1">Belum ada kegiatan tersusun.</p>
            <p className="text-[12px] text-stone-500">
              {bolehSunting ? 'Tekan tombol Kegiatan di atas untuk mulai menyusun.'
                : 'Badan pelayanan ini belum menyusun program kerjanya.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {induk.map((b) => (
              <Kegiatan key={b.id} baris={b} anak={anakBaris(b.id)} bulan={bulan}
                terbuka={buka === b.id} onBuka={() => setBuka(buka === b.id ? null : b.id)}
                sendiri={totalSendiri(b)} dariAnak={totalAnak(b)} total={totalBaris(b)}
                bolehSunting={bolehSunting} onUbahBulan={ubahBulan}
                onSunting={(x) => setFormBaris({ ...x, baru: false })}
                onTambahAnak={() => setFormBaris({ baru: true, indukId: b.id })}
                onHapus={setHapus} />
            ))}
            <div className="px-4 py-3 bg-stone-50 flex justify-between items-center">
              <p className="text-sm font-medium">Jumlah seluruh kegiatan</p>
              <p className="text-sm font-medium">{rp(total)}</p>
            </div>
          </div>
        )}
      </div>

      {!bolehSunting && milikSaya && status === 'diajukan' && (
        <p className="text-[12px] bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2.5 rounded flex items-start gap-1.5">
          <Lock size={14} className="mt-px shrink-0" />
          Sedang menunggu verifikasi pembina, jadi tidak bisa disunting.
        </p>
      )}
      {!bolehSunting && milikSaya && status === 'disetujui' && (
        <p className="text-[12px] bg-stone-50 border border-stone-200 text-stone-700 px-3 py-2.5 rounded flex items-start gap-1.5">
          <Lock size={14} className="mt-px shrink-0" />
          Sudah disetujui dan terkunci. Untuk menambah atau mengubah anggaran, minta pembina menekan
          Buka kembali untuk revisi.
        </p>
      )}

      {formBaris && <FormBaris isi={formBaris} bulan={bulan} onBatal={() => setFormBaris(null)} onSimpan={simpanBaris} />}
      {dialog && <DialogPutusan jenis={dialog.jenis} onBatal={() => setDialog(null)} onSimpan={putuskan} />}
      {hapus && (
        <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-sm p-5">
            <h3 className="text-base font-medium mb-1.5">Hapus kegiatan?</h3>
            <p className="text-sm text-stone-600 mb-4">
              {hapus.nama}{anakBaris(hapus.id).length > 0 && ` beserta ${anakBaris(hapus.id).length} sub kegiatannya`} akan dihapus.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setHapus(null)} className="px-3 py-2 text-sm border border-stone-300 rounded-md hover:bg-stone-50">Batal</button>
              <button onClick={() => hapusBaris(hapus)} className="px-3 py-2 text-sm bg-red-700 text-white rounded-md hover:bg-red-800">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────── Satu kegiatan ─────────── */

function Kegiatan({ baris, anak, bulan, terbuka, onBuka, sendiri, dariAnak, total, bolehSunting, onUbahBulan, onSunting, onTambahAnak, onHapus }) {
  return (
    <div>
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <button onClick={onBuka} className="mt-0.5 text-stone-400 hover:text-teal-700 shrink-0 no-print">
            {terbuka ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm">{baris.nama}</p>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                baris.sifat === 'Rutin' ? 'bg-stone-100 text-stone-700' : 'bg-blue-50 text-blue-900'}`}>
                {baris.sifat}
              </span>
            </div>
            {baris.tujuan && <p className="text-[12px] text-stone-600 mt-0.5">{baris.tujuan}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-medium">{total > 0 ? rp(total) : '—'}</p>
            {dariAnak > 0 && (
              <p className="text-[10px] text-stone-500">
                {sendiri > 0 ? `${rpSingkat(sendiri)} + ` : ''}{rpSingkat(dariAnak)} dari sub
              </p>
            )}
            {bolehSunting && (
              <div className="flex gap-0.5 justify-end mt-1 no-print">
                <button onClick={() => onSunting(baris)} className="p-1 text-stone-400 hover:text-teal-700"><Pencil size={13} /></button>
                <button onClick={() => onHapus(baris)} className="p-1 text-stone-400 hover:text-red-600"><Trash2 size={13} /></button>
              </div>
            )}
          </div>
        </div>

        {terbuka && (
          <div className="mt-3 ml-7 space-y-3">
            {baris.detail && <Rincian label="Detail pelaksanaan" isi={baris.detail} />}
            {baris.indikator && <Rincian label="Indikator hasil" isi={baris.indikator} />}
            {baris.jadwal && <Rincian label="Jadwal kegiatan" isi={baris.jadwal} />}
            <GridBulan bulan={bulan} nilai={baris.bulan} kunci={!bolehSunting}
              onUbah={(p, v) => onUbahBulan(baris.id, p, v)}
              catatan={anak.length > 0 ? 'Anggaran kegiatan induk, di luar sub kegiatan' : ''} />
            {bolehSunting && (
              <button onClick={onTambahAnak}
                className="text-[12px] px-2 py-1.5 rounded border border-dashed border-stone-300 text-stone-500 hover:border-teal-600 hover:text-teal-700 flex items-center gap-1 no-print">
                <CornerDownRight size={12} /> Tambah sub kegiatan
              </button>
            )}
          </div>
        )}
      </div>

      {anak.map((a) => (
        <div key={a.id} className="px-4 py-2.5 pl-11 bg-stone-50/60 border-t border-stone-100">
          <div className="flex items-start gap-3">
            <CornerDownRight size={13} className="text-stone-400 mt-1 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px]">{a.nama}</p>
              {a.tujuan && <p className="text-[11px] text-stone-600 mt-0.5">{a.tujuan}</p>}
              {terbuka && a.detail && <p className="text-[11px] text-stone-600 mt-1 whitespace-pre-line">{a.detail}</p>}
              {terbuka && (
                <div className="mt-2">
                  <GridBulan bulan={bulan} nilai={a.bulan} kunci={!bolehSunting}
                    onUbah={(p, v) => onUbahBulan(a.id, p, v)} />
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-[13px] font-medium">{jumlahBulan(a.bulan) > 0 ? rp(jumlahBulan(a.bulan)) : '—'}</p>
              {bolehSunting && (
                <div className="flex gap-0.5 justify-end mt-0.5 no-print">
                  <button onClick={() => onSunting(a)} className="p-1 text-stone-400 hover:text-teal-700"><Pencil size={12} /></button>
                  <button onClick={() => onHapus(a)} className="p-1 text-stone-400 hover:text-red-600"><Trash2 size={12} /></button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {anak.length > 0 && (
        <div className="px-4 py-2 pl-11 bg-stone-50 border-t border-stone-100 flex justify-between">
          <p className="text-[12px] text-stone-600">Jumlah kegiatan ini beserta sub kegiatannya</p>
          <p className="text-[12px] font-medium">{rp(total)}</p>
        </div>
      )}
    </div>
  );
}

function Rincian({ label, isi }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-stone-500 mb-0.5">{label}</p>
      <p className="text-[12px] text-stone-700 whitespace-pre-line">{isi}</p>
    </div>
  );
}

function GridBulan({ bulan, nilai = {}, kunci, onUbah, catatan }) {
  const total = jumlahBulan(nilai);
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5 gap-3">
        <p className="text-[10px] uppercase tracking-wider text-stone-500">
          Anggaran per bulan{catatan ? ` · ${catatan}` : ''}
        </p>
        {!kunci && <p className="text-[10px] text-stone-400">angka rupiah, atau X bila tanpa anggaran</p>}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5">
        {bulan.map((p) => (
          <div key={p}>
            <label className="block text-[9px] text-stone-500 mb-0.5">{labelBulanPendek(p)}</label>
            <SelBulan nilai={nilai[p]} kunci={kunci} onUbah={(v) => onUbah(p, v)} />
          </div>
        ))}
      </div>
      {total > 0 && <p className="text-[11px] text-stone-600 text-right mt-1.5">Jumlah {rp(total)}</p>}
    </div>
  );
}

/* ─────────── Formulir kegiatan ─────────── */

function FormBaris({ isi, bulan, onBatal, onSimpan }) {
  const anak = Boolean(isi.indukId);
  const [d, setD] = useState({
    id: isi.id || 'K' + Date.now(),
    indukId: isi.indukId ?? null,
    nama: isi.nama || '',
    sifat: isi.sifat || 'Rutin',
    tujuan: isi.tujuan || '',
    indikator: isi.indikator || '',
    jadwal: isi.jadwal || '',
    detail: isi.detail || '',
    bulan: isi.bulan || {},
  });

  const ubahBulan = (p, v) => setD((x) => {
    const bl = { ...x.bulan };
    if (v === null) delete bl[p]; else bl[p] = v;
    return { ...x, bulan: bl };
  });

  const total = jumlahBulan(d.bulan);

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-start md:items-center justify-center md:p-4 z-50 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl min-h-full md:min-h-0 md:my-6 md:rounded-lg">
        <div className="px-5 py-4 border-b border-stone-200 flex justify-between items-center">
          <h3 className="text-base font-medium">
            {isi.baru ? (anak ? 'Tambah sub kegiatan' : 'Tambah kegiatan') : 'Ubah kegiatan'}
          </h3>
          <button onClick={onBatal} className="text-stone-400 hover:text-stone-700"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] text-stone-500 mb-1">Nama kegiatan</label>
            <input value={d.nama} onChange={(e) => setD({ ...d, nama: e.target.value })}
              placeholder={anak ? 'Ultah 33 Tahun GKI Camar' : 'Perlengkapan Ibadah Kebaktian Umum'}
              className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm" />
          </div>

          {!anak && (
            <div>
              <label className="block text-[11px] text-stone-500 mb-1">Sifat</label>
              <select value={d.sifat} onChange={(e) => setD({ ...d, sifat: e.target.value })}
                className="w-full sm:w-48 border border-stone-300 rounded-md px-3 py-2 text-sm bg-white">
                <option>Rutin</option><option>Non Rutin</option>
              </select>
              <p className="text-[11px] text-stone-500 mt-1">
                Non rutin ditinjau ulang tiap tahun, apakah dijalankan lagi atau tidak
              </p>
            </div>
          )}

          <div>
            <label className="block text-[11px] text-stone-500 mb-1">Tujuan dan sasaran</label>
            <textarea value={d.tujuan} onChange={(e) => setD({ ...d, tujuan: e.target.value })} rows={2}
              placeholder="Apa yang hendak dicapai kegiatan ini"
              className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm resize-none" />
          </div>

          <div>
            <label className="block text-[11px] text-stone-500 mb-1">Detail pelaksanaan</label>
            <textarea value={d.detail} onChange={(e) => setD({ ...d, detail: e.target.value })} rows={3}
              placeholder="Rincian teknis atau satuan biaya, misalnya viatikum PF 550 ribu, transport luar Bekasi 300 ribu"
              className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm resize-none" />
          </div>

          {!anak && (
            <>
              <div>
                <label className="block text-[11px] text-stone-500 mb-1">Indikator hasil</label>
                <textarea value={d.indikator} onChange={(e) => setD({ ...d, indikator: e.target.value })} rows={3}
                  placeholder="Ukuran keberhasilan yang bisa diperiksa, misalnya kehadiran minimal 250 jemaat"
                  className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm resize-none" />
              </div>
              <div>
                <label className="block text-[11px] text-stone-500 mb-1">Jadwal kegiatan</label>
                <input value={d.jadwal} onChange={(e) => setD({ ...d, jadwal: e.target.value })}
                  placeholder="Setiap hari Minggu, Insidentil, atau Bulan Mei 2026"
                  className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm" />
              </div>
            </>
          )}

          <div className="border-t border-stone-200 pt-4">
            <GridBulan bulan={bulan} nilai={d.bulan} kunci={false} onUbah={ubahBulan} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-stone-200 flex flex-wrap gap-3 justify-between items-center sticky bottom-0 bg-white">
          <p className="text-[12px] text-stone-600">
            {total > 0 ? `Jumlah setahun ${rp(total)}` : 'Belum ada anggaran diisi'}
          </p>
          <div className="flex gap-2">
            <button onClick={onBatal} className="px-3 py-2 text-sm border border-stone-300 rounded-md hover:bg-stone-50">Batal</button>
            <button onClick={() => onSimpan(d)} disabled={!d.nama.trim()}
              className="px-4 py-2 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800 disabled:bg-stone-300 flex items-center gap-1.5">
              <Save size={15} /> Simpan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Putusan pembina ─────────── */

function DialogPutusan({ jenis, onBatal, onSimpan }) {
  const [catatan, setCatatan] = useState('');
  const perluAlasan = jenis !== 'setuju';
  const kurang = perluAlasan && catatan.trim().length < 15;

  const judul = { setuju: 'Setujui program kerja', kembalikan: 'Kembalikan ke pengurus', buka: 'Buka kembali untuk revisi' }[jenis];
  const isi = {
    setuju: 'Setelah disetujui, uraian kegiatan di dalamnya menjadi dasar pengajuan PBO. Pengurus tidak bisa mengubahnya lagi sampai dibuka kembali.',
    kembalikan: 'Jelaskan apa yang perlu diperbaiki, supaya pengurus tahu harus mengubah bagian mana.',
    buka: 'Program kerja kembali terbuka dan pengurus bisa menambah atau mengubah anggaran. Setelah selesai, mereka mengajukannya lagi untuk diverifikasi. Catat alasannya supaya perubahan tengah tahun ada jejaknya.',
  }[jenis];

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg w-full max-w-md p-5 my-auto">
        <h3 className="text-base font-medium mb-1.5">{judul}</h3>
        <p className="text-sm text-stone-600 mb-4">{isi}</p>
        <label className="block text-[11px] text-stone-500 mb-1">
          {jenis === 'setuju' ? 'Catatan untuk pengurus (opsional)' : 'Alasan'}
        </label>
        <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={3}
          placeholder={jenis === 'buka' ? 'Misalnya: penambahan anggaran Panitia Natal hasil rapat 12 Oktober'
            : jenis === 'setuju' ? 'Misalnya: anggaran konsumsi agar dipantau ketat' : 'Bagian mana yang perlu diperbaiki'}
          className={`w-full border rounded-md px-3 py-2 text-sm resize-none ${kurang && catatan ? 'border-red-300' : 'border-stone-300'}`} />
        {kurang && <p className="text-[11px] text-amber-700 mt-1">Alasan minimal lima belas huruf.</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onBatal} className="px-3 py-2 text-sm border border-stone-300 rounded-md hover:bg-stone-50">Batal</button>
          <button onClick={() => onSimpan({ jenis, catatan: catatan.trim() })} disabled={kurang}
            className={`px-4 py-2 text-sm text-white rounded-md disabled:bg-stone-300 ${
              jenis === 'setuju' ? 'bg-teal-700 hover:bg-teal-800'
                : jenis === 'buka' ? 'bg-amber-700 hover:bg-amber-800' : 'bg-red-700 hover:bg-red-800'}`}>
            {jenis === 'setuju' ? 'Setujui' : jenis === 'buka' ? 'Buka kembali' : 'Kembalikan'}
          </button>
        </div>
      </div>
    </div>
  );
}
