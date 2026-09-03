import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { sqlDb, pool, ensureTablesExist } from "./src/db/index.js";
import { appData } from "./src/db/schema.js";
import { eq } from "drizzle-orm";

// Safety handlers to prevent server crashes from unhandled network errors (e.g. unreachable external DB)
process.on("uncaughtException", (err) => {
  console.warn("Uncaught server exception (retained):", err?.message || err);
});
process.on("unhandledRejection", (reason) => {
  console.warn("Unhandled promise rejection (retained):", (reason as any)?.message || reason);
});

// Initialize express app
const app = express();
const PORT = 3000;

// Health check endpoint for ingress & container health monitoring
app.get("/api/health", async (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// CORS and Preflight handler for Vercel / External Clients
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

// URL Normalization for Vercel Serverless rewrites
if (process.env.VERCEL) {
  app.use((req, res, next) => {
    if (req.originalUrl && req.originalUrl.startsWith("/api") && !req.url.startsWith("/api")) {
      req.url = req.originalUrl;
    }
    next();
  });
}

// Setup JSON parsing with high limit for signature uploads / bulk imports / document attachments
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

// Database File Path
const DB_PATH = path.join(process.cwd(), "db_store.json");

// Helper to hash passwords using native crypto SHA-256
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

const DEFAULT_HASH = hashPassword("123");

// Default initial database store
const DEFAULT_DB = {
  users: [
    {
      id: "admin",
      username: "admin",
      name: "أدمن النظام (المركز الرئيسي)",
      role: "admin",
      firstLogin: false,
      passwordChanged: true,
      password: hashPassword("admin123"), // Secure default for admin so they don't get locked, but resets work
    },
    {
      id: "sheraton_club",
      username: "sheraton_club",
      name: "مسؤول نادي الشيراتون",
      role: "club",
      club: "Sheraton",
      firstLogin: true,
      passwordChanged: false,
      password: DEFAULT_HASH,
    },
    {
      id: "maadi_club",
      username: "maadi_club",
      name: "مسؤول نادي المعادي",
      role: "club",
      club: "Maadi",
      firstLogin: true,
      passwordChanged: false,
      password: DEFAULT_HASH,
    },
    {
      id: "international_maadi",
      username: "international_maadi",
      name: "مسؤول العضويات الدولية (نادي المعادي)",
      role: "international_user",
      club: "Maadi",
      firstLogin: true,
      passwordChanged: false,
      password: DEFAULT_HASH,
      allowedPages: ["requests", "new_request", "advance_receipts", "print_hub"]
    },
    {
      id: "manager1",
      username: "manager1",
      name: "Manager",
      role: "first_manager",
      firstLogin: true,
      passwordChanged: false,
      password: DEFAULT_HASH,
    },
    {
      id: "sector_mgr",
      username: "sector_mgr",
      name: "رئيس قطاع الإدارة المالية",
      role: "sector_manager",
      firstLogin: true,
      passwordChanged: false,
      password: DEFAULT_HASH,
      signatureUrl: "", // transparent signature PNG
    }
  ],
  dropdowns: {
    clubs: [
      "Lotus", "Alex", "Tanta", "Sheraton", "Nakheel", "Mansoura", 
      "Oct I", "Damietta", "Maadi", "Assiut", "Oct II", "Elminya"
    ],
    membershipTypes: ["Smart", "Regular", "International"],
    paymentMethods: [
      "Premium", "Aman", "نقدا", "شيكات", "Ollin", "Contact", "ABK", "عضوية دولية", "One Finance"
    ],
    cancellationReasons: [
      "اسباب شخصية",
      "مشكلة مع ادارة المبيعات",
      "تعثر مادى",
      "بدون اسباب",
      "مشكلة مع شركة التمويل",
      "مشكلة مع النشاط الرياضى",
      "تأخر افتتاح نادى طنطا",
      "مشكلة مع خدمة العملاء",
      "مشكلة مع نظام النادى",
      "شكاوى الاعضاء على مواقع التواصل الاجتماعى",
      "تأخر افتتاح نادى الشروق",
      "Other"
    ],
    committeeResults: ["Accepted", "Rejected", "Pending"],
    cancellationStatuses: ["Pending", "Cancelled", "Revoked", "Deletion", "Rejected"],
    exceptions: ["لا يوجد", "حالة انسانية", "جهة سيادية", "حل مشكلة", "بدون رد اى مبلغ"],
    currencies: ["جم", "ريال سعودى", "دولار"]
  },
  dropdownLabels: {
    clubs: "نادي الفرع",
    membershipTypes: "نوع العضوية",
    paymentMethods: "طريقة الدفع",
    cancellationReasons: "سبب الإلغاء",
    committeeResults: "قرار اللجنة",
    cancellationStatuses: "حالة الإلغاء",
    exceptions: "الاستثناءات",
    currencies: "العملة (Currency)"
  },
  labelNames: {
    membershipNumber: "رقم العضوية",
    memberName: "اسم العضو",
    loanUnderName: "القرض باسم",
    nationalId: "الرقم القومي",
    externalId: "رقم العميل",
    subscriptionDate: "تاريخ الاشتراك",
    requestDate: "تاريخ الطلب",
    membershipType: "نوع العضوية",
    club: "النادي",
    paymentMethod: "طريقة الدفع",
    accountNumber: "رقم الحساب",
    documents: "المستندات",
    cancellationReason: "سبب طلب الالغاء",
    cancellationReasonDetail: "السبب بالتفصيل",
    salesPerson: "مسؤول المبيعات",
    clubNote: "ملاحظات الفرع",
    adminNote: "ملاحظات الادمن",
    currency: "العملة",
    subscriptionValue: "إجمالي قيمة العضوية",
    transferValue: "قيمة التحويلة",
    cashAmount: "المبلغ نقداً",
    visaAmount: "المبلغ فيزا",
    advancePaid: "قيمة المقدم",
    checksPaid: "شيكات مسددة",
    checksUnpaid: "شيكات غير مسددة",
    annualRenewalDue: "التجديد السنوي المستحق",
    adminFees: "مصاريف إدارية",
    usageFee: "مقابل الانتفاع",
    visaFees2Percent: "مصاريف فيزا 2%",
    discountAmount: "مبلغ الخصم",
    debtABKCompanies: "مديونية البنك / الشركات",
    refundAmount: "مبلغ الاسترداد",
    mobileNumber: "رقم الموبايل"
  },
  requests: [
    {
      id: 1,
      membershipNumber: "WD-10045",
      memberName: "أحمد عبد الرحمن السعيد",
      nationalId: "29512180102456",
      externalId: "EXT-80231",
      subscriptionDate: "2026-01-15",
      requestDate: "2026-03-30",
      days: 74,
      type: "اقل من 3 شهور",
      type2: "Less 3 months",
      membershipType: "Regular",
      club: "Sheraton",
      paymentMethod: "نقدا",
      documents: "البطاقة الشخصية + طلب الإلغاء الورقي",
      cancellationReason: "تعثر مادى",
      cancellationReasonDetail: "العميل يواجه ظروفاً مالية صعبة تمنعه من استكمال الأقساط",
      committeeNo: "5",
      committeeYear: "2026",
      subscriptionValue: 65000,
      transferValue: 0,
      cashAmount: 65000,
      visaAmount: 0,
      advancePaid: 65000,
      checksPaid: 0,
      checksUnpaid: 0,
      annualRenewalDue: 0,
      adminFees: 2500,
      usageFee: 0,
      visaFees2Percent: 0,
      discountAmount: 2500,
      debtABKCompanies: 0,
      refundAmount: 62500,
      refundToClient: "Not Required",
      abkDebtDifference: "Not Required",
      result: "Pending",
      status: "Pending",
      receiptReceived: true,
      receiptReceivedDate: "2026-04-05",
      salesPerson: "محمد أحمد - مبيعات شيراتون",
      clubNote: "تم استلام أصل الإيصالات والبطاقة الشخصية",
      adminNote: "طلب مستوفي الشروط ومطابق",
      requestYear: 2026,
    },
    {
      id: 2,
      membershipNumber: "WD-30089",
      memberName: "منى محمود عبد القادر",
      loanUnderName: "شركة أمان للتمويل الاستهلاكي",
      nationalId: "29004151203489",
      externalId: "EXT-44569",
      subscriptionDate: "2025-06-10",
      requestDate: "2026-06-25",
      days: 380,
      type: "2 سنة",
      type2: "Over 3 months",
      membershipType: "Smart",
      club: "Maadi",
      paymentMethod: "Aman",
      documents: "إفادة سداد شركة التمويل + البطاقة الشخصية",
      cancellationReason: "مشكلة مع شركة التمويل",
      cancellationReasonDetail: "ارتفاع نسبة الفائدة لشركة التمويل الاستهلاكي بشكل مبالغ فيه",
      committeeNo: "5",
      committeeYear: "2026",
      subscriptionValue: 120000,
      transferValue: 100000,
      cashAmount: 10000,
      visaAmount: 10000,
      advancePaid: 20000,
      checksPaid: 0,
      checksUnpaid: 0,
      annualRenewalDue: 2500,
      adminFees: 2500,
      usageFee: 30000, // 30% of transferValue (100k) for Smart membership (2 Years count)
      visaFees2Percent: 200, // 2% of 10k visaAmount
      discountAmount: 32700,
      debtABKCompanies: 80000,
      refundAmount: 80000, // Aman company refund logic
      refundToClient: 0, // MAX(100k - 80k - 32.7k, 0) = 0
      abkDebtDifference: "Not Required",
      result: "Pending",
      status: "Pending",
      receiptReceived: false,
      salesPerson: "سارة حسن - مبيعات المعادي",
      clubNote: "بانتظار وصول أصل التنازل من العميل",
      requestYear: 2026,
    },
    {
      id: 3,
      membershipNumber: "WD-99012",
      memberName: "عبد الله بن فهد آل سعود",
      nationalId: "1098765432",
      externalId: "EXT-99012",
      subscriptionDate: "2025-11-01",
      requestDate: "2026-04-10",
      days: 160,
      type: "1 سنة",
      type2: "Over 3 months",
      membershipType: "International",
      club: "Maadi",
      paymentMethod: "عضوية دولية",
      currency: "ريال سعودى",
      documents: "طلب إلغاء عضوية دولية + صورة جواز السفر",
      cancellationReason: "اسباب شخصية",
      cancellationReasonDetail: "نقل الإقامة الدائمة خارج مصر وإنهاء العضوية الدولية",
      committeeNo: "5",
      committeeYear: "2026",
      subscriptionValue: 45000,
      transferValue: 0,
      cashAmount: 45000,
      visaAmount: 0,
      advancePaid: 45000,
      checksPaid: 0,
      checksUnpaid: 0,
      annualRenewalDue: 0,
      adminFees: 0, // Exempt for international
      usageFee: 0, // Exempt for international
      visaFees2Percent: 0,
      discountAmount: 0,
      debtABKCompanies: 0,
      refundAmount: 45000,
      refundToClient: 45000,
      abkDebtDifference: "Not Required",
      result: "Pending",
      status: "Pending",
      receiptReceived: true,
      receiptReceivedDate: "2026-04-12",
      salesPerson: "خالد محمود - إدارة العضويات الدولية",
      clubNote: "تم استلام أصل العقد وجواز السفر",
      requestYear: 2026,
    }
  ],
  committees: [
    {
      id: "comm-5-2026",
      number: "5",
      year: "2026",
      status: "open",
      approvalDate: "2026-07-15"
    }
  ],
  auditLogs: [
    {
      id: "log-1",
      username: "admin",
      name: "أدمن النظام (المركز الرئيسي)",
      role: "admin",
      action: "System Initialization",
      details: "تم تهيئة وتدشين نظام إلغاء العضويات لوادي دجلة بنجاح",
      timestamp: "2026-06-27T10:00:00-07:00"
    }
  ],
  emailLogs: [],
  smtpSettings: {
    host: "smtp.gmail.com",
    port: 587,
    username: "wd.cancellations@gmail.com",
    password: ""
  },
  formulas: {
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
    paymentMethodOptions: {
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
    },
    customPaymentMethods: []
  },
  customFields: []
};

// Database state
let db: any = { ...DEFAULT_DB };
let dbSourceIsSafe = false;

let isDbLoaded = false;
let dbLoadPromise: Promise<void> | null = null;

// Load Database from disk & PostgreSQL (Neon / Cloud SQL)
async function loadDb() {
  try {
    dbSourceIsSafe = false;
    let loadedFromSql = false;
    if (sqlDb && pool) {
      try {
        await ensureTablesExist(pool);
        const queryPromise = sqlDb.select().from(appData).where(eq(appData.key, 'main_store'));
        queryPromise.catch(() => {});
        const timeoutPromise = new Promise<any[]>((_, reject) =>
          setTimeout(() => reject(new Error('PostgreSQL select timed out')), 15000)
        );
        const rows = await Promise.race([queryPromise, timeoutPromise]);
        if (rows && rows.length > 0 && rows[0].data) {
          db = rows[0].data;
          loadedFromSql = true;
          dbSourceIsSafe = true;
          console.log("Database successfully loaded from PostgreSQL.");
        } else if (rows && rows.length === 0) {
          // Genuinely empty database (first-ever run) - safe to initialize with defaults
          dbSourceIsSafe = true;
        }
      } catch (sqlErr) {
        console.warn("Could not query PostgreSQL on load, falling back to safe local store:", sqlErr);
      }
    }

    if (!loadedFromSql) {
      try {
        if (fs.existsSync(DB_PATH)) {
          const raw = fs.readFileSync(DB_PATH, "utf-8");
          db = JSON.parse(raw);
        } else {
          db = JSON.parse(JSON.stringify(DEFAULT_DB));
        }
      } catch {
        db = JSON.parse(JSON.stringify(DEFAULT_DB));
      }
    }

    // Ensure all major properties are present and safe
    if (!db || typeof db !== 'object') {
      db = JSON.parse(JSON.stringify(DEFAULT_DB));
    }
    if (!db.users || !Array.isArray(db.users) || db.users.length === 0) {
      db.users = JSON.parse(JSON.stringify(DEFAULT_DB.users));
    }
    if (!db.dropdowns || typeof db.dropdowns !== 'object') {
      db.dropdowns = JSON.parse(JSON.stringify(DEFAULT_DB.dropdowns));
    }
    if (!db.dropdownLabels || typeof db.dropdownLabels !== 'object') {
      db.dropdownLabels = JSON.parse(JSON.stringify(DEFAULT_DB.dropdownLabels));
    }

    // Ensure new core dropdown categories and missing options exist
    for (const key of Object.keys(DEFAULT_DB.dropdowns)) {
      if (!db.dropdowns[key]) {
        db.dropdowns[key] = (DEFAULT_DB.dropdowns as any)[key];
      } else if (Array.isArray((db.dropdowns as any)[key])) {
        for (const item of (DEFAULT_DB.dropdowns as any)[key]) {
          if (!db.dropdowns[key].includes(item)) {
            db.dropdowns[key].push(item);
          }
        }
      }
    }
    for (const key of Object.keys(DEFAULT_DB.dropdownLabels)) {
      if (!db.dropdownLabels[key]) {
        db.dropdownLabels[key] = (DEFAULT_DB.dropdownLabels as any)[key];
      }
    }
    if (!db.requests || !Array.isArray(db.requests)) db.requests = DEFAULT_DB.requests;
    if (!db.committees || !Array.isArray(db.committees)) db.committees = DEFAULT_DB.committees;
    if (!db.auditLogs || !Array.isArray(db.auditLogs)) db.auditLogs = DEFAULT_DB.auditLogs;
    if (!db.emailLogs || !Array.isArray(db.emailLogs)) db.emailLogs = DEFAULT_DB.emailLogs;
    if (!db.smtpSettings) db.smtpSettings = DEFAULT_DB.smtpSettings;
    if (!db.formulas) {
      db.formulas = DEFAULT_DB.formulas;
    } else {
      if (!db.formulas.paymentMethodOptions) {
        db.formulas.paymentMethodOptions = DEFAULT_DB.formulas.paymentMethodOptions;
      }
      if (!db.formulas.customPaymentMethods) {
        db.formulas.customPaymentMethods = [];
      }
    }
    if (!db.customFields || !Array.isArray(db.customFields)) db.customFields = [];
    if (!db.labelNames) {
      db.labelNames = DEFAULT_DB.labelNames;
    } else if (!db.labelNames.mobileNumber) {
      db.labelNames.mobileNumber = "رقم الموبايل";
    }

    if (db.dropdowns && Array.isArray(db.dropdowns.exceptions)) {
      if (!db.dropdowns.exceptions.includes("بدون رد اى مبلغ") && !db.dropdowns.exceptions.includes("بدون رد أي مبلغ")) {
        db.dropdowns.exceptions.push("بدون رد اى مبلغ");
      }
    }

    if (Array.isArray(db.users)) {
      db.users.forEach((u: any) => {
        if (u.username === 'manager1' || u.role === 'first_manager') {
          if (u.name === 'المدير المالي الأول (مراجعة)' || u.name === 'المدير المالي الأول') {
            u.name = 'Manager';
          }
        }
      });
    }

    if (Array.isArray(db.requests)) {
      db.requests = db.requests.map((r: any) => calculateRequestFields(r, db.formulas));
    }
  } catch (err) {
    console.error("Error reading database, using fallback state:", err);
  }
}

export async function ensureDbLoaded() {
  if (isDbLoaded) return;
  if (!dbLoadPromise) {
    dbLoadPromise = (async () => {
      await loadDb();
      isDbLoaded = true;
    })();
  }
  await dbLoadPromise;
}

// Save Database to disk and PostgreSQL.
// IMPORTANT: this is awaited by every caller. On serverless platforms the
// function execution can be frozen the instant the HTTP response is sent, so
// a "fire and forget" write risks silently losing data. Awaiting here
// guarantees the write reaches PostgreSQL before we ever respond.
async function saveDb() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    // Expected on read-only environments like Vercel
  }

  if (!dbSourceIsSafe) {
    console.error("BLOCKED: refusing to sync to PostgreSQL because the in-memory data was not confirmed loaded from the real database (avoids overwriting real data with a stale/default fallback).");
    return;
  }

  if (sqlDb) {
    try {
      await sqlDb.insert(appData)
        .values({
          key: 'main_store',
          data: db,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: appData.key,
          set: {
            data: db,
            updatedAt: new Date(),
          }
        });
    } catch (sqlSyncErr) {
      console.error("Error persisting to PostgreSQL:", sqlSyncErr);
    }
  }
}

