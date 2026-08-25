import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  ZoomIn, ZoomOut, ExternalLink, Download, 
  ChevronRight, ChevronLeft, RefreshCw, AlertTriangle
} from 'lucide-react';

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PdfCanvasViewerProps {
  pdfData: string;
  pdfName?: string;
  onOpenNewTab?: () => void;
  onDownload?: () => void;
}

export default function PdfCanvasViewer({
  pdfData,
  pdfName = 'المستند.pdf',
  onOpenNewTab,
  onDownload
}: PdfCanvasViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [pdfDoc, setPdfDoc] = useState<any>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load PDF document
  useEffect(() => {
    if (!pdfData) {
      setError('لا توجد بيانات لملف الـ PDF');
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError('');

    async function loadPdf() {
      try {
        let pdfBytes: Uint8Array | null = null;

        if (pdfData.startsWith('data:')) {
          const base64Str = pdfData.split(',')[1] || '';
          const binaryStr = atob(base64Str.replace(/\s/g, ''));
          const len = binaryStr.length;
          pdfBytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            pdfBytes[i] = binaryStr.charCodeAt(i);
          }
        } else if (pdfData.startsWith('http://') || pdfData.startsWith('https://') || pdfData.startsWith('blob:')) {
          const resp = await fetch(pdfData);
          const buf = await resp.arrayBuffer();
          pdfBytes = new Uint8Array(buf);
        } else {
          // Assume raw base64
          const binaryStr = atob(pdfData.replace(/\s/g, ''));
          const len = binaryStr.length;
          pdfBytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            pdfBytes[i] = binaryStr.charCodeAt(i);
          }
        }

        const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
        const doc = await loadingTask.promise;
        if (!isMounted) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setCurrentPage(1);
        setLoading(false);
      } catch (err: any) {
        console.error('Failed to load PDF via PDF.js:', err);
        if (isMounted) {
          setError('تعذر قراءة محتوى ملف الـ PDF عبر القارئ المدمج. يمكنك فتحه أو تحميله مباشرة.');
          setLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      isMounted = false;
    };
  }, [pdfData]);

  // Render Page on Canvas whenever currentPage, scale, or pdfDoc changes
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let renderTask: any = null;
    let isCancelled = false;

    async function renderPage() {
      try {
        const page = await pdfDoc.getPage(currentPage);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('Error rendering page:', err);
        }
      }
    }

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, currentPage, scale]);

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 text-white rounded-2xl overflow-hidden border border-slate-800">
      
      {/* Control Toolbar */}
      <div className="bg-slate-800 px-4 py-2.5 flex items-center justify-between border-b border-slate-700 text-xs gap-2 flex-wrap no-print">
        {/* Page Navigation */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={currentPage <= 1 || loading}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            className="p-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 rounded-lg cursor-pointer transition-colors"
            title="الصفحة السابقة"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          
          <span className="font-mono text-xs text-amber-400 font-black px-2">
            {loading ? '...' : `${currentPage} / ${numPages}`}
          </span>

          <button
            type="button"
            disabled={currentPage >= numPages || loading}
            onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
            className="p-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 rounded-lg cursor-pointer transition-colors"
            title="الصفحة التالية"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setScale(s => Math.max(0.6, s - 0.2))}
            className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg cursor-pointer transition-colors"
            title="تصغير"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="font-mono text-xxs font-bold text-slate-300 min-w-[45px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setScale(s => Math.min(2.5, s + 0.2))}
            className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg cursor-pointer transition-colors"
            title="تكبير"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setScale(1.2)}
            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xxs font-bold rounded-lg cursor-pointer transition-colors"
            title="الحجم الافتراضي"
          >
            100%
          </button>
        </div>

        {/* External Actions */}
        <div className="flex items-center gap-2">
          {onOpenNewTab && (
            <button
              type="button"
              onClick={onOpenNewTab}
              className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xxs rounded-xl cursor-pointer transition-all flex items-center gap-1 shadow-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>فتح نافذة كاملة</span>
            </button>
          )}

          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xxs rounded-xl cursor-pointer transition-colors flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>تحميل</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Display Container */}
      <div className="flex-1 bg-slate-950 overflow-auto flex items-center justify-center p-4 min-h-[520px] relative">
        {loading && (
          <div className="flex flex-col items-center justify-center space-y-3 text-slate-300">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-400" />
            <p className="text-xs font-bold">جاري تحميل وعرض صفحات الـ PDF...</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center p-6 text-center space-y-3 max-w-md bg-slate-900 border border-slate-800 rounded-2xl">
            <AlertTriangle className="w-10 h-10 text-amber-500" />
            <p className="text-xs text-slate-200 leading-relaxed">{error}</p>
            <div className="flex items-center gap-2 pt-2">
              {onOpenNewTab && (
                <button
                  type="button"
                  onClick={onOpenNewTab}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-black text-xs rounded-xl cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>فتح في تبويب مستقل</span>
                </button>
              )}
              {onDownload && (
                <button
                  type="button"
                  onClick={onDownload}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  <span>تحميل PDF</span>
                </button>
              )}
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="shadow-2xl rounded-lg overflow-hidden border border-slate-700 bg-white">
            <canvas ref={canvasRef} className="block max-w-full h-auto" />
          </div>
        )}
      </div>

    </div>
  );
}
