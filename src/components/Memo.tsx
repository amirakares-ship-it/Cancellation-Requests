import React, { useState, useEffect, useRef } from 'react';
import { Printer, Save, RefreshCw, Search, ArrowRight, Building2, Globe, FileText, FileCheck, Layers, Bold, Italic, Underline, AlignRight, AlignCenter, AlignLeft, Table, Plus, Minus, Grid, Merge, Split, Type, Move, Sliders, CheckCircle2, RotateCcw } from 'lucide-react';
import { CancellationRequest, User } from '../types';
import { formatDateCustom, formatDateNumeric, calculateAllFields, parseNum, isCompanyPaymentMethod, isBankPaymentMethod, printElement, isSameClub, isInternationalRequest } from '../utils';
import { WadiDeglaLogo } from './WadiDeglaLogo';

interface MemoProps {
  requests?: CancellationRequest[];
  request?: CancellationRequest | null;
  user?: User | null;
  onRefresh?: () => void;
  onBack?: () => void;
}

export interface MemoTexts {
  titleL1: string;
  titleL2: string;
  toLabel: string;
  toText: string;
  subjectLabel: string;
  subjectText: string;
  nameLabel: string;
  membershipNumLabel: string;
  loanLabel: string;
  accountNumberLabel?: string;
  subDateLabel: string;
  reqDateLabel: string;
  receiptsNote: string;
  receiptsCountLabel: string;
  committeeNotePrefix: string;
  committeeNoteYear: string;
  salesDeptNote: string;
  refundNotePrefix?: string;
  refundNoteMiddle?: string;
  annualExemptPrefix?: string;
  annualExemptSuffix?: string;
  signName?: string;
  finNotesLabel?: string;
  clientNoLabel?: string;
  auditorSignLabel?: string;
  finManagerSignLabel?: string;
}

export const getDefaultTexts = (form: 'companies' | 'international' | 'normal' | 'diff'): MemoTexts => {
  return {
    titleL1: 'إدارة العضويات',
    titleL2: form === 'international'
      ? 'مذكرة داخلية - إلغاء عضوية دولية'
      : form === 'diff'
      ? 'مذكرة داخلية - طلب فرق عضوية'
      : 'مذكرة داخلية لإلغاء العضوية',
    toLabel: 'إلى :',
    toText: 'الإدارة المالية .',
    subjectLabel: 'الموضوع :',
    subjectText: form === 'diff' ? 'طلب فرق عضويه .' : 'طلب إلغاء عضويه .',
    nameLabel: 'بإسم / ',
    membershipNumLabel: 'رقم عضوية :',
    loanLabel: 'القرض بإسم / ',
    accountNumberLabel: 'رقم الحساب :',
    subDateLabel: 'تاريخ الإشتراك بالنادى :',
    reqDateLabel: 'تاريخ طلب الإلغاء :',
    receiptsNote: 'مرفق بالطلب : إيصالات:',
    receiptsCountLabel: 'عددها :',
    committeeNotePrefix: 'بناء على موافقة لجنة العضويات رقم ',
    committeeNoteYear: ' لسنة 2026 بإلغاء العضوية عاليه، على النحو التالى:',
    salesDeptNote: form === 'diff' ? 'مع تحميل هذا المبلغ على إدارة المبيعات.' : 'مع تحميل هذا الالغاء على ادارة المبيعات.',
    refundNotePrefix: 'ورجاء رد مبلغ ',
    refundNoteMiddle: ' وذلك بعد خصم مبلغ ',
    annualExemptPrefix: 'مع اعفاء العضو من سداد مبلغ ',
    annualExemptSuffix: ' مقابل التجديد السنوى لعام 2026',
    signName: 'صفوت رجائى',
    finNotesLabel: 'ملاحظات الإدارة المالية :',
    clientNoLabel: 'رقم العميل :',
    auditorSignLabel: 'توقيع مراجع الحسابات :',
    finManagerSignLabel: 'توقيع المدير المالى :',
  };
};

