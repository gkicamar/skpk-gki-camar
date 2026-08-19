import React, { useEffect, useMemo, useState } from 'react';
import {
  collection, doc, onSnapshot, setDoc, getDoc, deleteDoc, serverTimestamp, query, where,
} from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { useAuth } from '../konteks/Auth.jsx';
import { InputRupiah, PilihBP } from '../komponen/Dasar.jsx';
import { susunHierarki } from './Beranda.jsx';
import {
  rp, periodeTP, labelPeriode, labelBulanPendek, tanggalPanjang, tpBerjalan, hariIni,
} from '../util/format.js';
import {
  Plus, Pencil, Trash2, X, Save, Send, CheckCircle2, Undo2, Printer, Info,
  AlertTriangle, ChevronDown, ChevronRight, Banknote, ShieldCheck, Lock, KeyRound,
} from 'lucide-react';

const STATUS = {
  diajukan:         { label: 'Menunggu pembina',   warna: 'bg-amber-50 text-amber-900' },
  diperiksaPembina: { label: 'Menunggu bendahara', warna: 'bg-blue-50 text-blue-900' },
  disetujui:        { label: 'Disetujui',          warna: 'bg-indigo-50 text-indigo-900' },
  dicairkan:        { label: 'Dicairkan',          warna: 'bg-teal-50 text-teal-900' },
  dikembalikan:     { label: 'Dikembalikan',       warna: 'bg-red-50 text-red-900' },
};

const DANA = { OPS: 'Dana Operasional', BTH: 'Dana Bethesda' };

const totalPBO = (p) => (p?.baris || []).reduce((s, b) => s + (Number(b.nominal) || 0), 0);

