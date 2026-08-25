import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, X, ShieldCheck, FileCheck,
  Download, ExternalLink, FileUp, MessageSquare
} from 'lucide-react';
import { CancellationRequest } from '../types';
import PdfCanvasViewer from './PdfCanvasViewer';

interface FirstManagerPDFModalProps {
  request: CancellationRequest | null;
  isOpen: boolean;
  user?: any;
  onClose: () => void;
  onOpenStatement?: (req: CancellationRequest) => void;
  onOpenDecision?: (req: CancellationRequest) => void;
  onAttachPdf?: (reqId: number, pdfData: string, pdfName: string, pdfSize: number, notes: string) => Promise<void>;
}

// Convert Base64 / Data URL to a Blob URL so Chrome & browsers load the PDF viewer without security/origin blocks
function convertToPdfBlobUrl(dataUrl: string): string | null {
  if (!dataUrl) return null;
  if (dataUrl.startsWith('blob:') || dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
    return dataUrl;
  }
  try {
    let base64 = dataUrl;
    let mimeType = 'application/pdf';
    if (dataUrl.includes(',')) {
      const parts = dataUrl.split(',');
      const match = parts[0].match(/:(.*?);/);
      if (match && match[1]) mimeType = match[1];
      base64 = parts[1];
    }
    // Clean up whitespace / newlines
    base64 = base64.replace(/\s/g, '');
    const binary = atob(base64);
    const len = binary.length;
    const buffer = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      buffer[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([buffer], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error('Failed to convert base64 to Blob URL:', err);
    return dataUrl;
  }
}

export default function FirstManagerPDFModal({
  request,
  isOpen,
  user,
  onClose,
  onOpenStatement,
  onOpenDecision,
  onAttachPdf
}: FirstManagerPDFModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!request?.firstManagerPdfUrl || !isOpen) {
      setPdfBlobUrl('');
      return;
    }

    const createdUrl = convertToPdfBlobUrl(request.firstManagerPdfUrl);
    setPdfBlobUrl(createdUrl || '');

    return () => {
      if (createdUrl && createdUrl.startsWith('blob:')) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [request?.firstManagerPdfUrl, isOpen]);

  if (!isOpen || !request) return null;

  const hasAttachedPdf = Boolean(request.firstManagerPdfUrl);
  const isAdmin = user?.role === 'admin';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('يرجى اختيار ملف بصيغة PDF فقط (.pdf)');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadError('حجم الملف كبير، الحد الأقصى 20 ميجابايت');
      return;
    }

    setUploadError('');
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      if (onAttachPdf) {
        await onAttachPdf(request.id, result, file.name, file.size, request.firstManagerSendNotes || '');
      }
      setIsUploading(false);
    };
    reader.onerror = () => {
      setUploadError('فشل قراءة الملف');
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const openPdfInNewTab = () => {
    const targetUrl = pdfBlobUrl || request.firstManagerPdfUrl;
    if (!targetUrl) return;
    window.open(targetUrl, '_blank');
  };

  const downloadAttachedPdf = () => {
    const targetUrl = pdfBlobUrl || request.firstManagerPdfUrl;
    if (!targetUrl) return;
    const link = document.createElement('a');
    link.href = targetUrl;
    link.download = request.firstManagerPdfName || `مستندات_طلب_${request.membershipNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 text-right font-sans overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl max-w-5xl w-full p-4 sm:p-6 space-y-4 shadow-2xl border border-slate-100 max-h-[96vh] overflow-y-auto animate-in fade-in zoom-in-95 flex flex-col">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-3 gap-3 no-print">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-400 text-neutral-950 rounded-2xl shadow-xs">
              <FileCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">
                  مستندات وأوراق العضو (PDF)
                </h3>
                <span className="font-mono text-xxs font-black bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md border border-amber-300">
                  طلب #{request.id}
                </span>
              </div>
              <p className="text-xxs text-slate-500 font-normal mt-0.5">
                عضوية: <strong className="font-mono text-slate-800">{request.membershipNumber}</strong> | المشترك: <strong className="text-slate-800">{request.memberName}</strong> | النادي: <strong className="text-slate-800">{request.club}</strong>
              </p>
            </div>
          </div>

          {/* Header Action Tools */}
          <div className="flex items-center gap-2 flex-wrap">
            {hasAttachedPdf && (
              <>
                <button
                  type="button"
                  onClick={openPdfInNewTab}
                  className="px-3 py-1.5 text-xs font-bold bg-amber-400 hover:bg-amber-500 text-neutral-950 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  title="فتح الملف المرفق في نافذة مستقلة وبادئ المتصفح المباشر"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>فتح بنافذة كاملة</span>
                </button>
                <button
                  type="button"
                  onClick={downloadAttachedPdf}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="تحميل ملف الـ PDF"
                >
                  <Download className="w-3.5 h-3.5 text-amber-600" />
                  <span>تحميل PDF</span>
                </button>
              </>
            )}

            {onOpenDecision && (
              <button
                type="button"
                onClick={() => { onClose(); onOpenDecision(request); }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl cursor-pointer transition-all shadow-sm"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>اتخاذ القرار (Accept / Reject)</span>
              </button>
            )}

            {onOpenStatement && (
              <button
                type="button"
                onClick={() => onOpenStatement(request)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-all border border-slate-200"
              >
                <FileText className="h-4 w-4 text-amber-600" />
                <span>كشف الحساب</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* PDF Viewer Body */}
        <div className="space-y-3 flex-1 flex flex-col min-h-[500px]">
          
          {/* Admin Notes Box if provided */}
          {request.firstManagerSendNotes && (
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-slate-800 text-xs flex items-start gap-2.5 shadow-2xs">
              <MessageSquare className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-black text-amber-950 block">ملاحظات الأدمن المرفقة مع المستندات:</span>
                <p className="text-xxs text-slate-700 mt-0.5 leading-relaxed">{request.firstManagerSendNotes}</p>
              </div>
            </div>
          )}

          {/* If PDF exists */}
          {hasAttachedPdf ? (
            <div className="flex-1 flex flex-col min-h-[550px] relative">
              <PdfCanvasViewer
                pdfData={request.firstManagerPdfUrl!}
                pdfName={request.firstManagerPdfName || 'مستندات_الطلب.pdf'}
                onOpenNewTab={openPdfInNewTab}
                onDownload={downloadAttachedPdf}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 border-2 border-dashed border-slate-300 rounded-3xl text-center space-y-3 min-h-[400px]">
              <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-xs">
                <FileText className="w-8 h-8" />
              </div>
              <div className="max-w-md space-y-1">
                <h4 className="text-sm font-black text-slate-900">لم يتم إرفاق ملف PDF للمستندات بعد</h4>
                <p className="text-xxs text-slate-500 leading-relaxed">
                  يقوم الأدمن بإرفاق ملف PDF يحتوي على استمارة الإلغاء، صورة البطاقة، وإيصالات السداد عند إرسال الطلب للاعتماد.
                </p>
              </div>

              {isAdmin && (
                <div className="pt-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2.5 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-black text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-md transition-all active:scale-98"
                  >
                    <FileUp className="w-4 h-4" />
                    <span>{isUploading ? 'جاري رفع الملف...' : 'إرفاق ملف PDF الآن'}</span>
                  </button>
                </div>
              )}

              {uploadError && (
                <p className="text-rose-600 text-xxs font-bold">{uploadError}</p>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
