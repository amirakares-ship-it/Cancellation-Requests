import React, { useState, useEffect, useMemo } from 'react';
import { Upload, RefreshCw, Search, Trash2, AlertCircle, CheckCircle2, Send, Clock, X } from 'lucide-react';
import { User } from '../types';
import { formatDateCustom, translateStatus, parseReadyChecksWorkbook } from '../utils';
import TableScrollWrapper from './TableScrollWrapper';

export type CheckType = 'advance' | 'bank';

interface ChecksTypeListProps {
  user: User;
  authToken: string;
  checkType: CheckType;
  onDataChanged?: () => void;
}

interface CheckRow {
  id: string;
  name: string;
  checkDueDate: string;
  checkAmount: number;
  bank: string;
  externalId: string;
  uploadedAt: string;
  uploadedBy: string;
  requestId: number | string | null;
  committeeNo: string | null;
  committeeYear: string | null;
  membershipNumber: string | null;
  paymentMethod: string | null;
  mobileNumber: string | null;
  club: string | null;
  requestStatus: string | null;
  sendCheckRequestId: string | null;
  sendCheckStatus: 'pending' | 'accepted' | 'rejected' | null;
  sendCheckRejectionReason: string | null;
}

export default function ChecksTypeList({ user, authToken, checkType, onDataChanged }: ChecksTypeListProps) {
  const routePrefix = checkType === 'advance' ? 'ready-checks' : 'bank-checks';
  const label = checkType === 'advance' ? 'شيك المقدم' : 'الشيكات البنكية';

  const [rows, setRows] = useState<CheckRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedClub, setSelectedClub] = useState('all');
  const [selectedCommitteeNo, setSelectedCommitteeNo] = useState('all');
  const [selectedCommitteeYear, setSelectedCommitteeYear] = useState('all');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [reasonPopoverRow, setReasonPopoverRow] = useState<CheckRow | null>(null);

  const isAdmin = user.role === 'admin';

  const fetchRows = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/${routePrefix}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      setRows(data.rows || []);
    } catch (err) {
      console.error(`Failed to load ${routePrefix}`, err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkType]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const parsedRows = parseReadyChecksWorkbook(data);

        if (parsedRows.length === 0) {
          setMessage({ type: 'error', text: 'ملف الإكسل لا يحتوي على بيانات صحيحة. تأكدي من وجود عمود "رقم العميل" على الأقل.' });
          return;
        }

        setIsUploading(true);
        const res = await fetch(`/api/${routePrefix}/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ rows: parsedRows }),
        });
        const resData = await res.json();
        if (!res.ok) {
          throw new Error(resData.error || 'حدث خطأ أثناء رفع الشيت');
        }

        setMessage({
          type: 'success',
          text: `تم رفع الشيت بنجاح -- ${resData.addedCount} صف جديد، ${resData.updatedCount} صف اتحدّث، وتم ربط ${resData.linkedCount} منهم بطلبات موجودة.`,
        });
        await fetchRows();
        if (onDataChanged) onDataChanged();
      } catch (err: any) {
        setMessage({ type: 'error', text: err.message || 'حدث خطأ أثناء رفع الشيت' });
      } finally {
        setIsUploading(false);
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDelete = async (row: CheckRow) => {
    const confirmed = window.confirm(`هل أنت متأكد من حذف شيك "${row.name}" (رقم عميل ${row.externalId})؟`);
    if (!confirmed) return;
    setDeletingId(row.id);
    try {
      const res = await fetch(`/api/${routePrefix}/${row.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل حذف الصف');
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء الحذف');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSendChecks = async (row: CheckRow) => {
    if (!row.requestId) return;
    setSendingId(row.id);
    try {
      const res = await fetch('/api/send-checks-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ requestId: row.requestId, checkType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل إرسال الطلب');
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, sendCheckStatus: 'pending', sendCheckRequestId: data.item?.id || null } : r)));
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء إرسال الطلب');
    } finally {
      setSendingId(null);
    }
  };

  const clubOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.club) set.add(r.club); });
    return Array.from(set).sort();
  }, [rows]);

  const committeeNoOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.committeeNo) set.add(r.committeeNo); });
    return Array.from(set).sort();
  }, [rows]);

  const committeeYearOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.committeeYear) set.add(r.committeeYear); });
    return Array.from(set).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !(
        (r.name || '').toLowerCase().includes(q) ||
        (r.externalId || '').toLowerCase().includes(q) ||
        (r.membershipNumber || '').toLowerCase().includes(q)
      )) return false;
      if (selectedClub !== 'all' && r.club !== selectedClub) return false;
      if (selectedCommitteeNo !== 'all' && r.committeeNo !== selectedCommitteeNo) return false;
      if (selectedCommitteeYear !== 'all' && r.committeeYear !== selectedCommitteeYear) return false;
      return true;
    });
  }, [rows, search, selectedClub, selectedCommitteeNo, selectedCommitteeYear]);

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isAdmin
                ? 'ارفعي شيت الشيكات وهيترابط تلقائيًا بالطلبات عن طريق رقم العميل.'
                : 'الشيكات الخاصة بنادي فرعك بس.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchRows}
              disabled={isLoading}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
              title="تحديث"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            {isAdmin && (
              <label className={`flex items-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 transition-all shrink-0 cursor-pointer shadow-sm ${isUploading ? 'opacity-60 pointer-events-none' : ''}`}>
                <Upload className="h-4 w-4" />
                <span>{isUploading ? 'جارِ الرفع...' : `رفع شيت ${label} (.xlsx)`}</span>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} disabled={isUploading} />
              </label>
            )}
          </div>
        </div>

        {message && (
          <div className={`p-3 rounded-lg text-xs font-bold flex items-center gap-2 ${
            message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {isAdmin && (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <span className="font-bold text-slate-700 block mb-2">أعمدة شيت {label} المطلوب رفعها:</span>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center font-mono text-xxs font-bold">
              <div className="bg-white p-2 rounded border border-slate-200 text-slate-700">1. الاسم</div>
              <div className="bg-white p-2 rounded border border-slate-200 text-slate-700">2. تاريخ استحقاق الشيك</div>
              <div className="bg-white p-2 rounded border border-slate-200 text-slate-700">3. مبلغ الشيك</div>
              <div className="bg-white p-2 rounded border border-slate-200 text-slate-700">4. البنك</div>
              <div className="bg-amber-50 p-2 rounded border border-amber-300 text-amber-900">5. رقم العميل *</div>
            </div>
          </div>
        )}

        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row md:items-center gap-2.5">
          <div className="relative max-w-sm w-full">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو رقم العميل أو رقم العضوية..."
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 pr-8 focus:outline-none focus:ring-2 focus:ring-amber-400 text-right"
            />
          </div>

          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedClub}
                onChange={(e) => setSelectedClub(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="all">النادي</option>
                {clubOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                value={selectedCommitteeNo}
                onChange={(e) => setSelectedCommitteeNo(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="all">رقم اللجنة</option>
                {committeeNoOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                value={selectedCommitteeYear}
                onChange={(e) => setSelectedCommitteeYear(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="all">السنة</option>
                {committeeYearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-xs text-slate-400 font-bold">جارِ التحميل...</div>
        ) : filteredRows.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-400 font-bold">مفيش {label} لسه.</div>
        ) : (
          <TableScrollWrapper>
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold sticky top-0">
                <tr>
                  <th className="py-2.5 px-3 text-center">م</th>
                  <th className="py-2.5 px-3 text-right">الاسم</th>
                  <th className="py-2.5 px-3 text-center">تاريخ استحقاق الشيك</th>
                  <th className="py-2.5 px-3 text-center">مبلغ الشيك</th>
                  <th className="py-2.5 px-3 text-center">البنك</th>
                  <th className="py-2.5 px-3 text-center">رقم العميل</th>
                  <th className="py-2.5 px-3 text-center">رقم اللجنة</th>
                  <th className="py-2.5 px-3 text-center">رقم العضوية</th>
                  <th className="py-2.5 px-3 text-center">طريقة الدفع</th>
                  <th className="py-2.5 px-3 text-center">رقم الموبايل</th>
                  <th className="py-2.5 px-3 text-center">حالة الطلب</th>
                  <th className="py-2.5 px-3 text-center">إرسال شيكات</th>
                  {isAdmin && <th className="py-2.5 px-3 text-center">حذف</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 text-center font-mono">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-bold">{r.name}</td>
                    <td className="py-2.5 px-3 text-center font-mono">{r.checkDueDate ? formatDateCustom(r.checkDueDate) : '—'}</td>
                    <td className="py-2.5 px-3 text-center font-mono">{r.checkAmount?.toLocaleString('en-US') || 0}</td>
                    <td className="py-2.5 px-3 text-center">{r.bank || '—'}</td>
                    <td className="py-2.5 px-3 text-center font-mono">{r.externalId}</td>
                    <td className="py-2.5 px-3 text-center font-mono">{r.committeeNo ? `${r.committeeNo}${r.committeeYear ? ` / ${r.committeeYear}` : ''}` : '—'}</td>
                    <td className="py-2.5 px-3 text-center font-mono">{r.membershipNumber || '—'}</td>
                    <td className="py-2.5 px-3 text-center">{r.paymentMethod || '—'}</td>
                    <td className="py-2.5 px-3 text-center font-mono">{r.mobileNumber || '—'}</td>
                    <td className="py-2.5 px-3 text-center">
                      {r.requestStatus ? (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          r.requestStatus === 'Cancelled' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                          r.requestStatus === 'Revoked' ? 'bg-sky-100 text-sky-800 border-sky-200' :
                          r.requestStatus === 'Deletion' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                          r.requestStatus === 'Rejected' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                          'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {r.requestStatus === 'Rejected' ? 'Rejected' : translateStatus(r.requestStatus)}
                        </span>
                      ) : (
                        <span className="text-slate-300">غير مربوط</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {!r.requestId ? (
                        <span className="text-slate-300">—</span>
                      ) : r.sendCheckStatus === 'accepted' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          تم الإرسال
                        </span>
                      ) : r.sendCheckStatus === 'pending' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          بانتظار قرار الأدمن
                        </span>
                      ) : r.sendCheckStatus === 'rejected' ? (
                        <button
                          type="button"
                          onClick={() => setReasonPopoverRow(r)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 cursor-pointer hover:bg-rose-100"
                        >
                          <AlertCircle className="w-3 h-3" />
                          تم رفض إرسال الشيكات
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSendChecks(r)}
                          disabled={sendingId === r.id}
                          className="inline-flex items-center justify-center p-1.5 bg-sky-50 hover:bg-sky-100 disabled:opacity-50 text-sky-700 border border-sky-200 rounded-lg transition-all cursor-pointer"
                          title="إرسال شيكات"
                        >
                          {sendingId === r.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDelete(r)}
                          disabled={deletingId === r.id}
                          className="inline-flex items-center justify-center p-1.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 border border-rose-200 rounded-lg transition-all cursor-pointer"
                        >
                          {deletingId === r.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollWrapper>
        )}
      </div>

      {/* Rejection reason popover */}
      {reasonPopoverRow && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50" onClick={() => setReasonPopoverRow(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-black text-rose-700">سبب رفض إرسال الشيكات</h4>
              <button type="button" onClick={() => setReasonPopoverRow(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{reasonPopoverRow.sendCheckRejectionReason || '—'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
