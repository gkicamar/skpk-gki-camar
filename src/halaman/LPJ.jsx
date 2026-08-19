import React, { useEffect, useMemo, useState } from 'react';
import {
  collection, doc, onSnapshot, setDoc, getDoc, serverTimestamp, query, where,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase/config.js';
import { useAuth } from '../konteks/Auth.jsx';
import { InputRupiah, PilihBP } from '../komponen/Dasar.jsx';
import {
  rp, periodeTP, labelPeriode, labelBulanPendek, tanggalPanjang, tpBerjalan,
  hariIni, kompresGambar, ukuranBerkas,
} from '../util/format.js';
import {
  Plus, X, Save, Send, CheckCircle2, Undo2, Printer, Info, AlertTriangle,
  ChevronDown, ChevronRight, Paperclip, Trash2, Camera, Receipt, Banknote, Lock,
} from 'lucide-react';

const STATUS = {
  draf:             { label: 'Draf',                warna: 'bg-stone-100 text-stone-700' },
  diajukan:         { label: 'Menunggu pembina',    warna: 'bg-amber-50 text-amber-900' },
  diperiksaPembina: { label: 'Menunggu bendahara',  warna: 'bg-blue-50 text-blue-900' },
  disetujui:        { label: 'Disetujui',           warna: 'bg-teal-50 text-teal-900' },
  dikembalikan:     { label: 'Dikembalikan',        warna: 'bg-red-50 text-red-900' },
};

const BATAS_BERKAS = 2 * 1024 * 1024;
const MIN_EVALUASI = 40;

const idLPJ = (bp, periode) => `${bp}_${periode}`;
const jumlahRealisasi = (l) => (l?.baris || []).reduce((s, b) => s + (Number(b.realisasi) || 0), 0);

export default function LPJ({ beritahu }) {
  const { profil, peran, bpSaya } = useAuth();
  const pusat = ['super', 'ketua', 'bendahara'].includes(peran);

  const [bpDaftar, setBpDaftar] = useState([]);
  const [daftar, setDaftar] = useState([]);
  const [pboSemua, setPboSemua] = useState([]);
  const [tahun, setTahun] = useState(tpBerjalan());
  const [bpSaring, setBpSaring] = useState('SEMUA');
  const [buka, setBuka] = useState(null);
  const [form, setForm] = useState(null);
  const [verifikasi, setVerifikasi] = useState(null);
  const [tampil, setTampil] = useState(20);

  const bulan = useMemo(() => periodeTP(tahun), [tahun]);

  useEffect(() => onSnapshot(collection(db, 'badanPelayanan'), (s) =>
    setBpDaftar(s.docs.map((x) => ({ kode: x.id, ...x.data() })).filter((x) => x.aktif !== false))), []);

  const jangkauan = useMemo(() => {
    if (peran !== 'pembina') return bpSaya;
    const turunan = bpDaftar.filter((b) => b.divisi && bpSaya.includes(b.divisi)).map((b) => b.kode);
    return [...new Set([...bpSaya, ...turunan])];
  }, [peran, bpSaya, bpDaftar]);

  useEffect(() => {
    if (!pusat && jangkauan.length === 0) { setDaftar([]); return; }
    const acuan = pusat ? collection(db, 'lpj')
      : query(collection(db, 'lpj'), where('bp', 'in', jangkauan.slice(0, 30)));
    return onSnapshot(acuan, (s) => setDaftar(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => setDaftar([]));
  }, [pusat, jangkauan.join(',')]);

  useEffect(() => {
    if (!pusat && jangkauan.length === 0) { setPboSemua([]); return; }
    const acuan = pusat ? collection(db, 'pbo')
      : query(collection(db, 'pbo'), where('bp', 'in', jangkauan.slice(0, 30)));
    return onSnapshot(acuan, (s) => setPboSemua(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => setPboSemua([]));
  }, [pusat, jangkauan.join(',')]);

  const namaBP = (k) => bpDaftar.find((b) => b.kode === k)?.nama || k;

  const tersaring = useMemo(() => daftar
    .filter((l) => l.tahunPelayanan === tahun)
    .filter((l) => bpSaring === 'SEMUA' || l.bp === bpSaring)
    .sort((a, b) => (b.periodeAnggaran || '').localeCompare(a.periodeAnggaran || '')),
    [daftar, tahun, bpSaring]);

  useEffect(() => setTampil(20), [tahun, bpSaring]);

  // Bulan yang PBO-nya sudah cair tetapi LPJ-nya belum disetujui.
  const tertunggak = useMemo(() => {
    const kunci = new Map();
    pboSemua.filter((p) => p.status === 'dicairkan' && p.tahunPelayanan === tahun)
      .forEach((p) => {
        const k = `${p.bp}_${p.periodeAnggaran}`;
        kunci.set(k, (kunci.get(k) || 0) + (Number(p.total) || 0));
      });
    daftar.filter((l) => l.status === 'disetujui').forEach((l) => kunci.delete(idLPJ(l.bp, l.periodeAnggaran)));
    return [...kunci.entries()].map(([k, nilai]) => {
      const [bp, periode] = [k.slice(0, k.lastIndexOf('_')), k.slice(k.lastIndexOf('_') + 1)];
      return { bp, periode, nilai };
    }).filter((x) => pusat || jangkauan.includes(x.bp));
  }, [pboSemua, daftar, tahun, pusat, jangkauan]);

  const simpan = async ({ id, baru, ...isi }) => {
    const kunci = id || idLPJ(isi.bp, isi.periodeAnggaran);
    const bersih = Object.fromEntries(Object.entries(isi).filter(([, v]) => v !== undefined));
    try {
      await setDoc(doc(db, 'lpj', kunci), {
        ...bersih, diperbarui: serverTimestamp(), diperbaruiOleh: profil?.nama || '',
      }, { merge: true });
      setForm(null);
      beritahu(isi.status === 'draf' ? 'LPJ disimpan sebagai draf' : 'LPJ diajukan');
    } catch (e) {
      beritahu(e.code === 'permission-denied'
        ? 'Tidak berhak menyusun LPJ untuk badan pelayanan ini.'
        : `Gagal menyimpan: ${e.message || e.code}`, 'info');
    }
  };

  const putusan = async ({ lpj, setuju, catatan, tahap }) => {
    const riwayat = [...(lpj.riwayat || []), {
      tgl: hariIni(), oleh: profil?.nama || '',
      tindakan: setuju ? (tahap === 'pembina' ? 'periksaPembina' : 'setuju') : 'kembalikan', catatan,
    }].slice(-20);
    const status = !setuju ? 'dikembalikan' : tahap === 'pembina' ? 'diperiksaPembina' : 'disetujui';
    try {
      await setDoc(doc(db, 'lpj', lpj.id), {
        status, riwayat, diperbarui: serverTimestamp(),
        ...(tahap === 'pembina'
          ? { catatanPembina: catatan, diperiksaOleh: profil?.nama || '', tglPeriksa: hariIni() }
          : { catatanVerifikasi: catatan, diverifikasiOleh: profil?.nama || '', tglVerifikasi: hariIni() }),
      }, { merge: true });

      // Setelah LPJ disetujui, PBO bulan itu ditandai selesai supaya penjaga
      // pengajuan bulan berikutnya terbuka.
      if (status === 'disetujui') {
        const cocok = pboSemua.filter((p) => p.bp === lpj.bp && p.periodeAnggaran === lpj.periodeAnggaran);
        await Promise.all(cocok.map((p) =>
          setDoc(doc(db, 'pbo', p.id), { lpjSelesai: true }, { merge: true }).catch(() => null)));
      }
      setVerifikasi(null);
      beritahu(!setuju ? 'LPJ dikembalikan ke penyusun'
        : tahap === 'pembina' ? 'Diteruskan ke Bendahara Majelis Jemaat' : 'LPJ disetujui, PBO bulan itu ditutup');
    } catch (e) {
      beritahu('Tidak berhak memverifikasi LPJ ini.', 'info');
    }
  };

  const bpMilik = bpDaftar.filter((b) => bpSaya.includes(b.kode));

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
        {(pusat || jangkauan.length > 1) && (
          <div className="min-w-[220px] flex-1">
            <PilihBP nilai={bpSaring === 'SEMUA' ? '' : bpSaring}
              daftar={bpDaftar.filter((b) => pusat || jangkauan.includes(b.kode))}
              bpSaya={bpSaya} onPilih={(k) => setBpSaring(k || 'SEMUA')} />
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
              <Plus size={15} /> Susun LPJ
            </button>
          )}
        </div>
      </div>

      {tertunggak.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <p className="text-sm font-medium text-amber-900 flex items-center gap-1.5">
            <AlertTriangle size={15} /> {tertunggak.length} bulan belum ada LPJ yang disetujui
          </p>
          <p className="text-[12px] text-amber-900 mt-1">
            PBO bulan-bulan berikut sudah cair tetapi pertanggungjawabannya belum selesai. Selama
            belum beres, pengajuan bulan berikutnya ditahan.
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tertunggak.slice(0, 12).map((t) => (
              <span key={`${t.bp}_${t.periode}`}
                className="text-[11px] px-2 py-1 rounded bg-white border border-amber-200 text-amber-900">
                {namaBP(t.bp)} · {labelBulanPendek(t.periode)} · {rp(t.nilai)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-stone-200 overflow-hidden print-flat">
        <div className="px-4 py-3 border-b border-stone-100">
          <h3 className="text-sm font-medium">Laporan pertanggungjawaban keuangan</h3>
          <p className="text-[11px] text-stone-500">
            Satu laporan untuk satu bulan, menggabungkan seluruh PBO bulan itu
          </p>
        </div>

        {tersaring.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-stone-500">Belum ada LPJ pada saringan ini.</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {tersaring.slice(0, tampil).map((l) => (
              <BarisLPJ key={l.id} lpj={l} namaBP={namaBP} peran={peran} milik={jangkauan.includes(l.bp)}
                punyaSendiri={bpSaya.includes(l.bp)}
                terbuka={buka === l.id} onBuka={() => setBuka(buka === l.id ? null : l.id)}
                onSunting={() => setForm({ ...l, baru: false })}
                onVerifikasi={(tahap) => setVerifikasi({ lpj: l, tahap })} />
            ))}
            {tersaring.length > tampil && (
              <div className="px-4 py-3 text-center no-print">
                <button onClick={() => setTampil((v) => v + 20)}
                  className="text-[13px] px-3 py-2 border border-stone-300 rounded-md hover:bg-stone-50">
                  Tampilkan {Math.min(20, tersaring.length - tampil)} lagi
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {form && (
        <FormLPJ isi={form} bpMilik={bpMilik} bulan={bulan} tahun={tahun}
          pboSemua={pboSemua} daftar={daftar} peran={peran} profil={profil}
          onBatal={() => setForm(null)} onSimpan={simpan} beritahu={beritahu} />
      )}
      {verifikasi && (
        <DialogVerifikasi lpj={verifikasi.lpj} tahap={verifikasi.tahap} namaBP={namaBP}
          onBatal={() => setVerifikasi(null)} onSimpan={putusan} />
      )}
    </div>
  );
}

/* ─────────── Satu baris LPJ ─────────── */

function BarisLPJ({ lpj, namaBP, peran, milik, punyaSendiri, terbuka, onBuka, onSunting, onVerifikasi }) {
  const st = STATUS[lpj.status] || STATUS.draf;
  const bendahara = ['bendahara', 'super', 'ketua'].includes(peran);
  const realisasi = jumlahRealisasi(lpj);
  const sisa = (Number(lpj.totalPBO) || 0) + (Number(lpj.donatur) || 0) - realisasi;
  const serapan = lpj.pagu > 0 ? Math.round((realisasi / lpj.pagu) * 100) : null;

  const bolehSunting = punyaSendiri && ['draf', 'dikembalikan'].includes(lpj.status);
  const giliranPembina = lpj.status === 'diajukan' && (peran === 'super' || (peran === 'pembina' && milik));
  const giliranBendahara = lpj.status === 'diperiksaPembina' && bendahara;

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <button onClick={onBuka} className="mt-0.5 text-stone-400 hover:text-teal-700 shrink-0 no-print">
          {terbuka ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{namaBP(lpj.bp)}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${st.warna}`}>{st.label}</span>
            {serapan !== null && serapan > 100 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-800">serapan {serapan}%</span>
            )}
          </div>
          <p className="text-[11px] text-stone-500 mt-0.5">
            {labelPeriode(lpj.periodeAnggaran)} · {lpj.baris?.length || 0} uraian
            {lpj.lampiran?.length > 0 && ` · ${lpj.lampiran.length} lampiran`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-medium">{rp(realisasi)}</p>
          <p className={`text-[11px] ${sisa < 0 ? 'text-amber-800' : 'text-teal-700'}`}>
            {sisa === 0 ? 'terpakai pas' : sisa > 0 ? `kembali ${rp(sisa)}` : `kurang ${rp(-sisa)}`}
          </p>
          <div className="flex gap-1 justify-end mt-1 no-print">
            {bolehSunting && (
              <button onClick={onSunting}
                className="text-[12px] px-2.5 py-1 border border-stone-300 rounded-md hover:bg-stone-50">Ubah</button>
            )}
            {giliranPembina && (
              <button onClick={() => onVerifikasi('pembina')}
                className="text-[12px] px-2.5 py-1 border border-stone-300 rounded-md hover:bg-stone-50">Periksa</button>
            )}
            {giliranBendahara && (
              <button onClick={() => onVerifikasi('bendahara')}
                className="text-[12px] px-2.5 py-1 border border-teal-600 text-teal-800 rounded-md hover:bg-teal-50">Verifikasi</button>
            )}
          </div>
        </div>
      </div>

      {terbuka && (
        <div className="mt-3 ml-7 space-y-3">
          {lpj.status === 'dikembalikan' && (lpj.catatanVerifikasi || lpj.catatanPembina) && (
            <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2">
              <Undo2 size={14} className="text-red-800 mt-0.5 shrink-0" />
              <p className="text-[12px] text-red-900">{lpj.catatanVerifikasi || lpj.catatanPembina}</p>
            </div>
          )}

          <div className="border border-stone-200 rounded-md overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-stone-500 bg-stone-50 border-b border-stone-200">
                  <th className="text-left font-normal px-3 py-2 w-8">No</th>
                  <th className="text-left font-normal px-3 py-2">Program</th>
                  <th className="text-right font-normal px-3 py-2 w-28">Anggaran</th>
                  <th className="text-right font-normal px-3 py-2 w-28">Realisasi</th>
                  <th className="text-center font-normal px-3 py-2 w-14">Bon</th>
                </tr>
              </thead>
              <tbody>
                {(lpj.baris || []).map((b, i) => (
                  <tr key={b.id || i} className="border-b border-stone-50">
                    <td className="px-3 py-1.5 text-stone-500">{i + 1}</td>
                    <td className="px-3 py-1.5">
                      {b.uraian}
                      {b.evaluasi && <span className="text-[11px] text-stone-500 block">{b.evaluasi}</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right text-stone-600">{b.anggaran ? rp(b.anggaran) : '—'}</td>
                    <td className="px-3 py-1.5 text-right">{b.realisasi ? rp(b.realisasi) : '—'}</td>
                    <td className="px-3 py-1.5 text-center text-[11px] text-stone-500">{b.bonSementara || 'N'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-stone-50 rounded-md px-4 py-3 space-y-1 text-sm">
            {[['PBO dicairkan', rp(lpj.totalPBO)],
              ['Donatur', lpj.donatur ? rp(lpj.donatur) : '—'],
              ['Realisasi', rp(realisasi)],
              [sisa >= 0 ? 'Dikembalikan' : 'Ditambah gereja', rp(Math.abs(sisa))]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <span className="text-stone-600">{k}</span><span className="font-medium">{v}</span>
              </div>
            ))}
            {serapan !== null && (
              <div className="flex justify-between gap-4 pt-1 border-t border-stone-200">
                <span className="text-stone-600">Serapan terhadap pagu program kerja</span>
                <span className={`font-medium ${serapan > 100 ? 'text-red-700' : ''}`}>{serapan}%</span>
              </div>
            )}
          </div>

          {lpj.donatur > 0 && (
            <p className="text-[11px] bg-stone-50 text-stone-600 px-3 py-2 rounded">
              Donatur tidak menambah pagu. Ia penerimaan gereja, jadi realisasi tetap dihitung penuh
              terhadap anggaran walau uang yang dikembalikan menjadi lebih besar.
            </p>
          )}

          {lpj.evaluasi?.keberhasilan && (
            <div className="space-y-2">
              {[['Yang berjalan baik', lpj.evaluasi.keberhasilan], ['Kendala', lpj.evaluasi.kendala],
                ['Akar masalah', lpj.evaluasi.akarMasalah], ['Rekomendasi', lpj.evaluasi.rekomendasi],
                ['Tindak lanjut', lpj.evaluasi.tindakLanjut]].filter((x) => x[1]).map(([k, v]) => (
                <div key={k}>
                  <p className="text-[10px] uppercase tracking-wider text-stone-500 mb-0.5">{k}</p>
                  <p className="text-[12px] text-stone-700 whitespace-pre-line">{v}</p>
                </div>
              ))}
            </div>
          )}

          {lpj.lampiran?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-stone-500 mb-1.5">Lampiran</p>
              <div className="flex flex-wrap gap-1.5">
                {lpj.lampiran.map((f) => (
                  <a key={f.id} href={f.url} target="_blank" rel="noreferrer"
                    className="text-[12px] px-2.5 py-1.5 rounded-md border border-stone-300 hover:bg-stone-50 flex items-center gap-1.5">
                    {f.jenis === 'kegiatan' ? <Camera size={12} /> : <Receipt size={12} />}
                    <span className="max-w-[160px] truncate">{f.nama}</span>
                    <span className="text-stone-400">{ukuranBerkas(f.ukuran)}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────── Formulir LPJ ─────────── */

function FormLPJ({ isi, bpMilik, bulan, tahun, pboSemua, daftar, peran, profil, onBatal, onSimpan, beritahu }) {
  const [bp, setBp] = useState(isi.bp || bpMilik[0]?.kode || '');
  const [periode, setPeriode] = useState(isi.periodeAnggaran || '');
  const [tglLPJ, setTglLPJ] = useState(isi.tglLPJ || hariIni());
  const [baris, setBaris] = useState(isi.baris || []);
  const [donatur, setDonatur] = useState(Number(isi.donatur) || 0);
  const [lampiran, setLampiran] = useState(isi.lampiran || []);
  const [evaluasi, setEvaluasi] = useState(isi.evaluasi || {
    keberhasilan: '', kendala: '', akarMasalah: '', rekomendasi: '', tindakLanjut: '',
  });
  const [program, setProgram] = useState(null);
  const [bagian, setBagian] = useState('keuangan');
  const [unggah, setUnggah] = useState(false);

  useEffect(() => {
    if (!bp) return;
    getDoc(doc(db, 'programKerja', `${tahun}_${bp}`))
      .then((s) => setProgram(s.exists() ? s.data() : null)).catch(() => setProgram(null));
  }, [bp, tahun]);

  // Bulan yang PBO-nya sudah cair dan belum punya LPJ disetujui.
  const bulanTersedia = useMemo(() => {
    const punya = new Set(daftar.filter((l) => l.bp === bp && l.status === 'disetujui')
      .map((l) => l.periodeAnggaran));
    return bulan.filter((p) => {
      if (isi.periodeAnggaran === p) return true;
      if (punya.has(p)) return false;
      return pboSemua.some((x) => x.bp === bp && x.periodeAnggaran === p && x.status === 'dicairkan');
    });
  }, [bulan, bp, pboSemua, daftar, isi.periodeAnggaran]);

  useEffect(() => {
    if (!periode && bulanTersedia.length > 0) setPeriode(bulanTersedia[0]);
  }, [bulanTersedia, periode]);

  const pboBulan = useMemo(() =>
    pboSemua.filter((p) => p.bp === bp && p.periodeAnggaran === periode && p.status === 'dicairkan'),
    [pboSemua, bp, periode]);
  const totalPBO = pboBulan.reduce((s, p) => s + (Number(p.total) || 0), 0);

  // Pagu bulan itu menurut program kerja, dipakai menghitung serapan.
  const pagu = useMemo(() => {
    if (!program?.baris) return 0;
    return program.baris.reduce((s, b) => {
      const v = b.bulan?.[periode];
      return s + (typeof v === 'number' ? v : 0);
    }, 0);
  }, [program, periode]);

  // Baris LPJ diisi otomatis dari uraian PBO bulan itu supaya tidak mengetik ulang.
  const tarikDariPBO = () => {
    const dipakai = new Set(baris.map((b) => b.kegiatanId).filter(Boolean));
    const tambahan = [];
    pboBulan.forEach((p) => (p.baris || []).forEach((x) => {
      if (dipakai.has(x.kegiatanId)) return;
      dipakai.add(x.kegiatanId);
      tambahan.push({
        id: 'L' + Date.now() + Math.random().toString(36).slice(2, 6),
        kegiatanId: x.kegiatanId, uraian: x.uraian,
        anggaran: Number(x.nominal) || 0, realisasi: 0,
        bonSementara: 'N', noNota: '', evaluasi: '',
      });
    }));
    if (tambahan.length === 0) return beritahu('Semua uraian PBO sudah ada di daftar', 'info');
    setBaris((v) => [...v, ...tambahan]);
  };

  const ubahBaris = (id, ubah) => setBaris((v) => v.map((b) => (b.id === id ? { ...b, ...ubah } : b)));

  const pilihBerkas = async (e, jenis) => {
    const berkas = [...(e.target.files || [])];
    e.target.value = '';
    if (berkas.length === 0) return;
    setUnggah(true);
    for (const asli of berkas) {
      try {
        const kecil = await kompresGambar(asli);
        if (kecil.size > BATAS_BERKAS) {
          beritahu(`${asli.name} masih ${ukuranBerkas(kecil.size)}, terlalu besar`, 'info');
          continue;
        }
        const id = 'F' + Date.now() + Math.random().toString(36).slice(2, 6);
        const acuan = ref(storage, `lampiran/${bp}/${id}_${kecil.name}`);
        await uploadBytes(acuan, kecil);
        const url = await getDownloadURL(acuan);
        setLampiran((v) => [...v, { id, nama: kecil.name, ukuran: kecil.size, jenis, url, jalur: acuan.fullPath }]);
      } catch (err) {
        beritahu(`Gagal mengunggah ${asli.name}. Periksa apakah Storage sudah aktif.`, 'info');
      }
    }
    setUnggah(false);
  };

  const hapusLampiran = async (f) => {
    setLampiran((v) => v.filter((x) => x.id !== f.id));
    if (f.jalur) deleteObject(ref(storage, f.jalur)).catch(() => null);
  };

  const realisasi = baris.reduce((s, b) => s + (Number(b.realisasi) || 0), 0);
  const sisa = totalPBO + donatur - realisasi;
  const serapan = pagu > 0 ? Math.round((realisasi / pagu) * 100) : null;
  const evaluasiLengkap = ['keberhasilan', 'kendala', 'rekomendasi', 'tindakLanjut']
    .every((k) => (evaluasi[k] || '').trim().length >= MIN_EVALUASI);

  const kurang = [];
  if (!periode) kurang.push('bulan belum dipilih');
  if (baris.length === 0) kurang.push('belum ada uraian');
  if (baris.some((b) => !b.uraian)) kurang.push('ada uraian yang kosong');
  if (!evaluasiLengkap) kurang.push('bagian evaluasi belum lengkap');

  const perluPembina = Boolean(bpMilik.find((b) => b.kode === bp)?.divisi) && peran === 'pengurus';

  const kirim = (status) => onSimpan({
    ...(isi.id ? { id: isi.id } : {}),
    bp, tahunPelayanan: tahun, periodeAnggaran: periode, tglLPJ,
    baris, donatur, lampiran, evaluasi, totalPBO, pagu, realisasi,
    status: status === 'draf' ? 'draf' : (perluPembina ? 'diajukan' : 'diperiksaPembina'),
    disusunOleh: profil?.nama || '', riwayat: isi.riwayat || [],
  });

  const Isian = ({ label, kunci, contoh, baris: n = 3 }) => {
    const nilai = evaluasi[kunci] || '';
    const pendek = nilai.trim().length < MIN_EVALUASI;
    return (
      <div>
        <label className="block text-[11px] text-stone-500 mb-1">{label}</label>
        <textarea value={nilai} rows={n} placeholder={contoh}
          onChange={(e) => setEvaluasi((v) => ({ ...v, [kunci]: e.target.value }))}
          className={`w-full border rounded-md px-3 py-2 text-sm resize-none ${pendek ? 'border-amber-300' : 'border-stone-300'}`} />
        <p className={`text-[11px] mt-0.5 ${pendek ? 'text-amber-700' : 'text-stone-400'}`}>
          {nilai.trim().length} dari minimal {MIN_EVALUASI} huruf
        </p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-start justify-center z-50 overflow-y-auto overscroll-contain p-0 md:p-4">
      <div className="bg-white w-full max-w-3xl my-0 md:my-8 md:rounded-lg">
        <div className="px-5 py-4 border-b border-stone-200 flex justify-between items-center">
          <div>
            <h3 className="text-base font-medium">{isi.baru ? 'Susun LPJ' : 'Ubah LPJ'}</h3>
            <p className="text-[11px] text-stone-500">
              {bpMilik.find((b) => b.kode === bp)?.nama} · {periode ? labelPeriode(periode) : 'bulan belum dipilih'}
            </p>
          </div>
          <button onClick={onBatal} className="text-stone-400 hover:text-stone-700"><X size={18} /></button>
        </div>

        <div className="px-5 pt-4 flex gap-1.5 flex-wrap">
          {[['keuangan', 'Keuangan'], ['lampiran', `Lampiran${lampiran.length ? ` · ${lampiran.length}` : ''}`],
            ['evaluasi', evaluasiLengkap ? 'Evaluasi ✓' : 'Evaluasi · wajib']].map(([id, l]) => (
            <button key={id} onClick={() => setBagian(id)}
              className={`px-3 py-1.5 rounded-md text-sm border ${
                bagian === id ? 'bg-stone-900 text-white border-stone-900'
                  : id === 'evaluasi' && !evaluasiLengkap ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-white border-stone-300 hover:bg-stone-50'}`}>{l}</button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          {bagian === 'keuangan' && <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {bpMilik.length > 1 && (
                <div>
                  <label className="block text-[11px] text-stone-500 mb-1">Badan pelayanan</label>
                  <select value={bp} onChange={(e) => { setBp(e.target.value); setBaris([]); setPeriode(''); }}
                    className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm bg-white">
                    {bpMilik.map((b) => <option key={b.kode} value={b.kode}>{b.nama}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-[11px] text-stone-500 mb-1">Bulan</label>
                <select value={periode} onChange={(e) => { setPeriode(e.target.value); setBaris([]); }}
                  disabled={!isi.baru}
                  className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm bg-white disabled:bg-stone-100">
                  {bulanTersedia.length === 0 && <option value="">Tidak ada PBO yang perlu dilaporkan</option>}
                  {bulanTersedia.map((p) => <option key={p} value={p}>{labelPeriode(p)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-stone-500 mb-1">Tanggal LPJ</label>
                <input type="date" value={tglLPJ} onChange={(e) => setTglLPJ(e.target.value)}
                  className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm" />
              </div>
            </div>

            {periode && pboBulan.length === 0 && (
              <p className="text-[12px] bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 rounded flex items-start gap-1.5">
                <Lock size={14} className="mt-px shrink-0" />
                Belum ada PBO yang dicairkan pada bulan ini, jadi belum ada yang perlu dipertanggungjawabkan.
              </p>
            )}

            <div className="border border-stone-200 rounded-md">
              <div className="px-3 py-2 border-b border-stone-200 bg-stone-50 flex flex-wrap gap-2 justify-between items-center">
                <span className="text-sm">Rincian realisasi</span>
                <div className="flex gap-1.5">
                  {pboBulan.length > 0 && (
                    <button onClick={tarikDariPBO}
                      className="text-xs px-2 py-1 border border-teal-600 text-teal-800 rounded hover:bg-teal-50">
                      Ambil uraian dari PBO
                    </button>
                  )}
                  <button onClick={() => setBaris((v) => [...v, {
                    id: 'L' + Date.now(), kegiatanId: '', uraian: '', anggaran: 0,
                    realisasi: 0, bonSementara: 'N', noNota: '', evaluasi: '',
                  }])}
                    className="text-xs px-2 py-1 border border-stone-300 rounded hover:bg-white">Tambah baris</button>
                </div>
              </div>
              <div className="p-3 space-y-2">
                {baris.length === 0 && (
                  <p className="text-[12px] text-stone-500 text-center py-3">
                    Tekan Ambil uraian dari PBO untuk mengisi otomatis dari pengajuan bulan ini.
                  </p>
                )}
                {baris.map((b, i) => (
                  <div key={b.id} className="border border-stone-200 rounded-md p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-[11px] text-stone-400 mt-2 w-4 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0 space-y-2">
                        <input value={b.uraian} onChange={(e) => ubahBaris(b.id, { uraian: e.target.value })}
                          placeholder="Uraian program"
                          className="w-full border border-stone-300 rounded-md px-2 py-1.5 text-sm" />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-stone-500 mb-0.5">Anggaran</label>
                            <InputRupiah nilai={b.anggaran} onUbah={(v) => ubahBaris(b.id, { anggaran: v })} />
                          </div>
                          <div>
                            <label className="block text-[10px] text-stone-500 mb-0.5">Realisasi</label>
                            <InputRupiah nilai={b.realisasi} onUbah={(v) => ubahBaris(b.id, { realisasi: v })} />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] text-stone-500 mb-0.5">Bon sementara</label>
                            <select value={b.bonSementara} onChange={(e) => ubahBaris(b.id, { bonSementara: e.target.value })}
                              className="w-full border border-stone-300 rounded-md px-2 py-2 text-sm bg-white">
                              <option value="N">N</option><option value="Y">Y</option>
                            </select>
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[10px] text-stone-500 mb-0.5">Nomor nota</label>
                            <input value={b.noNota} onChange={(e) => ubahBaris(b.id, { noNota: e.target.value })}
                              placeholder="1-2" className="w-full border border-stone-300 rounded-md px-2 py-2 text-sm" />
                          </div>
                        </div>
                        <input value={b.evaluasi} onChange={(e) => ubahBaris(b.id, { evaluasi: e.target.value })}
                          placeholder="Keterangan atau evaluasi baris ini"
                          className="w-full border border-stone-300 rounded-md px-2 py-1.5 text-[13px]" />
                      </div>
                      <button onClick={() => setBaris((v) => v.filter((x) => x.id !== b.id))}
                        className="p-1.5 text-stone-400 hover:text-red-600 shrink-0"><X size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-stone-500 mb-1">Donatur</label>
              <div className="max-w-xs"><InputRupiah nilai={donatur} onUbah={setDonatur} /></div>
              <p className="text-[11px] text-stone-500 mt-1">
                Sumbangan yang diterima langsung badan pelayanan. Menambah uang yang dikembalikan,
                tetapi tidak menambah pagu anggaran.
              </p>
            </div>

            <div className="bg-stone-50 rounded-md px-4 py-3 space-y-1 text-sm">
              {[['PBO dicairkan bulan ini', rp(totalPBO)], ['Donatur', rp(donatur)],
                ['Realisasi', rp(realisasi)]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <span className="text-stone-600">{k}</span><span>{v}</span>
                </div>
              ))}
              <div className="flex justify-between gap-4 pt-1.5 border-t border-stone-200">
                <span className="font-medium">{sisa >= 0 ? 'Dikembalikan ke gereja' : 'Ditambah gereja'}</span>
                <span className={`font-medium ${sisa < 0 ? 'text-amber-800' : 'text-teal-800'}`}>{rp(Math.abs(sisa))}</span>
              </div>
              {serapan !== null && (
                <div className="flex justify-between gap-4">
                  <span className="text-stone-600">Serapan pagu program kerja</span>
                  <span className={serapan > 100 ? 'text-red-700 font-medium' : ''}>{serapan}%</span>
                </div>
              )}
            </div>

            {serapan > 100 && (
              <p className="text-[12px] bg-red-50 border border-red-200 text-red-900 px-3 py-2 rounded flex items-start gap-1.5">
                <AlertTriangle size={14} className="mt-px shrink-0" />
                Realisasi melampaui pagu program kerja. Ini tetap bisa dilaporkan, tetapi jelaskan
                sebabnya di bagian evaluasi supaya pembina bisa menilainya.
              </p>
            )}
          </>}

          {bagian === 'lampiran' && <>
            <p className="text-[12px] bg-stone-50 text-stone-700 px-3 py-2 rounded flex items-start gap-1.5">
              <Info size={14} className="mt-px shrink-0" />
              Foto diperkecil sendiri di perangkat Anda sebelum diunggah, jadi foto nota dari kamera
              ponsel yang besarnya beberapa megabita tetap muat.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[['nota', 'Foto nota dan kuitansi', Receipt], ['kegiatan', 'Dokumentasi kegiatan', Camera]].map(([jenis, judul, Ikon]) => (
                <label key={jenis}
                  className="flex flex-col items-center gap-2 px-4 py-6 border-2 border-dashed border-stone-300 rounded-md cursor-pointer hover:border-teal-600 hover:bg-teal-50">
                  <Ikon size={20} className="text-stone-400" />
                  <span className="text-sm text-center">{judul}</span>
                  <span className="text-[11px] text-stone-500">Ketuk untuk memilih, boleh sekaligus</span>
                  <input type="file" multiple accept="image/*,.pdf" className="hidden"
                    onChange={(e) => pilihBerkas(e, jenis)} disabled={unggah} />
                </label>
              ))}
            </div>

            {unggah && <p className="text-[12px] text-stone-500 text-center">Mengunggah…</p>}

            {lampiran.length > 0 && (
              <div className="space-y-1.5">
                {lampiran.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 px-3 py-2 border border-stone-200 rounded-md">
                    {f.jenis === 'kegiatan' ? <Camera size={14} className="text-stone-500 shrink-0" />
                      : <Receipt size={14} className="text-stone-500 shrink-0" />}
                    <a href={f.url} target="_blank" rel="noreferrer" className="text-[13px] flex-1 truncate hover:text-teal-700">{f.nama}</a>
                    <span className="text-[11px] text-stone-400 shrink-0">{ukuranBerkas(f.ukuran)}</span>
                    <button onClick={() => hapusLampiran(f)} className="text-stone-400 hover:text-red-600 shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>}

          {bagian === 'evaluasi' && <>
            <p className="text-[12px] bg-stone-50 text-stone-700 px-3 py-2 rounded flex items-start gap-1.5">
              <Info size={14} className="mt-px shrink-0" />
              Bagian ini wajib. LPJ tanpa evaluasi hanya membuktikan uangnya habis, bukan bahwa
              pelayanannya berjalan.
            </p>
            <Isian label="Apa yang berjalan baik, dan mengapa" kunci="keberhasilan"
              contoh="Ceritakan bagian yang berhasil beserta penyebabnya" />
            <Isian label="Kendala yang dihadapi" kunci="kendala"
              contoh="Hambatan selama persiapan maupun pelaksanaan" />
            <Isian label="Akar masalahnya menurut badan pelayanan" kunci="akarMasalah" baris={2}
              contoh="Mengapa kendala itu terjadi" />
            <Isian label="Rekomendasi untuk kegiatan sejenis berikutnya" kunci="rekomendasi"
              contoh="Saran perbaikan yang konkret" />
            <Isian label="Tindak lanjut, penanggung jawab, dan targetnya" kunci="tindakLanjut"
              contoh="Apa yang akan dikerjakan, oleh siapa, kapan" />
          </>}
        </div>

        <div className="px-5 py-4 border-t border-stone-200 sticky bottom-0 bg-white space-y-2">
          {kurang.length > 0 && (
            <p className="text-[12px] bg-amber-50 text-amber-900 px-3 py-2 rounded flex items-start gap-1.5">
              <AlertTriangle size={14} className="mt-px shrink-0" />
              <span>Belum bisa diajukan karena {kurang.join(', ')}.</span>
            </p>
          )}
          <div className="flex flex-wrap gap-3 justify-between items-center">
            <p className="text-[12px] text-stone-600">{baris.length} uraian · realisasi {rp(realisasi)}</p>
            <div className="flex gap-2">
              <button onClick={onBatal} className="px-3 py-2 text-sm border border-stone-300 rounded-md hover:bg-stone-50">Batal</button>
              <button onClick={() => kirim('draf')} disabled={!periode}
                className="px-3 py-2 text-sm border border-stone-300 rounded-md hover:bg-stone-50 disabled:opacity-40 flex items-center gap-1.5">
                <Save size={15} /> Simpan draf
              </button>
              <button onClick={() => kirim('ajukan')} disabled={kurang.length > 0}
                className="px-4 py-2 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800 disabled:bg-stone-300 flex items-center gap-1.5">
                <Send size={15} /> {perluPembina ? 'Ajukan ke pembina' : 'Ajukan ke bendahara'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Verifikasi ─────────── */

function DialogVerifikasi({ lpj, tahap, namaBP, onBatal, onSimpan }) {
  const [setuju, setSetuju] = useState(true);
  const [catatan, setCatatan] = useState('');
  const kurang = !setuju && catatan.trim().length < 15;
  const realisasi = jumlahRealisasi(lpj);
  const sisa = (Number(lpj.totalPBO) || 0) + (Number(lpj.donatur) || 0) - realisasi;
  const serapan = lpj.pagu > 0 ? Math.round((realisasi / lpj.pagu) * 100) : null;

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-start justify-center p-4 py-10 z-50 overflow-y-auto overscroll-contain">
      <div className="bg-white rounded-lg w-full max-w-md my-auto mx-auto">
        <div className="px-5 py-4 border-b border-stone-200">
          <h3 className="text-base font-medium">
            {tahap === 'pembina' ? 'Pemeriksaan pembina' : 'Verifikasi bendahara'}
          </h3>
          <p className="text-[11px] text-stone-500">{namaBP(lpj.bp)} · {labelPeriode(lpj.periodeAnggaran)}</p>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-stone-50 rounded-md px-4 py-3 space-y-1.5 text-sm">
            {[['PBO dicairkan', rp(lpj.totalPBO)], ['Donatur', rp(lpj.donatur || 0)],
              ['Realisasi', rp(realisasi)],
              [sisa >= 0 ? 'Dikembalikan' : 'Ditambah gereja', rp(Math.abs(sisa))],
              ['Lampiran', `${lpj.lampiran?.length || 0} berkas`]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <span className="text-stone-500">{k}</span><span className="text-right">{v}</span>
              </div>
            ))}
          </div>

          {serapan !== null && serapan > 100 && (
            <p className="text-[12px] bg-red-50 text-red-900 px-3 py-2 rounded flex items-start gap-1.5">
              <AlertTriangle size={14} className="mt-px shrink-0" />
              Serapan {serapan} persen dari pagu program kerja. Periksa penjelasannya di bagian evaluasi.
            </p>
          )}

          {(lpj.lampiran?.length || 0) === 0 && (
            <p className="text-[12px] bg-amber-50 text-amber-900 px-3 py-2 rounded flex items-start gap-1.5">
              <Paperclip size={14} className="mt-px shrink-0" />
              LPJ ini tidak menyertakan satu pun lampiran nota.
            </p>
          )}

          {tahap === 'bendahara' && (
            <p className="text-[12px] bg-stone-50 text-stone-700 px-3 py-2 rounded flex items-start gap-1.5">
              <Banknote size={14} className="mt-px shrink-0" />
              Setelah disetujui, seluruh PBO bulan ini ditutup dan badan pelayanan boleh mengajukan
              PBO bulan berikutnya.
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
              placeholder={setuju ? 'Misalnya: nota konsumsi agar dilengkapi bulan depan' : 'Bagian mana yang perlu diperbaiki'}
              className={`w-full border rounded-md px-3 py-2 text-sm resize-none ${kurang && catatan ? 'border-red-300' : 'border-stone-300'}`} />
            {kurang && <p className="text-[11px] text-amber-700 mt-1">Alasan minimal lima belas huruf.</p>}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-stone-200 flex justify-end gap-2">
          <button onClick={onBatal} className="px-3 py-2 text-sm border border-stone-300 rounded-md hover:bg-stone-50">Batal</button>
          <button onClick={() => onSimpan({ lpj, setuju, catatan: catatan.trim(), tahap })} disabled={kurang}
            className={`px-4 py-2 text-sm text-white rounded-md disabled:bg-stone-300 flex items-center gap-1.5 ${
              setuju ? 'bg-teal-700 hover:bg-teal-800' : 'bg-red-700 hover:bg-red-800'}`}>
            {setuju ? <><CheckCircle2 size={15} /> {tahap === 'pembina' ? 'Teruskan' : 'Setujui'}</>
              : <><Undo2 size={15} /> Kembalikan</>}
          </button>
        </div>
      </div>
    </div>
  );
}
