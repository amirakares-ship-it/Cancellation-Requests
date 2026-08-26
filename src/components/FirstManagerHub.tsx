import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, Clock, Layers, CheckCircle2, XCircle, Database, Search, 
  Download, FileText, Printer, AlertTriangle, RotateCcw, CheckSquare, 
  Square, Sparkles, Filter, Eye, UserCheck, Check, FileCheck
} from 'lucide-react';
import { CancellationRequest } from '../types';
import { formatCommitteeWithYear, formatCommitteeYear, containsSearchQuery, isInternationalRequest, isSameClub } from '../utils';
import MultiSelect from './MultiSelect';
import SettlementStatementModal from './SettlementStatementModal';
import FirstManagerDecisionModal from './FirstManagerDecisionModal';
import FirstManagerPDFModal from './FirstManagerPDFModal';

interface FirstManagerHubProps {
  requests: CancellationRequest[];
  user: any;
  dropdowns: any;
  labelNames?: Record<string, string>;
  mode?: 'pending' | 'decided' | 'all';
  onRefresh: () => Promise<void> | void;
  onExportExcel?: (reqs: any[]) => void;
  onFirstManagerDecision: (reqId: number, approve: boolean, comments: string) => Promise<void>;
  onBulkDecision?: (ids: number[], approve: boolean, comments: string) => Promise<void>;
  onAttachPdf?: (reqId: number, pdfData: string, pdfName: string, pdfSize: number, notes: string) => Promise<void>;
}

export type FirstManagerViewTab = 'sent' | 'pending' | 'accepted' | 'rejected' | 'decided_all' | 'all';