export default function PBO({ beritahu }) {
  const { profil, peran, bpSaya } = useAuth();
  const pusat = ['super', 'ketua', 'bendahara'].includes(peran);

  const [bpDaftar, setBpDaftar] = useState([]);
  const [daftar, setDaftar] = useState([]);
  const [galat, setGalat] = useState('');
  const [tahun, setTahun] = useState(tpBerjalan());
  const [periode, setPeriode] = useState('SEMUA');
  const [bpSaring, setBpSaring] = useState('SEMUA');
  const [buka, setBuka] = useState(null);
  const [form, setForm] = useState(null);
  const [verifikasi, setVerifikasi] = useState(null);
  const [cairkan, setCairkan] = useState(null);
  const [hapus, setHapus] = useState(null);
  const [tampil, setTampil] = useState(20);

  const bulan = useMemo(() => periodeTP(tahun), [tahun]);

  useEffect(() => onSnapshot(collection(db, 'badanPelayanan'), (s) =>
    setBpDaftar(s.docs.map((x) => ({ kode: x.id, ...x.data() })).filter((x) => x.aktif !== false))), []);

  // Kewenangan pembina menurun dari divisi ke departemen di bawahnya, jadi
  // jangkauannya diperluas lebih dulu supaya kuerinya ikut mencakup mereka.
  const jangkauan = useMemo(() => {
    if (peran !== 'pembina') return bpSaya;
    const turunan = bpDaftar.filter((b) => b.divisi && bpSaya.includes(b.divisi)).map((b) => b.kode);
    return [...new Set([...bpSaya, ...turunan])];
  }, [peran, bpSaya, bpDaftar]);

  // Pengurus dan pembina hanya boleh membaca PBO badan pelayanannya. Kueri
  // disaring lebih dulu supaya sesuai aturan keamanan, karena Firestore
  // menolak kueri yang jangkauannya memuat dokumen tak berhak dibaca.
  useEffect(() => {
    setGalat('');
    if (!pusat && jangkauan.length === 0) { setDaftar([]); return; }
    const acuan = pusat
      ? collection(db, 'pbo')
      : query(collection(db, 'pbo'), where('bp', 'in', jangkauan.slice(0, 30)));
    return onSnapshot(acuan,
      (s) => setDaftar(s.docs.map((x) => ({ id: x.id, ...x.data() }))),
      () => { setDaftar([]); setGalat('Tidak dapat memuat daftar PBO. Coba muat ulang halaman.'); });
  }, [pusat, jangkauan.join(',')]);

  const { divisi, anak } = useMemo(
    () => susunHierarki(bpDaftar.filter((b) => pusat || !b.rahasia || jangkauan.includes(b.kode))),
    [bpDaftar, pusat, jangkauan],
  );
  // Yang boleh diajukan tetap hanya penugasan langsung, bukan turunannya.
  const bpMilik = bpDaftar.filter((b) => bpSaya.includes(b.kode));
  const namaBP = (k) => bpDaftar.find((b) => b.kode === k)?.nama || k;

  const tersaring = useMemo(() => daftar
    .filter((p) => p.tahunPelayanan === tahun)
    .filter((p) => periode === 'SEMUA' || p.periodeAnggaran === periode)
    .filter((p) => bpSaring === 'SEMUA' || p.bp === bpSaring)
    .sort((a, b) => (b.tglAjukan || '').localeCompare(a.tglAjukan || '')),
    [daftar, tahun, periode, bpSaring]);

  useEffect(() => setTampil(20), [tahun, periode, bpSaring]);

  const jumlahStatus = (st) => tersaring.filter((p) => p.status === st).reduce((s, p) => s + totalPBO(p), 0);

  const simpan = async ({ id, baru, ...isi }) => {
    const kunci = id || `${isi.bp}_${Date.now()}`;
    // Firestore menolak nilai undefined, jadi kolom kosong dibuang lebih dulu.
    const bersih = Object.fromEntries(Object.entries(isi).filter(([, v]) => v !== undefined));
    try {
      await setDoc(doc(db, 'pbo', kunci), {
        ...bersih, total: totalPBO(isi),
        diperbarui: serverTimestamp(), diperbaruiOleh: profil?.nama || '',
      }, { merge: true });
      setForm(null);
      beritahu(`PBO ${isi.nomor} tersimpan`);
    } catch (e) {
      beritahu(e.code === 'permission-denied'
        ? 'Tidak berhak mengajukan untuk badan pelayanan ini. Periksa penugasan akun Anda.'
        : `Gagal menyimpan: ${e.message || e.code || 'sebab tidak diketahui'}`, 'info');
    }
  };

  // Pengajuan departemen diperiksa pembina lebih dulu, baru bendahara.
  // Pengajuan divisi langsung ke bendahara.
  const putusan = async ({ pbo, setuju, catatan, tahap }) => {
    const riwayat = [...(pbo.riwayat || []), {
      tgl: hariIni(), oleh: profil?.nama || '',
      tindakan: setuju ? (tahap === 'pembina' ? 'periksaPembina' : 'setuju') : 'kembalikan', catatan,
    }].slice(-20);
    const status = !setuju ? 'dikembalikan' : tahap === 'pembina' ? 'diperiksaPembina' : 'disetujui';
    try {
      await setDoc(doc(db, 'pbo', pbo.id), {
        status, riwayat, diperbarui: serverTimestamp(),
        ...(tahap === 'pembina'
          ? { catatanPembina: catatan, diperiksaOleh: profil?.nama || '', tglPeriksa: hariIni() }
          : { catatanVerifikasi: catatan, diverifikasiOleh: profil?.nama || '', tglVerifikasi: hariIni() }),
      }, { merge: true });
      setVerifikasi(null);
      beritahu(!setuju ? 'PBO dikembalikan ke pengaju'
        : tahap === 'pembina' ? 'Diteruskan ke Bendahara Majelis Jemaat' : 'PBO disetujui');
    } catch (e) {
      beritahu('Tidak berhak memverifikasi PBO ini.', 'info');
    }
  };

  const simpanCair = async ({ pbo, tglCair, akun, catatan }) => {
    const riwayat = [...(pbo.riwayat || []),
      { tgl: hariIni(), oleh: profil?.nama || '', tindakan: 'cair', catatan }].slice(-20);
    await setDoc(doc(db, 'pbo', pbo.id), {
      status: 'dicairkan', tglCair, akunCair: akun, catatanCair: catatan,
      dicairkanOleh: profil?.nama || '', riwayat, diperbarui: serverTimestamp(),
    }, { merge: true });
    setCairkan(null);
    beritahu('PBO ditandai sudah dicairkan');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-10">

      <div className="bg-white rounded-lg border border-stone-200 p-4 flex flex-wrap gap-4 items-end no-print">
        <div>
          <label className="block text-[11px] text-stone-500 mb-1">Tahun pelayanan</label>
          <select value={tahun} onChange={(e) => setTahun(Number(e.target.value))}
            className="border border-stone-300 rounded-md px-3 py-2 text-sm bg-white">
            {[tpBerjalan() - 1, tpBerjalan(), tpBerjalan() + 1].map((t) =>
              <option key={t} value={t}>{t}–{t + 1}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-stone-500 mb-1">Bulan</label>
          <select value={periode} onChange={(e) => setPeriode(e.target.value)}
            className="border border-stone-300 rounded-md px-3 py-2 text-sm bg-white">
            <option value="SEMUA">Semua bulan</option>
            {bulan.map((p) => <option key={p} value={p}>{labelPeriode(p)}</option>)}
          </select>
        </div>
        {(pusat || jangkauan.length > 1) && (
          <div className="min-w-[220px] flex-1">
            <PilihBP nilai={bpSaring === 'SEMUA' ? '' : bpSaring} daftar={bpDaftar.filter((b) => pusat || jangkauan.includes(b.kode))}
              bpSaya={bpSaya} label="Badan pelayanan" onPilih={(k) => setBpSaring(k || 'SEMUA')} />
            {bpSaring !== 'SEMUA' && (
              <button onClick={() => setBpSaring('SEMUA')} className="text-[11px] text-teal-700 hover:text-teal-900 mt-1">
                Tampilkan semua
              </button>
            )}
          </div>
        )}
        <div className="flex gap-2 ml-auto">
          <button onClick={() => window.print()}
            className="px-3 py-2 text-sm border border-stone-300 rounded-md hover:bg-stone-50 flex items-center gap-1.5">
            <Printer size={15} /> Cetak
          </button>
          {bpMilik.length > 0 && (
            <button onClick={() => setForm({ baru: true, bp: bpMilik[0].kode })}
              className="px-3 py-2 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800 flex items-center gap-1.5">
              <Plus size={15} /> Ajukan PBO
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Menunggu pembina', jumlahStatus('diajukan'), 'text-amber-800'],
          ['Menunggu bendahara', jumlahStatus('diperiksaPembina'), 'text-blue-800'],
          ['Disetujui belum cair', jumlahStatus('disetujui'), 'text-indigo-800'],
          ['Sudah dicairkan', jumlahStatus('dicairkan'), 'text-teal-800'],
        ].map(([l, v, w]) => (
          <div key={l} className="bg-white rounded-lg border border-stone-200 p-4">
            <p className="text-[11px] text-stone-500 mb-1">{l}</p>
            <p className={`text-base font-medium ${v ? w : 'text-stone-300'}`}>{rp(v)}</p>
          </div>
        ))}
      </div>

      {galat && (
        <p className="text-[12px] bg-red-50 border border-red-200 text-red-900 px-3 py-2.5 rounded flex items-start gap-1.5">
          <AlertTriangle size={14} className="mt-px shrink-0" /> {galat}
        </p>
      )}

      <div className="bg-white rounded-lg border border-stone-200 overflow-hidden print-flat">
        <div className="px-4 py-3 border-b border-stone-100">
          <h3 className="text-sm font-medium">Pengajuan biaya operasional</h3>
          <p className="text-[11px] text-stone-500">
            {tersaring.length} pengajuan · uraian diambil dari program kerja yang sudah disetujui
          </p>
        </div>

        {tersaring.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-stone-500 mb-1">Belum ada PBO pada saringan ini.</p>
            {peran === 'pengurus' && (
              <p className="text-[12px] text-stone-500">
                Program kerja harus disetujui pembina lebih dulu sebelum PBO bisa diajukan.
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {tersaring.slice(0, tampil).map((p) => (
              <BarisPBO key={p.id} pbo={p} namaBP={namaBP} peran={peran} milik={jangkauan.includes(p.bp)}
                departemen={Boolean(bpDaftar.find((b) => b.kode === p.bp)?.divisi)}
                terbuka={buka === p.id} onBuka={() => setBuka(buka === p.id ? null : p.id)}
                onSunting={() => setForm({ ...p, baru: false })}
                onVerifikasi={(tahap) => setVerifikasi({ pbo: p, tahap })}
                onCairkan={() => setCairkan(p)}
                onHapus={() => setHapus(p)} />
            ))}
            {tersaring.length > tampil && (
              <div className="px-4 py-3 text-center no-print">
                <button onClick={() => setTampil((v) => v + 20)}
                  className="text-[13px] px-3 py-2 border border-stone-300 rounded-md hover:bg-stone-50">
                  Tampilkan {Math.min(20, tersaring.length - tampil)} lagi
                  <span className="text-stone-500"> · sisa {tersaring.length - tampil}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {form && (
        <FormPBO isi={form} bpMilik={bpMilik} daftar={daftar} tahun={tahun} bulan={bulan}
          peran={peran} profil={profil} onBatal={() => setForm(null)} onSimpan={simpan} />
      )}
      {verifikasi && <DialogVerifikasi pbo={verifikasi.pbo} tahap={verifikasi.tahap} namaBP={namaBP}
        onBatal={() => setVerifikasi(null)} onSimpan={putusan} />}
      {cairkan && <DialogCair pbo={cairkan} onBatal={() => setCairkan(null)} onSimpan={simpanCair} />}
      {hapus && (
        <div className="fixed inset-0 bg-stone-900/40 flex items-start justify-center p-4 py-10 z-50 overflow-y-auto overscroll-contain">
          <div className="bg-white rounded-lg w-full max-w-sm p-5 my-auto mx-auto">
            <h3 className="text-base font-medium mb-1.5">Hapus pengajuan?</h3>
            <p className="text-sm text-stone-600 mb-4">{hapus.nomor} akan dihapus dan tidak bisa dikembalikan.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setHapus(null)} className="px-3 py-2 text-sm border border-stone-300 rounded-md hover:bg-stone-50">Batal</button>
              <button onClick={async () => { await deleteDoc(doc(db, 'pbo', hapus.id)); setHapus(null); beritahu('PBO dihapus'); }}
                className="px-3 py-2 text-sm bg-red-700 text-white rounded-md hover:bg-red-800">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────── Satu baris PBO ─────────── */

function BarisPBO({ pbo, namaBP, peran, milik, departemen, terbuka, onBuka, onSunting, onVerifikasi, onCairkan, onHapus }) {
  const st = STATUS[pbo.status] || STATUS.diajukan;
  const bendahara = ['bendahara', 'super', 'ketua'].includes(peran);
  const bolehSunting = milik && ['pengurus', 'pembina'].includes(peran)
    && ['diajukan', 'dikembalikan'].includes(pbo.status);
  // Pembina memeriksa pengajuan departemen binaannya yang masih menunggu.
  const giliranPembina = pbo.status === 'diajukan' && (peran === 'super' || (peran === 'pembina' && milik));
  // Pengajuan yang dibuat bendahara tidak boleh disetujui dirinya sendiri,
  // melainkan oleh Ketua Majelis Jemaat.
  const giliranBendahara = pbo.status === 'diperiksaPembina'
    && (pbo.perluKetua ? ['ketua', 'super'].includes(peran) : bendahara);

  return (
    <div>
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <button onClick={onBuka} className="mt-0.5 text-stone-400 hover:text-teal-700 shrink-0 no-print">
            {terbuka ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{namaBP(pbo.bp)}</p>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${st.warna}`}>{st.label}</span>
              {pbo.dana === 'BTH' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-900">Bethesda</span>}
              {pbo.perluKetua && <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-700">persetujuan ketua</span>}
              {pbo.izinKhusus && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 inline-flex items-center gap-1">
                  <KeyRound size={9} /> izin ketua
                </span>
              )}
            </div>
            <p className="text-[11px] text-stone-500 mt-0.5">
              {pbo.nomor} · {labelPeriode(pbo.periodeAnggaran)} · diajukan {tanggalPanjang(pbo.tglAjukan)}
              {' · '}{pbo.baris?.length || 0} uraian
              {pbo.status === 'diperiksaPembina' && pbo.perluKetua && ' · menunggu Ketua Majelis Jemaat'}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-medium">{rp(totalPBO(pbo))}</p>
            <div className="flex gap-1 justify-end mt-1 no-print">
              {bolehSunting && <>
                <button onClick={onSunting} className="p-1 text-stone-400 hover:text-teal-700"><Pencil size={13} /></button>
                <button onClick={onHapus} className="p-1 text-stone-400 hover:text-red-600"><Trash2 size={13} /></button>
              </>}
              {giliranPembina && (
                <button onClick={() => onVerifikasi('pembina')}
                  className="text-[12px] px-2.5 py-1 border border-stone-300 rounded-md hover:bg-stone-50">
                  Periksa
                </button>
              )}
              {giliranBendahara && (
                <button onClick={() => onVerifikasi('bendahara')}
                  className="text-[12px] px-2.5 py-1 border border-stone-300 rounded-md hover:bg-stone-50">
                  Verifikasi
                </button>
              )}
              {bendahara && pbo.status === 'disetujui' && (
                <button onClick={onCairkan}
                  className="text-[12px] px-2.5 py-1 border border-teal-600 text-teal-800 rounded-md hover:bg-teal-50 flex items-center gap-1">
                  <Banknote size={12} /> Cairkan
                </button>
              )}
            </div>
          </div>
        </div>

        {terbuka && (
          <div className="mt-3 ml-7 space-y-3">
            {pbo.status === 'dikembalikan' && pbo.catatanVerifikasi && (
              <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2">
                <Undo2 size={14} className="text-red-800 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[12px] text-red-900">{pbo.catatanVerifikasi}</p>
                  <p className="text-[11px] text-red-800 mt-0.5">{pbo.diverifikasiOleh} · {tanggalPanjang(pbo.tglVerifikasi)}</p>
                </div>
              </div>
            )}
            {pbo.izinKhusus && (
              <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                <p className="text-[12px] text-amber-900">
                  Diajukan tanpa LPJ bulan sebelumnya atas izin {pbo.izinKhusus.oleh}
                </p>
                <p className="text-[11px] text-amber-900 mt-0.5">{pbo.izinKhusus.alasan}</p>
              </div>
            )}

            <div className="border border-stone-200 rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-stone-500 bg-stone-50 border-b border-stone-200">
                    <th className="text-left font-normal px-3 py-2 w-8">No</th>
                    <th className="text-left font-normal px-3 py-2">Uraian program</th>
                    <th className="text-right font-normal px-3 py-2 w-32">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {(pbo.baris || []).map((b, i) => (
                    <tr key={b.id || i} className="border-b border-stone-50">
                      <td className="px-3 py-1.5 text-stone-500">{i + 1}</td>
                      <td className="px-3 py-1.5">
                        {b.uraian}
                        {b.ambilDari && (
                          <span className="text-[11px] text-amber-800 block">
                            diambil dari anggaran {labelPeriode(b.ambilDari)}
                          </span>
                        )}
                        {b.catatan && <span className="text-[11px] text-stone-500 block">{b.catatan}</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right">{rp(b.nominal)}</td>
                    </tr>
                  ))}
                  <tr className="bg-stone-50">
                    <td className="px-3 py-2 font-medium" colSpan={2}>Jumlah</td>
                    <td className="px-3 py-2 text-right font-medium">{rp(totalPBO(pbo))}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-stone-500 mb-0.5">Rekening penerima</p>
                <p>{pbo.penerima?.nama || '—'}</p>
                <p className="text-stone-600">{pbo.penerima?.bank} {pbo.penerima?.noRek}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-stone-500 mb-0.5">Sumber dana</p>
                <p>{DANA[pbo.dana] || pbo.dana}</p>
                {pbo.status === 'dicairkan' && (
                  <p className="text-teal-800 mt-1">
                    Cair {tanggalPanjang(pbo.tglCair)} dari {pbo.akunCair}
                  </p>
                )}
              </div>
            </div>

            {pbo.riwayat?.length > 0 && (
              <details className="no-print">
                <summary className="text-[11px] text-stone-500 cursor-pointer hover:text-stone-800">
                  Riwayat · {pbo.riwayat.length} catatan
                </summary>
                <div className="mt-2 space-y-1.5 border-l-2 border-stone-200 pl-3">
                  {pbo.riwayat.slice().reverse().map((r, i) => (
                    <div key={i}>
                      <p className="text-[11px] text-stone-500">
                        {tanggalPanjang(r.tgl)} · {r.oleh} ·{' '}
                        {r.tindakan === 'setuju' ? 'menyetujui' : r.tindakan === 'cair' ? 'mencairkan' : 'mengembalikan'}
                      </p>
                      {r.catatan && <p className="text-[12px] text-stone-700">{r.catatan}</p>}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────── Formulir pengajuan ─────────── */

function FormPBO({ isi, bpMilik, daftar, tahun, bulan, peran, profil, onBatal, onSimpan }) {
  const [bp, setBp] = useState(isi.bp || bpMilik[0]?.kode || '');
  const [periode, setPeriode] = useState(isi.periodeAnggaran || bulan.find((p) => p >= hariIni().slice(0, 7)) || bulan[0]);
  const [tglAjukan, setTglAjukan] = useState(isi.tglAjukan || hariIni());
  const [dana, setDana] = useState(isi.dana || 'OPS');
  const [penerima, setPenerima] = useState(isi.penerima || { nama: '', bank: 'BCA', noRek: '' });
  const [baris, setBaris] = useState(isi.baris || []);
  const [program, setProgram] = useState(null);
  const [memuatProgram, setMemuatProgram] = useState(true);
  const [izin, setIzin] = useState(isi.izinKhusus || null);
  const [dialogIzin, setDialogIzin] = useState(false);

  // Ambil program kerja badan pelayanan ini untuk tahun berjalan.
  useEffect(() => {
    if (!bp) return;
    setMemuatProgram(true);
    getDoc(doc(db, 'programKerja', `${tahun}_${bp}`))
      .then((s) => setProgram(s.exists() ? s.data() : null))
      .catch(() => setProgram(null))
      .finally(() => setMemuatProgram(false));
  }, [bp, tahun]);

  // Rekening penerima diingat dari pengajuan terakhir badan pelayanan ini.
  useEffect(() => {
    if (isi.penerima || !bp) return;
    const lalu = daftar.filter((p) => p.bp === bp && p.penerima?.noRek)
      .sort((a, b) => (b.tglAjukan || '').localeCompare(a.tglAjukan || ''))[0];
    if (lalu) setPenerima(lalu.penerima);
  }, [bp, daftar, isi.penerima]);

  const disetujui = program?.status === 'disetujui';

  // Uraian yang boleh dipakai berasal dari kegiatan dan sub kegiatan program kerja.
  const opsi = useMemo(() => {
    if (!disetujui) return [];
    const semua = program.baris || [];
    const namaInduk = (id) => semua.find((x) => x.id === id)?.nama || '';
    return semua.map((b) => ({
      id: b.id,
      nama: b.indukId ? `${namaInduk(b.indukId)} — ${b.nama}` : b.nama,
      bulan: b.bulan || {},
    }));
  }, [program, disetujui]);

  // Penjaga tertib administrasi: LPJ bulan sebelumnya harus sudah masuk.
  const bulanSebelum = bulan[bulan.indexOf(periode) - 1];
  const adaTunggakan = useMemo(() => {
    if (!bulanSebelum) return false;
    return daftar.some((p) => p.bp === bp && p.periodeAnggaran === bulanSebelum
      && p.status === 'dicairkan' && !p.lpjSelesai);
  }, [daftar, bp, bulanSebelum]);

  // Anggaran adalah ember per uraian per bulan. Mengambil dari bulan lain berarti
  // menimba ember bulan itu, bukan menambah jatah baru. Ember yang sudah kosong
  // tidak boleh ditimba lagi, sehingga satu anggaran tidak terpakai dua kali.
  const pagu = (kegiatanId, kunci) => {
    const k = opsi.find((o) => o.id === kegiatanId);
    const nilai = k?.bulan?.[kunci];
    return typeof nilai === 'number' ? nilai : 0;
  };

  const terpakaiLain = (kegiatanId, kunci) => {
    let jumlah = 0;
    daftar.forEach((p) => {
      if (p.bp !== bp || p.id === isi.id || p.status === 'dikembalikan') return;
      (p.baris || []).forEach((x) => {
        if (x.kegiatanId !== kegiatanId) return;
        if ((x.ambilDari || p.periodeAnggaran) === kunci) jumlah += Number(x.nominal) || 0;
      });
    });
    return jumlah;
  };

  // Baris lain pada formulir ini yang menimba ember yang sama.
  const terpakaiForm = (kegiatanId, kunci, kecualiId) =>
    baris.filter((x) => x.id !== kecualiId && x.kegiatanId === kegiatanId
      && (x.ambilDari || periode) === kunci)
      .reduce((t, x) => t + (Number(x.nominal) || 0), 0);

  const sisaEmber = (kegiatanId, kunci, kecualiId) =>
    pagu(kegiatanId, kunci) - terpakaiLain(kegiatanId, kunci) - terpakaiForm(kegiatanId, kunci, kecualiId);

  const total = baris.reduce((s, b) => s + (Number(b.nominal) || 0), 0);
  const nomor = isi.nomor || susunNomor(daftar, bp, periode);

  // Departemen yang diajukan pengurus diperiksa pembina lebih dulu.
  // Divisi, dan apa pun yang diajukan pembina sendiri, langsung ke bendahara.
  const bpObj = bpMilik.find((b) => b.kode === bp);
  const perluPembina = Boolean(bpObj?.divisi) && peran === 'pengurus';

  // Daftar syarat yang belum terpenuhi, ditampilkan agar jelas apa yang kurang.
  const kurang = [];
  if (!disetujui) kurang.push('program kerja belum disetujui pembina');
  if (baris.length === 0) kurang.push('belum ada uraian program');
  if (baris.some((b) => !b.uraian)) kurang.push('ada uraian yang belum dipilih');
  if (baris.some((b) => !(Number(b.nominal) > 0))) kurang.push('ada nominal yang masih nol');
  if (baris.some((b) => b.kegiatanId && Number(b.nominal) > sisaEmber(b.kegiatanId, b.ambilDari || periode, b.id)))
    kurang.push('ada nominal yang melebihi sisa anggaran');
  if (!penerima.nama.trim()) kurang.push('nama pemilik rekening belum diisi');
  if (!penerima.noRek.trim()) kurang.push('nomor rekening belum diisi');
  if (adaTunggakan && !izin) kurang.push(`LPJ ${labelPeriode(bulanSebelum)} belum masuk`);
  const sah = kurang.length === 0;

  const tambahBaris = () => setBaris((v) => [...v,
    { id: 'B' + Date.now(), kegiatanId: '', uraian: '', ambilDari: '', nominal: 0, catatan: '' }]);

  const ubahBaris = (id, ubah) => setBaris((v) => v.map((b) => (b.id === id ? { ...b, ...ubah } : b)));

  const pilihKegiatan = (id, kegiatanId) => {
    const k = opsi.find((o) => o.id === kegiatanId);
    ubahBaris(id, { kegiatanId, uraian: k?.nama || '', ambilDari: '' });
  };


  const kirim = () => onSimpan({
    ...(isi.id ? { id: isi.id } : {}),
    perluKetua: peran === 'bendahara',
    nomor, bp, tahunPelayanan: tahun, periodeAnggaran: periode,
    tglAjukan, dana, penerima, baris, total,
    status: perluPembina ? 'diajukan' : 'diperiksaPembina',
    izinKhusus: izin || null, diajukanOleh: profil?.nama || '',
    riwayat: isi.riwayat || [],
  });

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-start justify-center z-50 overflow-y-auto overscroll-contain p-0 md:p-4">
      <div className="bg-white w-full max-w-2xl my-0 md:my-8 md:rounded-lg">
        <div className="px-5 py-4 border-b border-stone-200 flex justify-between items-center">
          <div>
            <h3 className="text-base font-medium">{isi.baru ? 'Ajukan PBO' : 'Ubah PBO'}</h3>
            <p className="text-[11px] text-stone-500">{nomor}</p>
          </div>
          <button onClick={onBatal} className="text-stone-400 hover:text-stone-700"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {bpMilik.length > 1 && (
            <div>
              <label className="block text-[11px] text-stone-500 mb-1">Badan pelayanan</label>
              <select value={bp} onChange={(e) => { setBp(e.target.value); setBaris([]); }}
                className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm bg-white">
                {bpMilik.map((b) => <option key={b.kode} value={b.kode}>{b.nama}</option>)}
              </select>
            </div>
          )}

          {memuatProgram ? (
            <p className="text-[12px] text-stone-500">Memuat program kerja…</p>
          ) : !disetujui ? (
            <p className="text-[12px] bg-red-50 border border-red-200 text-red-900 px-3 py-2.5 rounded flex items-start gap-1.5">
              <Lock size={14} className="mt-px shrink-0" />
              Program kerja tahun {tahun}–{tahun + 1} belum disetujui pembina, jadi belum ada uraian yang
              boleh dipakai. Selesaikan dulu program kerjanya.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] text-stone-500 mb-1">Bulan anggaran</label>
                  <select value={periode} onChange={(e) => setPeriode(e.target.value)}
                    className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm bg-white">
                    {bulan.map((p) => <option key={p} value={p}>{labelPeriode(p)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-stone-500 mb-1">Tanggal pengajuan</label>
                  <input type="date" value={tglAjukan} onChange={(e) => setTglAjukan(e.target.value)}
                    className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-[11px] text-stone-500 mb-1">Sumber dana</label>
                  <select value={dana} onChange={(e) => setDana(e.target.value)}
                    className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm bg-white">
                    <option value="OPS">Dana Operasional</option>
                    <option value="BTH">Dana Bethesda</option>
                  </select>
                </div>
              </div>

              {adaTunggakan && !izin && (
                <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2.5">
                  <p className="text-[12px] text-red-900 flex items-start gap-1.5">
                    <AlertTriangle size={14} className="mt-px shrink-0" />
                    LPJ {labelPeriode(bulanSebelum)} belum masuk. Demi tertib administrasi, PBO baru
                    ditahan sampai LPJ bulan sebelumnya diselesaikan.
                  </p>
                  {['ketua', 'super'].includes(peran) ? (
                    <button onClick={() => setDialogIzin(true)}
                      className="mt-2 text-[12px] px-2.5 py-1.5 border border-amber-400 text-amber-900 rounded-md hover:bg-amber-50 flex items-center gap-1">
                      <KeyRound size={12} /> Beri izin khusus
                    </button>
                  ) : (
                    <p className="text-[11px] text-red-800 mt-1.5">
                      Kalau memang mendesak, mintalah Ketua Majelis Jemaat memberi izin khusus.
                    </p>
                  )}
                </div>
              )}
              {izin && (
                <p className="text-[12px] bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 rounded">
                  Izin khusus dari {izin.oleh}: {izin.alasan}
                </p>
              )}

              <div className="border border-stone-200 rounded-md">
                <div className="px-3 py-2 border-b border-stone-200 bg-stone-50 flex justify-between items-center">
                  <span className="text-sm">Uraian program</span>
                  <button onClick={tambahBaris}
                    className="text-xs px-2 py-1 border border-stone-300 rounded hover:bg-white">Tambah baris</button>
                </div>
                <div className="p-3 space-y-3">
                  {baris.length === 0 && (
                    <p className="text-[12px] text-stone-500 text-center py-3">
                      Belum ada uraian. Tekan Tambah baris, lalu pilih dari program kerja.
                    </p>
                  )}
                  {baris.map((b, i) => {
                    const kunci = b.ambilDari || periode;
                    const jatah = pagu(b.kegiatanId, kunci);
                    const sisa = sisaEmber(b.kegiatanId, kunci, b.id);
                    const lewat = b.kegiatanId && Number(b.nominal) > sisa;
                    return (
                      <div key={b.id} className="border border-stone-200 rounded-md p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="text-[11px] text-stone-400 mt-2 w-4 shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0 space-y-2">
                            <select value={b.kegiatanId} onChange={(e) => pilihKegiatan(b.id, e.target.value)}
                              className={`w-full border rounded-md px-2 py-1.5 text-sm bg-white ${b.kegiatanId ? 'border-stone-300' : 'border-red-300'}`}>
                              <option value="">Pilih uraian dari program kerja…</option>
                              {opsi.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}
                            </select>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] text-stone-500 mb-0.5">Nominal</label>
                                <InputRupiah nilai={b.nominal} onUbah={(v) => ubahBaris(b.id, { nominal: v })} />
                              </div>
                              <div>
                                <label className="block text-[10px] text-stone-500 mb-0.5">Ambil dari anggaran bulan</label>
                                <select value={b.ambilDari} onChange={(e) => ubahBaris(b.id, { ambilDari: e.target.value })}
                                  className="w-full border border-stone-300 rounded-md px-2 py-2 text-sm bg-white">
                                  <option value="">Bulan ini</option>
                                  {bulan.filter((p) => p !== periode).map((p) => {
                                    const s2 = sisaEmber(b.kegiatanId, p, b.id);
                                    return (
                                      <option key={p} value={p} disabled={b.kegiatanId && s2 <= 0}>
                                        {labelBulanPendek(p)}{b.kegiatanId ? ` · sisa ${rp(s2)}` : ''}
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                            </div>

                            {b.kegiatanId && (
                              <div className={`text-[11px] rounded px-2 py-1.5 ${
                                jatah === 0 ? 'bg-stone-50 text-stone-600'
                                  : lewat ? 'bg-red-50 text-red-800' : 'bg-teal-50 text-teal-900'}`}>
                                {jatah === 0 ? (
                                  <span>Tidak ada anggaran untuk uraian ini di {labelBulanPendek(kunci)}</span>
                                ) : (
                                  <>
                                    <div className="flex justify-between gap-3">
                                      <span>Anggaran {labelBulanPendek(kunci)}</span>
                                      <span>{rp(jatah)}</span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                      <span>Sisa yang boleh diajukan</span>
                                      <span className="font-medium">{rp(sisa)}</span>
                                    </div>
                                    {lewat && (
                                      <p className="mt-1">
                                        {sisa <= 0
                                          ? 'Anggaran bulan ini sudah habis diajukan. Pilih bulan lain yang masih bersisa.'
                                          : `Melebihi sisa sebesar ${rp(Number(b.nominal) - sisa)}.`}
                                      </p>
                                    )}
                                  </>
                                )}
                              </div>
                            )}

                            <input value={b.catatan} onChange={(e) => ubahBaris(b.id, { catatan: e.target.value })}
                              placeholder="Catatan tambahan, boleh dikosongkan"
                              className="w-full border border-stone-300 rounded-md px-2 py-1.5 text-[13px]" />
                          </div>
                          <button onClick={() => setBaris((v) => v.filter((x) => x.id !== b.id))}
                            className="p-1.5 text-stone-400 hover:text-red-600 shrink-0"><X size={15} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="px-3 py-2 border-t border-stone-200 bg-stone-50 flex justify-between text-sm">
                  <span>Jumlah pengajuan</span>
                  <span className="font-medium">{rp(total)}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-stone-500 mb-1.5">Rekening penerima</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input value={penerima.nama} onChange={(e) => setPenerima({ ...penerima, nama: e.target.value })}
                    placeholder="Nama pemilik rekening"
                    className="sm:col-span-2 w-full border border-stone-300 rounded-md px-3 py-2 text-sm" />
                  <input value={penerima.bank} onChange={(e) => setPenerima({ ...penerima, bank: e.target.value })}
                    placeholder="Bank"
                    className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm" />
                </div>
                <input value={penerima.noRek} onChange={(e) => setPenerima({ ...penerima, noRek: e.target.value })}
                  placeholder="Nomor rekening"
                  className="w-full mt-2 border border-stone-300 rounded-md px-3 py-2 text-sm" />
                <p className="text-[11px] text-stone-500 mt-1">Diingat dari pengajuan sebelumnya, ganti bila penerimanya berbeda</p>
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-stone-200 sticky bottom-0 bg-white space-y-2">
          {kurang.length > 0 && (
            <p className="text-[12px] bg-amber-50 text-amber-900 px-3 py-2 rounded flex items-start gap-1.5">
              <AlertTriangle size={14} className="mt-px shrink-0" />
              <span>Belum bisa diajukan karena {kurang.join(', ')}.</span>
            </p>
          )}
          <div className="flex flex-wrap gap-3 justify-between items-center">
          <p className="text-[12px] text-stone-600">{baris.length} uraian · {rp(total)}</p>
          <div className="flex gap-2">
            <button onClick={onBatal} className="px-3 py-2 text-sm border border-stone-300 rounded-md hover:bg-stone-50">Batal</button>
            <button onClick={kirim} disabled={!sah}
              className="px-4 py-2 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800 disabled:bg-stone-300 flex items-center gap-1.5">
              <Send size={15} /> {perluPembina ? 'Ajukan ke pembina' : 'Ajukan ke bendahara'}
            </button>
          </div>
          </div>
        </div>
      </div>

      {dialogIzin && (
        <DialogIzin onBatal={() => setDialogIzin(false)}
          onSimpan={(alasan) => { setIzin({ oleh: profil?.nama || '', tgl: hariIni(), alasan }); setDialogIzin(false); }} />
      )}
    </div>
  );
}

function susunNomor(daftar, bp, periode) {
  const urut = daftar.filter((p) => p.bp === bp && p.periodeAnggaran === periode).length + 1;
  return `PBO/${bp}/${periode}/${String(urut).padStart(2, '0')}`;
}

/* ─────────── Dialog ─────────── */

function DialogIzin({ onBatal, onSimpan }) {
  const [alasan, setAlasan] = useState('');
  return (
    <div className="fixed inset-0 bg-stone-900/50 flex items-start justify-center p-4 py-10 z-50 overflow-y-auto overscroll-contain">
      <div className="bg-white rounded-lg w-full max-w-sm p-5 my-auto mx-auto">
        <h3 className="text-base font-medium mb-1.5">Izin khusus Ketua Majelis Jemaat</h3>
        <p className="text-sm text-stone-600 mb-4">
          PBO ini boleh diajukan walau LPJ bulan sebelumnya belum masuk. Alasannya tersimpan
          pada dokumen dan terlihat oleh bendahara.
        </p>
        <textarea value={alasan} onChange={(e) => setAlasan(e.target.value)} rows={3}
          placeholder="Misalnya: kegiatan mendesak, LPJ menyusul paling lambat tanggal 20"
          className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm resize-none" />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onBatal} className="px-3 py-2 text-sm border border-stone-300 rounded-md hover:bg-stone-50">Batal</button>
          <button onClick={() => onSimpan(alasan.trim())} disabled={alasan.trim().length < 15}
            className="px-3 py-2 text-sm bg-amber-700 text-white rounded-md hover:bg-amber-800 disabled:bg-stone-300">Beri izin</button>
        </div>
      </div>
    </div>
  );
}

function DialogVerifikasi({ pbo, tahap, namaBP, onBatal, onSimpan }) {
  const [setuju, setSetuju] = useState(true);
  const [catatan, setCatatan] = useState('');
  const kurang = !setuju && catatan.trim().length < 15;

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-start justify-center p-4 py-10 z-50 overflow-y-auto overscroll-contain">
      <div className="bg-white rounded-lg w-full max-w-md my-auto mx-auto">
        <div className="px-5 py-4 border-b border-stone-200">
          <h3 className="text-base font-medium">
            {tahap === 'pembina' ? 'Pemeriksaan pembina' : 'Verifikasi bendahara'}
          </h3>
          <p className="text-[11px] text-stone-500">{namaBP(pbo.bp)} · {pbo.nomor}</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-stone-50 rounded-md px-4 py-3 space-y-1.5">
            {[['Bulan anggaran', labelPeriode(pbo.periodeAnggaran)],
              ['Jumlah pengajuan', rp(totalPBO(pbo))],
              ['Sumber dana', DANA[pbo.dana] || pbo.dana],
              ['Penerima', `${pbo.penerima?.nama} · ${pbo.penerima?.bank} ${pbo.penerima?.noRek}`]].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm gap-4">
                <span className="text-stone-500 shrink-0">{k}</span><span className="text-right">{v}</span>
              </div>
            ))}
          </div>

          {tahap === 'pembina' && (
            <p className="text-[12px] bg-stone-50 text-stone-700 px-3 py-2 rounded flex items-start gap-1.5">
              <Info size={14} className="mt-px shrink-0" />
              Setelah diteruskan, pengajuan ini masuk ke Bendahara Majelis Jemaat untuk persetujuan akhir
              dan pencairan.
            </p>
          )}

          {pbo.baris?.some((b) => b.ambilDari) && (
            <p className="text-[12px] bg-amber-50 text-amber-900 px-3 py-2 rounded flex items-start gap-1.5">
              <Info size={14} className="mt-px shrink-0" />
              Ada uraian yang mengambil anggaran dari bulan lain. Periksa agar tidak terhitung dua kali.
            </p>
          )}

          <div className="flex gap-1.5">
            <button onClick={() => setSetuju(true)}
              className={`flex-1 px-3 py-2 rounded-md text-sm border ${setuju ? 'bg-teal-700 text-white border-teal-700' : 'bg-white border-stone-300'}`}>
              {tahap === 'pembina' ? 'Teruskan' : 'Setujui'}
            </button>
            <button onClick={() => setSetuju(false)}
              className={`flex-1 px-3 py-2 rounded-md text-sm border ${!setuju ? 'bg-red-700 text-white border-red-700' : 'bg-white border-stone-300'}`}>
              Kembalikan
            </button>
          </div>

          <div>
            <label className="block text-[11px] text-stone-500 mb-1">
              {setuju ? 'Catatan (opsional)' : 'Alasan pengembalian'}
            </label>
            <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={3}
              placeholder={setuju ? 'Misalnya: konsumsi agar dihemat' : 'Bagian mana yang perlu diperbaiki'}
              className={`w-full border rounded-md px-3 py-2 text-sm resize-none ${kurang && catatan ? 'border-red-300' : 'border-stone-300'}`} />
            {kurang && <p className="text-[11px] text-amber-700 mt-1">Alasan minimal lima belas huruf.</p>}
          </div>
        </div>
        <div className="px-5 py-4 border-t border-stone-200 flex justify-end gap-2">
          <button onClick={onBatal} className="px-3 py-2 text-sm border border-stone-300 rounded-md hover:bg-stone-50">Batal</button>
          <button onClick={() => onSimpan({ pbo, setuju, catatan: catatan.trim(), tahap })} disabled={kurang}
            className={`px-4 py-2 text-sm text-white rounded-md disabled:bg-stone-300 flex items-center gap-1.5 ${
              setuju ? 'bg-teal-700 hover:bg-teal-800' : 'bg-red-700 hover:bg-red-800'}`}>
            {setuju
              ? <><CheckCircle2 size={15} /> {tahap === 'pembina' ? 'Teruskan ke bendahara' : 'Setujui'}</>
              : <><Undo2 size={15} /> Kembalikan</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function DialogCair({ pbo, onBatal, onSimpan }) {
  const [tglCair, setTglCair] = useState(hariIni());
  const [akun, setAkun] = useState(pbo.dana === 'BTH' ? 'BNI-BTH' : 'BCA-OPS');
  const [catatan, setCatatan] = useState('');

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-start justify-center p-4 py-10 z-50 overflow-y-auto overscroll-contain">
      <div className="bg-white rounded-lg w-full max-w-sm p-5 my-auto mx-auto">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
            <Banknote size={16} className="text-teal-700" />
          </span>
          <div>
            <h3 className="text-base font-medium">Catat pencairan</h3>
            <p className="text-[11px] text-stone-500">{pbo.nomor} · {rp(totalPBO(pbo))}</p>
          </div>
        </div>

        <p className="text-[12px] bg-stone-50 text-stone-700 px-3 py-2 rounded mb-4 flex items-start gap-1.5">
          <ShieldCheck size={14} className="mt-px shrink-0" />
          Uang keluar hari ini, tetapi belum menjadi beban badan pelayanan. Ia tercatat sebagai
          piutang sampai LPJ diterima.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] text-stone-500 mb-1">Tanggal cair</label>
            <input type="date" value={tglCair} onChange={(e) => setTglCair(e.target.value)}
              className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] text-stone-500 mb-1">Dari rekening</label>
            <select value={akun} onChange={(e) => setAkun(e.target.value)}
              className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm bg-white">
              <option value="BCA-OPS">BCA Giro — Rekening Belanja</option>
              <option value="BNI-OPS">BNI — Penampung Persembahan</option>
              <option value="BNI-BTH">BNI — Bethesda</option>
              <option value="KAS-TUNAI">Kas Tunai Sekretariat</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-stone-500 mb-1">Catatan (opsional)</label>
            <input value={catatan} onChange={(e) => setCatatan(e.target.value)}
              placeholder="Misalnya: transfer BI-Fast"
              className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onBatal} className="px-3 py-2 text-sm border border-stone-300 rounded-md hover:bg-stone-50">Batal</button>
          <button onClick={() => onSimpan({ pbo, tglCair, akun, catatan: catatan.trim() })}
            className="px-4 py-2 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800 flex items-center gap-1.5">
            <Save size={15} /> Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
