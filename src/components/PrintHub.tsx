import React, { useState, useEffect } from 'react';
import { 
  Printer, ArrowRight, Info, AlertTriangle, Edit, RefreshCw, FileText, CheckCircle2 
} from 'lucide-react';
import { CustomField } from '../types';
import { formatDateCustom, formatCommitteeYear, printElement, isInternationalRequest } from '../utils';
import { WadiDeglaLogo } from './WadiDeglaLogo';

interface PrintHubProps {
  request: any;
  user: any;
  onBack: () => void;
  labelNames?: Record<string, string>;
  customFields?: CustomField[];
}

export default function PrintHub({ request, user, onBack, labelNames, customFields }: PrintHubProps) {
  // Types: 'memo' | 'membership_diff' | 'check_reissue'
  const [printType, setPrintType] = useState<'memo' | 'membership_diff' | 'check_reissue'>('memo');

  const getLabel = (key: string, fallback: string) => {
    return labelNames?.[key] || fallback;
  };

  // Editable fields for live on-the-fly memo adjustments
  const [draftTitle, setDraftTitle] = useState('مذكرة تسوية مالية وإلغاء عضوية');
  const [draftIntro, setDraftIntro] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftFooter, setDraftFooter] = useState('مع تحميل هذا الإلغاء على إدارة المبيعات.');
  const [auditorName, setAuditorName] = useState('صفوت رجائي');

  // Conditional flags evaluated from request data
  const isCompany = ["Premium", "Aman", "Ollin", "Contact", "One Finance"].includes(request.paymentMethod);
  const isInternational = request.membershipType === "International" || isInternationalRequest(request);
  const isABK = request.paymentMethod === "ABK";
  const hasLoanName = !!request.loanUnderName;
  const isTanta = request.club === "Tanta";
  const isSovereign = request.documents && request.documents.includes("جهة سيادية");
  const isHumanitarian = request.documents && request.documents.includes("حالة إنسانية");

  // Determine Form Sub-Type
  // Form 1: Standard نقدا / شيكات / ABK (no loan)
  // Form 2: ABK with Loan Name
  // Form 3: Company (Aman / Ollin / Contact / Premium)
  // Form 4: International
  let evaluatedFormType = "Form 1 — Standard";
  if (isInternational) {
    evaluatedFormType = "Form 4 — International (ريال سعودي)";
  } else if (isCompany) {
    evaluatedFormType = "Form 3 — Company (لصالح الشركة)";
  } else if (isABK && hasLoanName) {
    evaluatedFormType = "Form 2 — ABK with Loan (القرض باسم)";
  }

  // Pre-generate standard templates based on Request & Form Type
  useEffect(() => {
    const todayStr = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    
    if (printType === 'memo') {
      setDraftTitle(isInternational ? 'مذكرة تسوية إلغاء عضوية دولية' : 'مذكرة عرض على قطاع المالية والشؤون القانونية');
      
      let introText = `إنه في يوم ${todayStr}، وبناءً على طلب الإلغاء المقدم من العضو الموضح بياناته أدناه، تم إجراء التسوية المالية وفقاً للائحة الأندية المعتمدة وللشروط التعاقدية للعضوية المبرمة مع المشترك:`;
      setDraftIntro(introText);

      let bodyText = "";
      if (isInternational) {
        bodyText = `بما أن المشترك يحمل عضوية دولية (International Membership)، فقد تم احتساب الفروقات بالريال السعودي، ومعافاته من المصاريف الإدارية ومقابل الانتفاع طبقاً للائحة الخاصة بالعضويات الدولية الصادرة عن مجلس الإدارة.`;
      } else if (isCompany) {
        bodyText = `نظراً لأن سداد العضوية تم عن طريق شركة تمويل استهلاكي وتسهيل ائتماني (${request.paymentMethod}) بموجب العقد المبرم، يتم توجيه مبالغ الاسترداد والتحويل مباشرة لحساب الشركة الممولة لإبراء ذمة النادي وتقليص مديونية العميل لديها.`;
      } else if (isABK) {
        bodyText = `بما أن طريقة السداد المتبعة هي التمويل عبر البنك الأهلي الكويتي (ABK) بموجب رقم الحساب (${request.accountNumber || 'غير محدد'})، يتم تسوية الفروقات بموجب تحويل بنكي بعد مطابقة مديونية البنك وسداد العميل للالتزامات المستحقة إن وجدت.`;
      } else {
        bodyText = `تمت مراجعة طلب الإلغاء للوقوف على أسباب العميل المذكورة تفصيلاً وهي (${request.cancellationReasonDetail || request.cancellationReason}) وبناءً عليه تقرر تصفية الحساب ماليًا وصرف الشيك المستحق طبقاً للائحة المعمول بها بالنادي.`;
      }
      setDraftBody(bodyText);

    } else if (printType === 'membership_diff') {
      setDraftTitle('مذكرة تسوية فروق تعاقدية لعضوية مشتركة');
      setDraftIntro(`إيماءً إلى المذكرة السابقة الخاصة بعضوية المشترك رقم (${request.membershipNumber}) باسم السيد/ ${request.memberName}، المعتمدة من قطاع المالية:`);
      setDraftBody(`نحيط سيادتكم علماً بأنه تقرر تعديل بنود التسوية المالية للعضوية لتصبح تسوية استثنائية (فروق عضوية) نظراً لتغير جهة التمويل أو الرغبة في تحويل العضوية لتكون تابعة لعقد مجمع مع شركة التمويل الحالية، وبالتالي إلغاء المذكرة السابقة واعتماد هذه التسوية كبديل نهائي.`);
      setDraftFooter('مع توجيه الحسابات لإجراء المعالجة الاستثنائية فوراً.');

    } else if (printType === 'check_reissue') {
      setDraftTitle('مذكرة إعادة إصدار شيك تصفية مستردة');
      setDraftIntro(`بناءً على التماس العضو المشترك رقم (${request.membershipNumber}) لإعادة تحرير شيك الصرف الخاص بإلغاء العضوية:`);
      setDraftBody(`يرجى التكرم بالموافقة على إلغاء الشيك السابق رقم (..............) المؤرخ في (...../...../2026) بمبلغ قدره (${typeof request.refundAmount === 'number' ? request.refundAmount.toLocaleString() : (request.refundAmount || '0')} ج.م) والمسحوب على بنك (....................)، وإعادة إصدار شيك جديد بذات القيمة لصالح العضو نظراً لانتهاء صلاحية الشيك السابق أو رغبته في تغيير اسم المستفيد.`);
      setDraftFooter('مع تحمل العضو لأي مصاريف بنكية لإعادة الإصدار.');
    }
  }, [printType, request, isInternational, isCompany, isABK]);

  const handlePrint = () => {
    printElement('print-hub-canvas-sheet', `مذكرة إلغاء - عضوية ${request.membershipNumber}`);
  };

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      {/* Control Navigation Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div>
          <h2 className="text-lg font-black text-slate-800">مركز طباعة مذكرات الإلغاء الموحد</h2>
          <p className="text-xs text-slate-400 mt-1">
            رقم العضوية: <span className="font-bold text-slate-700">{request.membershipNumber}</span> | اسم المشترك: <span className="font-bold text-slate-700">{request.memberName}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
          >
            رجوع للطلب
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-black text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
            title="طباعة فورية للمذكرة"
          >
            <Printer className="h-4 w-4" />
            <span>طباعة المذكرة</span>
          </button>
        </div>
      </div>

      {/* Help Banner if in iframe */}
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 text-xs leading-relaxed no-print flex items-start gap-2">
        <span className="text-sm">💡</span>
        <div>
          <p className="font-bold">تنبيه هام للطباعة وتوليد الـ PDF:</p>
          <p className="mt-0.5">بسبب قيود المتصفحات الأمنية على الإطارات الداخلية (iFrames)، يرجى الضغط على زر <span className="font-bold">"فتح التطبيق في نافذة جديدة"</span> (أعلى يمين شاشة المعاينة) لتشغيل المنظومة في صفحة مستقلة كاملة، مما يضمن ظهور نافذة الطباعة بحجم A4 الحقيقي وتصدير الـ PDF بشكل مثالي ودون أي تشويه.</p>
        </div>
      </div>

      {/* Selector of Memo Types */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 no-print">
        <span className="block text-xs font-bold text-slate-500">اختر نوع النموذج والمذكرة المراد طباعتها:</span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          
          {/* Memo 1 */}
          <label className={`p-4 rounded-xl border-2 flex items-start gap-3 cursor-pointer transition-all ${
            printType === 'memo' ? 'border-amber-400 bg-amber-400/10' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'
          }`}>
            <input
              type="radio"
              name="print_type"
              checked={printType === 'memo'}
              onChange={() => setPrintType('memo')}
              className="mt-1 text-amber-500 focus:ring-amber-400"
            />
            <div>
              <span className="block font-bold text-xs text-slate-800">مذكرة إلغاء وتسوية أساسية</span>
              <span className="text-xxs text-slate-400 mt-0.5 block">توليد تلقائي لأحد النماذج (Form 1 - 4) مع الجداول المالية والخصومات</span>
              <span className="mt-1.5 inline-block bg-amber-400/20 text-amber-600 text-[9px] font-black px-1.5 py-0.5 rounded-full">
                النموذج النشط: {evaluatedFormType}
              </span>
            </div>
          </label>

          {/* Memo 2 */}
          <label className={`p-4 rounded-xl border-2 flex items-start gap-3 cursor-pointer transition-all ${
            printType === 'membership_diff' ? 'border-amber-400 bg-amber-400/10' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'
          }`}>
            <input
              type="radio"
              name="print_type"
              checked={printType === 'membership_diff'}
              onChange={() => setPrintType('membership_diff')}
              className="mt-1 text-amber-500 focus:ring-amber-400"
            />
            <div>
              <span className="block font-bold text-xs text-slate-800">مذكرة فرق عضوية (Form 5)</span>
              <span className="text-xxs text-slate-400 mt-0.5 block">مخصصة للحالات الاستثنائية والتعديلات المتبادلة دون جدول مالي تقليدي</span>
            </div>
          </label>

          {/* Memo 3 */}
          <label className={`p-4 rounded-xl border-2 flex items-start gap-3 cursor-pointer transition-all ${
            printType === 'check_reissue' ? 'border-amber-400 bg-amber-400/10' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'
          }`}>
            <input
              type="radio"
              name="print_type"
              checked={printType === 'check_reissue'}
              onChange={() => setPrintType('check_reissue')}
              className="mt-1 text-amber-500 focus:ring-amber-400"
            />
            <div>
              <span className="block font-bold text-xs text-slate-800">مذكرة إعادة إصدار شيك (Form 6)</span>
              <span className="text-xxs text-slate-400 mt-0.5 block">نموذج شيك سحب مسترد أو مفقود مع الاحتفاظ بالقيمة والبيانات الأساسية</span>
            </div>
          </label>
        </div>
      </div>

      {/* Editable Fields Panel for Live Customization */}
      <div className="bg-amber-50/30 p-5 rounded-2xl border border-amber-100 shadow-sm space-y-4 no-print">
        <div className="flex items-center gap-1.5 text-amber-800">
          <Info className="h-4 w-4 shrink-0" />
          <span className="text-xs font-bold">محرر مسودة الطباعة الذكي:</span>
        </div>
        <p className="text-xxs text-amber-700/80 leading-relaxed">
          يمكنك تعديل نصوص ديباجة المقدمة، المحتوى التفصيلي، والذيل أدناه مباشرة. أي تعديل تجريه هنا سيظهر فوراً على شكل المستند المطبوع في الأسفل لتخصيصه كيفما شئت قبل تصديره للورق أو كملف PDF.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xxs font-bold text-slate-500 mb-1">عنوان المذكرة الرئيسي</label>
            <input
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-xxs font-bold text-slate-500 mb-1">اسم مراجع الحسابات (ثابت أسفل الورقة)</label>
            <input
              type="text"
              value={auditorName}
              onChange={(e) => setDraftTitle(e.target.value)}
              className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div className="col-span-1 md:col-span-2">
            <label className="block text-xxs font-bold text-slate-500 mb-1">ديباجة المقدمة</label>
            <textarea
              rows={2}
              value={draftIntro}
              onChange={(e) => setDraftIntro(e.target.value)}
              className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div className="col-span-1 md:col-span-2">
            <label className="block text-xxs font-bold text-slate-500 mb-1">المضمون والشرح التفصيلي للقرار</label>
            <textarea
              rows={3}
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div className="col-span-1 md:col-span-2">
            <label className="block text-xxs font-bold text-slate-500 mb-1">توجيه ذيل المذكرة والمسؤولية</label>
            <input
              type="text"
              value={draftFooter}
              onChange={(e) => setDraftFooter(e.target.value)}
              className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>
      </div>

      {/* --- A4 Print Canvas Box --- */}
      <div id="print-hub-canvas-sheet" dir="rtl" className="print-canvas bg-white p-12 rounded-lg shadow-lg border-2 border-slate-900 mx-auto max-w-[21cm] min-h-[29.7cm] flex flex-col justify-between text-slate-900 leading-relaxed text-right font-sans relative">
        {/* Double border frame simulation */}
        <div className="absolute inset-4 border border-slate-900 pointer-events-none"></div>
        
        <div className="space-y-4 relative z-10 flex-1 flex flex-col justify-between h-full">
          <div>
            {/* Logo and Gazelle Header */}
            <div className="flex items-center justify-center w-full mb-4 relative mt-2">
              {/* Left Line */}
              <div className="flex-1 h-[1px] bg-slate-300"></div>
              
              {/* Logo Center Container */}
              <div className="flex flex-col items-center mx-6 text-center shrink-0">
                <WadiDeglaLogo size="md" />
              </div>

              {/* Right Line */}
              <div className="flex-1 h-[1px] bg-slate-300"></div>
            </div>

            {/* Title Box */}
            <div className="flex justify-center my-4">
              <div className="border border-slate-900 rounded-xl px-12 py-3.5 text-center min-w-[320px] shadow-sm bg-white">
                <h2 className="text-xs font-black text-slate-700 leading-none">إدارة العضويات</h2>
                <h1 className="text-sm font-black text-slate-900 mt-1.5">مذكرة داخلية لإلغاء العضوية</h1>
              </div>
            </div>

            {/* General Headers (إلى / الموضوع / التاريخ) */}
            <div className="flex flex-col items-start space-y-1 text-xs font-bold text-slate-800 pr-6 text-right">
              <div>إلى : <span className="font-normal text-slate-700">الإدارة المالية .</span></div>
              <div>الموضوع : <span className="font-normal text-slate-700">طلب إلغاء عضوية .</span></div>
              <div>التاريخ : <span className="font-normal text-slate-700">{formatDateCustom(request.requestDate || new Date())}</span></div>
            </div>

            {/* Member Details */}
            <div className="flex justify-between items-center text-xs font-bold border-b border-dashed border-slate-300 pb-2 pt-1 px-4 mt-3">
              <div className="flex items-center gap-1">
                <span className="text-slate-500">باسم /</span>
                <span className="text-slate-900 font-black">{request.memberName}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-500">رقم عضوية :</span>
                <span className="font-mono text-slate-900 font-black text-sm">{request.membershipNumber}</span>
              </div>
            </div>

            <div className="flex flex-col items-start gap-1 px-4 mt-2 text-right">
              <div className="flex items-center gap-1">
                <span className="text-slate-500">تاريخ الإشترك بالنادى :</span>
                <span className="text-slate-800">{formatDateCustom(request.subscriptionDate)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-500">تاريخ طلب الإلغاء :</span>
                <span className="text-slate-800">{formatDateCustom(request.requestDate)}</span>
              </div>
            </div>

            {/* Main Financial Table */}
            {printType === 'memo' ? (
              <>
                <table className="w-full text-xs text-right border-collapse border border-slate-900 mt-4">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-900 font-bold text-center">
                      <th className="p-1.5 border border-slate-900 w-1/2 text-center">طريقة السداد</th>
                      <th className="p-1.5 border border-slate-900 w-24" colSpan={2}>شيكات</th>
                      <th className="p-1 border border-slate-900 w-24">نقدا</th>
                      <th className="p-1 border border-slate-900 w-24">فيزا</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-center font-bold">
                      <td className="p-1.5 border border-slate-900 text-right pr-4 font-black">إجمالي قيمة العضوية :</td>
                      <td className="p-1.5 border border-slate-900 text-center font-mono font-black">{(request.subscriptionValue || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td className="p-1.5 border border-slate-900 w-12 text-center bg-slate-50">{request.currency || 'جم'}</td>
                      <td className="p-1.5 border border-slate-900 bg-slate-50" colSpan={2}></td>
                    </tr>
                    <tr className="text-center font-bold">
                      <td className="p-1.5 border border-slate-900 text-right pr-4 font-semibold">قيمة المقدم :</td>
                      <td className="p-1.5 border border-slate-900 text-center font-mono">{(request.advancePaid || (request.cashAmount || 0) + (request.visaAmount || 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td className="p-1.5 border border-slate-900 w-12 text-center bg-slate-50">{request.currency || 'جم'}</td>
                      <td className="p-1.5 border border-slate-900 font-mono">{(request.cashAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td className="p-1.5 border border-slate-900 font-mono">{(request.visaAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    </tr>
                    <tr className="text-center font-bold">
                      <td className="p-1.5 border border-slate-900 text-right pr-4 font-semibold">قيمة القرض / التمويل :</td>
                      <td className="p-1.5 border border-slate-900 text-center font-mono">{request.transferValue ? request.transferValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                      <td className="p-1.5 border border-slate-900 w-12 text-center bg-slate-50">{request.currency || 'جم'}</td>
                      <td className="p-1.5 border border-slate-900 bg-slate-50" colSpan={2}></td>
                    </tr>
                    <tr className="text-center font-bold">
                      <td className="p-1.5 border border-slate-900 text-right pr-4 font-semibold">قيمة الشيكات المسددة :</td>
                      <td className="p-1.5 border border-slate-900 text-center font-mono">{request.checksPaid ? request.checksPaid.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                      <td className="p-1.5 border border-slate-900 w-12 text-center bg-slate-50">{request.currency || 'جم'}</td>
                      <td className="p-1.5 border border-slate-900 bg-slate-50" colSpan={2}></td>
                    </tr>
                    <tr className="text-center font-bold">
                      <td className="p-1.5 border border-slate-900 text-right pr-4 font-semibold">قيمة الشيكات الغير مسددة :</td>
                      <td className="p-1.5 border border-slate-900 text-center font-mono">{request.checksUnpaid ? request.checksUnpaid.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                      <td className="p-1.5 border border-slate-900 w-12 text-center bg-slate-50">{request.currency || 'جم'}</td>
                      <td className="p-1.5 border border-slate-900 bg-slate-50" colSpan={2}></td>
                    </tr>
                    <tr className="text-center font-bold">
                      <td className="p-1.5 border border-slate-900 text-right pr-4 font-semibold">قيمة للتجديد السنوى :</td>
                      <td className="p-1.5 border border-slate-900 text-center font-mono">{request.annualRenewalDue ? request.annualRenewalDue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                      <td className="p-1.5 border border-slate-900 w-12 text-center bg-slate-50">{request.currency || 'جم'}</td>
                      <td className="p-1.5 border border-slate-900 bg-slate-50" colSpan={2}></td>
                    </tr>
                  </tbody>
                </table>

                {/* Receipts Indicators */}
                <div className="flex justify-between items-center text-xs font-bold px-4 mt-3">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-900">مرفق بالطلب :</span>
                    <span className="text-slate-900">إيصالات :</span>
                    <span className="border border-slate-900 px-5 py-0.5 text-center font-black bg-white rounded-md mx-1">يوجد</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-900">عددها :</span>
                    <span className="border border-slate-900 px-4 py-0.5 text-center font-mono font-black bg-white rounded-md mx-1">1</span>
                  </div>
                </div>

                {/* Committee Approval Line */}
                <div className="text-xs font-bold px-4 mt-4 text-slate-800 text-right">
                  بناء على موافقة لجنة العضويات رقم <span className="font-mono text-sm underline font-black mx-1">{request.committeeNo || '4'}</span> لسنة <span className="font-mono text-sm underline font-black mx-1">{formatCommitteeYear(request.committeeYear || request.approvalDate)}</span> بإلغاء العضوية عاليه، على النحو التالى:
                </div>

                {/* Deductions Table */}
                <table className="w-full text-xs text-right border-collapse border border-slate-900 mt-2">
                  <tbody>
                    <tr className="text-center font-bold">
                      <td className="p-1.5 border border-slate-900 text-center font-black w-20 bg-slate-50" rowSpan={3}>خصم</td>
                      <td className="p-1.5 border border-slate-900 text-right pr-4 font-semibold">مصاريف إدارية</td>
                      <td className="p-1.5 border border-slate-900 w-12 text-center bg-slate-50">{request.currency || 'جم'}</td>
                      <td className="p-1.5 border border-slate-900 font-mono w-28">{(request.adminFees || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    </tr>
                    <tr className="text-center font-bold">
                      <td className="p-1.5 border border-slate-900 text-right pr-4 font-semibold">مقابل انتفاع بالنادى</td>
                      <td className="p-1.5 border border-slate-900 w-12 text-center bg-slate-50">{request.currency || 'جم'}</td>
                      <td className="p-1.5 border border-slate-900 font-mono w-28">{request.usageFee ? request.usageFee.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                    </tr>
                    <tr className="text-center font-bold">
                      <td className="p-1.5 border border-slate-900 text-right pr-4 font-semibold">مصاريف فيزا 2%</td>
                      <td className="p-1.5 border border-slate-900 w-12 text-center bg-slate-50">{request.currency || 'جم'}</td>
                      <td className="p-1.5 border border-slate-900 font-mono w-28">{request.visaFees2Percent ? request.visaFees2Percent.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                    </tr>
                    <tr className="text-center font-black bg-slate-50 text-slate-900">
                      <td className="p-2 border border-slate-900 text-right pr-4 text-sm" colSpan={2}>مع رد شيك للعضوية بقيمة</td>
                      <td className="p-2 border border-slate-900 w-12 text-center bg-slate-50">{request.currency || 'جم'}</td>
                      <td className="p-2 border border-slate-900 font-mono text-sm underline underline-offset-2">{typeof request.refundAmount === 'number' ? request.refundAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : (request.refundAmount || '0.00')}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Exemption Note and Sales Transfer */}
                <div className="text-xs font-bold text-slate-800 space-y-1 mt-4 px-4 text-right">
                  <div>
                    مع اعفاء العضو من سداد مبلغ <span className="font-mono underline font-black mx-1">{request.annualRenewalDue ? request.annualRenewalDue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</span> {request.currency || 'جم'} مقابل التجديد السنوى لعام <span className="font-mono underline font-black mx-1">{formatCommitteeYear(request.committeeYear || request.approvalDate)}</span>
                  </div>
                  <div className="text-slate-950 font-black mt-2">مع تحميل هذا الالغاء على ادارة المبيعات.</div>
                </div>
              </>
            ) : (
              // Alternate models (Form 5 / Form 6)
              <div className="space-y-4 border border-slate-900 p-4 rounded-xl mt-4 bg-slate-50/40 text-right">
                <p className="text-xs font-bold text-slate-800 underline underline-offset-2">مضمون القرار الفني ومطابقة الحسابات:</p>
                <p className="text-xs text-slate-700 font-medium leading-relaxed">{draftBody}</p>
                <div className="text-right text-xs font-black text-slate-900 mt-2">{draftFooter}</div>
              </div>
            )}
            
            {/* General Description / Legal Explanation for standard memo too */}
            {printType === 'memo' && (
              <div className="space-y-1 mt-3 px-4 text-right">
                <span className="block text-[10px] font-black text-slate-500">ملاحظات توضيحية لقطاع الشؤون المالية والقانونية:</span>
                <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                  {draftBody || 'تمت مراجعة طلب تصفية الحساب ماليًا للوقوف على دقة كافة الأرقام المقررة وصرف القيمة المستحقة بموجب شيك تصفية باسم العضو.'}
                </p>
              </div>
            )}

            {/* Dynamic Custom Fields in Print Memo */}
            {customFields && customFields.filter(f => f.showInPrint).length > 0 && (
              <div className="mt-3 px-4 border-t border-dashed border-slate-300 pt-2 text-right">
                <span className="block text-[10px] font-black text-slate-700 mb-1">بيانات إضافية مخصصة بالمذكرة:</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {customFields
                    .filter(f => f.showInPrint)
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                    .map(field => {
                      const val = request.customValues?.[field.key];
                      if (val === undefined || val === '' || val === null) return null;
                      return (
                        <div key={field.id} className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded border border-slate-200">
                          <span className="text-slate-600 font-bold">{field.label}:</span>
                          <span className="font-bold text-slate-900">{typeof val === 'boolean' ? (val ? 'نعم' : 'لا') : String(val)}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Notes Table and Signatures Box (Wadi Degla Style) */}
          <div>
            <div className="flex justify-between items-start mt-4 px-2 gap-6">
              {/* Right Side Info Box Table */}
              <div className="w-2/3">
                <table className="w-full text-xs text-right border-collapse border border-slate-900">
                  <tbody>
                    <tr>
                      <td className="p-1.5 border border-slate-900 font-black text-center bg-slate-50 w-44">ملاحظات الإدارة المالية :</td>
                      <td className="p-1.5 border border-slate-900 font-semibold text-slate-800 pr-2 min-h-[40px]">
                        {request.adminNote || 'لا يوجد.'}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-1.5 border border-slate-900 font-black text-center bg-slate-50 w-44">رقم العميل :</td>
                      <td className="p-1.5 border border-slate-900 font-mono font-bold pr-2">{request.externalId}</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 border border-slate-900 font-black text-center bg-slate-50 w-44">توقيع مراجع الحسابات :</td>
                      <td className="p-3.5 border border-slate-900"></td>
                    </tr>
                    <tr>
                      <td className="p-1.5 border border-slate-900 font-black text-center bg-slate-50 w-44">توقيع المدير المالي :</td>
                      <td className="p-3.5 border border-slate-900"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Left Side Signatures/Stamps */}
              <div className="w-1/3 flex flex-col items-center justify-center pt-12 text-center">
                <span className="text-sm font-black text-slate-900 block tracking-wide">{auditorName}</span>
                <span className="text-[10px] text-slate-400 mt-1 block">رئيس قسم تسوية العضويات</span>
                
                {request.sectorManagerApproved && request.sectorManagerSignature && (
                  <div className="relative mt-3">
                    <img 
                      src={request.sectorManagerSignature} 
                      alt="Digital Signature Stamp" 
                      className="max-h-16 opacity-90 mix-blend-multiply transform rotate-2"
                    />
                    <div className="absolute inset-0 border border-indigo-600/35 rounded flex items-center justify-center rotate-[-10deg] pointer-events-none">
                      <span className="bg-white/95 text-[7px] font-black text-indigo-700 px-1 py-0.5 rounded border border-indigo-700 leading-none">
                        معتمد رقمياً WD
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Document Footer Control block */}
            <div className="mt-6 pt-2 border-t border-slate-300 flex justify-between items-center text-[9px] font-bold text-slate-400">
              {/* Right (In RTL, first child of justify-between is placed on the right side) */}
              <div className="border border-slate-400 px-4 py-1 text-center font-bold bg-white">
                Document Control
              </div>

              {/* Center */}
              <div>
                <span>Page: 1 of 1</span>
              </div>

              {/* Left */}
              <div className="text-left flex flex-col space-y-0.5 font-mono">
                <span>WDC-CT-ME-01-101-F21-AR</span>
                <span>Rev: 4</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
