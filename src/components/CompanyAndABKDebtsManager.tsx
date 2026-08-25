import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, Upload, Download, CheckCircle2, Building2, Search, Filter, 
  Calculator, DollarSign, Info, Save, RefreshCw, ChevronDown, Check, ArrowRight, ShieldAlert, FileText, AlertCircle, X, CheckSquare, Square
} from 'lucide-react';
import { CancellationRequest, User, Dropdowns } from '../types';
import { translateStatus, isCompanyPaymentMethod, isSameClub, isInternationalRequest } from '../utils';
import TableScrollWrapper from './TableScrollWrapper';
import * as XLSX from 'xlsx';

interface CompanyAndABKDebtsManagerProps {
  requests: CancellationRequest[];
  user: User;
  dropdowns: Dropdowns;
  authToken: string;
  onRefresh: () => void;
  onDownloadTemplate: () => void;
  onImportExcel: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBulkImportRequests?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  importSuccessMsg: string;
}

export default function CompanyAndABKDebtsManager({
  requests,
  user,
  dropdowns,
  authToken,
  onRefresh,
  onDownloadTemplate,
  onImportExcel,
  onBulkImportRequests,
  importSuccessMsg
}: CompanyAndABKDebtsManagerProps) {

  // Main Mode Toggle: 'companies' (Excel Import) vs 'abk' (ABK & Manual Debts Management)
  const [activeSubTab, setActiveSubTab] = useState<'abk' | 'companies'>('abk');

  // ABK & Companies Debt Filters
  const [searchTerms, setSearchTerms] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [clubFilter, setClubFilter] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('ABK');
  const [debtStatusFilter, setDebtStatusFilter] = useState(''); // 'all', 'entered', 'pending'

  // Row selection checkboxes (One or All)
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Helper to add search terms (splits by comma/newline/semicolon)
  const handleAddSearchTerm = (text: string) => {
    const parts = text.split(/[\n,;]+/).map(p => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      setSearchTerms(prev => Array.from(new Set([...prev, ...parts])));
      setSearchInput('');
    }
  };

  const handleRemoveSearchTerm = (indexToRemove: number) => {
    setSearchTerms(prev => prev.filter((_, i) => i !== indexToRemove));
  };

  const handleClearAllSearch = () => {
    setSearchTerms([]);
    setSearchInput('');
  };

  // Editable Debt Values local state: { [id: number]: number }
  const [editingDebts, setEditingDebts] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ id?: number; type: 'success' | 'error'; text: string } | null>(null);

  // Detail Modal for Breakdown
  const [detailTarget, setDetailTarget] = useState<CancellationRequest | null>(null);

  // Filter requests that are relevant for ABK or Company debts
  const eligibleRequests = useMemo(() => {
    // Collect all active search queries (chips + currently typed text)
    const activeQueries = [
      ...searchTerms,
      ...(searchInput.trim() ? searchInput.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean) : [])
    ];

    return requests.filter(r => {
      // Role confinement
      if (user.role === 'club' && !isSameClub(r.club, user.club)) {
        return false;
      }
      if (user.role === 'international_user' && !isInternationalRequest(r)) {
        return false;
      }

      // Filter by Payment Method
      if (paymentMethodFilter === 'ABK') {
        if (r.paymentMethod !== 'ABK') return false;
      } else if (paymentMethodFilter === 'companies') {
        if (r.paymentMethod === 'ABK' || !isCompanyPaymentMethod(r.paymentMethod)) return false;
      } else if (paymentMethodFilter) {
        if (r.paymentMethod !== paymentMethodFilter) return false;
      }

      // Filter by Club
      if (clubFilter && r.club !== clubFilter) {
        return false;
      }

      // Filter by Debt Status
      if (debtStatusFilter === 'entered' && (!r.debtABKCompanies || r.debtABKCompanies <= 0)) {
        return false;
      }
      if (debtStatusFilter === 'pending' && (r.debtABKCompanies && r.debtABKCompanies > 0)) {
        return false;
      }

      // Multi-Select Search (Matches any term against Membership No, Name, Loan Name, or National ID)
      if (activeQueries.length > 0) {
        const mNum = (r.membershipNumber || '').toLowerCase();
        const mName = (r.memberName || '').toLowerCase();
        const lName = (r.loanUnderName || '').toLowerCase();
        const nId = (r.nationalId || '').toLowerCase();

        const matchesAny = activeQueries.some(q => {
          const term = q.toLowerCase();
          return mNum.includes(term) || mName.includes(term) || lName.includes(term) || nId.includes(term);
        });

        if (!matchesAny) {
          return false;
        }
      }

      return true;
    });
  }, [requests, user, paymentMethodFilter, clubFilter, debtStatusFilter, searchTerms, searchInput]);

  // Checkbox Selection logic (One or All)
  const isAllSelected = eligibleRequests.length > 0 && eligibleRequests.every(r => selectedIds.includes(r.id));
  const isSomeSelected = eligibleRequests.some(r => selectedIds.includes(r.id)) && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(eligibleRequests.map(r => r.id));
    }
  };

  const handleToggleSelectOne = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // Handle single debt update via API
  const handleSaveDebt = async (reqItem: CancellationRequest) => {
    const rawVal = editingDebts[reqItem.id];
    const newDebt = rawVal !== undefined ? parseFloat(rawVal) || 0 : (reqItem.debtABKCompanies || 0);

    setSavingId(reqItem.id);
    setActionFeedback(null);

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/requests/${reqItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          ...reqItem,
          debtABKCompanies: newDebt,
          statusDate: reqItem.statusDate || todayStr
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'فشل تحديث المديونية');
      }

      setActionFeedback({
        id: reqItem.id,
        type: 'success',
        text: `تم حفظ مديونية البنك (${newDebt.toLocaleString()} ج.م) واحتساب فرق المديونية بنجاح!`
      });

      // Clear local edit state for this item
      setEditingDebts(prev => {
        const copy = { ...prev };
        delete copy[reqItem.id];
        return copy;
      });

      onRefresh();
    } catch (err: any) {
      setActionFeedback({
        id: reqItem.id,
        type: 'error',
        text: err.message || 'حدث خطأ أثناء حفظ التغييرات'
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      
      {/* Header Tabs Navigation */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-emerald-600" />
            <span>إدارة وتحديث مديونيات البنوك (ABK) والشركات واحتساب الفروق</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            اختر إدخال واحتساب مديونية البنك الأهلي الكويتي (ABK) والشركات يدوياً، أو رفع ملف إكسل مجمع لجميع العضويات.
          </p>
        </div>

        {/* Mode Switcher Buttons */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveSubTab('abk')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              activeSubTab === 'abk'
                ? 'bg-amber-400 text-neutral-950 shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <Calculator className="h-4 w-4" />
            <span>إدخال ABK والشركات يدويًا وقسم الفروق</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('companies')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              activeSubTab === 'companies'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>استيراد مديونيات الشركات (شيت إكسل)</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: ABK Manual Debt Entry & Detailed Difference Calculation */}
      {activeSubTab === 'abk' && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Filters Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-black text-slate-700 flex items-center gap-2">
                <Filter className="h-4 w-4 text-amber-500" />
                <span>خيارات البحث وتصفية عضويات ABK والشركات</span>
              </span>
              <span className="text-xxs font-bold text-slate-400">
                إجمالي النتائج المطابقة: <strong className="text-amber-600 font-mono text-xs">{eligibleRequests.length}</strong> عضوية
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              {/* Multi-Select Search (Membership No, Name, National ID, Loan Name) */}
              <div className="col-span-1 sm:col-span-2 lg:col-span-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1.5">
                    <Search className="h-3.5 w-3.5 text-amber-500" />
                    <span>البحث المتعدد (رقم قومي / رقم عضوية / اسم المشترك)</span>
                  </label>
                  {(searchTerms.length > 0 || searchInput) && (
                    <button
                      type="button"
                      onClick={handleClearAllSearch}
                      className="text-[10px] font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      <X className="h-3 w-3" />
                      <span>تفريغ البحث</span>
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.includes(',') || val.includes('\n') || val.includes(';')) {
                        handleAddSearchTerm(val);
                      } else {
                        setSearchInput(val);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        handleAddSearchTerm(searchInput);
                      }
                    }}
                    placeholder="ادخل رقم قومي أو رقم عضوية أو اسم (اضغط Enter أو فاصلة , لطلب كود/اسم أكثر من مشترك)..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-right text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium pl-16"
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={() => handleAddSearchTerm(searchInput)}
                      className="absolute left-1.5 top-1/2 -translate-y-1/2 bg-amber-400 hover:bg-amber-500 text-neutral-950 text-[10px] font-black px-2 py-1 rounded-lg transition-all cursor-pointer shadow-xs"
                    >
                      + إضافة
                    </button>
                  )}
                </div>

                {/* Search Term Chips */}
                {searchTerms.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-slate-400 self-center">العناصر المحددة:</span>
                    {searchTerms.map((term, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 bg-amber-100 text-amber-950 border border-amber-300/80 rounded-lg px-2 py-0.5 text-[11px] font-bold shadow-2xs"
                      >
                        <span>{term}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSearchTerm(idx)}
                          className="hover:bg-amber-200 text-amber-900 rounded-full p-0.5 transition-colors cursor-pointer"
                          title="حذف البحث"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-slate-500 font-bold mb-1">اختيار الجبهة / طريقة الدفع</label>
                <select
                  value={paymentMethodFilter}
                  onChange={(e) => setPaymentMethodFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-right focus:outline-none focus:ring-2 focus:ring-amber-400 font-bold cursor-pointer"
                >
                  <option value="ABK">البنك الأهلي الكويتي (ABK فقط)</option>
                  <option value="companies">جميع شركات التمويل (Companies)</option>
                  <option value="">جميع الطرق والشركات</option>
                  {dropdowns.paymentMethods.map(pm => (
                    <option key={pm} value={pm}>{pm}</option>
                  ))}
                </select>
              </div>

              {/* Club Filter */}
              <div>
                <label className="block text-slate-500 font-bold mb-1">النادي / الفرع</label>
                <select
                  value={clubFilter}
                  onChange={(e) => setClubFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-right focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium cursor-pointer"
                >
                  <option value="">جميع الفروع</option>
                  {dropdowns.clubs.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Debt Entry Status */}
              <div>
                <label className="block text-slate-500 font-bold mb-1">حالة إدخال المديونية</label>
                <select
                  value={debtStatusFilter}
                  onChange={(e) => setDebtStatusFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-right focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium cursor-pointer"
                >
                  <option value="">جميع الحالات</option>
                  <option value="entered">تم إدخال المديونية (أكبر من 0)</option>
                  <option value="pending">بانتظار إدخال المديونية (0)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Action Feedback Notification */}
          {actionFeedback && (
            <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center justify-between ${
              actionFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              <div className="flex items-center gap-2">
                {actionFeedback.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-rose-600" />}
                <span>{actionFeedback.text}</span>
              </div>
              <button onClick={() => setActionFeedback(null)} className="text-xxs underline cursor-pointer">إغلاق</button>
            </div>
          )}

          {/* Main Table: Manual Debt Entry, Refund & Debt Difference */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-amber-500" />
                  <span>جدول إدخال مديونيات البنك الأهلي الكويتي (ABK) وحساب فروق المديونية ({eligibleRequests.length})</span>
                </h3>
                {selectedIds.length > 0 && (
                  <span className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-950 text-xs font-black rounded-lg border border-amber-300">
                    <span>تم تحديد {selectedIds.length} من أصل {eligibleRequests.length} عضوية</span>
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="text-[10px] text-amber-800 hover:text-rose-700 underline cursor-pointer"
                    >
                      إلغاء التحديد
                    </button>
                  </span>
                )}
              </div>
              
              <button
                onClick={onRefresh}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xxs rounded-lg border border-slate-200 cursor-pointer shrink-0"
              >
                <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                <span>تحديث البيانات</span>
              </button>
            </div>

            <TableScrollWrapper>
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <th className="p-3 text-center w-10">
                      <label className="inline-flex items-center justify-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = isSomeSelected;
                          }}
                          onChange={handleToggleSelectAll}
                          title={isAllSelected ? "إلغاء تحديد الكل" : "تحديد كافة النتائج"}
                          className="h-4 w-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400 cursor-pointer"
                        />
                      </label>
                    </th>
                    <th className="p-3">رقم العضوية</th>
                    <th className="p-3">اسم العضو / القرض باسم</th>
                    <th className="p-3">النادي وطريقة الدفع</th>
                    <th className="p-3 text-center">قيمة القرض/التحويل</th>
                    <th className="p-3 text-center">تفاصيل ومبلغ الخصم</th>
                    <th className="p-3 text-center">مبلغ الاسترداد</th>
                    <th className="p-3 text-center w-48">مديونية البنك (يدوياً)</th>
                    <th className="p-3 text-center">فرق المديونية</th>
                    <th className="p-3 text-center">الكشف التفصيلي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {eligibleRequests.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-12 text-slate-400 font-bold">
                        لا توجد عضويات تطابق معايير البحث المحددة.
                      </td>
                    </tr>
                  ) : (
                    eligibleRequests.map((r) => {
                      const currentEditVal = editingDebts[r.id] !== undefined 
                        ? editingDebts[r.id] 
                        : (r.debtABKCompanies || 0).toString();

                      const numericEnteredDebt = parseFloat(currentEditVal) || 0;
                      const subVal = r.subscriptionValue || 0;
                      const transferVal = r.transferValue || 0;
                      const discountVal = r.discountAmount || 0;
                      
                      // Calculate refund amount: for ABK = subscriptionValue - discountAmount
                      const isABK = r.paymentMethod === 'ABK';
                      const baseRefund = isABK 
                        ? Math.max(0, subVal - discountVal) 
                        : (typeof r.refundAmount === 'number' ? r.refundAmount : Math.max(0, transferVal - discountVal));
                      
                      let refundVal = baseRefund;
                      if (isABK && numericEnteredDebt > 0 && (numericEnteredDebt - baseRefund) < 0) {
                        refundVal = numericEnteredDebt;
                      }
                      
                      // Difference calculation: for ABK = مديونية البنك - مبلغ الاسترداد
                      const diffVal = isABK 
                        ? (numericEnteredDebt - baseRefund)
                        : (transferVal - numericEnteredDebt - discountVal);

                      const isSavingThis = savingId === r.id;
                      const isSelected = selectedIds.includes(r.id);

                      return (
                        <tr 
                          key={r.id} 
                          className={`transition-colors ${isSelected ? 'bg-amber-50/80 border-r-4 border-r-amber-400' : 'hover:bg-slate-50/80'}`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectOne(r.id)}
                              className="h-4 w-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400 cursor-pointer"
                            />
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-900">
                            {r.membershipNumber}
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-800">{r.memberName}</div>
                            {r.loanUnderName && (
                              <div className="text-xxs text-slate-400">القرض: {r.loanUnderName}</div>
                            )}
                            {r.nationalId && (
                              <div className="text-[10px] text-amber-800 font-mono font-bold mt-0.5">قومي: {r.nationalId}</div>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-slate-700 block">{r.club}</span>
                            <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-bold text-xxs mt-0.5">
                              {r.paymentMethod}
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-slate-800">
                            {(isABK ? subVal : transferVal).toLocaleString()} {r.currency || 'ج.م'}
                          </td>

                          {/* Discount details */}
                          <td className="p-3 text-center">
                            <div className="font-mono font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100 inline-block text-xs">
                              {discountVal.toLocaleString()} {r.currency || 'ج.م'}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-center gap-1">
                              <span>(إدارية: {r.adminFees || 0} | انتفاع: {r.usageFee || 0})</span>
                            </div>
                          </td>

                          {/* Refund Amount */}
                          <td className="p-3 text-center">
                            <div className="font-mono font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 inline-block text-xs">
                              {`${refundVal.toLocaleString()} ${r.currency || 'ج.م'}`}
                            </div>
                          </td>

                          {/* Bank Debt Input (Manual) */}
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="number"
                                value={currentEditVal === '0' ? '' : currentEditVal}
                                onChange={(e) => {
                                  setEditingDebts({
                                    ...editingDebts,
                                    [r.id]: e.target.value
                                  });
                                }}
                                onFocus={(e) => e.target.select()}
                                placeholder="0"
                                className="w-24 text-center font-mono font-bold bg-amber-50 border border-amber-300 rounded-lg p-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveDebt(r)}
                                disabled={isSavingThis}
                                title="حفظ مديونية البنك واحتساب الفرق"
                                className="p-1.5 bg-amber-400 hover:bg-amber-500 text-neutral-950 rounded-lg font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
                              >
                                {isSavingThis ? (
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Save className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </td>

                          {/* Debt Difference Display */}
                          <td className="p-3 text-center font-mono font-bold">
                            {numericEnteredDebt <= 0 ? (
                              <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xxs border border-amber-200">
                                فى انتظار مديونية البنك
                              </span>
                            ) : isABK ? (
                              diffVal > 0 ? (
                                <div className="space-y-0.5">
                                  <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md text-[10px] border border-rose-300 block font-sans font-bold">
                                    يرجى ايداع المبلغ بحساب العضو ببنك ABK
                                  </span>
                                  <span className="text-rose-900 text-xs font-black block font-mono">
                                    +{diffVal.toLocaleString()} {r.currency || 'ج.م'}
                                  </span>
                                </div>
                              ) : diffVal < 0 ? (
                                <div className="space-y-0.5">
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] border border-emerald-300 block font-sans font-bold">
                                    مبلغ رد للعميل
                                  </span>
                                  <span className="text-emerald-900 text-xs font-black block font-mono">
                                    {Math.abs(diffVal).toLocaleString()} {r.currency || 'ج.م'}
                                  </span>
                                </div>
                              ) : (
                                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xxs border border-slate-300">
                                  0 {r.currency || 'ج.م'} (مطابق)
                                </span>
                              )
                            ) : diffVal > 0 ? (
                              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xxs border border-emerald-300">
                                +{diffVal.toLocaleString()} {r.currency || 'ج.م'} (فائض)
                              </span>
                            ) : diffVal < 0 ? (
                              <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full text-xxs border border-rose-300">
                                {diffVal.toLocaleString()} {r.currency || 'ج.م'} (عجز مديونية)
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xxs border border-slate-300">
                                0 {r.currency || 'ج.م'} (مطابق)
                              </span>
                            )}
                          </td>

                          {/* Details Modal Trigger */}
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => setDetailTarget(r)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold text-xxs inline-flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <FileText className="h-3.5 w-3.5 text-slate-500" />
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
        </div>
      )}

      {/* SUB-TAB 2: Company Debts Excel Upload */}
      {activeSubTab === 'companies' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 animate-in fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-800 flex items-center gap-1.5">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                <span>رفع واستيراد مديونيات الشركات والبنوك بالجملة (.xlsx)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                استخدم هذا القسم لرفع ملف إكسل يحتوي على مديونيات الشركات والبنوك لعدة عضويات دفعة واحدة، لتنفيذ التحديث التلقائي لكافة الحسابات.
              </p>
            </div>
            <button
              type="button"
              onClick={onDownloadTemplate}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 transition-all shrink-0 cursor-pointer shadow-sm"
            >
              <Download className="h-4 w-4" />
              <span>تحميل نموذج شيت المديونيات (.xlsx)</span>
            </button>
          </div>

          {/* Specifications Box */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <span className="font-bold text-slate-700 block mb-2">أعمدة شيت مديونيات الشركات المطلوب رفعها:</span>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-center font-mono text-xxs font-bold">
              <div className="bg-white p-2 rounded border border-slate-200 text-slate-700">1. م</div>
              <div className="bg-white p-2 rounded border border-amber-300 text-amber-900 bg-amber-50">2. رقم العضوية</div>
              <div className="bg-white p-2 rounded border border-slate-200 text-slate-700">3. القرض بإسم</div>
              <div className="bg-white p-2 rounded border border-slate-200 text-slate-700">4. الرقم القومى</div>
              <div className="bg-white p-2 rounded border border-slate-200 text-slate-700">5. طريقة الدفع</div>
              <div className="bg-white p-2 rounded border border-emerald-300 text-emerald-900 bg-emerald-50">6. مديونية البنوك/الشركات</div>
            </div>
          </div>

          {/* Upload Grid for Debts vs Historical Requests */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Upload Dropzone 1: Debts */}
            <div className="p-6 border-2 border-dashed border-emerald-200 rounded-2xl text-center hover:border-emerald-400 transition-colors bg-emerald-50/20 flex flex-col justify-between">
              <div>
                <Upload className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                <span className="block text-xs font-bold text-slate-800 mb-1">رفع شيت مديونيات الشركات والحسابات (.xlsx)</span>
                <span className="block text-xxs text-slate-500 mb-4">اختر ملف الإكسل لتحديث مديونيات الشركات المذكورة في التقرير</span>
              </div>
              <div>
                <label className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl cursor-pointer inline-flex items-center gap-2 transition-all shadow-md">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>رفع وتحديث المديونيات</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={onImportExcel}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Upload Dropzone 2: Historical Requests */}
            {onBulkImportRequests && (
              <div className="p-6 border-2 border-dashed border-amber-300 rounded-2xl text-center hover:border-amber-400 transition-colors bg-amber-50/30 flex flex-col justify-between">
                <div>
                  <FileSpreadsheet className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                  <span className="block text-xs font-bold text-slate-800 mb-1">استيراد كشف الطلبات القديمة/التاريخية (.xlsx)</span>
                  <span className="block text-xxs text-slate-500 mb-4">رفع شيت إكسل بنفس أعمدة وتنسيق تقرير التصدير لدمج السجلات القديمة تلقائيًا</span>
                </div>
                <div>
                  <label className="px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-black text-xs rounded-xl cursor-pointer inline-flex items-center gap-2 transition-all shadow-md">
                    <Upload className="h-4 w-4" />
                    <span>رفع شيت الطلبات القديمة بالكامل</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={onBulkImportRequests}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {importSuccessMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{importSuccessMsg}</span>
            </div>
          )}
        </div>
      )}

      {/* FULL FINANCIAL BREAKDOWN MODAL */}
      {detailTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-right font-sans" dir="rtl">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-amber-600">
                <Calculator className="h-5 w-5 shrink-0" />
                <h3 className="text-sm font-black text-slate-800">
                  كشف تسوية الخصم وفرق المديونية ({detailTarget.membershipNumber})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailTarget(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Member Card */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">اسم المشترك:</span>
                <span className="font-bold text-slate-800">{detailTarget.memberName}</span>
              </div>
              {detailTarget.nationalId && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">الرقم القومي:</span>
                  <span className="font-mono font-bold text-slate-800">{detailTarget.nationalId}</span>
                </div>
              )}
              {detailTarget.loanUnderName && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">القرض بإسم:</span>
                  <span className="font-bold text-slate-800">{detailTarget.loanUnderName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">طريقة السداد / النادي:</span>
                <span className="font-bold text-slate-800">{detailTarget.paymentMethod} - {detailTarget.club}</span>
              </div>
            </div>

            {/* Detailed Financial Breakdown Table */}
            <div className="space-y-2 text-xs">
              <span className="font-black text-slate-700 block border-b border-slate-100 pb-1">
                تفاصيل المبالغ المحسوبة والخصومات المستقطعة:
              </span>

              <div className="space-y-1.5 bg-slate-50/50 p-3 rounded-xl border border-slate-200">
                <div className="flex justify-between py-1 border-b border-slate-200/60 font-bold text-slate-700">
                  <span>1. قيمة القرض / التحويلة الأصلية:</span>
                  <span className="font-mono text-slate-900 font-black">{(detailTarget.transferValue || 0).toLocaleString()} {detailTarget.currency || 'ج.م'}</span>
                </div>

                {/* Discounts */}
                <div className="py-1 space-y-1">
                  <span className="font-bold text-rose-800 block text-xxs">2. مبالغ الاستقطاع والخصم:</span>
                  <div className="pr-3 text-xxs space-y-1 text-slate-600">
                    <div className="flex justify-between">
                      <span>• المصاريف الإدارية:</span>
                      <span className="font-mono font-bold text-rose-700">{(detailTarget.adminFees || 0).toLocaleString()} {detailTarget.currency || 'ج.م'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• مقابل الانتفاع (الاستهلاك):</span>
                      <span className="font-mono font-bold text-rose-700">{(detailTarget.usageFee || 0).toLocaleString()} {detailTarget.currency || 'ج.م'}</span>
                    </div>
                    {detailTarget.visaFees2Percent ? (
                      <div className="flex justify-between">
                        <span>• مصاريف فيزا (2%):</span>
                        <span className="font-mono font-bold text-rose-700">{detailTarget.visaFees2Percent.toLocaleString()} {detailTarget.currency || 'ج.م'}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex justify-between pt-1 border-t border-rose-200 font-black text-rose-900 bg-rose-50 p-1.5 rounded-lg mt-1">
                    <span>= إجمالي مبلغ الخصم:</span>
                    <span className="font-mono">{(detailTarget.discountAmount || 0).toLocaleString()} {detailTarget.currency || 'ج.م'}</span>
                  </div>
                </div>

                {/* Refund */}
                <div className="flex justify-between py-2 border-t border-b border-slate-200/60 font-black text-emerald-800 bg-emerald-50 p-2 rounded-lg my-1">
                  <span>3. مبلغ الاسترداد (صافي المبلغ المسترد):</span>
                  <span className="font-mono text-sm">
                    {typeof detailTarget.refundAmount === 'number' 
                      ? `${detailTarget.refundAmount.toLocaleString()} ${detailTarget.currency || 'ج.م'}` 
                      : (detailTarget.refundAmount || `${((detailTarget.transferValue || 0) - (detailTarget.discountAmount || 0)).toLocaleString()} ${detailTarget.currency || 'ج.م'}`)}
                  </span>
                </div>

                {/* Bank Debt */}
                <div className="flex justify-between py-1.5 font-bold text-slate-800 bg-amber-50/80 p-2 rounded-lg border border-amber-200">
                  <span>4. مديونية البنك (ABK) المدخلة:</span>
                  <span className="font-mono text-amber-900 font-black">{(detailTarget.debtABKCompanies || 0).toLocaleString()} {detailTarget.currency || 'ج.م'}</span>
                </div>

                {/* Difference */}
                {(() => {
                  const refundNum = typeof detailTarget.refundAmount === 'number' 
                    ? detailTarget.refundAmount 
                    : Math.max(0, (detailTarget.transferValue || 0) - (detailTarget.discountAmount || 0));
                  const debtNum = detailTarget.debtABKCompanies || 0;
                  const diff = detailTarget.paymentMethod === 'ABK' 
                    ? (refundNum - debtNum)
                    : ((detailTarget.transferValue || 0) - debtNum - (detailTarget.discountAmount || 0));

                  return (
                    <div className={`flex justify-between py-2 p-2.5 rounded-xl font-black border text-xs ${
                      debtNum <= 0 ? 'bg-amber-100 text-amber-900 border-amber-300' :
                      diff > 0 ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
                      diff < 0 ? 'bg-rose-100 text-rose-900 border-rose-300' :
                      'bg-slate-100 text-slate-800 border-slate-300'
                    }`}>
                      <span>5. فرق المديونية النهائي:</span>
                      <span className="font-mono text-sm">
                        {debtNum <= 0 ? 'بانتظار إدخال المديونية' : `${diff > 0 ? '+' : ''}${diff.toLocaleString()} ${detailTarget.currency || 'ج.م'}`}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDetailTarget(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer transition-all"
              >
                إغلاق الكشف
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
