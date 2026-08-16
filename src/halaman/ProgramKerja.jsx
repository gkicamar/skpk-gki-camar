import React, { useEffect, useMemo, useState } from 'react';
import {
  collection, doc, onSnapshot, setDoc, getDoc, serverTimestamp, addDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { useAuth } from '../konteks/Auth.jsx';
import { majelis } from '../util/peran.js';
import {
  rp, rpSingkat, periodeTP, labelBulanPendek, labelPeriode, tanggalPanjang,
  tpBerjalan, bacaNilaiBulan, tulisNilaiBulan, jumlahBulan, hariIni,
} from '../util/format.js';
import {
  Plus, Pencil, Trash2, X, Save, Info, ChevronDown, ChevronRight, Printer,
  Send, CheckCircle2, Undo2, AlertTriangle, Lock, CornerDownRight, Copy,
} from 'lucide-react';

const STATUS = {
  draf:        { label: 'Draf',        warna: 'bg-stone-100 text-stone-700' },
  diajukan:    { label: 'Diajukan',    warna: 'bg-amber-50 text-amber-900' },
  dikembalikan:{ label: 'Dikembalikan',warna: 'bg-red-50 text-red-900' },
  disetujui:   { label: 'Disetujui',   warna: 'bg-teal-50 text-teal-900' },
};

const idProgram = (tahun, bp) => `${tahun}_${bp}`;

export default function ProgramKerja({ beritahu }) {
  const { profil, peran, bpSaya } = useAuth();
  const [bpDaftar, setBpDaftar] = useState([]);
  const [tahun, setTahun] = useState(tpBerjalan());
  const [bpAktif, setBpAktif] = useState('');
  const [dok, setDok] = useState(null);
  const [memuat, setMemuat] = useState(true);
  const [buka, setBuka] = useState(null);
  const [formBaris, setFormBaris] = useState(null);
  const [dialogVerifikasi, setDialogVerifikasi] = useState(null);
  const [hapus, setHapus] = useState(null);
  const [lalu, setLalu] = useState(null);

  const bulan = useMemo(() => periodeTP(tahun), [tahun]);

  useEffect(() => onSnapshot(collection(db, 'badanPelayanan'), (s) => {
    const d = s.docs.map((x) => ({ kode: x.id, ...x.data() }))
      .filter((x) => x.aktif !== false)
      .sort((a, b) => (a.urut || 99) - (b.urut || 99));
    setBpDaftar(d);
    setBpAktif((v) => v || (bpSaya[0] || d[0]?.kode || ''));
  }), [bpSaya]);

  useEffect(() => {
    if (!bpAktif) return;
    setMemuat(true);
    return onSnapshot(doc(db, 'programKerja', idProgram(tahun, bpAktif)), (s) => {
      setDok(s.exists() ? { id: s.id, ...s.data() } : null);
      setMemuat(false);
    }, () => setMemuat(false));
  }, [tahun, bpAktif]);

  // Total tahun lalu dipakai sebagai pembanding di kaki halaman.
  useEffect(() => {
    if (!bpAktif) return;
    getDoc(doc(db, 'programKerja', idProgram(tahun - 1, bpAktif)))
      .then((s) => setLalu(s.exists() ? totalDok(s.data()) : null))
      .catch(() => setLalu(null));
  }, [tahun, bpAktif]);

  const bpObj = bpDaftar.find((b) => b.kode === bpAktif);
  const milikSaya = bpSaya.includes(bpAktif);
  const status = dok?.status || 'draf';

  // Pengurus hanya boleh menyunting milik sendiri saat masih draf atau dikembalikan.
  // Pembina boleh menyunting binaannya kapan saja. Super user bebas.
  const bolehSunting =
    peran === 'super'
    || (peran === 'pembina' && milikSaya)
    || (peran === 'pengurus' && milikSaya && ['draf', 'dikembalikan'].includes(status));

  const bolehVerifikasi = (peran === 'pembina' && milikSaya && status === 'diajukan') || peran === 'super';
  const bolehAjukan = peran === 'pengurus' && milikSaya && ['draf', 'dikembalikan'].includes(status);

  const baris = dok?.baris || [];
  const induk = baris.filter((b) => !b.indukId);
  const anak = (id) => baris.filter((b) => b.indukId === id);
  const totalBaris = (b) => jumlahBulan(b.bulan) + anak(b.id).reduce((s, a) => s + jumlahBulan(a.bulan), 0);
  const total = totalDok(dok);
  const totalRutin = induk.filter((b) => b.sifat === 'Rutin').reduce((s, b) => s + totalBaris(b), 0);
  const totalNon = total - totalRutin;

  const simpanDok = async (perubahan, pesan) => {
    await setDoc(doc(db, 'programKerja', idProgram(tahun, bpAktif)), {
      tahunPelayanan: tahun,
      bp: bpAktif,
      status: dok?.status || 'draf',
      baris: dok?.baris || [],
      ...perubahan,
      diperbarui: serverTimestamp(),
      diperbaruiOleh: profil?.nama || '',
    }, { merge: true });
    if (pesan) beritahu(pesan);
  };

  const simpanBaris = async (isi) => {
    const ada = baris.some((b) => b.id === isi.id);
    const baru = ada ? baris.map((b) => (b.id === isi.id ? isi : b)) : [...baris, isi];
    await simpanDok({ baris: baru }, ada ? 'Kegiatan diperbarui' : 'Kegiatan ditambahkan');
    setFormBaris(null);
  };

  const hapusBaris = async (b) => {
    const ikut = [b.id, ...anak(b.id).map((a) => a.id)];
    await simpanDok({ baris: baris.filter((x) => !ikut.includes(x.id)) }, 'Kegiatan dihapus');
    setHapus(null);
  };

  const ubahBulan = async (barisId, periode, masukan) => {
    const nilai = bacaNilaiBulan(masukan);
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

  const verifikasi = async ({ setuju, catatan }) => {
    await simpanDok({
      status: setuju ? 'disetujui' : 'dikembalikan',
      catatanPembina: catatan,
      diverifikasiOleh: profil?.nama || '',
      tglVerifikasi: hariIni(),
    }, setuju ? 'Program kerja disetujui' : 'Dikembalikan ke pengurus');
    setDialogVerifikasi(null);
  };

  const tahunPilihan = [tpBerjalan() - 1, tpBerjalan(), tpBerjalan() + 1];

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-10">

      {/* Pemilih badan pelayanan dan tahun */}
      <div className="bg-white rounded-lg border border-stone-200 p-4 flex flex-wrap gap-4 items-end no-print">
        <div className="min-w-[200px] flex-1">
          <label className="block text-[11px] text-stone-500 mb-1">Badan pelayanan</label>
          <select value={bpAktif} onChange={(e) => { setBpAktif(e.target.value); setBuka(null); }}
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm bg-white">
            {bpDaftar.map((b) => (
              <option key={b.kode} value={b.kode}>
                {b.nama}{bpSaya.includes(b.kode) ? ' · milik Anda' : ''}
              </option>
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

      {/* Kepala dokumen */}
      <div className="bg-white rounded-lg border border-stone-200 p-5 print-flat">
        <div className="flex flex-wrap justify-between items-start gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-medium">Rencana program kerja dan anggaran</h2>
            <p className="text-sm text-stone-600">{bpObj?.nama || bpAktif}</p>
            <p className="text-[11px] text-stone-500 mt-0.5">
              April {tahun} sampai Maret {tahun + 1}
              {!milikSaya && peran === 'pengurus' && ' · hanya dapat dilihat'}
            </p>
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
              <p className="text-[12px] font-medium text-red-900">Dikembalikan pembina</p>
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
                Uraian kegiatan di bawah ini menjadi dasar pengajuan PBO.
              </p>
              {dok?.catatanPembina && <p className="text-[12px] text-teal-900 mt-1">{dok.catatanPembina}</p>}
            </div>
          </div>
        )}

        {(bolehAjukan || bolehVerifikasi) && (
          <div className="mt-4 flex flex-wrap gap-2 no-print">
            {bolehAjukan && (
              <button onClick={ajukan}
                className="px-3 py-2 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800 flex items-center gap-1.5">
                <Send size={15} /> Ajukan ke pembina
              </button>
            )}
            {bolehVerifikasi && (
              <>
                <button onClick={() => setDialogVerifikasi({ setuju: true })}
                  className="px-3 py-2 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800 flex items-center gap-1.5">
                  <CheckCircle2 size={15} /> Setujui
                </button>
                <button onClick={() => setDialogVerifikasi({ setuju: false })}
                  className="px-3 py-2 text-sm border border-red-300 text-red-800 rounded-md hover:bg-red-50 flex items-center gap-1.5">
                  <Undo2 size={15} /> Kembalikan
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Kegiatan rutin', rp(totalRutin)],
          ['Kegiatan non rutin', rp(totalNon)],
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

      {/* Daftar kegiatan */}
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
              {bolehSunting
                ? 'Tekan tombol Kegiatan di atas untuk mulai menyusun.'
                : 'Badan pelayanan ini belum menyusun program kerjanya.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {induk.map((b) => (
              <Kegiatan key={b.id} baris={b} anak={anak(b.id)} bulan={bulan}
                terbuka={buka === b.id} onBuka={() => setBuka(buka === b.id ? null : b.id)}
                total={totalBaris(b)} bolehSunting={bolehSunting}
                onUbahBulan={ubahBulan}
                onSunting={(x) => setFormBaris({ ...x, baru: false })}
                onTambahAnak={() => setFormBaris({ baru: true, indukId: b.id })}
                onHapus={(x) => setHapus(x)} />
            ))}
          </div>
        )}
      </div>

      {!bolehSunting && milikSaya && status === 'diajukan' && (
        <p className="text-[12px] bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2.5 rounded flex items-start gap-1.5">
          <Lock size={14} className="mt-px shrink-0" />
          Sedang menunggu verifikasi pembina, jadi tidak bisa disunting. Kalau ada yang perlu diubah,
          minta pembina mengembalikannya lebih dulu.
        </p>
      )}

      {formBaris && (
        <FormBaris isi={formBaris} onBatal={() => setFormBaris(null)} onSimpan={simpanBaris} />
      )}

      {dialogVerifikasi && (
        <DialogVerifikasi setuju={dialogVerifikasi.setuju}
          onBatal={() => setDialogVerifikasi(null)} onSimpan={verifikasi} />
      )}

      {hapus && (
        <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-sm p-5">
            <h3 className="text-base font-medium mb-1.5">Hapus kegiatan?</h3>
            <p className="text-sm text-stone-600 mb-4">
              {hapus.nama}
              {anak(hapus.id).length > 0 && ` beserta ${anak(hapus.id).length} sub kegiatannya`} akan dihapus.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setHapus(null)}
                className="px-3 py-2 text-sm border border-stone-300 rounded-md hover:bg-stone-50">Batal</button>
              <button onClick={() => hapusBaris(hapus)}
                className="px-3 py-2 text-sm bg-red-700 text-white rounded-md hover:bg-red-800">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function totalDok(d) {
  if (!d?.baris) return 0;
  return d.baris.reduce((s, b) => s + jumlahBulan(b.bulan), 0);
}

/* ─────────── Satu kegiatan ─────────── */

function Kegiatan({ baris, anak, bulan, terbuka, onBuka, total, bolehSunting, onUbahBulan, onSunting, onTambahAnak, onHapus }) {
  const adaAnak = anak.length > 0;

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
              {baris.subBidang && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">{baris.subBidang}</span>
              )}
            </div>
            {baris.tujuan && <p className="text-[12px] text-stone-600 mt-0.5">{baris.tujuan}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-medium">{total > 0 ? rp(total) : '—'}</p>
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
            {baris.indikator && (
              <Rincian label="Indikator hasil" isi={baris.indikator} />
            )}
            {baris.jadwal && <Rincian label="Jadwal kegiatan" isi={baris.jadwal} />}

            {!adaAnak && (
              <GridBulan bulan={bulan} nilai={baris.bulan} kunci={!bolehSunting}
                onUbah={(p, v) => onUbahBulan(baris.id, p, v)} />
            )}

            {adaAnak && (
              <p className="text-[11px] text-stone-500">
                Anggaran kegiatan ini dijabarkan pada sub kegiatan di bawah.
              </p>
            )}

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

/* ─────────── Kotak dua belas bulan ─────────── */

function GridBulan({ bulan, nilai = {}, kunci, onUbah }) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <p className="text-[10px] uppercase tracking-wider text-stone-500">Anggaran per bulan</p>
        {!kunci && <p className="text-[10px] text-stone-400">isi angka rupiah, atau X bila tanpa anggaran</p>}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5">
        {bulan.map((p) => {
          const v = nilai[p];
          const tandaX = v === 'X';
          return (
            <div key={p}>
              <label className="block text-[9px] text-stone-500 mb-0.5">{labelBulanPendek(p)}</label>
              {kunci ? (
                <div className={`w-full border rounded px-1.5 py-1 text-[11px] text-right ${
                  tandaX ? 'border-blue-200 bg-blue-50 text-blue-900 text-center'
                    : v ? 'border-stone-200 bg-white' : 'border-stone-100 bg-stone-50 text-stone-300'}`}>
                  {tandaX ? 'X' : v ? rpSingkat(v) : '—'}
                </div>
              ) : (
                <input
                  defaultValue={tulisNilaiBulan(v)}
                  onBlur={(e) => onUbah(p, e.target.value)}
                  inputMode="text"
                  className={`w-full border rounded px-1.5 py-1 text-[11px] text-right focus:border-teal-600 outline-none ${
                    tandaX ? 'border-blue-300 bg-blue-50 text-blue-900 text-center' : 'border-stone-300'}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────── Formulir kegiatan ─────────── */

function FormBaris({ isi, onBatal, onSimpan }) {
  const anak = Boolean(isi.indukId);
  const [d, setD] = useState({
    id: isi.id || 'K' + Date.now(),
    indukId: isi.indukId ?? null,
    nama: isi.nama || '',
    subBidang: isi.subBidang || '',
    sifat: isi.sifat || 'Rutin',
    tujuan: isi.tujuan || '',
    indikator: isi.indikator || '',
    jadwal: isi.jadwal || '',
    bulan: isi.bulan || {},
  });

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-start md:items-center justify-center md:p-4 z-50 overflow-y-auto">
      <div className="bg-white w-full max-w-lg min-h-full md:min-h-0 md:my-6 md:rounded-lg">
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] text-stone-500 mb-1">Sifat</label>
                <select value={d.sifat} onChange={(e) => setD({ ...d, sifat: e.target.value })}
                  className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm bg-white">
                  <option>Rutin</option>
                  <option>Non Rutin</option>
                </select>
                <p className="text-[11px] text-stone-500 mt-1">
                  Non rutin ditinjau ulang tiap tahun
                </p>
              </div>
              <div>
                <label className="block text-[11px] text-stone-500 mb-1">Sub bidang pelaksana</label>
                <input value={d.subBidang} onChange={(e) => setD({ ...d, subBidang: e.target.value })}
                  placeholder="Sub Bid. Peribadahan"
                  className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm" />
                <p className="text-[11px] text-stone-500 mt-1">Penanda saja, boleh dikosongkan</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] text-stone-500 mb-1">Tujuan dan sasaran</label>
            <textarea value={d.tujuan} onChange={(e) => setD({ ...d, tujuan: e.target.value })} rows={2}
              placeholder="Apa yang hendak dicapai kegiatan ini"
              className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm resize-none" />
          </div>

          {!anak && (
            <>
              <div>
                <label className="block text-[11px] text-stone-500 mb-1">Indikator hasil</label>
                <textarea value={d.indikator} onChange={(e) => setD({ ...d, indikator: e.target.value })} rows={3}
                  placeholder="Ukuran keberhasilan yang bisa diperiksa, misalnya jumlah kehadiran"
                  className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm resize-none" />
              </div>
              <div>
                <label className="block text-[11px] text-stone-500 mb-1">Jadwal kegiatan</label>
                <input value={d.jadwal} onChange={(e) => setD({ ...d, jadwal: e.target.value })}
                  placeholder="Setiap hari Minggu, atau Insidentil, atau Bulan Mei 2026"
                  className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm" />
              </div>
            </>
          )}

          <p className="text-[12px] bg-stone-50 text-stone-700 px-3 py-2 rounded flex items-start gap-1.5">
            <Info size={14} className="mt-px shrink-0" />
            Anggaran per bulan diisi setelah kegiatan ini tersimpan, dengan membuka tanda panah
            di daftar kegiatan.
          </p>
        </div>

        <div className="px-5 py-4 border-t border-stone-200 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onBatal} className="px-3 py-2 text-sm border border-stone-300 rounded-md hover:bg-stone-50">Batal</button>
          <button onClick={() => onSimpan(d)} disabled={!d.nama.trim()}
            className="px-4 py-2 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800 disabled:bg-stone-300 flex items-center gap-1.5">
            <Save size={15} /> Simpan
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Verifikasi pembina ─────────── */

function DialogVerifikasi({ setuju, onBatal, onSimpan }) {
  const [catatan, setCatatan] = useState('');
  const wajib = !setuju && catatan.trim().length < 15;

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg w-full max-w-md p-5 my-auto">
        <h3 className="text-base font-medium mb-1.5">
          {setuju ? 'Setujui program kerja' : 'Kembalikan ke pengurus'}
        </h3>
        <p className="text-sm text-stone-600 mb-4">
          {setuju
            ? 'Setelah disetujui, uraian kegiatan di dalamnya menjadi dasar pengajuan PBO. Pengurus tidak bisa mengubahnya lagi tanpa dikembalikan lebih dulu.'
            : 'Jelaskan apa yang perlu diperbaiki, supaya pengurus tahu harus mengubah bagian mana.'}
        </p>

        <label className="block text-[11px] text-stone-500 mb-1">
          {setuju ? 'Catatan untuk pengurus (opsional)' : 'Alasan pengembalian'}
        </label>
        <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={3}
          placeholder={setuju ? 'Misalnya: anggaran konsumsi agar dipantau ketat' : 'Bagian mana yang perlu diperbaiki'}
          className={`w-full border rounded-md px-3 py-2 text-sm resize-none ${
            wajib && catatan ? 'border-red-300' : 'border-stone-300'}`} />
        {wajib && <p className="text-[11px] text-amber-700 mt-1">Alasan minimal lima belas huruf.</p>}

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onBatal} className="px-3 py-2 text-sm border border-stone-300 rounded-md hover:bg-stone-50">Batal</button>
          <button onClick={() => onSimpan({ setuju, catatan: catatan.trim() })} disabled={wajib}
            className={`px-4 py-2 text-sm text-white rounded-md disabled:bg-stone-300 ${
              setuju ? 'bg-teal-700 hover:bg-teal-800' : 'bg-red-700 hover:bg-red-800'}`}>
            {setuju ? 'Setujui' : 'Kembalikan'}
          </button>
        </div>
      </div>
    </div>
  );
}
