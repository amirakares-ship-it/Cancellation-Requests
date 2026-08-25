import React, { useState, useEffect, useRef } from 'react';
import { 
  FileUp, FileText, Send, X, AlertCircle, CheckCircle2, 
  Trash2, ShieldCheck, Building2, User, Calendar, CreditCard,
  FileCheck, HelpCircle
} from 'lucide-react';
import { CancellationRequest } from '../types';

interface SendToFirstManagerModalProps {
  isOpen: boolean;
  request: CancellationRequest | null;
  onClose: () => void;
  onSend: (reqId: number, pdfData: string, pdfName: string, pdfSize: number, notes: string) => Promise<void>;
  isSubmitting?: boolean;
}

export default function SendToFirstManagerModal({
  isOpen,
  request,
  onClose,
  onSend,
  isSubmitting = false
}: SendToFirstManagerModalProps) {
  const [pdfData, setPdfData] = useState<string>('');
  const [pdfName, setPdfName] = useState<string>('');
  const [pdfSize, setPdfSize] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (request) {
      setPdfData(request.firstManagerPdfUrl || '');
      setPdfName(request.firstManagerPdfName || '');
      setPdfSize(request.firstManagerPdfSize || 0);
      setNotes(request.firstManagerSendNotes || '');
      setError('');
    }
  }, [request, isOpen]);

  if (!isOpen || !request) return null;

  const handleFileChange = (file: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('يرجى اختيار ملف بصيغة PDF فقط (.pdf)');
      return;
    }

    // Limit to 20MB
    if (file.size > 20 * 1024 * 1024) {
      setError('حجم ملف الـ PDF كبير جداً، يرجى اختيار ملف أقل من 20 ميجابايت');
      return;
    }

    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPdfData(result);
      setPdfName(file.name);
      setPdfSize(file.size);
    };
    reader.onerror = () => {
      setError('حدث خطأ أثناء قراءة ملف الـ PDF');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleRemoveFile = () => {
    setPdfData('');
    setPdfName('');
    setPdfSize(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    await onSend(request.id, pdfData, pdfName, pdfSize, notes.trim());
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-right no-print" dir="rtl">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 max-h-[94vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-400 text-neutral-950 shadow-xs">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">إرسال الطلب للمدير الأول مع ملف PDF</h3>
              <p className="text-xxs text-slate-500">إرفاق مستندات العضوية والأوراق بصيغة PDF ليطلع عليها المدير الأول ويتخذ قراره</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Member & Request Summary Badge */}
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-black text-slate-900">بيانات العضوية المراد إرسالها:</span>
            <span className="font-mono text-xxs font-black bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md border border-amber-300">
              طلب #{request.id}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-slate-700 text-xxs">
            <div className="bg-white p-2 rounded-xl border border-slate-200">
              <span className="text-slate-400 block font-bold">العضو:</span>
              <span className="font-black text-slate-900 truncate block">{request.memberName}</span>
            </div>
            <div className="bg-white p-2 rounded-xl border border-slate-200">
              <span className="text-slate-400 block font-bold">رقم العضوية:</span>
              <span className="font-mono font-black text-slate-900">{request.membershipNumber}</span>
            </div>
            <div className="bg-white p-2 rounded-xl border border-slate-200">
              <span className="text-slate-400 block font-bold">النادي / الدفع:</span>
              <span className="font-bold text-slate-800">{request.club} — {request.paymentMethod}</span>
            </div>
            <div className="bg-white p-2 rounded-xl border border-slate-200">
              <span className="text-slate-400 block font-bold">مدة الاشتراك:</span>
              <span className="font-bold text-amber-800">{request.type} ({request.days} يوم)</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* PDF Upload Zone */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-600" />
                <span>ملف PDF المرفق للمدير الأول (مستندات وأوراق العضو):</span>
              </label>
              <span className="text-xxs text-slate-400 font-medium">صيغة PDF فقط (حتى 20MB)</span>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileChange(e.target.files[0]);
                }
              }}
            />

            {pdfData ? (
              <div className="p-3.5 bg-amber-500/10 border border-amber-400/50 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-amber-400 text-neutral-950 shrink-0">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900 truncate" title={pdfName}>
                      {pdfName || 'مستندات_الطلب.pdf'}
                    </p>
                    <p className="text-xxs text-slate-500 font-mono mt-0.5">
                      {formatFileSize(pdfSize)} — جاهز للإرسال والعرض للمدير الأول
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xxs font-bold rounded-lg border border-slate-200 transition-colors cursor-pointer"
                  >
                    تغيير الملف
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer"
                    title="حذف الملف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-amber-500 bg-amber-50 scale-[1.01]'
                    : 'border-slate-300 hover:border-amber-400 hover:bg-slate-50/80 bg-slate-50/40'
                }`}
              >
                <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mb-2 shadow-xs">
                  <FileUp className="w-6 h-6" />
                </div>
                <p className="text-xs font-black text-slate-800">
                  اضغط هنا لاختيار ملف PDF أو اسحبه وأفلته هنا
                </p>
                <p className="text-xxs text-slate-500 mt-1 max-w-sm mx-auto">
                  ارفق ملف PDF المجمع الذي يحتوي على استمارة الإلغاء، صورة البطاقة، إيصالات السداد، وأي أوراق داعمة
                </p>
              </div>
            )}
          </div>

          {/* Admin Send Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 block">
              ملاحظات أو توجيهات للمدير الأول (اختياري):
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="اكتب أي ملاحظات خاصة بمراجعة الأوراق أو التسوية المالية للمدير الأول..."
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xxs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Note Info */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 text-xxs leading-relaxed flex items-start gap-2">
            <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p>
                عند الضغط على إرسال، سيتم توجيه هذا الطلب إلى قسم <strong>«متابعة مهام واعتمادات»</strong>، وسيتمكن المدير الأول من فتح ملف الـ PDF المرفق ومراجعة الأوراق بدقة لاتخاذ قرار الاعتماد أو الرفض.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md active:scale-98 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? 'جاري الإرسال...' : 'إرسال وتوجيه للمدير الأول'}
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors disabled:opacity-50"
            >
              إلغاء
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