// Ensure loadDb starts immediately on startup
ensureDbLoaded();

// Helper to log audit actions safely
async function logAudit(username: string, name: string, role: string, action: string, details: string, requestId?: number) {
  try {
    if (!db.auditLogs || !Array.isArray(db.auditLogs)) {
      db.auditLogs = [];
    }
    const newLog = {
      id: "log-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      username,
      name,
      role,
      action,
      details,
      timestamp: new Date().toISOString(),
      requestId
    };
    db.auditLogs.unshift(newLog);
    await saveDb();
  } catch (err) {
    console.warn("Could not write audit log:", err);
  }
}

// Prevent any caching layer (browser or CDN) from serving stale API responses
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

// Ensure DB is loaded before all API routes
app.use(async (req, res, next) => {
// Ensure DB is loaded before all API routes
app.use(async (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    await ensureDbLoaded();
  }
  next();
});

// --- Concurrency safety: serialize write requests with a PostgreSQL advisory lock ---
// A single fixed lock ID is used for the whole app's data store. Any request that can
// modify data (POST/PUT/DELETE/PATCH) must acquire this lock before it's allowed to
// proceed, and must release it once the response has been sent. While one write is
// holding the lock, any other concurrent write simply waits its turn instead of
// racing on a stale in-memory copy of the data and silently overwriting the first
// write when it saves. Right after acquiring the lock we also force a genuinely
// fresh reload from PostgreSQL, so the handler always mutates the very latest data,
// even if this server instance's cached copy was from a moment ago.
const DB_ADVISORY_LOCK_ID = 727272;
const MUTATING_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

app.use(async (req, res, next) => {
  if (!req.path.startsWith("/api/") || !MUTATING_METHODS.has(req.method) || !pool) {
    return next();
  }

  let lockClient: any = null;
  try {
    lockClient = await pool.connect();
    await lockClient.query("SELECT pg_advisory_lock($1)", [DB_ADVISORY_LOCK_ID]);
    // We now hold the exclusive lock: reload the true latest data before this
    // request's handler mutates anything.
    await loadDb();
  } catch (lockErr) {
    console.warn("Could not acquire database lock, proceeding without it:", lockErr);
    if (lockClient) {
      try { lockClient.release(); } catch {}
      lockClient = null;
    }
  }

  const releaseLock = async () => {
    if (!lockClient) return;
    try {
      await lockClient.query("SELECT pg_advisory_unlock($1)", [DB_ADVISORY_LOCK_ID]);
    } catch {}
    try { lockClient.release(); } catch {}
    lockClient = null;
  };

  res.on("finish", releaseLock);
  res.on("close", releaseLock);

  next();
});

// --- API Endpoints ---

// Health & connection diagnostics
app.get("/api/health", async (req, res) => {
  let dbStatus = "in-memory / file";
  let dbError = null;
  if (sqlDb && pool) {
    try {
      await pool.query("SELECT 1");
      dbStatus = "connected-postgres";
    } catch (e: any) {
      dbStatus = "error-postgres";
      dbError = e?.message || String(e);
    }
  }
  res.json({
    status: "ok",
    environment: process.env.VERCEL ? "vercel-serverless" : "standard-node",
    database: dbStatus,
    dbError,
    usersCount: Array.isArray(db?.users) ? db.users.length : 0,
    timestamp: new Date().toISOString()
  });
});

// Middleware to check authentication from a mock bearer/token header or custom simple token
// For extreme ease of development, the token is simply `WD-TOKEN-<username>` which is robust and stateless!
function getAuthenticatedUser(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.replace("Bearer ", "");
  if (!token.startsWith("WD-TOKEN-")) {
    return null;
  }
  const username = token.replace("WD-TOKEN-", "");
  return db?.users?.find((u: any) => u.username === username) || null;
}

// Auth Middleware Wrapper
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: "غير مصرح بالدخول - يرجى تسجيل الدخول أولاً" });
  }
  (req as any).user = user;
  next();
};

// 1. Auth & Password Routes
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
    }

    if (!db || !Array.isArray(db.users)) {
      db = { ...DEFAULT_DB, ...db };
      if (!Array.isArray(db.users)) db.users = DEFAULT_DB.users;
    }

    const trimmedUser = String(username).trim().toLowerCase();
    const user = db.users.find((u: any) => u.username && u.username.toLowerCase() === trimmedUser);
    if (!user) {
      return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    }

    const hashedInput = hashPassword(String(password));
    if (user.password !== hashedInput) {
      return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    }

    // Generate simple token
    const token = `WD-TOKEN-${user.username}`;
    
    // Log login
    logAudit(user.username, user.name, user.role, "تسجيل دخول", `قام المستخدم ${user.name} بتسجيل الدخول`);

    // Return user without password
    const { password: _, ...userSafe } = user;
    res.json({ token, user: userSafe });
  } catch (err: any) {
    console.error("Login route error:", err);
    res.status(500).json({ error: "حدث خطأ أثناء معالجة تسجيل الدخول: " + (err?.message || err) });
  }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const { password: _, ...userSafe } = (req as any).user;
  res.json({ user: userSafe });
});

app.post("/api/auth/change-password", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "يجب إدخال كلمة المرور الحالية والجديدة" });
  }

  const dbUser = db.users.find((u) => u.id === user.id);
  if (!dbUser) {
    return res.status(404).json({ error: "المستخدم غير موجود" });
  }

  if (dbUser.password !== hashPassword(currentPassword)) {
    return res.status(400).json({ error: "كلمة المرور الحالية غير صحيحة" });
  }

  dbUser.password = hashPassword(newPassword);
  dbUser.firstLogin = false;
  dbUser.passwordChanged = true;
  await saveDb();

  logAudit(dbUser.username, dbUser.name, dbUser.role, "تغيير كلمة المرور", `قام المستخدم بتغيير كلمة المرور الخاصة به بنجاح`);
  res.json({ success: true, message: "تم تغيير كلمة المرور بنجاح" });
});

// Admin reset any user password
app.post("/api/auth/reset-password", requireAuth, async (req, res) => {
  const reqUser = (req as any).user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "غير مصرح - هذه الصلاحية للأدمن فقط" });
  }

  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "يجب تحديد معرف المستخدم المراد إعادة تعيينه" });
  }

  const dbUser = db.users.find((u) => u.id === userId);
  if (!dbUser) {
    return res.status(404).json({ error: "المستخدم غير موجود" });
  }

  dbUser.password = DEFAULT_HASH;
  dbUser.firstLogin = true;
  dbUser.passwordChanged = false;
  await saveDb();

  logAudit(reqUser.username, reqUser.name, reqUser.role, "إعادة تعيين كلمة مرور", `تم إعادة تعيين كلمة مرور المستخدم ${dbUser.name} إلى كلمة المرور الافتراضية 123`);
  res.json({ success: true, message: `تم إعادة تعيين كلمة مرور المستخدم إلى كلمة المرور الافتراضية (123)` });
});

// User Management (Admin Only)
app.get("/api/users", requireAuth, async (req, res) => {
  const reqUser = (req as any).user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "غير مصرح" });
  }
  const safeUsers = db.users.map(({ password, ...u }) => u);
  res.json(safeUsers);
});

