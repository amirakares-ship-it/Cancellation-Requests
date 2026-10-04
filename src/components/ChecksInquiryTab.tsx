import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, XCircle, RefreshCw, Edit3, X, Check, HelpCircle } from 'lucide-react';
import { User } from '../types';
import { formatDateCustom } from '../utils';
import TableScrollWrapper from './TableScrollWrapper';

interface ChecksInquiryTabProps {
  user: User;
  authToken: string;
  onDataChanged?: () => void;
}

interface InquiryItem {
  id: string;
  requestId: number;
  status: 'pending' | 'accepted' | 'rejected';
  requestedByName: string;
  requestedByRole: string;
  requestedAt: string;
  decidedByName?: string;
  decidedAt?: string;
  rejectionReason?: string;
  memberName: string | null;
  membershipNumber: string | null;
  externalId: string | null;
  club: string | null;
}

interface Recipient {
  name: string;
  email: string;
}

export default function ChecksInquiryTab({ user, authToken }: ChecksInquiryTabProps) {
  const [items, setItems] = useState<InquiryItem[]>([]);
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingItem, setRejectingItem] = useState<InquiryItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isEditingRecipient, setIsEditingRecipient] = useState(false);
  const [recipientDraft, setRecipientDraft] = useState<Recipient>({ name: '', email: '' });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isAdmin = user.role === 'admin';

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/send-checks-requests', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      setItems((data.items || []).filter((i: any) => i.checkType === 'inquiry'));
    } catch (err) {
      console.error('Failed to load checks inquiries', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecipient = async () => {
    try {
      const res = await fetch('/api/send-checks-recipients', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      setRecipient(data.inquiry || null);
    } catch (err) {
      console.error('Failed to load inquiry recipient', err);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchItems();
    fetchRecipient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pendingItems = useMemo(() => items.filter((i) => i.status === 'pending'), [items]);
  const decidedItems = useMemo(() => items.filter((i) => i.status !== 'pending'), [items]);

  const handleAccept = async (item: InquiryItem) => {
    setProcessingId(item.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/send-checks-requests/${item.id}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ approve: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشلت العملية');
      setMessage({ type: 'success', text: 'تم إرسال إيميل الاستفسار بنجاح.' });
      await fetchItems();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'حدث خطأ' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectingItem) return;
    if (!rejectionReason.trim()) {
      setMessage({ type: 'error', text: 'من فضلك اكتبي سبب الرفض' });
      return;
    }
    setProcessingId(rejectingItem.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/send-checks-requests/${rejectingItem.id}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ approve: false, rejectionReason: rejectionReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشلت العملية');
      setMessage({ type: 'success', text: 'تم رفض طلب الاستفسار.' });
      setRejectingItem(null);
      setRejectionReason('');
      await fetchItems();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'حدث خطأ' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleSaveRecipient = async () => {
    if (!recipientDraft.name.trim() || !recipientDraft.email.trim()) {
      setMessage({ type: 'error', text: 'الاسم والإيميل مطلوبين' });
      return;
    }
    try {
      const res = await fetch('/api/send-checks-recipients', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ checkType: 'inquiry', name: recipientDraft.name.trim(), email: recipientDraft.email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل الحفظ');
      setRecipient(data.recipients?.inquiry || null);
      setIsEditingRecipient(false);
      setMessage({ type: 'success', text: 'تم تحديث بيانات المستلم.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'حدث خطأ' });
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center text-xs text-slate-400 font-bold">
        الصفحة دي متاحة للأدمن بس.
      </div>
    );
  }

  return (
    <div className="space-y-4 text-right font-sans" dir="rtl">
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600 border border-sky-200">
              <HelpCircle className="h-4 w-4" />
            </div>
            <p className="text-xs text-slate-500">
              طلبات استفسار تلقائية عن تحصيل الشيكات -- بتتبعت لما يتعلّم "تم الاستلام" لأصل الإيصال على طلب بشيكات معتمد.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchItems}
            disabled={isLoading}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
            title="تحديث"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {message && (
          <div className={`p-3 rounded-lg text-xs font-bold flex items-center gap-2 ${
            message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}>
            <span>{message.text}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div>
            <span className="font-bold text-slate-500">الإيميل هيتبعت لـ: </span>
            {isEditingRecipient ? (
              <div className="inline-flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={recipientDraft.name}
                  onChange={(e) => setRecipientDraft((p) => ({ ...p, name: e.target.value }))}
                  placeholder="الاسم"
                  className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 w-24"
                />
                <input
                  type="email"
                  value={recipientDraft.email}
                  onChange={(e) => setRecipientDraft((p) => ({ ...p, email: e.target.value }))}
                  placeholder="الإيميل"
                  className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 w-48"
                />
                <button type="button" onClick={handleSaveRecipient} className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg cursor-pointer hover:bg-emerald-100">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => setIsEditingRecipient(false)} className="p-1.5 bg-slate-100 text-slate-500 rounded-lg cursor-pointer hover:bg-slate-200">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <span className="font-black text-slate-800">
                {recipient ? `${recipient.name} (${recipient.email})` : '—'}
              </span>
            )}
          </div>
          {!isEditingRecipient && (
            <button
              type="button"
              onClick={() => {
                setIsEditingRecipient(true);
                setRecipientDraft(recipient || { name: '', email: '' });
              }}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              title="تعديل"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-xs font-black text-slate-700">طلبات استفسار بانتظار القرار ({pendingItems.length})</h3>
        </div>
        {pendingItems.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-400 font-bold">مفيش طلبات استفسار معلّقة.</div>
        ) : (
          <TableScrollWrapper>
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold">
                <tr>
                  <th className="py-2.5 px-3 text-right">اسم العضو</th>
                  <th className="py-2.5 px-3 text-center">رقم العضوية</th>
                  <th className="py-2.5 px-3 text-center">رقم العميل</th>
                  <th className="py-2.5 px-3 text-center">النادي</th>
                  <th className="py-2.5 px-3 text-center">طلب من</th>
                  <th className="py-2.5 px-3 text-center">تاريخ الطلب</th>
                  <th className="py-2.5 px-3 text-center">القرار</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-bold">{item.memberName || '—'}</td>
                    <td className="py-2.5 px-3 text-center font-mono">{item.membershipNumber || '—'}</td>
                    <td className="py-2.5 px-3 text-center font-mono">{item.externalId || '—'}</td>
                    <td className="py-2.5 px-3 text-center">{item.club || '—'}</td>
                    <td className="py-2.5 px-3 text-center">{item.requestedByName} <span className="text-slate-400">({item.requestedByRole === 'admin' ? 'أدمن' : 'نادي'})</span></td>
                    <td className="py-2.5 px-3 text-center font-mono">{formatDateCustom(item.requestedAt)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAccept(item)}
                          disabled={processingId === item.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-700 border border-emerald-200 rounded-lg cursor-pointer font-bold"
                        >
                          {processingId === item.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          قبول
                        </button>
                        <button
                          type="button"
                          onClick={() => { setRejectingItem(item); setRejectionReason(''); }}
                          disabled={processingId === item.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 border border-rose-200 rounded-lg cursor-pointer font-bold"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          رفض
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollWrapper>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-xs font-black text-slate-700">سجل القرارات ({decidedItems.length})</h3>
        </div>
        {decidedItems.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-400 font-bold">مفيش قرارات سابقة لسه.</div>
        ) : (
          <TableScrollWrapper>
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold">
                <tr>
                  <th className="py-2.5 px-3 text-right">اسم العضو</th>
                  <th className="py-2.5 px-3 text-center">رقم العضوية</th>
                  <th className="py-2.5 px-3 text-center">النادي</th>
                  <th className="py-2.5 px-3 text-center">القرار</th>
                  <th className="py-2.5 px-3 text-center">بواسطة</th>
                  <th className="py-2.5 px-3 text-center">التاريخ</th>
                  <th className="py-2.5 px-3 text-right">سبب الرفض</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {decidedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-bold">{item.memberName || '—'}</td>
                    <td className="py-2.5 px-3 text-center font-mono">{item.membershipNumber || '—'}</td>
                    <td className="py-2.5 px-3 text-center">{item.club || '—'}</td>
                    <td className="py-2.5 px-3 text-center">
                      {item.status === 'accepted' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> مقبول
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3 h-3" /> مرفوض
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">{item.decidedByName || '—'}</td>
                    <td className="py-2.5 px-3 text-center font-mono">{item.decidedAt ? formatDateCustom(item.decidedAt) : '—'}</td>
                    <td className="py-2.5 px-3 text-slate-500">{item.rejectionReason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollWrapper>
        )}
      </div>

      {rejectingItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl space-y-3">
            <h4 className="text-sm font-black text-rose-700">سبب رفض طلب الاستفسار</h4>
            <p className="text-xs text-slate-500">
              عضوية {rejectingItem.membershipNumber} -- {rejectingItem.memberName}
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="اكتبي سبب الرفض هنا..."
              rows={3}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setRejectingItem(null); setRejectionReason(''); }}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={processingId === rejectingItem.id}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg cursor-pointer"
              >
                {processingId === rejectingItem.id ? 'جارِ الرفض...' : 'تأكيد الرفض'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
