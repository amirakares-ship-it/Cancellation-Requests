import * as XLSX from 'xlsx';

// Utility helper functions for calculations

export interface ExceptionRule {
  id?: string;
  name: string;
  exemptAdminFee: boolean;
  exemptUsageFee: boolean;
  exemptVisaFee: boolean;
}

export interface PaymentFormulaOption {
  id: string;
  label: string; // Display name in dropdown
  value: string; // Formula Key / Identifier
  description: string; // Explanation text
  expression?: string; // Custom calculation expression (e.g. "subscriptionValue - discountAmount")
  isCustom?: boolean;
}

export interface CustomPaymentMethodFormula {
  id: string;
  methodName: string;
  badge: string;
  selectedFormula: string;
  options: PaymentFormulaOption[];
}

export const DEFAULT_PAYMENT_METHOD_OPTIONS: Record<string, PaymentFormulaOption[]> = {
  cash: [
    {
      id: 'cash_sub',
      value: 'subscriptionValue',
      label: 'قيمة الاشتراك - إجمالي الخصم (افتراضي)',
      description: 'قيمة الاشتراك - إجمالي مبلغ الخصم',
      expression: 'subscriptionValue - discountAmount'
    },
    {
      id: 'cash_trans',
      value: 'transferValue',
      label: 'قيمة التحويلة - إجمالي الخصم',
      description: 'قيمة التحويلة - إجمالي الخصم',
      expression: 'transferValue - discountAmount'
    },
    {
      id: 'cash_coll',
      value: 'collected',
      label: 'المبلغ المحصل فعلياً (نقدي + فيزا) - إجمالي الخصم',
      description: '(المبلغ النقدي + مبلغ الفيزا) - إجمالي الخصم',
      expression: '(cashAmount + visaAmount) - discountAmount'
    }
  ],
  checks: [
    {
      id: 'chk_all',
      value: 'all_checks',
      label: '(الشيكات المسددة + الشيكات الغير مسددة + المقدم) - الخصم (معادلة إجمالي الشيكات)',
      description: '(الشيكات المسددة + الشيكات الغير مسددة + المقدم) - الخصم',
      expression: 'advancePaid + checksPaid + checksUnpaid - discountAmount'
    },
    {
      id: 'chk_paid',
      value: 'paid_only',
      label: '(الشيكات المسددة + المقدم) - الخصم فقط',
      description: '(الشيكات المسددة + المقدم) - الخصم',
      expression: 'advancePaid + checksPaid - discountAmount'
    },
    {
      id: 'chk_sub',
      value: 'subscriptionValue',
      label: 'قيمة الاشتراك - إجمالي الخصم',
      description: 'قيمة الاشتراك - الخصم',
      expression: 'subscriptionValue - discountAmount'
    }
  ],
  banks: [
    {
      id: 'bank_trans',
      value: 'transferValue',
      label: 'قيمة التحويلة - الخصم (افتراضي)',
      description: 'قيمة التحويلة - الخصم | (فرق ABK = مديونية البنك - مبلغ الاسترداد)',
      expression: 'transferValue - discountAmount'
    },
    {
      id: 'bank_sub',
      value: 'subscriptionValue',
      label: 'قيمة الاشتراك - الخصم',
      description: 'قيمة الاشتراك - الخصم | (فرق ABK = مديونية البنك - مبلغ الاسترداد)',
      expression: 'subscriptionValue - discountAmount'
    },
    {
      id: 'bank_coll',
      value: 'collected',
      label: 'المبلغ المحصل (تحويلة + مقدم) - الخصم',
      description: '(قيمة التحويلة + المقدم) - الخصم',
      expression: 'transferValue + advancePaid - discountAmount'
    }
  ],
  companies: [
    {
      id: 'comp_net_sub',
      value: 'net_subscription',
      label: 'رد للعميل = MAX(قيمة الاشتراك - المديونية - الخصم, 0) [المعادلة الافتراضية]',
      description: 'رد للعميل = MAX(قيمة الاشتراك - المديونية - الخصم, 0)',
      expression: 'subscriptionValue - debtABKCompanies - discountAmount'
    },
    {
      id: 'comp_net_trans',
      value: 'net_transfer',
      label: 'رد للعميل = MAX(قيمة التحويلة - المديونية - الخصم, 0)',
      description: 'رد للعميل = MAX(قيمة التحويلة - المديونية - الخصم, 0)',
      expression: 'transferValue - debtABKCompanies - discountAmount'
    },
    {
      id: 'comp_debt_only',
      value: 'debt_only',
      label: 'استرداد شركة التمويل = مديونية شركة التمويل فقط',
      description: 'المبلغ المسترد = مديونية شركة التمويل (إن وجدت)',
      expression: 'debtABKCompanies'
    }
  ]
};

export interface FormulasConfig {
  cutoffDate: string; // e.g. "2026-07-01"
  oldDaysThreshold: number; // 90
  oldDaysLabel: string; // "اقل من 3 شهور"
  newDaysThreshold: number; // 30
  newDaysLabel: string; // "اقل من شهر"
  adminFeesStandard: number; // 2500
  visaFeePercentage: number; // 0.02
  usageFeeExemptTypes: string[]; // ["اقل من 3 شهور", "اقل من شهر", "International"]
  usageFeeExemptClubs: string[]; // ["Tanta", "طنطا"]
  usageFeeExemptDocuments: string[]; // ["جهة سيادية"]
  usageFeeExemptExceptions?: boolean; // true by default
  cashRefundFormula?: string;
  checksRefundFormula?: string;
  bankRefundFormula?: string;
  companyRefundFormula?: string;
  regularUsagePercentages: number[]; // [0.10, 0.20, 0.30, 0.40, 0.50]
  smartUsagePercentages: number[]; // [0.15, 0.30, 0.45, 0.60, 0.75]
  usageFeeBase: 'transferValue' | 'subscriptionValue';
  exceptionRules?: ExceptionRule[];
  paymentMethodOptions?: {
    cash?: PaymentFormulaOption[];
    checks?: PaymentFormulaOption[];
    banks?: PaymentFormulaOption[];
    companies?: PaymentFormulaOption[];
    [key: string]: PaymentFormulaOption[] | undefined;
  };
  customPaymentMethods?: CustomPaymentMethodFormula[];
}

export const DEFAULT_FORMULAS_CONFIG: FormulasConfig = {
  cutoffDate: "2026-07-01",
  oldDaysThreshold: 90,
  oldDaysLabel: "اقل من 3 شهور",
  newDaysThreshold: 30,
  newDaysLabel: "اقل من شهر",
  adminFeesStandard: 2500,
  visaFeePercentage: 0.02,
  usageFeeExemptTypes: ["اقل من 3 شهور", "اقل من شهر", "International"],
  usageFeeExemptClubs: ["Tanta", "طنطا"],
  usageFeeExemptDocuments: ["جهة سيادية"],
  usageFeeExemptExceptions: true,
  cashRefundFormula: "subscriptionValue",
  checksRefundFormula: "all_checks",
  bankRefundFormula: "transferValue",
  companyRefundFormula: "net_subscription",
  regularUsagePercentages: [0.10, 0.20, 0.30, 0.40, 0.50],
  smartUsagePercentages: [0.15, 0.30, 0.45, 0.60, 0.75],
  usageFeeBase: "subscriptionValue",
  exceptionRules: [
    { id: '1', name: 'عضوية دولية', exemptAdminFee: true, exemptUsageFee: true, exemptVisaFee: false },
    { id: '2', name: 'بدون خصم مصاريف ادارية', exemptAdminFee: true, exemptUsageFee: false, exemptVisaFee: true },
    { id: '3', name: 'جهة سيادية', exemptAdminFee: false, exemptUsageFee: true, exemptVisaFee: false }
  ],
  paymentMethodOptions: DEFAULT_PAYMENT_METHOD_OPTIONS,
  customPaymentMethods: []
};