app.post("/api/users", requireAuth, async (req, res) => {
  const reqUser = (req as any).user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "غير مصرح" });
  }

  const { id, username, name, role, club, allowedPages } = req.body;
  if (!username || !name || !role) {
    return res.status(400).json({ error: "جميع الحقول الأساسية مطلوبة" });
  }

  const exists = db.users.some((u) => u.username.toLowerCase() === username.toLowerCase());
  if (exists) {
    return res.status(400).json({ error: "اسم المستخدم هذا مسجل بالفعل بالمنظومة" });
  }

  const newUser = {
    id: id || "usr-" + Date.now(),
    username,
    name,
    role,
    club: (role === "club" || role === "international_user") ? club : undefined,
    allowedPages: Array.isArray(allowedPages) ? allowedPages : undefined,
    firstLogin: true,
    passwordChanged: false,
    password: DEFAULT_HASH // Assign default '123'
  };

  db.users.push(newUser);
  await saveDb();

  logAudit(reqUser.username, reqUser.name, reqUser.role, "إنشاء حساب مستخدم جديد", `تم إنشاء حساب مستخدم جديد باسم ${name} ودور ${role}`);
  res.json({ success: true, user: { id: newUser.id, username, name, role, club, allowedPages: newUser.allowedPages } });
});

app.put("/api/users/:id", requireAuth, async (req, res) => {
  const reqUser = (req as any).user;
  if (reqUser.role !== "admin" && reqUser.id !== req.params.id) {
    return res.status(403).json({ error: "غير مصرح" });
  }

  const { name, role, club, signatureUrl, allowedPages } = req.body;
  const dbUser = db.users.find((u) => u.id === req.params.id);
  if (!dbUser) {
    return res.status(404).json({ error: "المستخدم غير موجود" });
  }

  if (name) dbUser.name = name;
  if (reqUser.role === "admin") {
    if (role) dbUser.role = role;
    if (club !== undefined) dbUser.club = club;
    if (allowedPages !== undefined) dbUser.allowedPages = Array.isArray(allowedPages) ? allowedPages : undefined;
  } else {
    if (club && (dbUser.role === "club" || dbUser.role === "international_user")) dbUser.club = club;
  }
  if (signatureUrl !== undefined && dbUser.role === "sector_manager") {
    dbUser.signatureUrl = signatureUrl;
  }
  await saveDb();

  logAudit(reqUser.username, reqUser.name, reqUser.role, "تعديل حساب مستخدم", `تم تعديل بيانات الحساب لـ ${dbUser.name}`);
  res.json({ success: true, user: { id: dbUser.id, username: dbUser.username, name: dbUser.name, role: dbUser.role, club: dbUser.club, signatureUrl: dbUser.signatureUrl, allowedPages: dbUser.allowedPages } });
});

app.delete("/api/users/:id", requireAuth, async (req, res) => {
  const reqUser = (req as any).user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "غير مصرح" });
  }

  const index = db.users.findIndex((u) => u.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "المستخدم غير موجود" });
  }

  const targetUser = db.users[index];
  if (targetUser.username === "admin") {
    return res.status(400).json({ error: "لا يمكن حذف حساب الأدمن الأساسي" });
  }

  db.users.splice(index, 1);
  await saveDb();

  logAudit(reqUser.username, reqUser.name, reqUser.role, "حذف حساب مستخدم", `تم حذف حساب المستخدم ${targetUser.name}`);
  res.json({ success: true });
});

// 2. Dynamic Dropdowns Routes
app.get("/api/dropdowns", async (req, res) => {
  res.json({
    dropdowns: db.dropdowns || DEFAULT_DB.dropdowns,
    dropdownLabels: db.dropdownLabels || DEFAULT_DB.dropdownLabels
  });
});

// Create new dropdown category
app.post("/api/dropdowns/categories/create", requireAuth, async (req, res) => {
  const reqUser = (req as any).user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "صلاحية الأدمن مطلوبة لإضافة قائمة اختيار جديدة" });
  }

  const { categoryKey, categoryLabel, initialOption } = req.body;
  if (!categoryLabel || !categoryLabel.trim()) {
    return res.status(400).json({ error: "اسم القائمة بالعربية مطلوب" });
  }

  let key = (categoryKey && categoryKey.trim()) 
    ? categoryKey.trim().replace(/\s+/g, '_') 
    : `custom_${Date.now()}`;

  if (!db.dropdowns) db.dropdowns = { ...DEFAULT_DB.dropdowns };
  if (!db.dropdownLabels) db.dropdownLabels = { ...DEFAULT_DB.dropdownLabels };

  if (db.dropdowns[key]) {
    return res.status(400).json({ error: "هذه القائمة موجودة بالفعل" });
  }

  db.dropdowns[key] = (initialOption && initialOption.trim()) ? [initialOption.trim()] : ["خيار 1"];
  db.dropdownLabels[key] = categoryLabel.trim();

  await saveDb();
  logAudit(reqUser.username, reqUser.name, reqUser.role, "إضافة قائمة جديدة", `تم إنشاء قائمة اختيار جديدة: ${categoryLabel.trim()}`);
  res.json({ 
    success: true, 
    dropdowns: db.dropdowns, 
    dropdownLabels: db.dropdownLabels 
  });
});

// Delete custom dropdown category
app.delete("/api/dropdowns/categories/:category", requireAuth, async (req, res) => {
  const reqUser = (req as any).user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "صلاحية الأدمن مطلوبة لحذف قائمة اختيار" });
  }

  const { category } = req.params;
  const coreCategories = ['clubs', 'membershipTypes', 'paymentMethods', 'cancellationReasons', 'committeeResults', 'cancellationStatuses', 'exceptions'];
  if (coreCategories.includes(category)) {
    return res.status(400).json({ error: "لا يمكن حذف القوائم الأساسية للنظام" });
  }

  if (db.dropdowns && db.dropdowns[category]) {
    delete db.dropdowns[category];
  }
  if (db.dropdownLabels && db.dropdownLabels[category]) {
    delete db.dropdownLabels[category];
  }

  await saveDb();
  logAudit(reqUser.username, reqUser.name, reqUser.role, "حذف قائمة اختيار", `تم حذف قائمة الاختيار: ${category}`);
  res.json({ 
    success: true, 
    dropdowns: db.dropdowns, 
    dropdownLabels: db.dropdownLabels 
  });
});

// Dynamic Field Labels Customization Routes
app.get("/api/label-names", async (req, res) => {
  res.json(db.labelNames || DEFAULT_DB.labelNames);
});

app.post("/api/label-names", requireAuth, async (req, res) => {
  const reqUser = (req as any).user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "صلاحية الأدمن مطلوبة لتعديل تسميات الحقول" });
  }

  db.labelNames = {
    ...(db.labelNames || DEFAULT_DB.labelNames),
    ...req.body
  };
  await saveDb();

  logAudit(reqUser.username, reqUser.name, reqUser.role, "تعديل تسميات الحقول", "تم تعديل بعض تسميات حقول الإدخال والتقارير");
  res.json({ success: true, labelNames: db.labelNames });
});

// Custom Fields Routes
app.get("/api/custom-fields", async (req, res) => {
  res.json(db.customFields || []);
});

app.post("/api/custom-fields", requireAuth, async (req, res) => {
  const reqUser = (req as any).user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "صلاحية الأدمن مطلوبة لتعديل الحقول المخصصة" });
  }

  if (Array.isArray(req.body)) {
    db.customFields = req.body;
  } else if (req.body && typeof req.body === "object") {
    const field = req.body;
    if (!field.id) {
      field.id = "cf_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    }
    if (!db.customFields) db.customFields = [];
    const index = db.customFields.findIndex((f: any) => f.id === field.id);
    if (index >= 0) {
      db.customFields[index] = field;
    } else {
      db.customFields.push(field);
    }
  }

  await saveDb();
  logAudit(reqUser.username, reqUser.name, reqUser.role, "إدارة الحقول المخصصة", "تم تحديث أو إضافة حقول مخصصة للنظام");
  res.json({ success: true, customFields: db.customFields });
});

app.delete("/api/custom-fields/:id", requireAuth, async (req, res) => {
  const reqUser = (req as any).user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "صلاحية الأدمن مطلوبة لحذف الحقول المخصصة" });
  }

  const { id } = req.params;
  if (db.customFields) {
    db.customFields = db.customFields.filter((f: any) => f.id !== id);
  }
  await saveDb();
  logAudit(reqUser.username, reqUser.name, reqUser.role, "حذف حقل مخصص", `تم حذف الحقل المخصص: ${id}`);
  res.json({ success: true, customFields: db.customFields || [] });
});

app.post("/api/dropdowns/:category", requireAuth, async (req, res) => {
  const reqUser = (req as any).user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "صلاحية الأدمن مطلوبة لتعديل قوائم الاختيار" });
  }

  const { category } = req.params;
  const { option } = req.body;

  if (!option || !option.trim()) {
    return res.status(400).json({ error: "خيار القائمة لا يمكن أن يكون فارغاً" });
  }

  if (!db.dropdowns[category]) {
    db.dropdowns[category] = [];
  }

  const list = db.dropdowns[category];

  if (list.includes(option.trim())) {
    return res.status(400).json({ error: "هذا الخيار متواجد بالفعل في هذه القائمة" });
  }

  list.push(option.trim());
  await saveDb();

  logAudit(reqUser.username, reqUser.name, reqUser.role, "إضافة خيار لقائمة", `تم إضافة "${option.trim()}" إلى قائمة ${category}`);
  res.json({ success: true, dropdowns: db.dropdowns, dropdownLabels: db.dropdownLabels });
});

app.put("/api/dropdowns/:category/rename", requireAuth, async (req, res) => {
  const reqUser = (req as any).user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "غير مصرح" });
  }

  const { category } = req.params;
  const { oldOption, newOption } = req.body;

  if (!oldOption || !newOption || !newOption.trim()) {
    return res.status(400).json({ error: "الخيار الجديد والقديم مطلوبان" });
  }

  const list = (db.dropdowns as any)[category];
  if (!list) {
    return res.status(404).json({ error: "القائمة المطلوبة غير صحيحة" });
  }

  const index = list.indexOf(oldOption);
  if (index === -1) {
    return res.status(404).json({ error: "الخيار القديم غير موجود بالقائمة" });
  }

  list[index] = newOption.trim();
  await saveDb();

  logAudit(reqUser.username, reqUser.name, reqUser.role, "تعديل خيار لقائمة", `تم تعديل الاسم من "${oldOption}" إلى "${newOption.trim()}" في قائمة ${category}`);
  res.json({ success: true, dropdowns: db.dropdowns });
});

app.delete("/api/dropdowns/:category", requireAuth, async (req, res) => {
  const reqUser = (req as any).user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "صلاحية الأدمن مطلوبة لحذف خيارات قوائم الاختيار" });
  }

  const { category } = req.params;
  const { option } = req.query;

  if (!option) {
    return res.status(400).json({ error: "يجب تحديد الخيار المراد حذفه" });
  }

  const list = (db.dropdowns as any)[category];
  if (!list) {
    return res.status(404).json({ error: "القائمة المطلوبة غير صحيحة" });
  }

  const index = list.indexOf(option);
  if (index === -1) {
    return res.status(404).json({ error: "الخيار المطلوب غير متواجد" });
  }

  list.splice(index, 1);
  await saveDb();

  logAudit(reqUser.username, reqUser.name, reqUser.role, "حذف خيار من قائمة", `تم حذف "${option}" من قائمة ${category}`);
  res.json({ success: true, dropdowns: db.dropdowns });
});

// 3. Committees Routes
app.get("/api/committees", async (req, res) => {
  res.json(db.committees);
});

app.post("/api/committees", requireAuth, async (req, res) => {
  const reqUser = (req as any).user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "الأدمن فقط لديه صلاحية التحكم باللجان" });
  }

  const { number, year, approvalDate } = req.body;
  if (!number) {
    return res.status(400).json({ error: "رقم اللجنة مطلوب" });
  }

  const commYear = (year && String(year).trim()) ? String(year).trim() : new Date().getFullYear().toString();

  // Close all other committees
  db.committees.forEach((c) => {
    c.status = "closed";
  });

  const newComm = {
    id: `comm-${number}-${commYear}-${Date.now()}`,
    number: String(number).trim(),
    year: commYear,
    status: "open" as const,
    approvalDate: approvalDate || ""
  };

  db.committees.push(newComm);
  await saveDb();

  logAudit(reqUser.username, reqUser.name, reqUser.role, "إنشاء لجنة جديدة", `تم فتح لجنة جديدة برقم ${number}`);
  res.json({ success: true, committee: newComm, committees: db.committees });
});

app.put("/api/committees/:id", requireAuth, async (req, res) => {
  const reqUser = (req as any).user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "الأدمن فقط لديه صلاحية التحكم باللجان" });
  }

  const { status, approvalDate } = req.body;
  const comm = db.committees.find((c) => c.id === req.params.id);
  if (!comm) {
    return res.status(404).json({ error: "اللجنة غير موجودة" });
  }

  if (status) comm.status = status;
  if (approvalDate || status === 'closed') {
    if (approvalDate) comm.approvalDate = approvalDate;
    
    // Propagate approval date and set decision to Accepted for all non-rejected requests in this committee
    db.requests.forEach((r) => {
      if (r.committeeNo === comm.number && (!comm.year || r.committeeYear === comm.year)) {
        if (approvalDate) r.approvalDate = approvalDate;
        if (r.result !== "Rejected" && r.status !== "Rejected" && r.firstManagerApproved !== false) {
          r.result = "Accepted";
        }
      }
    });
  }
  
  await saveDb();

  logAudit(reqUser.username, reqUser.name, reqUser.role, "تعديل حالة اللجنة", `تم تعديل اللجنة ${comm.number}-${comm.year}: الحالة=${comm.status}`);
  res.json({ success: true, committees: db.committees, requests: db.requests });
});

