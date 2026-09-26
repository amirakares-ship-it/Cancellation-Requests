import React, { useState, useEffect, useMemo } from 'react';
import { Upload, RefreshCw, Search, CreditCard, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { User } from '../types';
import { formatDateCustom, translateStatus, parseReadyChecksWorkbook } from '../utils';
import TableScrollWrapper from './TableScrollWrapper';

interface ReadyChecksProps {
  user: User;
  authToken: string;
  onDataChanged?: () => void;
}

interface ReadyCheckRow {
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
}

export default function ReadyChecks({ user, authToken, onDataChanged }: ReadyChecksProps) {
  const [rows, setRows] = useState<ReadyCheckRow[]>([]);
  const [readyCount, setReadyCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isAdmin = user.role === 'admin';

  const fetchRows = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/ready-checks', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      setRows(data.rows || []);
      setReadyCount(data.readyCount || 0);
    } catch (err) {
      console.error('Failed to load ready checks', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        const res = await fetch('/api/ready-checks/upload', {
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

  const handleDelete = async (row: ReadyCheckRow) => {
    const confirmed = window.confirm(`هل أنت متأكد من حذف شيك "${row.name}" (رقم عميل ${row.externalId})؟`);
    if (!confirmed) return;
    setDeletingId(row.id);
    try {
      const res = await fetch(`/api/ready-checks/${row.id}`, {
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

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      (r.name || '').toLowerCase().includes(q) ||
      (r.externalId || '').toLowerCase().includes(q) ||
      (r.membershipNumber || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">شيكات جاهزة للاستلام</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAdmin
                  ? 'ارفعي شيت الشيكات وهيترابط تلقائيًا بالطلبات عن طريق رقم العميل.'
                  : 'الشيكات الخاصة بنادي فرعك بس.'}
              </p>
            </div>
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
                <span>{isUploading ? 'جارِ الرفع...' : 'رفع شيت الشيكات (.xlsx)'}</span>
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

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو رقم العميل أو رقم العضوية..."
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 pr-8 focus:outline-none focus:ring-2 focus:ring-amber-400 text-right"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-xs text-slate-400 font-bold">جارِ التحميل...</div>
        ) : filteredRows.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-400 font-bold">مفيش شيكات جاهزة للاستلام لسه.</div>
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
    </div>
  );
}
