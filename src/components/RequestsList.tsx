import React, { useState, useMemo } from 'react';
import { 
  Search, Eye, Edit3, Trash2, Calendar, CreditCard, Layers, Tag, Plus, CheckSquare, AlertTriangle, RotateCcw, RefreshCw, Upload, Download, FileText, Check,
  CheckCircle2, XCircle, ShieldCheck, Clock, FileCheck, FileUp, X
} from 'lucide-react';
import { translateStatus, formatCommitteeYear, formatCommitteeWithYear, getPendingSubStatus, formatDateCustom, toInputDateStr, isSameClub, containsSearchQuery, isInternationalRequest } from '../utils';
import MultiSelect from './MultiSelect';
import TableScrollWrapper from './TableScrollWrapper';
import SettlementStatementModal from './SettlementStatementModal';
import FirstManagerDecisionModal from './FirstManagerDecisionModal';
import FirstManagerPDFModal from './FirstManagerPDFModal';

interface RequestsListProps {
  requests: any[];
  user: any;
  dropdowns: any;
  onViewDetails?: (request: any) => void;
  onEditRequest: (request: any) => void;
  onDeleteRequest: (id: number) => void;
  onCreateNew: () => void;
  onBulkReview?: (ids: (number | string)[], reviewed: boolean) => void;
  onBulkDelete?: (ids: (number | string)[]) => void;
  onRefresh?: () => void;
  onImportExcel?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExportExcel?: (filteredData?: any[]) => void;
  onClearAll?: () => void;
  labelNames?: Record<string, string>;
  onFirstManagerDecision?: (reqId: number, approve: boolean, comments: string) => Promise<void>;
  onSendToFirstManager?: (reqId: number) => Promise<void>;
}