// --- Formulas API Endpoints ---
app.get("/api/formulas", requireAuth, async (req, res) => {
  res.json(db.formulas || DEFAULT_DB.formulas);
});

app.put("/api/formulas", requireAuth, async (req, res) => {
  const reqUser = (req as any).user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "الأدمن فقط لديه صلاحية تعديل معادلات النظام" });
  }

  const { formulas, recalculateScope } = req.body;
  if (!formulas) {
    return res.status(400).json({ error: "بيانات المعادلات غير مكتملة" });
  }

  db.formulas = { ...db.formulas, ...formulas };

  let updatedCount = 0;
  const cutoff = new Date(db.formulas.cutoffDate || "2026-07-01");

  if (recalculateScope && recalculateScope !== 'none') {
    db.requests = db.requests.map((r: any) => {
      const subDate = new Date(r.subscriptionDate);
      const isAfterCutoff = !isNaN(subDate.getTime()) && subDate.getTime() >= cutoff.getTime();

      let shouldRecalc = false;
      if (recalculateScope === 'all') {
        shouldRecalc = true;
      } else if (recalculateScope === 'old' && !isAfterCutoff) {
        shouldRecalc = true;
      } else if (recalculateScope === 'new' && isAfterCutoff) {
        shouldRecalc = true;
      }

      if (shouldRecalc) {
        updatedCount++;
        return calculateRequestFields(r, db.formulas);
      }
      return r;
    });
  }

  await saveDb();

  logAudit(
    reqUser.username, 
    reqUser.name, 
    reqUser.role, 
    "تعديل القواعد والمعادلات الحسابية", 
    `تم تحديث معادلات المنظومة ونطاق التطبيق: ${recalculateScope || 'المستقبل فقط'} (تم إعادة احتساب ${updatedCount} طلب)`
  );

  res.json({ 
    success: true, 
    formulas: db.formulas, 
    requests: db.requests,
    updatedCount 
  });
});

// --- Mathematical Logic Helper for Cancellation Requests ---
function evaluateCustomFormula(expression: string, vars: Record<string, number>): number {
  if (!expression || typeof expression !== 'string') return 0;
  try {
    let safeExpr = expression;
    const sortedKeys = Object.keys(vars).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      const val = parseFloat(vars[key] as any) || 0;
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      safeExpr = safeExpr.replace(regex, `(${val})`);
    }
    const sanitized = safeExpr.replace(/[^0-9\.\+\-\*\/\%\(\)\s]/g, '');
    if (!sanitized.trim()) return 0;
    const func = new Function(`return (${sanitized});`);
    const result = func();
    return isNaN(result) || !isFinite(result) ? 0 : Math.round(result * 100) / 100;
  } catch (err) {
    return 0;
  }
}

