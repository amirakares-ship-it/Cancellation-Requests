import React, { useState, useEffect } from 'react';
import { 
  Mail, Send, Eye, RefreshCw, FileText, Check, ListFilter, Trash2 
} from 'lucide-react';

interface EmailTemplatesProps {
  request?: any; // Selected request
  user: any;
  onSendSuccess: () => void;
}

export default function EmailTemplates({ request, user, onSendSuccess }: EmailTemplatesProps) {
  const [activeTemplate, setActiveTemplate] = useState<'club' | 'abk' | 'company' | 'data_admin'>('club');
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch email logs
  const fetchEmailLogs = async () => {
    try {
      const token = localStorage.getItem('wd_token');
      const res = await fetch('/api/emails', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setLogs(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchEmailLogs();
  }, []);

  // Sync state whenever active template or request changes
  useEffect(() => {
    if (!request) {
      setRecipient('cancellations@wadidegla.com');
      setSubject('إجراءات تسوية إلغاء العضويات العامة');
      setBody('يرجى اختيار معاملة مشترك من الجدول لتوليد القوالب التلقائية...');
      return;
    }

    const todayStr = new Date().toLocaleDateString('ar-EG');

    if (activeTemplate === 'club') {
      setRecipient(`branch.${request.club.toLowerCase()}@wadidegla.com`);
      setSubject(`تنبيه عاجل: استلام أصول إيصالات الإلغاء للمشترك ${request.memberName}`);
      setBody(
        `السادة إدارة نادي وادي دجلة - فرع ${request.club}\n\n` +
        `تحية طيبة وبعد،،\n` +
        `يرجى التكرم بالاتصال بالمشترك: ${request.memberName}، صاحب العضوية رقم: (${request.membershipNumber})\n` +
        `وإبلاغه بضرورة تسليم أصل إيصالات سداد الاشتراك المقدمة وصورة البطاقة الشخصية وصيغة التنازل الورقي للبدء في تسييل الشيك المعتمد وصرف القيمة المستردة المقدرة بـ (${typeof request.refundAmount === 'number' ? request.refundAmount.toLocaleString() : (request.refundAmount || 0)} ج.م).\n\n` +
        `يرجى تحديث حالة "استلام الإيصالات" فور حيازتكم للورقيات بالأصل لإشعار المراجعة المركزية.\n\n` +
        `شاكرين حسن تعاونكم،،\n` +
        `إدارة مراجعة تسوية العضويات المركزية`
      );
    } else if (activeTemplate === 'abk') {
      setRecipient(`branch.${request.club.toLowerCase()}@wadidegla.com`);
      setSubject(`فروقات التمويل والمديونية المستحقة لبنك ABK - عضوية ${request.membershipNumber}`);
      
      const diffVal = request.abkDebtDifference || 0;
      let diffMsg = "";
      if (typeof diffVal === 'number') {
        if (diffVal >= 0) {
          diffMsg = `يحق للعميل استرداد فائض تمويلي قدره (+${diffVal.toLocaleString()} ج.م) مضاف للشيك البنكي المعتمد.`;
        } else {
          diffMsg = `يتوجب على المشترك سداد مديونية فرق تمويلي مباشرة في البنك وقدرها (${Math.abs(diffVal).toLocaleString()} ج.م) وإحضار إيصال السداد البنكي قبل تسليم شيك الإلغاء.`;
        }
      }

      setBody(
        `إلى مسؤول مبيعات وتسويات فرع ${request.club}\n\n` +
        `برجاء إحاطة المشترك ${request.memberName} صاحب العضوية رقم (${request.membershipNumber}) بالتفاصيل المالية للبنك الأهلي الكويتي (ABK):\n\n` +
        `• قيمة تمويل القرض الأساسي: ${request.transferValue?.toLocaleString() || 0} ج.م\n` +
        `• مديونية العميل المحدثة بالبنك: ${request.debtABKCompanies?.toLocaleString() || 0} ج.م\n` +
        `• قيمة شيك الإلغاء بالنادي: ${typeof request.refundAmount === 'number' ? request.refundAmount.toLocaleString() : (request.refundAmount || 0)} ج.م\n` +
        `• نتيجة فرق التسوية: ${diffMsg}\n\n` +
        `برجاء عدم تسليم شيك الصرف للعضو إلا بعد إبراز أصل إشعار السداد النقدي بالبنك الأهلي الكويتي للتسوية إن كانت عليه مديونية.\n\n` +
        `تقبلوا وافر الاحترام والتقدير،،`
      );
    } else if (activeTemplate === 'company') {
      setRecipient(`settlements@aman-finance.com`);
      setSubject(`تقرير لجان تصفية مديونيات تسهيلات أندية وادي دجلة - العضوية ${request.membershipNumber}`);
      setBody(
        `عناية السادة في إدارة التسويات المالية لشركة ${request.paymentMethod}\n\n` +
        `تحية طيبة،،\n` +
        `نرسل لسيادتكم بيانات تصفية العضوية الممولة من جهتكم المذكورة بالخطاب:\n` +
        `• اسم العميل الأساسي: ${request.memberName}\n` +
        `• القرض مقيد باسم: ${request.loanUnderName || 'غير محدد'}\n` +
        `• رقم بطاقة العميل الائتمانية / الهوية: ${request.nationalId}\n` +
        `• رقم العضوية المعتمدة: ${request.membershipNumber}\n` +
        `• قيمة تمويل العضوية (التحويلة): ${request.transferValue?.toLocaleString() || 0} ج.م\n` +
        `• مديونية الشركة لدنيا: ${request.debtABKCompanies?.toLocaleString() || 0} ج.م\n` +
        `• مبلغ الخصم المطبق للائحة: ${request.discountAmount?.toLocaleString() || 0} ج.م\n` +
        `• المبلغ المرتجع لحساب شركتكم لإبراء ذمة النادي: ${typeof request.refundAmount === 'number' ? request.refundAmount.toLocaleString() : (request.refundAmount || 0)} ج.م\n\n` +
        `يرجى تأكيد الاستلام وتوجيه المعالجة المالية لشطب العميل في نظامكم الائتماني الموحد.\n\n` +
        `ولكم جزيل الشكر والتقدير،،`
      );
    } else if (activeTemplate === 'data_admin') {
      setRecipient(`it.data_admin@wadidegla.com`);
      setSubject(`طلب تجميد وشطب عضوية نهائي من نظام الأندية - العضوية ${request.membershipNumber}`);
      setBody(
        `السادة زملائنا في فريق شؤون شطب العضويات وتحديث البيانات (Data Admin)\n\n` +
        `تحية طيبة وبعد،،\n` +
        `بناءً على اعتماد المذكرة الفنية والمالية رقم (${request.id}) المعتمدة من رئيس القطاع المالي المرفقة صورتها، يرجى التكرم بشطب وتجميد العضوية التالية نهائياً في النظام الرئيسي للأندية:\n\n` +
        `• رقم العضوية: ${request.membershipNumber}\n` +
        `• اسم المشترك: ${request.memberName}\n` +
        `• رقم العميل (External ID): ${request.externalId}\n` +
        `• فرع المشترك: ${request.club}\n` +
        `• قيمة الشيك المستحق فعلياً للعميل: ${typeof request.refundAmount === 'number' ? request.refundAmount.toLocaleString() : (request.refundAmount || 0)} ج.م\n` +
        `• حالة التحديث النهائي: ${request.status} ومقيدة بتاريخ ${request.statusDate || todayStr}\n\n` +
        `يرجى تحديث حالة عضوية العميل لتصبح "Cancelled" أو "Deleted" في نظام الـ CRM وإشعارنا لإتمام الأرشفة.\n\n` +
        `شاكرين جهودكم المتميزة،،`
      );
    }
  }, [activeTemplate, request]);

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || !subject || !body) {
      alert('يرجى تعبئة كافة حقول البريد لتوليد الإرسال');
      return;
    }

    setLoading(true);
    setSuccessMsg('');

    try {
      const token = localStorage.getItem('wd_token');
      const res = await fetch('/api/emails/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          requestId: request?.id,
          type: activeTemplate === 'club' ? 'Club Notification' : 
                activeTemplate === 'abk' ? 'ABK Difference' :
                activeTemplate === 'company' ? 'Company Notification' : 'Data Admin Notification',
          recipient,
          subject,
          body
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('تم إرسال البريد الإلكتروني المحاكي بنجاح، وتم قيد هذه الحركة في سجل مراسلات المنظومة المعتمد!');
        onSendSuccess();
        fetchEmailLogs();
      } else {
        alert(data.error || 'فشل إرسال البريد');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      {/* Selection row templates */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
          <div>
            <h2 className="text-base font-black text-slate-800 flex items-center gap-1.5">
              <Mail className="h-5 w-5 text-amber-500" />
              مركز المراسلات الإلكترونية والتنبيهات المباشرة
            </h2>
            <p className="text-xxs text-slate-400 mt-0.5">
              {request ? `المشترك المحدد: ${request.memberName} (${request.membershipNumber})` : 'يرجى تحديد طلب عضوية أولاً من قائمة العرض لتفعيل القوالب الذكية'}
            </p>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTemplate('club')}
              className={`px-3 py-1.5 font-black text-xxs rounded-lg cursor-pointer transition-all ${
                activeTemplate === 'club' ? 'bg-amber-400 text-neutral-950 shadow-sm' : 'bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100'
              }`}
            >
              إشعار الفرع (التحصيل الورقي)
            </button>
            <button
              type="button"
              onClick={() => setActiveTemplate('abk')}
              className={`px-3 py-1.5 font-black text-xxs rounded-lg cursor-pointer transition-all ${
                activeTemplate === 'abk' ? 'bg-amber-400 text-neutral-950 shadow-sm' : 'bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100'
              }`}
            >
              فروقات ABK البنكية
            </button>
            <button
              type="button"
              onClick={() => setActiveTemplate('company')}
              className={`px-3 py-1.5 font-black text-xxs rounded-lg cursor-pointer transition-all ${
                activeTemplate === 'company' ? 'bg-amber-400 text-neutral-950 shadow-sm' : 'bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100'
              }`}
            >
              شطب الالتزام للشركة الممولة
            </button>
            <button
              type="button"
              onClick={() => setActiveTemplate('data_admin')}
              className={`px-3 py-1.5 font-black text-xxs rounded-lg cursor-pointer transition-all ${
                activeTemplate === 'data_admin' ? 'bg-amber-400 text-neutral-950 shadow-sm' : 'bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100'
              }`}
            >
              طلب شطب النظام (Data Admin)
            </button>
          </div>
        </div>

        {successMsg && (
          <div className="p-3 bg-amber-400/10 border-r-4 border-amber-400 text-amber-600 text-xs rounded-lg mb-4 font-bold">
            {successMsg}
          </div>
        )}

        {/* Email form layout */}
        <form onSubmit={handleSendEmail} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div>
              <label className="block text-xxs font-bold text-slate-500 mb-1">البريد الإلكتروني للمستلم</label>
              <input
                type="text"
                required
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-left"
              />
            </div>
            <div>
              <label className="block text-xxs font-bold text-slate-500 mb-1">عنوان موضوع البريد الإلكتروني Subject</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5"
              />
            </div>
            <div>
              <label className="block text-xxs font-bold text-slate-500 mb-1">محتوى ونص البريد الإلكتروني الموجه التفصيلي</label>
              <textarea
                rows={9}
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 font-medium leading-relaxed"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !request}
              className="w-full py-2.5 bg-amber-400 hover:bg-amber-500 disabled:bg-slate-200 disabled:text-slate-400 text-neutral-950 font-black text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all"
            >
              <Send className="h-4 w-4" />
              {loading ? 'جاري إرسال البريد الإلكتروني المشفّر...' : 'إرسال التنبيه الفوري المحاكي'}
            </button>
          </div>

          {/* Realtime Email Logs history */}
          <div className="space-y-3">
            <span className="block text-xs font-black text-slate-700">سجل المراسلات الصادرة الأخير:</span>
            <div className="border border-slate-100 rounded-2xl max-h-96 overflow-y-auto space-y-2.5 p-3.5 bg-slate-50/50">
              {logs.length === 0 ? (
                <div className="text-center text-xxs text-slate-400 py-12">لا يوجد مراسلات مسجلة في هذه اللمسة</div>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="bg-white p-3 rounded-xl border border-slate-200 text-xxs space-y-1.5 shadow-sm text-right">
                    <div className="flex justify-between font-bold text-slate-800 border-b border-slate-50 pb-1 flex-row-reverse">
                      <span className="bg-amber-400/20 text-amber-600 px-1.5 py-0.5 rounded text-[8px] font-bold">{log.type}</span>
                      <span className="text-slate-400 font-mono text-[9px]">{new Date(log.sentAt).toLocaleTimeString('ar-EG')}</span>
                    </div>
                    <div className="text-slate-500 font-bold">إلى: {log.recipient}</div>
                    <div className="text-slate-700 font-black text-right truncate">{log.subject}</div>
                    <div className="text-slate-500 text-[10px] line-clamp-3 leading-relaxed whitespace-pre-line text-right">{log.body}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
