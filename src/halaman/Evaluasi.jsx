import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, getDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { useAuth } from '../konteks/Auth.jsx';
import { PilihBP } from '../komponen/Dasar.jsx';
import {
  rp, periodeTP, labelPeriode, labelBulanPendek, tpBerjalan, APLIKASI,
} from '../util/format.js';
import { Printer, Info, FileText } from 'lucide-react';

// Rentang laporan mengikuti kebiasaan pelaporan gereja: bulanan, kuartalan,
// semesteran, dan setahun pelayanan penuh.
const rentangDari = (tahun) => {
  const b = periodeTP(tahun);
  return {
    'Tahunan': b,
    'Semester 1': b.slice(0, 6), 'Semester 2': b.slice(6, 12),
    'Kuartal 1': b.slice(0, 3), 'Kuartal 2': b.slice(3, 6),
    'Kuartal 3': b.slice(6, 9), 'Kuartal 4': b.slice(9, 12),
  };
};

export default function Evaluasi({ beritahu }) {
  const { peran, bpSaya } = useAuth();
  const pusat = ['super', 'ketua', 'bendahara'].includes(peran);

  const [bpDaftar, setBpDaftar] = useState([]);
  const [tahun, setTahun] = useState(tpBerjalan());
  const [bpAktif, setBpAktif] = useState('');
  const [rentang, setRentang] = useState('Tahunan');
  const [program, setProgram] = useState(null);
  const [lpjSemua, setLpjSemua] = useState([]);
  const [memuat, setMemuat] = useState(true);

  useEffect(() => onSnapshot(collection(db, 'badanPelayanan'), (s) => {
    const d = s.docs.map((x) => ({ kode: x.id, ...x.data() })).filter((x) => x.aktif !== false);
    setBpDaftar(d);
    setBpAktif((v) => (v && d.some((x) => x.kode === v) ? v : (bpSaya[0] || d[0]?.kode || '')));
  }), [bpSaya]);

  const jangkauan = useMemo(() => {
    if (peran !== 'pembina') return bpSaya;
    const turunan = bpDaftar.filter((b) => b.divisi && bpSaya.includes(b.divisi)).map((b) => b.kode);
    return [...new Set([...bpSaya, ...turunan])];
  }, [peran, bpSaya, bpDaftar]);

  const bolehLihat = (b) => pusat || !b.rahasia || jangkauan.includes(b.kode);
  const bpTampil = useMemo(() => bpDaftar.filter(bolehLihat), [bpDaftar, pusat, jangkauan]);

  useEffect(() => {
    if (!bpAktif) return;
    setMemuat(true);
    getDoc(doc(db, 'programKerja', `${tahun}_${bpAktif}`))
      .then((s) => setProgram(s.exists() ? s.data() : null))
      .catch(() => setProgram(null))
      .finally(() => setMemuat(false));
  }, [tahun, bpAktif]);

  useEffect(() => {
    if (!bpAktif) return;
    return onSnapshot(query(collection(db, 'lpj'), where('bp', '==', bpAktif)),
      (s) => setLpjSemua(s.docs.map((x) => ({ id: x.id, ...x.data() }))),
      () => setLpjSemua([]));
  }, [bpAktif]);

  const bulan = useMemo(() => rentangDari(tahun)[rentang] || [rentang], [tahun, rentang]);
  const bpObj = bpDaftar.find((b) => b.kode === bpAktif);
  const indukObj = bpDaftar.find((b) => b.kode === bpObj?.divisi);

  // Gabungkan rencana dari program kerja dengan hasil dari LPJ, dijodohkan
  // lewat pengenal kegiatan yang dibawa PBO sejak pengajuan.
  const baris = useMemo(() => {
    const lpjDalam = lpjSemua.filter((l) => l.tahunPelayanan === tahun
      && bulan.includes(l.periodeAnggaran)
      && ['disetujui', 'buktiDikirim', 'selesai'].includes(l.status));

    const hasil = new Map();
    lpjDalam.forEach((l) => (l.baris || []).forEach((b) => {
      const kunci = b.kegiatanId || `x_${(b.uraian || '').toLowerCase()}`;
      const ada = hasil.get(kunci) || { realisasi: 0, pencapaian: [], evaluasi: [], uraian: b.uraian };
      ada.realisasi += Number(b.realisasi) || 0;
      if ((b.indikator || '').trim()) ada.pencapaian.push(`${labelBulanPendek(l.periodeAnggaran)}: ${b.indikator.trim()}`);
      if ((b.evaluasi || '').trim()) ada.evaluasi.push(`${labelBulanPendek(l.periodeAnggaran)}: ${b.evaluasi.trim()}`);
      hasil.set(kunci, ada);
    }));

    const semua = program?.baris || [];
    const namaInduk = (id) => semua.find((x) => x.id === id)?.nama || '';

    const dariProgram = semua.map((k) => {
      const h = hasil.get(k.id);
      hasil.delete(k.id);
      const budget = bulan.reduce((s, p) => {
        const v = k.bulan?.[p];
        return s + (typeof v === 'number' ? v : 0);
      }, 0);
      return {
        id: k.id,
        nama: k.indukId ? `${namaInduk(k.indukId)} — ${k.nama}` : k.nama,
        tujuan: k.tujuan || '',
        indikatorHasil: k.indikator || '',
        detail: k.detail || '',
        sifat: k.indukId ? (semua.find((x) => x.id === k.indukId)?.sifat || 'Rutin') : (k.sifat || 'Rutin'),
        budget,
        realisasi: h?.realisasi || 0,
        pencapaian: h?.pencapaian || [],
        evaluasi: h?.evaluasi || [],
      };
    }).filter((r) => r.budget > 0 || r.realisasi > 0 || r.pencapaian.length > 0);

    // Baris LPJ yang tidak berpasangan dengan program kerja, misalnya kegiatan
    // insidentil yang muncul di luar rencana.
    const diLuar = [...hasil.values()].map((h, i) => ({
      id: `luar_${i}`, nama: h.uraian || 'Tanpa nama', tujuan: '', indikatorHasil: '', detail: '',
      sifat: 'Di luar program kerja', budget: 0,
      realisasi: h.realisasi, pencapaian: h.pencapaian, evaluasi: h.evaluasi,
    }));

    return [...dariProgram, ...diLuar];
  }, [program, lpjSemua, tahun, bulan]);

  const kelompok = ['Rutin', 'Non Rutin', 'Di luar program kerja']
    .map((s) => ({ sifat: s, isi: baris.filter((b) => b.sifat === s) }))
    .filter((g) => g.isi.length > 0);

  const totalBudget = baris.reduce((s, b) => s + b.budget, 0);
  const totalRealisasi = baris.reduce((s, b) => s + b.realisasi, 0);
  const serapan = totalBudget > 0 ? Math.round((totalRealisasi / totalBudget) * 100) : null;

  const belumLapor = useMemo(() => bulan.filter((p) =>
    !lpjSemua.some((l) => l.periodeAnggaran === p && ['disetujui', 'buktiDikirim', 'selesai'].includes(l.status))
  ), [bulan, lpjSemua]);

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-10">

      <div className="bg-white rounded-lg border border-stone-200 p-4 flex flex-wrap gap-4 items-end no-print">
        <div className="min-w-[220px] flex-1">
          <PilihBP nilai={bpAktif} daftar={bpTampil} bpSaya={jangkauan} onPilih={setBpAktif} />
        </div>
        <div>
          <label className="block text-[11px] text-stone-500 mb-1">Tahun pelayanan</label>
          <select value={tahun} onChange={(e) => setTahun(Number(e.target.value))}
            className="border border-stone-300 rounded-md px-3 py-2 text-sm bg-white">
            {[tpBerjalan() - 1, tpBerjalan(), tpBerjalan() + 1].map((t) =>
              <option key={t} value={t}>{t}–{t + 1}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-stone-500 mb-1">Periode laporan</label>
          <select value={rentang} onChange={(e) => setRentang(e.target.value)}
            className="border border-stone-300 rounded-md px-3 py-2 text-sm bg-white">
            <optgroup label="Setahun dan semester">
              <option>Tahunan</option><option>Semester 1</option><option>Semester 2</option>
            </optgroup>
            <optgroup label="Kuartal">
              <option>Kuartal 1</option><option>Kuartal 2</option><option>Kuartal 3</option><option>Kuartal 4</option>
            </optgroup>
            <optgroup label="Bulanan">
              {periodeTP(tahun).map((p) => <option key={p} value={p}>{labelPeriode(p)}</option>)}
            </optgroup>
          </select>
        </div>
        <button onClick={() => window.print()}
          className="px-3 py-2 text-sm border border-stone-300 rounded-md hover:bg-stone-50 flex items-center gap-1.5">
          <Printer size={15} /> Cetak
        </button>
      </div>

      {belumLapor.length > 0 && (
        <p className="text-[12px] bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2.5 rounded flex items-start gap-1.5 no-print">
          <Info size={14} className="mt-px shrink-0" />
          <span>
            {belumLapor.length} bulan pada periode ini belum punya LPJ yang disetujui, jadi hasilnya
            belum utuh: {belumLapor.map(labelBulanPendek).join(', ')}.
          </span>
        </p>
      )}

      <div className="bg-white rounded-lg border border-stone-200 p-5 md:p-7 print-flat">
        <div className="text-center pb-5 mb-5 border-b-2 border-stone-800">
          <h1 className="text-base font-medium">Evaluasi Program Kerja</h1>
          <p className="text-sm text-stone-700">{bpObj?.nama || bpAktif}</p>
          {indukObj && <p className="text-[12px] text-stone-500">{indukObj.nama}</p>}
          <p className="text-xs text-stone-500 mt-1">
            {rentang.includes('-') ? labelPeriode(rentang) : rentang} · tahun pelayanan April {tahun} sampai Maret {tahun + 1}
          </p>
        </div>

        {memuat ? (
          <p className="py-10 text-center text-sm text-stone-500">Memuat…</p>
        ) : baris.length === 0 ? (
          <div className="py-12 text-center">
            <FileText size={22} className="text-stone-300 mx-auto mb-3" />
            <p className="text-sm text-stone-500 mb-1">Belum ada yang bisa dilaporkan.</p>
            <p className="text-[12px] text-stone-500">
              Laporan ini terisi sendiri dari LPJ yang sudah disetujui, jadi pengurus tidak perlu
              mengetik ulang.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] min-w-[900px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-stone-500 border-b-2 border-stone-300">
                  <th className="text-left font-normal px-2 py-2 w-8">No</th>
                  <th className="text-left font-normal px-2 py-2 w-40">Nama kegiatan</th>
                  <th className="text-left font-normal px-2 py-2">Tujuan dan rencana</th>
                  <th className="text-left font-normal px-2 py-2">Indikator hasil</th>
                  <th className="text-left font-normal px-2 py-2">Indikator pencapaian</th>
                  <th className="text-right font-normal px-2 py-2 w-24">Budget</th>
                  <th className="text-right font-normal px-2 py-2 w-24">Realisasi</th>
                  <th className="text-left font-normal px-2 py-2">Evaluasi</th>
                </tr>
              </thead>
              <tbody>
                {kelompok.map((g) => {
                  const sub = g.isi.reduce((a, b) => ({
                    budget: a.budget + b.budget, realisasi: a.realisasi + b.realisasi,
                  }), { budget: 0, realisasi: 0 });
                  return (
                    <React.Fragment key={g.sifat}>
                      <tr className="bg-stone-100">
                        <td className="px-2 py-1.5 font-medium" colSpan={8}>
                          Program {g.sifat.toUpperCase()}
                        </td>
                      </tr>
                      {g.isi.map((b, i) => {
                        const lebih = b.budget > 0 && b.realisasi > b.budget;
                        return (
                          <tr key={b.id} className="border-b border-stone-100 align-top">
                            <td className="px-2 py-2 text-stone-500">{i + 1}</td>
                            <td className="px-2 py-2 font-medium">{b.nama}</td>
                            <td className="px-2 py-2 text-stone-700 whitespace-pre-line">{b.tujuan || '—'}</td>
                            <td className="px-2 py-2 text-stone-700 whitespace-pre-line">{b.indikatorHasil || b.detail || '—'}</td>
                            <td className="px-2 py-2 text-stone-700">
                              {b.pencapaian.length === 0 ? <span className="text-stone-400">Tidak ada catatan</span>
                                : b.pencapaian.map((x, j) => <p key={j} className="mb-0.5">{x}</p>)}
                            </td>
                            <td className="px-2 py-2 text-right">{b.budget ? rp(b.budget) : '—'}</td>
                            <td className={`px-2 py-2 text-right ${lebih ? 'text-red-700 font-medium' : ''}`}>
                              {b.realisasi ? rp(b.realisasi) : '—'}
                              {b.budget > 0 && b.realisasi > 0 && (
                                <span className="block text-[10px] text-stone-500">
                                  {Math.round((b.realisasi / b.budget) * 100)}%
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-stone-700">
                              {b.evaluasi.length === 0 ? <span className="text-stone-400">Belum dievaluasi</span>
                                : b.evaluasi.map((x, j) => <p key={j} className="mb-0.5">{x}</p>)}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-b border-stone-300 bg-stone-50">
                        <td className="px-2 py-2 font-medium" colSpan={5}>Sub total kegiatan {g.sifat.toLowerCase()}</td>
                        <td className="px-2 py-2 text-right font-medium">{rp(sub.budget)}</td>
                        <td className="px-2 py-2 text-right font-medium">{rp(sub.realisasi)}</td>
                        <td />
                      </tr>
                    </React.Fragment>
                  );
                })}
                <tr className="border-t-2 border-stone-800">
                  <td className="px-2 py-2.5 font-medium" colSpan={5}>Total budget dan realisasi</td>
                  <td className="px-2 py-2.5 text-right font-medium">{rp(totalBudget)}</td>
                  <td className="px-2 py-2.5 text-right font-medium">
                    {rp(totalRealisasi)}
                    {serapan !== null && (
                      <span className={`block text-[10px] ${serapan > 100 ? 'text-red-700' : 'text-stone-500'}`}>
                        {serapan}%
                      </span>
                    )}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-10 flex justify-end">
          <div className="text-center">
            <p className="text-[12px] text-stone-600 mb-14">Ketua {bpObj?.nama || ''}</p>
            <p className="text-[12px] text-stone-700 border-t border-stone-400 pt-1 px-8">
              ..............................................
            </p>
          </div>
        </div>

        <p className="hidden print:block text-[10px] text-stone-400 text-center pt-4 border-t border-stone-200 mt-6">
          {APLIKASI.kode} · {APLIKASI.nama} · {APLIKASI.gereja} · {APLIKASI.pembuat}
        </p>
      </div>
    </div>
  );
}