function parseAnyDate(val: any): Date | null {
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

function formatDateCustom(val: any): string {
  const d = parseAnyDate(val);
  if (!d) return val ? String(val) : '';
  const ENGLISH_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = d.getDate();
  const monthStr = ENGLISH_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${monthStr}-${year}`;
}

function parseSmartNumber(val: any): number {
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

function calculateRequestFields(reqData: any, customFormulas?: any): any {
  const formulas = customFormulas || db.formulas || DEFAULT_DB.formulas;

  // Format dates cleanly to D-MMM-YYYY format (e.g. 4-Apr-2026)
  const subDate = parseAnyDate(reqData.subscriptionDate);
  const reqDate = parseAnyDate(reqData.requestDate);

  const formattedSubDate = subDate ? formatDateCustom(subDate) : (reqData.subscriptionDate || "");
  const formattedReqDate = reqDate ? formatDateCustom(reqDate) : (reqData.requestDate || "");

  // Parsing numbers to avoid concatenation
  const cashAmount = parseSmartNumber(reqData.cashAmount);
  const visaAmount = parseSmartNumber(reqData.visaAmount);
  const transferValue = parseSmartNumber(reqData.transferValue);
  const checksPaid = parseSmartNumber(reqData.checksPaid);
  const checksUnpaid = parseSmartNumber(reqData.checksUnpaid);
  const annualRenewalDue = parseSmartNumber(reqData.annualRenewalDue);
  const debtABKCompanies = parseSmartNumber(reqData.debtABKCompanies);

  // 1. مبلغ المقدم (Calculated)
  const rawAdv = parseSmartNumber(reqData.advancePaid);
  const advancePaid = (cashAmount + visaAmount) > 0 ? (cashAmount + visaAmount) : rawAdv;

  // 2. قيمة الاشتراك (Calculated) = قيمة التحويلة + نقدا + فيزا + الشيكات المسددة + الشيكات الغير مسددة
  const rawSubVal = parseSmartNumber(reqData.subscriptionValue);
  const sumComponents = transferValue + cashAmount + visaAmount + checksPaid + checksUnpaid;
  const subscriptionValue = sumComponents > 0 ? sumComponents : rawSubVal;

  // 3. Days Calculation (DATEDIF)
  let days = 0;
  if (subDate && reqDate) {
    const diffTime = reqDate.getTime() - subDate.getTime();
    days = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  // 4. Type & Type2 Calculation with 1 July Cutoff Rule
  let type = "";
  let type2: "Less 3 months" | "Over 3 months" | "Less 1 month" | "Over 1 month" = "Less 3 months";

  const cutoff = parseAnyDate(formulas.cutoffDate) || new Date("2026-07-01");
  const isAfterCutoff = subDate && subDate.getTime() >= cutoff.getTime();

  if (isAfterCutoff) {
    if (days <= (formulas.newDaysThreshold ?? 30)) {
      type = formulas.newDaysLabel || "اقل من شهر";
      type2 = "Less 1 month";
    } else {
      const yearsCount = Math.ceil(days / 365);
      type = `${yearsCount} سنة`;
      type2 = "Over 1 month";
    }
  } else {
    if (days <= (formulas.oldDaysThreshold ?? 90)) {
      type = formulas.oldDaysLabel || "اقل من 3 شهور";
      type2 = "Less 3 months";
    } else {
      const yearsCount = Math.ceil(days / 365);
      type = `${yearsCount} سنة`;
      type2 = "Over 3 months";
    }
  }

  // 5. مصاريف إدارية (Admin Fees)
  const nonCompanyMethods = ["نقدا", "نقداً", "شيكات", "فيزا", "ABK", "عضوية دولية", "المشرق", "QNB", "تحويل بنكي"];
  const isCompany = reqData.paymentMethod && !nonCompanyMethods.includes(reqData.paymentMethod.trim());
  const stdAdminFee = formulas.adminFeesStandard ?? 2500;

  // Exception rules lookup
  const rules = formulas.exceptionRules || [
    { id: '1', name: 'عضوية دولية', exemptAdminFee: true, exemptUsageFee: true, exemptVisaFee: false },
    { id: '2', name: 'بدون خصم مصاريف ادارية', exemptAdminFee: true, exemptUsageFee: false, exemptVisaFee: true },
    { id: '3', name: 'جهة سيادية', exemptAdminFee: false, exemptUsageFee: true, exemptVisaFee: false }
  ];

  const fullExceptionText = (
    (reqData.exceptionType || "") + " " +
    (reqData.exceptions || "") + " " +
    (reqData.clubNote || "") + " " +
    (reqData.adminNote || "") + " " +
    (reqData.documents || "")
  ).toLowerCase();

  const isNoRefundException = Boolean(
    fullExceptionText.includes("بدون رد اى مبلغ") ||
    fullExceptionText.includes("بدون رد أي مبلغ") ||
    fullExceptionText.includes("بدون رد اى مبالغ") ||
    fullExceptionText.includes("بدون رد أي مبالغ") ||
    fullExceptionText.includes("بدون رد مبلغ") ||
    fullExceptionText.includes("بدون رد") ||
    (reqData.exceptionType && (reqData.exceptionType.includes("بدون رد") || reqData.exceptionType.includes("بدون رد اى مبلغ") || reqData.exceptionType.includes("بدون رد أي مبلغ"))) ||
    (reqData.exceptions && (reqData.exceptions.includes("بدون رد") || reqData.exceptions.includes("بدون رد اى مبلغ") || reqData.exceptions.includes("بدون رد أي مبلغ")))
  );

  const isAdminExemptByRule = rules.some((r: any) => r.exemptAdminFee && r.name && fullExceptionText.includes(r.name.toLowerCase()));
  const isVisaExemptByRule = rules.some((r: any) => r.exemptVisaFee && r.name && fullExceptionText.includes(r.name.toLowerCase()));
  const isUsageExemptByRule = rules.some((r: any) => r.exemptUsageFee && r.name && fullExceptionText.includes(r.name.toLowerCase()));

  // Base net amount for company calculation
  const companyNetBase = (formulas.companyRefundFormula === "net_transfer" && transferValue > 0) 
    ? transferValue 
    : (subscriptionValue > 0 ? subscriptionValue : (transferValue > 0 ? transferValue : sumComponents));
  const net_amount = isCompany ? Math.max(0, companyNetBase - debtABKCompanies) : 0;

  let calculatedAdminFees = stdAdminFee;

  if (
    reqData.membershipType === "International" ||
    isAdminExemptByRule ||
    fullExceptionText.includes("عضوية دولية") ||
    fullExceptionText.includes("بدون خصم مصاريف ادارية")
  ) {
    calculatedAdminFees = 0;
  } else if (isCompany) {
    // Company rule 1: MIN(net_amount, admin_fee_limit)
    calculatedAdminFees = Math.max(0, Math.min(net_amount, stdAdminFee));
  }

  // Override support
  const adminFees = (reqData.adminFeesOverride !== undefined && reqData.adminFeesOverride !== null && reqData.adminFeesOverride !== "")
    ? parseFloat(reqData.adminFeesOverride) 
    : calculatedAdminFees;

  // 7. مصاريف فيزا 2% (Visa Fees 2%) = فيزا × percentage
  const visaFeePct = formulas.visaFeePercentage ?? 0.02;
  const calculatedVisaFee = visaAmount * visaFeePct;
  let visaFees2Percent = calculatedVisaFee;

  if (reqData.visaFeeOverride !== undefined && reqData.visaFeeOverride !== null && reqData.visaFeeOverride !== "") {
    visaFees2Percent = parseFloat(reqData.visaFeeOverride);
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

  // 6. مقابل الانتفاع (Usage Fees Formula)
  let calculatedUsageFee = 0;
  const exemptTypes = formulas.usageFeeExemptTypes || ["اقل من 3 شهور", "اقل من شهر", "International"];
  const exemptClubs = formulas.usageFeeExemptClubs || ["Tanta", "طنطا"];
  const exemptDocs = formulas.usageFeeExemptDocuments || ["جهة سيادية"];
  const allowExceptionNotesExempt = formulas.usageFeeExemptExceptions !== false;

  const isTypeExempt = exemptTypes.includes(type) || (exemptTypes.includes("International") && reqData.membershipType === "International");
  const isClubExempt = exemptClubs.some((c: string) => {
    if (!c) return false;
    const cLower = c.toLowerCase().trim();
    const reqClub = (reqData.club || "").toLowerCase().trim();
    if (!reqClub) return false;
    if (cLower === reqClub) return true;
    if ((cLower.includes('tanta') || cLower.includes('طنطا')) && (reqClub.includes('tanta') || reqClub.includes('طنطا'))) return true;
    return false;
  });
  const isDocExempt = exemptDocs.some((d: string) => d && ((reqData.documents || "").includes(d) || (reqData.exceptions || "").includes(d)));
  const usageExemptionKeywords = ["إعفاء من مقابل الانتفاع", "اعفاء من مقابل الانتفاع", "معفى من مقابل الانتفاع", "معفي من مقابل الانتفاع", "إعفاء من الانتفاع", "اعفاء من الانتفاع"];
  const isExceptionExempt = allowExceptionNotesExempt && (
    (reqData.usageFeeOverride !== undefined && parseFloat(reqData.usageFeeOverride) === 0) ||
    isUsageExemptByRule ||
    fullExceptionText.includes("عضوية دولية") ||
    fullExceptionText.includes("جهة سيادية") ||
    usageExemptionKeywords.some((kw: string) => fullExceptionText.includes(kw))
  );

  if (isTypeExempt || isClubExempt || isDocExempt || isExceptionExempt) {
    calculatedUsageFee = 0;
  } else {
    const yearsCount = Math.ceil(days / 365);
    let percentage = 0;
    const regP = formulas.regularUsagePercentages || [0.10, 0.20, 0.30, 0.40, 0.50];
    const smartP = formulas.smartUsagePercentages || [0.15, 0.30, 0.45, 0.60, 0.75];

    if (reqData.membershipType === "Regular") {
      percentage = regP[Math.min(yearsCount - 1, regP.length - 1)] || 0;
    } else if (reqData.membershipType === "Smart") {
      percentage = smartP[Math.min(yearsCount - 1, smartP.length - 1)] || 0;
    }

    const baseVal = (formulas.usageFeeBase === "subscriptionValue") ? subscriptionValue : transferValue;
    const stdUsageFee = baseVal * percentage;

    if (isCompany) {
      // Company rule 2: remainder = net_amount - (admin_fee + visa_fee)
      // IF payment_duration_text != "اقل من 3 أشهر" AND net_amount > (admin_fee + visa_fee)
      const remainder = net_amount - (adminFees + visaFees2Percent);
      if (net_amount <= (adminFees + visaFees2Percent) || remainder <= 0) {
        calculatedUsageFee = 0;
      } else if (remainder < stdUsageFee) {
        calculatedUsageFee = Math.max(0, remainder);
      } else {
        calculatedUsageFee = stdUsageFee;
      }
    } else {
      calculatedUsageFee = stdUsageFee;
    }
  }

  // Override support
  const usageFee = (reqData.usageFeeOverride !== undefined && reqData.usageFeeOverride !== null && reqData.usageFeeOverride !== "")
    ? parseFloat(reqData.usageFeeOverride) 
    : calculatedUsageFee;

  // 8. مبلغ الخصم (Discount Amount) = مصاريف إدارية + مقابل الانتفاع + مصاريف فيزا
  const discountAmount = adminFees + usageFee + visaFees2Percent;

  // 9. Refund Amount Formula (by Payment Method and Formulas Config with dynamic dropdown options)
  let refundAmount: number | string = 0;
  const rawRefundInput = reqData.refundAmount !== undefined && reqData.refundAmount !== null && reqData.refundAmount !== ""
    ? (typeof reqData.refundAmount === "number" ? reqData.refundAmount : parseFloat(reqData.refundAmount))
    : undefined;

  const methodOptions = formulas.paymentMethodOptions || DEFAULT_DB.formulas.paymentMethodOptions;
  const customMethods = formulas.customPaymentMethods || [];

  const cashFormula = formulas.cashRefundFormula || "subscriptionValue";
  const checksFormula = formulas.checksRefundFormula || "all_checks";
  const bankFormula = formulas.bankRefundFormula || "transferValue";
  const companyFormula = formulas.companyRefundFormula || "net_subscription";

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

  // Check if custom payment method matching reqData.paymentMethod exists
  const matchedCustomMethod = customMethods.find((m: any) => m.methodName && m.methodName.trim().toLowerCase() === (reqData.paymentMethod || '').trim().toLowerCase());

  if (matchedCustomMethod) {
    const selectedOpt = (matchedCustomMethod.options || []).find((o: any) => o.value === matchedCustomMethod.selectedFormula || o.id === matchedCustomMethod.selectedFormula);
    if (selectedOpt && selectedOpt.expression) {
      refundAmount = Math.max(0, evaluateCustomFormula(selectedOpt.expression, calcVars));
    } else {
      refundAmount = Math.max(0, subscriptionValue - discountAmount);
    }
  } else if (reqData.paymentMethod === "نقدا" || reqData.paymentMethod === "نقداً") {
    const cashOpts = methodOptions?.cash || [];
    const selectedOpt = cashOpts.find((o: any) => o.value === cashFormula || o.id === cashFormula);
    if (selectedOpt && selectedOpt.expression && !["subscriptionValue", "transferValue", "collected"].includes(selectedOpt.value)) {
      refundAmount = Math.max(0, evaluateCustomFormula(selectedOpt.expression, calcVars));
    } else {
      let base = subscriptionValue;
      if (cashFormula === "transferValue") base = transferValue;
      else if (cashFormula === "collected") base = cashAmount + visaAmount;
      refundAmount = Math.max(0, base - discountAmount);
    }
  } else if (reqData.paymentMethod === "شيكات") {
    const checkOpts = methodOptions?.checks || [];
    const selectedOpt = checkOpts.find((o: any) => o.value === checksFormula || o.id === checksFormula);
    if (selectedOpt && selectedOpt.expression && !["all_checks", "paid_only", "subscriptionValue"].includes(selectedOpt.value)) {
      refundAmount = Math.max(0, evaluateCustomFormula(selectedOpt.expression, calcVars));
    } else {
      let base = advancePaid + checksPaid;
      if (checksFormula === "all_checks") base = advancePaid + checksPaid + checksUnpaid;
      else if (checksFormula === "subscriptionValue") base = subscriptionValue;
      refundAmount = Math.max(0, base - discountAmount);
    }
  } else if (reqData.paymentMethod === "ABK") {
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
  } else if (["المشرق", "QNB"].includes(reqData.paymentMethod)) {
    const bankOpts = methodOptions?.banks || [];
    const selectedOpt = bankOpts.find((o: any) => o.value === bankFormula || o.id === bankFormula);
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

  // 10. رد للعميل (Companies only): refundToClient = MAX(0, companyNetBase - debtABKCompanies - discountAmount)
  // يتم حذفه بالكامل في حالة ABK
  let refundToClient: number | string | "Not Required" = "Not Required";
  if (reqData.paymentMethod === "ABK") {
    refundToClient = "Not Required";
  } else if (isNoRefundException) {
    refundToClient = 0;
  } else if (isCompany) {
    if (!debtABKCompanies || debtABKCompanies <= 0) {
      refundToClient = "في انتظار المديونية";
    } else {
      const compOpts = methodOptions?.companies || [];
      const selectedOpt = compOpts.find((o: any) => o.value === companyFormula || o.id === companyFormula);
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

  // 11. فرق مديونية ABK: madiouniyat bank - baseRefund (حيث baseRefund = subscriptionValue - discountAmount)
  let abkDebtDifference: number | "Not Required" | string = "Not Required";
  if (reqData.paymentMethod === "ABK") {
    if (!debtABKCompanies || debtABKCompanies <= 0) {
      abkDebtDifference = "فى انتظار مديونية البنك";
    } else {
      const baseRefund = Math.max(0, subscriptionValue - discountAmount);
      abkDebtDifference = debtABKCompanies - baseRefund;
    }
  }

  // Calculate Custom Field Formulas if any
  const customFieldValues: Record<string, any> = { ...(reqData.customFields || {}) };
  if (db.customFields && Array.isArray(db.customFields)) {
    const vars: Record<string, number> = {
      subscriptionValue,
      transferValue,
      cashAmount,
      visaAmount,
      checksPaid,
      checksUnpaid,
      advancePaid,
      annualRenewalDue,
      adminFees,
      usageFee,
      visaFees2Percent,
      discountAmount,
      debtABKCompanies,
      refundAmount: typeof refundAmount === 'number' ? refundAmount : 0,
      days
    };

    for (const field of db.customFields) {
      if (field.type === 'formula' && field.formulaExpression) {
        customFieldValues[field.key] = evaluateCustomFormula(field.formulaExpression, vars);
      }
    }
  }

  // Dates formatting
  const statusDateParsed = parseAnyDate(reqData.statusDate);
  const approvalDateParsed = parseAnyDate(reqData.approvalDate);
  let formattedStatusDate = statusDateParsed ? formatDateCustom(statusDateParsed) : (reqData.statusDate || "");
  let formattedApprovalDate = approvalDateParsed ? formatDateCustom(approvalDateParsed) : (reqData.approvalDate || "");

  if (!formattedStatusDate && (reqData.result === "Rejected" || reqData.status === "Rejected" || reqData.status === "Cancelled" || reqData.status === "Revoked" || reqData.status === "Deletion")) {
    formattedStatusDate = formattedApprovalDate || formattedReqDate || formatDateCustom(new Date());
  }

  // Clear falsely assigned firstManagerApproved if not actually sent to First Manager
  let fmApproved = reqData.firstManagerApproved;
  if (!reqData.approvalSentToFirstManager && fmApproved === false && !reqData.firstManagerComments) {
    fmApproved = undefined;
  }

  // Return full fields combined
  return {
    ...reqData,
    subscriptionDate: formattedSubDate,
    requestDate: formattedReqDate,
    statusDate: formattedStatusDate,
    approvalDate: formattedApprovalDate,
    firstManagerApproved: fmApproved,
    cashAmount,
    visaAmount,
    transferValue,
    checksPaid,
    checksUnpaid,
    annualRenewalDue,
    debtABKCompanies,
    advancePaid,
    subscriptionValue,
    days,
    type,
    type2,
    adminFees,
    usageFee,
    visaFees2Percent,
    discountAmount,
    refundAmount,
    refundToClient,
    abkDebtDifference,
    currency: reqData.currency || "جم",
    customFields: customFieldValues,
    requestYear: !isNaN(reqDate.getFullYear()) ? reqDate.getFullYear() : new Date().getFullYear(),
  };
}

function normalizeClubName(clubStr: any): string {
  if (!clubStr || typeof clubStr !== 'string') return '';
  let str = clubStr.trim().toLowerCase();
  str = str.replace(/^(نادي|نادى|فرع|club|branch)\s+/g, '').trim();
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
  if (synonyms[str]) return synonyms[str];
  return str.replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي');
}

function isSameClub(clubA: any, clubB: any): boolean {
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

function normalizeMembershipNumber(mem: any): string {
  if (mem === null || mem === undefined) return '';
  return String(mem)
    .trim()
    .toLowerCase()
    .replace(/[\u0660-\u0669]/g, d => (d.charCodeAt(0) - 1632).toString())
    .replace(/[\u06F0-\u06F9]/g, d => (d.charCodeAt(0) - 1776).toString())
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ئ/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/[-_–—\s\/\.\\]/g, '');
}

function isSameMembershipNumber(mem1: any, mem2: any): boolean {
  if (!mem1 || !mem2) return false;
  const s1 = String(mem1).trim().toLowerCase();
  const s2 = String(mem2).trim().toLowerCase();
  if (s1 === s2) return true;
  const n1 = normalizeMembershipNumber(mem1);
  const n2 = normalizeMembershipNumber(mem2);
  return n1.length > 0 && n1 === n2;
}

function isInternationalRequest(r: any): boolean {
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

// 4. Requests CRUD Endpoints
// Check membership duplicate globally across all branches
app.get("/api/requests/check-membership", requireAuth, async (req, res) => {
  const { number, excludeId } = req.query;
  const numStr = String(number || "").trim();
  if (!numStr) {
    return res.json({ found: false });
  }

  const existingForMem = db.requests.filter((r) => {
    if (excludeId && String(r.id) === String(excludeId)) return false;
    return isSameMembershipNumber(r.membershipNumber, numStr);
  });

  if (existingForMem.length === 0) {
    return res.json({ found: false });
  }

  const isRejectedReq = (r: any) => {
    const st = String(r.status || "").toLowerCase().trim();
    const res = String(r.result || "").toLowerCase().trim();
    return st === "rejected" || st === "مرفوض" || st.includes("مرفوض") || res === "rejected" || res === "مرفوض";
  };

  const activeRequest = existingForMem.find((r) => !isRejectedReq(r));
  const rejectedRequests = existingForMem.filter((r) => isRejectedReq(r));

  res.json({
    found: true,
    isAllowedReReview: !activeRequest && rejectedRequests.length > 0,
    activeRequest: activeRequest || null,
    rejectedRequests: rejectedRequests || [],
    allMatches: existingForMem
  });
});

app.get("/api/requests", requireAuth, async (req, res) => {
  const user = (req as any).user;
  let resultRequests = [...db.requests];

  // If user is club user, they only see their club's requests
  if (user.role === "club") {
    resultRequests = resultRequests.filter((r) => isSameClub(r.club, user.club));
  } else if (user.role === "international_user") {
    resultRequests = resultRequests.filter((r) => isInternationalRequest(r));
  }

  res.json(resultRequests);
});

app.post("/api/requests", requireAuth, async (req, res) => {
  const user = (req as any).user;
  
  // Create default Serial No.
  const maxId = db.requests.reduce((max, r) => r.id > max ? r.id : max, 0);
  const newId = maxId + 1;

  // Uniqueness validation of Membership Number (رقم العضوية)
  const { membershipNumber } = req.body;
  const existingWithSameNum = db.requests.filter((r) => isSameMembershipNumber(r.membershipNumber, membershipNumber));
  
  // Exception: Can submit if previous is Rejected
  const isDuplicateActive = existingWithSameNum.some((r) => r.status !== "Rejected" && r.result !== "Rejected" && !String(r.status || "").includes("مرفوض") && !String(r.result || "").includes("مرفوض"));
  if (isDuplicateActive) {
    const activeOne = existingWithSameNum.find((r) => r.status !== "Rejected" && r.result !== "Rejected" && !String(r.status || "").includes("مرفوض") && !String(r.result || "").includes("مرفوض"));
    const clubInfo = activeOne?.club ? ` من فرع (${activeOne.club})` : '';
    return res.status(400).json({ error: `لا يمكن تكرار رقم العضوية حيث يوجد طلب سابق نشط بالمنظومة${clubInfo}. التكرار مسموح فقط إذا كان الطلب السابق مرفوضاً (Rejected).` });
  }

  // If there is a previous rejected request, mark as re-review (إعادة عرض)
  const isReReview = existingWithSameNum.length > 0 && !isDuplicateActive;
  let memberName = req.body.memberName || "";
  let cancellationReasonDetail = req.body.cancellationReasonDetail || "";

  if (isReReview) {
    if (!memberName.includes("إعادة عرض")) {
      memberName = `${memberName.trim()} (إعادة عرض)`;
    }
    if (cancellationReasonDetail && !cancellationReasonDetail.includes("إعادة عرض")) {
      cancellationReasonDetail = `${cancellationReasonDetail.trim()} (إعادة عرض)`;
    }
  }

  // For club user, force their club only
  let clubName = req.body.club;
  if (user.role === "club") {
    clubName = user.club;
  }

  // For international user, ensure membershipType is International
  let reqMembershipType = req.body.membershipType;
  let reqCurrency = req.body.currency;
  let reqPaymentMethod = req.body.paymentMethod;
  if (user.role === "international_user") {
    reqMembershipType = reqMembershipType || "International";
    reqCurrency = reqCurrency || "ريال سعودى";
    reqPaymentMethod = reqPaymentMethod || "عضوية دولية";
  }

  // Get current open committee and assign to new request
  const openCommittee = db.committees.find((c) => c.status === "open");
  let commNo = req.body.committeeNo;
  let commYear = req.body.committeeYear;
  let approvalDate = req.body.approvalDate;

  if (openCommittee) {
    commNo = commNo || openCommittee.number;
    commYear = commYear || openCommittee.year || (openCommittee.approvalDate ? String(new Date(openCommittee.approvalDate).getFullYear()) : '2026');
    approvalDate = approvalDate || openCommittee.approvalDate;
  }
  if (!commYear) {
    commYear = approvalDate ? String(new Date(approvalDate).getFullYear()) : '2026';
  }

  const processedData = calculateRequestFields({
    ...req.body,
    id: newId,
    memberName,
    cancellationReasonDetail,
    membershipType: reqMembershipType,
    currency: reqCurrency,
    paymentMethod: reqPaymentMethod,
    isReReview: isReReview || req.body.isReReview,
    club: clubName,
    committeeNo: commNo,
    committeeYear: commYear,
    approvalDate: approvalDate,
    result: "Pending",
    status: req.body.status || "Pending",
    statusDate: (req.body.status && req.body.status !== "Pending") ? (req.body.statusDate || "") : "",
    receiptReceived: req.body.receiptReceived ?? false,
    receiptReceivedDate: req.body.receiptReceivedDate || null,
    reviewed: req.body.reviewed ?? false
  });

  db.requests.push(processedData);
  await saveDb();

  logAudit(user.username, user.name, user.role, "إنشاء طلب إلغاء", `تم إنشاء طلب إلغاء جديد برقم عضوية ${membershipNumber} للمشترك ${processedData.memberName}`, newId);
  res.json({ success: true, request: processedData });
});

// Helper functions for matching request IDs strictly and loosely
function findRequestIndexById(rawId: any) {
  const strId = String(rawId);
  const numId = Number(rawId);
  return db.requests.findIndex((r) => String(r.id) === strId || r.id == rawId || (!isNaN(numId) && r.id === numId));
}

function findRequestById(rawId: any) {
  const strId = String(rawId);
  const numId = Number(rawId);
  return db.requests.find((r) => String(r.id) === strId || r.id == rawId || (!isNaN(numId) && r.id === numId));
}

app.put("/api/requests/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const rawId = req.params.id;
  const reqIndex = findRequestIndexById(rawId);

  if (reqIndex === -1) {
    return res.status(404).json({ error: "الطلب غير موجود في قاعدة البيانات" });
  }

  const existingRequest = db.requests[reqIndex];
  const reqId = existingRequest.id;

  // International user permission check
  if (user.role === "international_user" && !isInternationalRequest(existingRequest)) {
    return res.status(403).json({ error: "غير مصرح بتعديل طلبات غير تابعة للعضويات الدولية" });
  }

  const bodyKeys = Object.keys(req.body);
  const isOnlyReceiptUpdate = bodyKeys.length > 0 && bodyKeys.every((k) => k === "receiptReceived" || k === "receiptReceivedDate");

  if (!isOnlyReceiptUpdate) {
    // Restrict modification if the request is already reviewed and user is not admin
    if (existingRequest.reviewed && user.role !== "admin") {
      return res.status(403).json({ error: "لا يمكن تعديل الطلب بعد مراجعته (Reviewed) إلا من خلال الأدمن المركزي" });
    }

    // Restrict modification after Admin Approval (accepted/cancelled/status checks)
    if ((user.role === "club" || user.role === "international_user") && (existingRequest.result === "Accepted" || existingRequest.approvalSentToFirstManager || existingRequest.approvalSentToSectorManager)) {
      return res.status(403).json({ error: "لا يمكن تعديل الطلب بعد إرساله للمراجعين والاعتماد إلا من خلال الأدمن المركزي" });
    }
  }

  // Check unique membership number exception if changed
  const { membershipNumber } = req.body;
  if (membershipNumber && !isSameMembershipNumber(membershipNumber, existingRequest.membershipNumber)) {
    const existingWithSameNum = db.requests.filter((r) => isSameMembershipNumber(r.membershipNumber, membershipNumber) && String(r.id) !== String(reqId));
    const isDuplicateActive = existingWithSameNum.some((r) => r.status !== "Rejected" && r.result !== "Rejected" && !String(r.status || "").includes("مرفوض") && !String(r.result || "").includes("مرفوض"));
    if (isDuplicateActive) {
      return res.status(400).json({ error: "لا يمكن تغيير رقم العضوية إلى هذا الرقم حيث يوجد طلب سابق نشط له بالمنظومة." });
    }
    if (existingWithSameNum.length > 0 && !isDuplicateActive) {
      req.body.isReReview = true;
      if (req.body.memberName && !req.body.memberName.includes("إعادة عرض")) {
        req.body.memberName = `${req.body.memberName.trim()} (إعادة عرض)`;
      }
    }
  }

  // Restrict club user to their club
  let bodyClub = req.body.club;
  if (user.role === "club") {
    bodyClub = user.club;
  }

  const reviewedValue = req.body.reviewed !== undefined ? !!req.body.reviewed : (existingRequest.reviewed ?? false);
  const updatedRequest = calculateRequestFields({
    ...existingRequest,
    ...req.body,
    reviewed: reviewedValue,
    id: reqId,
    club: bodyClub
  });

  db.requests[reqIndex] = updatedRequest;
  await saveDb();

  // Audit and notification triggers
  let auditAction = "تعديل طلب إلغاء";
  let auditMsg = `قام المستخدم ${user.name} بتعديل بيانات الطلب رقم العضوية ${updatedRequest.membershipNumber}`;
  
  if (user.role === "club") {
    auditAction = "تعديل طلب من الفرع";
    auditMsg = `[تنبيه فرع] قام الفرع بتعديل طلب المشترك ${updatedRequest.memberName} رقم العضوية ${updatedRequest.membershipNumber}`;
  } else if (user.role === "international_user") {
    auditAction = "تعديل طلب من مسؤول العضويات الدولية";
    auditMsg = `[تنبيه دولي] قام مسؤول العضويات الدولية بتعديل طلب المشترك ${updatedRequest.memberName} رقم العضوية ${updatedRequest.membershipNumber}`;
  }

  logAudit(user.username, user.name, user.role, auditAction, auditMsg, reqId);
  res.json({ success: true, request: updatedRequest });
});

// Bulk Review Route (Admin only)
app.post("/api/requests/bulk-review", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "الأدمن فقط لديه صلاحية تحديد مراجعة الطلبات" });
  }

  const { ids, reviewed } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: "الرجاء تحديد معرفات الطلبات بشكل صحيح" });
  }

  let updatedCount = 0;
  const strIds = ids.map((id) => String(id));
  db.requests.forEach((r) => {
    if (strIds.includes(String(r.id))) {
      r.reviewed = !!reviewed;
      updatedCount++;
    }
  });

  if (updatedCount > 0) {
    await saveDb();
    logAudit(
      user.username,
      user.name,
      user.role,
      reviewed ? "مراجعة جماعية للطلبات" : "إلغاء مراجعة جماعية",
      `تم تحديث حالة المراجعة لعدد ${updatedCount} طلبات إلى ${reviewed ? "مُراجع" : "غير مُراجع"}`
    );
  }

  res.json({ success: true, requests: db.requests });
});

// Bulk Cancellation Status Route (Admin & Managers)
app.post("/api/requests/bulk-cancellation-status", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin" && user.role !== "first_manager" && user.role !== "sector_manager") {
    return res.status(403).json({ error: "غير مصرح لك بتحديث حالات الإلغاء" });
  }

  const { ids, status, statusDate } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "الرجاء تحديد عضوية واحدة على الأقل" });
  }
  if (!status) {
    return res.status(400).json({ error: "الرجاء اختيار حالة الإلغاء" });
  }
  if (status !== 'Pending' && !statusDate) {
    return res.status(400).json({ error: "تاريخ حالة الإلغاء إجباري عند اختيار حالة إلغاء جديدة" });
  }

  let updatedCount = 0;
  const strIds = ids.map((id) => String(id));

  db.requests.forEach((r) => {
    if (strIds.includes(String(r.id))) {
      r.status = status;
      r.statusDate = status === 'Pending' ? '' : (statusDate || '');
      
      if (status === 'Cancelled' || status === 'Deletion' || status === 'Revoked') {
        if (r.statusDate) {
          const sDate = new Date(r.statusDate);
          if (!isNaN(sDate.getFullYear())) {
            r.refundYear = sDate.getFullYear();
          }
        }
      } else {
        r.refundYear = undefined;
      }
      
      updatedCount++;
    }
  });

  if (updatedCount > 0) {
    await saveDb();
    logAudit(
      user.username,
      user.name,
      user.role,
      "تحديث حالة الإلغاء الجماعية",
      `تم تحديث حالة الإلغاء لعدد ${updatedCount} عضوية إلى (${status}) وتاريخ (${statusDate || '—'})`
    );
  }

  res.json({ success: true, updatedCount, requests: db.requests });
});

app.post("/api/requests/bulk-delete", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "لم يتم تحديد أي طلبات للحذف" });
  }

  const idsSet = new Set(ids.map(id => String(id)));
  const initialCount = db.requests ? db.requests.length : 0;

  db.requests = (db.requests || []).filter(r => !idsSet.has(String(r.id)));
  const deletedCount = initialCount - db.requests.length;
  await saveDb();

  logAudit(user.username, user.name, user.role, "حذف جماعي للطلبات", `تم حذف عدد ${deletedCount} طلب إلغاء دفعة واحدة`);
  res.json({ success: true, count: deletedCount, requests: db.requests });
});

app.delete("/api/requests/clear-all", requireAuth, async (req, res) => {
  const user = (req as any).user;

  const prevCount = db.requests ? db.requests.length : 0;
  db.requests = [];
  await saveDb();

  logAudit(user.username, user.name, user.role, "مسح كافة طلبات الإلغاء", `تم مسح جميع طلبات الإلغاء من قاعدة البيانات (عدد ${prevCount} طلب)`);
  res.json({ success: true, count: prevCount, requests: [] });
});

app.delete("/api/requests/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const rawId = req.params.id;
  const index = findRequestIndexById(rawId);
  if (index === -1) {
    return res.status(404).json({ error: "الطلب غير موجود بملفات قاعدة البيانات" });
  }

  const targetReq = db.requests[index];

  if (user.role !== "admin" && !isSameClub(user.club, targetReq.club)) {
    return res.status(403).json({ error: "غير مصرح لك بحذف هذا الطلب (خاص بفرع آخر)" });
  }

  db.requests.splice(index, 1);
  await saveDb();

  logAudit(user.username, user.name, user.role, "حذف طلب إلغاء", `تم حذف طلب إلغاء للمشترك ${targetReq.memberName} رقم العضوية ${targetReq.membershipNumber}`, targetReq.id);
  res.json({ success: true, requests: db.requests });
});

// --- Attachments & Documents Archive Management Endpoints ---

// 1. Get all attachments across all cancellation requests (visible to all users across all branches)
app.get("/api/attachments/all", requireAuth, async (req, res) => {
  try {
    const allAttachments: any[] = [];
    
    (db.requests || []).forEach((r: any) => {
      const isLocked = Boolean(r.reviewed);
      const reqAttachments = Array.isArray(r.attachments) ? r.attachments : [];
      
      reqAttachments.forEach((att: any) => {
        allAttachments.push({
          ...att,
          isLocked,
          requestId: r.id,
          membershipNumber: r.membershipNumber || "",
          memberName: r.memberName || "",
          loanUnderName: r.loanUnderName || "",
          nationalId: r.nationalId || "",
          externalId: r.externalId || "",
          mobileNumber: r.mobileNumber || "",
          club: r.club || "",
          requestDate: r.requestDate || "",
          subscriptionDate: r.subscriptionDate || "",
          membershipType: r.membershipType || "Regular",
          paymentMethod: r.paymentMethod || "",
          status: r.status || "Pending",
          result: r.result || "Pending",
          reviewed: Boolean(r.reviewed),
          receiptReceived: Boolean(r.receiptReceived),
          refundAmount: r.refundAmount ?? 0,
          cancellationReason: r.cancellationReason || "",
          cancellationReasonDetail: r.cancellationReasonDetail || "",
          salesPerson: r.salesPerson || ""
        });
      });

      // If there's an official First Manager review PDF attached, include it in the global archive
      if (r.firstManagerPdfUrl) {
        allAttachments.push({
          id: `fm-pdf-${r.id}`,
          fileName: r.firstManagerPdfName || "مستندات_الطلب_المعتمدة.pdf",
          fileType: "application/pdf",
          fileSize: r.firstManagerPdfSize || 0,
          fileData: r.firstManagerPdfUrl,
          uploadedAt: r.firstManagerSentAt || r.requestDate || new Date().toISOString(),
          uploadedBy: r.firstManagerSentBy || "admin",
          uploaderName: r.firstManagerSentBy || "أدمن النظام",
          uploaderRole: "admin",
          uploaderClub: "المركز الرئيسي",
          category: "ملف مراجعة الإدارة المالية",
          notes: r.firstManagerSendNotes || "ملف الـ PDF المعتمد المرفق للمدير الأول",
          isLocked,
          requestId: r.id,
          membershipNumber: r.membershipNumber || "",
          memberName: r.memberName || "",
          loanUnderName: r.loanUnderName || "",
          nationalId: r.nationalId || "",
          externalId: r.externalId || "",
          mobileNumber: r.mobileNumber || "",
          club: r.club || "",
          requestDate: r.requestDate || "",
          subscriptionDate: r.subscriptionDate || "",
          membershipType: r.membershipType || "Regular",
          paymentMethod: r.paymentMethod || "",
          status: r.status || "Pending",
          result: r.result || "Pending",
          reviewed: Boolean(r.reviewed),
          receiptReceived: Boolean(r.receiptReceived),
          refundAmount: r.refundAmount ?? 0,
          cancellationReason: r.cancellationReason || "",
          cancellationReasonDetail: r.cancellationReasonDetail || "",
          salesPerson: r.salesPerson || ""
        });
      }
    });

    res.json({
      success: true,
      total: allAttachments.length,
      attachments: allAttachments
    });
  } catch (err: any) {
    res.status(500).json({ error: "فشل استرجاع المرفقات: " + err?.message });
  }
});

// 2. Upload attachments to a specific request (any user can upload before or after review)
app.post("/api/requests/:id/attachments", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const request = findRequestById(req.params.id);
  if (!request) {
    return res.status(404).json({ error: "طلب الإلغاء غير موجود" });
  }

  const { attachment, attachments } = req.body;
  const newItems: any[] = [];

  if (attachment && typeof attachment === "object") {
    newItems.push(attachment);
  }
  if (Array.isArray(attachments)) {
    newItems.push(...attachments);
  }

  if (newItems.length === 0) {
    return res.status(400).json({ error: "لم يتم إرسال أي ملفات مرفقة" });
  }

  if (!Array.isArray(request.attachments)) {
    request.attachments = [];
  }

  const processedItems = newItems.map((item) => ({
    id: item.id || `att-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    fileName: item.fileName || "مستند_مرفق",
    fileType: item.fileType || (item.fileName?.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg"),
    fileSize: item.fileSize || (item.fileData ? Math.round(item.fileData.length * 0.75) : 0),
    fileData: item.fileData || "",
    uploadedAt: item.uploadedAt || new Date().toISOString(),
    uploadedBy: user.username,
    uploaderName: user.name || user.username,
    uploaderRole: user.role,
    uploaderClub: user.club || "المركز الرئيسي",
    category: item.category || "أخرى",
    notes: item.notes || ""
  }));

  request.attachments.push(...processedItems);
  await saveDb();

  logAudit(
    user.username,
    user.name,
    user.role,
    "رفع مرفقات للطلب",
    `تم رفع ${processedItems.length} مرفق جديد لطلب العضوية ${request.membershipNumber} (${request.memberName})`,
    request.id
  );

  res.json({
    success: true,
    message: "تم رفع وحفظ المرفقات بنجاح",
    request,
    attachments: request.attachments,
    requests: db.requests
  });
});

