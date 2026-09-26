import React, { useState, useEffect, useMemo } from 'react';
import { CreditCard, Landmark, CheckCircle2, XCircle, RefreshCw, Edit3, X, Check } from 'lucide-react';
import { User } from '../types';
import { formatDateCustom } from '../utils';
import TableScrollWrapper from './TableScrollWrapper';

interface SendChecksHubProps {
  user: User;
  authToken: string;
  onDataChanged?: () => void;
}

interface SendChecksItem {
  id: string;
  requestId: number;
  checkType: 'advance' | 'bank';
  status: 'pending' | 'accepted' | 'rejected';
  requestedBy: string;
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

export default function SendChecksHub({ user, authToken }: SendChecksHubProps) {
  const [activeSubTab, setActiveSubTab] = useState<'advance' | 'bank'>('advance');
  const [items, setItems] = useState<SendChecksItem[]>([]);
  const [recipients, setRecipients] = useState<{ advance: Recipient; bank: Recipient } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingItem, setRejectingItem] = useState<SendChecksItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [editingRecipient, setEditingRecipient] = useState<'advance' | 'bank' | null>(null);
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
      setItems(data.items || []);
    } catch (err) {
      console.error('Failed to load send-checks requests', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecipients = async () => {
    try {
      const res = await fetch('/api/send-checks-recipients', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      setRecipients(data);
    } catch (err) {
      console.error('Failed to load send-checks recipients', err);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchRecipients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tabItems = useMemo(() => items.filter((i) => i.checkType === activeSubTab), [items, activeSubTab]);
  const pendingItems = useMemo(() => tabItems.filter((i) => i.status === 'pending'), [tabItems]);
  const decidedItems = useMemo(() => tabItems.filter((i) => i.status !== 'pending'), [tabItems]);

  const handleAccept = async (item: SendChecksItem) => {
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
      setMessage({ type: 'success', text: 'تم إرسال الإيميل بنجاح وقبول الطلب.' });
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
      setMessage({ type: 'success', text: 'تم رفض الطلب، والنادي هيشوف السبب جنب الطلب في صفحة الشيكات.' });
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
    if (!editingRecipient) return;
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
        body: JSON.stringify({ checkType: editingRecipient, name: recipientDraft.name.trim(), email: recipientDraft.email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل الحفظ');
      setRecipients(data.recipients);
      setEditingRecipient(null);
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

  const currentRecipient = recipients?.[activeSubTab];

  return (
    <div className="space-y-4 text-right font-sans" dir="rtl">
      <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm w-fit">
        <button
          type="button"
          onClick={() => setActiveSubTab('advance')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeSubTab === 'advance' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          <CreditCard className="h-4 w-4" />
          <span>شيك المقدم</span>
          {pendingItems.length > 0 && activeSubTab !== 'advance' && (
            <span className="text-[10px] bg-rose-500 text-white rounded-full px-1.5">{items.filter(i => i.checkType === 'advance' && i.status === 'pending').length}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('bank')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeSubTab === 'bank' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          <Landmark className="h-4 w-4" />
          <span>الشيكات البنكية</span>
        </button>

        <button
          type="button"
          onClick={fetchItems}
          disabled={isLoading}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer mr-2"
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

      {/* Recipient config */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-3">
        <div className="text-xs">
          <span className="font-bold text-slate-500">الإيميل هيتبعت لـ: </span>
          {editingRecipient === activeSubTab ? (
            <div className="inline-flex items-center gap-2 mt-1">
              <input
                type="text"
                value={recipientDraft.name}
                onChange={(e) => setRecipientDraft((p) => ({ ...p, name: e.target.value }))}
                placeholder="الاسم"
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-1.5 w-24"
              />
              <input
                type="email"
                value={recipientDraft.email}
                onChange={(e) => setRecipientDraft((p) => ({ ...p, email: e.target.value }))}
                placeholder="الإيميل"
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-1.5 w-48"
              />
              <button type="button" onClick={handleSaveRecipient} className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg cursor-pointer hover:bg-emerald-100">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => setEditingRecipient(null)} className="p-1.5 bg-slate-100 text-slate-500 rounded-lg cursor-pointer hover:bg-slate-200">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <span className="font-black text-slate-800">
              {currentRecipient ? `${currentRecipient.name} (${currentRecipient.email})` : '—'}
            </span>
          )}
        </div>
        {editingRecipient !== activeSubTab && (
          <button
            type="button"
            onClick={() => {
              setEditingRecipient(activeSubTab);
              setRecipientDraft(currentRecipient || { name: '', email: '' });
            }}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            title="تعديل"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Pending requests */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-xs font-black text-slate-700">طلبات بانتظار القرار ({pendingItems.length})</h3>
        </div>
        {pendingItems.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-400 font-bold">مفيش طلبات معلّقة.</div>
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

      {/* Decided requests (history) */}
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

      {/* Reject reason modal */}
      {rejectingItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl space-y-3">
            <h4 className="text-sm font-black text-rose-700">سبب رفض إرسال الشيكات</h4>
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
