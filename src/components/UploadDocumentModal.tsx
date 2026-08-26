import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Upload, FileText, Image as ImageIcon, Check, AlertCircle, Plus, Trash2, 
  Layers, CheckCircle2, ShieldCheck, Loader2
} from 'lucide-react';
import { RequestAttachment } from '../types';

interface UploadDocumentModalProps {
  request: any;
  onClose: () => void;
  onUploadSuccess?: (newAttachments: RequestAttachment[]) => void;
  onSuccess?: () => void;
  currentUser?: any;
  user?: any;
}

const DOCUMENT_CATEGORIES = [
  'طلب الإلغاء الموقع',
  'صورة بطاقة الرقم القومي',
  'إيصال سداد / مخالصة',
  'إقرار وتنازل معتمد',
  'تقرير طبي / مستندات استثناء',
  'شيكات / مستندات بنكية',
  'استمارة الاشتراك الأصلية',
  'أخرى'
];

export default function UploadDocumentModal({
  request,
  onClose,
  onUploadSuccess,
  onSuccess,
  currentUser,
  user
}: UploadDocumentModalProps) {
  const activeUser = currentUser || user;
  const [existingAttachments, setExistingAttachments] = useState<any[]>(request.attachments || []);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filesToUpload, setFilesToUpload] = useState<Array<{
    id: string;
    file: File;
    fileName: string;
    fileType: string;
    fileSize: number;
    fileData: string;
    category: string;
    notes: string;
  }>>([]);

  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync existing attachments if request updates
  useEffect(() => {
    if (request?.attachments) {
      setExistingAttachments(request.attachments);
    }
  }, [request]);

  const handleDeleteExistingAttachment = async (attachmentId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المستند المرفق نهائياً؟')) {
      return;
    }

    setDeletingId(attachmentId);
    setErrorMessage('');
    try {
      const token = localStorage.getItem('wd_token') || '';
      const res = await fetch(`/api/requests/${request.id}/attachments/${attachmentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'فشل حذف المستند');
      }

      const resData = await res.json();
      const updated = existingAttachments.filter(a => String(a.id) !== String(attachmentId));
      setExistingAttachments(updated);
      setSuccessMessage('تم حذف المستند بنجاح');
      setTimeout(() => setSuccessMessage(''), 3000);

      if (onUploadSuccess) {
        onUploadSuccess(resData.attachments || updated);
      }
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Delete attachment failed:', err);
      setErrorMessage(err.message || 'تعذر حذف المستند');
    } finally {
      setDeletingId(null);
    }
  };

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processIncomingFiles = async (files: FileList | File[]) => {
    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const isAllowed = f.type.startsWith('image/') || f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
      if (isAllowed) {
        validFiles.push(f);
      }
    }

    if (validFiles.length === 0) {
      setErrorMessage('يرجى اختيار صور (JPG/PNG) أو ملفات PDF فقط');
      return;
    }

    setErrorMessage('');
    const newItems = [];

    for (const file of validFiles) {
      try {
        const fileData = await readFileAsDataUrl(file);
        newItems.push({
          id: `att-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
          file,
          fileName: file.name,
          fileType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
          fileSize: file.size,
          fileData,
          category: 'طلب الإلغاء الموقع',
          notes: ''
        });
      } catch (err) {
        console.error('Error reading file:', err);
      }
    }

    setFilesToUpload(prev => [...prev, ...newItems]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processIncomingFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processIncomingFiles(e.target.files);
    }
  };

  const removeFile = (id: string) => {
    setFilesToUpload(prev => prev.filter(f => f.id !== id));
  };

  const updateCategory = (id: string, category: string) => {
    setFilesToUpload(prev => prev.map(f => f.id === id ? { ...f, category } : f));
  };

  const updateNotes = (id: string, notes: string) => {
    setFilesToUpload(prev => prev.map(f => f.id === id ? { ...f, notes } : f));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (filesToUpload.length === 0) {
      setErrorMessage('يرجى اختيار ملف واحد على الأقل للرفع');
      return;
    }

    setIsUploading(true);
    setErrorMessage('');

    try {
      const token = localStorage.getItem('wd_token') || '';
      const payloadAttachments = filesToUpload.map(f => ({
        id: f.id,
        fileName: f.fileName,
        fileType: f.fileType,
        fileSize: f.fileSize,
        fileData: f.fileData,
        uploadedAt: new Date().toISOString(),
        uploadedBy: activeUser?.username || 'user',
        uploaderName: activeUser?.name || activeUser?.username || 'مستخدم',
        uploaderRole: activeUser?.role || 'club',
        uploaderClub: activeUser?.club || request.club || 'المركز الرئيسي',
        category: f.category,
        notes: f.notes
      }));

      const res = await fetch(`/api/requests/${request.id}/attachments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ attachments: payloadAttachments })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'فشل رفع المستندات');
      }

      const result = await res.json();
      if (onUploadSuccess) {
        onUploadSuccess(result.attachments || payloadAttachments);
      }
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      console.error('Upload failed:', err);
      setErrorMessage(err.message || 'حدث خطأ أثناء رفع الملفات، يرجى المحاولة ثانية');
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="bg-white w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 text-right font-sans"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                إرفاق مستندات لطلب الإلغاء ({request.membershipNumber})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                العضو: {request.memberName} • الفرع: {request.club || 'غير محدد'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Currently Attached Documents with Delete Option */}
          {existingAttachments.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between text-slate-800">
                <span className="text-xs font-black flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-amber-600" />
                  المستندات المرفقة الحالية بالطلب ({existingAttachments.length}):
                </span>
                <span className="text-xxs text-slate-500 font-bold">يمكنك معاينة أو مسح أي مستند مرفق</span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {existingAttachments.map((att: any) => {
                  const isPdf = att.fileType === 'application/pdf' || String(att.fileName).toLowerCase().endsWith('.pdf');
                  const canDeleteAtt = activeUser?.role === 'admin' || !att.isLocked;

                  return (
                    <div 
                      key={att.id}
                      className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs shadow-2xs hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 bg-slate-100 rounded-lg shrink-0">
                          {isPdf ? <FileText className="w-4 h-4 text-rose-500" /> : <ImageIcon className="w-4 h-4 text-blue-500" />}
                        </div>
                        <div className="truncate">
                          <span className="font-bold text-slate-900 truncate block text-xs" title={att.fileName}>
                            {att.fileName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {att.category || 'مستند'} • {att.fileSize ? formatFileSize(att.fileSize) : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <a
                          href={att.fileData}
                          download={att.fileName || 'مستند'}
                          className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-lg text-xxs transition-colors"
                          title="تحميل / فتح المستند"
                        >
                          معاينة
                        </a>

                        {canDeleteAtt ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteExistingAttachment(att.id)}
                            disabled={deletingId === att.id}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            title="مسح وحذف هذا المستند نهائياً"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span 
                            className="p-1.5 text-slate-300 cursor-not-allowed" 
                            title="محمي بعد المراجعة - الحذف متاح للأدمن فقط"
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {request.reviewed && (
            <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 text-xs rounded-xl flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block">ملاحظة بشأن مراجعة الطلب:</strong>
                <span>تمت مراجعة هذا الطلب من قبل الأدمن المركزي. يمكنك رفع مستندات إضافية جديدة، وستكون محمية تلقائياً في السجلات.</span>
              </div>
            </div>
          )}

          {/* Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 ${
              isDragOver 
                ? 'border-amber-500 bg-amber-50/80 scale-[0.99]' 
                : 'border-slate-300 hover:border-amber-400 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="p-3.5 bg-amber-100 text-amber-700 rounded-2xl">
              <Upload className="w-7 h-7" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-800 block">
                اسحب وأفلت الملفات هنا أو انقر للاختيار من جهازك
              </span>
              <span className="text-xs text-slate-500 mt-1 block">
                يدعم صيغ الصور (JPG, PNG, WEBP) وملفات الـ PDF (يمكن رفع أكثر من ملف دفعة واحدة)
              </span>
            </div>
          </div>

          {/* Selected Files List */}
          {filesToUpload.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 border-b border-slate-200 pb-1.5">
                <span>الملفات المحددة للرفع ({filesToUpload.length}):</span>
                <button
                  type="button"
                  onClick={() => setFilesToUpload([])}
                  className="text-rose-600 hover:underline cursor-pointer text-[11px]"
                >
                  إلغاء تحديد الكل
                </button>
              </div>

              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {filesToUpload.map((item, idx) => {
                  const isPdf = item.fileType === 'application/pdf' || item.fileName.toLowerCase().endsWith('.pdf');
                  return (
                    <div 
                      key={item.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-600 shrink-0">
                            {isPdf ? <FileText className="w-4 h-4 text-rose-500" /> : <ImageIcon className="w-4 h-4 text-blue-500" />}
                          </div>
                          <div className="truncate">
                            <span className="font-bold text-slate-800 truncate block">{item.fileName}</span>
                            <span className="text-[10px] text-slate-500">{formatFileSize(item.fileSize)}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFile(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="حذف من القائمة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">نوع المستند:</label>
                          <select
                            value={item.category}
                            onChange={(e) => updateCategory(item.id, e.target.value)}
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg p-1.5 font-bold text-slate-800 focus:outline-none focus:border-amber-400"
                          >
                            {DOCUMENT_CATEGORIES.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">ملاحظة / وصف (اختياري):</label>
                          <input
                            type="text"
                            value={item.notes}
                            onChange={(e) => updateNotes(item.id, e.target.value)}
                            placeholder="وصف مختصر للورقة..."
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg p-1.5 text-slate-800 focus:outline-none focus:border-amber-400"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={isUploading || filesToUpload.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 text-xs font-black rounded-xl transition-all shadow-md cursor-pointer"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري الرفع والحفظ...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>حفظ ورفع ({filesToUpload.length}) مستند</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