// 3. Delete an attachment (Admin can always delete; non-admin users allowed before Admin Review)
app.delete("/api/requests/:id/attachments/:attachmentId", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const request = findRequestById(req.params.id);
  if (!request) {
    return res.status(404).json({ error: "طلب الإلغاء غير موجود" });
  }

  // If request is reviewed by Admin, only Admin has permission to delete attachments
  if (request.reviewed && user.role !== "admin") {
    return res.status(403).json({
      error: "لا يمكن حذف هذا المستند المرفق بعد اعتماد مراجعة الأدمن (Review) للطلب إلا بواسطة الأدمن المركزي."
    });
  }

  if (!Array.isArray(request.attachments)) {
    request.attachments = [];
  }

  const attIndex = request.attachments.findIndex((a: any) => String(a.id) === String(req.params.attachmentId));
  if (attIndex === -1) {
    return res.status(404).json({ error: "المرفق المطلوب غير موجود بالطلب" });
  }

  const deletedAtt = request.attachments[attIndex];
  request.attachments.splice(attIndex, 1);
  await saveDb();

  logAudit(
    user.username,
    user.name,
    user.role,
    "حذف مرفق من الطلب",
    `تم حذف المرفق (${deletedAtt.fileName}) من طلب العضوية ${request.membershipNumber} (${request.memberName})`,
    request.id
  );

  res.json({
    success: true,
    message: "تم حذف المرفق بنجاح",
    request,
    attachments: request.attachments,
    requests: db.requests
  });
});

