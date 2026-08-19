import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * Menangkap galat yang terjadi saat menggambar layar. Tanpa ini, satu
 * kesalahan kecil membuat seluruh halaman menjadi putih tanpa keterangan,
 * sehingga sulit dilacak. Dengan ini pesannya terbaca dan bisa disalin.
 */
export default class PenangkapGalat extends React.Component {
  constructor(props) {
    super(props);
    this.state = { galat: null, rincian: '' };
  }

  static getDerivedStateFromError(galat) {
    return { galat };
  }

  componentDidCatch(galat, info) {
    this.setState({ rincian: info?.componentStack || '' });
    console.error('Galat tampilan:', galat, info);
  }

  render() {
    if (!this.state.galat) return this.props.children;

    const pesan = this.state.galat?.message || String(this.state.galat);
    const salin = `${pesan}\n\n${this.state.rincian}`.trim();

    return (
      <div className="min-h-full bg-stone-100 flex items-start justify-center p-4 py-10 font-sans overflow-y-auto">
        <div className="bg-white rounded-lg border border-stone-200 w-full max-w-lg p-6">
          <div className="flex items-start gap-3 mb-4">
            <span className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} className="text-red-700" />
            </span>
            <div>
              <h2 className="text-base font-medium">Layar ini gagal ditampilkan</h2>
              <p className="text-[12px] text-stone-600 mt-0.5">
                Data Anda aman. Yang bermasalah hanya tampilannya.
              </p>
            </div>
          </div>

          <div className="bg-stone-50 rounded-md px-3 py-2.5 mb-4">
            <p className="text-[11px] uppercase tracking-wider text-stone-500 mb-1">Pesan galat</p>
            <p className="text-[12px] text-stone-800 font-mono break-words">{pesan}</p>
          </div>

          {this.state.rincian && (
            <details className="mb-4">
              <summary className="text-[12px] text-stone-500 cursor-pointer hover:text-stone-800">
                Rincian teknis
              </summary>
              <pre className="mt-2 text-[10px] text-stone-600 bg-stone-50 rounded p-2 overflow-x-auto max-h-40">
                {this.state.rincian}
              </pre>
            </details>
          )}

          <div className="flex flex-wrap gap-2">
            <button onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800 flex items-center gap-1.5">
              <RotateCcw size={15} /> Muat ulang
            </button>
            <button onClick={() => navigator.clipboard?.writeText(salin)}
              className="px-4 py-2 text-sm border border-stone-300 rounded-md hover:bg-stone-50">
              Salin pesan galat
            </button>
          </div>
        </div>
      </div>
    );
  }
}
