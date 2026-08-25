import React, { useState, useMemo } from 'react';
import { 
  FileCheck2, Search, CheckSquare, Calendar, RefreshCw, Filter, AlertCircle, CheckCircle2, RotateCcw, Tag, FileText, Edit3
} from 'lucide-react';
import { CancellationRequest, User, Dropdowns } from '../types';
import { translateStatus, formatDateCustom, formatCommitteeYear, formatCommitteeWithYear, getPendingSubStatus, toInputDateStr, isSameClub, isInternationalRequest } from '../utils';
import MultiSelect from './MultiSelect';
import TableScrollWrapper from './TableScrollWrapper';
import SettlementStatementModal from './SettlementStatementModal';

interface CancellationStatusManagerProps {
  requests: CancellationRequest[];
  user: User;
  dropdowns: Dropdowns;
  onRefresh: () => void;
  labelNames?: Record<string, string>;
}

export default function CancellationStatusManager({
  requests,
  user,
  dropdowns,
  onRefresh,
  labelNames
}: CancellationStatusManagerProps) {
  
  // Search state filters
  const [memberNameSearch, setMemberNameSearch] = useState('');
  const [loanUnderNameSearch, setLoanUnderNameSearch] = useState('');
  const [membershipNumberSearch, setMembershipNumberSearch] = useState('');
  const [subscriptionTypeFilter, setSubscriptionTypeFilter] = useState<string[]>([]);
  const [committeeNoSearch, setCommitteeNoSearch] = useState<string[]>([]);
  const [committeeYearSearch, setCommitteeYearSearch] = useState<string[]>([]);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string[]>([]);
  const [clubFilter, setClubFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

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

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Bulk update state
  const [targetStatus, setTargetStatus] = useState<'Cancelled' | 'Deletion' | 'Revoked' | 'Pending'>('Cancelled');
  const [targetStatusDate, setTargetStatusDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Single Revoke Modal State
  const [revokeTarget, setRevokeTarget] = useState<CancellationRequest | null>(null);
  const [revokeDate, setRevokeDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Statement breakdown modal target state
  const [statementTarget, setStatementTarget] = useState<CancellationRequest | null>(null);

  // Manual Status Date Edit state for Admin
  const [dateEditTarget, setDateEditTarget] = useState<CancellationRequest | null>(null);
  const [newStatusDate, setNewStatusDate] = useState<string>('');
  const [isSavingStatusDate, setIsSavingStatusDate] = useState(false);
  const [statusDateFeedback, setStatusDateFeedback] = useState<{ id: number | string; text: string } | null>(null);

  const handleOpenDateEdit = (r: CancellationRequest) => {
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
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء حفظ تاريخ الحالة');
    } finally {
      setIsSavingStatusDate(false);
    }
  };

  // Extract unique committee numbers and years for filter dropdowns
  const committeeOptions = useMemo(() => {
    const numbers = new Set<string>();
    const years = new Set<string>();
    requests.forEach(r => {
      if (r.committeeNo) numbers.add(r.committeeNo);
      if (r.committeeYear) years.add(formatCommitteeYear(r.committeeYear));
    });
    return {
      numbers: Array.from(numbers).sort(),
      years: Array.from(years).sort()
    };
  }, [requests]);

  // Filtering requests
  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      // Role confinement
      if (user.role === 'club' && !isSameClub(r.club, user.club)) {
        return false;
      }
      if (user.role === 'international_user' && !isInternationalRequest(r)) {
        return false;
      }

      // Member Name
      if (memberNameSearch.trim() && !r.memberName.toLowerCase().includes(memberNameSearch.toLowerCase().trim())) {
        return false;
      }

      // Loan Under Name
      if (loanUnderNameSearch.trim()) {
        const loanName = r.loanUnderName || '';
        if (!loanName.toLowerCase().includes(loanUnderNameSearch.toLowerCase().trim())) {
          return false;
        }
      }

      // Membership Number
      if (membershipNumberSearch.trim() && !r.membershipNumber.toLowerCase().includes(membershipNumberSearch.toLowerCase().trim())) {
        return false;
      }

      // Subscription Duration (مدة الاشتراك)
      if (subscriptionTypeFilter.length > 0 && !subscriptionTypeFilter.includes(r.type || '')) {
        return false;
      }

      // Committee Number
      if (committeeNoSearch.length > 0 && !committeeNoSearch.includes(r.committeeNo || '')) {
        return false;
      }

      // Committee Year
      if (committeeYearSearch.length > 0 && !committeeYearSearch.includes(r.committeeYear || '')) {
        return false;
      }

      // Payment Method
      if (paymentMethodFilter.length > 0 && !paymentMethodFilter.includes(r.paymentMethod)) {
        return false;
      }

      // Club / Branch
      if (clubFilter.length > 0 && !clubFilter.includes(r.club)) {
        return false;
      }

      // Status
      if (statusFilter.length > 0 && !statusFilter.includes(r.status)) {
        return false;
      }

      return true;
    });
  }, [
    requests, user, memberNameSearch, loanUnderNameSearch, membershipNumberSearch, subscriptionTypeFilter,
    committeeNoSearch, committeeYearSearch, paymentMethodFilter, clubFilter, statusFilter
  ]);

  // Check all / uncheck all toggle
  const isAllSelected = useMemo(() => {
    if (filteredRequests.length === 0) return false;
    return filteredRequests.every(r => selectedIds.includes(r.id));
  }, [filteredRequests, selectedIds]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRequests.map(r => r.id));
    }
  };

  const handleToggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Reset all search filters
  const handleResetFilters = () => {
    setMemberNameSearch('');
    setLoanUnderNameSearch('');
    setMembershipNumberSearch('');
    setSubscriptionTypeFilter([]);
    setCommitteeNoSearch([]);
    setCommitteeYearSearch([]);
    setPaymentMethodFilter([]);
    setClubFilter([]);
    setStatusFilter([]);
    setSelectedIds([]);
  };

  // Handle Bulk Status Update
  const handleApplyBulkStatus = async () => {
    if (selectedIds.length === 0) {
      setFeedbackMsg({ type: 'error', text: 'برجاء تحديد عضوية واحدة على الأقل من الجدول' });
      return;
    }

    if (targetStatus !== 'Pending' && !targetStatusDate) {
      setFeedbackMsg({ type: 'error', text: 'تاريخ حالة الإلغاء إجباري عند اختيار حالة إلغاء جديدة' });
      return;
    }

    setIsSubmitting(true);
    setFeedbackMsg(null);

    const token = localStorage.getItem('wd_token') || '';
    try {
      const res = await fetch('/api/requests/bulk-cancellation-status', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ids: selectedIds,
          status: targetStatus,
          statusDate: targetStatus === 'Pending' ? '' : targetStatusDate
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'حدث خطأ أثناء تحديث حالات الإلغاء');
      }

      setFeedbackMsg({
        type: 'success',
        text: `تم تحديث حالة الإلغاء بنجاح لعدد ${data.updatedCount || selectedIds.length} عضوية (${translateStatus(targetStatus)})`
      });
      setSelectedIds([]);
      onRefresh();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'فشل الاتصال بالخادم' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Single Revoke Confirmation
  const handleConfirmSingleRevoke = async () => {
    if (!revokeTarget) return;
    if (!revokeDate) {
      alert('برجاء إدخال تاريخ التراجع إجباريًا');
      return;
    }

    setIsSubmitting(true);
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

      setFeedbackMsg({
        type: 'success',
        text: `تم تسجيل التراجع بنجاح للعضوية رقم ${revokeTarget.membershipNumber} بتاريخ ${revokeDate}`
      });
      setRevokeTarget(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'فشل الاتصال بالخادم');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <FileCheck2 className="h-6 w-6 text-amber-500" />
            <span>إدارة وتحديث حالات الإلغاء وتاريخ الإلغاء (Cancellation Status Manager)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            استخدم نموذج البحث المتقدم أدناه للفلترة والبحث السريع، ثم حدد العضويات لتغيير حالة الإلغاء وتاريخ الإلغاء بشكل فردي أو جماعي.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw className="h-4 w-4 text-slate-500" />
            <span>تحديث البيانات</span>
          </button>
        </div>
      </div>

      {/* Advanced Multi-Field Search Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Filter className="h-4 w-4 text-amber-500" />
            <span>معايير البحث والفلترة المخصصة</span>
          </h3>
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xxs font-bold text-amber-600 hover:text-amber-700 hover:underline cursor-pointer"
          >
            إعادة ضبط الفلاتر
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* 1. Member Name */}
          <div>
            <label className="block text-slate-500 font-bold mb-1">اسم العضو</label>
            <div className="relative">
              <input
                type="text"
                value={memberNameSearch}
                onChange={(e) => setMemberNameSearch(e.target.value)}
                placeholder="ابحث باسم المشترك..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-right focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
              />
            </div>
          </div>

          {/* 2. Loan Under Name */}
          <div>
            <label className="block text-slate-500 font-bold mb-1">القرض بإسم</label>
            <input
              type="text"
              value={loanUnderNameSearch}
              onChange={(e) => setLoanUnderNameSearch(e.target.value)}
              placeholder="اسم صاحب القرض / الشركة..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-right focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
            />
          </div>

          {/* 3. Membership Number */}
          <div>
            <label className="block text-slate-500 font-bold mb-1">رقم العضوية</label>
            <input
              type="text"
              value={membershipNumberSearch}
              onChange={(e) => setMembershipNumberSearch(e.target.value)}
              placeholder="مثال: 102030..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-right focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono font-bold"
            />
          </div>

          {/* 3.5 Subscription Duration */}
          <div>
            <label className="block text-slate-500 font-bold mb-1">مدة الاشتراك</label>
            <MultiSelect
              options={subscriptionTypeOptions}
              selected={subscriptionTypeFilter}
              onChange={setSubscriptionTypeFilter}
              placeholder="جميع مدد الاشتراك"
            />
          </div>

          {/* 4. Payment Method */}
          <div>
            <label className="block text-slate-500 font-bold mb-1">طريقة الدفع</label>
            <MultiSelect
              options={dropdowns.paymentMethods}
              selected={paymentMethodFilter}
              onChange={setPaymentMethodFilter}
              placeholder="جميع طرق الدفع"
            />
          </div>

          {/* 5. Committee No & Approval Year */}
          <div>
            <label className="block text-slate-500 font-bold mb-1">رقم اللجنة</label>
            <MultiSelect
              options={committeeOptions.numbers.map(cNo => ({ label: `لجنة رقم ${cNo}`, value: cNo }))}
              selected={committeeNoSearch}
              onChange={setCommitteeNoSearch}
              placeholder="جميع اللجان"
            />
          </div>

          <div>
            <label className="block text-slate-500 font-bold mb-1">سنة اعتماد اللجنة</label>
            <MultiSelect
              options={committeeOptions.years.map(cYr => ({ label: `سنة ${cYr}`, value: cYr }))}
              selected={committeeYearSearch}
              onChange={setCommitteeYearSearch}
              placeholder="جميع السنين"
            />
          </div>

          {/* 6. Club / Branch */}
          <div>
            <label className="block text-slate-500 font-bold mb-1">النادي / الفرع</label>
            <MultiSelect
              options={dropdowns.clubs}
              selected={clubFilter}
              onChange={setClubFilter}
              placeholder="جميع الفروع"
            />
          </div>

          {/* 7. Current Status */}
          <div>
            <label className="block text-slate-500 font-bold mb-1">حالة الإلغاء الحالية</label>
            <MultiSelect
              options={(dropdowns?.cancellationStatuses || ["Pending", "Cancelled", "Revoked", "Deletion"]).map((st) => ({
                label: translateStatus(st) || st,
                value: st
              }))}
              selected={statusFilter}
              onChange={setStatusFilter}
              placeholder="جميع الحالات"
            />
          </div>
        </div>
      </div>

      {/* Bulk Status Update Control Panel */}
      <div className="bg-amber-50/50 border-2 border-amber-200 p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-amber-200/60 pb-3">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-amber-400 text-neutral-950 font-black rounded-xl">
              <CheckSquare className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-black text-slate-800">
                شريط التحديث الجماعي لحالة وتاريخ الإلغاء
              </h3>
              <span className="text-xs text-amber-700 font-bold mt-0.5 block">
                العضويات المحددة حالياً: <span className="bg-amber-400 text-neutral-950 px-2 py-0.5 rounded-full font-black text-xs">{selectedIds.length}</span> من أصل {filteredRequests.length} عضوية معروضة
              </span>
            </div>
          </div>

          {selectedIds.length > 0 && (
            <button
              onClick={() => setSelectedIds([])}
              className="text-xs font-bold text-slate-600 hover:text-slate-800 underline cursor-pointer"
            >
              إلغاء التحديد الكل
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          {/* Status Dropdown */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              تحديد حالة الإلغاء الجديدة (Cancellation Status):
            </label>
            <select
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value as any)}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer shadow-xs"
            >
              {(dropdowns?.cancellationStatuses || ["Pending", "Cancelled", "Revoked", "Deletion"]).map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* Status Date Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              تاريخ حالة الإلغاء (إجباري):
            </label>
            <input
              type="date"
              disabled={targetStatus === 'Pending'}
              value={targetStatus === 'Pending' ? '' : targetStatusDate}
              onChange={(e) => setTargetStatusDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50 shadow-xs"
            />
          </div>

          {/* Apply Button */}
          <div>
            <button
              type="button"
              onClick={handleApplyBulkStatus}
              disabled={isSubmitting || selectedIds.length === 0}
              className="w-full py-2.5 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>جاري تحديث الحالات...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>تطبيق حالة الإلغاء على {selectedIds.length} عضوية</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Feedback Message */}
        {feedbackMsg && (
          <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
            feedbackMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Tag className="h-4 w-4 text-amber-500" />
            <span>قائمة العضويات وطابق الحالة المحدثة ({filteredRequests.length} عضوية)</span>
          </h3>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <label className="flex items-center gap-1.5 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleToggleSelectAll}
                className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400 cursor-pointer"
              />
              <span>تحديد الكل (Check All)</span>
            </label>
          </div>
        </div>

        <TableScrollWrapper>
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <th className="p-3 text-center w-12">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleToggleSelectAll}
                    className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400 cursor-pointer"
                  />
                </th>
                <th className="p-3">رقم العضوية</th>
                <th className="p-3">اسم المشترك</th>
                <th className="p-3">القرض بإسم</th>
                <th className="p-3">رقم اللجنة / السنة</th>
                <th className="p-3">النادي</th>
                <th className="p-3">طريقة الدفع</th>
                <th className="p-3 text-center">حالة الإلغاء الحالية</th>
                <th className="p-3 text-center">تاريخ الإلغاء</th>
                <th className="p-3 text-center">كشف الحساب</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-400 text-xs font-bold">
                    لا توجد عضويات تطابق معايير البحث المحددة.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((r) => {
                  const isSelected = selectedIds.includes(r.id);
                  return (
                    <tr 
                      key={r.id} 
                      className={`hover:bg-amber-50/20 transition-colors ${isSelected ? 'bg-amber-50/40' : ''}`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(r.id)}
                          className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-900">
                        {r.membershipNumber}
                      </td>
                      <td className="p-3 font-bold text-slate-800">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{r.memberName}</span>
                          {(r.isReReview || r.memberName?.includes('إعادة عرض')) && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-400 text-neutral-950 shadow-xs border border-amber-500/20">
                              إعادة عرض
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-slate-600 font-medium">
                        {r.loanUnderName || '—'}
                      </td>
                      <td className="p-3 font-bold text-slate-700">
                        {formatCommitteeWithYear(r.committeeNo, r.committeeYear, r.approvalDate || r.requestDate || r.createdAt)}
                      </td>
                      <td className="p-3 text-slate-600 font-medium">
                        {r.club}
                      </td>
                      <td className="p-3 text-slate-600 font-medium">
                        {r.paymentMethod}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xxs font-black border ${
                          r.status === 'Cancelled' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                          r.status === 'Deletion' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                          r.status === 'Revoked' ? 'bg-sky-100 text-sky-800 border-sky-300' :
                          'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {translateStatus(r.status) || 'Pending'}
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
                      <td className="p-3 text-center font-mono text-slate-700 font-bold whitespace-nowrap">
                        <div className="inline-flex items-center justify-center gap-1.5">
                          <span>{r.statusDate ? formatDateCustom(r.statusDate) : '—'}</span>
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
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => setStatementTarget(r)}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xxs font-black transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                          title="عرض كشف الحساب التفصيلي والتسوية المالية"
                        >
                          <FileText className="h-3.5 w-3.5 text-amber-600" />
                          <span>كشف الحساب</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </TableScrollWrapper>
      </div>

      {/* Manual Status Date Edit Modal for Admin */}
      {dateEditTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in text-right font-sans" dir="rtl">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5">
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

      {/* Single Revocation Modal */}
      {revokeTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-right" dir="rtl">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-sky-700">
              <RotateCcw className="h-5 w-5 shrink-0" />
              <h3 className="text-sm font-black text-slate-800">
                تسجيل حالة (تراجع) للعضوية رقم {revokeTarget.membershipNumber}
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              عند تسجيل حالة (تراجع)، تتغير حالة الإلغاء الخاصة بالمشترك <strong>{revokeTarget.memberName}</strong> إلى <span className="font-bold text-sky-700">Revoked (مسترد/تراجع)</span> ويصبح تاريخ حالة الإلغاء محددًا بتاريخ التراجع المدخل أدناه.
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
                onClick={handleConfirmSingleRevoke}
                disabled={isSubmitting}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                <span>تأكيد وتسجيل التراجع الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statement Modal */}
      {statementTarget && (
        <SettlementStatementModal
          request={statementTarget}
          onClose={() => setStatementTarget(null)}
        />
      )}
    </div>
  );
}