// --- Workflow Operations ---

// 1. Admin sends cancellation to First Manager with attached PDF and notes
app.post("/api/requests/:id/send-first-manager", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "الأدمن المركزي فقط يمكنه إرسال طلبات الاعتماد" });
  }

  const request = findRequestById(req.params.id);
  if (!request) {
    return res.status(404).json({ error: "الطلب غير موجود" });
  }

  const { pdfData, pdfName, pdfSize, notes } = req.body || {};

  request.approvalSentToFirstManager = true;
  request.firstManagerApproved = null; // reset if rejected previously
  request.result = "Pending";

  if (pdfData !== undefined) {
    request.firstManagerPdfUrl = pdfData || "";
    request.firstManagerPdfName = pdfName || "مستندات_الطلب.pdf";
    request.firstManagerPdfSize = pdfSize || 0;
  }
  if (notes !== undefined) {
    request.firstManagerSendNotes = notes || "";
  }
  request.firstManagerSentAt = new Date().toISOString();
  request.firstManagerSentBy = user.name || user.username;

  await saveDb();

  logAudit(
    user.username,
    user.name,
    user.role,
    "إرسال للمدير الأول",
    `تم إرسال طلب المشترك ${request.memberName} (${request.membershipNumber}) مع ملف PDF ومستندات الأوراق للاعتماد`,
    request.id
  );
  res.json({ success: true, request, requests: db.requests });
});

// Admin attach or update PDF for First Manager review
app.post("/api/requests/:id/attach-first-manager-pdf", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "الأدمن فقط يمكنه إرفاق أو تعديل ملف الـ PDF" });
  }

  const request = findRequestById(req.params.id);
  if (!request) {
    return res.status(404).json({ error: "الطلب غير موجود" });
  }

  const { pdfData, pdfName, pdfSize, notes } = req.body || {};
  if (pdfData !== undefined) {
    request.firstManagerPdfUrl = pdfData || "";
    request.firstManagerPdfName = pdfName || "مستندات_الطلب.pdf";
    request.firstManagerPdfSize = pdfSize || 0;
  }
  if (notes !== undefined) {
    request.firstManagerSendNotes = notes || "";
  }

  await saveDb();
  logAudit(
    user.username,
    user.name,
    user.role,
    "تحديث ملف PDF للمدير الأول",
    `تم تحديث ملف الـ PDF المرفق لطلب المشترك ${request.memberName} (${request.membershipNumber})`,
    request.id
  );
  res.json({ success: true, request, requests: db.requests });
});

// 2. First Manager approves or rejects (Days > 90/3 months only)
app.post("/api/requests/:id/first-manager-action", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "first_manager") {
    return res.status(403).json({ error: "صلاحية المدير المالي الأول فقط هي المصرح لها باتخاذ أو تعديل القرار" });
  }

  const request = findRequestById(req.params.id);
  if (!request) {
    return res.status(404).json({ error: "الطلب غير موجود" });
  }

  const { approve, comments } = req.body;
  const todayStr = new Date().toISOString().split("T")[0];
  
  if (approve) {
    request.firstManagerApproved = true;
    request.firstManagerComments = comments || "";
    request.firstManagerDecisionDate = todayStr;
    request.approvalSentToSectorManager = true;
    // If it was previously rejected, revert to pending for sector manager review
    if (request.status === "Rejected" || request.result === "Rejected") {
      request.status = "Pending";
      request.result = "Pending";
      request.statusDate = "";
    }
  } else {
    request.firstManagerApproved = false;
    request.firstManagerComments = comments || "";
    request.rejectionReason = comments || "";
    request.firstManagerDecisionDate = todayStr;
    request.result = "Rejected";
    request.status = "Rejected" as any;
    request.statusDate = todayStr;
    (request as any).cancellationStatusDate = todayStr;
    request.approvalSentToSectorManager = false;
    request.sectorManagerApproved = null;
  }
  
  await saveDb();

  logAudit(user.username, user.name, user.role, approve ? "اعتماد المدير المالي الأول" : "رفض المدير المالي الأول", `تم ${approve ? 'اعتماد (Accept)' : 'رفض (Reject)'} طلب العضوية ${request.membershipNumber} - ملاحظات: ${comments || 'لا توجد'}`, request.id);
  res.json({ success: true, request });
});

// 3. Admin sends directly to Sector Manager (for <3 months, which skips First Manager)
app.post("/api/requests/:id/send-sector-manager", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "غير مصرح" });
  }

  const request = findRequestById(req.params.id);
  if (!request) {
    return res.status(404).json({ error: "الطلب غير موجود" });
  }

  request.approvalSentToSectorManager = true;
  request.sectorManagerApproved = null;
  request.result = "Pending";
  await saveDb();

  logAudit(user.username, user.name, user.role, "إرسال لرئيس القطاع", `تم تحويل الطلب رقم ${request.membershipNumber} مباشرة لرئيس قطاع الشؤون المالية للاعتماد النهائي`, request.id);
  res.json({ success: true, request });
});

// 4. Sector Manager approves or rejects (Final approval with digital signature)
app.post("/api/requests/:id/sector-manager-action", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "sector_manager" && user.role !== "admin") {
    return res.status(403).json({ error: "صلاحية رئيس القطاع المالي مطلوبة للاعتماد النهائي" });
  }

  const request = findRequestById(req.params.id);
  if (!request) {
    return res.status(404).json({ error: "الطلب غير موجود" });
  }

  const { approve, comments } = req.body;
  const sectorUser = db.users.find((u) => u.role === "sector_manager");

  if (approve) {
    request.sectorManagerApproved = true;
    request.sectorManagerComments = comments;
    request.result = "Accepted";
    
    // Apply digital signature if available
    if (sectorUser && sectorUser.signatureUrl) {
      request.sectorManagerSignature = sectorUser.signatureUrl;
    }
    
    // Auto populate status date if accepted
    request.statusDate = new Date().toISOString().split("T")[0];
  } else {
    request.sectorManagerApproved = false;
    request.sectorManagerComments = comments;
    request.rejectionReason = comments || "";
    request.result = "Rejected";
    request.status = "Rejected" as any;
  }

  await saveDb();

  logAudit(user.username, user.name, user.role, approve ? "اعتماد رئيس قطاع المالية" : "رفض رئيس قطاع المالية", `تم الاعتماد النهائي للطلب ${request.membershipNumber} مع وضع الختم الإلكتروني وتاريخ المراجعة`, request.id);
  res.json({ success: true, request });
});

// --- Emails Simulation ---
app.get("/api/emails", requireAuth, async (req, res) => {
  res.json(db.emailLogs);
});

app.post("/api/emails/send", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { requestId, type, recipient, subject, body } = req.body;

  const newEmail = {
    id: "mail-" + Date.now(),
    sender: "Wadi Degla Cancellation Hub <cancellations@wadidegla.com>",
    recipient,
    subject,
    body,
    sentAt: new Date().toISOString(),
    requestId,
    type
  };

  db.emailLogs.unshift(newEmail);

  // If email type triggers internal state updates
  if (requestId && type === "Club Notification") {
    const request = db.requests.find((r) => r.id === requestId);
    if (request) {
      // Prompt original receipt collection workflow
      request.clubNote = (request.clubNote || "") + "\n[بريد] تم إرسال إشعار للفرع بطلب استرداد أصول إيصالات العضوية";
    }
  }

  await saveDb();
  logAudit(user.username, user.name, user.role, `إرسال بريد الكتروني - ${type}`, `تم إرسال بريد إلكتروني إلى ${recipient} بخصوص الطلب رقم ${requestId || "عام"}`, requestId);
  res.json({ success: true, email: newEmail });
});

