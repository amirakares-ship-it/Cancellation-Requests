import React, { useState, useEffect } from 'react';
import { 
  Layers, CheckCircle, Calendar, Plus, X, AlertTriangle, ChevronDown, ChevronUp, Check 
} from 'lucide-react';
import { formatCommitteeYear } from '../utils';

interface CommitteeManagerProps {
  user: any;
  committees: any[];
  authToken: string;
  onRefresh: () => void;
  showAsModal: boolean;
  onCloseModal?: () => void;
}

export default function CommitteeManager({ 
  user, 
  committees, 
  authToken, 
  onRefresh,
  showAsModal,
  onCloseModal
}: CommitteeManagerProps) {
  const [isOpenCollapsed, setIsOpenCollapsed] = useState(false);
  const [approvalDate, setApprovalDate] = useState(new Date().toISOString().split('T')[0]);
  const [newCommNumber, setNewCommNumber] = useState('');
  const [newCommYear, setNewCommYear] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Step state: 'approve' | 'open_new'
  const [step, setStep] = useState<'approve' | 'open_new'>('approve');

  const [confirmAction, setConfirmAction] = useState<'approve' | 'open_new' | null>(null);

  const openCommittee = committees.find(c => c.status === 'open');

  // Guess next committee number on load or change
  useEffect(() => {
    if (!openCommittee) {
      setStep('open_new');
      // Try to find the max committee number and suggest max + 1
      const numericCommittees = committees
        .map(c => parseInt(c.number))
        .filter(n => !isNaN(n));
      const maxNo = numericCommittees.length > 0 ? Math.max(...numericCommittees) : 0;
      setNewCommNumber((maxNo + 1).toString());
    } else {
      setStep('approve');
    }
  }, [openCommittee, committees]);

  if (user?.role !== 'admin') return null;

  const handleApprovePrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!openCommittee) return;
    if (!approvalDate) {
      setErrorMsg('يرجى تحديد تاريخ الاعتماد');
      return;
    }
    setErrorMsg('');
    setConfirmAction('approve');
  };

  const executeApproveAndClose = async () => {
    if (!openCommittee) return;

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    setConfirmAction(null);

    try {
      const res = await fetch(`/api/committees/${openCommittee.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          status: 'closed',
          approvalDate: approvalDate
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل اعتماد اللجنة الحالية');
      }

      setSuccessMsg(`تم اعتماد وإغلاق اللجنة رقم ${openCommittee.number} بنجاح!`);
      
      // Auto switch to next step
      setTimeout(() => {
        setSuccessMsg('');
        setStep('open_new');
        const nextNo = (parseInt(openCommittee.number) || 0) + 1;
        setNewCommNumber(nextNo.toString());
        setNewCommYear('');
        onRefresh();
      }, 1500);

    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء الاتصال بالخادم');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenNewPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommNumber.trim()) {
      setErrorMsg('يرجى إدخال رقم اللجنة');
      return;
    }
    setErrorMsg('');
    setConfirmAction('open_new');
  };

  const executeOpenNewCommittee = async () => {
    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    setConfirmAction(null);

    try {
      const res = await fetch('/api/committees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          number: newCommNumber.trim(),
          year: newCommYear.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل فتح لجنة جديدة');
      }

      setSuccessMsg(`تم فتح وتنشيط اللجنة الجديدة رقم ${newCommNumber} ${newCommYear.trim() ? `(تاريخ موافقة اللجنة: ${newCommYear})` : ''} بنجاح!`);
      
      setTimeout(() => {
        setSuccessMsg('');
        onRefresh();
        if (onCloseModal) {
          onCloseModal();
        }
      }, 1500);

    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء الاتصال بالخادم');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderContent = () => {
    return (
      <div className="space-y-4 text-right" dir="rtl">
        {successMsg && (
          <div className="p-3 bg-amber-400/10 border-r-4 border-amber-500 text-amber-700 text-xs font-bold rounded-lg flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-50 border-r-4 border-rose-500 text-rose-800 text-xs font-semibold rounded-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Confirmation Step for Approving Committee */}
        {confirmAction === 'approve' && openCommittee && (
          <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl space-y-3 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 text-amber-900 font-black text-xs border-b border-amber-200 pb-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>خطوة تأكيد: اعتماد وإغلاق اللجنة</span>
            </div>
            <div className="text-xs text-slate-700 leading-relaxed space-y-1">
              <p>هل أنت متأكد من رغبتك في اعتماد وإغلاق <strong className="text-amber-900">اللجنة رقم {openCommittee.number}</strong>؟</p>
              <p className="text-[11px] text-slate-500">تاريخ اعتماد اللجنة والموافقة: <span className="font-mono font-bold text-slate-800">{approvalDate}</span></p>
              <p className="text-[10px] text-slate-500 italic mt-1">عند التأكيد، سيتم حفظ هذا التاريخ واعتماد اللجنة، وتجهيز النظام لفتح لجنة جديدة.</p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={executeApproveAndClose}
                disabled={isSubmitting}
                className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Check className="h-4 w-4" />
                <span>نعم، تأكيد الاعتماد</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={isSubmitting}
                className="py-2 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                تراجع
              </button>
            </div>
          </div>
        )}

        {/* Confirmation Step for Opening New Committee */}
        {confirmAction === 'open_new' && (
          <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-3 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 text-amber-400 font-black text-xs border-b border-slate-800 pb-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>خطوة تأكيد: فتح وتنشيط لجنة جديدة</span>
            </div>
            <div className="text-xs text-slate-300 leading-relaxed space-y-1">
              <p>هل أنت متأكد من فتح وتنشيط <strong className="text-amber-400">اللجنة رقم {newCommNumber}</strong>؟</p>
              <p className="text-[11px] text-slate-400">تاريخ موافقة اللجنة: <span className="font-mono font-bold text-white">{newCommYear.trim() || 'اختياري (لم يحدد بعد)'}</span></p>
              <p className="text-[10px] text-slate-400 italic mt-1">عند التأكيد، سيتم تفعيل هذه اللجنة فوراً لجميع طلبات الإلغاء الواردة من كافة الفروع.</p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={executeOpenNewCommittee}
                disabled={isSubmitting}
                className="flex-1 py-2 px-3 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Check className="h-4 w-4" />
                <span>نعم، تأكيد الفتح والتنشيط</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={isSubmitting}
                className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                تراجع
              </button>
            </div>
          </div>
        )}

        {step === 'approve' && openCommittee && !confirmAction && (
          <form onSubmit={handleApprovePrompt} className="space-y-4">
            <div className="bg-amber-400/10 p-3.5 rounded-xl border border-amber-200/50">
              <span className="text-[10px] text-amber-700 font-bold block mb-1">اللجنة النشطة حالياً</span>
              <div className="text-sm font-black text-slate-800">
                لجنة رقم <span className="text-amber-600 font-mono text-base">{openCommittee.number}</span> ({formatCommitteeYear(openCommittee.year || openCommittee.approvalDate)}) | تاريخ موافقة اللجنة: <span className="font-mono">{openCommittee.approvalDate || openCommittee.year}</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                أي طلبات إلغاء جديدة يتم تسجيلها من الفروع ستندرج تلقائياً تحت هذه اللجنة حتى يتم اعتمادها وإغلاقها.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                تاريخ اعتماد اللجنة والموافقة الفنية <span className="text-rose-500 font-bold">* (إجباري عند الاعتماد)</span>
              </label>
              <input
                type="date"
                required
                value={approvalDate}
                onChange={(e) => setApprovalDate(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 text-right"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-black text-xs rounded-xl shadow-lg shadow-amber-400/10 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle className="h-4 w-4" />
              <span>اعتماد اللجنة الحالية وتاريخ الموافقة</span>
            </button>
          </form>
        )}

        {step === 'open_new' && !confirmAction && (
          <form onSubmit={handleOpenNewPrompt} className="space-y-4">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
              <span className="text-[10px] text-slate-500 font-bold block mb-1">فتح دورة لجنة جديدة</span>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                تم إغلاق اللجنة السابقة بنجاح. يرجى إدخال بيانات رقم اللجنة الجديدة لتفعيلها فوراً لجميع طلبات الفروع.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم اللجنة الجديد <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={newCommNumber}
                  onChange={(e) => setNewCommNumber(e.target.value)}
                  placeholder="مثال: 6"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 text-center font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  تاريخ موافقة اللجنة <span className="text-slate-400 font-normal">(اختياري عند الفتح)</span>
                </label>
                <input
                  type="date"
                  value={newCommYear}
                  onChange={(e) => setNewCommYear(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono text-right"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-neutral-800 text-amber-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>تنشيط وفتح اللجنة الجديدة</span>
            </button>
          </form>
        )}
      </div>
    );
  };

  if (showAsModal) {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-right no-print" dir="rtl">
        <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <Layers className="h-5 w-5 text-amber-500" />
              اعتماد وإدارة لجان إلغاء العضوية
            </h3>
            {onCloseModal && (
              <button 
                onClick={onCloseModal}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {renderContent()}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-50 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-black text-slate-800 text-xs">مراقبة واعتماد اللجان (Committee Control)</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">التحكم في لجنة الإلغاء الفعالة لجميع مستخدمي المنظومة</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpenCollapsed(!isOpenCollapsed)}
          className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
        >
          {isOpenCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>
      
      {!isOpenCollapsed && renderContent()}
    </div>
  );
}
