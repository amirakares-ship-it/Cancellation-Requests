import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Search, Download, CheckCircle2, Clock, FileSpreadsheet, Receipt, Calendar, CheckSquare } from 'lucide-react';
import { CancellationRequest, User } from '../types';
import { translateStatus, formatDateCustom, formatCommitteeWithYear, getPendingSubStatus, isSameClub, containsSearchQuery, isInternationalRequest } from '../utils';
import MultiSelect from './MultiSelect';
import TableScrollWrapper from './TableScrollWrapper';
import * as XLSX from 'xlsx';

interface AdvanceReceiptsProps {
  requests: CancellationRequest[];
  user: User;
  onUpdateReceiptStatus: (id: number, received: boolean) => Promise<void>;
  labelNames?: Record<string, string>;
}

export default function AdvanceReceipts({ requests, user, onUpdateReceiptStatus, labelNames }: AdvanceReceiptsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequestStatuses, setSelectedRequestStatuses] = useState<string[]>([]);
  const [selectedClubs, setSelectedClubs] = useState<string[]>([]);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [selectedCommittees, setSelectedCommittees] = useState<string[]>([]);
  const [selectedSubscriptionTypes, setSelectedSubscriptionTypes] = useState<string[]>([]);
  const [receiptFilters, setReceiptFilters] = useState<string[]>([]); // received, pending

  // Subscription duration options
  const subscriptionTypeOptions = useMemo(() => {
    const set = new Set<string>();
    const defaults = ['اقل من شهر', 'اقل من 3 شهور', '1 سنة', '2 سنة', '3 سنة', '4 سنة', '5 سنة', '6 سنة', '7 سنة', '8 سنة', '9 سنة', '10 سنة'];
    defaults.forEach(d => set.add(d));
    requests.forEach(r => {
      if (r.type) set.add(r.type);
    });
    return Array.from(set);
  }, [requests]);
  const [selectedRowIds, setSelectedRowIds] = useState<number[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const getLabel = (key: string, fallback: string) => {
    return labelNames?.[key] || fallback;
  };

  // List of unique request cancellation statuses
  const requestStatusesList = useMemo(() => {
    const statuses = new Set<string>();
    requests.forEach(r => {
      if (r.status) statuses.add(r.status);
    });
    return Array.from(statuses).map(st => ({
      label: translateStatus(st),
      value: st
    }));
  }, [requests]);

  // List of unique clubs present in requests
  const clubsList = useMemo(() => {
    const clubs = new Set<string>();
    requests.forEach(r => {
      if (r.club) clubs.add(r.club);
    });
    return Array.from(clubs);
  }, [requests]);

  // List of unique payment methods
  const paymentMethodsList = useMemo(() => {
    const methods = new Set<string>();
    requests.forEach(r => {
      if (r.paymentMethod) methods.add(r.paymentMethod);
    });
    return Array.from(methods);
  }, [requests]);

  // List of unique committee numbers
  const committeesList = useMemo(() => {
    const comms = new Set<string>();
    requests.forEach(r => {
      if (r.committeeNo) comms.add(String(r.committeeNo));
    });
    return Array.from(comms)
      .sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0))
      .map(c => ({
        label: `لجنة ${c}`,
        value: c
      }));
  }, [requests]);

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      // Search matches membership number, member name, external ID, national ID, club, etc.
      const matchesSearch = !searchQuery ||
        containsSearchQuery(r.membershipNumber, searchQuery) ||
        containsSearchQuery(r.memberName, searchQuery) ||
        containsSearchQuery(r.nationalId, searchQuery) ||
        containsSearchQuery(r.externalId, searchQuery) ||
        containsSearchQuery(r.salesPerson, searchQuery) ||
        containsSearchQuery(r.club, searchQuery) ||
        containsSearchQuery(r.committeeNo, searchQuery) ||
        containsSearchQuery(r.type, searchQuery) ||
        containsSearchQuery(r.type2, searchQuery);

      // Request status match
      const matchesRequestStatus = selectedRequestStatuses.length === 0 || selectedRequestStatuses.includes(r.status);

      // Subscription duration match
      const matchesSubscriptionType = selectedSubscriptionTypes.length === 0 || (r.type && selectedSubscriptionTypes.includes(r.type));

      // Club match
      const matchesClub = selectedClubs.length === 0 || selectedClubs.includes(r.club);

      // Payment Method match
      const matchesPayment = selectedPaymentMethods.length === 0 || selectedPaymentMethods.includes(r.paymentMethod);

      // Committee match
      const matchesCommittee = selectedCommittees.length === 0 || (r.committeeNo && selectedCommittees.includes(String(r.committeeNo)));

      // Receipt status match
      const matchesStatus = receiptFilters.length === 0 || (
        (receiptFilters.includes('received') && r.receiptReceived) ||
        (receiptFilters.includes('pending') && !r.receiptReceived)
      );

      // If user is a club role or international_user, they should only see their allowed requests
      const matchesUserRole = user.role === 'club' 
        ? isSameClub(r.club, user.club) 
        : user.role === 'international_user'
          ? isInternationalRequest(r)
          : true;

      return matchesSearch && matchesRequestStatus && matchesSubscriptionType && matchesClub && matchesPayment && matchesCommittee && matchesStatus && matchesUserRole;
    });
  }, [requests, searchQuery, selectedRequestStatuses, selectedSubscriptionTypes, selectedClubs, selectedPaymentMethods, selectedCommittees, receiptFilters, user]);

  // Statistics
  const stats = useMemo(() => {
    const relevantRequests = user.role === 'club' 
      ? requests.filter(r => isSameClub(r.club, user.club)) 
      : user.role === 'international_user'
        ? requests.filter(r => isInternationalRequest(r))
        : requests;

    const total = relevantRequests.length;
    const received = relevantRequests.filter(r => r.receiptReceived).length;
    const pending = total - received;
    const receivedPercent = total > 0 ? Math.round((received / total) * 100) : 0;
    const pendingPercent = total > 0 ? Math.round((pending / total) * 100) : 0;

    return { total, received, pending, receivedPercent, pendingPercent };
  }, [requests, user]);

  // Selection toggle logic
  const allSelected = useMemo(() => {
    return filteredRequests.length > 0 && filteredRequests.every(r => selectedRowIds.includes(r.id));
  }, [filteredRequests, selectedRowIds]);

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedRowIds([]);
    } else {
      setSelectedRowIds(filteredRequests.map(r => r.id));
    }
  };

  const toggleSelectRow = (id: number) => {
    setSelectedRowIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Bulk update receipt status
  const handleBulkUpdateReceiptStatus = async (received: boolean) => {
    if (selectedRowIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      for (const id of selectedRowIds) {
        await onUpdateReceiptStatus(id, received);
      }
      setSelectedRowIds([]);
    } catch (err) {
      console.error('Error in bulk receipt status update:', err);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Excel Export Report
  const handleExportReceiptsReport = () => {
    setIsExporting(true);
    try {
      const dataToExport = filteredRequests.map((r, idx) => ({
        'م': idx + 1,
        'رقم العضوية': r.membershipNumber || '',
        'اسم العضو': r.memberName || '',
        'القرض بإسم': r.loanUnderName || 'لا يوجد',
        'الرقم القومى': r.nationalId || '',
        'طريقة الدفع': r.paymentMethod || '',
        'النادي': r.club || '',
        'ايصال المقدم': r.receiptReceived ? 'تم الاستلام' : 'لم يتم',
        'حالة استلام أصل الإيصال': r.receiptReceived ? '✓ تم الاستلام' : '✗ لم يتم الاستلام',
        'تاريخ استلام الأصل': r.receiptReceivedDate || 'بانتظار الاستلام',
        'سبب الرفض': r.firstManagerComments || r.sectorManagerComments || r.adminNote || (r.result === 'Rejected' || r.status === 'Rejected' ? r.cancellationReasonDetail : '') || '—',
        'حالة الإلغاء': translateStatus(r.status || 'Pending'),
        'تاريخ حالة الإلغاء': r.statusDate || '—',
        'المراجعة': r.reviewed ? 'تم المراجعة' : 'لم يتم',
        'تم الارسال': r.approvalSentToFirstManager ? 'تم' : 'لم يتم',
        'رقم اللجنة': formatCommitteeWithYear(r.committeeNo, r.committeeYear, r.approvalDate || r.requestDate || r.createdAt),
        'تاريخ موافقة اللجنة': r.approvalDate || r.committeeYear || '—',
        'فترة الاشتراك باليوم': r.days ?? 0,
        'تصنيف فترة الاشتراك': r.type || '',
        'نوع الاستثناء': r.exceptionType || '—',
        'الاستثناء': r.isException ? (r.exceptions ? `نعم - ${r.exceptions}` : 'نعم') : (r.exceptions || 'لا يوجد')
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'تقرير إيصالات المقدم');
      
      // Set right-to-left layout for Excel
      if (!worksheet['!views']) worksheet['!views'] = [];
      worksheet['!views'].push({ RTL: true });

      XLSX.writeFile(workbook, `تقرير_ايصالات_المقدم_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Error exporting excel:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-amber-500" />
            <span>إيصالات مقدم العضويات الملغاة</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            متابعة استلام أصول الإيصالات وصيغ التنازل الورقية الموقعة من الأعضاء وتأكيد أرشفة الملفات بالخزينة
          </p>
        </div>

        {/* Export Report (Sector Manager & Admin only) */}
        {(user.role === 'admin' || user.role === 'sector_manager') && (
          <button
            onClick={handleExportReceiptsReport}
            disabled={isExporting || filteredRequests.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-500 disabled:bg-slate-200 disabled:text-slate-400 text-neutral-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>تصدير تقرير أصول الإيصالات ({filteredRequests.length})</span>
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 block">إجمالي ملفات الإلغاء</span>
            <span className="text-2xl font-black text-slate-800">{stats.total}</span>
          </div>
          <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 font-bold text-lg">
            #
          </div>
        </div>

        <div className="bg-amber-400/10 p-5 rounded-2xl border border-amber-400/20 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-amber-600 block">تم استلام أصل الإيصال</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-500">{stats.received}</span>
              <span className="text-xs font-bold text-amber-600">({stats.receivedPercent}%)</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-500">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-rose-50/50 p-5 rounded-2xl border border-rose-100/60 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-rose-600 block font-sans">بانتظار استلام الأصل</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-800">{stats.pending}</span>
              <span className="text-xs font-bold text-rose-600">({stats.pendingPercent}%)</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-full bg-rose-100/50 flex items-center justify-center text-rose-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Bulk Action Banner */}
      {selectedRowIds.length > 0 && (
        <div className="bg-amber-500 text-neutral-950 p-3.5 rounded-xl flex flex-wrap justify-between items-center gap-3 shadow-md border border-amber-400 font-bold text-xs">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5" />
            <span>تم تحديد <span className="underline text-sm font-black">{selectedRowIds.length}</span> عضوية</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkUpdateReceiptStatus(true)}
              disabled={isBulkProcessing}
              className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>تأكيد استلام الأصل الورقي للمحدد</span>
            </button>
            <button
              onClick={() => handleBulkUpdateReceiptStatus(false)}
              disabled={isBulkProcessing}
              className="px-3.5 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              <Clock className="w-4 h-4 text-white" />
              <span>إلغاء تأكيد الاستلام للمحدد</span>
            </button>
            <button
              onClick={() => setSelectedRowIds([])}
              className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      {/* Filters bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 items-center">
          {/* Search text */}
          <div className="relative">
            <input
              type="text"
              placeholder="ابحث برقم العضوية أو اسم المشترك..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white text-slate-700 placeholder-slate-400"
            />
            <Search className="absolute right-3 top-2.5 w-4.5 h-4.5 text-slate-400" />
          </div>

          {/* Subscription Duration Filter */}
          <div>
            <MultiSelect
              options={subscriptionTypeOptions}
              selected={selectedSubscriptionTypes}
              onChange={setSelectedSubscriptionTypes}
              placeholder="مدة الاشتراك (الكل)"
            />
          </div>

          {/* Request Status Filter */}
          <div>
            <MultiSelect
              options={requestStatusesList}
              selected={selectedRequestStatuses}
              onChange={setSelectedRequestStatuses}
              placeholder="حالة الطلب (الكل)"
            />
          </div>

          {/* Payment Method Filter */}
          <div>
            <MultiSelect
              options={paymentMethodsList}
              selected={selectedPaymentMethods}
              onChange={setSelectedPaymentMethods}
              placeholder="طريقة السداد (الكل)"
            />
          </div>

          {/* Committee Filter */}
          <div>
            <MultiSelect
              options={committeesList}
              selected={selectedCommittees}
              onChange={setSelectedCommittees}
              placeholder="رقم اللجنة (الكل)"
            />
          </div>

          {/* Club Filter (Hidden if user is club role) */}
          {user.role !== 'club' ? (
            <div>
              <MultiSelect
                options={clubsList}
                selected={selectedClubs}
                onChange={setSelectedClubs}
                placeholder="كل الفروع / النوادي"
              />
            </div>
          ) : (
            <div></div>
          )}

          {/* Receipt Status Filter */}
          <div>
            <MultiSelect
              options={[
                { label: 'تم استلام الأصل الورقي', value: 'received' },
                { label: 'بانتظار استلام الأصل', value: 'pending' }
              ]}
              selected={receiptFilters}
              onChange={setReceiptFilters}
              placeholder="حالة أصل الإيصال"
            />
          </div>
        </div>

        {/* Request Count and Reset */}
        <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-xxs font-bold text-slate-400">
          <div>
            عرض {filteredRequests.length} من أصل {requests.length} طلبات إلغاء
          </div>
          {(selectedRequestStatuses.length > 0 || selectedPaymentMethods.length > 0 || selectedCommittees.length > 0 || selectedClubs.length > 0 || receiptFilters.length > 0 || searchQuery.trim() !== '') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedRequestStatuses([]);
                setSelectedPaymentMethods([]);
                setSelectedCommittees([]);
                setSelectedClubs([]);
                setReceiptFilters([]);
              }}
              className="text-amber-600 hover:text-amber-700 hover:underline flex items-center gap-1 cursor-pointer"
            >
              إعادة ضبط الفلاتر
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <TableScrollWrapper>
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold text-[11px] border-b border-slate-100">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 text-amber-500 border-slate-300 rounded focus:ring-amber-400 cursor-pointer"
                    title="تحديد كل العضويات الظاهرة"
                  />
                </th>
                <th className="py-3 px-3 w-10 text-center">م</th>
                <th className="py-3 px-4">{getLabel('membershipNumber', 'رقم العضوية')}</th>
                <th className="py-3 px-4">{getLabel('memberName', 'اسم العضو')}</th>
                <th className="py-3 px-4">{getLabel('club', 'النادي')}</th>
                <th className="py-3 px-4 text-center">{getLabel('advancePaid', 'مبلغ المقدم')}</th>
                <th className="py-3 px-4 text-center">{getLabel('paymentMethod', 'طريقة الدفع')}</th>
                <th className="py-3 px-4 text-center">تاريخ الطلب</th>
                <th className="py-3 px-4 text-center">حالة الإلغاء</th>
                <th className="py-3 px-4 text-center">تاريخ حالة الإلغاء</th>
                <th className="py-3 px-4 text-center">حالة أصل الإيصال وصيغة التنازل</th>
                <th className="py-3 px-4 text-center w-40">إجراءات تأكيد الاستلام</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-600 font-medium">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400 font-bold">
                    لا توجد طلبات إلغاء مطابقة لشروط البحث الحالية
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req, idx) => (
                  <tr 
                    key={req.id} 
                    className={`transition-colors ${selectedRowIds.includes(req.id) ? 'bg-amber-50/60' : 'hover:bg-slate-50/80'}`}
                  >
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedRowIds.includes(req.id)}
                        onChange={() => toggleSelectRow(req.id)}
                        className="h-4 w-4 text-amber-500 border-slate-300 rounded focus:ring-amber-400 cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{req.membershipNumber}</td>
                    <td className="py-3 px-4 max-w-xs truncate">{req.memberName}</td>
                    <td className="py-3 px-4 text-slate-500">{req.club}</td>
                    <td className="py-3 px-4 text-center font-bold text-amber-600 font-mono">
                      {req.advancePaid.toLocaleString('en-US')} {req.currency || 'ج.م'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                        {req.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-400 text-[11px] font-sans whitespace-nowrap">
                      {formatDateCustom(req.requestDate)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        req.status === 'Cancelled' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                        req.status === 'Deletion' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                        req.status === 'Revoked' ? 'bg-sky-100 text-sky-800 border-sky-200' :
                        'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {translateStatus(req.status)}
                      </span>
                      {getPendingSubStatus(req) && (
                        <>
                          <span className={`block text-[10px] font-bold mt-1 whitespace-nowrap ${
                            getPendingSubStatus(req) === '(الشيك تحت الاصدار)' ? 'text-emerald-600 font-black' :
                            getPendingSubStatus(req) === '(فى انتظار المديونية)' ? 'text-purple-600 font-bold' :
                            getPendingSubStatus(req) === '(فى انتظار اصل الايصال)' ? 'text-amber-600 font-bold' :
                            'text-slate-500 font-medium'
                          }`}>
                            {getPendingSubStatus(req)}
                          </span>
                          {getPendingSubStatus(req) === '(الشيك تحت الاصدار)' && (
                            <span className="block text-[9px] font-bold text-slate-500 mt-0.5 max-w-[130px] mx-auto whitespace-normal break-words leading-tight text-center">
                              ( تم ارسال المذكرة الى الادارة المالية )
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-600 font-bold text-[11px] whitespace-nowrap">
                      {req.statusDate ? formatDateCustom(req.statusDate) : '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {req.receiptReceived ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-400/20 text-amber-600 rounded-full font-bold text-[10px] border border-amber-400/20 whitespace-nowrap">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>تم تسليم الأصل الورقي ({req.receiptReceivedDate ? formatDateCustom(req.receiptReceivedDate) : ''})</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 text-rose-600 rounded-full font-bold text-[10px] border border-rose-100">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>بانتظار تسليم الأصل بالفرع</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <label className="inline-flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={req.receiptReceived}
                          onChange={(e) => onUpdateReceiptStatus(req.id, e.target.checked)}
                          className="h-4 w-4 text-amber-500 border-slate-300 rounded focus:ring-amber-400 cursor-pointer"
                        />
                        <span className="text-[10px] font-black text-slate-700 select-none">تم الاستلام</span>
                      </label>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableScrollWrapper>
      </div>
    </div>
  );
}

