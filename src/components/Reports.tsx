import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Upload, Download, RefreshCw, CheckCircle2, AlertCircle, History, Trash2 } from 'lucide-react';
import { Dropdowns, Committee, User } from '../types';
import { parseDebtWorkbook } from '../utils';

interface ReportsProps {
  dropdowns: Dropdowns;
  committees: Committee[];
  authToken: string;
  user: User;
}

interface BatchListItem {
  id: string;
  paymentMethod: string;
  committeeNo: string;
  committeeYear?: string;
  uploadedAt: string;
  uploadedBy: string;
  rowCount: number;
}

// English "DD-MMM-YYYY" format (e.g. "30-Jun-2026"), matching the date
// style used elsewhere in the app -- independent of the browser/OS locale.
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatUploadDate = (isoString: string) => {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTH_ABBR[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

const Reports: React.FC<ReportsProps> = ({ dropdowns, committees, authToken }) => {  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [selectedCommitteeNo, setSelectedCommitteeNo] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [batches, setBatches] = useState<BatchListItem[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchBatches = async () => {
    setIsLoadingBatches(true);
    try {
      const res = await fetch('/api/debt-import-batches', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      setBatches(data.batches || []);
    } catch (e) {
      console.error('Failed to load debt import batches', e);
    } finally {
      setIsLoadingBatches(false);
    }
  };

  useEffect(() => {
    fetchBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Committees list sorted newest-first for the dropdown (matches how
  // they're numbered/opened elsewhere in the app).
  const sortedCommittees = [...(committees || [])].sort((a, b) => {
    const na = parseInt(a.number, 10);
    const nb = parseInt(b.number, 10);
    if (!isNaN(na) && !isNaN(nb)) return nb - na;
    return 0;
  });

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedPaymentMethod) {
      setUploadMsg({ type: 'error', text: 'يرجى اختيار الشركة/طريقة الدفع أولًا قبل رفع الشيت.' });
      e.target.value = '';
      return;
    }
    if (!selectedCommitteeNo) {
      setUploadMsg({ type: 'error', text: 'يرجى اختيار رقم اللجنة أولًا قبل رفع الشيت.' });
      e.target.value = '';
      return;
    }

    const selectedCommittee = committees.find(c => c.number === selectedCommitteeNo);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const mappedRows = parseDebtWorkbook(data);

        if (mappedRows.length === 0) {
          setUploadMsg({ type: 'error', text: 'ملف الإكسل لا يحتوي على بيانات مطابقة صحيحة. يرجى التأكد من احتواء الملف على عمود "رقم العضوية" وعمود "مديونية البنوك/الشركات".' });
          return;
        }

        setIsUploading(true);
        const res = await fetch('/api/debt-import-batches', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            rows: mappedRows,
            paymentMethod: selectedPaymentMethod,
            committeeNo: selectedCommitteeNo,
            committeeYear: selectedCommittee?.year || '',
          }),
        });
        const backendData = await res.json();
        if (!res.ok || backendData.error) {
          throw new Error(backendData.error || 'فشل رفع الشيت');
        }

        let msg = `تم رفع الدفعة وتحديث مديونية ${backendData.updatedCount} طلب بنجاح (بإجمالي ${backendData.totalDebtAmount ? backendData.totalDebtAmount.toLocaleString() : 0} ج.م).`;
        if (backendData.notFoundCount > 0) {
          msg += ` تنبيه: ${backendData.notFoundCount} رقم عضوية غير مسجل بالمنظومة.`;
        }
        setUploadMsg({ type: 'success', text: msg });
        fetchBatches();
      } catch (err: any) {
        setUploadMsg({ type: 'error', text: err.message || 'حدث خطأ أثناء رفع الشيت' });
      } finally {
        setIsUploading(false);
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDownloadBatch = async (batch: BatchListItem) => {
    setDownloadingId(batch.id);
    try {
      const res = await fetch(`/api/debt-import-batches/${batch.id}/export`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'فشل تجهيز ملف التنزيل');
      }

      const dataToExport = data.rows.map((r: any, idx: number) => ({
        'م': idx + 1,
        'رقم العضوية': r.membershipNumber || '',
        'الاسم': r.memberName || '',
        'الرقم القومى': r.nationalId || '',
        'رقم العميل': r.externalId || '',
        'قيمة العضوية': r.subscriptionValue || 0,
        'قيمة التحويلة': r.transferValue || 0,
        'تاريخ الاشتراك': r.subscriptionDate || '',
        'تاريخ الطلب': r.requestDate || '',
        'مديونية البنوك/الشركات': r.debtAmount || 0,
        'طريقة الدفع': r.paymentMethod || '',
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'تقرير_المديونية');
      const dateStr = new Date(batch.uploadedAt).toISOString().split('T')[0];
      XLSX.writeFile(workbook, `تقرير_مديونية_${batch.paymentMethod}_لجنة_${batch.committeeNo}_${dateStr}.xlsx`);
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء تنزيل التقرير');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeleteBatch = async (batch: BatchListItem) => {
    const confirmed = window.confirm(
      `هل أنت متأكدة من حذف دفعة "${batch.paymentMethod} - لجنة ${batch.committeeNo}"؟\n\nسيتم إرجاع مديونية كل عضوية اتحدثت بالدفعة دي لقيمتها قبل الرفع (طالما محدش عدّلها بعد كده بدفعة تانية)، وستحذف الدفعة من السجل نهائيًا.`
    );
    if (!confirmed) return;

    setDeletingId(batch.id);
    try {
      const res = await fetch(`/api/debt-import-batches/${batch.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'فشل حذف الدفعة');
      }
      setBatches((prev) => prev.filter((b) => b.id !== batch.id));
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء حذف الدفعة');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      {/* Upload Section */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800">رفع شيت مديونية شركة/بنك</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              اختاري الشركة ورقم اللجنة أولًا، ثم ارفعي الشيت -- هيتم حفظ الدفعة دي وربطها بالشركة واللجنة اللي اخترتيها، عشان تقدري تنزّليها تاني بأعمدة إضافية من صفحة التقارير دي.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">الشركة / طريقة الدفع <span className="text-rose-500">*</span></label>
            <select
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 shadow-xs"
            >
              <option value="">-- اختاري الشركة/طريقة الدفع --</option>
              {(dropdowns?.paymentMethods || []).map((pm) => (
                <option key={pm} value={pm}>{pm}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">رقم اللجنة <span className="text-rose-500">*</span></label>
            <select
              value={selectedCommitteeNo}
              onChange={(e) => setSelectedCommitteeNo(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 shadow-xs"
            >
              <option value="">-- اختاري رقم اللجنة --</option>
              {sortedCommittees.map((c) => (
                <option key={c.id} value={c.number}>
                  لجنة {c.number} ({c.year}) {c.status === 'open' ? '- مفتوحة' : '- معتمدة'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            className={`flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl border-2 border-dashed font-bold text-xs transition-all cursor-pointer ${
              isUploading
                ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            {isUploading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>جارِ الرفع والمعالجة...</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                <span>اضغطي هنا لرفع شيت المديونية (Excel)</span>
              </>
            )}
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleUpload}
              disabled={isUploading}
              className="hidden"
            />
          </label>
        </div>

        {uploadMsg && (
          <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
            uploadMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {uploadMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{uploadMsg.text}</span>
          </div>
        )}
      </div>

      {/* History / Download Section */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 border border-sky-200">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">سجل دفعات المديونية المرفوعة</h3>
              <p className="text-xs text-slate-400 mt-0.5">نزّلي أي دفعة قديمة برفعتيها قبل كده، بأعمدة إضافية (الاسم، رقم العميل، قيمة العضوية، إلخ).</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchBatches}
            disabled={isLoadingBatches}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
            title="تحديث السجل"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingBatches ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {isLoadingBatches ? (
          <div className="text-center py-8 text-xs text-slate-400 font-bold">جارِ تحميل السجل...</div>
        ) : batches.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400 font-bold">مفيش دفعات مرفوعة لسه.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold">
                <tr>
                  <th className="py-2.5 px-3 text-right">تاريخ الرفع</th>
                  <th className="py-2.5 px-3 text-right">الشركة / طريقة الدفع</th>
                  <th className="py-2.5 px-3 text-center">رقم اللجنة</th>
                  <th className="py-2.5 px-3 text-center">عدد الصفوف</th>
                  <th className="py-2.5 px-3 text-right">رفعها</th>
                  <th className="py-2.5 px-3 text-center">تنزيل</th>
                  <th className="py-2.5 px-3 text-center">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-mono">{formatUploadDate(b.uploadedAt)}</td>
                    <td className="py-2.5 px-3 font-bold">{b.paymentMethod}</td>
                    <td className="py-2.5 px-3 text-center font-mono">{b.committeeNo}{b.committeeYear ? ` (${b.committeeYear})` : ''}</td>
                    <td className="py-2.5 px-3 text-center font-mono">{b.rowCount}</td>
                    <td className="py-2.5 px-3">{b.uploadedBy}</td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDownloadBatch(b)}
                        disabled={downloadingId === b.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold rounded-lg transition-all cursor-pointer"
                      >
                        {downloadingId === b.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        <span>تنزيل</span>
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteBatch(b)}
                        disabled={deletingId === b.id}
                        title="حذف الدفعة والتراجع عن تحديث المديونية (لو رفعتيها بالغلط)"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 border border-rose-200 font-bold rounded-lg transition-all cursor-pointer"
                      >
                        {deletingId === b.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
