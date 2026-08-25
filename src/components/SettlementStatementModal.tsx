import React from 'react';
import { Calculator, FileText, X, ShieldAlert, CreditCard, Landmark, Building2, CheckSquare, Printer, Info, UserCheck } from 'lucide-react';
import { CancellationRequest } from '../types';
import { formatDateCustom, formatCommitteeYear, formatCommitteeWithYear, calculateSettlement, printElement, isInternationalRequest } from '../utils';

interface SettlementStatementModalProps {
  request: CancellationRequest | null;
  isOpen?: boolean;
  onClose: () => void;
}

export default function SettlementStatementModal({ request, isOpen, onClose }: SettlementStatementModalProps) {
  if (isOpen === false || !request) return null;

  const computed = calculateSettlement(request);

  const paymentMethodStr = (request.paymentMethod || '').trim();
  const isCompany = !['نقدا', 'نقداً', 'شيكات', 'فيزا', 'ABK', 'عضوية دولية', 'المشرق', 'QNB', 'تحويل بنكي'].includes(paymentMethodStr);
  const isChecks = paymentMethodStr === 'شيكات';
  const isABK = paymentMethodStr === 'ABK';
  const isBank = ['المشرق', 'QNB', 'تحويل بنكي'].includes(paymentMethodStr);
  const isCashOrVisa = ['نقدا', 'نقداً', 'فيزا'].includes(paymentMethodStr);

  const hasAdminOverride = request.adminFeesOverride !== undefined && request.adminFeesOverride !== null && (request.adminFeesOverride as any) !== '' && !isNaN(Number(request.adminFeesOverride));
  const effectiveAdminFees = hasAdminOverride
    ? Number(request.adminFeesOverride)
    : (computed.adminFees !== undefined && computed.adminFees !== null && !isNaN(Number(computed.adminFees)) ? Number(computed.adminFees) : 0);

  const hasUsageOverride = request.usageFeeOverride !== undefined && request.usageFeeOverride !== null && (request.usageFeeOverride as any) !== '' && !isNaN(Number(request.usageFeeOverride));
  const effectiveUsageFee = hasUsageOverride
    ? Number(request.usageFeeOverride)
    : (computed.usageFee !== undefined && computed.usageFee !== null && !isNaN(Number(computed.usageFee)) ? Number(computed.usageFee) : 0);

  const hasVisaOverride = request.visaFeeOverride !== undefined && request.visaFeeOverride !== null && (request.visaFeeOverride as any) !== '' && !isNaN(Number(request.visaFeeOverride));
  const effectiveVisaFee = hasVisaOverride
    ? Number(request.visaFeeOverride)
    : (computed.visaFees2Percent !== undefined && computed.visaFees2Percent !== null && !isNaN(Number(computed.visaFees2Percent)) ? Number(computed.visaFees2Percent) : 0);

  const discountTotal = effectiveAdminFees + effectiveUsageFee + effectiveVisaFee;

  const transferVal = Number(request.transferValue) || 0;
  const subVal = Number(request.subscriptionValue) || 0;
  const debtNum = Number(request.debtABKCompanies) || 0;
  const advancePaid = Number(request.advancePaid) || (Number(request.cashAmount) || 0) + (Number(request.visaAmount) || 0);
  const checksPaid = Number(request.checksPaid) || 0;
  const checksUnpaid = Number(request.checksUnpaid) || 0;

  // ABK Base Refund and Difference calculation
  const abkBaseRefund = Math.max(0, subVal - discountTotal);
  const abkDiff = isABK ? (debtNum > 0 ? (debtNum - abkBaseRefund) : 0) : 0;

  const cur = request.currency || 'ج.م';

  const fullExText = ((request.exceptionType || '') + ' ' + (request.exceptions || '') + ' ' + (request.clubNote || '')).toLowerCase();
  const isNoRefundException = fullExText.includes('بدون رد اى مبلغ') || fullExText.includes('بدون رد أي مبلغ') || fullExText.includes('بدون رد مبلغ') || fullExText.includes('بدون رد') || request.exceptionType === 'بدون رد اى مبلغ' || request.exceptionType === 'بدون رد أي مبلغ';

  // 10. مبلغ الاسترداد (Refund Amount / Debt Amount)
  let refundAmountDisplay = '';
  if (isNoRefundException) {
    refundAmountDisplay = `0 ${cur} (بدون رد أي مبلغ - استثناء)`;
  } else if (isCompany) {
    refundAmountDisplay = debtNum > 0 ? `${debtNum.toLocaleString()} ${cur}` : 'في انتظار المديونية';
  } else if (isABK) {
    // فى حالة طريقة الدفع ABK:
    // مبلغ الاسترداد = قيمة الاشتراك - اجمالى مبلغ الخصم ويظهر حتى فى عدم وجود مديونية
    // ولو الفرق بالسالب: وفى هذه الحالة مبلغ الاسترداد = مديونية البنك فقط
    if (debtNum > 0 && (debtNum - abkBaseRefund) < 0) {
      refundAmountDisplay = `${debtNum.toLocaleString()} ${cur} (مديونية البنك فقط)`;
    } else {
      refundAmountDisplay = `${abkBaseRefund.toLocaleString()} ${cur}`;
    }
  } else if (typeof computed.refundAmount === 'number' && !isNaN(computed.refundAmount)) {
    refundAmountDisplay = `${computed.refundAmount.toLocaleString()} ${cur}`;
  } else if (typeof computed.refundAmount === 'string' && computed.refundAmount) {
    refundAmountDisplay = computed.refundAmount;
  } else if (isChecks) {
    const netCheckRefund = Math.max(0, (advancePaid + checksPaid) - discountTotal);
    refundAmountDisplay = `${netCheckRefund.toLocaleString()} ${cur}`;
  } else {
    const netRefund = Math.max(0, subVal - discountTotal);
    refundAmountDisplay = `${netRefund.toLocaleString()} ${cur}`;
  }

  // 11. مبلغ الرد للعميل (Refund to Client) - يتم حذفه بالكامل في حالة ABK
  let refundToClientDisplay = '';
  if (isNoRefundException) {
    refundToClientDisplay = isABK ? 'Not Required' : `0 ${cur} (بدون رد أي مبلغ - استثناء)`;
  } else if (isCompany) {
    if (typeof computed.refundToClient === 'number' && !isNaN(computed.refundToClient)) {
      refundToClientDisplay = `${computed.refundToClient.toLocaleString()} ${cur}`;
    } else if (typeof computed.refundToClient === 'string' && computed.refundToClient !== 'Not Required') {
      refundToClientDisplay = computed.refundToClient;
    } else {
      refundToClientDisplay = 'في انتظار المديونية';
    }
  } else if (isChecks) {
    const clientRefund = Math.max(0, (advancePaid + checksPaid) - discountTotal);
    refundToClientDisplay = `${clientRefund.toLocaleString()} ${cur}`;
  } else if (isBank) {
    const clientRefund = Math.max(0, transferVal - discountTotal);
    refundToClientDisplay = `${clientRefund.toLocaleString()} ${cur}`;
  } else if (!isABK) {
    const clientRefund = Math.max(0, subVal - discountTotal);
    refundToClientDisplay = `${clientRefund.toLocaleString()} ${cur}`;
  }

  const handlePrint = () => {
    printElement('settlement-statement-print-card', `كشف حساب وتسوية - عضوية ${request.membershipNumber}`);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-right font-sans settlement-print-backdrop" dir="rtl">
      <div id="settlement-statement-print-card" className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-slate-100 max-h-[94vh] overflow-y-auto animate-in fade-in zoom-in-95 settlement-print-card">
        
        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 pb-3 gap-3">
          <div className="flex items-center gap-2 text-amber-600">
            <Calculator className="h-6 w-6 shrink-0 text-amber-600 no-print" />
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                كشف حساب وتسوية إلغاء العضوية ({request.membershipNumber})
              </h3>
              <p className="text-xs text-slate-500 font-normal">
                بيانات التسوية المالية المحسوبة والمستقطعات بحسب طريقة السداد ({paymentMethodStr})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 no-print">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl cursor-pointer transition-all shadow-sm active:scale-95"
              title="طباعة فورية لكشف الحساب"
            >
              <Printer className="h-4 w-4" />
              <span>طباعة</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 1. البيانات الخاصة بالعضوية بالاضافة الى رقم العضوية */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="font-black text-slate-800 text-xs flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-amber-600" />
              1. البيانات الخاصة بالعضوية (رقم العضوية: {request.membershipNumber}):
            </span>
            <span className="font-mono text-xs font-black text-slate-700 bg-white px-2.5 py-1 rounded-md border border-slate-300">
              #{request.membershipNumber}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="text-slate-500 font-bold block text-xxs">اسم المشترك / العضو:</span>
              <span className="font-black text-slate-900 text-sm block truncate">{request.memberName}</span>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="text-slate-500 font-bold block text-xxs">النادي الفرعي:</span>
              <span className="font-bold text-slate-800 text-xs block">{request.club}</span>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="text-slate-500 font-bold block text-xxs">نوع العضوية:</span>
              <span className="font-bold text-slate-800 text-xs block">{request.membershipType || '—'}</span>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="text-slate-500 font-bold block text-xxs">تاريخ الاشتراك:</span>
              <span className="font-mono font-bold text-slate-800 text-xs block">
                {request.subscriptionDate ? formatDateCustom(request.subscriptionDate) : '—'}
              </span>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="text-slate-500 font-bold block text-xxs">تاريخ طلب الإلغاء:</span>
              <span className="font-mono font-bold text-slate-800 text-xs block">
                {request.requestDate ? formatDateCustom(request.requestDate) : '—'}
              </span>
            </div>

            {request.days !== undefined && (
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 font-bold block text-xxs">مدة الاستهلاك:</span>
                <span className="font-bold text-amber-700 text-xs block">{request.days} يوم ({request.type || '—'})</span>
              </div>
            )}

            {request.committeeNo && (
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 font-bold block text-xxs">اللجنة:</span>
                <span className="font-bold text-slate-800 text-xs block">
                  {formatCommitteeWithYear(request.committeeNo, request.committeeYear, request.approvalDate || request.requestDate || (request as any).createdAt)}
                </span>
              </div>
            )}

            {request.loanUnderName && (
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 col-span-2">
                <span className="text-slate-500 font-bold block text-xxs">القرض / التمويل باسم:</span>
                <span className="font-bold text-slate-900 text-xs block truncate">{request.loanUnderName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Ordered Settlement Items: 2 -> 12 */}
        <div className="space-y-2.5 text-xs">
          <span className="font-black text-slate-800 block border-b border-slate-200 pb-1 flex items-center gap-1.5 text-sm">
            <FileText className="w-4 h-4 text-amber-600" />
            تفاصيل التسوية المالية المعتمدة:
          </span>

          <div className="bg-slate-50/90 p-4 rounded-xl border border-slate-200 space-y-3">
            
            {/* 2. طريقة الاشتراك */}
            <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-700 text-xs">2. طريقة الاشتراك:</span>
              <span className="inline-flex items-center gap-1.5 font-black px-3 py-1 rounded-full text-xs bg-amber-100 text-amber-950 border border-amber-300">
                {isCompany && <Building2 className="w-3.5 h-3.5 text-amber-700" />}
                {isABK && <Landmark className="w-3.5 h-3.5 text-amber-700" />}
                {isChecks && <CheckSquare className="w-3.5 h-3.5 text-amber-700" />}
                {isCashOrVisa && <CreditCard className="w-3.5 h-3.5 text-amber-700" />}
                {paymentMethodStr}
              </span>
            </div>

            {/* 3. قيمة الاشتراك */}
            <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-800 text-xs">3. قيمة الاشتراك بالعقد:</span>
              <span className="font-mono text-sm font-black text-slate-950">{subVal.toLocaleString()} {cur}</span>
            </div>

            {/* 4. قيمة المقدم (نقدي + فيزا) */}
            <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200">
              <div>
                <span className="font-bold text-slate-800 text-xs block">{isInternationalRequest(request) ? '4. قيمة المقدم:' : '4. قيمة المقدم (نقدي + فيزا):'}</span>
                {((Number(request.cashAmount) || 0) > 0 || (Number(request.visaAmount) || 0) > 0) && !isInternationalRequest(request) && (
                  <span className="text-[11px] text-slate-500 font-normal">
                    (نقداً: {(Number(request.cashAmount) || 0).toLocaleString()} {cur} | فيزا: {(Number(request.visaAmount) || 0).toLocaleString()} {cur})
                  </span>
                )}
              </div>
              <span className="font-mono text-sm font-black text-slate-900">{advancePaid.toLocaleString()} {cur}</span>
            </div>

            {/* 5. قيمة التحويلة (تظهر في حالة الشركات والبنوك فقط) */}
            {(isCompany || isABK || isBank) && (
              <div className="flex justify-between items-center bg-purple-50/80 p-3 rounded-xl border border-purple-200">
                <span className="font-bold text-purple-900 text-xs flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-purple-700" />
                  5. قيمة التحويلة:
                </span>
                <span className="font-mono text-sm font-black text-purple-950">{transferVal.toLocaleString()} {cur}</span>
              </div>
            )}

            {/* 6. قيمة الشيكات المسددة (تظهر في حالة الشيكات فقط) */}
            {isChecks && (
              <div className="flex justify-between items-center bg-emerald-50/80 p-3 rounded-xl border border-emerald-200">
                <span className="font-bold text-emerald-900 text-xs flex items-center gap-1">
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-700" />
                  6. قيمة الشيكات المسددة:
                </span>
                <span className="font-mono text-sm font-black text-emerald-950">{checksPaid.toLocaleString()} {cur}</span>
              </div>
            )}

            {/* 7. قيمة الشيكات الغير مسددة (تظهر في حالة الشيكات فقط) */}
            {isChecks && (
              <div className="flex justify-between items-center bg-rose-50/80 p-3 rounded-xl border border-rose-200">
                <span className="font-bold text-rose-900 text-xs flex items-center gap-1">
                  <CheckSquare className="w-3.5 h-3.5 text-rose-700" />
                  7. قيمة الشيكات الغير مسددة (تُلغى):
                </span>
                <span className="font-mono text-sm font-black text-rose-950">{checksUnpaid.toLocaleString()} {cur}</span>
              </div>
            )}

            {/* 8. مصاريف ادارية - مقابل انتفاع - مصاريف فيزا */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
              <span className="font-bold text-rose-900 block text-xs border-b border-slate-100 pb-1">
                8. تفاصيل المستقطعات الحالية (مصاريف إدارية - مقابل انتفاع - مصاريف فيزا):
              </span>
              <div className="pr-3 text-xs space-y-1.5 text-slate-700">
                <div className="flex justify-between">
                  <span>• مصاريف إدارية:</span>
                  <span className="font-mono font-bold text-rose-700">
                    {effectiveAdminFees.toLocaleString()} {cur}
                    {hasAdminOverride && (
                      <span className="text-[10px] text-amber-700 font-bold mr-1">(استثناء خاص)</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>• مقابل انتفاع (استهلاك):</span>
                  <span className="font-mono font-bold text-rose-700">
                    {effectiveUsageFee.toLocaleString()} {cur}
                    {hasUsageOverride && (
                      <span className="text-[10px] text-amber-700 font-bold mr-1">(استثناء خاص)</span>
                    )}
                  </span>
                </div>
                {((request.visaFees2Percent !== undefined && request.visaFees2Percent !== null && request.visaFees2Percent > 0) || hasVisaOverride || effectiveVisaFee > 0) && (
                  <div className="flex justify-between">
                    <span>• مصاريف فيزا (2%):</span>
                    <span className="font-mono font-bold text-rose-700">
                      {effectiveVisaFee.toLocaleString()} {cur}
                      {hasVisaOverride && (
                        <span className="text-[10px] text-amber-700 font-bold mr-1">(استثناء خاص)</span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 9. إجمالي مبلغ الخصم */}
            <div className="flex justify-between items-center bg-rose-100/90 p-3 rounded-xl border border-rose-300 text-rose-950 font-black">
              <span className="text-xs">9. إجمالي مبلغ الخصم المستقطع:</span>
              <span className="font-mono text-base">{discountTotal.toLocaleString()} {cur}</span>
            </div>

            {/* 10. مبلغ الاسترداد */}
            <div className="flex justify-between items-center bg-amber-50 p-3 rounded-xl border border-amber-300 text-amber-950 font-black">
              <span className="text-xs">
                10. مبلغ الاسترداد {isCompany ? '(مديونية الشركة المسجلة)' : isABK ? '(المسترد للبنك)' : ''}:
              </span>
              <span className="font-mono text-sm text-amber-900">{refundAmountDisplay}</span>
            </div>

            {/* 11. مبلغ الرد للعميل (محذوف تماماً في حالة ABK) */}
            {!isABK && (
              <div className="flex justify-between items-center bg-emerald-100/90 p-3.5 rounded-xl border border-emerald-300 text-emerald-950 font-black text-sm shadow-xs">
                <span>11. مبلغ الرد للعميل (المستحق الصرف للعميل):</span>
                <span className="font-mono text-lg text-emerald-900">{refundToClientDisplay}</span>
              </div>
            )}

            {/* 12. فرق مديونية ABK (يظهر في حالة ABK فقط) */}
            {isABK && (
              <div className="bg-blue-50/95 p-4 rounded-xl border border-blue-200 space-y-2">
                <div className="flex justify-between items-center font-black text-xs text-blue-950">
                  <span className="flex items-center gap-1.5 text-sm">
                    <Info className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>فرق مديونية ABK:</span>
                  </span>
                  <div className="text-left">
                    {debtNum <= 0 ? (
                      <span className="inline-block font-bold text-xs px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg">
                        فى انتظار مديونية البنك
                      </span>
                    ) : abkDiff > 0 ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-bold text-xs text-rose-800 bg-rose-100 border border-rose-300 px-2.5 py-0.5 rounded-md">
                          يرجى ايداع المبلغ بحساب العضو ببنك ABK
                        </span>
                        <span className="font-mono font-black text-sm text-rose-900">
                          +{abkDiff.toLocaleString()} {cur}
                        </span>
                      </div>
                    ) : abkDiff < 0 ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-bold text-xs text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-md">
                          مبلغ رد للعميل
                        </span>
                        <span className="font-mono font-black text-sm text-emerald-900">
                          {Math.abs(abkDiff).toLocaleString()} {cur}
                        </span>
                      </div>
                    ) : (
                      <span className="font-mono font-bold text-xs px-2.5 py-0.5 bg-slate-100 text-slate-800 border border-slate-300 rounded-md">
                        0 {cur} (مطابق تماماً)
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-[11px] text-blue-800 pr-5 leading-relaxed">
                  {debtNum <= 0 ? (
                    <span>* في انتظار إدخال مديونية البنك الرسمية لاحتساب فرق المديونية تلقائياً.</span>
                  ) : (
                    <span>
                      * فرق المديونية = مديونية البنك ({debtNum.toLocaleString()} {cur}) − مبلغ الاسترداد ({abkBaseRefund.toLocaleString()} {cur}).
                      {abkDiff < 0 && ' (وفى هذه الحالة يكون مبلغ الاسترداد المعتمد = مديونية البنك فقط)'}
                    </span>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Exceptions & Notes */}
        {(request.isException || request.exceptions || request.exceptionType || request.clubNote) && (
          <div className="bg-amber-50/80 p-3.5 rounded-xl border border-amber-200 text-xs space-y-1.5">
            <span className="font-black text-amber-950 flex items-center gap-1">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              تفاصيل وملاحظات الاستثناء:
            </span>
            {request.exceptionType && (
              <div className="text-slate-800"><strong>نوع الاستثناء:</strong> {request.exceptionType}</div>
            )}
            {request.exceptions && (
              <div className="text-slate-800"><strong>سبب/تفاصيل الاستثناء:</strong> {request.exceptions}</div>
            )}
            {request.clubNote && (
              <div className="text-slate-800"><strong>ملاحظة النادي:</strong> {request.clubNote}</div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 no-print">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl cursor-pointer transition-all shadow-sm"
          >
            <Printer className="h-4 w-4" />
            طباعة كشف الحساب
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-sm"
          >
            إغلاق الكشف
          </button>
        </div>

      </div>
    </div>
  );
}