export default function Memo({ requests = [], request: initialRequest, user, onRefresh, onBack }: MemoProps) {
  // Form Type: 'companies' | 'international' | 'normal' | 'diff'
  const [activeForm, setActiveForm] = useState<'companies' | 'international' | 'normal' | 'diff'>('companies');
  const isFormManuallySelected = useRef(false);

  // Selected Request
  const [selectedReqId, setSelectedReqId] = useState<number | string | null>(initialRequest?.id || null);
  const [searchTerm, setSearchTerm] = useState('');

  const activeRequest = requests.find(r => r.id === selectedReqId) || initialRequest || null;

  // Toggle state for editing toolbar (collapsible)
  const [isToolbarOpen, setIsToolbarOpen] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Dynamic Memo Texts State (fully editable and persistent across memberships)
  const [memoTexts, setMemoTexts] = useState<MemoTexts>(() => getDefaultTexts('companies'));

  // CSS variables state for Memo customization
  const [fontFamily, setFontFamily] = useState<string>('Calibri');
  const [fontSize, setFontSize] = useState(13.5);
  const [sectionGap, setSectionGap] = useState(8);
  const [cellPaddingV, setCellPaddingV] = useState(4);
  const [cellPaddingH, setCellPaddingH] = useState(8);
  const [tableMargin, setTableMargin] = useState(8);

  // Table styling state
  const [tableBorderWidth, setTableBorderWidth] = useState('1px');
  const [tableBorderColor, setTableBorderColor] = useState('#666666');

  // Side Table Positioning & Dimensions
  const [showSideTable, setShowSideTable] = useState<boolean>(false);
  const [sideTablePosition, setSideTablePosition] = useState<'right' | 'left' | 'top' | 'bottom' | 'none'>('none');
  const [sideTableTopOffset, setSideTableTopOffset] = useState<number>(28);
  const [sideTableGap, setSideTableGap] = useState<number>(0);
  const [sideTableWidth, setSideTableWidth] = useState<number>(190);
  const [cashColWidth, setCashColWidth] = useState<number>(90);
  const [visaColWidth, setVisaColWidth] = useState<number>(90);

  // Manual Drag Position for Side Table
  const [sideTableDragPos, setSideTableDragPos] = useState<{ top: number; left: number } | null>(null);
  const isDraggingSideTable = useRef(false);
  const sideTableDragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const gridWrapperRef = useRef<HTMLDivElement>(null);

  // Resizable Columns Widths for ALL Tables
  const [gridCol1Width, setGridCol1Width] = useState<number>(220); // Label column
  const [gridCol2Width, setGridCol2Width] = useState<number>(220); // Value column
  const [deductCol1Width, setDeductCol1Width] = useState<number>(85); // Tag column
  const [deductCol2Width, setDeductCol2Width] = useState<number>(125); // Amount column (including جم)
  const [deductCol4Width, setDeductCol4Width] = useState<number>(220); // Description column

  // Ref for tracking active column resize
  const resizingCol = useRef<{ colKey: string; startX: number; startWidth: number } | null>(null);

  // Selected Line for inline padding adjustment
  const [selectedLineRef, setSelectedLineRef] = useState<HTMLElement | null>(null);

  // Exceptions list for Memo Form
  const [exceptions, setExceptions] = useState<string[]>([]);

  // Dynamic grid rows & deduct rows
  const [gridRows, setGridRows] = useState<Array<{ label: string; val1: string; val2?: string; val3?: string; unit?: string; isBold?: boolean }>>([]);
  const [deductRows, setDeductRows] = useState<Array<{ tag: string; amount: string; unit: string; desc: string; isBold?: boolean }>>([]);

  // Draggable logo position
  const [logoPos, setLogoPos] = useState<{ top: number; left: number }>({ top: 12.4, left: 311.375 });
  const isDraggingLogo = useRef(false);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const sheetRef = useRef<HTMLDivElement>(null);

  // ExecCommand helper for Rich Text Formatting
  const execCmd = (cmd: string, val: string | undefined = undefined) => {
    document.execCommand(cmd, false, val);
  };

  const applyFontFamily = (font: string) => {
    execCmd('fontName', font);
  };

  // Table Helpers on DOM
  const getFocusedTableCell = (): HTMLTableCellElement | null => {
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode) return null;
    const node = sel.anchorNode.nodeType === Node.ELEMENT_NODE
      ? (sel.anchorNode as HTMLElement)
      : sel.anchorNode.parentElement;
    if (!node) return null;
    return node.closest('td, th') as HTMLTableCellElement | null;
  };

  const addRowAbove = () => {
    const cell = getFocusedTableCell();
    if (!cell) {
      setGridRows(prev => [...prev, { label: 'بند جديد', val1: '[القيمة]' }]);
      return;
    }
    const tr = cell.closest('tr');
    if (!tr || !tr.parentElement) return;
    const newTr = tr.cloneNode(true) as HTMLTableRowElement;
    newTr.querySelectorAll('td, th').forEach(c => c.textContent = '[نص جديد]');
    tr.parentElement.insertBefore(newTr, tr);
  };

  const addRowBelow = () => {
    const cell = getFocusedTableCell();
    if (!cell) {
      setGridRows(prev => [...prev, { label: 'بند جديد', val1: '[القيمة]' }]);
      return;
    }
    const tr = cell.closest('tr');
    if (!tr || !tr.parentElement) return;
    const newTr = tr.cloneNode(true) as HTMLTableRowElement;
    newTr.querySelectorAll('td, th').forEach(c => c.textContent = '[نص جديد]');
    if (tr.nextSibling) {
      tr.parentElement.insertBefore(newTr, tr.nextSibling);
    } else {
      tr.parentElement.appendChild(newTr);
    }
  };

  const deleteCurrentRow = () => {
    const cell = getFocusedTableCell();
    if (!cell) return;
    const tr = cell.closest('tr');
    if (tr) tr.remove();
  };

  const addColumnRightLeft = (direction: 'right' | 'left') => {
    const cell = getFocusedTableCell();
    if (!cell) return;
    const tr = cell.closest('tr');
    if (!tr) return;
    const colIndex = Array.from(tr.children).indexOf(cell);
    const table = cell.closest('table');
    if (!table) return;

    Array.from(table.rows).forEach(r => {
      const isHeader = r.children[0]?.tagName === 'TH';
      const newCell = document.createElement(isHeader ? 'th' : 'td');
      newCell.textContent = '[عمود جديد]';
      newCell.style.padding = 'var(--cell-padding-v) var(--cell-padding-h)';
      newCell.style.border = `${tableBorderWidth} solid ${tableBorderColor}`;
      newCell.style.textAlign = 'center';

      const targetCell = r.children[colIndex];
      if (targetCell) {
        if (direction === 'right') {
          r.insertBefore(newCell, targetCell);
        } else {
          if (targetCell.nextSibling) {
            r.insertBefore(newCell, targetCell.nextSibling);
          } else {
            r.appendChild(newCell);
          }
        }
      } else {
        r.appendChild(newCell);
      }
    });
  };

  const deleteCurrentColumn = () => {
    const cell = getFocusedTableCell();
    if (!cell) return;
    const tr = cell.closest('tr');
    if (!tr) return;
    const colIndex = Array.from(tr.children).indexOf(cell);
    const table = cell.closest('table');
    if (!table) return;

    Array.from(table.rows).forEach(r => {
      if (r.children[colIndex]) {
        r.children[colIndex].remove();
      }
    });
  };

  const mergeNextTableCell = () => {
    const cell = getFocusedTableCell();
    if (!cell) return;
    const nextCell = cell.nextElementSibling as HTMLTableCellElement | null;
    if (!nextCell) return;

    const currentColspan = cell.colSpan || 1;
    const nextColspan = nextCell.colSpan || 1;
    cell.colSpan = currentColspan + nextColspan;
    if (nextCell.textContent && nextCell.textContent.trim() !== '') {
      cell.textContent = (cell.textContent || '') + ' ' + nextCell.textContent;
    }
    nextCell.remove();
  };

  const splitTableCell = () => {
    const cell = getFocusedTableCell();
    if (!cell || (cell.colSpan || 1) <= 1) return;
    const origSpan = cell.colSpan;
    cell.colSpan = 1;
    const tr = cell.closest('tr');
    if (!tr) return;

    for (let i = 1; i < origSpan; i++) {
      const newCell = document.createElement(cell.tagName);
      newCell.textContent = '';
      newCell.style.padding = cell.style.padding;
      newCell.style.border = `${tableBorderWidth} solid ${tableBorderColor}`;
      newCell.style.textAlign = 'center';
      if (cell.nextSibling) {
        tr.insertBefore(newCell, cell.nextSibling);
      } else {
        tr.appendChild(newCell);
      }
    }
  };

  const setFocusedCellBg = (color: string) => {
    const cell = getFocusedTableCell();
    if (cell) {
      cell.style.backgroundColor = color;
    }
  };

  const updateTableBorders = (width: string, color: string) => {
    setTableBorderWidth(width);
    setTableBorderColor(color);
    if (!sheetRef.current) return;
    const tables = sheetRef.current.querySelectorAll('table');
    tables.forEach(tbl => {
      const cells = tbl.querySelectorAll('td, th');
      cells.forEach(c => {
        (c as HTMLElement).style.border = `${width} solid ${color}`;
      });
    });
  };

  // Reference for previous selected request to auto-detect form on initial selection
  const prevSelectedReqIdRef = useRef<number | string | null>(selectedReqId);

  // Auto-detect form type ONLY on initial request or when not manually chosen
  useEffect(() => {
    if (prevSelectedReqIdRef.current !== selectedReqId) {
      prevSelectedReqIdRef.current = selectedReqId;
      if (!isFormManuallySelected.current && activeRequest) {
        if (activeRequest.membershipType === 'International') {
          setActiveForm('international');
        } else if (['ABK', 'المشرق', 'Aman', 'Ollin', 'Contact', 'One Finance', 'Premium', 'شركات'].some(pm => (activeRequest.paymentMethod || '').includes(pm))) {
          setActiveForm('companies');
        } else {
          setActiveForm('normal');
        }
      }
    }
  }, [selectedReqId, activeRequest]);

  // Form names helpers in Arabic
  const getFormName = (form: 'companies' | 'international' | 'normal' | 'diff') => {
    switch (form) {
      case 'companies': return 'شركات وبنوك (Companies Form)';
      case 'international': return 'العضويات الدولية (International Form)';
      case 'normal': return 'النموذج العادي (Normal Form)';
      case 'diff': return 'فروق العضوية (Diff Form)';
      default: return form;
    }
  };

  const getFormShortName = (form: 'companies' | 'international' | 'normal' | 'diff') => {
    switch (form) {
      case 'companies': return 'الشركات';
      case 'international': return 'الدولي';
      case 'normal': return 'العادي';
      case 'diff': return 'الفروق';
      default: return form;
    }
  };

  // Helper to format values or return '' if value is empty/missing
  const getVal = (val: any, fallback: string = '') => {
    if (val !== undefined && val !== null && val !== '') {
      if (typeof val === 'number') {
        if (isNaN(val)) return fallback;
        return val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      }
      const strVal = String(val).trim();
      if (strVal === '' || strVal === '-' || strVal.startsWith('[')) return fallback;
      if (strVal === '0') return '0';
      const num = parseFloat(strVal.replace(/,/g, ''));
      if (!isNaN(num) && strVal === String(num)) {
        return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      }
      return strVal;
    }
    return fallback;
  };

  // Helper for IDs and Membership Numbers - never formats with commas (e.g. 298493)
  const getRawIdVal = (val: any, fallback: string = '') => {
    if (val !== undefined && val !== null && val !== '') {
      const strVal = String(val).replace(/,/g, '').trim();
      if (strVal === '' || strVal === '-' || strVal.startsWith('[')) return fallback;
      return strVal;
    }
    return fallback;
  };

  // Helper to look up client refund accurately ("مبلغ الرد للعميل")
  const getClientRefund = (r: CancellationRequest | null | undefined, fallback: string = '') => {
    if (!r) return fallback;
    const pm = (r.paymentMethod || '').trim();

    if (pm === 'ABK') {
      // 1. Explicit positive refundToClient
      if (r.refundToClient !== undefined && r.refundToClient !== null && (r.refundToClient as any) !== '' && r.refundToClient !== 'Not Required' && r.refundToClient !== 'في انتظار المديونية') {
        const parsed = parseNum(r.refundToClient);
        if (parsed > 0) return parsed.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      }

      const disc = parseNum(r.discountAmount);
      const subVal = parseNum(r.subscriptionValue);
      const debt = parseNum(r.debtABKCompanies);

      // 2. If debt is entered:
      // If debt >= baseRefund (فرق المديونية بالموجب / على العميل سداده للبنك أو متساوي), client refund is ZERO (0)!
      if (debt > 0 && subVal > 0) {
        const baseRefund = Math.max(0, subVal - disc);
        if (baseRefund > debt) {
          return (baseRefund - debt).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        }
        return '0';
      }

      // 3. If there is a direct cash/visa down payment directly to club and no debt was entered:
      const rawAdv = (r.advancePaid !== undefined && r.advancePaid !== null && (r.advancePaid as any) !== '')
        ? parseNum(r.advancePaid)
        : (parseNum(r.cashAmount) + parseNum(r.visaAmount));
      if (rawAdv > 0 && rawAdv > disc && (!debt || debt <= 0)) {
        return (rawAdv - disc).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      }

      return '0';
    }

    const isCompany = activeForm === 'companies' || isCompanyPaymentMethod(pm) || ['المشرق', 'Aman', 'Ollin', 'Contact', 'One Finance', 'Premium', 'شركات'].some(c => pm.includes(c));

    if (isCompany) {
      // 1. Direct lookup from request property first (even if 0)
      if (r.refundToClient !== undefined && r.refundToClient !== null && (r.refundToClient as any) !== '') {
        if (r.refundToClient === 'Not Required') return '0';
        if (typeof r.refundToClient === 'string') {
          const trimmed = r.refundToClient.trim();
          if (trimmed === '' || trimmed === '-' || trimmed.startsWith('[')) return fallback;
          if (isNaN(Number(trimmed.replace(/,/g, '')))) return trimmed;
        }
        const parsed = parseNum(r.refundToClient);
        return parsed.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      }

      // 2. Engine calculated refundToClient for company
      const calc = calculateAllFields(r);
      if (calc.refundToClient !== undefined && calc.refundToClient !== null && calc.refundToClient !== '') {
        if (calc.refundToClient === 'Not Required') return '0';
        if (typeof calc.refundToClient === 'number') {
          return calc.refundToClient.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        }
        const s = String(calc.refundToClient).trim();
        return (s === '' || s === '-' || s.startsWith('[')) ? fallback : s;
      }
      return fallback;
    }

    // For non-company requests (نقداً, شيكات, فيزا, تحويل بنكي, عضوية دولية):
    // 1. Direct lookup from request properties
    if (r.refundAmount !== undefined && r.refundAmount !== null && (r.refundAmount as any) !== '') {
      if (typeof r.refundAmount === 'string') {
        const trimmed = r.refundAmount.trim();
        if (trimmed === '' || trimmed === '-' || trimmed.startsWith('[')) return fallback;
        if (isNaN(Number(trimmed.replace(/,/g, '')))) return trimmed;
      }
      const parsed = parseNum(r.refundAmount);
      return parsed.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    if (r.actualRefund !== undefined && r.actualRefund !== null && (r.actualRefund as any) !== '') {
      const parsed = parseNum(r.actualRefund);
      return parsed.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    if (r.memberRefund !== undefined && r.memberRefund !== null && (r.memberRefund as any) !== '') {
      const parsed = parseNum(r.memberRefund);
      return parsed.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }

    // 2. Engine calculated refundAmount
    const calc = calculateAllFields(r);
    if (typeof calc.refundAmount === 'number') {
      return calc.refundAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    if (typeof calc.refundAmount === 'string' && calc.refundAmount !== '') {
      const s = calc.refundAmount.trim();
      return (s === '' || s === '-' || s.startsWith('[')) ? fallback : s;
    }

    return fallback;
  };

  // Helper to look up total check / company refund amount ("مبلغ الاسترداد / شيك الاسترداد")
  const getCheckRefund = (r: CancellationRequest | null | undefined, fallback: string = '') => {
    if (!r) return fallback;
    const pm = (r.paymentMethod || '').trim();
    const isABK = pm === 'ABK';
    const isCompany = (isCompanyPaymentMethod(pm) || ['المشرق', 'Aman', 'Ollin', 'Contact', 'One Finance', 'Premium', 'شركات'].some(c => pm.includes(c))) && !isABK;

    // 0. For ABK: strictly calculate refundAmount as subscriptionValue - discountAmount (or debt if diff < 0)
    if (isABK) {
      const calc = calculateAllFields(r);
      if (typeof calc.refundAmount === 'number') {
        return calc.refundAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      }
      if (typeof calc.refundAmount === 'string' && calc.refundAmount !== '') {
        return calc.refundAmount;
      }
      const sub = parseNum(r.subscriptionValue);
      const disc = parseNum(r.discountAmount);
      const baseRefund = Math.max(0, sub - disc);
      const debt = parseNum(r.debtABKCompanies);
      if (debt > 0 && (debt - baseRefund) < 0) {
        return debt.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      }
      return baseRefund.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }

    // 1. If direct refundAmount is given (for non-ABK)
    if (r.refundAmount !== undefined && r.refundAmount !== null && (r.refundAmount as any) !== '') {
      if (typeof r.refundAmount === 'string') {
        const trimmed = r.refundAmount.trim();
        if (trimmed === '' || trimmed === '-' || trimmed.startsWith('[')) return fallback;
        if (isNaN(Number(trimmed.replace(/,/g, '')))) return trimmed;
      }
      const parsed = parseNum(r.refundAmount);
      return parsed.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }

    // 2. If company and debtABKCompanies exists
    if (isCompany && r.debtABKCompanies !== undefined && r.debtABKCompanies !== null && (r.debtABKCompanies as any) !== '') {
      const debt = parseNum(r.debtABKCompanies);
      if (debt > 0) {
        return debt.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      }
    }

    // 3. Engine calculation
    const calc = calculateAllFields(r);
    if (typeof calc.refundAmount === 'number') {
      return calc.refundAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    if (typeof calc.refundAmount === 'string' && calc.refundAmount !== '') {
      const s = calc.refundAmount.trim();
      return (s === '' || s === '-' || s.startsWith('[')) ? fallback : s;
    }

    return getClientRefund(r, fallback);
  };

  // Check numeric refund value
  const getClientRefundNum = (r: CancellationRequest | null | undefined): number => {
    if (!r) return 0;
    const str = getClientRefund(r, '0');
    return parseNum(str);
  };

  // Helper to lookup discount amount for the memo note line:
  // Rule: If client refund amount is 0, the discount in the memo note line automatically shows 0 (صفر).
  // If client refund has an amount (> 0), it shows the total discount/deduction amount.
  const getMemoDiscount = (r: CancellationRequest | null | undefined, fallback: string = '') => {
    if (!r) return fallback;

    const clientRefStr = getClientRefund(r, '');
    const clientRefNum = getClientRefundNum(r);
    if (clientRefNum <= 0 || clientRefStr === '0' || clientRefStr === '' || clientRefStr === 'صفر') {
      return '0';
    }

    if (r.discountAmount !== undefined && r.discountAmount !== null && (r.discountAmount as any) !== '') {
      return getVal(r.discountAmount, fallback);
    }
    const calc = calculateAllFields(r);
    if (typeof calc.discountAmount === 'number' && calc.discountAmount > 0) {
      return calc.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    const admin = parseNum(r.adminFeesOverride ?? r.adminFees);
    const usage = parseNum(r.usageFeeOverride ?? r.usageFee);
    const visa = parseNum(r.visaFeeOverride ?? r.visaFees2Percent);
    const sum = admin + usage + visa;
    if (sum > 0) {
      return sum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    return getVal(r.discountAmount, fallback);
  };

// Arabic text normalization for foolproof matching across templates and memberships
const normalizeArabicText = (str: string = ''): string => {
  return str
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove diacritics
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

// Helper to resolve grid row values dynamically based on membership data and row label
const resolveGridRowValue = (label: string, r: CancellationRequest | null | undefined, fallbackVal: string = ''): string => {
  if (!r) return fallbackVal;
  const n = normalizeArabicText(label);

  if (n.includes('طريقه') || n.includes('سداد') || n.includes('دفع')) {
    return r.paymentMethod || '';
  }
  if (n.includes('اجمالي') || (n.includes('قيمه') && (n.includes('عضويه') || n.includes('اشتراك')))) {
    return getVal(r.subscriptionValue, '');
  }
  if (n.includes('مقدم')) {
    const rawAdv = r.advancePaid as (number | string | undefined | null);
    const adv = (rawAdv !== undefined && rawAdv !== null && rawAdv !== '')
      ? rawAdv
      : ((parseNum(r.cashAmount) + parseNum(r.visaAmount)) || 0);
    return getVal(adv, '');
  }
  if (n.includes('قرض') || n.includes('تمويل') || n.includes('تحويل')) {
    return getVal(r.transferValue, '');
  }
  if ((n.includes('مسدده') || n.includes('محصله') || n.includes('مدفوعه')) && !n.includes('غير') && !n.includes('متبق')) {
    return getVal(r.checksPaid, '');
  }
  if (n.includes('غير مسدده') || n.includes('غير المسدده') || n.includes('غير محصله') || n.includes('متبقي') || n.includes('اجله') || (n.includes('شيك') && n.includes('غير'))) {
    return getVal(r.checksUnpaid, '');
  }
  if (n.includes('تجديد') || n.includes('سنوي') || n.includes('اشتراك سنوي')) {
    return getVal(r.annualRenewalDue, '');
  }
  // If custom user row, return user text if not a placeholder
  if (typeof fallbackVal === 'string' && (fallbackVal.startsWith('[') || fallbackVal === '-')) return '';
  return fallbackVal;
};

// Helper for numeric fee retrieval with full support for overrides & engine calculation
const getFeeNum = (overrideVal: any, rawVal: any, calcVal: number | undefined) => {
  if (overrideVal !== undefined && overrideVal !== null && overrideVal !== '' && !isNaN(parseNum(overrideVal))) {
    return parseNum(overrideVal);
  }
  if (rawVal !== undefined && rawVal !== null && rawVal !== '' && !isNaN(parseNum(rawVal))) {
    const p = parseNum(rawVal);
    if (p > 0 || String(rawVal).trim() === '0') return p;
  }
  return calcVal !== undefined && calcVal !== null && !isNaN(calcVal) ? calcVal : 0;
};

// Helper to resolve deduction row amounts dynamically based on membership data and row description/tag
const resolveDeductRowAmount = (
  tag: string,
  desc: string,
  idx: number,
  totalRows: number,
  form: 'companies' | 'international' | 'normal' | 'diff',
  r: CancellationRequest | null | undefined,
  fallbackAmount: string = ''
): { amount: string; desc?: string } => {
  if (!r) return { amount: fallbackAmount };
  const nDesc = normalizeArabicText(desc);
  const nTag = normalizeArabicText(tag);

  const calc = calculateAllFields(r);
  const adminNum = getFeeNum(r?.adminFeesOverride, r?.adminFees, calc?.adminFees);
  const usageNum = getFeeNum(r?.usageFeeOverride, r?.usageFee, calc?.usageFee);
  const visaNum = getFeeNum(r?.visaFeeOverride, r?.visaFees2Percent, calc?.visaFees2Percent);

  const adminFeesVal = adminNum > 0 ? adminNum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : (adminNum === 0 ? '0' : '');
  const usageFeeVal = usageNum > 0 ? usageNum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : (usageNum === 0 ? '0' : '');
  const visaFeesVal = visaNum > 0 ? visaNum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : (visaNum === 0 ? '0' : '');

  const freshRefund = (form === 'international')
    ? getClientRefund(r, '')
    : getCheckRefund(r, '');

  if (nDesc.includes('اداريه') || nDesc.includes('اداره') || nDesc.includes('رسوم')) {
    return { amount: adminFeesVal };
  }
  if (nDesc.includes('انتفاع') || nDesc.includes('استهلاك') || nDesc.includes('نادي')) {
    return { amount: usageFeeVal };
  }
  if (nDesc.includes('فيزا') || nDesc.includes('visa') || nDesc.includes('2')) {
    return { amount: visaFeesVal };
  }
  if (idx === totalRows - 1 || nTag.includes('شيك') || nTag.includes('رد') || nTag.includes('تحويل') || nDesc.includes('استرداد') || nDesc.includes('عميل') || nDesc.includes('حساب') || nDesc.includes('عضو') || nDesc.includes('بنك') || nDesc.includes('abk')) {
    let resolvedDesc = desc;
    const pm = r.paymentMethod || '';
    const isBank = isBankPaymentMethod(pm);
    const isComp = isCompanyPaymentMethod(pm) || ['ABK', 'المشرق', 'Aman', 'Ollin', 'Contact', 'One Finance', 'Premium', 'شركات'].some(c => pm.includes(c));

    if (form === 'normal') {
      if (!isBank) {
        // In normal form with non-bank payment methods, replace any "لبنك ABK" or bank reference with "للعضو"
        resolvedDesc = 'للعضو';
      } else {
        // For banks in normal form
        if (pm === 'ABK' || nDesc.includes('abk') || !resolvedDesc || resolvedDesc === 'مبلغ الاسترداد' || resolvedDesc === 'للعضو') {
          resolvedDesc = 'لبنك ABK';
        } else if (pm) {
          resolvedDesc = `لبنك ${pm}`;
        }
      }
    } else if (form === 'companies' && (nDesc.includes('شركه') || nDesc.includes('بنك') || nDesc.includes('abk') || nDesc.includes('استرداد'))) {
      resolvedDesc = pm ? (isComp ? `لشركة ${pm}` : (isBank ? `لبنك ${pm}` : 'لشركة التمويل / البنك')) : 'لشركة التمويل / البنك';
    }
    return { amount: freshRefund, desc: resolvedDesc };
  }

  return { amount: fallbackAmount };
};

// Get default configuration for each specific form template
const getDefaultTemplateState = (form: 'companies' | 'international' | 'normal' | 'diff', r: CancellationRequest | null | undefined) => {
  const pm = r?.paymentMethod || '';
  const subVal = getVal(r?.subscriptionValue, '');
  const rawAdv = r?.advancePaid as (number | string | undefined | null);
  const advTotal = (rawAdv !== undefined && rawAdv !== null && rawAdv !== '')
    ? rawAdv
    : ((parseNum(r?.cashAmount) + parseNum(r?.visaAmount)) || 0);
  const advVal = getVal(advTotal, '');
  const transferVal = getVal(r?.transferValue, '');
  const checksPaidVal = getVal(r?.checksPaid, '');
  const checksUnpaidVal = getVal(r?.checksUnpaid, '');
  const annualRenewalVal = getVal(r?.annualRenewalDue, '');
  const isComp = isCompanyPaymentMethod(pm) || ['ABK', 'المشرق', 'Aman', 'Ollin', 'Contact', 'One Finance', 'Premium', 'شركات'].some(c => pm.includes(c));

  const defaultUnit = form === 'international' ? (r?.currency || '') : (r?.currency || 'جم');
  const deductUnit = r?.currency || (form === 'international' ? 'ريال سعودى' : 'جم');

  let defaultGridRows: Array<{ label: string; val1: string; val2?: string; val3?: string; unit?: string; isBold?: boolean }> = [
    { label: 'طريقة السداد', val1: pm, unit: '' },
    { label: 'إجمالى قيمة العضوية :', val1: subVal, unit: defaultUnit },
    { label: 'قيمة المقدم :', val1: advVal, unit: defaultUnit },
    { label: 'قيمة القرض / التمويل :', val1: transferVal, unit: defaultUnit },
    { label: 'قيمة الشيكات المسددة :', val1: checksPaidVal, unit: defaultUnit },
    { label: 'قيمة الشيكات الغير مسددة :', val1: checksUnpaidVal, unit: defaultUnit },
    { label: 'قيمة التجديد السنوى :', val1: annualRenewalVal, unit: defaultUnit },
  ];

  let defaultDeductRows: Array<{ tag: string; amount: string; unit: string; desc: string; isBold?: boolean }> = [];
  const calc = r ? calculateAllFields(r) : null;

  const adminNum = getFeeNum(r?.adminFeesOverride, r?.adminFees, calc?.adminFees);
  const usageNum = getFeeNum(r?.usageFeeOverride, r?.usageFee, calc?.usageFee);
  const visaNum = getFeeNum(r?.visaFeeOverride, r?.visaFees2Percent, calc?.visaFees2Percent);

  const adminFeesVal = adminNum > 0 ? adminNum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : (adminNum === 0 ? '0' : '');
  const usageFeeVal = usageNum > 0 ? usageNum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : (usageNum === 0 ? '0' : '');
  const visaFeesVal = visaNum > 0 ? visaNum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : (visaNum === 0 ? '0' : '');

  if (form === 'international') {
    const refundVal = getClientRefund(r, '');
    defaultDeductRows = [
      { tag: 'خصم', amount: adminFeesVal, unit: '', desc: 'مصاريف إدارية' },
      { tag: 'خصم', amount: usageFeeVal, unit: '', desc: 'مقابل انتفاع بالنادى' },
      { tag: 'خصم', amount: visaFeesVal, unit: '', desc: 'مصاريف فيزا 2%' },
      { tag: 'مع رد شيك للعضوية بقيمة', amount: refundVal, unit: deductUnit, desc: 'لحساب العميل' },
    ];
  } else if (form === 'companies') {
    const refundVal = getCheckRefund(r, '');
    defaultDeductRows = [
      { tag: 'خصم', amount: adminFeesVal, unit: adminFeesVal ? deductUnit : '', desc: 'مصاريف إدارية' },
      { tag: 'خصم', amount: usageFeeVal, unit: usageFeeVal ? deductUnit : '', desc: 'مقابل انتفاع بالنادى' },
      { tag: 'خصم', amount: visaFeesVal, unit: visaFeesVal ? deductUnit : '', desc: 'مصاريف فيزا 2%' },
      { tag: 'مع رد شيك للعضوية بقيمة', amount: refundVal, unit: refundVal ? deductUnit : '', desc: pm ? (isComp ? `لشركة ${pm}` : 'لشركة التمويل / البنك') : 'لشركة التمويل / البنك' },
    ];
  } else {
    const refundVal = getCheckRefund(r, '');
    const isBank = isBankPaymentMethod(pm);
    defaultDeductRows = [
      { tag: 'خصم', amount: adminFeesVal, unit: adminFeesVal ? deductUnit : '', desc: 'مصاريف إدارية' },
      { tag: 'خصم', amount: usageFeeVal, unit: usageFeeVal ? deductUnit : '', desc: 'مقابل انتفاع بالنادى' },
      { tag: 'خصم', amount: visaFeesVal, unit: visaFeesVal ? deductUnit : '', desc: 'مصاريف فيزا 2%' },
      { tag: 'مع رد شيك للعضوية بقيمة', amount: refundVal, unit: refundVal ? deductUnit : '', desc: isBank ? (pm === 'ABK' ? 'لبنك ABK' : `لبنك ${pm}`) : 'للعضو' },
    ];
  }

  const defaultShowSide = false;
  const defaultSidePos = 'none';

  return {
    fontFamily: 'Calibri',
    fontSize: 13.5,
    sectionGap: 8,
    cellPaddingV: 4,
    cellPaddingH: 8,
    tableMargin: 8,
    tableBorderWidth: '1px',
    tableBorderColor: '#666666',
    showSideTable: defaultShowSide,
    sideTablePosition: defaultSidePos as 'right' | 'left' | 'top' | 'bottom' | 'none',
    sideTableTopOffset: 28,
    sideTableGap: 0,
    sideTableWidth: 190,
    cashColWidth: 90,
    visaColWidth: 90,
    sideTableDragPos: null,
    gridCol1Width: 220,
    gridCol2Width: 220,
    deductCol1Width: 85,
    deductCol2Width: 125,
    deductCol4Width: 220,
    logoPos: { top: 12.4, left: 311.375 },
    gridRows: defaultGridRows,
    deductRows: defaultDeductRows,
    memoTexts: getDefaultTexts(form),
  };
};

  // Sync rows from active request & enforce master template formatting profile strictly across all memberships
  useEffect(() => {
    const r = activeRequest;
    const tplSavedKey = `memo_tpl_config_${activeForm}`;

    // Master template config is authoritative for all formatting, widths, paddings, and layout
    let tplConfig: any = null;
    const tplSaved = localStorage.getItem(tplSavedKey);
    if (tplSaved) {
      try { tplConfig = JSON.parse(tplSaved); } catch (e) {}
    }

    const defaults = getDefaultTemplateState(activeForm, r);

    // Apply layout & styles from tplConfig (or defaults) so formatting is 100% stable across all memberships on this template
    setFontSize(tplConfig?.fontSize !== undefined ? tplConfig.fontSize : defaults.fontSize);
    setFontFamily(tplConfig?.fontFamily || defaults.fontFamily || 'Calibri');
    setSectionGap(tplConfig?.sectionGap !== undefined ? tplConfig.sectionGap : defaults.sectionGap);
    setCellPaddingV(tplConfig?.cellPaddingV !== undefined ? tplConfig.cellPaddingV : defaults.cellPaddingV);
    setCellPaddingH(tplConfig?.cellPaddingH !== undefined ? tplConfig.cellPaddingH : defaults.cellPaddingH);
    setTableMargin(tplConfig?.tableMargin !== undefined ? tplConfig.tableMargin : defaults.tableMargin);
    setTableBorderWidth(tplConfig?.tableBorderWidth || defaults.tableBorderWidth);
    setTableBorderColor(tplConfig?.tableBorderColor || defaults.tableBorderColor);

    const resolvedShowSide = tplConfig?.showSideTable !== undefined
      ? tplConfig.showSideTable
      : (tplConfig?.sideTablePosition ? tplConfig.sideTablePosition !== 'none' : defaults.showSideTable);
    setShowSideTable(resolvedShowSide);
    setSideTablePosition(resolvedShowSide ? (tplConfig?.sideTablePosition && tplConfig.sideTablePosition !== 'none' ? tplConfig.sideTablePosition : (defaults.sideTablePosition !== 'none' ? defaults.sideTablePosition : 'right')) : 'none');

    setSideTableTopOffset(tplConfig?.sideTableTopOffset !== undefined ? tplConfig.sideTableTopOffset : defaults.sideTableTopOffset);
    setSideTableGap(tplConfig?.sideTableGap !== undefined ? tplConfig.sideTableGap : defaults.sideTableGap);
    setSideTableWidth(tplConfig?.sideTableWidth || defaults.sideTableWidth);
    setCashColWidth(tplConfig?.cashColWidth || defaults.cashColWidth);
    setVisaColWidth(tplConfig?.visaColWidth || defaults.visaColWidth);
    setSideTableDragPos(tplConfig?.sideTableDragPos !== undefined ? tplConfig.sideTableDragPos : defaults.sideTableDragPos);
    setGridCol1Width(tplConfig?.gridCol1Width || defaults.gridCol1Width);
    setGridCol2Width(tplConfig?.gridCol2Width || defaults.gridCol2Width);
    setDeductCol1Width(tplConfig?.deductCol1Width || defaults.deductCol1Width);
    setDeductCol2Width(tplConfig?.deductCol2Width || defaults.deductCol2Width);
    setDeductCol4Width(tplConfig?.deductCol4Width || defaults.deductCol4Width);
    setLogoPos(tplConfig?.logoPos || defaults.logoPos);

    // Synchronize dynamic text configuration
    const defaultTexts = getDefaultTexts(activeForm);
    const mergedTexts: MemoTexts = {
      ...defaultTexts,
      ...(tplConfig?.memoTexts || {})
    };
    setMemoTexts(mergedTexts);

    // Populate Grid Rows: keep the template's rows structure and fill in the active membership's dynamic values
    const templateRowsSource = (tplConfig?.gridRows && Array.isArray(tplConfig.gridRows) && tplConfig.gridRows.length > 0)
      ? tplConfig.gridRows
      : defaults.gridRows;

    const populatedGridRows = templateRowsSource.map((gRow: any) => {
      const label = gRow.label || '';
      const fallbackUnit = r?.currency || (activeForm === 'international' ? '' : 'جم');
      const unit = gRow.unit !== undefined ? gRow.unit : fallbackUnit;
      const isBold = gRow.isBold || false;
      const val1 = resolveGridRowValue(label, r, gRow.val1 || '');
      return { ...gRow, label, val1, unit, isBold };
    });
    setGridRows(populatedGridRows);

    // Populate Deduction Rows: keep the template's deductions structure and fill in active membership's calculated fees
    const templateDeductSource = (tplConfig?.deductRows && Array.isArray(tplConfig.deductRows) && tplConfig.deductRows.length > 0)
      ? tplConfig.deductRows
      : defaults.deductRows;

    const populatedDeductRows = templateDeductSource.map((dRow: any, idx: number) => {
      const tag = dRow.tag || 'خصم';
      const desc = dRow.desc || '';
      const fallbackDeductUnit = r?.currency || (activeForm === 'international' ? 'ريال سعودى' : 'جم');
      const unit = dRow.unit !== undefined ? dRow.unit : fallbackDeductUnit;
      const isBold = dRow.isBold || false;

      const resolved = resolveDeductRowAmount(tag, desc, idx, templateDeductSource.length, activeForm, r, dRow.amount || '');
      const amount = resolved.amount;
      const finalDesc = resolved.desc || desc;

      return { tag, amount, unit, desc: finalDesc, isBold };
    });
    setDeductRows(populatedDeductRows);

    // Exceptions strictly isolated per template
    let loadedExceptions: string[] = [];
    if (r) {
      if (r.exceptions) {
        const parts = r.exceptions.split(/[,;\n\-–|]+/).map((s: string) => s.trim()).filter(Boolean);
        parts.forEach((p: string) => {
          const formatted = p.startsWith('(') && p.endsWith(')') ? p : `(${p})`;
          if (!loadedExceptions.includes(formatted)) loadedExceptions.push(formatted);
        });
      } else if (r.exceptionType && r.exceptionType !== 'لا يوجد' && r.exceptionType !== '—') {
        const p = r.exceptionType.trim();
        const formatted = p.startsWith('(') && p.endsWith(')') ? p : `(${p})`;
        loadedExceptions.push(formatted);
      } else if (r.isException) {
        loadedExceptions.push('(بدون خصم مصاريف ادارية)');
      }
    }
    if (loadedExceptions.length === 0 && tplConfig?.exceptions && Array.isArray(tplConfig.exceptions)) {
      loadedExceptions = tplConfig.exceptions;
    }
    setExceptions(loadedExceptions);

    // Restore line styles (paddings, text alignment, weights, colors) strictly from master template config
    if (sheetRef.current) {
      requestAnimationFrame(() => {
        if (!sheetRef.current) return;
        const selectableLines = sheetRef.current.querySelectorAll('.field-line, .note-line, .id-row, table tr, table td, table th');
        selectableLines.forEach((el, index) => {
          const styleObj = tplConfig?.lineStyles ? tplConfig.lineStyles[`line_${index}`] : null;
          const htmlEl = el as HTMLElement;
          if (styleObj) {
            if (styleObj.paddingInlineStart !== undefined) htmlEl.style.paddingInlineStart = styleObj.paddingInlineStart;
            if (styleObj.paddingInlineEnd !== undefined) htmlEl.style.paddingInlineEnd = styleObj.paddingInlineEnd;
            if (styleObj.textAlign !== undefined) htmlEl.style.textAlign = styleObj.textAlign;
            if (styleObj.fontWeight !== undefined) htmlEl.style.fontWeight = styleObj.fontWeight;
            if (styleObj.color !== undefined) htmlEl.style.color = styleObj.color;
            if (styleObj.backgroundColor !== undefined) htmlEl.style.backgroundColor = styleObj.backgroundColor;
          }
        });
      });
    }

  }, [activeRequest, activeForm]);

  const handleUpdateExceptions = (newExceptions: string[]) => {
    setExceptions(newExceptions);
    // Update localStorage strictly for current active form
    const reqSavedKey = `memo_saved_${activeRequest?.id || 'general'}_${activeForm}`;
    const tplSavedKey = `memo_tpl_config_${activeForm}`;
    try {
      const saved = localStorage.getItem(reqSavedKey) || localStorage.getItem(tplSavedKey);
      const parsed = saved ? JSON.parse(saved) : {};
      const updated = { ...parsed, exceptions: newExceptions, savedAt: new Date().toISOString() };
      localStorage.setItem(reqSavedKey, JSON.stringify(updated));
      localStorage.setItem(tplSavedKey, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  // Adjust style variables
  const adjustVar = (type: 'font' | 'gap' | 'cellV' | 'cellH' | 'margin', delta: number) => {
    if (type === 'font') setFontSize(prev => Math.min(22, Math.max(9, prev + delta)));
    if (type === 'gap') setSectionGap(prev => Math.min(24, Math.max(0, prev + delta)));
    if (type === 'cellV') setCellPaddingV(prev => Math.min(16, Math.max(0, prev + delta)));
    if (type === 'cellH') setCellPaddingH(prev => Math.min(24, Math.max(0, prev + delta)));
    if (type === 'margin') setTableMargin(prev => Math.min(24, Math.max(0, prev + delta)));
  };

  const resetVars = () => {
    setFontSize(13.5);
    setSectionGap(8);
    setCellPaddingV(4);
    setCellPaddingH(8);
    setTableMargin(8);
    setTableBorderWidth('1px');
    setTableBorderColor('#666666');
    if (selectedLineRef) {
      selectedLineRef.classList.remove('selected-line');
      setSelectedLineRef(null);
    }
  };

  const adjustLine = (side: 'start' | 'end', delta: number) => {
    if (!selectedLineRef) {
      alert('دوس الأول على السطر اللي عايز تظبطه (هيتلوّن برتقالي) وبعدين استخدم الأزرار.');
      return;
    }
    const prop = side === 'start' ? 'paddingInlineStart' : 'paddingInlineEnd';
    const current = parseFloat(selectedLineRef.style[prop]) || 0;
    let next = Math.max(0, current + delta);
    selectedLineRef.style[prop] = next + 'px';
  };

  // Add / Remove rows
  const addGridRow = () => {
    setGridRows(prev => [...prev, { label: 'بند جديد', val1: '' }]);
  };
  const removeGridRow = () => {
    setGridRows(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const addDeductRow = () => {
    setDeductRows(prev => [...prev, { tag: 'خصم', amount: '', unit: 'جم', desc: 'خصم جديد' }]);
  };
  const removeDeductRow = () => {
    setDeductRows(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  // Exceptions Actions
  const addException = () => {
    const updated = [...exceptions, '(استثناء جديد)'];
    handleUpdateExceptions(updated);
  };
  const removeException = () => {
    if (exceptions.length > 0) {
      const updated = exceptions.slice(0, -1);
      handleUpdateExceptions(updated);
    }
  };
  const removeExceptionAtIndex = (idx: number) => {
    const updated = exceptions.filter((_, i) => i !== idx);
    handleUpdateExceptions(updated);
  };
  const updateExceptionAtIndex = (idx: number, text: string) => {
    let formatted = text.trim();
    if (formatted && !formatted.startsWith('(')) formatted = `(${formatted}`;
    if (formatted && !formatted.endsWith(')')) formatted = `${formatted})`;
    const updated = [...exceptions];
    updated[idx] = formatted;
    handleUpdateExceptions(updated);
  };

  // Column Resizing Handler
  const startColResize = (e: React.MouseEvent, colKey: string, currentWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    resizingCol.current = {
      colKey,
      startX: e.clientX,
      startWidth: currentWidth,
    };
  };

  // Dragging logo handlers
  const handleLogoMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingLogo.current = true;
    const imgEl = e.currentTarget as HTMLElement;
    const sheetRect = sheetRef.current?.getBoundingClientRect();
    const elRect = imgEl.getBoundingClientRect();
    if (sheetRect) {
      dragOffset.current = {
        x: e.clientX - elRect.left,
        y: e.clientY - elRect.top
      };
    }
  };

  // Dragging Side Table handlers
  const handleSideTableMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSideTable.current = true;
    const containerEl = e.currentTarget.closest('.side-table-container') as HTMLElement || e.currentTarget as HTMLElement;
    const wrapperRect = gridWrapperRef.current?.getBoundingClientRect();
    const elRect = containerEl.getBoundingClientRect();
    if (wrapperRect) {
      sideTableDragOffset.current = {
        x: e.clientX - elRect.left,
        y: e.clientY - elRect.top,
      };
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingLogo.current && sheetRef.current) {
        const sheetRect = sheetRef.current.getBoundingClientRect();
        const left = e.clientX - sheetRect.left - dragOffset.current.x;
        const top = e.clientY - sheetRect.top - dragOffset.current.y;
        setLogoPos({ top, left });
        return;
      }

      if (isDraggingSideTable.current && gridWrapperRef.current) {
        const wrapperRect = gridWrapperRef.current.getBoundingClientRect();
        const left = e.clientX - wrapperRect.left - sideTableDragOffset.current.x;
        const top = e.clientY - wrapperRect.top - sideTableDragOffset.current.y;
        setSideTableDragPos({ top, left });
        return;
      }

      if (resizingCol.current) {
        const { colKey, startX, startWidth } = resizingCol.current;
        // In RTL layout, pulling left (e.clientX < startX) expands width
        const delta = startX - e.clientX;
        const newWidth = Math.max(30, startWidth + delta);

        if (colKey === 'gridCol1') setGridCol1Width(newWidth);
        if (colKey === 'gridCol2') setGridCol2Width(newWidth);
        if (colKey === 'cashCol') setCashColWidth(newWidth);
        if (colKey === 'visaCol') setVisaColWidth(newWidth);
        if (colKey === 'deductCol1') setDeductCol1Width(newWidth);
        if (colKey === 'deductCol2') setDeductCol2Width(newWidth);
        if (colKey === 'deductCol4') setDeductCol4Width(newWidth);
      }
    };

    const handleMouseUp = () => {
      isDraggingLogo.current = false;
      isDraggingSideTable.current = false;
      resizingCol.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Handle line selection click inside sheet
  const handleSheetClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const selectable = target.closest('.field-line, .note-line, .id-row, tr') as HTMLElement;
    if (!selectable || target.closest('.row-controls') || target.closest('.toolbar')) return;

    if (selectedLineRef) {
      selectedLineRef.classList.remove('selected-line');
    }
    if (selectedLineRef === selectable) {
      setSelectedLineRef(null);
      return;
    }
    selectable.classList.add('selected-line');
    setSelectedLineRef(selectable);
  };

  // Toggle Side Table (Small cash/visa table)
  const toggleSideTable = () => {
    setShowSideTable(prev => {
      const next = !prev;
      if (!next) {
        setSideTablePosition('none');
      } else {
        setSideTablePosition('right');
      }
      return next;
    });
  };

  // Set all currency units across all tables
  const setAllCurrencyUnits = (cur: string) => {
    setGridRows(prev => prev.map(r => ({ ...r, unit: r.label === 'طريقة السداد' ? '' : cur })));
    setDeductRows(prev => prev.map(r => ({ ...r, unit: cur })));
  };

  // Remove currency units from all tables
  const clearAllCurrencyUnits = () => {
    setAllCurrencyUnits('');
  };

  // Set currency unit to SAR (ريال سعودي) for International form refund row
  const setSARCurrencyUnit = () => {
    setAllCurrencyUnits('ريال سعودى');
  };

  // Restore EGP (جم) currency unit to all tables
  const restoreEGPCurrencyUnit = () => {
    setAllCurrencyUnits('جم');
  };

  // Toggle bold formatting on selected line, row, or active text selection
  const toggleBoldSelection = () => {
    if (selectedLineRef) {
      const isCurrentlyBold = selectedLineRef.style.fontWeight === 'bold' || selectedLineRef.style.fontWeight === '700';
      const newWeight = isCurrentlyBold ? 'normal' : 'bold';
      const isBold = !isCurrentlyBold;

      selectedLineRef.style.fontWeight = newWeight;
      selectedLineRef.querySelectorAll('td, th, span, p, div, .label, .value, .label-cell, .val-cell, .tag, .desc, .amount').forEach((el) => {
        (el as HTMLElement).style.fontWeight = newWeight;
      });

      // Also update React state if selected element is a table row
      if (selectedLineRef.tagName === 'TR') {
        const table = selectedLineRef.closest('table');
        if (table?.id === 'grid-table') {
          const rowIndex = Array.from(table.querySelectorAll('tbody tr')).indexOf(selectedLineRef);
          if (rowIndex !== -1) {
            setGridRows(prev => prev.map((r, idx) => idx === rowIndex ? { ...r, isBold } : r));
          }
        } else if (table?.id === 'deduct-table') {
          const rowIndex = Array.from(table.querySelectorAll('tbody tr')).indexOf(selectedLineRef);
          if (rowIndex !== -1) {
            setDeductRows(prev => prev.map((r, idx) => idx === rowIndex ? { ...r, isBold } : r));
          }
        }
      }
    } else {
      execCmd('bold');
    }
  };

  // Save Memo Customizations strictly and permanently for current active form template across all memberships
  const handleSaveMemoCustomizations = () => {
    if (selectedLineRef) {
      selectedLineRef.classList.remove('selected-line');
      setSelectedLineRef(null);
    }
    const currentForm = activeForm;
    const reqSavedKey = `memo_saved_${activeRequest?.id || 'general'}_${currentForm}`;
    const tplSavedKey = `memo_tpl_config_${currentForm}`;

    // Read live text changes directly from the DOM sheet if user edited them inline
    const sheet = sheetRef.current;
    let currentTexts: MemoTexts = { ...memoTexts };
    let currentGridRows = [...gridRows];
    let currentDeductRows = [...deductRows];

    if (sheet) {
      const l1El = sheet.querySelector('.title-box .l1');
      const l2El = sheet.querySelector('.title-box .l2');
      const toLbl = sheet.querySelector('.to-field-line .label');
      const toVal = sheet.querySelector('.to-field-line .value');
      const subLbl = sheet.querySelector('.subject-field-line .label');
      const subVal = sheet.querySelector('.subject-field-line .value');
      const nameLbl = sheet.querySelector('.name-field-line .label');
      const memLbl = sheet.querySelector('.mem-field-line .label');
      const loanLbl = sheet.querySelector('.loan-field-line .label');
      const accLbl = sheet.querySelector('.account-field-line .label');
      const subDateLbl = sheet.querySelector('.subdate-field-line .label');
      const reqDateLbl = sheet.querySelector('.reqdate-field-line .label');
      const receiptsNoteEl = sheet.querySelector('.receipts-note-prefix');
      const receiptsCountEl = sheet.querySelector('.receipts-count-label');
      const commPrefixEl = sheet.querySelector('.committee-note-prefix');
      const commYearEl = sheet.querySelector('.committee-note-year');
      const salesDeptEl = sheet.querySelector('.sales-dept-note-text');
      const signNameEl = sheet.querySelector('.sign-name-text');

      currentTexts = {
        ...currentTexts,
        titleL1: l1El?.textContent?.trim() || currentTexts.titleL1,
        titleL2: l2El?.textContent?.trim() || currentTexts.titleL2,
        toLabel: toLbl?.textContent?.trim() || currentTexts.toLabel,
        toText: toVal?.textContent?.trim() || currentTexts.toText,
        subjectLabel: subLbl?.textContent?.trim() || currentTexts.subjectLabel,
        subjectText: subVal?.textContent?.trim() || currentTexts.subjectText,
        nameLabel: nameLbl?.textContent?.trim() || currentTexts.nameLabel,
        membershipNumLabel: memLbl?.textContent?.trim() || currentTexts.membershipNumLabel,
        loanLabel: loanLbl?.textContent?.trim() || currentTexts.loanLabel,
        accountNumberLabel: accLbl?.textContent?.trim() || currentTexts.accountNumberLabel,
        subDateLabel: subDateLbl?.textContent?.trim() || currentTexts.subDateLabel,
        reqDateLabel: reqDateLbl?.textContent?.trim() || currentTexts.reqDateLabel,
        receiptsNote: receiptsNoteEl?.textContent?.trim() || currentTexts.receiptsNote,
        receiptsCountLabel: receiptsCountEl?.textContent?.trim() || currentTexts.receiptsCountLabel,
        committeeNotePrefix: commPrefixEl?.textContent?.trim() || currentTexts.committeeNotePrefix,
        committeeNoteYear: commYearEl?.textContent?.trim() || currentTexts.committeeNoteYear,
        salesDeptNote: salesDeptEl?.textContent?.trim() || currentTexts.salesDeptNote,
        signName: signNameEl?.textContent?.replace(/\u00a0/g, ' ')?.trim() || currentTexts.signName,
      };

      // Capture table labels, units, bold status from DOM if updated
      const gridTrs = sheet.querySelectorAll('#grid-table tbody tr');
      if (gridTrs.length > 0) {
        currentGridRows = currentGridRows.map((gRow, idx) => {
          const tr = gridTrs[idx];
          if (!tr) return gRow;
          const labelCell = tr.querySelector('.label-cell');
          const unitCell = tr.querySelector('.unit-cell');
          const txt = labelCell ? (labelCell.childNodes[0]?.textContent || labelCell.textContent || '').trim() : '';
          const unitTxt = unitCell ? unitCell.textContent?.trim() : undefined;
          const isBold = (tr as HTMLElement).style.fontWeight === 'bold' || (labelCell as HTMLElement)?.style.fontWeight === 'bold' || gRow.isBold || false;
          return {
            ...gRow,
            label: txt || gRow.label,
            unit: unitTxt !== undefined ? unitTxt : gRow.unit,
            isBold
          };
        });
      }

      const deductTrs = sheet.querySelectorAll('#deduct-table tbody tr');
      if (deductTrs.length > 0) {
        currentDeductRows = currentDeductRows.map((dRow, idx) => {
          const tr = deductTrs[idx];
          if (!tr) return dRow;
          const tagCell = tr.querySelector('.tag');
          const unitCell = tr.querySelector('.unit-cell');
          const descCell = tr.querySelector('.desc');
          const tagTxt = tagCell ? (tagCell.childNodes[0]?.textContent || tagCell.textContent || '').trim() : '';
          const unitTxt = unitCell ? unitCell.textContent?.trim() : undefined;
          const descTxt = descCell ? (descCell.childNodes[0]?.textContent || descCell.textContent || '').trim() : '';
          const isBold = (tr as HTMLElement).style.fontWeight === 'bold' || (tagCell as HTMLElement)?.style.fontWeight === 'bold' || dRow.isBold || false;
          return {
            ...dRow,
            tag: tagTxt || dRow.tag,
            unit: unitTxt !== undefined ? unitTxt : dRow.unit,
            desc: descTxt || dRow.desc,
            isBold
          };
        });
      }
    }

    setMemoTexts(currentTexts);
    setGridRows(currentGridRows);
    setDeductRows(currentDeductRows);

    // Collect line styles from sheet
    const lineStyles: Record<string, { paddingInlineStart?: string; paddingInlineEnd?: string; textAlign?: string; fontWeight?: string; color?: string; backgroundColor?: string }> = {};
    if (sheetRef.current) {
      const selectableLines = sheetRef.current.querySelectorAll('.field-line, .note-line, .id-row, table tr, table td, table th');
      selectableLines.forEach((el, index) => {
        const htmlEl = el as HTMLElement;
        const pStart = htmlEl.style.paddingInlineStart;
        const pEnd = htmlEl.style.paddingInlineEnd;
        const tAlign = htmlEl.style.textAlign;
        const fWeight = htmlEl.style.fontWeight;
        const color = htmlEl.style.color;
        const bg = htmlEl.style.backgroundColor;
        if (pStart || pEnd || tAlign || fWeight || color || bg) {
          lineStyles[`line_${index}`] = {
            paddingInlineStart: pStart || undefined,
            paddingInlineEnd: pEnd || undefined,
            textAlign: tAlign || undefined,
            fontWeight: fWeight || undefined,
            color: color || undefined,
            backgroundColor: bg || undefined,
          };
        }
      });
    }

    const resolvedShowSide = showSideTable && sideTablePosition !== 'none';
    const customData = {
      formType: currentForm,
      fontFamily,
      fontSize,
      sectionGap,
      cellPaddingV,
      cellPaddingH,
      tableMargin,
      tableBorderWidth,
      tableBorderColor,
      showSideTable: resolvedShowSide,
      sideTablePosition: resolvedShowSide ? (sideTablePosition !== 'none' ? sideTablePosition : 'right') : 'none',
      sideTableTopOffset,
      sideTableGap,
      sideTableWidth,
      cashColWidth,
      visaColWidth,
      sideTableDragPos,
      gridCol1Width,
      gridCol2Width,
      deductCol1Width,
      deductCol2Width,
      deductCol4Width,
      logoPos,
      exceptions,
      gridRows: currentGridRows,
      deductRows: currentDeductRows,
      memoTexts: currentTexts,
      lineStyles,
      savedAt: new Date().toISOString()
    };

    try {
      // 1. Save master configuration for this form template profile (applies to all memberships)
      localStorage.setItem(tplSavedKey, JSON.stringify(customData));

      // 2. Also keep current request updated in sync
      localStorage.setItem(reqSavedKey, JSON.stringify(customData));

      setSaveSuccessMsg(`تم تثبيت وحفظ التنسيق والعناوين لنموذج (${getFormName(currentForm)}) ليتم تطبيقها تلقائياً على كل العضويات! 💾✨`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (e) {
      console.error(e);
      setSaveSuccessMsg(`تم حفظ وتثبيت تنسيق ${getFormShortName(currentForm)} بنجاح.`);
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    }
  };

  // Switch form and clear line selection
  const switchForm = (newForm: 'companies' | 'international' | 'normal' | 'diff') => {
    isFormManuallySelected.current = true;
    if (selectedLineRef) {
      selectedLineRef.classList.remove('selected-line');
      setSelectedLineRef(null);
    }
    setActiveForm(newForm);
  };

  // Reset Memo Customizations strictly for current active form
  const handleResetMemoCustomizations = () => {
    const currentForm = activeForm;
    const reqSavedKey = `memo_saved_${activeRequest?.id || 'general'}_${currentForm}`;
    const tplSavedKey = `memo_tpl_config_${currentForm}`;

    localStorage.removeItem(reqSavedKey);
    localStorage.removeItem(tplSavedKey);

    const defaults = getDefaultTemplateState(currentForm, activeRequest);
    const defaultTexts = getDefaultTexts(currentForm);
    setMemoTexts(defaultTexts);
    setFontFamily(defaults.fontFamily || 'Calibri');
    setFontSize(defaults.fontSize);
    setSectionGap(defaults.sectionGap);
    setCellPaddingV(defaults.cellPaddingV);
    setCellPaddingH(defaults.cellPaddingH);
    setTableMargin(defaults.tableMargin);
    setTableBorderWidth(defaults.tableBorderWidth);
    setTableBorderColor(defaults.tableBorderColor);
    setShowSideTable(defaults.showSideTable);
    setSideTablePosition(defaults.sideTablePosition);
    setSideTableTopOffset(defaults.sideTableTopOffset);
    setSideTableGap(defaults.sideTableGap);
    setSideTableWidth(defaults.sideTableWidth);
    setCashColWidth(defaults.cashColWidth);
    setVisaColWidth(defaults.visaColWidth);
    setSideTableDragPos(defaults.sideTableDragPos);
    setGridCol1Width(defaults.gridCol1Width);
    setGridCol2Width(defaults.gridCol2Width);
    setDeductCol1Width(defaults.deductCol1Width);
    setDeductCol2Width(defaults.deductCol2Width);
    setDeductCol4Width(defaults.deductCol4Width);
    setLogoPos(defaults.logoPos);
    setGridRows(defaults.gridRows);
    setDeductRows(defaults.deductRows);
    setExceptions([]);

    if (selectedLineRef) {
      selectedLineRef.classList.remove('selected-line');
      setSelectedLineRef(null);
    }

    setSaveSuccessMsg(`تمت إعادة ضبط نموذج (${getFormName(currentForm)}) للوضع التلقائي بنجاح! 🔄`);
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  // Filter requests for selector
  const filteredRequests = requests.filter(r => {
    if (user?.role === 'club' && !isSameClub(r.club, user.club)) return false;
    if (user?.role === 'international_user' && !isInternationalRequest(r)) return false;
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      (r.membershipNumber || '').toLowerCase().includes(term) ||
      (r.memberName || '').toLowerCase().includes(term) ||
      (r.paymentMethod || '').toLowerCase().includes(term)
    );
  });

  const todayStr = formatDateNumeric(new Date());

  const handlePrintMemo = () => {
    if (selectedLineRef) {
      selectedLineRef.classList.remove('selected-line');
      setSelectedLineRef(null);
    }
    const sheetEl = sheetRef.current || document.getElementById('sheet');
    printElement(sheetEl, `مذكرة إلغاء - ${getFormShortName(activeForm)} - ${activeRequest?.membershipNumber || ''}`);
  };

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      {/* Top Header & Navigation */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Printer className="h-5 w-5 text-amber-500" />
            <span>طباعة المذكرة (Memo Print Center)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            اختر نوع النموذج والمشترك لطباعة وتخصيص المذكرة الداخلية مباشرة.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-all flex items-center gap-1"
            >
              <ArrowRight className="h-4 w-4" />
              <span>رجوع</span>
            </button>
          )}

          {/* Direct Print Button */}
          <button
            type="button"
            onClick={handlePrintMemo}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-black text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
            title="طباعة فورية للمذكرة بحجم A4"
          >
            <Printer className="h-4 w-4" />
            <span>طباعة المذكرة</span>
          </button>
        </div>
      </div>

      {/* Selector for 4 Forms */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3 no-print">
        <span className="block text-xs font-bold text-slate-500">اختر نوع نموذج المذكرة (4 أشكال):</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Form 1: Companies Form */}
          <button
            onClick={() => switchForm('companies')}
            className={`p-3.5 rounded-xl border-2 text-right transition-all cursor-pointer ${
              activeForm === 'companies'
                ? 'border-amber-400 bg-amber-50/80 shadow-xs'
                : 'border-slate-100 bg-slate-50 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-black text-xs text-slate-900">Companies Form</span>
              <Building2 className={`h-4 w-4 ${activeForm === 'companies' ? 'text-amber-500' : 'text-slate-400'}`} />
            </div>
            <span className="text-[11px] text-slate-500 block leading-tight">
              خاصة بطريقة الدفع شركات وبنوك (ABK & المشرق والشركات)
            </span>
          </button>

          {/* Form 2: International Form */}
          <button
            onClick={() => switchForm('international')}
            className={`p-3.5 rounded-xl border-2 text-right transition-all cursor-pointer ${
              activeForm === 'international'
                ? 'border-amber-400 bg-amber-50/80 shadow-xs'
                : 'border-slate-100 bg-slate-50 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-black text-xs text-slate-900">International Form</span>
              <Globe className={`h-4 w-4 ${activeForm === 'international' ? 'text-amber-500' : 'text-slate-400'}`} />
            </div>
            <span className="text-[11px] text-slate-500 block leading-tight">
              خاصة بالعضويات الدولية (International) بالريال السعودي
            </span>
          </button>

          {/* Form 3: Normal Form */}
          <button
            onClick={() => switchForm('normal')}
            className={`p-3.5 rounded-xl border-2 text-right transition-all cursor-pointer ${
              activeForm === 'normal'
                ? 'border-amber-400 bg-amber-50/80 shadow-xs'
                : 'border-slate-100 bg-slate-50 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-black text-xs text-slate-900">Normal Form</span>
              <FileText className={`h-4 w-4 ${activeForm === 'normal' ? 'text-amber-500' : 'text-slate-400'}`} />
            </div>
            <span className="text-[11px] text-slate-500 block leading-tight">
              المذكرة العادية (نقداً / شيكات / فيزا تقليدية)
            </span>
          </button>

          {/* Form 4: Diff Form */}
          <button
            onClick={() => switchForm('diff')}
            className={`p-3.5 rounded-xl border-2 text-right transition-all cursor-pointer ${
              activeForm === 'diff'
                ? 'border-amber-400 bg-amber-50/80 shadow-xs'
                : 'border-slate-100 bg-slate-50 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-black text-xs text-slate-900">Diff Form</span>
              <FileCheck className={`h-4 w-4 ${activeForm === 'diff' ? 'text-amber-500' : 'text-slate-400'}`} />
            </div>
            <span className="text-[11px] text-slate-500 block leading-tight">
              مذكرة تسوية فروق العضوية والتعديلات الاستثنائية
            </span>
          </button>
        </div>
      </div>

      {/* Select Request Picker */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2 no-print">
        <label className="block text-xs font-bold text-slate-700">تحديد العضوية لملء البيانات تلقائياً:</label>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث برقم العضوية أو اسم المشترك..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pr-9 pl-3 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <select
            value={selectedReqId || ''}
            onChange={(e) => setSelectedReqId(e.target.value ? Number(e.target.value) : null)}
            className="w-full sm:w-80 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 font-bold"
          >
            <option value="">-- اختر عضوية من القائمة --</option>
            {filteredRequests.map(r => (
              <option key={r.id} value={r.id}>
                {r.membershipNumber} - {r.memberName} ({r.paymentMethod})
              </option>
            ))}
          </select>
        </div>
        {activeRequest && (
          <div className="text-xxs font-bold text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded-lg flex items-center justify-between">
            <span>
              العضوية المحددة حالياً: <span className="font-black text-slate-900">{activeRequest.membershipNumber} - {activeRequest.memberName}</span> | طريقة السداد: <span className="font-black text-slate-900">{activeRequest.paymentMethod}</span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedReqId(null)}
              className="text-rose-600 hover:underline cursor-pointer"
            >
              إلغاء التحديد
            </button>
          </div>
        )}
      </div>

      {/* Top Action Bar for Memo Customization & Direct Save */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsToolbarOpen(prev => !prev)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold text-xs cursor-pointer transition-all border ${
              isToolbarOpen
                ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs'
                : 'bg-slate-900 text-white hover:bg-slate-800 border-slate-900 shadow-xs'
            }`}
            title="فتح أو إغلاق شريط أدوات وتخصيص المذكرة"
          >
            <Sliders className="h-4 w-4" />
            <span>{isToolbarOpen ? 'إغلاق شريط أدوات التعديل ✕' : 'تعديلات وتخصيص المذكرة ⚙️'}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveMemoCustomizations}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all"
            title={`تثبيت وحفظ التنسيق والتعديلات لنموذج (${getFormName(activeForm)}) ليتم تطبيقها تلقائياً على كل العضويات المختارة`}
          >
            <Save className="h-4 w-4" />
            <span>حفظ وتثبيت تنسيق {getFormShortName(activeForm)} (Save)</span>
          </button>

          <button
            type="button"
            onClick={handleResetMemoCustomizations}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-all"
            title={`إعادة ضبط (${getFormName(activeForm)}) للوضع التلقائي`}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>إعادة ضبط {getFormShortName(activeForm)}</span>
          </button>
        </div>

        {saveSuccessMsg && (
          <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold animate-fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        <div className="text-xxs text-slate-600 font-medium mr-auto bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
          🎯 التنسيق والتعديلات المحفوظة تُطبّق تلقائياً على <strong className="text-slate-900 underline">كل العضويات المختارة على نموذج {getFormShortName(activeForm)}</strong>.
        </div>
      </div>

      {/* ================= FORM CONTENT AREA ================= */}

      {(activeForm === 'companies' || activeForm === 'international' || activeForm === 'normal' || activeForm === 'diff') && (
        <div className="companies-form-container">
          {/* Custom Styles Injector for Memo Forms */}
          <style>{`
            :root {
              --font-size: ${fontSize}px;
              --font-family: ${fontFamily};
              --section-gap: ${sectionGap}px;
              --cell-padding-v: ${cellPaddingV}px;
              --cell-padding-h: ${cellPaddingH}px;
              --table-margin: ${tableMargin}px;
              --tbl-border-w: ${tableBorderWidth};
              --tbl-border-c: ${tableBorderColor};
            }
            @page { size: A4; margin: 12mm; }
            .sheet-companies {
              font-family: var(--font-family, 'Calibri'), 'Calibri', 'Arial', sans-serif;
              font-size: var(--font-size);
              direction: rtl;
              background: #fff;
              max-width: 780px;
              margin: 0 auto;
              border: 3px solid #000;
              padding: 14px 22px 0 22px;
              position: relative;
              box-sizing: border-box;
              color: #000;
            }
            .logo-placeholder { height: 74px; }
            .draggable-img {
              position: absolute;
              cursor: move;
              user-select: none;
              touch-action: none;
            }
            .draggable-img.dragging {
              outline: 2px dashed #0057a3;
            }
            .logo-row {
              display: flex;
              justify-content: flex-start;
              margin-bottom: 6px;
            }
            .logo { height: 68px; }

            .title-box-row {
              display: flex;
              justify-content: center;
              margin-bottom: var(--section-gap);
            }
            .title-box {
              border: 1px solid #999;
              border-radius: 10px;
              padding: 6px 22px;
              text-align: center;
            }
            .title-box .l1 { font-weight: bold; font-size: 1.1em; }
            .title-box .l2 { font-weight: bold; font-size: 0.95em; margin-top: 2px; }

            .field-block { margin: var(--section-gap) 0; }
            .field-line {
              display: flex;
              align-items: center;
              gap: 6px;
              margin: 5px 0;
              font-weight: bold;
            }
            .field-line .value { font-weight: normal; }
            .id-row { display:flex; justify-content: space-between; align-items:center; }
            .placeholder { color:#0057a3; }

            /* Enforce No Wrap text across all tables to protect overall document formatting */
            table, table tr, table th, table td {
              white-space: nowrap !important;
            }

            table.grid {
              width: 100%;
              border-collapse: collapse;
              margin: var(--table-margin) 0;
            }
            table.grid th, table.grid td {
              border: var(--tbl-border-w) solid var(--tbl-border-c);
              padding: var(--cell-padding-v) var(--cell-padding-h);
              text-align: center;
              font-size: 0.96em;
              white-space: nowrap !important;
            }
            table.grid th { font-weight: bold; background: #fafafa; white-space: nowrap !important; }
            .label-cell {
              text-align: center;
              font-weight: bold;
              white-space: nowrap !important;
              width: ${gridCol1Width}px;
              min-width: 40px;
              position: relative;
            }
            .val-cell {
              text-align: center;
              white-space: nowrap !important;
              width: ${gridCol2Width}px;
              min-width: 40px;
              position: relative;
            }
            .unit-cell { color:#333; white-space: nowrap !important; }

            .grid-table-wrapper {
              position: relative;
              display: flex;
              flex-direction: ${sideTablePosition === 'left' ? 'row-reverse' : sideTablePosition === 'top' ? 'column-reverse' : sideTablePosition === 'bottom' ? 'column' : 'row'};
              align-items: flex-start;
              gap: ${sideTableGap}px;
              margin: var(--table-margin) 0;
            }
            .grid-table-wrapper table.grid {
              flex: 1;
              margin: 0;
              border-collapse: collapse;
            }

            .side-table-container {
              position: ${sideTableDragPos ? 'absolute' : 'relative'};
              ${sideTableDragPos ? `top: ${sideTableDragPos.top}px; left: ${sideTableDragPos.left}px; z-index: 20;` : ''}
              flex-shrink: 0;
            }

            .side-table-drag-handle {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 4px;
              background: #334155;
              color: #fbbf24;
              font-size: 11px;
              font-weight: bold;
              padding: 2px 6px;
              border-radius: 4px 4px 0 0;
              cursor: grab;
              user-select: none;
              border: 1px dashed #fbbf24;
              margin-bottom: 2px;
            }
            .side-table-drag-handle:active {
              cursor: grabbing;
              background: #1e293b;
            }

            .side-cash-visa-table {
              border-collapse: collapse;
              margin: 0;
              margin-top: ${(!sideTableDragPos && (sideTablePosition === 'right' || sideTablePosition === 'left')) ? sideTableTopOffset : 0}px;
              width: ${sideTableWidth}px;
              min-width: ${sideTableWidth}px;
              flex-shrink: 0;
            }
            .side-cash-visa-table th, .side-cash-visa-table td {
              border: var(--tbl-border-w) solid var(--tbl-border-c);
              padding: var(--cell-padding-v) 10px;
              text-align: center;
              font-size: 0.96em;
              border-inline-start: none;
              position: relative;
              white-space: nowrap !important;
            }
            .side-cash-visa-table th.cash-header, .side-cash-visa-table td.cash-cell {
              width: ${cashColWidth}px;
              min-width: 30px;
              position: relative;
              white-space: nowrap !important;
            }
            .side-cash-visa-table th.visa-header, .side-cash-visa-table td.visa-cell {
              width: ${visaColWidth}px;
              min-width: 30px;
              position: relative;
              white-space: nowrap !important;
            }
            .side-cash-visa-table th {
              background-color: #f8fafc;
              font-weight: bold;
            }

            .note-line { margin: var(--section-gap) 0; line-height:1.8; display:flex; align-items:center; flex-wrap:wrap; gap:8px; }

            table.deduct {
              width: 100%;
              border-collapse: collapse;
              margin: var(--table-margin) 0;
            }
            table.deduct td, table.deduct th {
              border: var(--tbl-border-w) solid var(--tbl-border-c);
              padding: calc(var(--cell-padding-v) + 1px) calc(var(--cell-padding-h) + 2px);
              font-size: 0.96em;
              position: relative;
              white-space: nowrap !important;
            }
            table.deduct td.tag {
              width: ${deductCol1Width}px;
              min-width: 40px;
              text-align: center;
              position: relative;
              white-space: nowrap !important;
            }
            table.deduct td.amount {
              width: ${deductCol2Width}px;
              min-width: 50px;
              text-align: center;
              position: relative;
              white-space: nowrap !important;
            }
            table.deduct td.desc {
              width: ${deductCol4Width}px;
              min-width: 60px;
              text-align: center;
              font-weight: bold;
              position: relative;
              white-space: nowrap !important;
            }

            /* Resizable Column Handle */
            .col-resizer {
              position: absolute;
              top: 0;
              bottom: 0;
              left: -3px;
              width: 7px;
              cursor: col-resize;
              background: transparent;
              z-index: 10;
              user-select: none;
            }
            .col-resizer:hover, .col-resizer:active {
              background: rgba(245, 158, 11, 0.7);
              border-left: 2px solid #d97706;
            }

            .exceptions {
              display: inline-flex;
              gap: 8px;
              flex-wrap: wrap;
            }
            .exception-box {
              border: 1px solid #999;
              border-radius: 10px;
              padding: 2px 10px;
              font-weight: bold;
              text-decoration: underline;
            }
            .plain-note {
              font-weight: bold;
              text-decoration: underline;
            }

            .footer-table {
              width:100%;
              border-collapse: collapse;
              margin-top: var(--table-margin);
            }
            .footer-table td {
              border: var(--tbl-border-w) solid var(--tbl-border-c);
              padding: var(--cell-padding-v) var(--cell-padding-h);
              vertical-align: middle;
              white-space: nowrap !important;
            }
            .footer-table td.lbl { font-weight:bold; width: 190px; text-align:right; }

            .footer-flex {
              display: flex;
              gap: 16px;
              align-items: flex-start;
              margin-top: var(--table-margin);
            }
            .footer-table.narrow {
              width: 58%;
              margin-top: 0;
              flex-shrink: 0;
            }
            .sign-block {
              flex: 1;
              display: flex;
              flex-direction: column;
            }
            .signature-space {
              height: 70px;
              border-bottom: 1px solid #999;
              margin-top: 4px;
            }

            .doc-footer {
              border-top: 2px solid #000;
              margin-top: 20px;
              padding: 10px 0;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 0.85em;
              margin-bottom: 35px;
            }
            .doc-footer .code-col { display:flex; flex-direction:column; gap:2px; text-align:left; direction:ltr; }
            .doc-control-box {
              border: 1.5px solid #e05a5a;
              color:#e05a5a;
              padding: 8px 14px;
              font-size: 0.8em;
              font-weight: 600;
              text-align:center;
            }

            /* Comprehensive Editing Toolbar UI */
            .memo-toolbar {
              max-width: 780px;
              margin: 0 auto 14px auto;
              background: #0f172a;
              color: #f8fafc;
              border-radius: 12px;
              padding: 12px 16px;
              display: flex;
              flex-wrap: wrap;
              gap: 10px;
              align-items: center;
              font-family: system-ui, -apple-system, sans-serif;
              font-size: 12px;
              direction: rtl;
              box-shadow: 0 4px 20px -2px rgba(0,0,0,0.25);
            }
            .memo-toolbar .group-title {
              width: 100%;
              font-weight: 800;
              color: #f59e0b;
              font-size: 11px;
              display: flex;
              align-items: center;
              gap: 4px;
              border-bottom: 1px solid #334155;
              padding-bottom: 4px;
              margin-bottom: 4px;
            }
            .memo-toolbar .group {
              display: flex;
              align-items: center;
              gap: 4px;
              background: #1e293b;
              padding: 4px 8px;
              border-radius: 8px;
              border: 1px solid #334155;
            }
            .memo-toolbar button {
              background: #334155;
              color: #f8fafc;
              border: 1px solid #475569;
              border-radius: 6px;
              padding: 4px 8px;
              cursor: pointer;
              font-size: 12px;
              display: inline-flex;
              align-items: center;
              gap: 4px;
              transition: all 0.15s ease;
            }
            .memo-toolbar button:hover { background: #475569; color: #fff; }
            .memo-toolbar button:active { transform: scale(0.96); }
            .memo-toolbar select, .memo-toolbar input[type="color"] {
              background: #334155;
              color: #fff;
              border: 1px solid #475569;
              border-radius: 6px;
              padding: 3px 6px;
              font-size: 12px;
              cursor: pointer;
            }
            .memo-toolbar .hint {
              width: 100%;
              opacity: 0.8;
              font-size: 11px;
              color: #cbd5e1;
              margin-top: 4px;
            }
            [contenteditable="true"]:hover {
              outline: 1px dashed #38bdf8;
              outline-offset: 1px;
            }
            [contenteditable="true"]:focus {
              outline: 2px solid #0284c7;
              outline-offset: 1px;
              background: #f0f9ff;
            }
            .row-controls {
              display: inline-flex;
              gap: 4px;
              margin-inline-end: 6px;
            }
            .row-controls button {
              background: #eef2f7;
              border: 1px solid #ccc;
              border-radius: 4px;
              font-size: 11px;
              padding: 1px 5px;
              cursor: pointer;
              color: #1f2937;
            }
            .selected-line {
              outline: 2px solid #d97706 !important;
              background: #fff7ed;
            }
            @media print {
              .no-print, .memo-toolbar, .row-controls, .col-resizer, .selected-line { display: none !important; visibility: hidden !important; }
              body { background: #fff !important; padding: 0 !important; }
              .sheet-companies, #sheet {
                border: 3px solid #000 !important;
                width: 190mm !important;
                max-width: 190mm !important;
                min-width: 190mm !important;
                margin: 8mm auto !important;
                padding: 6mm 10mm 4mm 10mm !important;
                box-sizing: border-box !important;
                box-shadow: none !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
            }
          `}</style>

          {/* Interactive Editing Toolbar (Collapsible) */}
          {isToolbarOpen && (
            <div className="memo-toolbar no-print" id="toolbar">
              
              {/* Group 0: Memo Titles & Core Text Customization */}
              <div className="group-title">
                <FileText className="h-3.5 w-3.5 text-amber-400" />
                <span>تخصيص العناوين والنصوص الرئيسية (مباشر ومثبت للنموذج)</span>
              </div>

              <div className="group" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#cbd5e1' }}>عنوان المذكرة (السطر 2):</span>
                <input
                  type="text"
                  value={memoTexts.titleL2}
                  onChange={(e) => setMemoTexts(prev => ({ ...prev, titleL2: e.target.value }))}
                  style={{
                    background: '#0f172a',
                    color: '#fbbf24',
                    border: '1px solid #475569',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '12px',
                    minWidth: '220px',
                    fontWeight: 'bold'
                  }}
                  placeholder="عنوان المذكرة..."
                />
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>خيارات سريعة:</span>
                <button
                  type="button"
                  onClick={() => setMemoTexts(prev => ({ ...prev, titleL2: 'مذكرة داخلية لإلغاء العضوية' }))}
                  style={{ fontSize: '11px', padding: '2px 6px' }}
                  title="تعيين: مذكرة داخلية لإلغاء العضوية"
                >
                  إلغاء العضوية (عام)
                </button>
                <button
                  type="button"
                  onClick={() => setMemoTexts(prev => ({ ...prev, titleL2: 'مذكرة داخلية - إلغاء عضوية دولية' }))}
                  style={{ fontSize: '11px', padding: '2px 6px' }}
                  title="تعيين: مذكرة داخلية - إلغاء عضوية دولية"
                >
                  إلغاء عضوية دولية
                </button>
                <button
                  type="button"
                  onClick={() => setMemoTexts(prev => ({ ...prev, titleL2: 'مذكرة داخلية - طلب فرق عضوية' }))}
                  style={{ fontSize: '11px', padding: '2px 6px' }}
                  title="تعيين: مذكرة داخلية - طلب فرق عضوية"
                >
                  طلب فرق عضوية
                </button>
              </div>

              <div className="group" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#cbd5e1' }}>الجهة الموجه إليها:</span>
                <input
                  type="text"
                  value={memoTexts.toText}
                  onChange={(e) => setMemoTexts(prev => ({ ...prev, toText: e.target.value }))}
                  style={{
                    background: '#0f172a',
                    color: '#fff',
                    border: '1px solid #475569',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '12px',
                    minWidth: '130px'
                  }}
                />
                <span style={{ fontSize: '11px', color: '#cbd5e1', marginInlineStart: '6px' }}>الموضوع:</span>
                <input
                  type="text"
                  value={memoTexts.subjectText}
                  onChange={(e) => setMemoTexts(prev => ({ ...prev, subjectText: e.target.value }))}
                  style={{
                    background: '#0f172a',
                    color: '#fff',
                    border: '1px solid #475569',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '12px',
                    minWidth: '130px'
                  }}
                />
                <span style={{ fontSize: '11px', color: '#cbd5e1', marginInlineStart: '6px' }}>الموقع بالأسفل:</span>
                <input
                  type="text"
                  value={memoTexts.signName || 'صفوت رجائى'}
                  onChange={(e) => setMemoTexts(prev => ({ ...prev, signName: e.target.value }))}
                  style={{
                    background: '#0f172a',
                    color: '#fff',
                    border: '1px solid #475569',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '12px',
                    minWidth: '110px'
                  }}
                />
              </div>

              {/* Group 1: Rich Text Formatting */}
              <div className="group-title">
                <Type className="h-3.5 w-3.5 text-amber-400" />
                <span>تنسيق النصوص والخطوط</span>
              </div>
            
            <div className="group">
              <button type="button" onClick={() => execCmd('bold')} title="غامق (Bold)"><Bold className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => execCmd('italic')} title="مائل (Italic)"><Italic className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => execCmd('underline')} title="تحته خط (Underline)"><Underline className="h-3.5 w-3.5" /></button>
            </div>

            <div className="group">
              <button type="button" onClick={() => execCmd('justifyRight')} title="محاذاة لليمين"><AlignRight className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => execCmd('justifyCenter')} title="محاذاة للوسط"><AlignCenter className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => execCmd('justifyLeft')} title="محاذاة لليسار"><AlignLeft className="h-3.5 w-3.5" /></button>
            </div>

            <div className="group">
              <span>لون الخط:</span>
              <input type="color" defaultValue="#000000" onChange={(e) => execCmd('foreColor', e.target.value)} title="اختر لون النص المحدد" />
            </div>

            <div className="group">
              <span>تظليل:</span>
              <input type="color" defaultValue="#ffffff" onChange={(e) => execCmd('hiliteColor', e.target.value)} title="اختر لون تظليل النص" />
            </div>

            <div className="group">
              <span>نوع الخط:</span>
              <select
                value={fontFamily}
                onChange={(e) => {
                  setFontFamily(e.target.value);
                  applyFontFamily(e.target.value);
                }}
              >
                <option value="Calibri">Calibri</option>
                <option value="Arial">Arial</option>
                <option value="Cairo">Cairo</option>
                <option value="Amiri">Amiri</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Tahoma">Tahoma</option>
              </select>
            </div>

            <div className="group">
              <span>حجم الخط:</span>
              <button type="button" onClick={() => adjustVar('font', -0.5)}>−</button>
              <button type="button" onClick={() => adjustVar('font', 0.5)}>+</button>
            </div>

            {/* Group 2: Table Operations & Layout */}
            <div className="group-title">
              <Table className="h-3.5 w-3.5 text-amber-400" />
              <span>التحكم الكامل بالجداول والأعمدة والحدود</span>
            </div>

            <div className="group">
              <button type="button" onClick={addRowAbove} title="إضافة صف للأعلى"><Plus className="h-3.5 w-3.5" /> صف أعلى</button>
              <button type="button" onClick={addRowBelow} title="إضافة صف للأسفل"><Plus className="h-3.5 w-3.5" /> صف أسفل</button>
              <button type="button" onClick={deleteCurrentRow} title="حذف الصف الحالي" style={{ background: '#7f1d1d' }}><Minus className="h-3.5 w-3.5" /> حذف صف</button>
            </div>

            <div className="group">
              <button type="button" onClick={() => addColumnRightLeft('right')} title="إضافة عمود جهة اليمين"><Grid className="h-3.5 w-3.5" /> + عمود يمين</button>
              <button type="button" onClick={() => addColumnRightLeft('left')} title="إضافة عمود جهة اليسار"><Grid className="h-3.5 w-3.5" /> + عمود يسار</button>
              <button type="button" onClick={deleteCurrentColumn} title="حذف العمود الحالي" style={{ background: '#7f1d1d' }}><Minus className="h-3.5 w-3.5" /> حذف عمود</button>
            </div>

            <div className="group">
              <button type="button" onClick={mergeNextTableCell} title="دمج الخلية الحالية مع الخلية التالية"><Merge className="h-3.5 w-3.5" /> دمج خلايا</button>
              <button type="button" onClick={splitTableCell} title="فك دمج الخلية"><Split className="h-3.5 w-3.5" /> فك دمج</button>
            </div>

            <div className="group">
              <span>خلفية الخلية:</span>
              <input type="color" defaultValue="#ffffff" onChange={(e) => setFocusedCellBg(e.target.value)} title="اختر لون خلفية الخلية المحددة" />
            </div>

            <div className="group">
              <span>حدود الجدول:</span>
              <select onChange={(e) => updateTableBorders(e.target.value, tableBorderColor)} defaultValue={tableBorderWidth}>
                <option value="0px">بدون حدود</option>
                <option value="1px">1px رفيع</option>
                <option value="2px">2px متوسط</option>
                <option value="3px">3px سميك</option>
              </select>
              <input type="color" value={tableBorderColor} onChange={(e) => updateTableBorders(tableBorderWidth, e.target.value)} title="اختر لون حدود الجدول" />
            </div>

            <div className="group">
              <span>تباعد الخلايا:</span>
              <button type="button" onClick={() => adjustVar('cellV', -1)}>−</button>
              <button type="button" onClick={() => adjustVar('cellV', 1)}>+</button>
              <button type="button" onClick={() => adjustVar('cellH', -1)}>أضيق</button>
              <button type="button" onClick={() => adjustVar('cellH', 1)}>أوسع</button>
            </div>

            <div className="group">
              <span>مسافة السطر المحدد:</span>
              <button type="button" onClick={() => adjustLine('start', -2)}>يمين −</button>
              <button type="button" onClick={() => adjustLine('start', 2)}>يمين +</button>
              <button type="button" onClick={() => adjustLine('end', -2)}>يسار −</button>
              <button type="button" onClick={() => adjustLine('end', 2)}>يسار +</button>
            </div>

            {/* Group: Currency and Resizable Columns Controls */}
            <div className="group-title">
              <Grid className="h-3.5 w-3.5 text-amber-400" />
              <span>التحكم بالعملة وعرض أعمدة الجداول (Resizable Columns)</span>
            </div>

            <div className="group">
              <button
                type="button"
                onClick={() => setAllCurrencyUnits('جم')}
                style={{ fontSize: '11px', padding: '2px 8px', background: activeRequest?.currency === 'جم' || !activeRequest?.currency ? '#166534' : undefined, color: '#fff' }}
                title="تطبيق عملة (جم)"
              >
                عملة (جم)
              </button>

              <button
                type="button"
                onClick={() => setAllCurrencyUnits('ريال سعودى')}
                style={{ fontSize: '11px', padding: '2px 8px', background: activeRequest?.currency === 'ريال سعودى' ? '#1e3a8a' : undefined, color: '#fff' }}
                title="تطبيق عملة (ريال سعودى)"
              >
                ريال سعودى
              </button>

              <button
                type="button"
                onClick={() => setAllCurrencyUnits('دولار')}
                style={{ fontSize: '11px', padding: '2px 8px', background: activeRequest?.currency === 'دولار' ? '#075985' : undefined, color: '#fff' }}
                title="تطبيق عملة (دولار)"
              >
                دولار
              </button>

              <button
                type="button"
                onClick={clearAllCurrencyUnits}
                style={{ fontSize: '11px', padding: '2px 8px' }}
                title="حذف رمز العملة من جميع الجداول"
              >
                حذف العملة
              </button>
            </div>

            <div className="group">
              <span>أعمدة الجدول الرئيسي:</span>
              <span style={{ fontSize: '11px', color: '#cbd5e1' }}>عمود البيان:</span>
              <button type="button" onClick={() => setGridCol1Width(prev => Math.max(40, prev - 10))}>أضيق −</button>
              <span style={{ fontSize: '11px', color: '#fbbf24', minWidth: '35px', textAlign: 'center' }}>{gridCol1Width}px</span>
              <button type="button" onClick={() => setGridCol1Width(prev => prev + 10)}>أوسع +</button>

              <span style={{ fontSize: '11px', color: '#cbd5e1', marginInlineStart: '6px' }}>عمود القيمة:</span>
              <button type="button" onClick={() => setGridCol2Width(prev => Math.max(40, prev - 10))}>أضيق −</button>
              <span style={{ fontSize: '11px', color: '#fbbf24', minWidth: '35px', textAlign: 'center' }}>{gridCol2Width}px</span>
              <button type="button" onClick={() => setGridCol2Width(prev => prev + 10)}>أوسع +</button>
            </div>

            <div className="group">
              <span>أعمدة جدول الخصومات:</span>
              <span style={{ fontSize: '11px', color: '#cbd5e1' }}>نوع الخصم:</span>
              <button type="button" onClick={() => setDeductCol1Width(prev => Math.max(30, prev - 5))}>أضيق −</button>
              <span style={{ fontSize: '11px', color: '#fbbf24', minWidth: '35px', textAlign: 'center' }}>{deductCol1Width}px</span>
              <button type="button" onClick={() => setDeductCol1Width(prev => prev + 5)}>أوسع +</button>

              <span style={{ fontSize: '11px', color: '#cbd5e1', marginInlineStart: '6px' }}>المبلغ:</span>
              <button type="button" onClick={() => setDeductCol2Width(prev => Math.max(30, prev - 5))}>أضيق −</button>
              <span style={{ fontSize: '11px', color: '#fbbf24', minWidth: '35px', textAlign: 'center' }}>{deductCol2Width}px</span>
              <button type="button" onClick={() => setDeductCol2Width(prev => prev + 5)}>أوسع +</button>

              <span style={{ fontSize: '11px', color: '#cbd5e1', marginInlineStart: '6px' }}>السبب والبيان:</span>
              <button type="button" onClick={() => setDeductCol4Width(prev => Math.max(50, prev - 10))}>أضيق −</button>
              <span style={{ fontSize: '11px', color: '#fbbf24', minWidth: '35px', textAlign: 'center' }}>{deductCol4Width}px</span>
              <button type="button" onClick={() => setDeductCol4Width(prev => prev + 10)}>أوسع +</button>
            </div>

            {/* Group 3: Exceptions Management */}
            <div className="group-title">
              <Layers className="h-3.5 w-3.5 text-amber-400" />
              <span>إدارة الاستثناءات بالمذكرة</span>
            </div>

            <div className="group">
              <span>استثناء جاهز:</span>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    const val = e.target.value;
                    const formatted = val.startsWith('(') && val.endsWith(')') ? val : `(${val})`;
                    if (!exceptions.includes(formatted)) {
                      handleUpdateExceptions([...exceptions, formatted]);
                    }
                    e.target.value = '';
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>اختر استثناء...</option>
                <option value="(بدون خصم مصاريف ادارية)">(بدون خصم مصاريف ادارية)</option>
                <option value="(اعفاء من مقابل الانتفاع)">(اعفاء من مقابل الانتفاع)</option>
                <option value="(اعفاء من مصاريف الفيزا)">(اعفاء من مصاريف الفيزا)</option>
                <option value="(اعفاء من التجديد السنوي)">(اعفاء من التجديد السنوي)</option>
                <option value="(رد كامل المبلغ بدون خصم)">(رد كامل المبلغ بدون خصم)</option>
              </select>
            </div>

            <div className="group">
              <span>استثناء مخصص:</span>
              <input
                type="text"
                id="custom-ex-input"
                placeholder="اكتب استثناء واضغط إضافة..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (val) {
                      const formatted = val.startsWith('(') && val.endsWith(')') ? val : `(${val})`;
                      if (!exceptions.includes(formatted)) {
                        handleUpdateExceptions([...exceptions, formatted]);
                      }
                      (e.target as HTMLInputElement).value = '';
                    }
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById('custom-ex-input') as HTMLInputElement;
                  if (input && input.value.trim()) {
                    const val = input.value.trim();
                    const formatted = val.startsWith('(') && val.endsWith(')') ? val : `(${val})`;
                    if (!exceptions.includes(formatted)) {
                      handleUpdateExceptions([...exceptions, formatted]);
                    }
                    input.value = '';
                  }
                }}
              >
                + إضافة
              </button>
            </div>
          </div>
        )}

        {/* Paper Sheet Preview */}
        <div className="flex justify-center p-4">
          {/* ================= Companies Form or International Form Sheet ================= */}
          <div
            key={`sheet_${activeForm}`}
            className="sheet-companies shadow-lg"
            contentEditable={true}
            id="sheet"
            ref={sheetRef}
            onClick={handleSheetClick}
            suppressContentEditableWarning={true}
          >
            {/* Wadi Degla Clubs Official Center Logo above إدارة العضويات */}
            <div className="w-full flex justify-center mb-3 pt-2" contentEditable={false}>
              <WadiDeglaLogo size="md" />
            </div>

            <div className="title-box-row">
              <div className="title-box">
                <div
                  className="l1"
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  onBlur={(e) => {
                    const val = e.currentTarget.textContent?.trim();
                    if (val) setMemoTexts(prev => ({ ...prev, titleL1: val }));
                  }}
                >
                  {memoTexts.titleL1}
                </div>
                <div
                  className="l2"
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  onBlur={(e) => {
                    const val = e.currentTarget.textContent?.trim();
                    if (val) setMemoTexts(prev => ({ ...prev, titleL2: val }));
                  }}
                >
                  {memoTexts.titleL2}
                </div>
              </div>
            </div>

            <div className="field-block">
              <div className="field-line to-field-line">
                <span
                  className="label"
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  onBlur={(e) => {
                    const val = e.currentTarget.textContent?.trim();
                    if (val) setMemoTexts(prev => ({ ...prev, toLabel: val }));
                  }}
                >
                  {memoTexts.toLabel}
                </span>
                <span
                  className="value"
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  onBlur={(e) => {
                    const val = e.currentTarget.textContent?.trim();
                    if (val) setMemoTexts(prev => ({ ...prev, toText: val }));
                  }}
                >
                  {memoTexts.toText}
                </span>
              </div>

              <div className="field-line subject-field-line">
                <span
                  className="label"
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  onBlur={(e) => {
                    const val = e.currentTarget.textContent?.trim();
                    if (val) setMemoTexts(prev => ({ ...prev, subjectLabel: val }));
                  }}
                >
                  {memoTexts.subjectLabel}
                </span>
                <span
                  className="value"
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  onBlur={(e) => {
                    const val = e.currentTarget.textContent?.trim();
                    if (val) setMemoTexts(prev => ({ ...prev, subjectText: val }));
                  }}
                >
                  {memoTexts.subjectText}
                </span>
              </div>

              <div className="field-line date-field-line">
                <span className="label">التاريخ :</span>
                <span className="value placeholder">{todayStr}</span>
              </div>

              <div className="id-row">
                <div className="field-line name-field-line">
                  <span
                    className="label"
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    onBlur={(e) => {
                      const val = e.currentTarget.textContent?.trim();
                      if (val) setMemoTexts(prev => ({ ...prev, nameLabel: val }));
                    }}
                  >
                    {memoTexts.nameLabel}
                  </span>
                  <span className="value placeholder">{getVal(activeRequest?.memberName, '')}</span>
                </div>
                <div className="field-line mem-field-line" style={{ paddingInlineEnd: activeForm === 'international' ? '124px' : activeForm === 'diff' ? '130px' : '110px' }}>
                  <span
                    className="label"
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    onBlur={(e) => {
                      const val = e.currentTarget.textContent?.trim();
                      if (val) setMemoTexts(prev => ({ ...prev, membershipNumLabel: val }));
                    }}
                  >
                    {memoTexts.membershipNumLabel}
                  </span>
                  <span className="value placeholder">{getRawIdVal(activeRequest?.membershipNumber, '')}</span>
                </div>
              </div>

              {/* Loan under name - shown for companies, or for normal form ONLY if it is a Bank (e.g. ABK, Mashreq, etc.) */}
              {((activeForm === 'normal' && isBankPaymentMethod(activeRequest?.paymentMethod)) || (activeForm === 'companies') || (activeForm !== 'normal' && (isCompanyPaymentMethod(activeRequest?.paymentMethod || '') || isBankPaymentMethod(activeRequest?.paymentMethod)))) && (
                <div className="field-line loan-field-line">
                  <span
                    className="label"
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    onBlur={(e) => {
                      const val = e.currentTarget.textContent?.trim();
                      if (val) setMemoTexts(prev => ({ ...prev, loanLabel: val }));
                    }}
                  >
                    {memoTexts.loanLabel || 'القرض بإسم / '}
                  </span>
                  <span className="value placeholder">{getVal(activeRequest?.loanUnderName, '')}</span>
                </div>
              )}

              {/* Account Number - ONLY shown for Banks */}
              {isBankPaymentMethod(activeRequest?.paymentMethod) && (
                <div className="field-line account-field-line">
                  <span
                    className="label font-bold"
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    onBlur={(e) => {
                      const val = e.currentTarget.textContent?.trim();
                      if (val) setMemoTexts(prev => ({ ...prev, accountNumberLabel: val }));
                    }}
                  >
                    {memoTexts.accountNumberLabel || 'رقم الحساب : '}
                  </span>
                  <span
                    className="value placeholder font-mono font-bold"
                    style={{ marginInlineStart: '6px' }}
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                  >
                    {getRawIdVal(activeRequest?.accountNumber, '')}
                  </span>
                </div>
              )}

              <div className="field-line subdate-field-line">
                <span
                  className="label"
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  onBlur={(e) => {
                    const val = e.currentTarget.textContent?.trim();
                    if (val) setMemoTexts(prev => ({ ...prev, subDateLabel: val }));
                  }}
                >
                  {memoTexts.subDateLabel}
                </span>
                <span className="value placeholder">{activeRequest?.subscriptionDate ? formatDateNumeric(activeRequest.subscriptionDate) : ''}</span>
              </div>

              <div className="field-line reqdate-field-line">
                <span
                  className="label"
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  onBlur={(e) => {
                    const val = e.currentTarget.textContent?.trim();
                    if (val) setMemoTexts(prev => ({ ...prev, reqDateLabel: val }));
                  }}
                >
                  {memoTexts.reqDateLabel}
                </span>
                <span className="value placeholder">{activeRequest?.requestDate ? formatDateNumeric(activeRequest.requestDate) : ''}</span>
              </div>
            </div>

            <div className="row-controls no-print" contentEditable={false}>
              <span style={{ fontSize: '11px', fontWeight: 'bold' }}>جدول طريقة السداد:</span>
              <button type="button" onClick={addGridRow}>+ صف</button>
              <button type="button" onClick={removeGridRow}>− صف</button>
              <button
                type="button"
                onClick={clearAllCurrencyUnits}
                style={{ fontSize: '11px', padding: '1px 5px', marginInlineStart: '4px' }}
                title="حذف كلمة جم من كل الجداول"
              >
                حذف عملة (جم)
              </button>
              <button
                type="button"
                onClick={setSARCurrencyUnit}
                style={{ fontSize: '11px', padding: '1px 5px', marginInlineStart: '4px', background: '#1e3a8a', color: '#fff' }}
                title="تعيين العملة إلى ريال سعودى لحساب العميل"
              >
                ريال سعودى للعميل
              </button>
              <button
                type="button"
                onClick={toggleBoldSelection}
                style={{ fontSize: '11px', padding: '1px 5px', marginInlineStart: '4px', fontWeight: 'bold' }}
                title="تطبيق أو إلغاء غامق (Bold) على السطر أو النص المحدد"
              >
                <b>B</b> غامق / عادي
              </button>
            </div>

            <div className="grid-table-wrapper" ref={gridWrapperRef}>
              <table className="grid" id="grid-table">
                <tbody>
                  {gridRows.map((row, idx) => {
                    const isAdvancePaidRow = row.label.includes('مقدم') || normalizeArabicText(row.label).includes('مقدم');

                    const cashNum = parseNum(activeRequest?.cashAmount);
                    const visaNum = parseNum(activeRequest?.visaAmount);
                    const cashFormatted = cashNum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                    const visaFormatted = visaNum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

                    return (
                      <tr key={idx} style={row.isBold ? { fontWeight: 'bold' } : undefined}>
                        <td className="label-cell" style={row.isBold ? { fontWeight: 'bold' } : undefined}>
                          {row.label}
                          <div className="col-resizer no-print" title="سحب لتغيير عرض العمود" onMouseDown={(e) => startColResize(e, 'gridCol1', gridCol1Width)} />
                        </td>
                        <td className="val-cell placeholder" style={row.isBold ? { fontWeight: 'bold' } : undefined}>
                          <div className="flex items-center justify-between gap-3 w-full">
                            <span>
                              {row.val1 || ''}{row.val1 && row.val1.trim() !== '' && row.val1 !== '-' && !row.val1.startsWith('[') && row.unit ? <span className="unit-cell" contentEditable={true} suppressContentEditableWarning={true}> {row.unit}</span> : ''}
                              {isAdvancePaidRow && activeRequest && !isInternationalRequest(activeRequest) && activeForm !== 'international' && (
                                <span
                                  className="advance-split font-normal text-slate-800"
                                  style={{ marginInlineStart: '6px' }}
                                  contentEditable={true}
                                  suppressContentEditableWarning={true}
                                >
                                  {` ( ${cashFormatted} نقدى + ${visaFormatted} فيزا )`}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="col-resizer no-print" title="سحب لتغيير عرض العمود" onMouseDown={(e) => startColResize(e, 'gridCol2', gridCol2Width)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {activeForm === 'diff' ? (
              <>
                <div className="note-line">
                  <span
                    className="receipts-note-prefix"
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    onBlur={(e) => {
                      const val = e.currentTarget.textContent?.trim();
                      if (val) setMemoTexts(prev => ({ ...prev, receiptsNote: val }));
                    }}
                  >
                    {memoTexts.receiptsNote}
                  </span>
                  <span className="placeholder">{activeRequest?.advancePaid ? 'يوجد' : ''}</span>
                  <span
                    className="receipts-count-label"
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    onBlur={(e) => {
                      const val = e.currentTarget.textContent?.trim();
                      if (val) setMemoTexts(prev => ({ ...prev, receiptsCountLabel: val }));
                    }}
                  >
                    &nbsp; &nbsp; {memoTexts.receiptsCountLabel}&nbsp;
                  </span>
                  <span className="placeholder">{activeRequest?.advancePaid ? '1' : ''}</span>
                </div>

                <div className="note-line">
                  <span
                    className="committee-note-prefix"
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    onBlur={(e) => {
                      const val = e.currentTarget.textContent?.trim();
                      if (val) setMemoTexts(prev => ({ ...prev, committeeNotePrefix: val }));
                    }}
                  >
                    {memoTexts.committeeNotePrefix}
                  </span>
                  <span className="placeholder">{getVal(activeRequest?.committeeNo, '')}</span>
                  <span
                    className="committee-note-year"
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    onBlur={(e) => {
                      const val = e.currentTarget.textContent?.trim();
                      if (val) setMemoTexts(prev => ({ ...prev, committeeNoteYear: val }));
                    }}
                  >
                    {memoTexts.committeeNoteYear}
                  </span>
                </div>

                <div className="note-line">
                  وإيماءً إلى المذكرة الداخلية بتاريخ <span className="placeholder"></span> ، والتي بموجبها تم إصدار شيك للعضو بمبلغ <span className="placeholder"></span> {activeRequest?.currency || 'جم'}
                </div>
                <div className="note-line">
                  ؛ ثم حصل شيك بنكيا للعميل بتاريخ <span className="placeholder"></span>
                </div>
                <div className="note-line">
                  لذا يرجى رد شيك للعميل بقيمة <span className="placeholder">{getClientRefund(activeRequest, '')}</span> {getClientRefund(activeRequest, '') ? (activeRequest?.currency || 'جم') : ''}
                </div>
                <div className="note-line" style={{ fontWeight: 'bold' }}>
                  <span
                    className="sales-dept-note-text"
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    onBlur={(e) => {
                      const val = e.currentTarget.textContent?.trim();
                      if (val) setMemoTexts(prev => ({ ...prev, salesDeptNote: val }));
                    }}
                  >
                    {memoTexts.salesDeptNote}
                  </span>
                  <span className="exceptions" id="exceptions-group" style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {exceptions.map((ex, exIdx) => (
                      <span
                        key={exIdx}
                        className="exception-box"
                        contentEditable={true}
                        suppressContentEditableWarning={true}
                        onBlur={(e) => {
                          const text = e.currentTarget.innerText?.replace('×', '').trim() || '';
                          if (text && text !== ex) {
                            updateExceptionAtIndex(exIdx, text);
                          }
                        }}
                      >
                        {ex}
                        <button
                          type="button"
                          className="no-print"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeExceptionAtIndex(exIdx);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#dc2626',
                            cursor: 'pointer',
                            marginInlineStart: '4px',
                            fontWeight: 'bold',
                            fontSize: '12px'
                          }}
                          title="حذف هذا الاستثناء"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </span>
                  <span className="row-controls no-print" contentEditable={false}>
                    <button type="button" onClick={addException}>+ استثناء</button>
                    <button type="button" onClick={removeException}>− استثناء</button>
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="note-line">
                  <span
                    className="receipts-note-prefix"
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    onBlur={(e) => {
                      const val = e.currentTarget.textContent?.trim();
                      if (val) setMemoTexts(prev => ({ ...prev, receiptsNote: val }));
                    }}
                  >
                    {memoTexts.receiptsNote}
                  </span>
                  <span className="placeholder">{activeRequest?.advancePaid ? 'يوجد' : ''}</span>
                  <span
                    className="receipts-count-label"
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    onBlur={(e) => {
                      const val = e.currentTarget.textContent?.trim();
                      if (val) setMemoTexts(prev => ({ ...prev, receiptsCountLabel: val }));
                    }}
                  >
                    &nbsp;{memoTexts.receiptsCountLabel}&nbsp;
                  </span>
                  <span className="placeholder">{activeRequest?.advancePaid ? '1' : ''}</span>
                </div>

                <div className="note-line">
                  <span
                    className="committee-note-prefix"
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    onBlur={(e) => {
                      const val = e.currentTarget.textContent?.trim();
                      if (val) setMemoTexts(prev => ({ ...prev, committeeNotePrefix: val }));
                    }}
                  >
                    {memoTexts.committeeNotePrefix}
                  </span>
                  <span className="placeholder">{getVal(activeRequest?.committeeNo, '')}</span>
                  <span
                    className="committee-note-year"
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    onBlur={(e) => {
                      const val = e.currentTarget.textContent?.trim();
                      if (val) setMemoTexts(prev => ({ ...prev, committeeNoteYear: val }));
                    }}
                  >
                    {memoTexts.committeeNoteYear}
                  </span>
                </div>

                <div className="row-controls no-print" contentEditable={false}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold' }}>جدول الخصومات:</span>
                  <button type="button" onClick={addDeductRow}>+ صف</button>
                  <button type="button" onClick={removeDeductRow}>− صف</button>
                  <button
                    type="button"
                    onClick={clearAllCurrencyUnits}
                    style={{ fontSize: '11px', padding: '1px 5px', marginInlineStart: '4px' }}
                    title="حذف كلمة جم من الجدول"
                  >
                    حذف (جم)
                  </button>
                  <button
                    type="button"
                    onClick={setSARCurrencyUnit}
                    style={{ fontSize: '11px', padding: '1px 5px', marginInlineStart: '4px', background: '#1e3a8a', color: '#fff' }}
                    title="تعيين العملة إلى ريال سعودى لحساب العميل"
                  >
                    ريال سعودى للعميل
                  </button>
                </div>

                <table className="deduct" id="deduct-table">
                  <tbody>
                    {deductRows.map((dRow, idx) => {
                      const isLastSpecialRow = idx === deductRows.length - 1 || dRow.tag.includes('شيك') || dRow.tag.includes('تحويل');
                      const isRowBold = dRow.isBold || isLastSpecialRow;
                      return (
                        <tr key={idx} style={isRowBold ? { fontWeight: 'bold' } : undefined}>
                          <td className="tag" style={isRowBold ? { fontWeight: 'bold' } : undefined}>
                            {dRow.tag}
                            <div className="col-resizer no-print" title="سحب لتغيير عرض العمود" onMouseDown={(e) => startColResize(e, 'deductCol1', deductCol1Width)} />
                          </td>
                          <td className="amount placeholder" style={isRowBold ? { fontWeight: 'bold' } : undefined}>
                            {dRow.amount || ''}{dRow.amount && dRow.amount.trim() !== '' && dRow.amount !== '-' && !dRow.amount.startsWith('[') && dRow.unit ? <span className="unit-cell" contentEditable={true} suppressContentEditableWarning={true}> {dRow.unit}</span> : ''}
                            <div className="col-resizer no-print" title="سحب لتغيير عرض العمود" onMouseDown={(e) => startColResize(e, 'deductCol2', deductCol2Width)} />
                          </td>
                          <td className="desc" style={isRowBold ? { fontWeight: 'bold' } : undefined}>
                            {dRow.desc}
                            <div className="col-resizer no-print" title="سحب لتغيير عرض العمود" onMouseDown={(e) => startColResize(e, 'deductCol4', deductCol4Width)} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {(activeForm === 'companies' || activeForm === 'normal') && (
                  <>
                    {/* Show "ورجاء رد مبلغ للعميل" ALWAYS for Companies Form, and for Normal Form ONLY when it is a Bank (e.g. ABK) with positive client refund */}
                    {(activeForm === 'companies' ||
                      (activeForm === 'normal' && isBankPaymentMethod(activeRequest?.paymentMethod) && getClientRefundNum(activeRequest) > 0)) && (
                      <div className="note-line">
                        ورجاء رد مبلغ <span className="placeholder" style={{ fontWeight: 'bold' }}>{getClientRefund(activeRequest, '')}</span> {getClientRefund(activeRequest, '') ? `${activeRequest?.currency || 'جم'} للعميل ` : 'للعميل '}وذلك بعد خصم مبلغ <span className="placeholder" style={{ fontWeight: 'bold' }}>{getMemoDiscount(activeRequest, '')}</span> {getMemoDiscount(activeRequest, '') ? (activeRequest?.currency || 'جم') : ''}
                      </div>
                    )}

                    <div className="note-line">
                      مع اعفاء العضو من سداد مبلغ <span className="placeholder">{getVal(activeRequest?.annualRenewalDue, '')}</span> {getVal(activeRequest?.annualRenewalDue, '') ? `${activeRequest?.currency || 'جم'} ` : ''}مقابل التجديد السنوى لعام 2026
                    </div>
                  </>
                )}

                <div className="note-line" style={{ fontWeight: 'bold' }}>
                  <span
                    className="sales-dept-note-text"
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    onBlur={(e) => {
                      const val = e.currentTarget.textContent?.trim();
                      if (val) setMemoTexts(prev => ({ ...prev, salesDeptNote: val }));
                    }}
                  >
                    {memoTexts.salesDeptNote}
                  </span>
                  <span className="exceptions" id="exceptions-group" style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {exceptions.map((ex, exIdx) => (
                      <span
                        key={exIdx}
                        className="exception-box"
                        contentEditable={true}
                        suppressContentEditableWarning={true}
                        onBlur={(e) => {
                          const text = e.currentTarget.innerText?.replace('×', '').trim() || '';
                          if (text && text !== ex) {
                            updateExceptionAtIndex(exIdx, text);
                          }
                        }}
                      >
                        {ex}
                        <button
                          type="button"
                          className="no-print"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeExceptionAtIndex(exIdx);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#dc2626',
                            cursor: 'pointer',
                            marginInlineStart: '4px',
                            fontWeight: 'bold',
                            fontSize: '12px'
                          }}
                          title="حذف هذا الاستثناء"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </span>
                  <span className="row-controls no-print" contentEditable={false}>
                    <button type="button" onClick={addException}>+ استثناء</button>
                    <button type="button" onClick={removeException}>− استثناء</button>
                  </span>
                </div>
              </>
            )}

            <div className="footer-flex">
              <table className="footer-table narrow">
                <tbody>
                  <tr>
                    <td className="lbl">ملاحظات الإدارة المالية :</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td className="lbl">رقم العميل :</td>
                    <td className="placeholder">{activeRequest?.externalId || activeRequest?.accountNumber || ''}</td>
                  </tr>
                  <tr>
                    <td className="lbl">توقيع مراجع الحسابات :</td>
                    <td>&nbsp;</td>
                  </tr>
                  <tr>
                    <td className="lbl">توقيع المدير المالى :</td>
                    <td>&nbsp;</td>
                  </tr>
                </tbody>
              </table>
              <div className="sign-block">
                <div className="field-line">
                  <span
                    className="label sign-name-text"
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    onBlur={(e) => {
                      const val = e.currentTarget.textContent?.replace(/\u00a0/g, ' ')?.trim();
                      if (val) setMemoTexts(prev => ({ ...prev, signName: val }));
                    }}
                  >
                    &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; {memoTexts.signName || 'صفوت رجائى'}
                  </span>
                </div>
                <div className="signature-space"></div>
              </div>
            </div>

            <div className="doc-footer" contentEditable={false}>
              <div className="doc-control-box">Document Control</div>
              <div className="mid-col">Page: 1 of 1</div>
              <div className="code-col">
                <span>WDC-CT-ME-01-101-F21-AR</span>
                <span>Rev: 4</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
);
}
