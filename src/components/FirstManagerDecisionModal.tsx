import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertCircle, MessageSquare, ShieldCheck, X, FileText, Printer, FileCheck } from 'lucide-react';
import { CancellationRequest } from '../types';

interface FirstManagerDecisionModalProps {
  isOpen: boolean;
  request: CancellationRequest | null;
  onClose: () => void;
  onDecision: (reqId: number, approve: boolean, comments: string) => Promise<void>;
  isSubmitting?: boolean;
  onOpenStatement?: (req: CancellationRequest) => void;
  onOpenPDF?: (req: CancellationRequest) => void;
}

export default function FirstManagerDecisionModal({
  isOpen,
  request,
  onClose,
  onDecision,
  isSubmitting = false,
  onOpenStatement,
  onOpenPDF
}: FirstManagerDecisionModalProps) {
  const [comments, setComments] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (request) {
      setComments(request.firstManagerComments || '');
      setError('');
    }
  }, [request]);

  if (!isOpen || !request) return null;

  const currentDecision = request.firstManagerApproved;

  const handleAction = async (approve: boolean) => {
    if (!approve && !comments.trim()) {
      setError('يرجى كتابة سبب الرفض في خانة الملاحظات أدناه');
      return;
    }
    setError('');
    await onDecision(request.id, approve, comments.trim());
  };

  const todayStr = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-right no-print" dir="rtl">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 max-h-[94vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-slate-800">
            <div className="p-2 rounded-xl bg-amber-400/20 text-amber-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black">قرار ومراجعة المدير المالي الأول</h3>
              <p className="text-xxs text-slate-500">بيانات الطلب المخصصة للاعتماد والمراجعة المالية (&gt; 3 شهور)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current Decision Badge if already decided */}
        {currentDecision !== null && currentDecision !== undefined && (
          <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
            currentDecision === true
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <div className="flex items-center gap-2">
              {currentDecision === true ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
              )}
              <span className="font-bold">
                القرار المسجل حالياً: {currentDecision === true ? 'معتمد وموافق عليه (Accept)' : 'مرفوض ومردود (Reject)'}
              </span>
            </div>
            <span className="text-xxs font-medium text-slate-500">
              (يمكنك تعديل القرار أدناه)
            </span>
          </div>
        )}

        {/* The 7 Dedicated Required Fields for First Manager */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="font-black text-slate-800 text-xs">بيانات العضوية المعتمدة للمدير الأول:</span>
            <span className="font-mono text-xs font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
              طلب #{request.id}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-slate-700">
            {/* 1. رقم العضوية */}
            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="text-slate-400 text-xxs block font-bold">1. رقم العضوية:</span>
              <span className="font-mono font-black text-slate-900 text-sm">{request.membershipNumber}</span>
            </div>

            {/* 2. اسم العضو */}
            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="text-slate-400 text-xxs block font-bold">2. اسم العضو:</span>
              <span className="font-black text-slate-900 text-xs truncate block">{request.memberName}</span>
            </div>

            {/* 3. المدة */}
            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="text-slate-400 text-xxs block font-bold">3. المدة (الاستهلاك والنوع):</span>
              <span className="font-bold text-amber-800 text-xs">{request.type} ({request.days} يوم)</span>
            </div>

            {/* 4. النادى */}
            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="text-slate-400 text-xxs block font-bold">4. النادي:</span>
              <span className="font-bold text-slate-800 text-xs">{request.club}</span>
            </div>

            {/* 5. طريقة الدفع */}
            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="text-slate-400 text-xxs block font-bold">5. طريقة الدفع:</span>
              <span className="font-bold text-slate-800 text-xs">{request.paymentMethod}</span>
            </div>

            {/* 6. المستندات */}
            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="text-slate-400 text-xxs block font-bold">6. المستندات المرفقة:</span>
              <span className="font-bold text-slate-800 text-xs truncate block">{request.documents || 'مستندات مكتملة'}</span>
            </div>

            {/* 7. سبب الالغاء */}
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 sm:col-span-2">
              <span className="text-slate-400 text-xxs block font-bold">7. سبب الإلغاء:</span>
              <span className="font-semibold text-slate-800 text-xs block">
                {request.cancellationReason}
                {request.cancellationReasonDetail && ` — ${request.cancellationReasonDetail}`}
              </span>
            </div>
          </div>

          {/* Quick Access to Statement & Attached PDF */}
          <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {onOpenPDF && (
                <button
                  type="button"
                  onClick={() => onOpenPDF(request)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 font-black text-xxs rounded-lg cursor-pointer transition-colors shadow-xs ${
                    request.firstManagerPdfUrl
                      ? 'bg-amber-400 hover:bg-amber-500 text-neutral-950 ring-2 ring-amber-300'
                      : 'bg-slate-800 hover:bg-slate-900 text-white'
                  }`}
                >
                  <FileCheck className="h-3.5 w-3.5" />
                  <span>
                    {request.firstManagerPdfUrl ? 'مراجعة مستندات وأوراق العضو (PDF المرفق)' : 'عرض تقرير ومستندات PDF'}
                  </span>
                </button>
              )}

              {onOpenStatement && (
                <button
                  type="button"
                  onClick={() => onOpenStatement(request)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xxs rounded-lg cursor-pointer transition-colors border border-slate-200"
                >
                  <FileText className="h-3.5 w-3.5 text-amber-600" />
                  <span>فتح كشف الحساب</span>
                </button>
              )}
            </div>

            {request.firstManagerPdfUrl ? (
              <span className="text-xxs text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>ملف PDF المرفق متوفر للمراجعة</span>
              </span>
            ) : (
              <span className="text-xxs text-slate-400 font-medium">مرفق كشف الحساب والبيانات</span>
            )}
          </div>

          {/* Admin Send Notes if present */}
          {request.firstManagerSendNotes && (
            <div className="p-2.5 bg-amber-50/80 rounded-lg border border-amber-200 text-slate-800 text-xxs leading-relaxed">
              <span className="font-black text-amber-900 block mb-0.5">توجيهات وملاحظات الأدمن المرسلة مع الطلب:</span>
              <p className="text-slate-700">{request.firstManagerSendNotes}</p>
            </div>
          )}
        </div>

        {/* Comments / Notes */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
            ملاحظات المدير المالي الأول / أسباب الرفض:
          </label>
          <textarea
            value={comments}
            onChange={(e) => {
              setComments(e.target.value);
              if (error) setError('');
            }}
            rows={2}
            placeholder="اكتب التوصيات المالية أو أسباب رفض التسوية وإعادة الملف للفرع..."
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
          />
          {error && (
            <p className="text-rose-600 text-xxs font-bold flex items-center gap-1">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {error}
            </p>
          )}
        </div>

        {/* Info banner */}
        <div className="text-[11px] text-slate-500 bg-amber-50/60 p-2.5 rounded-lg border border-amber-200/60 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <ul className="list-disc list-inside space-y-0.5 text-xxs">
              <li><strong>في حالة الموافقة (Accept)</strong>: يتم تحويل الطلب تلقائياً لملف رئيس قطاع المالية للاعتماد النهائي.</li>
              <li><strong>في حالة الرفض (Reject)</strong>: يتم تحويل حالة الطلب إلى <span className="font-bold text-rose-600">Rejected</span> وتثبيت تاريخ الحالة إلى تاريخ اليوم (<span className="font-mono">{todayStr}</span>).</li>
            </ul>
          </div>
        </div>

        {/* Action Buttons: Accept / Reject */}
        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleAction(true)}
            className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isSubmitting ? 'جاري المعالجة...' : 'الموافقة والاعتماد (Accept)'}
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleAction(false)}
            className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" />
            {isSubmitting ? 'جاري المعالجة...' : 'رفض الطلب (Reject)'}
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-all disabled:opacity-50"
          >
            إلغاء
          </button>
        </div>

      </div>
    </div>
  );
}

