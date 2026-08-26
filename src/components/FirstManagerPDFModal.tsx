import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, X, ShieldCheck, FileCheck,
  Download, ExternalLink, FileUp, MessageSquare, Image as ImageIcon,
  ZoomIn, ZoomOut, RotateCw, Eye
} from 'lucide-react';
import { CancellationRequest, RequestAttachment } from '../types';
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
  const [selectedAttachmentIndex, setSelectedAttachmentIndex] = useState<number>(0);
  const [imageZoom, setImageZoom] = useState<number>(1);
  const [imageRotation, setImageRotation] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Compile list of all available documents for this request:
  // 1) firstManagerPdfUrl (if uploaded by admin for first manager)
  // 2) any attachments from request.attachments (from member registration or admin uploads)
  const allDocuments: Array<{
    id: string;
    title: string;
    fileData: string;
    fileName: string;
    fileSize?: number;
    fileType: string;
    category?: string;
    source: 'admin_pdf' | 'attachment';
  }> = [];

  if (request?.firstManagerPdfUrl) {
    const isImg = request.firstManagerPdfUrl.startsWith('data:image/') || /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(request.firstManagerPdfName || '');
    allDocuments.push({
      id: 'admin_doc',
      title: request.firstManagerPdfName || (isImg ? 'مستند الأدمن المرفق (صورة)' : 'مستند الأدمن المرفق (PDF)'),
      fileData: request.firstManagerPdfUrl,
      fileName: request.firstManagerPdfName || (isImg ? 'مستند_الطلب.png' : 'مستندات_الطلب.pdf'),
      fileSize: request.firstManagerPdfSize || 0,
      fileType: isImg ? 'image/jpeg' : 'application/pdf',
      category: 'مرفق مرسل للمدير الأول',
      source: 'admin_pdf'
    });
  }

  if (Array.isArray(request?.attachments)) {
    request?.attachments.forEach((att, idx) => {
      const isPdf = att.fileType === 'application/pdf' || att.fileName.toLowerCase().endsWith('.pdf') || (att.fileData && att.fileData.startsWith('data:application/pdf'));
      allDocuments.push({
        id: att.id || `att_${idx}`,
        title: att.fileName || `مرفق #${idx + 1}`,
        fileData: att.fileData,
        fileName: att.fileName || `مستند_${idx + 1}`,
        fileSize: att.fileSize,
        fileType: isPdf ? 'application/pdf' : (att.fileType || 'image/jpeg'),
        category: att.category || 'مرفق بالطلب',
        source: 'attachment'
      });
    });
  }

  const activeDoc = allDocuments[selectedAttachmentIndex] || allDocuments[0];

  useEffect(() => {
    setImageZoom(1);
    setImageRotation(0);
    if (!activeDoc?.fileData || !isOpen) {
      setPdfBlobUrl('');
      return;
    }

    const isPdf = activeDoc.fileType === 'application/pdf' || activeDoc.fileName.toLowerCase().endsWith('.pdf') || activeDoc.fileData.startsWith('data:application/pdf');
    if (isPdf) {
      const createdUrl = convertToPdfBlobUrl(activeDoc.fileData);
      setPdfBlobUrl(createdUrl || '');
      return () => {
        if (createdUrl && createdUrl.startsWith('blob:')) {
          URL.revokeObjectURL(createdUrl);
        }
      };
    } else {
      setPdfBlobUrl(activeDoc.fileData);
    }
  }, [activeDoc, isOpen]);

  if (!isOpen || !request) return null;

  const isAdmin = user?.role === 'admin';
  const hasDocuments = allDocuments.length > 0;
  const isPdfDoc = activeDoc && (activeDoc.fileType === 'application/pdf' || activeDoc.fileName.toLowerCase().endsWith('.pdf') || activeDoc.fileData.startsWith('data:application/pdf'));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImg = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(file.name);

    if (!isPdf && !isImg) {
      setUploadError('يرجى اختيار ملف بصيغة PDF أو صورة (JPG, PNG, WebP)');
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

  const openDocInNewTab = () => {
    const targetUrl = pdfBlobUrl || activeDoc?.fileData;
    if (!targetUrl) return;
    window.open(targetUrl, '_blank');
  };

  const downloadActiveDoc = () => {
    const targetUrl = pdfBlobUrl || activeDoc?.fileData;
    if (!targetUrl) return;
    const link = document.createElement('a');
    link.href = targetUrl;
    link.download = activeDoc?.fileName || `مستند_طلب_${request.membershipNumber}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 text-right font-sans overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl max-w-6xl w-full p-4 sm:p-6 space-y-4 shadow-2xl border border-slate-100 max-h-[96vh] overflow-y-auto animate-in fade-in zoom-in-95 flex flex-col">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-3 gap-3 no-print">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-400 text-neutral-950 rounded-2xl shadow-xs">
              <FileCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">
                  مستندات وأوراق العضو والمرفقات
                </h3>
                <span className="font-mono text-xxs font-black bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md border border-amber-300">
                  طلب #{request.id}
                </span>
                {allDocuments.length > 0 && (
                  <span className="font-sans text-xxs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                    {allDocuments.length} مستند / مرفق
                  </span>
                )}
              </div>
              <p className="text-xxs text-slate-500 font-normal mt-0.5">
                عضوية: <strong className="font-mono text-slate-800">{request.membershipNumber}</strong> | المشترك: <strong className="text-slate-800">{request.memberName}</strong> | النادي: <strong className="text-slate-800">{request.club}</strong>
              </p>
            </div>
          </div>

          {/* Header Action Tools */}
          <div className="flex items-center gap-2 flex-wrap">
            {hasDocuments && activeDoc && (
              <>
                <button
                  type="button"
                  onClick={openDocInNewTab}
                  className="px-3 py-1.5 text-xs font-bold bg-amber-400 hover:bg-amber-500 text-neutral-950 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  title="عرض المستند في نافذة مستقلة"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>معاينة بنافذة كاملة</span>
                </button>
                <button
                  type="button"
                  onClick={downloadActiveDoc}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="تحميل المستند المعروض"
                >
                  <Download className="w-3.5 h-3.5 text-amber-600" />
                  <span>تنزيل الملف</span>
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

        {/* Multi-document Tabs Bar (if multiple docs available) */}
        {allDocuments.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-100">
            <span className="text-xxs font-bold text-slate-500 shrink-0">المستندات المتاحة:</span>
            {allDocuments.map((doc, idx) => {
              const isSelected = idx === selectedAttachmentIndex;
              const isDocPdf = doc.fileType === 'application/pdf' || doc.fileName.toLowerCase().endsWith('.pdf');
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setSelectedAttachmentIndex(idx)}
                  className={`px-3 py-1.5 rounded-xl text-xxs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-amber-400 text-neutral-950 shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {isDocPdf ? <FileText className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
                  <span className="truncate max-w-[150px]">{doc.fileName}</span>
                  {doc.category && (
                    <span className="text-[9px] opacity-80">({doc.category})</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Document Viewer Body */}
        <div className="space-y-3 flex-1 flex flex-col min-h-[500px]">
          
          {/* Admin Notes Box if provided */}
          {request.firstManagerSendNotes && (
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-slate-800 text-xs flex items-start gap-2.5 shadow-2xs">
              <MessageSquare className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-black text-amber-950 block">ملاحظات وتوجيهات الأدمن:</span>
                <p className="text-xxs text-slate-700 mt-0.5 leading-relaxed">{request.firstManagerSendNotes}</p>
              </div>
            </div>
          )}

          {/* If Documents exist */}
          {hasDocuments && activeDoc ? (
            <div className="flex-1 flex flex-col min-h-[550px] relative bg-slate-900/5 rounded-2xl p-2 border border-slate-200">
              {isPdfDoc ? (
                <PdfCanvasViewer
                  pdfData={activeDoc.fileData}
                  pdfName={activeDoc.fileName}
                  onOpenNewTab={openDocInNewTab}
                  onDownload={downloadActiveDoc}
                />
              ) : (
                /* Image Viewer with Zoom, Rotate, and Full View Tools */
                <div className="flex-1 flex flex-col items-center justify-center p-4 bg-slate-900 rounded-xl overflow-hidden relative min-h-[480px]">
                  {/* Image Controls */}
                  <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-slate-800/90 backdrop-blur-xs p-1.5 rounded-xl border border-slate-700 text-white">
                    <button
                      type="button"
                      onClick={() => setImageZoom(prev => Math.min(prev + 0.25, 3))}
                      className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-200 hover:text-white transition-colors cursor-pointer"
                      title="تكبير"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageZoom(prev => Math.max(prev - 0.25, 0.5))}
                      className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-200 hover:text-white transition-colors cursor-pointer"
                      title="تصغير"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageRotation(prev => (prev + 90) % 360)}
                      className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-200 hover:text-white transition-colors cursor-pointer"
                      title="تدوير 90 درجة"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setImageZoom(1); setImageRotation(0); }}
                      className="px-2 py-1 text-[10px] font-bold hover:bg-slate-700 rounded-lg text-amber-300 transition-colors cursor-pointer"
                      title="إعادة ضبط الحجم"
                    >
                      إعادة ضبط
                    </button>
                  </div>

                  <div className="w-full h-full flex items-center justify-center overflow-auto max-h-[600px] p-4">
                    <img
                      src={activeDoc.fileData}
                      alt={activeDoc.fileName}
                      referrerPolicy="no-referrer"
                      style={{
                        transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                        transition: 'transform 0.2s ease-out',
                        maxHeight: '80vh',
                        maxWidth: '100%',
                        objectFit: 'contain'
                      }}
                      className="rounded shadow-lg cursor-zoom-in"
                      onClick={() => setImageZoom(prev => prev > 1 ? 1 : 1.75)}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 border-2 border-dashed border-slate-300 rounded-3xl text-center space-y-3 min-h-[400px]">
              <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-xs">
                <FileText className="w-8 h-8" />
              </div>
              <div className="max-w-md space-y-1">
                <h4 className="text-sm font-black text-slate-900">لم يتم إرفاق مستندات أو أوراق لهذا الطلب بعد</h4>
                <p className="text-xxs text-slate-500 leading-relaxed">
                  يقوم العضو أو الأدمن بإرفاق استمارة الإلغاء، صورة البطاقة، وإيصالات السداد كـ PDF أو صورة للاطلاع عليها واعتماد الطلب.
                </p>
              </div>

              {isAdmin && (
                <div className="pt-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="application/pdf,.pdf,image/*"
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
                    <span>{isUploading ? 'جاري رفع الملف...' : 'إرفاق مستند (PDF أو صورة) الآن'}</span>
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