export default function FirstManagerHub({
  requests,
  user,
  dropdowns,
  labelNames = {},
  mode = 'all',
  onRefresh,
  onExportExcel,
  onFirstManagerDecision,
  onBulkDecision,
  onAttachPdf
}: FirstManagerHubProps) {
  const [activeView, setActiveView] = useState<FirstManagerViewTab>(
    mode === 'decided' ? 'decided_all' : mode === 'pending' ? 'pending' : 'sent'
  );

  // Sync activeView if mode changes
  React.useEffect(() => {
    if (mode === 'decided') {
      setActiveView('decided_all');
    } else if (mode === 'pending') {
      setActiveView('pending');
    }
  }, [mode]);
  const [search, setSearch] = useState('');
  const [selectedClubs, setSelectedClubs] = useState<string[]>([]);
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
  const [selectedSubscriptionTypes, setSelectedSubscriptionTypes] = useState<string[]>([]);
  const [selectedCommittees, setSelectedCommittees] = useState<string[]>([]);
  const [selectedCommitteeYears, setSelectedCommitteeYears] = useState<string[]>([]);
  
  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkActionType, setBulkActionType] = useState<'accept' | 'reject' | null>(null);
  const [bulkComments, setBulkComments] = useState('');
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

  // Modals target
  const [decisionModalTarget, setDecisionModalTarget] = useState<CancellationRequest | null>(null);
  const [statementModalTarget, setStatementModalTarget] = useState<CancellationRequest | null>(null);
  const [pdfModalTarget, setPdfModalTarget] = useState<CancellationRequest | null>(null);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  // Check if Admin viewing for read-only monitoring
  const isReadOnly = user?.role === 'admin';

  // Calculate counts for cards
  const counts = useMemo(() => {
    let pending = 0;
    let sent = 0;
    let accepted = 0;
    let rejected = 0;
    const all = requests.length;

    requests.forEach(r => {
      if (r.approvalSentToFirstManager) {
        sent++;
        if (r.firstManagerApproved === true) {
          accepted++;
        } else if (r.firstManagerApproved === false) {
          rejected++;
        } else {
          pending++;
        }
      }
    });

    return {
      pending,
      sent,
      accepted,
      rejected,
      decided_all: accepted + rejected,
      all
    };
  }, [requests]);

  // Filtering
  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      // 1. Primary View Filter
      if (activeView === 'decided_all') {
        if (!r.approvalSentToFirstManager || (r.firstManagerApproved !== true && r.firstManagerApproved !== false)) {
          return false;
        }
      } else if (activeView === 'pending') {
        if (!r.approvalSentToFirstManager || (r.firstManagerApproved !== null && r.firstManagerApproved !== undefined)) {
          return false;
        }
      } else if (activeView === 'sent') {
        if (!r.approvalSentToFirstManager) {
          return false;
        }
      } else if (activeView === 'accepted') {
        if (!r.approvalSentToFirstManager || r.firstManagerApproved !== true) {
          return false;
        }
      } else if (activeView === 'rejected') {
        if (!r.approvalSentToFirstManager || r.firstManagerApproved !== false) {
          return false;
        }
      }
      // 'all' includes all system requests

      // 2. Search query
      if (search) {
        const matches = 
          containsSearchQuery(r.membershipNumber, search) ||
          containsSearchQuery(r.memberName, search) ||
          containsSearchQuery(r.nationalId, search) ||
          containsSearchQuery(r.externalId, search) ||
          containsSearchQuery(r.mobileNumber, search) ||
          containsSearchQuery(r.salesPerson, search) ||
          containsSearchQuery(r.club, search) ||
          containsSearchQuery(r.paymentMethod, search) ||
          containsSearchQuery(r.committeeNo, search) ||
          containsSearchQuery(r.type, search) ||
          containsSearchQuery(r.cancellationReason, search) ||
          containsSearchQuery(r.cancellationReasonDetail, search);
        if (!matches) return false;
      }

      // 3. Multi-select filters
      if (selectedClubs.length > 0 && !selectedClubs.includes(r.club)) return false;
      if (selectedPayments.length > 0 && !selectedPayments.includes(r.paymentMethod)) return false;
      if (selectedSubscriptionTypes.length > 0 && !selectedSubscriptionTypes.includes(r.type)) return false;
      if (selectedCommittees.length > 0 && !selectedCommittees.includes(r.committeeNo)) return false;
      if (selectedCommitteeYears.length > 0) {
        const yr = formatCommitteeYear(r.committeeYear || r.approvalDate || r.requestDate || (r as any).createdAt);
        if (!selectedCommitteeYears.includes(yr)) return false;
      }

      return true;
    });
  }, [requests, activeView, search, selectedClubs, selectedPayments, selectedSubscriptionTypes, selectedCommittees, selectedCommitteeYears]);

  // Unique subscription duration options
  const subscriptionTypeOptions = useMemo(() => {
    const set = new Set<string>();
    const defaults = ['اقل من شهر', 'اقل من 3 شهور', '1 سنة', '2 سنة', '3 سنة', '4 سنة', '5 سنة', '6 سنة', '7 سنة', '8 سنة', '9 سنة', '10 سنة'];
    defaults.forEach(d => set.add(d));
    requests.forEach(r => {
      if (r.type) set.add(r.type);
    });
    return Array.from(set);
  }, [requests]);

  // Unique committees
  const committeeOptions = useMemo(() => {
    const set = new Set<string>();
    requests.forEach(r => {
      if (r.committeeNo) set.add(r.committeeNo);
    });
    return Array.from(set).sort();
  }, [requests]);

  // Unique committee years
  const committeeYearOptions = useMemo(() => {
    const set = new Set<string>();
    requests.forEach(r => {
      const yr = r.committeeYear || (r.approvalDate ? formatCommitteeYear(r.approvalDate) : '');
      if (yr) {
        set.add(formatCommitteeYear(yr));
      }
    });
    return Array.from(set).sort().reverse();
  }, [requests]);

  // Select all visible
  const handleSelectAllVisible = () => {
    if (selectedIds.length === filteredRequests.length && filteredRequests.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRequests.map(r => r.id));
    }
  };

  const handleIndividualDecision = async (reqId: number, approve: boolean, comments: string) => {
    setIsSubmittingDecision(true);
    try {
      await onFirstManagerDecision(reqId, approve, comments);
      setDecisionModalTarget(null);
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  // Bulk Decision execution
  const executeBulkDecision = async (approve: boolean) => {
    if (selectedIds.length === 0) return;
    if (!approve && !bulkComments.trim()) {
      alert('يرجى كتابة سبب الرفض الجماعي للطلبات المحددة');
      return;
    }

    setIsBulkSubmitting(true);
    try {
      if (onBulkDecision) {
        await onBulkDecision(selectedIds, approve, bulkComments.trim());
      } else {
        for (const id of selectedIds) {
          await onFirstManagerDecision(id, approve, bulkComments.trim());
        }
      }
      setSelectedIds([]);
      setBulkActionType(null);
      setBulkComments('');
      await onRefresh();
    } catch (err) {
      console.error("Bulk decision failed:", err);
      alert('حدث خطأ أثناء تنفيذ الإجراء الجماعي');
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const resetAllFilters = () => {
    setSearch('');
    setSelectedClubs([]);
    setSelectedPayments([]);
    setSelectedSubscriptionTypes([]);
    setSelectedCommittees([]);
    setSelectedCommitteeYears([]);
  };

  const hasActiveSubFilters = Boolean(search || selectedClubs.length || selectedPayments.length || selectedSubscriptionTypes.length || selectedCommittees.length || selectedCommitteeYears.length);

  return (
    <div className="space-y-5 text-right no-print" dir="rtl">
      {/* 1. Dedicated Header Banner */}
      <div className="bg-slate-800 text-slate-100 p-5 rounded-2xl border border-slate-700 shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-amber-400 text-slate-950 rounded-xl shadow-sm shrink-0">
              {mode === 'decided' ? <FileCheck className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  {mode === 'decided' 
                    ? 'سجل القرارات والاعتمادات' 
                    : mode === 'pending'
                    ? (isReadOnly ? 'متابعة مهام واعتمادات المدير الأول' : 'لوحة المراجعة المالية واتخاذ القرار')
                    : (isReadOnly ? 'متابعة اعتمادات المدير الأول' : 'لوحة المراجعة المالية والاعتمادات')}
                </span>
                <span className="text-xs text-slate-400">حالات الاشتراك &gt; 3 شهور</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
                {mode === 'decided' ? 'طلبات تم اعتمادها' : mode === 'pending' ? 'مراجعة واتخاذ قرار' : 'متابعة مهام واعتمادات'}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
            {onExportExcel && (
              <button
                type="button"
                onClick={() => onExportExcel(filteredRequests)}
                className="flex items-center gap-2 px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-amber-300 font-bold text-xs rounded-xl border border-slate-600 transition-colors shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>تصدير Excel ({filteredRequests.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onRefresh()}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-700/80 hover:bg-slate-600 text-slate-200 font-medium text-xs rounded-xl border border-slate-600 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-slate-400" />
              <span>تحديث</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Organized Interactive View Cards based on Mode */}
      {mode === 'decided' ? (
        /* Cards for 'طلبات تم اعتمادها' mode */
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Card 1: كل القرارات المتخذة */}
          <button
            type="button"
            onClick={() => setActiveView('decided_all')}
            className={`p-4 rounded-xl text-right transition-all cursor-pointer border flex flex-col justify-between ${
              activeView === 'decided_all'
                ? 'bg-slate-800 text-white border-slate-700 shadow-sm ring-1 ring-amber-400/40'
                : 'bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className={`p-2 rounded-lg ${activeView === 'decided_all' ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-slate-100 text-slate-700'}`}>
                <Layers className="w-4 h-4" />
              </div>
              <span className={`text-xl font-bold font-mono ${activeView === 'decided_all' ? 'text-amber-300' : 'text-slate-800'}`}>
                {counts.decided_all}
              </span>
            </div>
            <div>
              <h3 className={`text-xs font-bold ${activeView === 'decided_all' ? 'text-white' : 'text-slate-900'}`}>كل القرارات المتخذة</h3>
            </div>
            {activeView === 'decided_all' && (
              <div className="mt-2.5 pt-2 border-t border-slate-700 flex items-center gap-1 text-[10px] font-bold text-amber-300">
                <Check className="w-3 h-3" />
                <span>العرض الحالي</span>
              </div>
            )}
          </button>

          {/* Card 2: المعتمدة فقط (Accept) */}
          <button
            type="button"
            onClick={() => setActiveView('accepted')}
            className={`p-4 rounded-xl text-right transition-all cursor-pointer border flex flex-col justify-between ${
              activeView === 'accepted'
                ? 'bg-emerald-50/70 border-emerald-400 shadow-sm ring-1 ring-emerald-400/30'
                : 'bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className={`p-2 rounded-lg ${activeView === 'accepted' ? 'bg-emerald-600 text-white font-bold' : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'}`}>
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span className="text-xl font-bold font-mono text-emerald-700">
                {counts.accepted}
              </span>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">الطلبات المقبولة (Accept)</h3>
            </div>
            {activeView === 'accepted' && (
              <div className="mt-2.5 pt-2 border-t border-emerald-200 flex items-center gap-1 text-[10px] font-bold text-emerald-800">
                <Check className="w-3 h-3 text-emerald-600" />
                <span>العرض الحالي</span>
              </div>
            )}
          </button>

          {/* Card 3: المرفوضة فقط (Reject) */}
          <button
            type="button"
            onClick={() => setActiveView('rejected')}
            className={`p-4 rounded-xl text-right transition-all cursor-pointer border flex flex-col justify-between ${
              activeView === 'rejected'
                ? 'bg-rose-50/70 border-rose-400 shadow-sm ring-1 ring-rose-400/30'
                : 'bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className={`p-2 rounded-lg ${activeView === 'rejected' ? 'bg-rose-600 text-white font-bold' : 'bg-rose-50 text-rose-700 border border-rose-200/60'}`}>
                <XCircle className="w-4 h-4" />
              </div>
              <span className="text-xl font-bold font-mono text-rose-700">
                {counts.rejected}
              </span>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">الطلبات المرفوضة (Reject)</h3>
            </div>
            {activeView === 'rejected' && (
              <div className="mt-2.5 pt-2 border-t border-rose-200 flex items-center gap-1 text-[10px] font-bold text-rose-800">
                <Check className="w-3 h-3 text-rose-600" />
                <span>العرض الحالي</span>
              </div>
            )}
          </button>
        </div>
      ) : mode === 'pending' ? (
        /* Cards for 'مراجعة واتخاذ قرار' mode */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Card 1: بانتظار القرار */}
          <button
            type="button"
            onClick={() => setActiveView('pending')}
            className={`p-4 rounded-xl text-right transition-all cursor-pointer border flex flex-col justify-between relative ${
              activeView === 'pending'
                ? 'bg-amber-50/70 border-amber-400 shadow-sm ring-1 ring-amber-400/30'
                : 'bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className={`p-2 rounded-lg ${activeView === 'pending' ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-amber-50 text-amber-700 border border-amber-200/60'}`}>
                <Clock className="w-4 h-4" />
              </div>
              <span className={`text-xl font-bold font-mono ${counts.pending > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                {counts.pending}
              </span>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">طلبات بانتظار اتخاذ القرار</h3>
            </div>
            {activeView === 'pending' && (
              <div className="mt-2.5 pt-2 border-t border-amber-200/70 flex items-center gap-1 text-[10px] font-bold text-amber-900">
                <Check className="w-3 h-3 text-amber-600" />
                <span>العرض الحالي</span>
              </div>
            )}
          </button>

          {/* Card 2: إجمالي المحال للمدير الأول */}
          <button
            type="button"
            onClick={() => setActiveView('sent')}
            className={`p-4 rounded-xl text-right transition-all cursor-pointer border flex flex-col justify-between ${
              activeView === 'sent'
                ? 'bg-slate-800 text-white border-slate-700 shadow-sm ring-1 ring-amber-400/40'
                : 'bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className={`p-2 rounded-lg ${activeView === 'sent' ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-slate-100 text-slate-700'}`}>
                <Layers className="w-4 h-4" />
              </div>
              <span className={`text-xl font-bold font-mono ${activeView === 'sent' ? 'text-amber-300' : 'text-slate-800'}`}>
                {counts.sent}
              </span>
            </div>
            <div>
              <h3 className={`text-xs font-bold ${activeView === 'sent' ? 'text-white' : 'text-slate-900'}`}>إجمالي المحال للمدير الأول</h3>
            </div>
            {activeView === 'sent' && (
              <div className="mt-2.5 pt-2 border-t border-slate-700 flex items-center gap-1 text-[10px] font-bold text-amber-300">
                <Check className="w-3 h-3" />
                <span>العرض الحالي</span>
              </div>
            )}
          </button>
        </div>
      ) : (
        /* Standard 5 Cards for 'all' mode */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Card 1: كل المرسل للمدير الأول */}
          <button
            type="button"
            onClick={() => setActiveView('sent')}
            className={`p-4 rounded-xl text-right transition-all cursor-pointer border flex flex-col justify-between ${
              activeView === 'sent'
                ? 'bg-slate-800 text-white border-slate-700 shadow-sm ring-1 ring-amber-400/40'
                : 'bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className={`p-2 rounded-lg ${activeView === 'sent' ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-slate-100 text-slate-700'}`}>
                <Layers className="w-4 h-4" />
              </div>
              <span className={`text-xl font-bold font-mono ${activeView === 'sent' ? 'text-amber-300' : 'text-slate-800'}`}>
                {counts.sent}
              </span>
            </div>
            <div>
              <h3 className={`text-xs font-bold ${activeView === 'sent' ? 'text-white' : 'text-slate-900'}`}>كل المرسل للمدير الأول</h3>
            </div>
            {activeView === 'sent' && (
              <div className="mt-2.5 pt-2 border-t border-slate-700 flex items-center gap-1 text-[10px] font-bold text-amber-300">
                <Check className="w-3 h-3" />
                <span>العرض الحالي</span>
              </div>
            )}
          </button>

          {/* Card 2: بانتظار القرار */}
          <button
            type="button"
            onClick={() => setActiveView('pending')}
            className={`p-4 rounded-xl text-right transition-all cursor-pointer border flex flex-col justify-between relative ${
              activeView === 'pending'
                ? 'bg-amber-50/70 border-amber-400 shadow-sm ring-1 ring-amber-400/30'
                : 'bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className={`p-2 rounded-lg ${activeView === 'pending' ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-amber-50 text-amber-700 border border-amber-200/60'}`}>
                <Clock className="w-4 h-4" />
              </div>
              <span className={`text-xl font-bold font-mono ${counts.pending > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                {counts.pending}
              </span>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">بانتظار القرار</h3>
            </div>
            {activeView === 'pending' && (
              <div className="mt-2.5 pt-2 border-t border-amber-200/70 flex items-center gap-1 text-[10px] font-bold text-amber-900">
                <Check className="w-3 h-3 text-amber-600" />
                <span>العرض الحالي</span>
              </div>
            )}
          </button>

          {/* Card 3: المعتمدة (Accept) */}
          <button
            type="button"
            onClick={() => setActiveView('accepted')}
            className={`p-4 rounded-xl text-right transition-all cursor-pointer border flex flex-col justify-between ${
              activeView === 'accepted'
                ? 'bg-emerald-50/70 border-emerald-400 shadow-sm ring-1 ring-emerald-400/30'
                : 'bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className={`p-2 rounded-lg ${activeView === 'accepted' ? 'bg-emerald-600 text-white font-bold' : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'}`}>
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span className="text-xl font-bold font-mono text-emerald-700">
                {counts.accepted}
              </span>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">المعتمدة (Accept)</h3>
            </div>
            {activeView === 'accepted' && (
              <div className="mt-2.5 pt-2 border-t border-emerald-200 flex items-center gap-1 text-[10px] font-bold text-emerald-800">
                <Check className="w-3 h-3 text-emerald-600" />
                <span>العرض الحالي</span>
              </div>
            )}
          </button>

          {/* Card 4: المرفوضة (Reject) */}
          <button
            type="button"
            onClick={() => setActiveView('rejected')}
            className={`p-4 rounded-xl text-right transition-all cursor-pointer border flex flex-col justify-between ${
              activeView === 'rejected'
                ? 'bg-rose-50/70 border-rose-400 shadow-sm ring-1 ring-rose-400/30'
                : 'bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className={`p-2 rounded-lg ${activeView === 'rejected' ? 'bg-rose-600 text-white font-bold' : 'bg-rose-50 text-rose-700 border border-rose-200/60'}`}>
                <XCircle className="w-4 h-4" />
              </div>
              <span className="text-xl font-bold font-mono text-rose-700">
                {counts.rejected}
              </span>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">المرفوضة (Reject)</h3>
            </div>
            {activeView === 'rejected' && (
              <div className="mt-2.5 pt-2 border-t border-rose-200 flex items-center gap-1 text-[10px] font-bold text-rose-800">
                <Check className="w-3 h-3 text-rose-600" />
                <span>العرض الحالي</span>
              </div>
            )}
          </button>

          {/* Card 5: كافة طلبات النظام */}
          <button
            type="button"
            onClick={() => setActiveView('all')}
            className={`p-4 rounded-xl text-right transition-all cursor-pointer border flex flex-col justify-between ${
              activeView === 'all'
                ? 'bg-indigo-50/70 border-indigo-400 shadow-sm ring-1 ring-indigo-400/30'
                : 'bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className={`p-2 rounded-lg ${activeView === 'all' ? 'bg-indigo-600 text-white font-bold' : 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'}`}>
                <Database className="w-4 h-4" />
              </div>
              <span className="text-xl font-bold font-mono text-indigo-900">
                {counts.all}
              </span>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">كافة طلبات النظام</h3>
            </div>
            {activeView === 'all' && (
              <div className="mt-2.5 pt-2 border-t border-indigo-200 flex items-center gap-1 text-[10px] font-bold text-indigo-800">
                <Check className="w-3 h-3 text-indigo-600" />
                <span>العرض الحالي</span>
              </div>
            )}
          </button>
        </div>
      )}

      {/* 3. Sub-filters and Search section */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Filter className="w-4 h-4 text-amber-600" />
            <span>تصفية وتخصيص نتائج العرض الحالي ({filteredRequests.length} طلب)</span>
          </div>

          {hasActiveSubFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة ضبط الفلاتر</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Quick Search */}
          <div className="relative">
            <label className="block text-xxs text-slate-500 mb-1 font-bold">البحث السريع (الاسم / العضوية / السبب)</label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث برقم العضوية أو الاسم..."
                className="w-full text-xs bg-slate-50/80 border border-slate-200 rounded-lg p-2 pr-8 focus:outline-none focus:ring-1.5 focus:ring-amber-400 focus:bg-white text-right placeholder:text-slate-400 transition-all"
              />
              <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
            </div>
          </div>

          {/* Subscription Duration Filter */}
          <div>
            <label className="block text-xxs text-slate-500 mb-1 font-bold">مدة الاشتراك</label>
            <MultiSelect
              options={subscriptionTypeOptions}
              selected={selectedSubscriptionTypes}
              onChange={setSelectedSubscriptionTypes}
              placeholder="كل مدد الاشتراك"
            />
          </div>

          {/* Club Filter */}
          <div>
            <label className="block text-xxs text-slate-500 mb-1 font-bold">الفرع / النادي</label>
            <MultiSelect
              options={dropdowns.clubs || []}
              selected={selectedClubs}
              onChange={setSelectedClubs}
              placeholder="كل الفروع"
            />
          </div>

          {/* Payment Method Filter */}
          <div>
            <label className="block text-xxs text-slate-500 mb-1 font-bold">طريقة السداد</label>
            <MultiSelect
              options={dropdowns.paymentMethods || []}
              selected={selectedPayments}
              onChange={setSelectedPayments}
              placeholder="كل طرق السداد"
            />
          </div>

          {/* Committee No Filter */}
          <div>
            <label className="block text-xxs text-slate-500 mb-1 font-bold">رقم اللجنة</label>
            <MultiSelect
              options={committeeOptions.map(comm => ({ label: `لجنة ${comm}`, value: comm }))}
              selected={selectedCommittees}
              onChange={setSelectedCommittees}
              placeholder="كل أرقام اللجان"
            />
          </div>

          {/* Committee Year Filter */}
          <div>
            <label className="block text-xxs text-slate-500 mb-1 font-bold">سنة اللجنة</label>
            <MultiSelect
              options={committeeYearOptions.map(yr => ({ label: `سنة ${yr}`, value: yr }))}
              selected={selectedCommitteeYears}
              onChange={setSelectedCommitteeYears}
              placeholder="كل سنوات اللجان"
            />
          </div>
        </div>
      </div>

      {/* Amber alert helper */}
      <div className="bg-amber-50/80 border border-amber-200/80 p-3 rounded-xl text-xs text-amber-900 flex items-center gap-2.5">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="leading-relaxed">
          {isReadOnly 
            ? 'تنبيه: الحالات المظللة بلون دافئ هي حالات تتراوح فترة اشتراكها بين 90 و120 يوماً وتتطلب انتباهاً للمصاريف الإدارية والانتفاع.'
            : 'تنبيه للمدير الأول: الحالات المظللة بلون دافئ هي حالات تتراوح فترة اشتراكها بين 90 و120 يوماً وتتطلب انتباهاً خاصاً للمصاريف الإدارية ومقابل الانتفاع.'
          }
        </span>
      </div>

      {/* 4. Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-slate-800 text-white p-3.5 sm:p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-3 shadow-md border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-300">
              تم تحديد <span className="font-mono text-sm font-bold text-amber-300 px-1">{selectedIds.length}</span> طلب {isReadOnly && '(للعرض والتصدير فقط)'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isReadOnly ? (
              <>
                {onExportExcel && (
                  <button
                    type="button"
                    onClick={() => {
                      const selectedReqs = requests.filter(r => selectedIds.includes(r.id));
                      onExportExcel(selectedReqs);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-amber-300 font-bold text-xs rounded-lg transition-colors cursor-pointer border border-slate-600"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تصدير المحدد ({selectedIds.length})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 cursor-pointer"
                >
                  إلغاء التحديد
                </button>
              </>
            ) : bulkActionType === null ? (
              <>
                <button
                  type="button"
                  onClick={() => setBulkActionType('accept')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>اعتماد جماعي (Bulk Accept)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBulkActionType('reject')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>رفض جماعي (Bulk Reject)</span>
                </button>

                {onExportExcel && (
                  <button
                    type="button"
                    onClick={() => {
                      const selectedReqs = requests.filter(r => selectedIds.includes(r.id));
                      onExportExcel(selectedReqs);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-lg transition-colors cursor-pointer border border-slate-700"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تصدير المحدد ({selectedIds.length})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1"
                >
                  إلغاء التحديد
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  value={bulkComments}
                  onChange={(e) => setBulkComments(e.target.value)}
                  placeholder={bulkActionType === 'accept' ? 'ملاحظات الاعتماد (اختياري)...' : 'سبب الرفض (مطلوب)...'}
                  className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white w-60 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />

                <button
                  type="button"
                  disabled={isBulkSubmitting}
                  onClick={() => executeBulkDecision(bulkActionType === 'accept')}
                  className={`px-3 py-1.5 font-bold text-xs rounded-lg transition-colors cursor-pointer ${
                    bulkActionType === 'accept'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  }`}
                >
                  {isBulkSubmitting ? 'جاري التنفيذ...' : `تأكيد ${bulkActionType === 'accept' ? 'الاعتماد' : 'الرفض'} (${selectedIds.length})`}
                </button>

                <button
                  type="button"
                  onClick={() => { setBulkActionType(null); setBulkComments(''); }}
                  className="text-xs text-slate-400 hover:text-white px-2"
                >
                  تراجع
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. The Main First Manager Organized Requests Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-800 text-slate-200 border-b border-slate-700 select-none">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredRequests.length && filteredRequests.length > 0}
                    onChange={handleSelectAllVisible}
                    className="rounded border-slate-500 text-amber-500 focus:ring-amber-400 cursor-pointer"
                    title="تحديد كل الطلبات المعروضة"
                  />
                </th>
                <th className="py-3 px-3 font-bold text-center w-12 text-slate-300">م</th>
                <th className="py-3 px-4 font-bold text-slate-100">{labelNames.membershipNumber || 'رقم العضوية'}</th>
                <th className="py-3 px-4 font-bold text-slate-100">{labelNames.memberName || 'اسم العضو'}</th>
                <th className="py-3 px-3 font-bold text-center text-slate-200">المدة</th>
                <th className="py-3 px-4 font-bold text-slate-200">{labelNames.club || 'النادى'}</th>
                <th className="py-3 px-4 font-bold text-slate-200">{labelNames.paymentMethod || 'طريقة الدفع'}</th>
                <th className="py-3 px-3 font-bold text-center text-slate-200">المستندات</th>
                <th className="py-3 px-4 font-bold text-slate-200">سبب الإلغاء</th>
                <th className="py-3 px-3 font-bold text-center text-slate-200">كشف الحساب</th>
                <th className="py-3 px-3 font-bold text-center text-slate-200">المرفقات والمستندات</th>
                <th className="py-3 px-4 font-bold text-center whitespace-nowrap text-amber-300">القرار</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400 font-medium">
                    <div className="max-w-md mx-auto space-y-2">
                      <ShieldCheck className="w-9 h-9 text-slate-300 mx-auto" />
                      <p className="text-sm font-bold text-slate-600">لا توجد طلبات إلغاء تطابق خيار العرض المحدد حالياً.</p>
                      <p className="text-xxs text-slate-400">يمكنك التبديل بين كروت العرض بالأعلى أو مسح الفلاتر لعرض طلبات أخرى.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((r) => {
                  const isAmberHighlight = r.days >= 90 && r.days <= 120;
                  const isSelected = selectedIds.includes(r.id);

                  // Check for any available attachments or documents (uploaded at registration or by admin)
                  const hasFirstManagerDoc = Boolean(r.firstManagerPdfUrl);
                  const hasAttachments = Array.isArray(r.attachments) && r.attachments.length > 0;
                  const totalAttachmentsCount = (hasFirstManagerDoc ? 1 : 0) + (hasAttachments ? r.attachments!.length : 0);
                  const hasAnyDoc = totalAttachmentsCount > 0;

                  return (
                    <tr 
                      key={r.id}
                      className={`hover:bg-slate-50/90 transition-colors ${
                        isAmberHighlight ? 'bg-amber-50/40 hover:bg-amber-100/40' : ''
                      } ${isSelected ? 'bg-amber-500/10' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(prev => [...prev, r.id]);
                            } else {
                              setSelectedIds(prev => prev.filter(id => id !== r.id));
                            }
                          }}
                          className="rounded border-slate-300 text-amber-500 focus:ring-amber-400 cursor-pointer"
                        />
                      </td>

                      {/* Index / ID */}
                      <td className="py-3 px-3 font-mono font-medium text-slate-400 text-center">
                        {r.id}
                      </td>

                      {/* 1. Membership Number */}
                      <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                        {r.membershipNumber}
                      </td>

                      {/* 2. Member Name */}
                      <td className="py-3 px-4 font-bold text-slate-800">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{r.memberName}</span>
                          {(r.isReReview || r.memberName?.includes('إعادة عرض')) && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              إعادة عرض
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 3. Duration */}
                      <td className="py-3 px-3 text-center">
                        <span className="font-semibold block text-slate-800 text-xs">{r.type}</span>
                        <span className="text-slate-500 text-[11px] font-normal">({r.days} يوم)</span>
                      </td>

                      {/* 4. Club */}
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {r.club}
                      </td>

                      {/* 5. Payment Method */}
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {r.paymentMethod}
                      </td>

                      {/* 6. Documents */}
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-medium rounded text-xxs inline-block border border-slate-200">
                          {r.documents || 'مستندات كاملة'}
                        </span>
                      </td>

                      {/* 7. Cancellation Reason (Displays only "تعثر مادي") */}
                      <td className="py-3 px-4 max-w-[150px]">
                        <span className="text-slate-800 font-bold block text-xs" title="تعثر مادي">
                          تعثر مادي
                        </span>
                      </td>

                      {/* Settlement Statement button */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setStatementModalTarget(r)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200/90 text-slate-700 border border-slate-300/80 font-bold rounded-lg text-xxs flex items-center justify-center gap-1 cursor-pointer transition-colors mx-auto"
                          title="عرض كشف الحساب المالي والتسوية التفصيلية"
                        >
                          <FileText className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                          <span>كشف الحساب</span>
                        </button>
                      </td>

                      {/* Attachments / Documents column (placed right next to Settlement Statement) */}
                      <td className="py-3 px-3 text-center">
                        {hasAnyDoc ? (
                          <button
                            type="button"
                            onClick={() => setPdfModalTarget(r)}
                            className="px-2.5 py-1 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-bold rounded-lg text-xxs flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-2xs mx-auto"
                            title="معاينة وعرض أو تنزيل المرفقات والمستندات (PDF / صور)"
                          >
                            <FileCheck className="h-3.5 w-3.5 text-neutral-950 shrink-0" />
                            <span>عرض المرفق</span>
                            {totalAttachmentsCount > 1 && (
                              <span className="bg-neutral-900 text-amber-300 px-1 py-0.2 rounded-full text-[9px] font-mono">
                                {totalAttachmentsCount}
                              </span>
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPdfModalTarget(r)}
                            className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200 font-medium rounded-lg text-xxs flex items-center justify-center gap-1 cursor-pointer transition-colors mx-auto"
                            title="معاينة أو إرفاق المستندات"
                          >
                            <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>لا يوجد مرفق</span>
                          </button>
                        )}
                      </td>

                      {/* First Manager Decision Status / Action */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {isReadOnly ? (
                          r.firstManagerApproved === true ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold font-sans" title="تم الاعتماد">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>Accept</span>
                            </span>
                          ) : r.firstManagerApproved === false ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold font-sans" title="تم الرفض">
                              <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              <span>Reject</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-xs font-semibold font-sans" title="بانتظار القرار">
                              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Pending</span>
                            </span>
                          )
                        ) : (
                          r.firstManagerApproved === true ? (
                            <button
                              type="button"
                              onClick={() => setDecisionModalTarget(r)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold cursor-pointer transition-all font-sans shadow-2xs"
                              title="انقر لتعديل القرار (Accept)"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>Accept</span>
                            </button>
                          ) : r.firstManagerApproved === false ? (
                            <button
                              type="button"
                              onClick={() => setDecisionModalTarget(r)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold cursor-pointer transition-all font-sans shadow-2xs"
                              title="انقر لتعديل القرار (Reject)"
                            >
                              <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              <span>Reject</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDecisionModalTarget(r)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg cursor-pointer transition-all shadow-2xs active:scale-95 font-sans"
                              title="انقر لاتخاذ القرار (Pending)"
                            >
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span>Pending</span>
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Summary */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xxs text-slate-500 font-medium">
          <div>
            إجمالي السجلات: <span className="font-mono text-slate-800 font-bold">{filteredRequests.length}</span> من أصل <span className="font-mono text-slate-800 font-bold">{requests.length}</span> طلب
          </div>
          <div>
            العرض الحالي: <span className="text-slate-800 font-bold">
              {activeView === 'pending' ? 'بانتظار قرارك' :
               activeView === 'sent' ? 'كل المحول لك' :
               activeView === 'accepted' ? 'المعتمدة (Accept)' :
               activeView === 'rejected' ? 'المرفوضة (Reject)' : 'كافة طلبات النظام'}
            </span>
          </div>
        </div>
      </div>

      {/* Decision Modal */}
      <FirstManagerDecisionModal
        isOpen={!!decisionModalTarget}
        request={decisionModalTarget}
        onClose={() => setDecisionModalTarget(null)}
        onDecision={handleIndividualDecision}
        onOpenStatement={(req) => setStatementModalTarget(req)}
        onOpenPDF={(req) => setPdfModalTarget(req)}
        isSubmitting={isSubmittingDecision}
      />

      {/* Settlement Statement Modal */}
      <SettlementStatementModal
        isOpen={!!statementModalTarget}
        request={statementModalTarget}
        onClose={() => setStatementModalTarget(null)}
      />

      {/* PDF Documents & Review Modal */}
      <FirstManagerPDFModal
        isOpen={!!pdfModalTarget}
        request={pdfModalTarget}
        user={user}
        onClose={() => setPdfModalTarget(null)}
        onOpenStatement={(req) => setStatementModalTarget(req)}
        onOpenDecision={isReadOnly ? undefined : (req) => setDecisionModalTarget(req)}
        onAttachPdf={onAttachPdf}
      />

    </div>
  );
}
