import React, { useState } from 'react';
import { 
  X, Download, Eye, ZoomIn, ZoomOut, RotateCw, FileText, Image as ImageIcon,
  Lock, Trash2, Calendar, User, Building, AlertCircle, CheckCircle, ExternalLink, ShieldCheck, ShieldAlert
} from 'lucide-react';
import { RequestAttachment } from '../types';
import { formatDateCustom } from '../utils';

interface DocumentViewerModalProps {
  attachment: RequestAttachment & {
    requestId?: number | string;
    membershipNumber?: string;
    memberName?: string;
    club?: string;
    isLocked?: boolean;
  };
  onClose: () => void;
  onDelete?: (attachmentId: string, requestId?: number | string) => void;
  canDelete?: boolean;
}

export default function DocumentViewerModal({
  attachment,
  onClose,
  onDelete,
  canDelete = false
}: DocumentViewerModalProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isPdf = attachment.fileType === 'application/pdf' || 
    attachment.fileName.toLowerCase().endsWith('.pdf') || 
    attachment.fileData.startsWith('data:application/pdf');

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return 'حجم غير محدد';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleDownload = () => {
    try {
      const link = document.createElement('a');
      link.href = attachment.fileData;
      link.download = attachment.fileName || 'مستند_طلب_الإلغاء';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handlePrint = () => {
    if (isPdf) {
      const printWindow = window.open(attachment.fileData, '_blank');
      printWindow?.focus();
    } else {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head><title>${attachment.fileName}</title></head>
            <body style="margin:0;display:flex;justify-content:center;align-items:center;background:#fff;">
              <img src="${attachment.fileData}" style="max-width:100%;max-height:100vh;object-fit:contain;" onload="window.print();window.close();"/>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="bg-white w-full max-w-5xl h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 text-right font-sans"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-slate-800 rounded-xl text-amber-400 shrink-0">
              {isPdf ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
            </div>
            <div className="truncate">
              <h3 className="text-sm sm:text-base font-bold text-white truncate flex items-center gap-2">
                <span>{attachment.fileName}</span>
                {attachment.isLocked && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xxs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    <Lock className="w-3 h-3" />
                    معتمد ومحمي (لا يمكن حذفه)
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-3 text-xs text-slate-300 mt-0.5">
                <span className="bg-slate-800 px-2 py-0.5 rounded text-amber-300 text-[11px] font-semibold">
                  {attachment.category || 'مستند مرفق'}
                </span>
                <span>• {formatFileSize(attachment.fileSize)}</span>
                {attachment.membershipNumber && (
                  <span>• عضوية: <strong className="text-white font-mono">{attachment.membershipNumber}</strong></span>
                )}
                {attachment.memberName && (
                  <span className="hidden sm:inline">• العضو: {attachment.memberName}</span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {!isPdf && (
              <>
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.min(prev + 0.25, 3))}
                  className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="تكبير"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.max(prev - 0.25, 0.5))}
                  className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="تصغير"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation(prev => (prev + 90) % 360)}
                  className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="تدوير"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
              title="تحميل الملف"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">تحميل</span>
            </button>

            {canDelete && onDelete && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 rounded-lg transition-colors cursor-pointer text-xs font-bold"
                title="حذف المستند نهائياً"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">حذف المستند</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer mr-1"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Delete Confirmation Box */}
        {showDeleteConfirm && (
          <div className="p-3 bg-rose-50 border-b border-rose-200 flex items-center justify-between text-xs text-rose-900 animate-in slide-in-from-top duration-150">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-bold">هل أنت متأكد من رغبتك في حذف هذا المستند المرفق نهائياً؟</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onDelete?.(attachment.id, attachment.requestId);
                  setShowDeleteConfirm(false);
                  onClose();
                }}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-md cursor-pointer"
              >
                تأكيد الحذف
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-md cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {/* Document Content View */}
        <div className="flex-1 bg-slate-100 relative overflow-hidden flex items-center justify-center p-2">
          {isPdf ? (
            <iframe
              src={attachment.fileData}
              title={attachment.fileName}
              className="w-full h-full rounded-lg border border-slate-300 shadow-inner bg-white"
            />
          ) : (
            <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
              <img
                src={attachment.fileData}
                alt={attachment.fileName}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease-in-out',
                  maxWidth: zoom <= 1 ? '100%' : 'none',
                  maxHeight: zoom <= 1 ? '100%' : 'none',
                }}
                className="object-contain rounded-lg shadow-md select-none"
              />
            </div>
          )}
        </div>

        {/* Footer Details Bar */}
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-4">
            {attachment.uploaderName && (
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>تم الرفع بواسطة: <strong>{attachment.uploaderName}</strong></span>
              </span>
            )}
            {attachment.uploaderClub && (
              <span className="flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                <span>الفرع: <strong>{attachment.uploaderClub}</strong></span>
              </span>
            )}
            {attachment.uploadedAt && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>تاريخ الرفع: <strong>{formatDateCustom(attachment.uploadedAt)}</strong></span>
              </span>
            )}
          </div>

          {attachment.notes && (
            <div className="bg-amber-50/80 px-3 py-1 rounded-md border border-amber-200 text-amber-900 text-[11px] font-medium max-w-md truncate">
              <strong>ملاحظة:</strong> {attachment.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