export function parseAnyDate(val: any): Date | null {
  if (val === null || val === undefined || val === '') return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;

  if (typeof val === 'number') {
    if (val > 10000 && val < 100000) {
      return new Date(Math.round((val - 25569) * 86400 * 1000));
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  const str = String(val).trim();
  if (!str) return null;

  if (/^\d{5,6}$/.test(str)) {
    const num = parseFloat(str);
    if (num > 10000 && num < 100000) {
      return new Date(Math.round((num - 25569) * 86400 * 1000));
    }
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const parts = str.split('T')[0].split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return new Date(y, m, d);
  }

  const ENGLISH_MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const MONTH_NAME_MAP: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    january: 0, february: 1, march: 2, april: 3, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    "يناير": 0, "فبراير": 1, "مارس": 2, "أبريل": 3, "ابريل": 3, "مايو": 4, "يونيو": 5, "يوليو": 6, "أغسطس": 7, "اغسطس": 7, "سبتمبر": 8, "أكتوبر": 9, "اكتوبر": 9, "نوفمبر": 10, "ديسمبر": 11
  };

  const tokens = str.split(/[\/\-\.\s,]+/);
  if (tokens.length >= 3) {
    const t0 = tokens[0].toLowerCase();
    const t1 = tokens[1].toLowerCase();
    const t2 = tokens[2].toLowerCase();

    if (MONTH_NAME_MAP[t1] !== undefined) {
      const day = parseInt(t0, 10);
      const month = MONTH_NAME_MAP[t1];
      let year = parseInt(t2, 10);
      if (year < 100) year += 2000;
      if (!isNaN(day) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }

    if (MONTH_NAME_MAP[t1] !== undefined && parseInt(t0, 10) > 1000) {
      const year = parseInt(t0, 10);
      const month = MONTH_NAME_MAP[t1];
      const day = parseInt(t2, 10);
      if (!isNaN(day) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }

    const n0 = parseInt(t0, 10);
    const n1 = parseInt(t1, 10);
    const n2 = parseInt(t2, 10);

    if (!isNaN(n0) && !isNaN(n1) && !isNaN(n2)) {
      if (n0 > 1000) {
        return new Date(n0, n1 - 1, n2);
      } else if (n2 > 1000) {
        if (n1 <= 12) {
          return new Date(n2, n1 - 1, n0);
        } else if (n0 <= 12) {
          return new Date(n2, n0 - 1, n1);
        }
      }
    }
  }

  const fallback = new Date(str);
  if (!isNaN(fallback.getTime()) && fallback.getFullYear() > 1900 && fallback.getFullYear() < 2100) {
    return fallback;
  }

  return null;
}

export function formatDateCustom(val: any): string {
  const d = parseAnyDate(val);
  if (!d) return val ? String(val) : '';
  const ENGLISH_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = String(d.getDate()).padStart(2, '0');
  const monthStr = ENGLISH_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${monthStr}-${year}`;
}

export function formatDateNumeric(val: any): string {
  if (!val) return '';
  const d = parseAnyDate(val);
  if (!d) return String(val);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export function formatCommitteeYear(val: any, fallbackDate?: any): string {
  if (val !== null && val !== undefined && val !== '' && val !== '—') {
    const str = String(val).trim();
    if (/^(19|20)\d{2}$/.test(str)) {
      return str;
    }
    const match = str.match(/(20\d{2})/);
    if (match) return match[1];

    const d = parseAnyDate(val);
    if (d && !isNaN(d.getTime())) {
      const y = d.getFullYear();
      if (y >= 2000 && y <= 2100) return String(y);
    }
  }

  if (fallbackDate !== null && fallbackDate !== undefined && fallbackDate !== '' && fallbackDate !== '—') {
    const str = String(fallbackDate).trim();
    if (/^(19|20)\d{2}$/.test(str)) {
      return str;
    }
    const match = str.match(/(20\d{2})/);
    if (match) return match[1];

    const d = parseAnyDate(fallbackDate);
    if (d && !isNaN(d.getTime())) {
      const y = d.getFullYear();
      if (y >= 2000 && y <= 2100) return String(y);
    }
  }

  return '2026';
}

export function formatCommitteeWithYear(committeeNo: any, committeeYear?: any, fallbackDate?: any): string {
  if (!committeeNo || committeeNo === '—' || committeeNo === '') return '—';
  const cleanNo = String(committeeNo).trim();
  const year = formatCommitteeYear(committeeYear, fallbackDate);
  return `لجنة رقم ${cleanNo} (${year})`;
}

export function toInputDateStr(val: any): string {
  const d = parseAnyDate(val);
  if (!d) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function calculateDays(subscriptionDateStr: any, requestDateStr: any): number {
  if (!subscriptionDateStr || !requestDateStr) return 0;
  const subDate = parseAnyDate(subscriptionDateStr);
  const reqDate = parseAnyDate(requestDateStr);
  if (!subDate || !reqDate) return 0;
  const diffTime = reqDate.getTime() - subDate.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

export function determineType(
  days: number, 
  subscriptionDateStr?: any, 
  formulasConfig: FormulasConfig = DEFAULT_FORMULAS_CONFIG
): { type: string; type2: 'Less 3 months' | 'Over 3 months' | 'Less 1 month' | 'Over 1 month' } {
  const subDate = parseAnyDate(subscriptionDateStr) || new Date();
  const cutoff = parseAnyDate(formulasConfig.cutoffDate) || new Date("2026-07-01");
  const isAfterCutoff = subDate.getTime() >= cutoff.getTime();

  if (isAfterCutoff) {
    if (days <= (formulasConfig.newDaysThreshold ?? 30)) {
      return { type: formulasConfig.newDaysLabel || 'اقل من شهر', type2: 'Less 1 month' };
    } else {
      const yearsCount = Math.ceil(days / 365);
      return { type: `${yearsCount} سنة`, type2: 'Over 1 month' };
    }
  } else {
    if (days <= (formulasConfig.oldDaysThreshold ?? 90)) {
      return { type: formulasConfig.oldDaysLabel || 'اقل من 3 شهور', type2: 'Less 3 months' };
    } else {
      const yearsCount = Math.ceil(days / 365);
      return { type: `${yearsCount} سنة`, type2: 'Over 3 months' };
    }
  }
}

export interface CalculationInput {
  subscriptionDate: string;
  requestDate: string;
  membershipType: string;
  paymentMethod: string;
  club: string;
  transferValue: number;
  cashAmount: number;
  visaAmount: number;
  checksPaid: number;
  checksUnpaid: number;
  annualRenewalDue: number;
  debtABKCompanies: number;
  documents?: string;
  exceptions?: string;
  exceptionType?: string;
  clubNote?: string;
  adminFeesOverride?: number;
  usageFeeOverride?: number;
  visaFeeOverride?: number;
  refundAmount?: number | string;
}

export function parseSmartNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') {
    return isNaN(val) || !isFinite(val) ? 0 : val;
  }
  let s = String(val).trim();
  if (!s) return 0;

  // Convert Eastern Arabic digits ٠-٩ to Western 0-9
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  for (let i = 0; i < arabicDigits.length; i++) {
    s = s.split(arabicDigits[i]).join(String(i));
  }

  // Check if string is negative (e.g. "-500" or "(500)")
  const isNegative = /^\s*\(.*\)\s*$/.test(s) || /^\s*-/.test(s);

  // Remove currency words and symbols
  s = s.replace(/ج\.?م|جم|جنيه|EGP|LE|L\.E\.|\$|ريال|USD/gi, '');

  // Handle Arabic comma '،' or decimal separator '٫'
  s = s.replace(/٫/g, '.').replace(/،/g, ',');

  // If there's both comma and dot, e.g. "1,250.50", remove comma
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/,/g, '');
  } else if (s.includes(',')) {
    const parts = s.split(',');
    if (parts.length > 1 && parts[parts.length - 1].length === 3) {
      s = parts.join('');
    } else if (parts.length === 2 && parts[1].length <= 2) {
      s = parts.join('.');
    } else {
      s = parts.join('');
    }
  }

  // Remove everything except digits, minus, and dot
  s = s.replace(/[^0-9\.]/g, '');
  if (!s) return 0;

  const num = parseFloat(s);
  if (isNaN(num) || !isFinite(num)) return 0;
  return isNegative ? -Math.abs(num) : num;
}

export function parseNum(val: any): number {
  return parseSmartNumber(val);
}

export function normalizeHeaderKey(key: string): string {
  if (!key) return '';
  let s = String(key).trim().toLowerCase();
  // Remove BOM, invisible characters, non-breaking spaces
  s = s.replace(/[\uFEFF\u00A0\u200B-\u200D\u2060]/g, '');
  // Remove Arabic diacritics / tashkeel
  s = s.replace(/[\u064B-\u065F\u0670]/g, '');
  // Unify Arabic letters:
  s = s.replace(/[أإآ]/g, 'ا');
  s = s.replace(/[ة]/g, 'ه');
  s = s.replace(/[ى]/g, 'ي');
  // Remove all punctuation, slashes, dashes, brackets, spaces
  s = s.replace(/[\s\/\_\\\-\+\.\,\:\(\)\[\]\{\}\#\*\?]/g, '');
  return s;
}

export function extractDebtRowFields(row: any, rowIndex?: number, rawHeaders?: string[], rawRowArray?: any[]): {
  membershipNumber: string;
  loanUnderName: string;
  nationalId: string;
  paymentMethod: string;
  debtABKCompanies: number;
} {
  const keys = Object.keys(row || {});
  let membershipNumber = '';
  let loanUnderName = '';
  let nationalId = '';
  let paymentMethod = '';
  let debtABKCompanies = 0;
  let debtFound = false;

  // 1. Iterate through all keys of the row object
  for (const key of keys) {
    const rawVal = row[key];
    if (rawVal === undefined || rawVal === null) continue;
    const normKey = normalizeHeaderKey(key);
    const strVal = String(rawVal).trim();

    // Check Membership Number
    if (!membershipNumber) {
      if (
        normKey.includes('عضوي') ||
        normKey.includes('عضويه') ||
        normKey.includes('كود') ||
        normKey.includes('membership') ||
        normKey.includes('memberno') ||
        normKey.includes('membernum') ||
        normKey.includes('cardno') ||
        normKey === 'رقم' ||
        normKey === 'code'
      ) {
        if (!normKey.includes('مديوني') && !normKey.includes('دين') && !normKey.includes('debt') && !normKey.includes('قومي') && !normKey.includes('بطاق') && !normKey.includes('حساب')) {
          membershipNumber = strVal;
        }
      }
    }

    // Check Debt (ABK & Companies)
    if (!debtFound) {
      if (
        normKey.includes('مديوني') ||
        normKey.includes('مديونيه') ||
        normKey.includes('مديونيات') ||
        normKey.includes('دين') ||
        normKey.includes('debt') ||
        normKey.includes('balance') ||
        normKey.includes('outstanding') ||
        normKey.includes('متبقي') ||
        (normKey.includes('abk') && !normKey.includes('account') && !normKey.includes('حساب'))
      ) {
        debtABKCompanies = parseSmartNumber(rawVal);
        debtFound = true;
      }
    }

    // Check Loan Under Name
    if (!loanUnderName) {
      if (
        normKey.includes('قرض') ||
        normKey.includes('باسم') ||
        normKey.includes('بإسم') ||
        normKey.includes('loanname') ||
        normKey.includes('loanundername') ||
        normKey.includes('loan')
      ) {
        loanUnderName = strVal;
      }
    }

    // Check National ID
    if (!nationalId) {
      if (
        normKey.includes('قومي') ||
        normKey.includes('قومى') ||
        normKey.includes('بطاق') ||
        normKey.includes('nationalid') ||
        normKey.includes('national') ||
        normKey.includes('nid') ||
        normKey.includes('ssn')
      ) {
        nationalId = strVal;
      }
    }

    // Check Payment Method
    if (!paymentMethod) {
      if (
        normKey.includes('دفع') ||
        normKey.includes('سداد') ||
        normKey.includes('طريق') ||
        normKey.includes('payment') ||
        normKey.includes('method')
      ) {
        paymentMethod = strVal;
      }
    }
  }

  // 2. Positional Fallback if 2D array / raw row is available or keys are __EMPTY
  if (rawRowArray && Array.isArray(rawRowArray)) {
    // Template standard columns: Col 0: Seq, Col 1: Membership No, Col 2: Loan Name, Col 3: National ID, Col 4: Payment Method, Col 5: Debt
    if (!membershipNumber && rawRowArray[1] !== undefined) {
      membershipNumber = String(rawRowArray[1]).trim();
    }
    if (!debtFound && rawRowArray[5] !== undefined) {
      debtABKCompanies = parseSmartNumber(rawRowArray[5]);
      debtFound = true;
    }
    if (!loanUnderName && rawRowArray[2] !== undefined) {
      loanUnderName = String(rawRowArray[2]).trim();
    }
    if (!nationalId && rawRowArray[3] !== undefined) {
      nationalId = String(rawRowArray[3]).trim();
    }
    if (!paymentMethod && rawRowArray[4] !== undefined) {
      paymentMethod = String(rawRowArray[4]).trim();
    }
  }

  // 3. Fallback for __EMPTY keys generated by SheetJS when headers are missing
  if (!membershipNumber) {
    for (const key of keys) {
      if (key.startsWith('__EMPTY')) {
        const val = String(row[key] || '').trim();
        if (val && /^[0-9A-Za-z\-_]+$/.test(val) && val.length >= 2 && val.length <= 15) {
          membershipNumber = val;
          break;
        }
      }
    }
  }

  if (!debtFound) {
    // If debt wasn't found by explicit column name, search remaining keys for a numeric value
    for (const key of keys) {
      const val = row[key];
      const parsed = parseSmartNumber(val);
      if (parsed > 0 && String(val).trim() !== membershipNumber) {
        debtABKCompanies = parsed;
        debtFound = true;
        break;
      }
    }
  }

  return {
    membershipNumber: String(membershipNumber).trim(),
    loanUnderName: String(loanUnderName).trim(),
    nationalId: String(nationalId).trim(),
    paymentMethod: String(paymentMethod).trim(),
    debtABKCompanies
  };
}

export function parseDebtWorkbook(data: Uint8Array): Array<{
  membershipNumber: string;
  loanUnderName?: string;
  nationalId?: string;
  paymentMethod?: string;
  debtABKCompanies: number;
}> {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  // 1. Read sheet as JSON objects
  const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  
  // 2. Read as 2D array of rows to handle header offset or title rows
  const raw2D: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Check if header row is located below row 0 (e.g. row 1 or 2)
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(raw2D.length, 10); i++) {
    const row = raw2D[i];
    if (Array.isArray(row)) {
      const rowStr = row.map(c => normalizeHeaderKey(String(c))).join(' ');
      if (
        (rowStr.includes('عضوي') || rowStr.includes('membership') || rowStr.includes('كود')) &&
        (rowStr.includes('مديوني') || rowStr.includes('دين') || rowStr.includes('debt') || rowStr.includes('سداد') || rowStr.includes('دفع') || rowStr.includes('قومي'))
      ) {
        headerRowIdx = i;
        break;
      }
    }
  }

  let effectiveRows: any[] = [];
  if (headerRowIdx > 0) {
    effectiveRows = XLSX.utils.sheet_to_json(sheet, { range: headerRowIdx, defval: '' });
  } else {
    effectiveRows = rawRows;
  }

  const mappedList: Array<{
    membershipNumber: string;
    loanUnderName: string;
    nationalId: string;
    paymentMethod: string;
    debtABKCompanies: number;
  }> = [];

  for (let i = 0; i < effectiveRows.length; i++) {
    const row = effectiveRows[i];
    const raw2DRow = (headerRowIdx >= 0 && raw2D[headerRowIdx + 1 + i]) ? raw2D[headerRowIdx + 1 + i] : (raw2D[i + 1] || []);
    const parsed = extractDebtRowFields(row, i, undefined, raw2DRow);

    if (parsed.membershipNumber) {
      const normMNum = normalizeHeaderKey(parsed.membershipNumber);
      // Skip header repetitions
      if (normMNum === 'رقمعضويه' || normMNum === 'رقمعضوية' || normMNum === 'membershipnumber') {
        continue;
      }
      mappedList.push(parsed);
    }
  }

  return mappedList;
}

export function isCompanyPaymentMethod(method: string): boolean {
  if (!method) return false;
  const nonCompanyMethods = ["نقدا", "نقداً", "شيكات", "فيزا", "ABK", "عضوية دولية", "المشرق", "QNB", "تحويل بنكي"];
  return !nonCompanyMethods.includes(method.trim());
}

export function isBankPaymentMethod(method: string | undefined | null): boolean {
  if (!method) return false;
  const trimmed = method.trim();
  const lower = trimmed.toLowerCase();
  return (
    ['ABK', 'المشرق', 'QNB', 'تحويل بنكي'].includes(trimmed) ||
    trimmed.includes('بنك') ||
    lower.includes('bank') ||
    trimmed.includes('ABK') ||
    trimmed.includes('المشرق') ||
    trimmed.includes('QNB')
  );
}

export function isInternationalRequest(r: any): boolean {
  if (!r) return false;
  const mType = String(r.membershipType || '').toLowerCase().trim();
  const pMethod = String(r.paymentMethod || '').toLowerCase().trim();
  const exc = String(r.exceptions || '').toLowerCase().trim();
  const curr = String(r.currency || '').toLowerCase().trim();

  // 1. Membership Type checks
  if (
    mType === 'international' ||
    mType === 'عضوية دولية' ||
    mType === 'دولي' ||
    mType === 'دولية' ||
    mType.includes('international') ||
    mType.includes('دولية') ||
    mType.includes('دولي')
  ) {
    return true;
  }

  // 2. Payment Method checks
  if (
    pMethod === 'international' ||
    pMethod === 'عضوية دولية' ||
    pMethod.includes('عضوية دولية') ||
    pMethod.includes('international')
  ) {
    return true;
  }

  // 3. Exceptions checks
  if (
    exc.includes('عضوية دولية') ||
    exc.includes('international')
  ) {
    return true;
  }

  // 4. Currency checks (Saudi Riyal / USD / Foreign currencies)
  if (
    curr.includes('ريال') ||
    curr === 'sar' ||
    curr.includes('سعودي') ||
    curr.includes('سعودى') ||
    curr === 'usd' ||
    curr.includes('دولار')
  ) {
    return true;
  }

  return false;
}

export function calculateAllFields(input: CalculationInput, formulasConfig: FormulasConfig = DEFAULT_FORMULAS_CONFIG) {
  const cashAmount = parseNum(input.cashAmount);
  const visaAmount = parseNum(input.visaAmount);
  const transferValue = parseNum(input.transferValue);
  const checksPaid = parseNum(input.checksPaid);
  const checksUnpaid = parseNum(input.checksUnpaid);
  const annualRenewalDue = parseNum(input.annualRenewalDue);
  const debtABKCompanies = parseNum(input.debtABKCompanies);

  const rawAdv = parseNum((input as any).advancePaid);
  const advancePaid = (cashAmount + visaAmount) > 0 ? (cashAmount + visaAmount) : rawAdv;

  const rawSubVal = parseNum((input as any).subscriptionValue);
  const sumComponents = transferValue + cashAmount + visaAmount + checksPaid + checksUnpaid;
  const subscriptionValue = sumComponents > 0 ? sumComponents : rawSubVal;

  const days = calculateDays(input.subscriptionDate, input.requestDate);
  const { type, type2 } = determineType(days, input.subscriptionDate, formulasConfig);

  // Administrative Fees
  const isCompany = isCompanyPaymentMethod(input.paymentMethod);
  const stdAdminFee = formulasConfig.adminFeesStandard ?? 2500;
  
  // Exception rules lookup
  const rules = formulasConfig.exceptionRules || [
    { id: '1', name: 'عضوية دولية', exemptAdminFee: true, exemptUsageFee: true, exemptVisaFee: false },
    { id: '2', name: 'بدون خصم مصاريف ادارية', exemptAdminFee: true, exemptUsageFee: false, exemptVisaFee: true },
    { id: '3', name: 'جهة سيادية', exemptAdminFee: false, exemptUsageFee: true, exemptVisaFee: false }
  ];

  const fullExceptionText = (
    (input.exceptionType || "") + " " +
    (input.exceptions || "") + " " +
    (input.clubNote || "") + " " +
    ((input as any).adminNote || "") + " " +
    (input.documents || "")
  ).toLowerCase();

  const isNoRefundException = Boolean(
    fullExceptionText.includes("بدون رد اى مبلغ") ||
    fullExceptionText.includes("بدون رد أي مبلغ") ||
    fullExceptionText.includes("بدون رد اى مبالغ") ||
    fullExceptionText.includes("بدون رد أي مبالغ") ||
    fullExceptionText.includes("بدون رد مبلغ") ||
    fullExceptionText.includes("بدون رد") ||
    (input.exceptionType && (input.exceptionType.includes("بدون رد") || input.exceptionType.includes("بدون رد اى مبلغ") || input.exceptionType.includes("بدون رد أي مبلغ"))) ||
    (input.exceptions && (input.exceptions.includes("بدون رد") || input.exceptions.includes("بدون رد اى مبلغ") || input.exceptions.includes("بدون رد أي مبلغ")))
  );

  const isAdminExemptByRule = rules.some(r => r.exemptAdminFee && r.name && fullExceptionText.includes(r.name.toLowerCase()));
  const isVisaExemptByRule = rules.some(r => r.exemptVisaFee && r.name && fullExceptionText.includes(r.name.toLowerCase()));
  const isUsageExemptByRule = rules.some(r => r.exemptUsageFee && r.name && fullExceptionText.includes(r.name.toLowerCase()));
  
  // Base net amount for company calculation
  const companyNetBase = (formulasConfig.companyRefundFormula === "net_transfer" && transferValue > 0) 
    ? transferValue 
    : (subscriptionValue > 0 ? subscriptionValue : (transferValue > 0 ? transferValue : sumComponents));
  const net_amount = isCompany ? Math.max(0, companyNetBase - debtABKCompanies) : 0;

  let calculatedAdminFees = stdAdminFee;

  if (
    input.membershipType === "International" ||
    isAdminExemptByRule ||
    fullExceptionText.includes("عضوية دولية") ||
    fullExceptionText.includes("بدون خصم مصاريف ادارية")
  ) {
    calculatedAdminFees = 0;
  } else if (isCompany) {
    // Company rule 1: MIN(net_amount, admin_fee_limit)
    calculatedAdminFees = Math.max(0, Math.min(net_amount, stdAdminFee));
  }

  const adminFees = input.adminFeesOverride !== undefined && input.adminFeesOverride !== null && (input.adminFeesOverride as any) !== '' && !isNaN(Number(input.adminFeesOverride))
    ? parseNum(input.adminFeesOverride)
    : calculatedAdminFees;

  // Visa Fee 2% (Calculated before Usage Fee because Usage Fee depends on Visa Fee in Company rules)
  const visaFeePct = formulasConfig.visaFeePercentage ?? 0.02;
  const calculatedVisaFee = visaAmount * visaFeePct;
  let visaFees2Percent = calculatedVisaFee;

  if (input.visaFeeOverride !== undefined && input.visaFeeOverride !== null && (input.visaFeeOverride as any) !== '' && !isNaN(Number(input.visaFeeOverride))) {
    visaFees2Percent = parseNum(input.visaFeeOverride);
  } else if (isVisaExemptByRule || fullExceptionText.includes("بدون خصم مصاريف ادارية")) {
    visaFees2Percent = 0;
  } else if (isCompany) {
    // Company rule: If net_amount < 2500 or adminFees < 2500, visa_fee = 0
    if (adminFees < 2500 || net_amount < 2500) {
      visaFees2Percent = 0;
    } else {
      // Remaining after admin fees
      const remAfterAdmin = net_amount - adminFees;
      visaFees2Percent = Math.max(0, Math.min(remAfterAdmin, calculatedVisaFee));
    }
  }

  // Usage Fee (مقابل الانتفاع)
  let calculatedUsageFee = 0;
  const exemptTypes = formulasConfig.usageFeeExemptTypes || ["اقل من 3 شهور", "اقل من شهر", "International"];
  const exemptClubs = formulasConfig.usageFeeExemptClubs || ["Tanta", "طنطا"];
  const exemptDocs = formulasConfig.usageFeeExemptDocuments || ["جهة سيادية"];
  const allowExceptionNotesExempt = formulasConfig.usageFeeExemptExceptions !== false;

  const isTypeExempt = exemptTypes.includes(type) || (exemptTypes.includes("International") && input.membershipType === "International");
  const isClubExempt = exemptClubs.some(c => {
    if (!c) return false;
    const cLower = c.toLowerCase().trim();
    const reqClub = (input.club || "").toLowerCase().trim();
    if (!reqClub) return false;
    if (cLower === reqClub) return true;
    if ((cLower.includes('tanta') || cLower.includes('طنطا')) && (reqClub.includes('tanta') || reqClub.includes('طنطا'))) return true;
    return false;
  });
  const isDocExempt = exemptDocs.some(d => d && ((input.documents || "").includes(d) || (input.exceptions || "").includes(d)));
  const usageExemptionKeywords = ["إعفاء من مقابل الانتفاع", "اعفاء من مقابل الانتفاع", "معفى من مقابل الانتفاع", "معفي من مقابل الانتفاع", "إعفاء من الانتفاع", "اعفاء من الانتفاع"];
  const isExceptionExempt = allowExceptionNotesExempt && (
    input.usageFeeOverride === 0 ||
    isUsageExemptByRule ||
    fullExceptionText.includes("عضوية دولية") ||
    fullExceptionText.includes("جهة سيادية") ||
    usageExemptionKeywords.some(kw => fullExceptionText.includes(kw))
  );

  if (isTypeExempt || isClubExempt || isDocExempt || isExceptionExempt) {
    calculatedUsageFee = 0;
  } else {
    const yearsCount = Math.ceil(days / 365);
    let percentage = 0;
    const regP = formulasConfig.regularUsagePercentages || [0.10, 0.20, 0.30, 0.40, 0.50];
    const smartP = formulasConfig.smartUsagePercentages || [0.15, 0.30, 0.45, 0.60, 0.75];

    if (input.membershipType === "Regular") {
      percentage = regP[Math.min(yearsCount - 1, regP.length - 1)] || 0;
    } else if (input.membershipType === "Smart") {
      percentage = smartP[Math.min(yearsCount - 1, smartP.length - 1)] || 0;
    }

    const baseVal = (formulasConfig.usageFeeBase === "subscriptionValue") ? subscriptionValue : transferValue;
    const stdUsageFee = baseVal * percentage;

    if (isCompany) {
      // Company rule for duration >= 3 months:
      // Remainder = net_amount - (adminFees + visaFees2Percent)
      const remainder = net_amount - (adminFees + visaFees2Percent);
      if (net_amount <= (adminFees + visaFees2Percent) || remainder <= 0) {
        calculatedUsageFee = 0;
      } else if (remainder < stdUsageFee) {
        // إذا كان الباقي أقل من مقابل الانتفاع المستحق: نضع الباقي كاملاً في مقابل الانتفاع
        calculatedUsageFee = Math.max(0, remainder);
      } else {
        // إذا كان الباقي أكبر من مقابل الانتفاع المستحق: نضع مبلغ مقابل الانتفاع والباقي في رد للعميل
        calculatedUsageFee = stdUsageFee;
      }
    } else {
      calculatedUsageFee = stdUsageFee;
    }
  }

  const usageFee = input.usageFeeOverride !== undefined && input.usageFeeOverride !== null && (input.usageFeeOverride as any) !== '' && !isNaN(Number(input.usageFeeOverride))
    ? parseNum(input.usageFeeOverride) 
    : calculatedUsageFee;

  // Discount Amount
  const discountAmount = adminFees + usageFee + visaFees2Percent;

  // Refund Amount Calculation Rules (Configurable per payment method with dynamic dropdown options)
  let refundAmount: number | string = 0;
  const rawRefundInput = (input as any).refundAmount !== undefined && (input as any).refundAmount !== null && (input as any).refundAmount !== ""
    ? parseNum((input as any).refundAmount)
    : undefined;

  const methodOptions = formulasConfig.paymentMethodOptions || DEFAULT_PAYMENT_METHOD_OPTIONS;
  const customMethods = formulasConfig.customPaymentMethods || [];

  const cashFormula = formulasConfig.cashRefundFormula || "subscriptionValue";
  const checksFormula = formulasConfig.checksRefundFormula || "all_checks";
  const bankFormula = formulasConfig.bankRefundFormula || "transferValue";
  const companyFormula = formulasConfig.companyRefundFormula || "net_subscription";

  const calcVars: Record<string, number> = {
    subscriptionValue,
    transferValue,
    cashAmount,
    visaAmount,
    advancePaid,
    checksPaid,
    checksUnpaid,
    annualRenewalDue,
    adminFees,
    usageFee,
    visaFees2Percent,
    discountAmount,
    debtABKCompanies,
    days,
    net_amount
  };

  // Check if custom payment method matching input.paymentMethod exists
  const matchedCustomMethod = customMethods.find(m => m.methodName && m.methodName.trim().toLowerCase() === (input.paymentMethod || '').trim().toLowerCase());

  if (matchedCustomMethod) {
    const selectedOpt = (matchedCustomMethod.options || []).find(o => o.value === matchedCustomMethod.selectedFormula || o.id === matchedCustomMethod.selectedFormula);
    if (selectedOpt && selectedOpt.expression) {
      refundAmount = Math.max(0, evaluateCustomFormula(selectedOpt.expression, calcVars));
    } else {
      refundAmount = Math.max(0, subscriptionValue - discountAmount);
    }
  } else if (input.paymentMethod === "نقدا" || input.paymentMethod === "نقداً") {
    const cashOpts = methodOptions.cash || DEFAULT_PAYMENT_METHOD_OPTIONS.cash;
    const selectedOpt = cashOpts.find(o => o.value === cashFormula || o.id === cashFormula);
    if (selectedOpt && selectedOpt.expression && !["subscriptionValue", "transferValue", "collected"].includes(selectedOpt.value)) {
      refundAmount = Math.max(0, evaluateCustomFormula(selectedOpt.expression, calcVars));
    } else {
      let base = subscriptionValue;
      if (cashFormula === "transferValue") base = transferValue;
      else if (cashFormula === "collected") base = cashAmount + visaAmount;
      refundAmount = Math.max(0, base - discountAmount);
    }
  } else if (input.paymentMethod === "شيكات") {
    const checkOpts = methodOptions.checks || DEFAULT_PAYMENT_METHOD_OPTIONS.checks;
    const selectedOpt = checkOpts.find(o => o.value === checksFormula || o.id === checksFormula);
    if (selectedOpt && selectedOpt.expression && !["all_checks", "paid_only", "subscriptionValue"].includes(selectedOpt.value)) {
      refundAmount = Math.max(0, evaluateCustomFormula(selectedOpt.expression, calcVars));
    } else {
      let base = advancePaid + checksPaid;
      if (checksFormula === "all_checks") base = advancePaid + checksPaid + checksUnpaid;
      else if (checksFormula === "subscriptionValue") base = subscriptionValue;
      refundAmount = Math.max(0, base - discountAmount);
    }
  } else if (input.paymentMethod === "ABK") {
    // فى حالة طريقة الدفع ABK:
    // مبلغ الاسترداد = قيمة الاشتراك - اجمالى مبلغ الخصم (ويظهر حتى فى عدم وجود مديونية)
    const baseRefund = Math.max(0, subscriptionValue - discountAmount);
    if (!debtABKCompanies || debtABKCompanies <= 0) {
      refundAmount = baseRefund;
    } else {
      const diff = debtABKCompanies - baseRefund;
      if (diff < 0) {
        // لو الفرق بالسالب: وفى هذه الحالة مبلغ الاسترداد = مديونية البنك فقط
        refundAmount = debtABKCompanies;
      } else {
        refundAmount = baseRefund;
      }
    }
  } else if (["المشرق", "QNB"].includes(input.paymentMethod)) {
    const bankOpts = methodOptions.banks || DEFAULT_PAYMENT_METHOD_OPTIONS.banks;
    const selectedOpt = bankOpts.find(o => o.value === bankFormula || o.id === bankFormula);
    if (selectedOpt && selectedOpt.expression && !["transferValue", "subscriptionValue", "collected"].includes(selectedOpt.value)) {
      refundAmount = Math.max(0, evaluateCustomFormula(selectedOpt.expression, calcVars));
    } else if (bankFormula === "collected") {
      refundAmount = Math.max(0, (transferValue + advancePaid) - discountAmount);
    } else {
      let base = transferValue;
      if (bankFormula === "subscriptionValue") base = subscriptionValue;
      refundAmount = Math.max(0, base - discountAmount);
    }
  } else if (isCompany) {
    if (!debtABKCompanies || debtABKCompanies <= 0) {
      refundAmount = "في انتظار المديونية";
    } else {
      refundAmount = debtABKCompanies;
    }
  } else {
    refundAmount = Math.max(0, subscriptionValue - discountAmount);
  }

  // Handle 'بدون رد اى مبلغ' exception
  if (isNoRefundException) {
    refundAmount = 0;
  } else {
    // Explicit or calculated non-zero fallback
    if (refundAmount === 0 && rawRefundInput !== undefined && !isNaN(rawRefundInput) && rawRefundInput > 0 && !isCompany) {
      refundAmount = rawRefundInput;
    } else if (refundAmount === 0 && subscriptionValue > discountAmount && !isCompany) {
      refundAmount = Math.max(0, subscriptionValue - discountAmount);
    }
  }

  // Companies Client Refund: refundToClient = MAX(0, companyNetBase - debtABKCompanies - discountAmount)
  let refundToClient: number | string | "Not Required" = "Not Required";
  if (input.paymentMethod === "ABK") {
    // احذف المبلغ المرتجع للعميل فى حالة ABK
    refundToClient = "Not Required";
  } else if (isNoRefundException) {
    refundToClient = 0;
  } else if (isCompany) {
    if (!debtABKCompanies || debtABKCompanies <= 0) {
      refundToClient = "في انتظار المديونية";
    } else {
      const compOpts = methodOptions.companies || DEFAULT_PAYMENT_METHOD_OPTIONS.companies;
      const selectedOpt = compOpts.find(o => o.value === companyFormula || o.id === companyFormula);
      if (selectedOpt && selectedOpt.expression && !["net_subscription", "net_transfer", "debt_only"].includes(selectedOpt.value)) {
        refundToClient = Math.max(0, evaluateCustomFormula(selectedOpt.expression, calcVars));
      } else if (companyFormula === "debt_only") {
        refundToClient = 0;
      } else {
        const companyNetBase = (companyFormula === "net_transfer" && transferValue > 0) 
          ? transferValue 
          : (subscriptionValue > 0 ? subscriptionValue : (transferValue > 0 ? transferValue : sumComponents));
        refundToClient = Math.max(0, companyNetBase - debtABKCompanies - discountAmount);
      }
    }
  }

  // ABK Debt Difference:
  // لو مفيش مديونية = فى انتظار مديونية البنك
  // لو فى مديونية = مديونية البنك - مبلغ الاسترداد (حيث مبلغ الاسترداد الأساسي = قيمة الاشتراك - إجمالي مبلغ الخصم)
  let abkDebtDifference: number | "Not Required" | string = "Not Required";
  if (input.paymentMethod === "ABK") {
    if (!debtABKCompanies || debtABKCompanies <= 0) {
      abkDebtDifference = "فى انتظار مديونية البنك";
    } else {
      const baseRefund = Math.max(0, subscriptionValue - discountAmount);
      abkDebtDifference = debtABKCompanies - baseRefund;
    }
  }

  return {
    days,
    type,
    type2,
    advancePaid,
    subscriptionValue,
    adminFees,
    calculatedAdminFees,
    usageFee,
    calculatedUsageFee,
    visaFees2Percent,
    discountAmount,
    refundAmount,
    refundToClient,
    abkDebtDifference,
  };
}

export const calculateSettlement = calculateAllFields;

// Role display helper
export function translateRole(role: string): string {
  switch (role) {
    case 'admin': return 'سوبر أدمن مركزي';
    case 'club': return 'مسؤول النادي الفرعي';
    case 'international_user': return 'مسؤول العضويات الدولية';
    case 'first_manager': return 'Manager';
    case 'sector_manager': return 'رئيس قطاع الإدارة المالية';
    default: return role ? role.charAt(0).toUpperCase() + role.slice(1) : '';
  }
}

export function translateStatus(status: string): string {
  if (!status) return '';
  return status;
}

export function getPendingSubStatus(r: {
  status?: string;
  result?: string;
  receiptReceived?: boolean;
  paymentMethod?: string;
  debtABKCompanies?: number;
}): string {
  const statusStr = (r.status || '').trim().toLowerCase();
  const isPending = !r.status || statusStr === 'pending' || statusStr === 'قيد الانتظار' || r.status === 'Pending';
  if (!isPending) return '';

  // 1. لعدم اعتماد اللجنة
  if (r.result !== 'Accepted') {
    return '(فى انتظار انعقاد اللجنة)';
  }

  // 2. الاعتماد معتمد نهائي ولكن لم يتم استلام أصل الإيصال
  if (!r.receiptReceived) {
    return '(فى انتظار اصل الايصال)';
  }

  // 3. تم استلام أصل الإيصال، نتحقق من المديونية للشركات/البنوك
  const method = r.paymentMethod || '';
  const isCompanyOrBank = isCompanyPaymentMethod(method) || 
                          method === 'ABK' || 
                          method === 'المشرق' || 
                          ['ABK', 'Premium', 'Aman', 'Ollin', 'Contact', 'One Finance', 'فاليو', 'سهولة', 'فرصة', 'أمان', 'سيمبل', 'كونتاكت', 'سودة'].some(m => method.includes(m));

  const hasDebt = typeof r.debtABKCompanies === 'number' && r.debtABKCompanies > 0;

  if (isCompanyOrBank && !hasDebt) {
    return '(فى انتظار المديونية)';
  }

  // 4. مديونية الشركات موجودة (أو طريقة دفع لا تتطلب مديونية شركات)
  return '(الشيك تحت الاصدار)';
}

export function evaluateCustomFormula(expression: string, vars: Record<string, number>): number {
  if (!expression || typeof expression !== 'string') return 0;
  try {
    let safeExpr = expression;
    // Sort keys by length descending to avoid replacing substrings of longer variable names
    const sortedKeys = Object.keys(vars).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      const val = parseFloat(vars[key] as any) || 0;
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      safeExpr = safeExpr.replace(regex, `(${val})`);
    }
    // Sanitize string to allow only numbers, math operators +, -, *, /, %, (, ), .
    const sanitized = safeExpr.replace(/[^0-9\.\+\-\*\/\%\(\)\s]/g, '');
    if (!sanitized.trim()) return 0;
    const func = new Function(`return (${sanitized});`);
    const result = func();
    return isNaN(result) || !isFinite(result) ? 0 : Math.round(result * 100) / 100;
  } catch (err) {
    return 0;
  }
}

export function normalizeClubName(clubStr: any): string {
  if (!clubStr || typeof clubStr !== 'string') return '';
  let str = clubStr.trim().toLowerCase();

  // Remove common prefixes (Arabic and English)
  str = str.replace(/^(نادي|نادى|فرع|club|branch)\s+/g, '').trim();

  // Mapping known English <-> Arabic equivalents
  const synonyms: Record<string, string> = {
    'maadi': 'المعادي',
    'معادي': 'المعادي',
    'المعادي': 'المعادي',
    'sheraton': 'شيراتون',
    'الشيراتون': 'شيراتون',
    'شيراتون': 'شيراتون',
    'lotus': 'اللوتس',
    'لوتس': 'اللوتس',
    'اللوتس': 'اللوتس',
    'alex': 'الإسكندرية',
    'الكس': 'الإسكندرية',
    'اسكندرية': 'الإسكندرية',
    'الإسكندرية': 'الإسكندرية',
    'الاسكندرية': 'الإسكندرية',
    'tanta': 'طنطا',
    'طنطا': 'طنطا',
    'nakheel': 'النخيل',
    'نخيل': 'النخيل',
    'النخيل': 'النخيل',
    'mansoura': 'المنصورة',
    'منصورة': 'المنصورة',
    'المنصورة': 'المنصورة',
    'oct i': 'أكتوبر 1',
    'oct 1': 'أكتوبر 1',
    'october 1': 'أكتوبر 1',
    'اكتوبر 1': 'أكتوبر 1',
    'أكتوبر 1': 'أكتوبر 1',
    'أكتوبر ١': 'أكتوبر 1',
    'oct ii': 'أكتوبر 2',
    'oct 2': 'أكتوبر 2',
    'october 2': 'أكتوبر 2',
    'اكتوبر 2': 'أكتوبر 2',
    'أكتوبر 2': 'أكتوبر 2',
    'أكتوبر ٢': 'أكتوبر 2',
    'damietta': 'دمياط',
    'دمياط': 'دمياط',
    'assiut': 'أسيوط',
    'اسيوط': 'أسيوط',
    'أسيوط': 'أسيوط',
    'elminya': 'المنيا',
    'minya': 'المنيا',
    'منيا': 'المنيا',
    'المنيا': 'المنيا',
  };

  if (synonyms[str]) {
    return synonyms[str];
  }

  // Remove alef variations
  return str.replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي');
}

export function isSameClub(clubA: any, clubB: any): boolean {
  if (!clubA || !clubB) return false;
  const cA = String(clubA).trim();
  const cB = String(clubB).trim();
  if (cA.toLowerCase() === cB.toLowerCase()) return true;

  const nA = normalizeClubName(cA);
  const nB = normalizeClubName(cB);

  if (!nA || !nB) return false;
  if (nA === nB) return true;
  if (nA.includes(nB) || nB.includes(nA)) return true;

  return false;
}

/**
 * Universal case-insensitive and Arabic-normalized text search helper
 */
export function normalizeSearchText(text: any): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove tashkeel/diacritics
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ئ/g, 'ي')
    .replace(/ؤ/g, 'و');
}

export function containsSearchQuery(source: any, query: any): boolean {
  if (!query || String(query).trim() === '') return true;
  const nSource = normalizeSearchText(source);
  const nQuery = normalizeSearchText(query);
  return nSource.includes(nQuery);
}

/**
 * Normalizes a membership number for robust comparison across cases, spacing, hyphens, and Arabic/English characters.
 * E.g., "wdi-985", "WDI-985", "WDI - 985", "WDI_985", "wdi 985", "wdi985", "WD-985", etc.
 */
export function normalizeMembershipNumber(mem: any): string {
  if (mem === null || mem === undefined) return '';
  return String(mem)
    .trim()
    .toLowerCase()
    .replace(/[\u0660-\u0669]/g, d => (d.charCodeAt(0) - 1632).toString()) // Arabic-Indic digits ٠-٩ to 0-9
    .replace(/[\u06F0-\u06F9]/g, d => (d.charCodeAt(0) - 1776).toString()) // Eastern Arabic-Indic digits
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // Remove Arabic tashkeel and tatweel (ـ)
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ئ/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/[-_–—\s\/\.\\]/g, ''); // Remove hyphens, underscores, slashes, periods, spaces
}

export function isSameMembershipNumber(mem1: any, mem2: any): boolean {
  if (!mem1 || !mem2) return false;
  const s1 = String(mem1).trim().toLowerCase();
  const s2 = String(mem2).trim().toLowerCase();
  if (s1 === s2) return true;
  
  const n1 = normalizeMembershipNumber(mem1);
  const n2 = normalizeMembershipNumber(mem2);
  return n1.length > 0 && n1 === n2;
}

/**
 * Arabic letters and spaces validation (No English, no digits, no symbols)
 */
export function isArabicOnly(text: string): boolean {
  if (!text || !text.trim()) return false;
  // Arabic Unicode Range: \u0600-\u06FF, \u0750-\u077F, \u08A0-\u08FF, Arabic Presentation Forms
  // Only allows Arabic letters and spaces
  const arabicRegex = /^[\u0621-\u064A\u0671-\u06D3\u06D5\s]+$/;
  return arabicRegex.test(text.trim());
}

/**
 * External ID validation:
 * If isInternational is true: Must start with 61
 * If isInternational is false: Must start with 1000
 * If isInternational is undefined: Must start with 1000 or 61
 */
export function isValidExternalId(id: string, isInternational?: boolean): boolean {
  if (!id) return false;
  const trimmed = String(id).trim();
  if (isInternational === true) {
    return trimmed.startsWith('61');
  }
  if (isInternational === false) {
    return trimmed.startsWith('1000');
  }
  return trimmed.startsWith('1000') || trimmed.startsWith('61');
}

/**
 * Clean leading zero on numeric input
 */
export function cleanLeadingZero(val: string | number): string {
  if (val === undefined || val === null) return '';
  const str = String(val).trim();
  if (str === '0') return '0';
  // If starts with 0 followed by other digits, remove leading zeroes (e.g. "05" -> "5", "00123" -> "123")
  return str.replace(/^0+(?=\d)/, '');
}

/**
 * Universal print helper.
 * Directly and reliably invokes window.print() with Arabic document title management,
 * selection highlight cleanup, and instant native print preview triggering.
 */
export function printElement(element: HTMLElement | null | string, documentTitle: string = 'طباعة المستند') {
  const el: HTMLElement | null =
    typeof element === 'string' ? document.getElementById(element) : element;

  if (!el) {
    console.error('printElement: target element not found');
    return;
  }

  // Remove any visual editing selection highlights before capturing content
  document.querySelectorAll('.selected-line').forEach((node) => node.classList.remove('selected-line'));

  // Grab every <style> and <link rel="stylesheet"> currently in the page so the
  // print window has identical styling to what's on screen.
  const styleNodes = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => {
      if (node.tagName === 'LINK') {
        const href = node.getAttribute('href') || '';
        const absoluteHref = href.startsWith('http') ? href : new URL(href, window.location.origin).href;
        return `<link rel="stylesheet" href="${absoluteHref}">`;
      }
      return node.outerHTML;
    })
    .join('\n');

  const printWindow = window.open('', '_blank', 'width=900,height=1000');
  if (!printWindow) {
    alert('يرجى السماح للنوافذ المنبثقة (Pop-ups) في المتصفح لإتمام عملية الطباعة');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>${documentTitle}</title>
${styleNodes}
<style>
  html, body { margin: 0; padding: 0; background: #fff; }
  body { display: flex; justify-content: center; padding: 12px 0; }
</style>
</head>
<body>
${el.outerHTML}
</body>
</html>`);
  printWindow.document.close();

  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };

  printWindow.onafterprint = () => {
    printWindow.close();
  };
}

/**
 * Safely extracts and determines the actual rejection reason for a request.
 * Prevents positive/approval remarks (e.g. "طلب مستوفي الشروط ومطابق")
 * from ever being falsely displayed as a rejection reason.
 */
export function getRejectionReason(r: any): string {
  if (!r) return '';

  // 1. Explicit rejection reason fields
  if (r.rejectionReason && typeof r.rejectionReason === 'string' && r.rejectionReason.trim()) {
    return r.rejectionReason.trim();
  }
  if (r.rejectionNote && typeof r.rejectionNote === 'string' && r.rejectionNote.trim()) {
    return r.rejectionNote.trim();
  }

  // 2. First Manager decision comments
  if (r.firstManagerApproved === false && r.firstManagerComments && typeof r.firstManagerComments === 'string' && r.firstManagerComments.trim()) {
    return r.firstManagerComments.trim();
  }

  // 3. Sector Manager decision comments
  if (r.sectorManagerApproved === false && r.sectorManagerComments && typeof r.sectorManagerComments === 'string' && r.sectorManagerComments.trim()) {
    return r.sectorManagerComments.trim();
  }

  // 4. Any direct comments from managers
  if (r.firstManagerComments && typeof r.firstManagerComments === 'string' && r.firstManagerComments.trim()) {
    return r.firstManagerComments.trim();
  }
  if (r.sectorManagerComments && typeof r.sectorManagerComments === 'string' && r.sectorManagerComments.trim()) {
    return r.sectorManagerComments.trim();
  }

  // 5. Admin note ONLY if it is NOT an approval/positive compliance remark
  if (r.adminNote && typeof r.adminNote === 'string' && r.adminNote.trim()) {
    const note = r.adminNote.trim();
    const isApprovalNote = /(مستوف|مطابق|مقبول|تمت الموافقة|صالح|معتمد|جاهز للاعتماد|لا مانع|موافق|استيفاء|تمت المراجعة)/i.test(note);
    if (!isApprovalNote) {
      return note;
    }
  }

  return '';
}