export default function RequestsList({ 
  requests, user, dropdowns, onViewDetails, onEditRequest, onDeleteRequest, onCreateNew, onBulkReview, onBulkDelete, onRefresh, onImportExcel, onExportExcel, onClearAll, labelNames,
  onFirstManagerDecision, onSendToFirstManager
}: RequestsListProps) {
  
  const getLabel = (key: string, fallback: string) => {
    return labelNames?.[key] || fallback;
  };
  
  const [search, setSearch] = useState('');
  const [selectedClubs, setSelectedClubs] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
  const [selectedSubscriptionTypes, setSelectedSubscriptionTypes] = useState<string[]>([]);

  // First Manager review state
  const [firstManagerTarget, setFirstManagerTarget] = useState<any | null>(null);
  const [isSubmittingFirstManager, setIsSubmittingFirstManager] = useState(false);

  // Revocation modal state for Admin
  const [revokeTarget, setRevokeTarget] = useState<any | null>(null);
  const [revokeDate, setRevokeDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSubmittingRevoke, setIsSubmittingRevoke] = useState(false);
  const [statementTarget, setStatementTarget] = useState<any | null>(null);
  const [pdfTarget, setPdfTarget] = useState<any | null>(null);
  const [rejectionModalTarget, setRejectionModalTarget] = useState<any | null>(null);
  const [selectedCommittees, setSelectedCommittees] = useState<string[]>([]);
  const [selectedCommitteeYears, setSelectedCommitteeYears] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Helper to render Committee Decision Badge (قرار اللجنة)
  const getCommitteeDecisionBadge = (r: any) => {
    const isRejected = r.firstManagerApproved === false || r.status === 'Rejected' || r.result === 'Rejected' || r.sectorManagerApproved === false;
    const isAccepted = !isRejected && (r.result === 'Accepted' || r.sectorManagerApproved === true || Boolean(r.approvalDate));

    if (isRejected) {
      const reason = r.adminNote || r.firstManagerComments || r.sectorManagerComments || r.clubNote || '';
      return (
        <button
          type="button"
          onClick={() => user.role === 'first_manager' ? setFirstManagerTarget(r) : setRejectionModalTarget(r)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xxs font-black bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 transition-all cursor-pointer shadow-2xs group"
          title={reason ? `سبب الرفض: ${reason} (انقر للتفاصيل)` : 'انقر لعرض سبب الرفض'}
        >
          <XCircle className="w-3.5 h-3.5 text-rose-600 group-hover:scale-110 transition-transform" />
          <span>Rejected</span>
          <Eye className="w-3 h-3 text-rose-500 mr-0.5 shrink-0" />
        </button>
      );
    }

    if (isAccepted) {
      return (
        <button
          type="button"
          onClick={() => user.role === 'first_manager' ? setFirstManagerTarget(r) : undefined}
          disabled={user.role !== 'first_manager'}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xxs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs ${user.role === 'first_manager' ? 'cursor-pointer hover:bg-emerald-200' : ''}`}
          title={user.role === 'first_manager' ? 'انقر لتعديل قرارك كمدير أول' : undefined}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Accepted</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => user.role === 'first_manager' ? setFirstManagerTarget(r) : undefined}
        disabled={user.role !== 'first_manager'}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xxs font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs ${user.role === 'first_manager' ? 'cursor-pointer hover:bg-amber-100' : ''}`}
        title={user.role === 'first_manager' ? 'انقر لاتخاذ قرارك كمدير أول' : undefined}
      >
        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span>Pending</span>
      </button>
    );
  };

  // Manual Status Date Edit state for Admin
  const [dateEditTarget, setDateEditTarget] = useState<any | null>(null);
  const [newStatusDate, setNewStatusDate] = useState<string>('');
  const [isSavingStatusDate, setIsSavingStatusDate] = useState(false);
  const [statusDateFeedback, setStatusDateFeedback] = useState<{ id: number | string; text: string } | null>(null);

  const handleOpenDateEdit = (r: any) => {
    setDateEditTarget(r);
    setNewStatusDate(r.statusDate ? toInputDateStr(r.statusDate) : new Date().toISOString().split('T')[0]);
  };

  const handleSaveStatusDate = async () => {
    if (!dateEditTarget) return;
    setIsSavingStatusDate(true);
    try {
      const token = localStorage.getItem('wd_token') || '';
      const res = await fetch(`/api/requests/${dateEditTarget.id}/status-date`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ statusDate: newStatusDate })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'فشل حفظ تاريخ الحالة');
      }
      setStatusDateFeedback({ id: dateEditTarget.id, text: 'تم حفظ التاريخ!' });
      setTimeout(() => setStatusDateFeedback(null), 3000);
      setDateEditTarget(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء حفظ تاريخ الحالة');
    } finally {
      setIsSavingStatusDate(false);
    }
  };

  const handleFirstManagerModalDecision = async (reqId: number, approve: boolean, comments: string) => {
    setIsSubmittingFirstManager(true);
    try {
      if (onFirstManagerDecision) {
        await onFirstManagerDecision(reqId, approve, comments);
      } else {
        const token = localStorage.getItem('wd_token') || '';
        const res = await fetch(`/api/requests/${reqId}/first-manager-action`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ approve, comments })
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || 'فشلت معالجة قرار المدير المالي الأول');
        }
        if (onRefresh) onRefresh();
      }
      setFirstManagerTarget(null);
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء حفظ القرار');
    } finally {
      setIsSubmittingFirstManager(false);
    }
  };

  // Filtering Logic
  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      // Role confinement
      if (user.role === 'club' && !isSameClub(r.club, user.club)) {
        return false;
      }
      if (user.role === 'international_user' && !isInternationalRequest(r)) {
        return false;
      }

      // First Manager: In the cancellation requests list, strictly only show requests sent to him
      if (user.role === 'first_manager' && !r.approvalSentToFirstManager) {
        return false;
      }

      // Comprehensive Search (Membership No, Name, National ID, External ID, Mobile, SalesPerson, LoanUnderName, Committee No, etc.)
      const matchesSearch = !search || 
        containsSearchQuery(r.membershipNumber, search) ||
        containsSearchQuery(r.memberName, search) ||
        containsSearchQuery(r.nationalId, search) ||
        containsSearchQuery(r.externalId, search) ||
        containsSearchQuery(r.mobileNumber, search) ||
        containsSearchQuery(r.salesPerson, search) ||
        containsSearchQuery(r.loanUnderName, search) ||
        containsSearchQuery(r.club, search) ||
        containsSearchQuery(r.paymentMethod, search) ||
        containsSearchQuery(r.committeeNo, search) ||
        containsSearchQuery(r.type, search) ||
        containsSearchQuery(r.type2, search) ||
        containsSearchQuery(r.cancellationReason, search) ||
        containsSearchQuery(r.status, search);

      if (!matchesSearch) return false;

      // Select Dropdowns (Multi-Select)
      if (selectedClubs.length > 0 && !selectedClubs.includes(r.club)) return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(r.status)) return false;
      if (selectedPayments.length > 0 && !selectedPayments.includes(r.paymentMethod)) return false;
      if (selectedCommittees.length > 0 && !selectedCommittees.includes(r.committeeNo)) return false;
      if (selectedCommitteeYears.length > 0) {
        const yr = formatCommitteeYear(r.committeeYear || r.approvalDate || r.requestDate || (r as any).createdAt);
        if (!selectedCommitteeYears.includes(yr)) return false;
      }
      if (selectedSubscriptionTypes.length > 0 && !selectedSubscriptionTypes.includes(r.type)) return false;

      return true;
    });
  }, [requests, user, search, selectedClubs, selectedStatuses, selectedPayments, selectedCommittees, selectedCommitteeYears, selectedSubscriptionTypes]);

  // Unique subscription duration options (e.g. اقل من 3 شهور، اقل من شهر، سنة، 2 سنة...)
  const subscriptionTypeOptions = useMemo(() => {
    const set = new Set<string>();
    const defaults = ['اقل من شهر', 'اقل من 3 شهور', '1 سنة', '2 سنة', '3 سنة', '4 سنة', '5 سنة', '6 سنة', '7 سنة', '8 سنة', '9 سنة', '10 سنة'];
    defaults.forEach(d => set.add(d));
    requests.forEach(r => {
      if (r.type) set.add(r.type);
    });
    return Array.from(set);
  }, [requests]);

  // Unique committees for dropdown list
  const committeeOptions = useMemo(() => {
    const set = new Set<string>();
    requests.forEach(r => {
      if (r.committeeNo) set.add(r.committeeNo);
    });
    return Array.from(set).sort();
  }, [requests]);

  // Unique committee years for dropdown list
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

  return (
    <div className="space-y-4 text-right" dir="rtl">
      {/* Search & Filter Utility bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-4">
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Layers className="h-5 w-5 text-amber-500" />
            متابعة طلبات الإلغاء ({filteredRequests.length} طلب)
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {onExportExcel && (
              <button
                type="button"
                onClick={() => onExportExcel(filteredRequests)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-black text-xs rounded-xl transition-all shadow-sm hover:shadow cursor-pointer active:scale-95"
              >
                <Download className="h-4 w-4" />
                <span>تصدير التقرير المفلتر ({filteredRequests.length}) (.xlsx)</span>
              </button>
            )}

            <button
              type="button"
              onClick={onCreateNew}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-black text-xs rounded-xl transition-all shadow-md hover:shadow cursor-pointer active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>تسجيل طلب إلغاء جديد</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {/* Quick Search */}
          <div className="relative">
            <label className="block text-xs text-slate-400 mb-1">البحث السريع (رقم العضوية/الاسم)</label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث برقم العضوية أو الاسم..."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 pr-8 focus:outline-none focus:ring-2 focus:ring-amber-400 text-right"
              />
              <Search className="absolute right-2.5 top-3 h-4 w-4 text-slate-400" />
            </div>
          </div>

          {/* Subscription Duration Filter */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">مدة الاشتراك</label>
            <MultiSelect
              options={subscriptionTypeOptions}
              selected={selectedSubscriptionTypes}
              onChange={setSelectedSubscriptionTypes}
              placeholder="كل مدد الاشتراك"
            />
          </div>

          {/* Club Filter */}
          {user.role !== 'club' ? (
            <div>
              <label className="block text-xs text-slate-400 mb-1">الفرع / النادي</label>
              <MultiSelect
                options={dropdowns.clubs}
                selected={selectedClubs}
                onChange={setSelectedClubs}
                placeholder="كل الفروع"
              />
            </div>
          ) : (
            <div></div>
          )}

          {/* Status Filter */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">حالة الطلب</label>
            <MultiSelect
              options={(dropdowns?.cancellationStatuses || ["Pending", "Cancelled", "Revoked", "Deletion"]).map((st: string) => ({
                label: translateStatus(st) || st,
                value: st
              }))}
              selected={selectedStatuses}
              onChange={setSelectedStatuses}
              placeholder="كل الحالات"
            />
          </div>

          {/* Payment Filter */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">طريقة السداد</label>
            <MultiSelect
              options={dropdowns.paymentMethods}
              selected={selectedPayments}
              onChange={setSelectedPayments}
              placeholder="كل طرق السداد"
            />
          </div>

          {/* Committee No Filter */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">رقم اللجنة</label>
            <MultiSelect
              options={committeeOptions.map(comm => ({ label: `لجنة ${comm}`, value: comm }))}
              selected={selectedCommittees}
              onChange={setSelectedCommittees}
              placeholder="كل أرقام اللجان"
            />
          </div>

          {/* Committee Year Filter */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">سنة اللجنة</label>
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
      <div className="bg-amber-50 border-r-4 border-amber-500 p-3 rounded-lg text-xs text-amber-800 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>تنبيه: الحالات المظللة باللون البرتقالي هي حالات تتراوح فترة اشتراكها بين 90 و120 يوماً وتتطلب انتباهاً خاصاً للمصاريف.</span>
      </div>

      {/* Bulk Review / Delete Actions */}
      {selectedIds.length > 0 && (
        <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">
              تم تحديد <span className="font-mono text-base font-black text-amber-400">{selectedIds.length}</span> طلب
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onBulkDelete && (
              <button
                type="button"
                onClick={() => {
                  onBulkDelete(selectedIds);
                  setSelectedIds([]);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-lg transition-colors cursor-pointer shadow-sm active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>مسح الطلبات المحددة ({selectedIds.length})</span>
              </button>
            )}

            {user.role === 'admin' && onBulkReview && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onBulkReview(selectedIds, true);
                    setSelectedIds([]);
                  }}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-black text-xs rounded-lg transition-colors cursor-pointer"
                >
                  تحديد كمُراجع (Reviewed)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onBulkReview(selectedIds, false);
                    setSelectedIds([]);
                  }}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-amber-400 font-bold text-xs rounded-lg transition-colors cursor-pointer border border-neutral-700"
                >
                  إلغاء المراجعة (Unreviewed)
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <TableScrollWrapper>
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                <th className="py-3 px-4 text-center w-12">
                  <input 
                    type="checkbox" 
                    checked={filteredRequests.length > 0 && selectedIds.length === filteredRequests.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                         setSelectedIds(filteredRequests.map(r => r.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                    className="rounded border-slate-300 text-amber-500 focus:ring-amber-400 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-4 font-black">م</th>
                <th className="py-3 px-4">{getLabel('membershipNumber', 'رقم العضوية')}</th>
                <th className="py-3 px-4">{getLabel('memberName', 'اسم العضو')}</th>
                <th className="py-3 px-4 text-center">المدة</th>
                <th className="py-3 px-4">{getLabel('club', 'النادى')}</th>
                <th className="py-3 px-4">{getLabel('paymentMethod', 'طريقة الدفع')}</th>
                {user.role === 'first_manager' ? (
                  <>
                    <th className="py-3 px-4 text-center">المستندات</th>
                    <th className="py-3 px-4">سبب الالغاء</th>
                    <th className="py-3 px-4 text-center">كشف الحساب</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">قرار اللجنة</th>
                  </>
                ) : (
                  <>
                    <th className="py-3 px-4 text-center">{getLabel('committeeNo', 'رقم اللجنة')}</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">قرار اللجنة</th>
                    <th className="py-3 px-4 text-left">{getLabel('refundAmount', 'صافي الاسترداد')}</th>
                    <th className="py-3 px-4 text-center">الحالة</th>
                    <th className="py-3 px-4 text-center">{getLabel('statusDate', 'تاريخ الحالة')}</th>
                    <th className="py-3 px-4 text-center">المراجعة (Reviewed)</th>
                    <th className="py-3 px-4 text-center">{getLabel('actions', 'تعديل')}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={user.role === 'first_manager' ? 12 : 15} className="py-8 text-center text-slate-400 font-medium">
                    لا توجد طلبات إلغاء تطابق خيارات التصفية المحددة حالياً.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((r, idx) => {
                  // Highlighting criteria: Days between 90 and 120 highlighted in amber
                  const isAmberHighlight = r.days >= 90 && r.days <= 120;
                  
                  if (user.role === 'first_manager') {
                    return (
                      <tr 
                        key={r.id} 
                        className={`hover:bg-slate-50/70 transition-colors ${
                          isAmberHighlight ? 'bg-amber-50/50 hover:bg-amber-100/50' : ''
                        } ${selectedIds.includes(r.id) ? 'bg-amber-400/10' : ''}`}
                      >
                        <td className="py-3.5 px-4 text-center">
                          <input 
                            type="checkbox" 
                            checked={selectedIds.includes(r.id)}
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
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-400">{r.id}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-800 font-mono">{r.membershipNumber}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-700">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{r.memberName}</span>
                            {(r.isReReview || r.memberName?.includes('إعادة عرض')) && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-400 text-neutral-950 shadow-xs border border-amber-500/20">
                                إعادة عرض
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-semibold block text-slate-800">{r.type}</span>
                          <span className="text-slate-500 text-xs font-normal">({r.days} يوم)</span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">{r.club}</td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">{r.paymentMethod}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-medium rounded-lg text-xxs inline-block border border-slate-200">
                            {r.documents || 'مستندات كاملة'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 max-w-[200px]">
                          <span className="text-slate-800 font-semibold block truncate" title={r.cancellationReasonDetail || r.cancellationReason}>
                            {r.cancellationReason || '—'}
                          </span>
                          {r.cancellationReasonDetail && (
                            <span className="text-slate-500 text-[10px] block truncate" title={r.cancellationReasonDetail}>
                              {r.cancellationReasonDetail}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setStatementTarget(r)}
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-black rounded-lg text-xxs flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs mx-auto"
                            title="عرض كشف الحساب المالي التفصيلي"
                          >
                            <FileText className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                            <span>كشف الحساب</span>
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {getCommitteeDecisionBadge(r)}
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr 
                      key={r.id} 
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isAmberHighlight ? 'bg-amber-50/50 hover:bg-amber-100/50' : ''
                      } ${selectedIds.includes(r.id) ? 'bg-amber-400/10' : ''}`}
                    >
                      <td className="py-3.5 px-4 text-center">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.includes(r.id)}
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
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-400">{r.id}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">{r.membershipNumber}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-700">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{r.memberName}</span>
                          {(r.isReReview || r.memberName?.includes('إعادة عرض')) && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-400 text-neutral-950 shadow-xs border border-amber-500/20">
                              إعادة عرض
                            </span>
                          )}
                          {r.reviewed && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-400/20 text-amber-600">
                              <CheckSquare className="w-2.5 h-2.5" /> reviewed
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-semibold block text-slate-800">{r.type}</span>
                        <span className="text-slate-500 text-xs font-normal">({r.days} يوم)</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{r.club}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">{r.paymentMethod}</td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700 whitespace-nowrap">
                        {formatCommitteeWithYear(r.committeeNo, r.committeeYear, r.approvalDate || r.requestDate || r.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {getCommitteeDecisionBadge(r)}
                      </td>
                      <td className="py-3.5 px-4 text-left font-black text-amber-600 max-w-[150px] whitespace-normal break-words">
                        {typeof r.refundAmount === 'number' 
                          ? `${r.refundAmount.toLocaleString()} ${r.currency || 'ج.م'}` 
                          : (r.refundAmount || '—')}
                        {r.paymentMethod !== 'ABK' && r.refundToClient !== undefined && r.refundToClient !== 'Not Required' && (
                          <span className="block text-[11px] font-bold text-purple-700 whitespace-normal break-words mt-0.5">
                            الرد للعميل: {typeof r.refundToClient === 'number' ? `${r.refundToClient.toLocaleString()} ${r.currency || 'ج.م'}` : r.refundToClient}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xxs font-bold ${
                          r.status === 'Cancelled' ? 'bg-amber-400/20 text-amber-600 border border-amber-400/10' :
                          r.status === 'Revoked' ? 'bg-sky-100 text-sky-700' :
                          r.status === 'Deletion' ? 'bg-purple-100 text-purple-700' :
                          r.status === 'Rejected' ? 'bg-rose-100 text-rose-700 border border-rose-200 font-black' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {r.status === 'Rejected' ? 'Rejected' : (translateStatus(r.status) || 'Pending')}
                        </span>
                        {getPendingSubStatus(r) && (
                          <>
                            <span className={`block text-[10px] font-bold mt-1 whitespace-nowrap ${
                              getPendingSubStatus(r) === '(الشيك تحت الاصدار)' ? 'text-emerald-600 font-black' :
                              getPendingSubStatus(r) === '(فى انتظار المديونية)' ? 'text-purple-600 font-bold' :
                              getPendingSubStatus(r) === '(فى انتظار اصل الايصال)' ? 'text-amber-600 font-bold' :
                              'text-slate-500 font-medium'
                            }`}>
                              {getPendingSubStatus(r)}
                            </span>
                            {getPendingSubStatus(r) === '(الشيك تحت الاصدار)' && (
                              <span className="block text-[9px] font-bold text-slate-500 mt-0.5 max-w-[130px] mx-auto whitespace-normal break-words leading-tight text-center">
                                ( تم ارسال المذكرة الى الادارة المالية )
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700 whitespace-nowrap">
                        <div className="inline-flex items-center justify-center gap-1.5">
                          <span>{r.statusDate ? formatDateCustom(r.statusDate) : (r.approvalDate ? formatDateCustom(r.approvalDate) : (r.requestDate ? formatDateCustom(r.requestDate) : '—'))}</span>
                          {user.role === 'admin' && (
                            <button
                              type="button"
                              onClick={() => handleOpenDateEdit(r)}
                              className="p-1 hover:bg-amber-100 text-slate-400 hover:text-amber-700 rounded transition-colors cursor-pointer"
                              title="تعديل تاريخ الحالة مانويال (للأدمن)"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {statusDateFeedback && String(statusDateFeedback.id) === String(r.id) && (
                          <span className="block text-[9px] text-emerald-600 font-bold mt-0.5">
                            {statusDateFeedback.text}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {user.role === 'admin' ? (
                          <input
                            type="checkbox"
                            checked={!!r.reviewed}
                            onChange={() => {
                              if (onBulkReview) {
                                onBulkReview([r.id], !r.reviewed);
                              }
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400 cursor-pointer"
                            title={r.reviewed ? "إلغاء المراجعة للسماح للمستخدم بالتعديل" : "تحديد كمراجع لمنع المستخدم من التعديل"}
                          />
                        ) : r.reviewed ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-600 font-bold text-[10px]">
                            <CheckSquare className="w-2.5 h-2.5" /> Reviewed
                          </span>
                        ) : (
                          <span className="text-slate-300 text-[10px] font-medium">قيد الانتظار</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Edit Details */}
                          {/* Clubs & International users can't edit once approval starts, checked inside action but visually disabled here */}
                          <button
                            onClick={() => onEditRequest(r)}
                            disabled={
                              (r.reviewed && user.role !== 'admin') ||
                              ((user.role === 'club' || user.role === 'international_user') && (r.result === 'Accepted' || r.approvalSentToFirstManager))
                            }
                            title={
                              r.reviewed && user.role !== 'admin'
                                ? "لا يمكن التعديل بعد مراجعة الطلب"
                                : "تعديل الحساب"
                            }
                            className="p-1 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>

                          {/* Settlement Statement Modal Button */}
                          <button
                            type="button"
                            onClick={() => setStatementTarget(r)}
                            className="p-1.5 text-xxs font-black rounded-md flex items-center gap-1 cursor-pointer transition-colors bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs"
                            title="عرض كشف الحساب التفصيلي والتسوية المالية"
                          >
                            <FileText className="h-3.5 w-3.5 text-amber-600" />
                            <span className="hidden xl:inline">كشف الحساب</span>
                          </button>

                          {/* Admin Attach PDF for First Manager */}
                          {user.role === 'admin' && onSendToFirstManager && (
                            <button
                              type="button"
                              onClick={() => onSendToFirstManager(r.id)}
                              className="p-1.5 text-xxs font-bold rounded-md flex items-center gap-1 cursor-pointer transition-colors bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 shadow-2xs"
                              title="إرسال وإرفاق مستندات PDF للمدير الأول للاعتماد (>3 شهور)"
                            >
                              <FileUp className="h-3.5 w-3.5 text-sky-600" />
                              <span className="hidden xl:inline">{r.firstManagerPdfUrl ? 'PDF مرفق' : 'إرفاق PDF'}</span>
                            </button>
                          )}

                          {/* Delete - Admin or Club owner */}
                          {(user.role === 'admin' || (user.role === 'club' && isSameClub(user.club, r.club))) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteRequest(r.id);
                              }}
                              title="حذف طلب إلغاء العضوية"
                              className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </TableScrollWrapper>
      </div>

      {/* Revocation Modal for Admin */}
      {revokeTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-right no-print" dir="rtl">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-sky-700">
              <RotateCcw className="h-5 w-5 shrink-0" />
              <h3 className="text-sm font-black text-slate-800">
                تسجيل تراجع عن طلب الإلغاء - العضوية ({revokeTarget.membershipNumber})
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              عند التراجع عن طلب العضو <strong>{revokeTarget.memberName}</strong>، تصبح حالة الإلغاء <span className="font-bold text-sky-700">Revoked (تراجع)</span> ويتم اعتماد تاريخ حالة الإلغاء بناءً على تاريخ التراجع الإجباري المدخل أدناه.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                تاريخ التراجع (إجباري Mandatory):
              </label>
              <input
                type="date"
                value={revokeDate}
                onChange={(e) => setRevokeDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRevokeTarget(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!revokeDate) {
                    alert('برجاء إدخال تاريخ التراجع إجباريًا');
                    return;
                  }
                  setIsSubmittingRevoke(true);
                  const token = localStorage.getItem('wd_token') || '';
                  try {
                    const res = await fetch(`/api/requests/${revokeTarget.id}`, {
                      method: 'PUT',
                      headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({
                        ...revokeTarget,
                        status: 'Revoked',
                        statusDate: revokeDate
                      })
                    });
                    const data = await res.json();
                    if (!res.ok || data.error) {
                      throw new Error(data.error || 'حدث خطأ أثناء تسجيل التراجع');
                    }
                    setRevokeTarget(null);
                    if (onRefresh) onRefresh();
                  } catch (err: any) {
                    alert(err.message || 'فشل الاتصال بالخادم');
                  } finally {
                    setIsSubmittingRevoke(false);
                  }
                }}
                disabled={isSubmittingRevoke}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isSubmittingRevoke ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                <span>تأكيد وتسجيل التراجع</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statement Breakdown Modal */}
      {statementTarget && (
        <SettlementStatementModal
          request={statementTarget}
          onClose={() => setStatementTarget(null)}
        />
      )}

      {/* Manual Status Date Edit Modal for Admin */}
      {dateEditTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 text-right font-sans" dir="rtl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800">تعديل تاريخ الحالة يدويًا</h3>
                  <p className="text-xxs text-slate-400 font-mono mt-0.5">
                    عضوية رقم: {dateEditTarget.membershipNumber} — {dateEditTarget.memberName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDateEditTarget(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  تاريخ الحالة (Status Date)
                </label>
                <input
                  type="date"
                  value={newStatusDate}
                  onChange={(e) => setNewStatusDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setNewStatusDate(new Date().toISOString().split('T')[0])}
                  className="px-2.5 py-1 text-xxs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                >
                  تاريخ اليوم
                </button>
                <button
                  type="button"
                  onClick={() => setNewStatusDate('')}
                  className="px-2.5 py-1 text-xxs font-bold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors cursor-pointer"
                >
                  مسح التاريخ (فارغ)
                </button>
              </div>

              <div className="bg-amber-50/70 border border-amber-200 p-3 rounded-xl text-xxs text-amber-900 leading-relaxed">
                <strong>ملاحظة:</strong> يتم تعيين تاريخ الحالة تلقائيًا بتاريخ يوم رفع شيت المديونيات، وتتيح هذه الخاصية للأدمن تعديل تاريخ الحالة يدويًا لأي تاريخ مطلوب.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDateEditTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveStatusDate}
                disabled={isSavingStatusDate}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isSavingStatusDate ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                <span>حفظ التعديل</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* First Manager Decision Modal */}
      <FirstManagerDecisionModal
        isOpen={!!firstManagerTarget}
        request={firstManagerTarget}
        onClose={() => setFirstManagerTarget(null)}
        onDecision={handleFirstManagerModalDecision}
        onOpenStatement={(req) => setStatementTarget(req)}
        onOpenPDF={(req) => setPdfTarget(req)}
        isSubmitting={isSubmittingFirstManager}
      />

      {/* First Manager PDF / Print Modal */}
      <FirstManagerPDFModal
        isOpen={!!pdfTarget}
        request={pdfTarget}
        onClose={() => setPdfTarget(null)}
      />

      {/* Rejection Reason Modal for Committee Decision */}
      {rejectionModalTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-right no-print" dir="rtl">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-100 text-rose-600">
                  <XCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">تفاصيل قرار الرفض (Rejected)</h3>
                  <p className="text-xxs text-slate-500">سبب الرفض والبيانات الخاصة بطلب الإلغاء</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectionModalTarget(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Request details summary */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400 text-xxs block font-bold">رقم العضوية:</span>
                <span className="font-mono font-black text-slate-900">{rejectionModalTarget.membershipNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xxs block font-bold">اسم العضو:</span>
                <span className="font-bold text-slate-800">{rejectionModalTarget.memberName}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xxs block font-bold">النادي:</span>
                <span className="font-medium text-slate-700">{rejectionModalTarget.club}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xxs block font-bold">تاريخ الرفض (تاريخ الحالة):</span>
                <span className="font-mono font-bold text-rose-700">
                  {rejectionModalTarget.statusDate ? formatDateCustom(rejectionModalTarget.statusDate) : (rejectionModalTarget.firstManagerDecisionDate ? formatDateCustom(rejectionModalTarget.firstManagerDecisionDate) : '—')}
                </span>
              </div>
            </div>

            {/* Rejection Reason Box */}
            <div className="bg-rose-50/80 p-4 rounded-xl border border-rose-200 space-y-1.5">
              <span className="text-rose-800 text-xs font-black flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                سبب الرفض:
              </span>
              <p className="text-slate-800 text-xs font-bold leading-relaxed bg-white p-3 rounded-lg border border-rose-100 whitespace-pre-wrap">
                {rejectionModalTarget.adminNote || rejectionModalTarget.firstManagerComments || rejectionModalTarget.sectorManagerComments || rejectionModalTarget.clubNote || 'لم يتم تسجيل ملاحظات أو سبب محدد للرفض.'}
              </p>
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setRejectionModalTarget(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
