export type UserRole = 'admin' | 'club' | 'first_manager' | 'sector_manager' | 'international_user';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  club?: string; // For club users
  signatureUrl?: string; // For sector manager
  firstLogin: boolean;
  passwordChanged: boolean;
  allowedPages?: string[]; // Custom assigned pages/tabs for this user
}

export interface Dropdowns {
  clubs: string[];
  membershipTypes: string[];
  paymentMethods: string[];
  cancellationReasons: string[];
  cancellationStatuses?: string[];
  committeeResults?: string[];
  exceptions?: string[];
  currencies?: string[];
  [key: string]: any;
}

export interface CustomField {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'formula';
  formulaExpression?: string;
  options?: string[];
  section: 'member' | 'financial' | 'fees' | 'cancellation' | 'notes';
  showInPrint: boolean;
  printSection: 'main_table' | 'member_summary' | 'exceptions' | 'footer';
  showInExport: boolean;
  order: number;
  defaultValue?: string;
}

export interface CancellationRequest {
  id: number; // Serial No. (م)
  customValues?: Record<string, any>; // Dynamic custom fields values
  membershipNumber: string; // رقم العضوية
  memberName: string; // اسم العضو
  loanUnderName?: string; // القرض بإسم
  nationalId: string; // الرقم القومى
  externalId: string; // External Id (رقم العميل)
  mobileNumber?: string; // رقم الموبايل (11 digit)
  subscriptionDate: string; // تاريخ الاشتراك (YYYY-MM-DD)
  requestDate: string; // تاريخ الطلب (YYYY-MM-DD)
  days: number; // Days (Calculated)
  type: string; // Type (Calculated, e.g., 'اقل من 3 شهور' or 'X سنة')
  membershipType: string; // Smart / Regular / International
  club: string; // النادى
  paymentMethod: string; // طريقة الدفع
  accountNumber?: string; // رقم الحساب (for ABK)
  documents: string; // المستندات
  cancellationReason: string; // سبب الالغاء
  cancellationReasonDetail: string; // سبب بالتفصيل
  committeeNo?: string; // رقم اللجنة
  committeeYear?: string; // سنة اللجنة
  approvalDate?: string; // تاريخ الاعتماد
  currency?: string; // العملة (جم / ريال سعودى / دولار)
  
  // Financial Fields
  subscriptionValue: number; // قيمة الاشتراك = قيمة التحويلة + نقدا + فيزا + الشيكات الغير مسددة
  transferValue: number; // قيمة التحويلة
  cashAmount: number; // نقدا
  visaAmount: number; // فيزا
  advancePaid: number; // مبلغ المقدم = نقدا + فيزا
  checksPaid: number; // الشيكات المسددة
  checksUnpaid: number; // الشيكات الغير مسددة
  annualRenewalDue: number; // التجديد المستحق
  
  // Deductions & Calculations
  adminFees: number; // مصاريف إدارية
  usageFee: number; // مقابل الانتفاع
  visaFees2Percent: number; // مصاريف فيزا 2%
  discountAmount: number; // مبلغ الخصم
  debtABKCompanies: number; // مديونية ABK+Companies
  refundAmount: number | string; // Refund Amount (Calculated or waiting message)
  refundToClient: number | string | 'Not Required'; // رد للعميل (Companies only)
  abkDebtDifference: number | string | 'Not Required'; // فرق مديونية ABK (ABK only)
  
  // Status Tracking
  result: 'Pending' | 'Rejected' | 'Accepted';
  status: 'Pending' | 'Cancelled' | 'Revoked' | 'Deletion' | 'Rejected';
  statusDate?: string; // Required for Cancelled/Revoked/Deletion/Rejected
  systemStatus?: string; // Excel upload reconciliation status
  actualRefund?: number; // Refund
  memberRefund?: number; // Member portion of refund
  salesPerson: string; // Sales Person
  clubNote?: string; // Club Note
  adminNote?: string; // Admin Note
  isException?: boolean; // الاستثناء
  exceptions?: string; // تفاصيل الاستثناء
  exceptionType?: string; // نوع الاستثناء
  adminFeesOverride?: number; // تعديل يدوي / استثناء للمصاريف الإدارية
  usageFeeOverride?: number; // تعديل يدوي / استثناء لمقابل الانتفاع
  visaFeeOverride?: number; // تعديل يدوي / استثناء لمصاريف الفيزا
  requestYear: number; // Calculated from requestDate
  refundYear?: number; // Year of Status Date when Status = Cancelled/Deletion
  type2: 'Less 3 months' | 'Over 3 months'; // Days <= 90 vs Days > 90
  
  // Workflow flags
  receiptReceived: boolean;
  receiptReceivedDate?: string;
  approvalSentToFirstManager?: boolean;
  firstManagerApproved?: boolean | null;
  firstManagerComments?: string;
  firstManagerDecisionDate?: string;
  firstManagerPdfUrl?: string; // Attached PDF base64 / data URL
  firstManagerPdfName?: string; // PDF file name
  firstManagerPdfSize?: number; // PDF file size in bytes
  firstManagerSendNotes?: string; // Admin notes sent with PDF
  firstManagerSentAt?: string; // Date & time when admin sent request to first manager
  firstManagerSentBy?: string; // Name of admin who sent the request
  approvalSentToSectorManager?: boolean;
  sectorManagerApproved?: boolean | null;
  sectorManagerComments?: string;
  sectorManagerSignature?: string; // Stamped signature image data URL
  reviewed?: boolean; // Admin reviewed flag
}

export interface AuditLog {
  id: string;
  username: string;
  name: string;
  role: string;
  action: string;
  details: string;
  timestamp: string;
  requestId?: number;
}

export interface EmailLog {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  sentAt: string;
  requestId?: number;
  type: string;
}

export interface Committee {
  id: string;
  number: string;
  year: string;
  status: 'open' | 'closed';
  approvalDate?: string;
}
