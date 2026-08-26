import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ArrowRight, Calculator, Check, AlertCircle, RefreshCw, Layers, Info,
  Upload, Paperclip, FileText, Image as ImageIcon, Trash2, Eye, Lock, Plus, X, ShieldCheck
} from 'lucide-react';
import { calculateAllFields, CalculationInput, toInputDateStr, formatDateCustom, formatCommitteeYear, formatCommitteeWithYear, isSameClub, isSameMembershipNumber, isArabicOnly, isValidExternalId, cleanLeadingZero, isBankPaymentMethod, isInternationalRequest } from '../utils';
import { CustomField, RequestAttachment } from '../types';
import DocumentViewerModal from './DocumentViewerModal';

interface RequestFormProps {
  request?: any; // Undefined if creating
  user: any;
  dropdowns: any;
  existingRequests?: any[];
  onSave: (data: any) => void;
  onCancel: () => void;
  labelNames?: Record<string, string>;
  customFields?: CustomField[];
}

export default function RequestForm({ request, user, dropdowns, existingRequests = [], onSave, onCancel, labelNames, customFields }: RequestFormProps) {
  const isEditing = !!request;

  const isCompanyPaymentMethod = (method: string) => {
    if (!method) return false;
    const nonCompanyMethods = ["نقدا", "نقداً", "شيكات", "فيزا", "ABK", "عضوية دولية", "المشرق", "QNB", "تحويل بنكي"];
    if (nonCompanyMethods.includes(method.trim())) {
      return false;
    }
    return true;
  };

  const getLabel = (key: string, fallback: string) => {
    return labelNames?.[key] || fallback;
  };

  // Custom Fields State
  const [customValues, setCustomValues] = useState<Record<string, any>>(request?.customValues || {});

  useEffect(() => {
    if (request && request.customValues) {
      setCustomValues(request.customValues);
    }
  }, [request]);

  const handleCustomValueChange = (key: string, val: any) => {
    setCustomValues(prev => ({ ...prev, [key]: val }));
  };

  const renderCustomFieldsForSection = (sectionName: 'member' | 'financial' | 'fees' | 'cancellation' | 'notes') => {
    if (!customFields || customFields.length === 0) return null;
    const fields = customFields
      .filter(f => f.section === sectionName)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (fields.length === 0) return null;

    return (
      <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 bg-amber-50/60 p-3.5 rounded-2xl border border-amber-300/80 mt-2">
        <div className="col-span-1 md:col-span-2 text-xxs font-black text-amber-900 border-b border-amber-300/80 pb-1 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-amber-600" />
          <span>حقول مخصصة إضافية ({fields.length}):</span>
        </div>
        {fields.map(field => {
          const val = customValues[field.key] !== undefined ? customValues[field.key] : (field.type === 'number' ? 0 : field.type === 'checkbox' ? false : '');

          return (
            <div key={field.id} className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">{field.label}</label>
              {field.type === 'text' && (
                <input
                  type="text"
                  value={val}
                  onChange={(e) => handleCustomValueChange(field.key, e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-semibold focus:border-amber-400 focus:outline-none"
                />
              )}
              {field.type === 'number' && (
                <input
                  type="number"
                  value={val === 0 ? '' : val}
                  onChange={(e) => handleCustomValueChange(field.key, e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                  onFocus={(e) => e.target.select()}
                  placeholder="0"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-semibold focus:border-amber-400 focus:outline-none font-mono"
                />
              )}
              {field.type === 'date' && (
                <input
                  type="date"
                  value={val}
                  onChange={(e) => handleCustomValueChange(field.key, e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-semibold focus:border-amber-400 focus:outline-none"
                />
              )}
              {field.type === 'select' && (
                <select
                  value={val}
                  onChange={(e) => handleCustomValueChange(field.key, e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-semibold focus:border-amber-400 focus:outline-none cursor-pointer"
                >
                  <option value="">اختر {field.label}...</option>
                  {(field.options || []).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}
              {field.type === 'checkbox' && (
                <label className="flex items-center gap-2 cursor-pointer pt-1 font-semibold text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={!!val}
                    onChange={(e) => handleCustomValueChange(field.key, e.target.checked)}
                    className="h-4 w-4 text-amber-500 rounded focus:ring-amber-400 cursor-pointer"
                  />
                  <span>تفعيل {field.label}</span>
                </label>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Basic Fields States
  const [membershipNumber, setMembershipNumber] = useState('');
  const [memberName, setMemberName] = useState('');
  const [loanUnderName, setLoanUnderName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [externalId, setExternalId] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [subscriptionDate, setSubscriptionDate] = useState('');
  const [requestDate, setRequestDate] = useState(new Date().toISOString().split('T')[0]);
  const [membershipType, setMembershipType] = useState('Regular');
  const [club, setClub] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('نقدا');
  const [accountNumber, setAccountNumber] = useState('');
  const [documents, setDocuments] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellationReasonDetail, setCancellationReasonDetail] = useState('');
  const [salesPerson, setSalesPerson] = useState('');
  const [clubNote, setClubNote] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [committeeNo, setCommitteeNo] = useState('');
  const [committeeYear, setCommitteeYear] = useState('');
  const [currency, setCurrency] = useState('جم');
  const [isException, setIsException] = useState(false);
  const [exceptions, setExceptions] = useState('');
  const [exceptionType, setExceptionType] = useState('لا يوجد');

  // Financial inputs
  const [transferValue, setTransferValue] = useState(0);
  const [cashAmount, setCashAmount] = useState(0);
  const [visaAmount, setVisaAmount] = useState(0);
  const [checksPaid, setChecksPaid] = useState(0);
  const [checksUnpaid, setChecksUnpaid] = useState(0);
  const [annualRenewalDue, setAnnualRenewalDue] = useState(0);
  const [debtABKCompanies, setDebtABKCompanies] = useState(0);

  // Overrides Support (Admins or designated roles can bypass standard formulas)
  const [useAdminOverride, setUseAdminOverride] = useState(false);
  const [adminFeesOverride, setAdminFeesOverride] = useState(2500);
  const [useUsageOverride, setUseUsageOverride] = useState(false);
  const [usageFeeOverride, setUsageFeeOverride] = useState(0);
  const [useVisaOverride, setUseVisaOverride] = useState(false);
  const [visaFeeOverride, setVisaFeeOverride] = useState(0);

  // Attachments State
  const [attachments, setAttachments] = useState<RequestAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeViewerAttachment, setActiveViewerAttachment] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validation state
  const [errorMessage, setErrorMessage] = useState('');

  // Real-time server duplicate check state across all branches
  const [serverDuplicateInfo, setServerDuplicateInfo] = useState<{
    found: boolean;
    isAllowedReReview?: boolean;
    activeRequest?: any;
    rejectedRequests?: any[];
  } | null>(null);

  const isInternational = useMemo(() => {
    return (
      user?.role === 'international_user' ||
      membershipType === 'International' ||
      isInternationalRequest({ membershipType, paymentMethod, exceptions, currency })
    );
  }, [user?.role, membershipType, paymentMethod, exceptions, currency]);

  // Live real-time check against backend (covers all clubs & branches)
  useEffect(() => {
    const trimmed = (membershipNumber || '').trim();
    if (!trimmed || trimmed.length < 2) {
      setServerDuplicateInfo(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const token = localStorage.getItem('token') || '';
        const res = await fetch(`/api/requests/check-membership?number=${encodeURIComponent(trimmed)}&excludeId=${request?.id || ''}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.found) {
            setServerDuplicateInfo(data);
          } else {
            setServerDuplicateInfo(null);
          }
        }
      } catch (err) {
        console.error('Error checking duplicate membership from server:', err);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [membershipNumber, request]);

  // Pre-populate if editing
  useEffect(() => {
    if (request) {
      setMembershipNumber(request.membershipNumber || '');
      setMemberName(request.memberName || '');
      setLoanUnderName(request.loanUnderName || '');
      setNationalId(request.nationalId || '');
      setExternalId(request.externalId || '');
      setMobileNumber(request.mobileNumber || '');
      setSubscriptionDate(toInputDateStr(request.subscriptionDate));
      setRequestDate(toInputDateStr(request.requestDate) || toInputDateStr(new Date()));
      setMembershipType(request.membershipType || 'Regular');
      setClub(request.club || '');
      setPaymentMethod(request.paymentMethod || 'نقدا');
      setAccountNumber(request.accountNumber || '');
      setDocuments(request.documents || '');
      setCancellationReason(request.cancellationReason || '');
      setCancellationReasonDetail(request.cancellationReasonDetail || '');
      setSalesPerson(request.salesPerson || '');
      setClubNote(request.clubNote || '');
      setAdminNote(request.adminNote || '');
      setCommitteeNo(request.committeeNo || '');
      setCommitteeYear(request.committeeYear || '');
      setCurrency(request.currency || 'جم');
      const hasEx = !!request.isException || !!request.exceptions || (!!request.exceptionType && request.exceptionType !== 'لا يوجد' && request.exceptionType !== '—');
      setIsException(hasEx);
      setExceptions(request.exceptions || (hasEx && request.exceptionType && request.exceptionType !== 'لا يوجد' ? request.exceptionType : ''));
      setExceptionType(request.exceptionType || 'لا يوجد');

      setTransferValue(request.transferValue || 0);
      setCashAmount(request.cashAmount || 0);
      setVisaAmount(request.visaAmount || 0);
      setChecksPaid(request.checksPaid || 0);
      setChecksUnpaid(request.checksUnpaid || 0);
      setAnnualRenewalDue(request.annualRenewalDue || 0);
      setDebtABKCompanies(request.debtABKCompanies || 0);

      // Check if overrides were explicitly set
      if (request.adminFeesOverride !== undefined && request.adminFeesOverride !== null) {
        setUseAdminOverride(true);
        setAdminFeesOverride(Number(request.adminFeesOverride));
      } else {
        setUseAdminOverride(false);
        setAdminFeesOverride(request.adminFees ?? 2500);
      }
      if (request.usageFeeOverride !== undefined && request.usageFeeOverride !== null) {
        setUseUsageOverride(true);
        setUsageFeeOverride(Number(request.usageFeeOverride));
      } else {
        setUseUsageOverride(false);
        setUsageFeeOverride(request.usageFee ?? 0);
      }
      if (request.visaFeeOverride !== undefined && request.visaFeeOverride !== null) {
        setUseVisaOverride(true);
        setVisaFeeOverride(Number(request.visaFeeOverride));
      } else {
        setUseVisaOverride(false);
        setVisaFeeOverride(request.visaFees2Percent ?? 0);
      }
      setAttachments(Array.isArray(request.attachments) ? request.attachments : []);
    } else {
      setMobileNumber('');
      setCommitteeNo('');
      setCommitteeYear('');
      setAttachments([]);
      if (user.role === 'international_user') {
        setMembershipType('International');
        setCurrency('ريال سعودى');
        setPaymentMethod('عضوية دولية');
        setExceptions('عضوية دولية');
        setIsException(true);
        setExceptionType('عضوية دولية');
      } else {
        setMembershipType('Regular');
        setCurrency('جم');
      }
      // Set default club for club user or international user with club
      if (user.role === 'club' || (user.role === 'international_user' && user.club)) {
        const matchedClubInDropdown = dropdowns.clubs?.find((c: string) => isSameClub(c, user.club));
        setClub(matchedClubInDropdown || user.club || '');
      } else {
        setClub(dropdowns.clubs[0] || '');
      }
    }
  }, [request, user, dropdowns]);

  // Compute live values based on state inputs
  const liveCalcs = useMemo(() => {
    const input: CalculationInput = {
      subscriptionDate,
      requestDate,
      membershipType,
      paymentMethod,
      club,
      transferValue,
      cashAmount,
      visaAmount,
      checksPaid,
      checksUnpaid,
      annualRenewalDue,
      debtABKCompanies,
      documents,
      exceptions,
      exceptionType,
      clubNote,
      adminFeesOverride: useAdminOverride ? adminFeesOverride : undefined,
      usageFeeOverride: useUsageOverride ? usageFeeOverride : undefined,
      visaFeeOverride: useVisaOverride ? visaFeeOverride : undefined,
      refundAmount: request?.refundAmount
    };

    return calculateAllFields(input);
  }, [
    subscriptionDate, requestDate, membershipType, paymentMethod, club,
    transferValue, cashAmount, visaAmount, checksPaid, checksUnpaid,
    annualRenewalDue, debtABKCompanies, documents, exceptions, exceptionType, clubNote,
    useAdminOverride, adminFeesOverride, useUsageOverride, usageFeeOverride, useVisaOverride, visaFeeOverride
  ]);

  const getMembershipDuplicateInfo = (memNum: string) => {
    const cleanMem = (memNum || '').trim();
    if (!cleanMem) return { isDuplicate: false, isAllowedReReview: false, activeRequest: null, rejectedRequests: [] };

    const isRejectedReq = (r: any) => {
      const st = String(r.status || '').toLowerCase().trim();
      const res = String(r.result || '').toLowerCase().trim();
      return st === 'rejected' || st === 'مرفوض' || st.includes('مرفوض') || res === 'rejected' || res === 'مرفوض';
    };

    // 1. Check local existingRequests with robust normalization across case, hyphens, spaces
    const existingForMem = existingRequests.filter(
      r => isSameMembershipNumber(r.membershipNumber, cleanMem) && String(r.id || '') !== String(request?.id || '')
    );

    if (existingForMem.length > 0) {
      const activeRequest = existingForMem.find(r => !isRejectedReq(r));
      const rejectedRequests = existingForMem.filter(r => isRejectedReq(r));

      if (activeRequest) {
        return {
          isDuplicate: true,
          isAllowedReReview: false,
          activeRequest,
          rejectedRequests
        };
      }

      return {
        isDuplicate: true,
        isAllowedReReview: true,
        activeRequest: null,
        rejectedRequests
      };
    }

    // 2. Check server returned duplicate info (covers other clubs/branches)
    if (serverDuplicateInfo && serverDuplicateInfo.found) {
      return {
        isDuplicate: true,
        isAllowedReReview: !!serverDuplicateInfo.isAllowedReReview,
        activeRequest: serverDuplicateInfo.activeRequest || null,
        rejectedRequests: serverDuplicateInfo.rejectedRequests || []
      };
    }

    return {
      isDuplicate: false,
      isAllowedReReview: false,
      activeRequest: null,
      rejectedRequests: []
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (!membershipNumber.trim()) {
      setErrorMessage('رقم العضوية مطلوب');
      return;
    }

    // Duplicate Membership Number Validation
    const dupInfo = getMembershipDuplicateInfo(membershipNumber);
    if (dupInfo.isDuplicate && !dupInfo.isAllowedReReview && dupInfo.activeRequest) {
      const req = dupInfo.activeRequest;
      const statusText = req.status || req.result || 'قيد المراجعة';
      const reqDateText = formatDateCustom(req.requestDate || req.createdAt);
      const clubText = req.club || 'غير محدد';
      setErrorMessage(
        `لا يمكن تكرار رقم العضوية (${membershipNumber.trim()}). تم تقديم طلب إلغاء سابق لهذه العضوية من نادي (${clubText}) بتاريخ (${reqDateText}) وحالته (${statusText}).`
      );
      return;
    }

    const isReReview = dupInfo.isDuplicate && dupInfo.isAllowedReReview;
    let finalMemberName = memberName.trim();
    if (isReReview && !finalMemberName.includes('إعادة عرض')) {
      finalMemberName = `${finalMemberName} (إعادة عرض)`;
    }

    if (!memberName.trim()) {
      setErrorMessage('اسم العضو بالكامل مطلوب');
      return;
    }
    const pureMemberName = memberName.replace(/\(إعادة عرض\)/g, '').trim();
    if (!isArabicOnly(pureMemberName)) {
      setErrorMessage('اسم العضو يجب أن يحتوي على حروف عربية فقط (بدون أرقام أو حروف إنجليزية)');
      return;
    }
    const nameWords = pureMemberName.split(/\s+/).filter(Boolean);
    if (nameWords.length < 3) {
      setErrorMessage('اسم العضو يجب أن يكون اسماً ثلاثياً على الأقل باللغة العربية (مثال: أحمد محمد علي)');
      return;
    }

    if (!nationalId.trim() || nationalId.length !== 14 || isNaN(Number(nationalId))) {
      setErrorMessage('الرقم القومي غير صحيح (يجب أن يتكون من 14 رقماً)');
      return;
    }
    if (!externalId.trim()) {
      setErrorMessage('رقم العميل (External ID) مطلوب');
      return;
    }
    if (isInternational) {
      if (!isValidExternalId(externalId.trim(), true)) {
        setErrorMessage('رقم العميل (External ID) غير صحيح للعضويات الدولية، يجب أن يبدأ بـ 61');
        return;
      }
    } else {
      if (!isValidExternalId(externalId.trim(), false)) {
        setErrorMessage('رقم العميل (External ID) غير صحيح، يجب أن يبدأ بـ 1000');
        return;
      }
    }
    if (!mobileNumber.trim() || mobileNumber.length !== 11 || isNaN(Number(mobileNumber))) {
      setErrorMessage('رقم الموبايل غير صحيح (يجب أن يتكون من 11 رقماً)');
      return;
    }
    if (!subscriptionDate) {
      setErrorMessage('تاريخ الاشتراك مطلوب');
      return;
    }
    if (!requestDate) {
      setErrorMessage('تاريخ طلب الإلغاء مطلوب');
      return;
    }
    if (new Date(requestDate) < new Date(subscriptionDate)) {
      setErrorMessage('تاريخ الطلب لا يمكن أن يكون سابقاً لتاريخ الاشتراك بالنادي');
      return;
    }
    if (!salesPerson.trim()) {
      setErrorMessage('اسم موظف المبيعات المسؤول مطلوب لتحديد الحسابات');
      return;
    }
    const arabicRegex = /^[\u0600-\u06FF\s]+$/;
    if (!arabicRegex.test(salesPerson.trim())) {
      setErrorMessage('اسم موظف المبيعات يجب أن يحتوي على حروف عربية فقط');
      return;
    }
    const salesPersonWords = salesPerson.trim().split(/\s+/).filter(Boolean);
    if (salesPersonWords.length < 2) {
      setErrorMessage('اسم موظف المبيعات يجب أن يكون اسماً ثنائياً على الأقل (مثال: محمد أحمد)');
      return;
    }
    if (!cancellationReason || !cancellationReason.trim()) {
      setErrorMessage('سبب طلب الالغاء مطلوب');
      return;
    }
    if (!cancellationReasonDetail || !cancellationReasonDetail.trim()) {
      setErrorMessage('السبب بالتفصيل مطلوب');
      return;
    }
    if ((isCompanyPaymentMethod(paymentMethod) || paymentMethod === 'ABK' || paymentMethod === 'المشرق') && !loanUnderName.trim()) {
      setErrorMessage((paymentMethod === 'ABK' || paymentMethod === 'المشرق') ? `حقل (القرض باسم) إجباري عند اختيار طريقة الدفع ${paymentMethod}` : 'حقل (القرض باسم) إجباري عند اختيار طريقة الدفع عن طريق شركة تمويل');
      return;
    }
    if ((paymentMethod === 'ABK' || paymentMethod === 'المشرق') && !accountNumber.trim()) {
      setErrorMessage(`رقم الحساب البنكي (${paymentMethod}) إجباري عند اختيار طريقة الدفع ${paymentMethod}`);
      return;
    }
    if ((isCompanyPaymentMethod(paymentMethod) || isBankPaymentMethod(paymentMethod)) && (!transferValue || transferValue <= 0)) {
      setErrorMessage('قيمة التحويلة مطلوبة وإجبارية وأكبر من الصفر عند السداد عن طريق الشركات أو البنوك');
      return;
    }

    setErrorMessage('');

    // Package fields to return
    const payload = {
      membershipNumber,
      memberName: finalMemberName,
      isReReview: isReReview || request?.isReReview || false,
      loanUnderName,
      nationalId,
      externalId,
      mobileNumber,
      subscriptionDate,
      requestDate,
      membershipType,
      club,
      paymentMethod,
      accountNumber: (paymentMethod === 'ABK' || paymentMethod === 'المشرق') ? accountNumber : '',
      documents,
      attachments,
      cancellationReason,
      cancellationReasonDetail,
      salesPerson,
      clubNote,
      adminNote: adminNote.trim() || (request?.adminNote || ''),
      isException: !!isException || (exceptions.trim().length > 0) || (exceptionType !== 'لا يوجد' && exceptionType !== '' && exceptionType !== '—'),
      exceptions: exceptions.trim(),
      exceptionType: exceptionType || 'لا يوجد',
      committeeNo: committeeNo.trim() || (request?.committeeNo || ''),
      committeeYear: committeeYear.trim() || (request?.committeeYear || ''),
      currency: currency || 'جم',

      // Financials
      transferValue,
      cashAmount,
      visaAmount,
      checksPaid,
      checksUnpaid,
      annualRenewalDue,
      debtABKCompanies,

      // Overrides
      adminFeesOverride: useAdminOverride ? adminFeesOverride : null,
      usageFeeOverride: useUsageOverride ? usageFeeOverride : null,
      visaFeeOverride: useVisaOverride ? visaFeeOverride : null,

      // Dynamic Custom Values
      customValues,

      // Preserve status, statusDate, reviewed & receiptReceived
      status: request?.status || 'Pending',
      statusDate: request?.statusDate || '',
      reviewed: request?.reviewed ?? false,
      receiptReceived: request?.receiptReceived ?? false,
      receiptReceivedDate: request?.receiptReceivedDate || null
    };

    onSave(payload);
  };

  const isRequestReviewed = Boolean(request?.reviewed);

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleProcessIncomingAttachments = async (files: FileList | File[]) => {
    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const isAllowed = f.type.startsWith('image/') || f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
      if (isAllowed) {
        validFiles.push(f);
      }
    }

    if (validFiles.length === 0) {
      setErrorMessage('يرجى اختيار صور (JPG/PNG) أو ملفات PDF فقط');
      return;
    }

    setErrorMessage('');
    const newItems: RequestAttachment[] = [];

    for (const file of validFiles) {
      try {
        const fileData = await readFileAsDataUrl(file);
        newItems.push({
          id: `att-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
          fileName: file.name,
          fileType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
          fileSize: file.size,
          fileData,
          uploadedAt: new Date().toISOString(),
          uploadedBy: user?.username || 'user',
          uploaderName: user?.name || user?.username || 'مستخدم',
          uploaderRole: user?.role || 'club',
          uploaderClub: user?.club || club || 'المركز الرئيسي',
          category: 'طلب الإلغاء الموقع',
          notes: '',
          isLocked: false
        });
      } catch (err) {
        console.error('Failed reading attachment:', err);
      }
    }

    setAttachments(prev => [...prev, ...newItems]);
  };

  const handleRemoveAttachment = (attId: string) => {
    const target = attachments.find(a => a.id === attId);
    if (isRequestReviewed && target?.isLocked) {
      setErrorMessage('لا يمكن حذف هذا المستند نظراً لاعتماد مراجعة الأدمن للطلب لحماية السجلات المالية.');
      return;
    }
    setAttachments(prev => prev.filter(a => a.id !== attId));
  };

  const handleUpdateAttachmentCategory = (attId: string, category: string) => {
    setAttachments(prev => prev.map(a => a.id === attId ? { ...a, category } : a));
  };

  const handleUpdateAttachmentNotes = (attId: string, notes: string) => {
    setAttachments(prev => prev.map(a => a.id === attId ? { ...a, notes } : a));
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-right font-sans" dir="rtl">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-black text-slate-800">
            {isEditing ? `تعديل ملف إلغاء عضوية: ${membershipNumber}` : 'تسجيل طلب إلغاء عضوية جديد'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">يرجى تعبئة كافة الحقول المالية والتعاقدية بدقة لمطابقة الحسابات</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 px-3 py-1.5 rounded-lg cursor-pointer"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع للقائمة
        </button>
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border-r-4 border-rose-500 text-rose-700 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Grid: Info + Finance & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1: Core Fields & Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Member Info */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-50 pb-2">1. بيانات المشترك الأساسية</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{getLabel('membershipNumber', 'رقم العضوية')} <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={membershipNumber}
                  onChange={(e) => setMembershipNumber(e.target.value)}
                  placeholder="مثال: WD-10500"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 font-bold"
                />

                {/* Duplication check alerts */}
                {(() => {
                  const dupInfo = getMembershipDuplicateInfo(membershipNumber);
                  if (!dupInfo.isDuplicate) return null;

                  if (!dupInfo.isAllowedReReview && dupInfo.activeRequest) {
                    const req = dupInfo.activeRequest;
                    return (
                      <div className="mt-2 p-3 bg-rose-50 border-2 border-rose-300 rounded-xl text-rose-900 text-xs font-semibold space-y-2 shadow-sm">
                        <div className="flex items-center gap-1.5 font-bold text-rose-800 text-sm">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>تحذير: تم تقديم طلب إلغاء سابق لهذه العضوية!</span>
                        </div>
                        <div className="bg-white/90 p-2.5 rounded-lg border border-rose-200 text-xs space-y-1 text-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-600">اسم العضو:</span>
                            <span className="font-black text-rose-900">{req.memberName || 'غير محدد'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-600">النادي / الفرع:</span>
                            <span className="font-bold text-slate-900">{req.club || 'غير محدد'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-600">تاريخ الطلب:</span>
                            <span className="font-mono font-bold text-slate-900">{formatDateCustom(req.requestDate || req.createdAt)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-600">حالة الطلب:</span>
                            <span className="px-2 py-0.5 rounded bg-rose-100 border border-rose-300 text-rose-900 font-black">{req.status || req.result || 'قيد المراجعة'}</span>
                          </div>
                          {req.committeeNo && (
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-600">رقم اللجنة:</span>
                              <span className="font-mono font-bold text-slate-900">
                                {formatCommitteeWithYear(req.committeeNo, req.committeeYear, req.approvalDate || req.requestDate || req.createdAt)}
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] text-rose-700 leading-relaxed font-bold">
                          ⚠️ لا يمكن تكرار رقم العضوية طالما يوجد طلب نشط مسجل بالمنظومة.
                        </p>
                      </div>
                    );
                  }

                  if (dupInfo.isAllowedReReview) {
                    const lastRejected = dupInfo.rejectedRequests?.[0];
                    return (
                      <div className="mt-2 p-3 bg-amber-50 border-2 border-amber-300 rounded-xl text-amber-900 text-xs font-semibold space-y-1.5 shadow-sm">
                        <div className="flex items-center gap-1.5 font-bold text-amber-900 text-sm">
                          <Info className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>إعادة عرض (Re-review)</span>
                        </div>
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                          الطلب السابق لهذه العضوية ({membershipNumber}) حالته <strong>مرفوض (Rejected)</strong>{lastRejected?.club ? ` من فرع (${lastRejected.club})` : ''}.
                        </p>
                        <p className="text-[11px] text-amber-900 bg-amber-100/80 p-1.5 rounded border border-amber-200 font-bold">
                          ✓ مسموح بتكرار الرقم وسيتسجل الطلب الجديد ويكتب عليه تلقائياً: <strong>(إعادة عرض)</strong>.
                        </p>
                      </div>
                    );
                  }
                })()}
              </div>

              <div>
                {(() => {
                  const pureMemberNameWords = memberName
                    .replace(/\(إعادة عرض\)/g, '')
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean);
                  const hasStartedTyping = memberName.trim().length > 0;
                  const isComplete = pureMemberNameWords.length >= 3;

                  return (
                    <>
                      <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center justify-between">
                        <span>
                          {getLabel('memberName', 'اسم العضو (ثلاثي على الأقل)')} <span className="text-rose-500">*</span>
                        </span>
                        <span className="text-xxs text-slate-400 font-normal">
                          (عربي فقط - 3 مقاطع على الأقل)
                        </span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={memberName}
                          onChange={(e) => {
                            const val = e.target.value;
                            // Allow Arabic letters, spaces, and parenthesis for re-review tag
                            setMemberName(val.replace(/[^\u0600-\u06FF\s\(\)]/g, ''));
                          }}
                          placeholder="أدخل الاسم ثلاثياً بالعربية (مثال: محمود صبحي إبراهيم)"
                          className={`w-full text-xs bg-slate-50 border rounded-lg p-2.5 pl-8 focus:outline-none focus:ring-2 font-medium text-slate-800 transition-colors ${
                            hasStartedTyping && isComplete
                              ? 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-200'
                              : hasStartedTyping && !isComplete
                              ? 'border-amber-300 focus:border-amber-500 focus:ring-amber-200'
                              : 'border-slate-200 focus:border-amber-400 focus:ring-amber-100'
                          }`}
                        />
                        {hasStartedTyping && (
                          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center">
                            {isComplete ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                {pureMemberNameWords.length}/3
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Live feedback for entering 3-part name */}
                      {hasStartedTyping && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                          {isComplete ? (
                            <span className="text-emerald-700 font-bold flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              الاسم ثلاثي مكتمل ({pureMemberNameWords.length} مقاطع)
                            </span>
                          ) : (
                            <span className="text-amber-700 font-semibold flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              {pureMemberNameWords.length === 1
                                ? 'مطلوب إدخال الاسم ثلاثياً (تم إدخال كلمة واحدة فقط)'
                                : 'مطلوب إدخال الاسم ثلاثياً (تم إدخال كلمتين، يرجى إدخال اسم الجد/العائلة)'}
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {getLabel('externalId', 'رقم العميل')} (External ID){' '}
                  <span className="text-slate-400 font-normal">
                    {isInternational ? '(يبدأ بـ 61)' : '(يبدأ بـ 1000)'}
                  </span>{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value.trim())}
                  placeholder={isInternational ? 'مثال: 6100987' : 'مثال: 100012345'}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{getLabel('mobileNumber', 'رقم الموبايل')} (11 رقم) <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  maxLength={11}
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="01XXXXXXXXX"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{getLabel('subscriptionDate', 'تاريخ الاشتراك بالنادي')} <span className="text-rose-500">*</span></label>
                <input
                  type="date"
                  required
                  value={subscriptionDate}
                  onChange={(e) => setSubscriptionDate(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{getLabel('requestDate', 'تاريخ طلب الإلغاء')} <span className="text-rose-500">*</span></label>
                <input
                  type="date"
                  required
                  value={requestDate}
                  onChange={(e) => setRequestDate(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{getLabel('membershipType', 'نوع العضوية')}</label>
                <select
                  value={membershipType}
                  onChange={(e) => setMembershipType(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  {dropdowns.membershipTypes.map((t: string) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{getLabel('club', 'نادي الفرع المسجل به')}</label>
                <select
                  value={club}
                  disabled={user.role === 'club' || (user.role === 'international_user' && !!user.club)} // Club users locked to their branch
                  onChange={(e) => setClub(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-75"
                >
                  {dropdowns.clubs.map((c: string) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Committee Assignment Field */}
              <div className="md:col-span-2 bg-slate-50/70 p-4 rounded-xl border border-slate-200 mt-2 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-amber-500" />
                    {getLabel('cancellationCommittee', 'لجنة إلغاء العضويات (Cancellation Committee)')}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">تحدد تلقائياً بواسطة الأدمن المركزي للفرع</span>
                </div>
                {user.role === 'admin' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">رقم اللجنة</label>
                      <input
                        type="text"
                        value={committeeNo}
                        onChange={(e) => setCommitteeNo(e.target.value)}
                        placeholder="أدخل رقم اللجنة (مثال: 5)"
                        className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">تاريخ موافقة اللجنة</label>
                      <input
                        type="date"
                        value={committeeYear}
                        onChange={(e) => setCommitteeYear(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100 font-semibold flex items-center justify-between">
                    <span>اللجنة الحالية المخصصة:</span>
                    <span className="text-amber-600 font-bold bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/50 font-mono">
                      {isEditing 
                        ? (request?.committeeNo ? formatCommitteeWithYear(request.committeeNo, request.committeeYear, request.approvalDate || request.requestDate || request.createdAt) : 'غير محدد بعد') 
                        : 'سيتم الإدراج تلقائياً تحت اللجنة المفتوحة الحالية'}
                    </span>
                  </div>
                )}
              </div>

              {renderCustomFieldsForSection('member')}
            </div>
          </div>

          {/* Card 2: Payment Details */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-50 pb-2">2. تفاصيل وطريقة سداد الاشتراك</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">طريقة السداد / الدفع</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  {dropdowns.paymentMethods.map((pm: string) => (
                    <option key={pm} value={pm}>{pm}</option>
                  ))}
                </select>
              </div>

              {/* Show Account Number if payment Method is ABK or المشرق */}
              {(paymentMethod === 'ABK' || paymentMethod === 'المشرق') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    {getLabel('accountNumber', `رقم الحساب البنكي (${paymentMethod})`)} <span className="text-rose-500 font-bold">* (إجباري عند اختيار {paymentMethod})</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="أدخل رقم الحساب البنكي تحويل الفروقات"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              )}

              {/* Loan Holder Name Input (Free text, mandatory for ABK, المشرق or company payment methods) */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {getLabel('loanUnderName', 'القرض باسم')}
                  {(paymentMethod === 'ABK' || paymentMethod === 'المشرق') ? (
                    <span className="text-rose-500 font-bold mr-1"> * (إجباري عند السداد عن طريق {paymentMethod})</span>
                  ) : isCompanyPaymentMethod(paymentMethod) ? (
                    <span className="text-rose-500 font-bold mr-1"> * (إجباري عند السداد عن طريق شركة تمويل)</span>
                  ) : (
                    <span className="text-slate-400 font-normal mr-1"> (اختياري)</span>
                  )}
                </label>
                <input
                  type="text"
                  required={isCompanyPaymentMethod(paymentMethod) || paymentMethod === 'ABK' || paymentMethod === 'المشرق'}
                  value={loanUnderName}
                  onChange={(e) => setLoanUnderName(e.target.value)}
                  placeholder={
                    (paymentMethod === 'ABK' || paymentMethod === 'المشرق')
                      ? `أدخل اسم صاحب القرض / ${paymentMethod}...`
                      : isCompanyPaymentMethod(paymentMethod)
                      ? "أدخل اسم الشركة / جهة التمويل..."
                      : "أدخل اسم الجهة أو الشركة إن وجد..."
                  }
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              {/* National ID Field - Moved right next to Loan Under Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {getLabel('nationalId', 'الرقم القومي')} (14 رقم) <span className="text-rose-500">*</span>
                  {(isCompanyPaymentMethod(paymentMethod) || paymentMethod === 'ABK' || paymentMethod === 'المشرق') && (
                    <span className="text-amber-800 font-bold mr-1"> (الخاص بصاحب القرض)</span>
                  )}
                </label>
                <input
                  type="text"
                  required
                  maxLength={14}
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  placeholder="2951218010XXXX"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{getLabel('documents', 'المستندات المرفقة')} (اختياري)</label>
                <input
                  type="text"
                  value={documents}
                  onChange={(e) => setDocuments(e.target.value)}
                  placeholder="مثال: البطاقة + إقرار التنازل + إيصالات الدفع"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {getLabel('cancellationReason', 'سبب طلب الالغاء')} <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 font-bold text-slate-800"
                >
                  <option value="">اختر سبب طلب الالغاء...</option>
                  {(dropdowns?.cancellationReasons || []).map((r: string) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">السبب بالتفصيل <span className="text-rose-500">*</span></label>
                <textarea
                  required
                  rows={2}
                  value={cancellationReasonDetail}
                  onChange={(e) => setCancellationReasonDetail(e.target.value)}
                  placeholder="يرجى كتابة سبب الإلغاء بالتفصيل لتسهيل المراجعة الإدارية"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {getLabel('salesPerson', 'اسم موظف المبيعات المسؤول')} <span className="text-slate-500 font-normal">(الاسم ثنائي)</span> <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={salesPerson}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\u0600-\u06FF\s]/g, '');
                    setSalesPerson(value);
                  }}
                  placeholder="مثال: محمد أحمد"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 font-bold text-slate-800"
                />
              </div>

              {renderCustomFieldsForSection('cancellation')}
            </div>
          </div>

          {/* Card 3: Notes & Comments */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 border-b border-slate-100 pb-2 flex items-center justify-between">
              <span className="font-extrabold text-slate-700">3. {getLabel('notesSection', 'الملاحظات')}</span>
              <span className="text-[11px] font-medium text-slate-400">ملاحظات الفرع والتوجيهات</span>
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {getLabel('clubNote', 'الملاحظات (ملاحظات مسؤول الفرع / النادي)')}
                </label>
                <textarea
                  rows={2}
                  value={clubNote}
                  onChange={(e) => setClubNote(e.target.value)}
                  placeholder="أدخل أي ملاحظات خاصة بتسلم أصل العضوية أو الإيصالات أو تفاصيل الفرع..."
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 text-slate-800"
                />
              </div>

              {user.role === 'admin' && (
                <div className="space-y-4 bg-amber-50/70 p-4 rounded-2xl border border-amber-200 mt-2">
                  <div className="flex items-center gap-2 border-b border-amber-200 pb-2">
                    <span className="font-black text-xs text-amber-900">إدارة حقول الاستثناءات والقرارات (خاصة بـ الأدمن):</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <span className="font-bold text-amber-950">
                        {getLabel('adminNote', 'ملاحظات الادمن')}
                      </span>
                      <span className="text-xxs text-amber-800/70 font-normal">
                        (مراجعة الإدارة المالية / المقر الرئيسي)
                      </span>
                    </label>
                    <textarea
                      rows={2}
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      placeholder="أدخل ملاحظات الأدمن أو مراجع الإدارة المالية..."
                      className="w-full text-xs bg-white border border-amber-200/80 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 text-slate-800"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Field 1: الاستثناء */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">الاستثناء (وجود استثناء بالطلب)</label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-lg border border-slate-200 hover:border-amber-400 transition-all">
                          <input
                            type="checkbox"
                            checked={isException}
                            onChange={(e) => {
                              setIsException(e.target.checked);
                              if (!e.target.checked) setExceptions('');
                            }}
                            className="h-4 w-4 text-amber-500 rounded focus:ring-amber-400 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-800">تفعيل خيار (يوجد استثناء)</span>
                        </label>

                        {isException && (
                          <input
                            type="text"
                            value={exceptions}
                            onChange={(e) => setExceptions(e.target.value)}
                            placeholder="اكتب تفاصيل / أسباب الاستثناء هنا..."
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                        )}
                      </div>
                    </div>

                    {/* Field 2: نوع الاستثناء */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">نوع الاستثناء</label>
                      <select
                        value={exceptionType}
                        onChange={(e) => {
                          const val = e.target.value;
                          setExceptionType(val);
                          if (val && val !== 'لا يوجد' && val !== '—') {
                            setIsException(true);
                            if (!exceptions.trim()) {
                              setExceptions(val);
                            }
                          }
                        }}
                        className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                      >
                        {(dropdowns?.exceptions || ["لا يوجد", "حالة انسانية", "جهة سيادية", "حل مشكلة", "بدون رد اى مبلغ"]).map((ex: string) => (
                          <option key={ex} value={ex}>{ex}</option>
                        ))}
                      </select>
                      {(exceptionType.includes('بدون رد') || exceptions.includes('بدون رد')) && (
                        <div className="mt-1.5 p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] font-bold flex items-center gap-1.5">
                          <span>⚠️</span>
                          <span>استثناء بدون رد أي مبلغ: سيتم تلقائياً تصفير قيمة الاسترداد والرد للعميل (0 ج.م).</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Custom Exception Amounts Panel */}
                  <div className="bg-white/90 border border-amber-200 rounded-xl p-3.5 space-y-3 mt-3 shadow-2xs">
                    <div className="text-xs font-black text-amber-900 flex items-center justify-between border-b border-amber-100 pb-2">
                      <span className="flex items-center gap-1.5">
                        <Calculator className="w-4 h-4 text-amber-600" />
                        تحديد مبالغ وقيم الاستثناء (إعفاء جزئي أو كلي):
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* 1. مقابل الانتفاع */}
                      <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-200/70 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={useUsageOverride}
                            onChange={(e) => {
                              setUseUsageOverride(e.target.checked);
                              if (!e.target.checked) setUsageFeeOverride(0);
                            }}
                            className="h-4 w-4 text-amber-500 rounded focus:ring-amber-400 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-800">إدخال قيمة خاصة لمقابل الانتفاع</span>
                        </label>
                        {useUsageOverride ? (
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-600">القيمة المستحقة لمقابل الانتفاع بعد الاستثناء (ج.م):</label>
                            <input
                              type="number"
                              value={usageFeeOverride === 0 ? '' : usageFeeOverride}
                              onChange={(e) => setUsageFeeOverride(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                              onFocus={(e) => e.target.select()}
                              placeholder="0"
                              className="w-full text-xs bg-white border border-amber-300 rounded-lg p-2 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            <p className="text-[10px] text-amber-800 font-bold">
                              {usageFeeOverride === 0 ? '✓ إعفاء تام (0 ج.م)' : `✓ استثناء جزئي: سيتم احتساب ${usageFeeOverride.toLocaleString()} ج.م فقط.`}
                            </p>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-500 leading-normal">
                            عند تفعيل هذا الخيار يمكنك تحديد أي مبلغ لمقابل الانتفاع (0 للإعفاء التام، أو مبلغ معين لإعفاء جزئي).
                          </p>
                        )}
                      </div>

                      {/* 2. المصاريف الإدارية */}
                      <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-200/70 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={useAdminOverride}
                            onChange={(e) => {
                              setUseAdminOverride(e.target.checked);
                              if (!e.target.checked) setAdminFeesOverride(2500);
                            }}
                            className="h-4 w-4 text-amber-500 rounded focus:ring-amber-400 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-800">إدخال قيمة خاصة للمصاريف الإدارية</span>
                        </label>
                        {useAdminOverride ? (
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-600">القيمة المستحقة للمصاريف الإدارية بعد الاستثناء (ج.م):</label>
                            <input
                              type="number"
                              value={adminFeesOverride === 0 ? '' : adminFeesOverride}
                              onChange={(e) => setAdminFeesOverride(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                              onFocus={(e) => e.target.select()}
                              placeholder="2500"
                              className="w-full text-xs bg-white border border-amber-300 rounded-lg p-2 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            <p className="text-[10px] text-amber-800 font-bold">
                              {adminFeesOverride === 0 ? '✓ إعفاء تام من المصاريف الإدارية (0 ج.م)' : `✓ استثناء/تعديل: سيتم خصم ${adminFeesOverride.toLocaleString()} ج.م كمصاريف إدارية.`}
                            </p>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-500 leading-normal">
                            القيمة القياسية للمصاريف الإدارية هي 2,500 ج.م، فّعِل هذا الخيار لإعفاء كامل (0 ج.م) أو جزئي.
                          </p>
                        )}
                      </div>

                      {/* 3. مصاريف الفيزا 2% */}
                      <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-200/70 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={useVisaOverride}
                            onChange={(e) => {
                              setUseVisaOverride(e.target.checked);
                              if (!e.target.checked) setVisaFeeOverride(0);
                            }}
                            className="h-4 w-4 text-amber-500 rounded focus:ring-amber-400 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-800">إدخال قيمة خاصة لمصاريف الفيزا (2%)</span>
                        </label>
                        {useVisaOverride ? (
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-600">القيمة المستحقة لمصاريف الفيزا بعد الاستثناء (ج.م):</label>
                            <input
                              type="number"
                              value={visaFeeOverride === 0 ? '' : visaFeeOverride}
                              onChange={(e) => setVisaFeeOverride(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                              onFocus={(e) => e.target.select()}
                              placeholder="0"
                              className="w-full text-xs bg-white border border-amber-300 rounded-lg p-2 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            <p className="text-[10px] text-amber-800 font-bold">
                              {visaFeeOverride === 0 ? '✓ إعفاء تام من مصاريف الفيزا (0 ج.م)' : `✓ استثناء/تعديل: سيتم خصم ${visaFeeOverride.toLocaleString()} ج.م فقط كعمولة فيزا.`}
                            </p>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-500 leading-normal">
                            تحسب تلقائياً 2% من مبلغ الفيزا، فّعِل هذا الخيار لتحديد قيمة استثناء خاصة أو إعفاء كامل.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {renderCustomFieldsForSection('notes')}
            </div>
          </div>

          {/* Card 3.5: Attachments & Official Documents (صور / ملفات PDF) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-amber-500" />
                <span>المرفقات والمستندات الرسمية (صور / ملفات PDF)</span>
                <span className="px-2 py-0.5 rounded-full text-xxs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  {attachments.length} مرفق
                </span>
              </h3>
              {isRequestReviewed && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  تمت مراجعة الطلب (المستندات السابقة محمية)
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500">
              يمكنك رفع استمارة طلب الإلغاء الموقعة، وصور بطاقة الرقم القومي، وإيصالات السداد، والتقارير الطبية/الاستثناءات بصيغة صور أو ملفات PDF.
            </p>

            {/* Dropzone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleProcessIncomingAttachments(e.dataTransfer.files);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                isDragOver 
                  ? 'border-amber-500 bg-amber-50/80' 
                  : 'border-slate-200 hover:border-amber-400 hover:bg-slate-50/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleProcessIncomingAttachments(e.target.files);
                  }
                }}
                className="hidden"
              />
              <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                <Upload className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-800">اسحب وأفلت الملفات هنا أو انقر لاختيارها من جهازك</span>
                <span className="text-slate-400 block text-[11px] mt-0.5">يدعم ملفات الصور (JPG, PNG) وملفات PDF</span>
              </div>
            </div>

            {/* Attachments List */}
            {attachments.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="text-xs font-bold text-slate-700">المستندات المرفقة الحالية ({attachments.length}):</div>
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {attachments.map((att) => {
                    const isPdf = att.fileType === 'application/pdf' || att.fileName.toLowerCase().endsWith('.pdf');
                    const isLocked = isRequestReviewed && att.isLocked !== false;

                    return (
                      <div 
                        key={att.id}
                        className={`p-3 rounded-xl border text-xs space-y-2 transition-all ${
                          isLocked 
                            ? 'bg-slate-50/80 border-slate-200' 
                            : 'bg-amber-50/30 border-amber-200/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-600 shrink-0">
                              {isPdf ? <FileText className="w-4 h-4 text-rose-500" /> : <ImageIcon className="w-4 h-4 text-blue-500" />}
                            </div>
                            <div className="truncate">
                              <span className="font-bold text-slate-800 truncate block">{att.fileName}</span>
                              <span className="text-[10px] text-slate-500">{formatFileSize(att.fileSize)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setActiveViewerAttachment(att)}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                              title="معاينة"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {isLocked ? (
                              <span 
                                className="p-1.5 text-slate-400 cursor-not-allowed"
                                title="تمت مراجعة الطلب بواسطة الأدمن (Reviewed) - المستند محمي ولا يمكن حذفه"
                              >
                                <Lock className="w-4 h-4" />
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRemoveAttachment(att.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="حذف المرفق"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Category & Notes editing */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-1">نوع المستند:</label>
                            <select
                              value={att.category || 'طلب الإلغاء الموقع'}
                              disabled={isLocked}
                              onChange={(e) => handleUpdateAttachmentCategory(att.id, e.target.value)}
                              className="w-full text-xs bg-white border border-slate-200 rounded-lg p-1.5 font-bold text-slate-800 focus:outline-none focus:border-amber-400 disabled:bg-slate-100 disabled:cursor-not-allowed"
                            >
                              <option value="طلب الإلغاء الموقع">طلب الإلغاء الموقع</option>
                              <option value="صورة بطاقة الرقم القومي">صورة بطاقة الرقم القومي</option>
                              <option value="إيصال سداد / مخالصة">إيصال سداد / مخالصة</option>
                              <option value="إقرار وتنازل معتمد">إقرار وتنازل معتمد</option>
                              <option value="تقرير طبي / مستندات استثناء">تقرير طبي / مستندات استثناء</option>
                              <option value="شيكات / مستندات بنكية">شيكات / مستندات بنكية</option>
                              <option value="أخرى">أخرى</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-1">ملاحظة / وصف:</label>
                            <input
                              type="text"
                              value={att.notes || ''}
                              disabled={isLocked}
                              onChange={(e) => handleUpdateAttachmentNotes(att.id, e.target.value)}
                              placeholder="وصف مختصر للورقة..."
                              className="w-full text-xs bg-white border border-slate-200 rounded-lg p-1.5 text-slate-800 focus:outline-none focus:border-amber-400 disabled:bg-slate-100 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Financial Grid & Instantly calculated results */}
        <div className="space-y-6">
          
          {/* Card 4: Financial Inputs */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-50 pb-2">4. المبالغ والبيانات المالية للتعاقد</h3>
            
            <div className="space-y-3">
              {/* Currency Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {getLabel('currency', 'العملة (Currency)')} <span className="text-rose-500">*</span>
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 font-bold text-slate-800 cursor-pointer"
                >
                  {(dropdowns?.currencies || ['جم', 'ريال سعودى', 'دولار']).map((c: string) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center justify-between">
                  <span>
                    {getLabel('transferValue', 'قيمة التحويلة')}
                    {(isCompanyPaymentMethod(paymentMethod) || isBankPaymentMethod(paymentMethod)) && (
                      <span className="text-rose-500 font-bold mr-1">*</span>
                    )}
                  </span>
                  {(isCompanyPaymentMethod(paymentMethod) || isBankPaymentMethod(paymentMethod)) && (
                    <span className="text-xxs text-rose-600 font-semibold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                      إجباري مع الشركات والبنوك
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  required={isCompanyPaymentMethod(paymentMethod) || isBankPaymentMethod(paymentMethod)}
                  value={transferValue === 0 ? '' : transferValue}
                  onChange={(e) => setTransferValue(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                  onFocus={(e) => e.target.select()}
                  placeholder="0"
                  className={`w-full text-xs bg-slate-50 border rounded-lg p-2 focus:outline-none focus:ring-2 text-left font-mono ${
                    (isCompanyPaymentMethod(paymentMethod) || isBankPaymentMethod(paymentMethod)) && (!transferValue || transferValue <= 0)
                      ? 'border-amber-300 focus:border-amber-500 focus:ring-amber-200'
                      : 'border-slate-200 focus:border-amber-400 focus:ring-amber-100'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">مقدم نقدي</label>
                  <input
                    type="number"
                    value={cashAmount === 0 ? '' : cashAmount}
                    onChange={(e) => setCashAmount(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-amber-400 text-left font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">مقدم فيزا</label>
                  <input
                    type="number"
                    value={visaAmount === 0 ? '' : visaAmount}
                    onChange={(e) => setVisaAmount(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-amber-400 text-left font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">الشيكات المسددة</label>
                  <input
                    type="number"
                    value={checksPaid === 0 ? '' : checksPaid}
                    onChange={(e) => setChecksPaid(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-amber-400 text-left font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">شيكات غير مسددة</label>
                  <input
                    type="number"
                    value={checksUnpaid === 0 ? '' : checksUnpaid}
                    onChange={(e) => setChecksUnpaid(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-amber-400 text-left font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">التجديد السنوي المستحق</label>
                <input
                  type="number"
                  value={annualRenewalDue === 0 ? '' : annualRenewalDue}
                  onChange={(e) => setAnnualRenewalDue(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                  onFocus={(e) => e.target.select()}
                  placeholder="0"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-amber-400 text-left font-mono"
                />
              </div>

              {/* Show Debt field as info or admin editable if ABK, المشرق or Company */}
              {(paymentMethod === 'ABK' || paymentMethod === 'المشرق' || isCompanyPaymentMethod(paymentMethod) || ['ABK', 'Premium', 'Aman', 'Ollin', 'Contact', 'One Finance'].includes(paymentMethod)) && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    {getLabel('debtABKCompanies', 'مديونية العضو (المرسلة من البنك/الشركة)')}
                  </label>
                  {user.role === 'admin' ? (
                    <input
                      type="number"
                      value={debtABKCompanies === 0 ? '' : debtABKCompanies}
                      onChange={(e) => setDebtABKCompanies(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                      placeholder="0"
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-amber-400 text-left font-mono font-bold"
                    />
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs flex items-center justify-between">
                      <span className="text-slate-500 font-medium text-[11px] flex items-center gap-1.5">
                        <Info className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <span>المديونية المسجلة:</span>
                      </span>
                      {debtABKCompanies > 0 ? (
                        <span className="font-bold text-amber-800 font-mono text-xs">{debtABKCompanies.toLocaleString()} ج.م</span>
                      ) : (
                        <span className="text-slate-400 text-[11px] font-medium">(معلومة يُدخلها الأدمن المركزي)</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {renderCustomFieldsForSection('financial')}
            {renderCustomFieldsForSection('fees')}
          </div>

          {/* Card 5: Calculated live Preview */}
          {(() => {
            const pmStr = (paymentMethod || '').trim();
            const formIsCompany = !['نقدا', 'نقداً', 'شيكات', 'فيزا', 'ABK', 'عضوية دولية', 'المشرق', 'QNB', 'تحويل بنكي'].includes(pmStr);
            const formIsChecks = pmStr === 'شيكات';
            const formIsABK = pmStr === 'ABK';
            const formIsBank = ['المشرق', 'QNB', 'تحويل بنكي'].includes(pmStr);
            const formAdvancePaid = cashAmount + visaAmount;

            let formRefundAmountDisplay = '';
            if (formIsCompany) {
              formRefundAmountDisplay = debtABKCompanies > 0 ? `${debtABKCompanies.toLocaleString()} ج.م` : 'في انتظار المديونية';
            } else if (formIsABK) {
              formRefundAmountDisplay = debtABKCompanies > 0 ? `${debtABKCompanies.toLocaleString()} ج.م` : 'في انتظار المديونية';
            } else if (typeof liveCalcs.refundAmount === 'number') {
              formRefundAmountDisplay = `${liveCalcs.refundAmount.toLocaleString()} ج.م`;
            } else if (typeof liveCalcs.refundAmount === 'string' && liveCalcs.refundAmount) {
              formRefundAmountDisplay = liveCalcs.refundAmount;
            } else if (formIsChecks) {
              const netCheckRefund = Math.max(0, (formAdvancePaid + checksPaid) - liveCalcs.discountAmount);
              formRefundAmountDisplay = `${netCheckRefund.toLocaleString()} ج.م`;
            } else {
              const netRefund = Math.max(0, liveCalcs.subscriptionValue - liveCalcs.discountAmount);
              formRefundAmountDisplay = `${netRefund.toLocaleString()} ج.م`;
            }

            let formRefundToClientDisplay = '';
            if (formIsCompany) {
              if (typeof liveCalcs.refundToClient === 'number') {
                formRefundToClientDisplay = `${liveCalcs.refundToClient.toLocaleString()} ج.م`;
              } else if (typeof liveCalcs.refundToClient === 'string' && liveCalcs.refundToClient !== 'Not Required') {
                formRefundToClientDisplay = liveCalcs.refundToClient;
              } else if (debtABKCompanies > 0) {
                const companyNetBase = liveCalcs.subscriptionValue || transferValue;
                const clientRefundCalc = Math.max(0, companyNetBase - debtABKCompanies - liveCalcs.discountAmount);
                formRefundToClientDisplay = `${clientRefundCalc.toLocaleString()} ج.م`;
              } else {
                formRefundToClientDisplay = 'في انتظار المديونية';
              }
            } else if (formIsChecks) {
              const clientRefund = Math.max(0, (formAdvancePaid + checksPaid) - liveCalcs.discountAmount);
              formRefundToClientDisplay = `${clientRefund.toLocaleString()} ج.م`;
            } else if (formIsABK || formIsBank) {
              const clientRefund = Math.max(0, transferValue - liveCalcs.discountAmount);
              formRefundToClientDisplay = `${clientRefund.toLocaleString()} ج.م`;
            } else {
              const clientRefund = Math.max(0, liveCalcs.subscriptionValue - liveCalcs.discountAmount);
              formRefundToClientDisplay = `${clientRefund.toLocaleString()} ج.م`;
            }

            return (
              <div className="bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-950 p-5 rounded-2xl text-white border border-neutral-800 shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider border-b border-neutral-800 pb-2.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Calculator className="h-4 w-4 text-amber-400" />
                    5. البيانات المالية المباشرة (حسب طريقة الدفع: {paymentMethod || 'نقدا'})
                  </span>
                  <span className="text-[10px] bg-amber-400/10 text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-400/20 font-bold">
                    حساب تلقائي
                  </span>
                </h3>

                <div className="space-y-2 text-xs">
                  {/* طريقة الدفع ومدة الاستهلاك */}
                  <div className="grid grid-cols-2 gap-2 bg-neutral-800/40 p-2.5 rounded-xl border border-neutral-800">
                    <div>
                      <span className="text-neutral-400 block text-[10px]">طريقة السداد:</span>
                      <span className="font-bold text-amber-300">{paymentMethod || 'نقدا'}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block text-[10px]">مدة الاستهلاك:</span>
                      <span className="font-bold text-slate-200">{liveCalcs.days} يوم ({liveCalcs.type})</span>
                    </div>
                  </div>

                  {/* البيانات المترتبة على طريقة الدفع */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between border-b border-neutral-800/80 pb-1.5">
                      <span className="text-neutral-400">إجمالي قيمة الاشتراك بالعقد:</span>
                      <span className="font-mono font-bold text-slate-100">{liveCalcs.subscriptionValue.toLocaleString()} ج.م</span>
                    </div>

                    {formAdvancePaid > 0 && (
                      <div className="flex justify-between border-b border-neutral-800/80 pb-1.5">
                        <span className="text-neutral-400">المقدم المسدد (نقدي + فيزا):</span>
                        <span className="font-mono font-bold text-slate-200">
                          {formAdvancePaid.toLocaleString()} ج.م
                          {(cashAmount > 0 || visaAmount > 0) && (
                            <span className="text-[10px] text-neutral-400 font-normal mr-1">
                              (نقداً: {cashAmount.toLocaleString()} | فيزا: {visaAmount.toLocaleString()})
                            </span>
                          )}
                        </span>
                      </div>
                    )}

                    {(formIsCompany || formIsABK || formIsBank) && (
                      <div className="flex justify-between border-b border-neutral-800/80 pb-1.5">
                        <span className="text-neutral-400">قيمة التحويلة:</span>
                        <span className="font-mono font-bold text-amber-300">{transferValue.toLocaleString()} ج.م</span>
                      </div>
                    )}

                    {formIsChecks && (
                      <>
                        <div className="flex justify-between border-b border-neutral-800/80 pb-1.5">
                          <span className="text-neutral-400">إجمالي الشيكات المسددة:</span>
                          <span className="font-mono font-bold text-emerald-400">{checksPaid.toLocaleString()} ج.م</span>
                        </div>
                        <div className="flex justify-between border-b border-neutral-800/80 pb-1.5">
                          <span className="text-neutral-400">إجمالي الشيكات الغير مسددة (تُلغى):</span>
                          <span className="font-mono font-bold text-rose-400">{checksUnpaid.toLocaleString()} ج.م</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* المستقطعات الحالية */}
                  <div className="bg-neutral-800/30 p-2.5 rounded-xl border border-neutral-800/60 space-y-1.5 mt-2">
                    <div className="text-[10px] text-neutral-400 font-bold mb-1 border-b border-neutral-800/60 pb-1 flex justify-between">
                      <span>بيان المستقطعات والخصومات:</span>
                      <span className="text-amber-400 font-mono">الإجمالي: {liveCalcs.discountAmount.toLocaleString()} ج.م</span>
                    </div>

                    <div className="flex justify-between text-neutral-300">
                      <span>• المصاريف الإدارية:</span>
                      <span className="font-mono font-semibold">
                        {liveCalcs.adminFees.toLocaleString()} ج.م
                        {useAdminOverride && <span className="text-amber-400 text-[10px] mr-1">(تعديل يدوي)</span>}
                      </span>
                    </div>

                    <div className="flex justify-between text-neutral-300">
                      <span>• مقابل الانتفاع المحسوب:</span>
                      <span className="font-mono font-semibold">
                        {liveCalcs.usageFee.toLocaleString()} ج.م
                        {useUsageOverride && <span className="text-amber-400 text-[10px] mr-1">(تعديل يدوي)</span>}
                      </span>
                    </div>

                    {liveCalcs.visaFees2Percent > 0 && (
                      <div className="flex justify-between text-neutral-300">
                        <span>• مصاريف الفيزا (2%):</span>
                        <span className="font-mono font-semibold">
                          {liveCalcs.visaFees2Percent.toLocaleString()} ج.م
                          {useVisaOverride && <span className="text-amber-400 text-[10px] mr-1">(تعديل يدوي)</span>}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* النتائج النهائية الصافية */}
                  <div className="pt-2 space-y-2">
                    {/* مبلغ الاسترداد / مديونية الجهة الممولة */}
                    <div className="bg-amber-400/10 border border-amber-400/20 p-3 rounded-xl">
                      <div className="text-[10px] text-amber-300/80 font-bold mb-0.5">
                        {formIsCompany ? 'مديونية الشركة / الجهة الممولة:' : formIsABK ? 'مبلغ الاسترداد لـ ABK:' : 'مبلغ الاسترداد الإجمالي (قيمة الشيك الصافي):'}
                      </div>
                      <div className="text-base font-black text-amber-400 font-mono">
                        {formRefundAmountDisplay}
                      </div>
                    </div>

                    {/* مبلغ الرد للعميل */}
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                      <div className="text-[10px] text-emerald-300/80 font-bold mb-0.5">
                        المبلغ المرتجع للعميل (صافي مستحق الصرف):
                      </div>
                      <div className="text-base font-black text-emerald-400 font-mono">
                        {formRefundToClientDisplay}
                      </div>
                    </div>

                    {/* فرق مديونية ABK إن وجد */}
                    {formIsABK && liveCalcs.abkDebtDifference !== 'Not Required' && (
                      <div className="bg-blue-500/10 border border-blue-500/20 p-2.5 rounded-xl flex justify-between items-center text-xs">
                        <span className="text-blue-300 font-bold text-[11px]">فرق مديونية ABK:</span>
                        <span className="font-mono font-bold text-blue-400">
                          {typeof liveCalcs.abkDebtDifference === 'number'
                            ? (liveCalcs.abkDebtDifference >= 0 
                              ? `لصالح العميل (+${liveCalcs.abkDebtDifference.toLocaleString()} ج.م)` 
                              : `على العميل سداده للبنك (${liveCalcs.abkDebtDifference.toLocaleString()} ج.م)`)
                            : liveCalcs.abkDebtDifference}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl cursor-pointer"
        >
          إلغاء
        </button>
        <button
          type="submit"
          className="px-6 py-2.5 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-black text-sm rounded-xl flex items-center gap-1.5 shadow-md hover:shadow cursor-pointer"
        >
          <Check className="h-4 w-4" />
          {isEditing ? 'حفظ وتعديل بيانات الطلب' : 'تسجيل وإرسال الطلب للمراجعة'}
        </button>
      </div>

      {/* Document Viewer Modal for instant preview */}
      {activeViewerAttachment && (
        <DocumentViewerModal
          attachment={activeViewerAttachment}
          onClose={() => setActiveViewerAttachment(null)}
          canDelete={!isRequestReviewed || !activeViewerAttachment.isLocked}
          onDelete={(attId) => {
            handleRemoveAttachment(attId);
            setActiveViewerAttachment(null);
          }}
        />
      )}
    </form>
  );
}