// --- System Status Reconciliation (Excel upload update) ---
app.post("/api/requests/reconcile-system-status", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "الأدمن فقط لديه هذه الصلاحية" });
  }

  const { mappings } = req.body; // Array of { membershipNumber, systemStatus }
  if (!mappings || !Array.isArray(mappings)) {
    return res.status(400).json({ error: "بيانات المطابقة غير صحيحة" });
  }

  let updatedCount = 0;
  mappings.forEach((item: any) => {
    const request = db.requests.find((r) => r.membershipNumber === item.membershipNumber);
    if (request) {
      request.systemStatus = item.systemStatus;
      updatedCount++;
    }
  });

  await saveDb();
  logAudit(user.username, user.name, user.role, "مطابقة حالة النظام", `تم تحديث حالة النظام الداخلي لعدد ${updatedCount} عضوية بناءً على رفع ملف إكسل للمطابقة`);
  res.json({ success: true, updatedCount, requests: db.requests });
});

// --- Bulk Company / Bank Debts Import Endpoint ---
app.post("/api/requests/import-company-debts", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin" && user.role !== "auditor") {
    return res.status(403).json({ error: "الأدمن والمراجع فقط لديهم صلاحية تحديث المديونيات" });
  }

  const { rows } = req.body;
  if (!rows || !Array.isArray(rows)) {
    return res.status(400).json({ error: "بيانات شيت المديونيات غير صحيحة" });
  }

  let updatedCount = 0;
  let nonZeroDebtCount = 0;
  let zeroDebtCount = 0;
  let totalDebtAmount = 0;
  const notFoundList: string[] = [];
  const updatedMembersList: any[] = [];

  rows.forEach((row: any) => {
    const mNumRaw = String(row.membershipNumber || "").trim();
    if (!mNumRaw) return;

    const cleanMNum = mNumRaw.replace(/^0+/, '');
    const cleanNatId = String(row.nationalId || '').trim();

    // Match in db.requests by exact membership number, unpadded membership number, or nationalId
    const matchingRequests = db.requests.filter((r) => {
      const dbMNum = String(r.membershipNumber || '').trim();
      const cleanDbMNum = dbMNum.replace(/^0+/, '');
      if (dbMNum === mNumRaw || (cleanDbMNum && cleanMNum && cleanDbMNum === cleanMNum)) return true;
      if (cleanNatId && r.nationalId && String(r.nationalId).trim() === cleanNatId) return true;
      return false;
    });

    if (matchingRequests.length > 0) {
      const newDebt = parseSmartNumber(row.debtABKCompanies);
      if (newDebt > 0) {
        nonZeroDebtCount++;
        totalDebtAmount += newDebt;
      } else {
        zeroDebtCount++;
      }

      const todayStr = new Date().toISOString().split("T")[0];

      matchingRequests.forEach((request) => {
        const prevDebt = request.debtABKCompanies || 0;
        request.debtABKCompanies = newDebt;

        // Update optional fields if present in Excel
        if (row.loanUnderName && String(row.loanUnderName).trim() && row.loanUnderName !== 'لا يوجد') {
          request.loanUnderName = String(row.loanUnderName).trim();
        }
        if (row.nationalId && String(row.nationalId).trim()) {
          request.nationalId = String(row.nationalId).trim();
        }
        if (row.paymentMethod && String(row.paymentMethod).trim()) {
          request.paymentMethod = String(row.paymentMethod).trim();
        }

        // Automatically set statusDate to the date debts were uploaded/imported onto the system
        request.statusDate = todayStr;
        const sDate = new Date(todayStr);
        if (!isNaN(sDate.getFullYear()) && (request.status === 'Cancelled' || request.status === 'Deletion' || request.status === 'Revoked')) {
          request.refundYear = sDate.getFullYear();
        }

        // Recalculate fields based on updated debt using the current active db.formulas
        const recalculated = calculateRequestFields(request, db.formulas);
        Object.assign(request, recalculated);

        updatedCount++;
        updatedMembersList.push({
          id: request.id,
          membershipNumber: request.membershipNumber,
          memberName: request.memberName,
          paymentMethod: request.paymentMethod,
          previousDebt: prevDebt,
          newDebt: newDebt,
          statusDate: request.statusDate,
          refundAmount: request.refundAmount,
          refundToClient: request.refundToClient
        });
      });
    } else {
      notFoundList.push(mNumRaw);
    }
  });

  await saveDb();
  logAudit(
    user.username,
    user.name,
    user.role,
    "تحديث مديونيات الشركات والبنك",
    `تم تحديث مديونية البنوك/الشركات لعدد ${updatedCount} طلب (بإجمالي مديونيات ${totalDebtAmount.toLocaleString()} ج.م، منها ${nonZeroDebtCount} مديونية برصيد فعلي) عبر رفع شيت Excel`
  );

  res.json({
    success: true,
    updatedCount,
    nonZeroDebtCount,
    zeroDebtCount,
    totalDebtAmount,
    notFoundCount: notFoundList.length,
    notFoundList,
    updatedMembersList,
    requests: db.requests
  });
});

// Update single request statusDate (Admin only)
app.post("/api/requests/:id/status-date", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "الأدمن فقط لديه صلاحية تعديل تاريخ الحالة" });
  }

  const rawId = req.params.id;
  const reqIndex = findRequestIndexById(rawId);
  if (reqIndex === -1) {
    return res.status(404).json({ error: "الطلب غير موجود في قاعدة البيانات" });
  }

  const { statusDate } = req.body;
  const request = db.requests[reqIndex];
  const prevDate = request.statusDate || "غير محدد";
  request.statusDate = statusDate ? String(statusDate).trim() : "";

  if (request.statusDate) {
    const sDate = new Date(request.statusDate);
    if (!isNaN(sDate.getFullYear()) && (request.status === 'Cancelled' || request.status === 'Deletion' || request.status === 'Revoked')) {
      request.refundYear = sDate.getFullYear();
    }
  }

  await saveDb();
  logAudit(
    user.username,
    user.name,
    user.role,
    "تعديل تاريخ الحالة يدويًا",
    `قام الأدمن بتعديل تاريخ الحالة للعضوية رقم ${request.membershipNumber} من (${prevDate}) إلى (${request.statusDate || 'فارغ'})`,
    request.id
  );

  res.json({ success: true, request, requests: db.requests });
});

// --- Excel Bulk Import Endpoints ---
app.post("/api/requests/import", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "الأدمن فقط يمكنه استيراد البيانات" });
  }

  const { rows } = req.body; // Array of request objects parsed in front-end
  if (!rows || !Array.isArray(rows)) {
    return res.status(400).json({ error: "تنسيق البيانات غير صحيح" });
  }

  let importedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  rows.forEach((row: any) => {
    // Basic validations
    if (!row.membershipNumber || !row.memberName) {
      skippedCount++;
      return;
    }

    const existingWithSameNum = db.requests.filter((r) => String(r.membershipNumber).trim() === String(row.membershipNumber).trim());
    const existingActive = existingWithSameNum.find((r) => r.status !== "Rejected" && r.result !== "Rejected");

    if (existingActive) {
      // Update existing record if import contains updated flags/comments
      if (row.firstManagerComments) {
        existingActive.firstManagerComments = row.firstManagerComments;
      }
      if (row.adminNote) {
        existingActive.adminNote = row.adminNote;
      }
      if (row.cancellationReasonDetail && row.cancellationReasonDetail !== "بدون أسباب تفصيلية") {
        existingActive.cancellationReasonDetail = row.cancellationReasonDetail;
      }
      if (row.receiptReceived !== undefined) {
        existingActive.receiptReceived = row.receiptReceived;
        if (row.receiptReceived) {
          existingActive.receiptReceivedDate = row.receiptReceivedDate || existingActive.receiptReceivedDate || new Date().toISOString().split('T')[0];
        }
      }
      if (row.reviewed !== undefined) {
        existingActive.reviewed = row.reviewed;
      }
      if (row.approvalSentToFirstManager !== undefined) {
        existingActive.approvalSentToFirstManager = row.approvalSentToFirstManager;
      }
      if (row.firstManagerApproved !== undefined) {
        existingActive.firstManagerApproved = row.firstManagerApproved;
      }
      if (row.result && row.result !== "Pending") {
        existingActive.result = row.result;
      }
      if (row.status && row.status !== "Pending") {
        existingActive.status = row.status;
      }

      const recalculated = calculateRequestFields(existingActive, db.formulas);
      Object.assign(existingActive, recalculated);
      updatedCount++;
      return;
    }

    const isReReview = existingWithSameNum.length > 0;
    let mName = row.memberName || "";
    if (isReReview && !mName.includes("إعادة عرض")) {
      mName = `${mName.trim()} (إعادة عرض)`;
    }

    const maxId = db.requests.reduce((max, r) => r.id > max ? r.id : max, 0);
    const newId = maxId + 1;

    const processed = calculateRequestFields({
      ...row,
      id: newId,
      memberName: mName,
      isReReview: isReReview ? true : row.isReReview,
      result: row.result || "Pending",
      status: row.status || "Pending",
      firstManagerApproved: row.firstManagerApproved,
      receiptReceived: row.receiptReceived === undefined ? false : row.receiptReceived,
      receiptReceivedDate: row.receiptReceived ? (row.receiptReceivedDate || new Date().toISOString().split('T')[0]) : null,
      reviewed: row.reviewed === undefined ? false : row.reviewed,
      approvalSentToFirstManager: row.approvalSentToFirstManager === undefined ? false : row.approvalSentToFirstManager,
      subscriptionDate: row.subscriptionDate || "2026-01-01",
      requestDate: row.requestDate || "2026-06-01",
    });

    db.requests.push(processed);
    importedCount++;
  });

  await saveDb();
  logAudit(user.username, user.name, user.role, "استيراد بيانات مجمع", `تم استيراد ${importedCount} طلب جديد وتحديث ${updatedCount} طلب، وتخطي ${skippedCount} سجلات`);
  res.json({ success: true, importedCount: importedCount + updatedCount, skippedCount, requests: db.requests });
});

// --- Full Database Backup / Restore API ---
app.get("/api/backup", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "صلاحية الأدمن مطلوبة لتصدير نسخة احتياطية" });
  }

  logAudit(user.username, user.name, user.role, "نسخ احتياطي للمركز المالي", `تم عمل وتصدير نسخة احتياطية كاملة لقاعدة بيانات المنظومة`);
  res.json(db);
});

app.post("/api/backup/restore", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "صلاحية الأدمن مطلوبة لاستعادة نسخة احتياطية" });
  }

  const restoredDb = req.body;
  if (!restoredDb || !restoredDb.users || !restoredDb.dropdowns || !restoredDb.requests) {
    return res.status(400).json({ error: "ملف النسخ الاحتياطي غير صالح أو ناقص البيانات الهيكلية" });
  }

  db = { ...restoredDb };
  await saveDb();

  logAudit(user.username, user.name, user.role, "استرجاع قاعدة البيانات", `تم استرجاع وتطبيق نسخة احتياطية خارجية لقاعدة بيانات النظام بالكامل بنجاح`);
  res.json({ success: true, message: "تم استعادة قاعدة البيانات بالكامل بنجاح" });
});

// --- Audit logs fetch ---
app.get("/api/logs/audit", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "الأدمن فقط له حق الاطلاع على سجل الحركات" });
  }
  res.json(db.auditLogs);
});

// --- Global Error Handler ---
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Express API Error:", err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({
    error: err?.message || "حدث خطأ غير متوقع في معالجة الطلب على الخادم",
    details: process.env.NODE_ENV === "development" ? String(err) : undefined
  });
});

// Vite Middleware for client loading in dev mode
async function startServer() {
  console.log("startServer invoked. NODE_ENV:", process.env.NODE_ENV);
  try {
    // Trigger DB load asynchronously so server listens immediately without blocking on DB timeouts
    ensureDbLoaded().catch((err) => {
      console.warn("Notice: ensureDbLoaded initial background load:", err?.message || err);
    });

    if (process.env.NODE_ENV !== "production") {
      console.log("Initializing Vite dev server middleware...");
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      app.use("*", async (req, res, next) => {
        const url = req.originalUrl;
        try {
          const indexPath = path.resolve(process.cwd(), "index.html");
          if (fs.existsSync(indexPath)) {
            let template = fs.readFileSync(indexPath, "utf-8");
            template = await vite.transformIndexHtml(url, template);
            res.status(200).set({ "Content-Type": "text/html" }).end(template);
          } else {
            next();
          }
        } catch (e) {
          vite.ssrFixStacktrace(e as Error);
          next(e);
        }
      });
      console.log("Vite middleware mounted successfully.");
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Wadi Degla Cancellation Server running on http://localhost:${PORT}`);
    });

    server.on("error", (err: any) => {
      console.error("HTTP server error on port " + PORT + ":", err);
    });
  } catch (err) {
    console.error("Fatal error starting server:", err);
  }
}

// Only start the HTTP listener if not running in a Serverless environment like Vercel
if (!process.env.VERCEL) {
  startServer().catch((e) => console.error("Unhandled rejection in startServer:", e));
}

export { app };
export default app;
