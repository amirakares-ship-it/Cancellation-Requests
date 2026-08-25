var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  app: () => app,
  default: () => server_default,
  ensureDbLoaded: () => ensureDbLoaded
});
module.exports = __toCommonJS(server_exports);
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_crypto = __toESM(require("crypto"), 1);

// src/db/index.ts
var import_node_postgres = require("drizzle-orm/node-postgres");
var import_pg = require("pg");

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  appData: () => appData,
  users: () => users
});
var import_pg_core = require("drizzle-orm/pg-core");
var appData = (0, import_pg_core.pgTable)("app_data", {
  key: (0, import_pg_core.text)("key").primaryKey(),
  data: (0, import_pg_core.jsonb)("data").notNull(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
});
var users = (0, import_pg_core.pgTable)("users", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  uid: (0, import_pg_core.text)("uid").notNull().unique(),
  username: (0, import_pg_core.text)("username").notNull(),
  name: (0, import_pg_core.text)("name").notNull(),
  role: (0, import_pg_core.text)("role").notNull(),
  club: (0, import_pg_core.text)("club"),
  email: (0, import_pg_core.text)("email"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
});

// src/db/index.ts
var createPool = () => {
  if (global._postgresPool) {
    return global._postgresPool;
  }
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.SQL_URL;
  if (connectionString) {
    try {
      const isLocalhost = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
      global._postgresPool = new import_pg.Pool({
        connectionString,
        ssl: isLocalhost ? false : { rejectUnauthorized: false },
        max: process.env.VERCEL ? 2 : 10,
        idleTimeoutMillis: 3e4,
        connectionTimeoutMillis: 1e4
      });
    } catch (poolErr) {
      console.error("Failed to initialize pg.Pool with connectionString:", poolErr);
      return null;
    }
  } else if (process.env.SQL_HOST || process.env.POSTGRES_HOST) {
    try {
      const host = process.env.SQL_HOST || process.env.POSTGRES_HOST;
      const isLocalhost = host === "localhost" || host === "127.0.0.1";
      const useSsl = process.env.SQL_SSL === "true" || process.env.POSTGRES_SSL === "true" || !isLocalhost && !process.env.SQL_HOST;
      global._postgresPool = new import_pg.Pool({
        host,
        user: process.env.SQL_USER || process.env.POSTGRES_USER,
        password: process.env.SQL_PASSWORD || process.env.POSTGRES_PASSWORD,
        database: process.env.SQL_DB_NAME || process.env.POSTGRES_DATABASE,
        port: Number(process.env.SQL_PORT || process.env.POSTGRES_PORT || 5432),
        ssl: useSsl ? { rejectUnauthorized: false } : false,
        max: process.env.VERCEL ? 2 : 10,
        idleTimeoutMillis: 3e4,
        connectionTimeoutMillis: 1e4
      });
    } catch (poolErr) {
      console.error("Failed to initialize pg.Pool with host config:", poolErr);
      return null;
    }
  }
  if (global._postgresPool) {
    global._postgresPool.on("error", (err) => {
      console.warn("PostgreSQL idle client error (handled):", err?.message || err);
    });
  }
  return global._postgresPool || null;
};
async function ensureTablesExist(p) {
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS app_data (
        key text PRIMARY KEY,
        data jsonb NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );
      CREATE TABLE IF NOT EXISTS users (
        id serial PRIMARY KEY,
        uid text NOT NULL UNIQUE,
        username text NOT NULL,
        name text NOT NULL,
        role text NOT NULL,
        club text,
        email text,
        created_at timestamp DEFAULT now() NOT NULL
      );
    `);
  } catch (err) {
    console.warn("ensureTablesExist notice:", err?.message || err);
  }
}
var pool = createPool();
var sqlDb = pool ? (0, import_node_postgres.drizzle)(pool, { schema: schema_exports }) : null;

// server.ts
var import_drizzle_orm = require("drizzle-orm");
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json({ limit: "50mb" }));
app.use(import_express.default.urlencoded({ limit: "50mb", extended: true }));
var DB_PATH = import_path.default.join(process.cwd(), "db_store.json");
function hashPassword(password) {
  return import_crypto.default.createHash("sha256").update(password).digest("hex");
}
var DEFAULT_HASH = hashPassword("123");
var DEFAULT_DB = {
  users: [
    {
      id: "admin",
      username: "admin",
      name: "\u0623\u062F\u0645\u0646 \u0627\u0644\u0646\u0638\u0627\u0645 (\u0627\u0644\u0645\u0631\u0643\u0632 \u0627\u0644\u0631\u0626\u064A\u0633\u064A)",
      role: "admin",
      firstLogin: false,
      passwordChanged: true,
      password: hashPassword("admin123")
      // Secure default for admin so they don't get locked, but resets work
    },
    {
      id: "sheraton_club",
      username: "sheraton_club",
      name: "\u0645\u0633\u0624\u0648\u0644 \u0646\u0627\u062F\u064A \u0627\u0644\u0634\u064A\u0631\u0627\u062A\u0648\u0646",
      role: "club",
      club: "Sheraton",
      firstLogin: true,
      passwordChanged: false,
      password: DEFAULT_HASH
    },
    {
      id: "maadi_club",
      username: "maadi_club",
      name: "\u0645\u0633\u0624\u0648\u0644 \u0646\u0627\u062F\u064A \u0627\u0644\u0645\u0639\u0627\u062F\u064A",
      role: "club",
      club: "Maadi",
      firstLogin: true,
      passwordChanged: false,
      password: DEFAULT_HASH
    },
    {
      id: "international_maadi",
      username: "international_maadi",
      name: "\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0639\u0636\u0648\u064A\u0627\u062A \u0627\u0644\u062F\u0648\u0644\u064A\u0629 (\u0646\u0627\u062F\u064A \u0627\u0644\u0645\u0639\u0627\u062F\u064A)",
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
      password: DEFAULT_HASH
    },
    {
      id: "sector_mgr",
      username: "sector_mgr",
      name: "\u0631\u0626\u064A\u0633 \u0642\u0637\u0627\u0639 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0627\u0644\u064A\u0629",
      role: "sector_manager",
      firstLogin: true,
      passwordChanged: false,
      password: DEFAULT_HASH,
      signatureUrl: ""
      // transparent signature PNG
    }
  ],
  dropdowns: {
    clubs: [
      "Lotus",
      "Alex",
      "Tanta",
      "Sheraton",
      "Nakheel",
      "Mansoura",
      "Oct I",
      "Damietta",
      "Maadi",
      "Assiut",
      "Oct II",
      "Elminya"
    ],
    membershipTypes: ["Smart", "Regular", "International"],
    paymentMethods: [
      "Premium",
      "Aman",
      "\u0646\u0642\u062F\u0627",
      "\u0634\u064A\u0643\u0627\u062A",
      "Ollin",
      "Contact",
      "ABK",
      "\u0639\u0636\u0648\u064A\u0629 \u062F\u0648\u0644\u064A\u0629",
      "One Finance"
    ],
    cancellationReasons: [
      "\u0627\u0633\u0628\u0627\u0628 \u0634\u062E\u0635\u064A\u0629",
      "\u0645\u0634\u0643\u0644\u0629 \u0645\u0639 \u0627\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A",
      "\u062A\u0639\u062B\u0631 \u0645\u0627\u062F\u0649",
      "\u0628\u062F\u0648\u0646 \u0627\u0633\u0628\u0627\u0628",
      "\u0645\u0634\u0643\u0644\u0629 \u0645\u0639 \u0634\u0631\u0643\u0629 \u0627\u0644\u062A\u0645\u0648\u064A\u0644",
      "\u0645\u0634\u0643\u0644\u0629 \u0645\u0639 \u0627\u0644\u0646\u0634\u0627\u0637 \u0627\u0644\u0631\u064A\u0627\u0636\u0649",
      "\u062A\u0623\u062E\u0631 \u0627\u0641\u062A\u062A\u0627\u062D \u0646\u0627\u062F\u0649 \u0637\u0646\u0637\u0627",
      "\u0645\u0634\u0643\u0644\u0629 \u0645\u0639 \u062E\u062F\u0645\u0629 \u0627\u0644\u0639\u0645\u0644\u0627\u0621",
      "\u0645\u0634\u0643\u0644\u0629 \u0645\u0639 \u0646\u0638\u0627\u0645 \u0627\u0644\u0646\u0627\u062F\u0649",
      "\u0634\u0643\u0627\u0648\u0649 \u0627\u0644\u0627\u0639\u0636\u0627\u0621 \u0639\u0644\u0649 \u0645\u0648\u0627\u0642\u0639 \u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639\u0649",
      "\u062A\u0623\u062E\u0631 \u0627\u0641\u062A\u062A\u0627\u062D \u0646\u0627\u062F\u0649 \u0627\u0644\u0634\u0631\u0648\u0642",
      "Other"
    ],
    committeeResults: ["Accepted", "Rejected", "Pending"],
    cancellationStatuses: ["Pending", "Cancelled", "Revoked", "Deletion", "Rejected"],
    exceptions: ["\u0644\u0627 \u064A\u0648\u062C\u062F", "\u062D\u0627\u0644\u0629 \u0627\u0646\u0633\u0627\u0646\u064A\u0629", "\u062C\u0647\u0629 \u0633\u064A\u0627\u062F\u064A\u0629", "\u062D\u0644 \u0645\u0634\u0643\u0644\u0629", "\u0628\u062F\u0648\u0646 \u0631\u062F \u0627\u0649 \u0645\u0628\u0644\u063A"],
    currencies: ["\u062C\u0645", "\u0631\u064A\u0627\u0644 \u0633\u0639\u0648\u062F\u0649", "\u062F\u0648\u0644\u0627\u0631"]
  },
  dropdownLabels: {
    clubs: "\u0646\u0627\u062F\u064A \u0627\u0644\u0641\u0631\u0639",
    membershipTypes: "\u0646\u0648\u0639 \u0627\u0644\u0639\u0636\u0648\u064A\u0629",
    paymentMethods: "\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u062F\u0641\u0639",
    cancellationReasons: "\u0633\u0628\u0628 \u0627\u0644\u0625\u0644\u063A\u0627\u0621",
    committeeResults: "\u0642\u0631\u0627\u0631 \u0627\u0644\u0644\u062C\u0646\u0629",
    cancellationStatuses: "\u062D\u0627\u0644\u0629 \u0627\u0644\u0625\u0644\u063A\u0627\u0621",
    exceptions: "\u0627\u0644\u0627\u0633\u062A\u062B\u0646\u0627\u0621\u0627\u062A",
    currencies: "\u0627\u0644\u0639\u0645\u0644\u0629 (Currency)"
  },
  labelNames: {
    membershipNumber: "\u0631\u0642\u0645 \u0627\u0644\u0639\u0636\u0648\u064A\u0629",
    memberName: "\u0627\u0633\u0645 \u0627\u0644\u0639\u0636\u0648",
    loanUnderName: "\u0627\u0644\u0642\u0631\u0636 \u0628\u0627\u0633\u0645",
    nationalId: "\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0642\u0648\u0645\u064A",
    externalId: "\u0631\u0642\u0645 \u0627\u0644\u0639\u0645\u064A\u0644",
    subscriptionDate: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643",
    requestDate: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0637\u0644\u0628",
    membershipType: "\u0646\u0648\u0639 \u0627\u0644\u0639\u0636\u0648\u064A\u0629",
    club: "\u0627\u0644\u0646\u0627\u062F\u064A",
    paymentMethod: "\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u062F\u0641\u0639",
    accountNumber: "\u0631\u0642\u0645 \u0627\u0644\u062D\u0633\u0627\u0628",
    documents: "\u0627\u0644\u0645\u0633\u062A\u0646\u062F\u0627\u062A",
    cancellationReason: "\u0633\u0628\u0628 \u0637\u0644\u0628 \u0627\u0644\u0627\u0644\u063A\u0627\u0621",
    cancellationReasonDetail: "\u0627\u0644\u0633\u0628\u0628 \u0628\u0627\u0644\u062A\u0641\u0635\u064A\u0644",
    salesPerson: "\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A",
    clubNote: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u0641\u0631\u0639",
    adminNote: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u0627\u062F\u0645\u0646",
    currency: "\u0627\u0644\u0639\u0645\u0644\u0629",
    subscriptionValue: "\u0625\u062C\u0645\u0627\u0644\u064A \u0642\u064A\u0645\u0629 \u0627\u0644\u0639\u0636\u0648\u064A\u0629",
    transferValue: "\u0642\u064A\u0645\u0629 \u0627\u0644\u062A\u062D\u0648\u064A\u0644\u0629",
    cashAmount: "\u0627\u0644\u0645\u0628\u0644\u063A \u0646\u0642\u062F\u0627\u064B",
    visaAmount: "\u0627\u0644\u0645\u0628\u0644\u063A \u0641\u064A\u0632\u0627",
    advancePaid: "\u0642\u064A\u0645\u0629 \u0627\u0644\u0645\u0642\u062F\u0645",
    checksPaid: "\u0634\u064A\u0643\u0627\u062A \u0645\u0633\u062F\u062F\u0629",
    checksUnpaid: "\u0634\u064A\u0643\u0627\u062A \u063A\u064A\u0631 \u0645\u0633\u062F\u062F\u0629",
    annualRenewalDue: "\u0627\u0644\u062A\u062C\u062F\u064A\u062F \u0627\u0644\u0633\u0646\u0648\u064A \u0627\u0644\u0645\u0633\u062A\u062D\u0642",
    adminFees: "\u0645\u0635\u0627\u0631\u064A\u0641 \u0625\u062F\u0627\u0631\u064A\u0629",
    usageFee: "\u0645\u0642\u0627\u0628\u0644 \u0627\u0644\u0627\u0646\u062A\u0641\u0627\u0639",
    visaFees2Percent: "\u0645\u0635\u0627\u0631\u064A\u0641 \u0641\u064A\u0632\u0627 2%",
    discountAmount: "\u0645\u0628\u0644\u063A \u0627\u0644\u062E\u0635\u0645",
    debtABKCompanies: "\u0645\u062F\u064A\u0648\u0646\u064A\u0629 \u0627\u0644\u0628\u0646\u0643 / \u0627\u0644\u0634\u0631\u0643\u0627\u062A",
    refundAmount: "\u0645\u0628\u0644\u063A \u0627\u0644\u0627\u0633\u062A\u0631\u062F\u0627\u062F",
    mobileNumber: "\u0631\u0642\u0645 \u0627\u0644\u0645\u0648\u0628\u0627\u064A\u0644"
  },
  requests: [
    {
      id: 1,
      membershipNumber: "WD-10045",
      memberName: "\u0623\u062D\u0645\u062F \u0639\u0628\u062F \u0627\u0644\u0631\u062D\u0645\u0646 \u0627\u0644\u0633\u0639\u064A\u062F",
      nationalId: "29512180102456",
      externalId: "EXT-80231",
      subscriptionDate: "2026-01-15",
      requestDate: "2026-03-30",
      days: 74,
      type: "\u0627\u0642\u0644 \u0645\u0646 3 \u0634\u0647\u0648\u0631",
      type2: "Less 3 months",
      membershipType: "Regular",
      club: "Sheraton",
      paymentMethod: "\u0646\u0642\u062F\u0627",
      documents: "\u0627\u0644\u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u0634\u062E\u0635\u064A\u0629 + \u0637\u0644\u0628 \u0627\u0644\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0648\u0631\u0642\u064A",
      cancellationReason: "\u062A\u0639\u062B\u0631 \u0645\u0627\u062F\u0649",
      cancellationReasonDetail: "\u0627\u0644\u0639\u0645\u064A\u0644 \u064A\u0648\u0627\u062C\u0647 \u0638\u0631\u0648\u0641\u0627\u064B \u0645\u0627\u0644\u064A\u0629 \u0635\u0639\u0628\u0629 \u062A\u0645\u0646\u0639\u0647 \u0645\u0646 \u0627\u0633\u062A\u0643\u0645\u0627\u0644 \u0627\u0644\u0623\u0642\u0633\u0627\u0637",
      committeeNo: "5",
      committeeYear: "2026",
      subscriptionValue: 65e3,
      transferValue: 0,
      cashAmount: 65e3,
      visaAmount: 0,
      advancePaid: 65e3,
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
      salesPerson: "\u0645\u062D\u0645\u062F \u0623\u062D\u0645\u062F - \u0645\u0628\u064A\u0639\u0627\u062A \u0634\u064A\u0631\u0627\u062A\u0648\u0646",
      clubNote: "\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0623\u0635\u0644 \u0627\u0644\u0625\u064A\u0635\u0627\u0644\u0627\u062A \u0648\u0627\u0644\u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u0634\u062E\u0635\u064A\u0629",
      adminNote: "\u0637\u0644\u0628 \u0645\u0633\u062A\u0648\u0641\u064A \u0627\u0644\u0634\u0631\u0648\u0637 \u0648\u0645\u0637\u0627\u0628\u0642",
      requestYear: 2026
    },
    {
      id: 2,
      membershipNumber: "WD-30089",
      memberName: "\u0645\u0646\u0649 \u0645\u062D\u0645\u0648\u062F \u0639\u0628\u062F \u0627\u0644\u0642\u0627\u062F\u0631",
      loanUnderName: "\u0634\u0631\u0643\u0629 \u0623\u0645\u0627\u0646 \u0644\u0644\u062A\u0645\u0648\u064A\u0644 \u0627\u0644\u0627\u0633\u062A\u0647\u0644\u0627\u0643\u064A",
      nationalId: "29004151203489",
      externalId: "EXT-44569",
      subscriptionDate: "2025-06-10",
      requestDate: "2026-06-25",
      days: 380,
      type: "2 \u0633\u0646\u0629",
      type2: "Over 3 months",
      membershipType: "Smart",
      club: "Maadi",
      paymentMethod: "Aman",
      documents: "\u0625\u0641\u0627\u062F\u0629 \u0633\u062F\u0627\u062F \u0634\u0631\u0643\u0629 \u0627\u0644\u062A\u0645\u0648\u064A\u0644 + \u0627\u0644\u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u0634\u062E\u0635\u064A\u0629",
      cancellationReason: "\u0645\u0634\u0643\u0644\u0629 \u0645\u0639 \u0634\u0631\u0643\u0629 \u0627\u0644\u062A\u0645\u0648\u064A\u0644",
      cancellationReasonDetail: "\u0627\u0631\u062A\u0641\u0627\u0639 \u0646\u0633\u0628\u0629 \u0627\u0644\u0641\u0627\u0626\u062F\u0629 \u0644\u0634\u0631\u0643\u0629 \u0627\u0644\u062A\u0645\u0648\u064A\u0644 \u0627\u0644\u0627\u0633\u062A\u0647\u0644\u0627\u0643\u064A \u0628\u0634\u0643\u0644 \u0645\u0628\u0627\u0644\u063A \u0641\u064A\u0647",
      committeeNo: "5",
      committeeYear: "2026",
      subscriptionValue: 12e4,
      transferValue: 1e5,
      cashAmount: 1e4,
      visaAmount: 1e4,
      advancePaid: 2e4,
      checksPaid: 0,
      checksUnpaid: 0,
      annualRenewalDue: 2500,
      adminFees: 2500,
      usageFee: 3e4,
      // 30% of transferValue (100k) for Smart membership (2 Years count)
      visaFees2Percent: 200,
      // 2% of 10k visaAmount
      discountAmount: 32700,
      debtABKCompanies: 8e4,
      refundAmount: 8e4,
      // Aman company refund logic
      refundToClient: 0,
      // MAX(100k - 80k - 32.7k, 0) = 0
      abkDebtDifference: "Not Required",
      result: "Pending",
      status: "Pending",
      receiptReceived: false,
      salesPerson: "\u0633\u0627\u0631\u0629 \u062D\u0633\u0646 - \u0645\u0628\u064A\u0639\u0627\u062A \u0627\u0644\u0645\u0639\u0627\u062F\u064A",
      clubNote: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0648\u0635\u0648\u0644 \u0623\u0635\u0644 \u0627\u0644\u062A\u0646\u0627\u0632\u0644 \u0645\u0646 \u0627\u0644\u0639\u0645\u064A\u0644",
      requestYear: 2026
    },
    {
      id: 3,
      membershipNumber: "WD-99012",
      memberName: "\u0639\u0628\u062F \u0627\u0644\u0644\u0647 \u0628\u0646 \u0641\u0647\u062F \u0622\u0644 \u0633\u0639\u0648\u062F",
      nationalId: "1098765432",
      externalId: "EXT-99012",
      subscriptionDate: "2025-11-01",
      requestDate: "2026-04-10",
      days: 160,
      type: "1 \u0633\u0646\u0629",
      type2: "Over 3 months",
      membershipType: "International",
      club: "Maadi",
      paymentMethod: "\u0639\u0636\u0648\u064A\u0629 \u062F\u0648\u0644\u064A\u0629",
      currency: "\u0631\u064A\u0627\u0644 \u0633\u0639\u0648\u062F\u0649",
      documents: "\u0637\u0644\u0628 \u0625\u0644\u063A\u0627\u0621 \u0639\u0636\u0648\u064A\u0629 \u062F\u0648\u0644\u064A\u0629 + \u0635\u0648\u0631\u0629 \u062C\u0648\u0627\u0632 \u0627\u0644\u0633\u0641\u0631",
      cancellationReason: "\u0627\u0633\u0628\u0627\u0628 \u0634\u062E\u0635\u064A\u0629",
      cancellationReasonDetail: "\u0646\u0642\u0644 \u0627\u0644\u0625\u0642\u0627\u0645\u0629 \u0627\u0644\u062F\u0627\u0626\u0645\u0629 \u062E\u0627\u0631\u062C \u0645\u0635\u0631 \u0648\u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u0639\u0636\u0648\u064A\u0629 \u0627\u0644\u062F\u0648\u0644\u064A\u0629",
      committeeNo: "5",
      committeeYear: "2026",
      subscriptionValue: 45e3,
      transferValue: 0,
      cashAmount: 45e3,
      visaAmount: 0,
      advancePaid: 45e3,
      checksPaid: 0,
      checksUnpaid: 0,
      annualRenewalDue: 0,
      adminFees: 0,
      // Exempt for international
      usageFee: 0,
      // Exempt for international
      visaFees2Percent: 0,
      discountAmount: 0,
      debtABKCompanies: 0,
      refundAmount: 45e3,
      refundToClient: 45e3,
      abkDebtDifference: "Not Required",
      result: "Pending",
      status: "Pending",
      receiptReceived: true,
      receiptReceivedDate: "2026-04-12",
      salesPerson: "\u062E\u0627\u0644\u062F \u0645\u062D\u0645\u0648\u062F - \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0636\u0648\u064A\u0627\u062A \u0627\u0644\u062F\u0648\u0644\u064A\u0629",
      clubNote: "\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0623\u0635\u0644 \u0627\u0644\u0639\u0642\u062F \u0648\u062C\u0648\u0627\u0632 \u0627\u0644\u0633\u0641\u0631",
      requestYear: 2026
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
      name: "\u0623\u062F\u0645\u0646 \u0627\u0644\u0646\u0638\u0627\u0645 (\u0627\u0644\u0645\u0631\u0643\u0632 \u0627\u0644\u0631\u0626\u064A\u0633\u064A)",
      role: "admin",
      action: "System Initialization",
      details: "\u062A\u0645 \u062A\u0647\u064A\u0626\u0629 \u0648\u062A\u062F\u0634\u064A\u0646 \u0646\u0638\u0627\u0645 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0639\u0636\u0648\u064A\u0627\u062A \u0644\u0648\u0627\u062F\u064A \u062F\u062C\u0644\u0629 \u0628\u0646\u062C\u0627\u062D",
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
    oldDaysLabel: "\u0627\u0642\u0644 \u0645\u0646 3 \u0634\u0647\u0648\u0631",
    newDaysThreshold: 30,
    newDaysLabel: "\u0627\u0642\u0644 \u0645\u0646 \u0634\u0647\u0631",
    adminFeesStandard: 2500,
    visaFeePercentage: 0.02,
    usageFeeExemptTypes: ["\u0627\u0642\u0644 \u0645\u0646 3 \u0634\u0647\u0648\u0631", "\u0627\u0642\u0644 \u0645\u0646 \u0634\u0647\u0631", "International"],
    usageFeeExemptClubs: ["Tanta", "\u0637\u0646\u0637\u0627"],
    usageFeeExemptDocuments: ["\u062C\u0647\u0629 \u0633\u064A\u0627\u062F\u064A\u0629"],
    usageFeeExemptExceptions: true,
    cashRefundFormula: "subscriptionValue",
    checksRefundFormula: "all_checks",
    bankRefundFormula: "transferValue",
    companyRefundFormula: "net_subscription",
    regularUsagePercentages: [0.1, 0.2, 0.3, 0.4, 0.5],
    smartUsagePercentages: [0.15, 0.3, 0.45, 0.6, 0.75],
    usageFeeBase: "subscriptionValue",
    exceptionRules: [
      { id: "1", name: "\u0639\u0636\u0648\u064A\u0629 \u062F\u0648\u0644\u064A\u0629", exemptAdminFee: true, exemptUsageFee: true, exemptVisaFee: false },
      { id: "2", name: "\u0628\u062F\u0648\u0646 \u062E\u0635\u0645 \u0645\u0635\u0627\u0631\u064A\u0641 \u0627\u062F\u0627\u0631\u064A\u0629", exemptAdminFee: true, exemptUsageFee: false, exemptVisaFee: true },
      { id: "3", name: "\u062C\u0647\u0629 \u0633\u064A\u0627\u062F\u064A\u0629", exemptAdminFee: false, exemptUsageFee: true, exemptVisaFee: false }
    ],
    paymentMethodOptions: {
      cash: [
        {
          id: "cash_sub",
          value: "subscriptionValue",
          label: "\u0642\u064A\u0645\u0629 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 - \u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u062E\u0635\u0645 (\u0627\u0641\u062A\u0631\u0627\u0636\u064A)",
          description: "\u0642\u064A\u0645\u0629 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 - \u0625\u062C\u0645\u0627\u0644\u064A \u0645\u0628\u0644\u063A \u0627\u0644\u062E\u0635\u0645",
          expression: "subscriptionValue - discountAmount"
        },
        {
          id: "cash_trans",
          value: "transferValue",
          label: "\u0642\u064A\u0645\u0629 \u0627\u0644\u062A\u062D\u0648\u064A\u0644\u0629 - \u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u062E\u0635\u0645",
          description: "\u0642\u064A\u0645\u0629 \u0627\u0644\u062A\u062D\u0648\u064A\u0644\u0629 - \u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u062E\u0635\u0645",
          expression: "transferValue - discountAmount"
        },
        {
          id: "cash_coll",
          value: "collected",
          label: "\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0645\u062D\u0635\u0644 \u0641\u0639\u0644\u064A\u0627\u064B (\u0646\u0642\u062F\u064A + \u0641\u064A\u0632\u0627) - \u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u062E\u0635\u0645",
          description: "(\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0646\u0642\u062F\u064A + \u0645\u0628\u0644\u063A \u0627\u0644\u0641\u064A\u0632\u0627) - \u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u062E\u0635\u0645",
          expression: "(cashAmount + visaAmount) - discountAmount"
        }
      ],
      checks: [
        {
          id: "chk_all",
          value: "all_checks",
          label: "(\u0627\u0644\u0634\u064A\u0643\u0627\u062A \u0627\u0644\u0645\u0633\u062F\u062F\u0629 + \u0627\u0644\u0634\u064A\u0643\u0627\u062A \u0627\u0644\u063A\u064A\u0631 \u0645\u0633\u062F\u062F\u0629 + \u0627\u0644\u0645\u0642\u062F\u0645) - \u0627\u0644\u062E\u0635\u0645 (\u0645\u0639\u0627\u062F\u0644\u0629 \u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0634\u064A\u0643\u0627\u062A)",
          description: "(\u0627\u0644\u0634\u064A\u0643\u0627\u062A \u0627\u0644\u0645\u0633\u062F\u062F\u0629 + \u0627\u0644\u0634\u064A\u0643\u0627\u062A \u0627\u0644\u063A\u064A\u0631 \u0645\u0633\u062F\u062F\u0629 + \u0627\u0644\u0645\u0642\u062F\u0645) - \u0627\u0644\u062E\u0635\u0645",
          expression: "advancePaid + checksPaid + checksUnpaid - discountAmount"
        },
        {
          id: "chk_paid",
          value: "paid_only",
          label: "(\u0627\u0644\u0634\u064A\u0643\u0627\u062A \u0627\u0644\u0645\u0633\u062F\u062F\u0629 + \u0627\u0644\u0645\u0642\u062F\u0645) - \u0627\u0644\u062E\u0635\u0645 \u0641\u0642\u0637",
          description: "(\u0627\u0644\u0634\u064A\u0643\u0627\u062A \u0627\u0644\u0645\u0633\u062F\u062F\u0629 + \u0627\u0644\u0645\u0642\u062F\u0645) - \u0627\u0644\u062E\u0635\u0645",
          expression: "advancePaid + checksPaid - discountAmount"
        },
        {
          id: "chk_sub",
          value: "subscriptionValue",
          label: "\u0642\u064A\u0645\u0629 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 - \u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u062E\u0635\u0645",
          description: "\u0642\u064A\u0645\u0629 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 - \u0627\u0644\u062E\u0635\u0645",
          expression: "subscriptionValue - discountAmount"
        }
      ],
      banks: [
        {
          id: "bank_trans",
          value: "transferValue",
          label: "\u0642\u064A\u0645\u0629 \u0627\u0644\u062A\u062D\u0648\u064A\u0644\u0629 - \u0627\u0644\u062E\u0635\u0645 (\u0627\u0641\u062A\u0631\u0627\u0636\u064A)",
          description: "\u0642\u064A\u0645\u0629 \u0627\u0644\u062A\u062D\u0648\u064A\u0644\u0629 - \u0627\u0644\u062E\u0635\u0645 | (\u0641\u0631\u0642 ABK = \u0645\u062F\u064A\u0648\u0646\u064A\u0629 \u0627\u0644\u0628\u0646\u0643 - \u0645\u0628\u0644\u063A \u0627\u0644\u0627\u0633\u062A\u0631\u062F\u0627\u062F)",
          expression: "transferValue - discountAmount"
        },
        {
          id: "bank_sub",
          value: "subscriptionValue",
          label: "\u0642\u064A\u0645\u0629 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 - \u0627\u0644\u062E\u0635\u0645",
          description: "\u0642\u064A\u0645\u0629 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 - \u0627\u0644\u062E\u0635\u0645 | (\u0641\u0631\u0642 ABK = \u0645\u062F\u064A\u0648\u0646\u064A\u0629 \u0627\u0644\u0628\u0646\u0643 - \u0645\u0628\u0644\u063A \u0627\u0644\u0627\u0633\u062A\u0631\u062F\u0627\u062F)",
          expression: "subscriptionValue - discountAmount"
        },
        {
          id: "bank_coll",
          value: "collected",
          label: "\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0645\u062D\u0635\u0644 (\u062A\u062D\u0648\u064A\u0644\u0629 + \u0645\u0642\u062F\u0645) - \u0627\u0644\u062E\u0635\u0645",
          description: "(\u0642\u064A\u0645\u0629 \u0627\u0644\u062A\u062D\u0648\u064A\u0644\u0629 + \u0627\u0644\u0645\u0642\u062F\u0645) - \u0627\u0644\u062E\u0635\u0645",
          expression: "transferValue + advancePaid - discountAmount"
        }
      ],
      companies: [
        {
          id: "comp_net_sub",
          value: "net_subscription",
          label: "\u0631\u062F \u0644\u0644\u0639\u0645\u064A\u0644 = MAX(\u0642\u064A\u0645\u0629 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 - \u0627\u0644\u0645\u062F\u064A\u0648\u0646\u064A\u0629 - \u0627\u0644\u062E\u0635\u0645, 0) [\u0627\u0644\u0645\u0639\u0627\u062F\u0644\u0629 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629]",
          description: "\u0631\u062F \u0644\u0644\u0639\u0645\u064A\u0644 = MAX(\u0642\u064A\u0645\u0629 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 - \u0627\u0644\u0645\u062F\u064A\u0648\u0646\u064A\u0629 - \u0627\u0644\u062E\u0635\u0645, 0)",
          expression: "subscriptionValue - debtABKCompanies - discountAmount"
        },
        {
          id: "comp_net_trans",
          value: "net_transfer",
          label: "\u0631\u062F \u0644\u0644\u0639\u0645\u064A\u0644 = MAX(\u0642\u064A\u0645\u0629 \u0627\u0644\u062A\u062D\u0648\u064A\u0644\u0629 - \u0627\u0644\u0645\u062F\u064A\u0648\u0646\u064A\u0629 - \u0627\u0644\u062E\u0635\u0645, 0)",
          description: "\u0631\u062F \u0644\u0644\u0639\u0645\u064A\u0644 = MAX(\u0642\u064A\u0645\u0629 \u0627\u0644\u062A\u062D\u0648\u064A\u0644\u0629 - \u0627\u0644\u0645\u062F\u064A\u0648\u0646\u064A\u0629 - \u0627\u0644\u062E\u0635\u0645, 0)",
          expression: "transferValue - debtABKCompanies - discountAmount"
        },
        {
          id: "comp_debt_only",
          value: "debt_only",
          label: "\u0627\u0633\u062A\u0631\u062F\u0627\u062F \u0634\u0631\u0643\u0629 \u0627\u0644\u062A\u0645\u0648\u064A\u0644 = \u0645\u062F\u064A\u0648\u0646\u064A\u0629 \u0634\u0631\u0643\u0629 \u0627\u0644\u062A\u0645\u0648\u064A\u0644 \u0641\u0642\u0637",
          description: "\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0645\u0633\u062A\u0631\u062F = \u0645\u062F\u064A\u0648\u0646\u064A\u0629 \u0634\u0631\u0643\u0629 \u0627\u0644\u062A\u0645\u0648\u064A\u0644 (\u0625\u0646 \u0648\u062C\u062F\u062A)",
          expression: "debtABKCompanies"
        }
      ]
    },
    customPaymentMethods: []
  },
  customFields: []
};
var db = { ...DEFAULT_DB };
var isDbLoaded = false;
var dbLoadPromise = null;
async function loadDb() {
  try {
    let loadedFromSql = false;
    if (sqlDb && pool) {
      try {
        await ensureTablesExist(pool);
        const rows = await sqlDb.select().from(appData).where((0, import_drizzle_orm.eq)(appData.key, "main_store"));
        if (rows && rows.length > 0 && rows[0].data) {
          db = rows[0].data;
          loadedFromSql = true;
          console.log("Database successfully loaded from PostgreSQL.");
        }
      } catch (sqlErr) {
        console.warn("Could not query PostgreSQL on load, falling back to local store:", sqlErr);
      }
    }
    if (!loadedFromSql) {
      try {
        if (import_fs.default.existsSync(DB_PATH)) {
          const raw = import_fs.default.readFileSync(DB_PATH, "utf-8");
          db = JSON.parse(raw);
        } else {
          db = JSON.parse(JSON.stringify(DEFAULT_DB));
        }
      } catch {
        db = JSON.parse(JSON.stringify(DEFAULT_DB));
      }
    }
    if (!db || typeof db !== "object") {
      db = JSON.parse(JSON.stringify(DEFAULT_DB));
    }
    if (!db.users || !Array.isArray(db.users) || db.users.length === 0) {
      db.users = JSON.parse(JSON.stringify(DEFAULT_DB.users));
    }
    if (!db.dropdowns || typeof db.dropdowns !== "object") {
      db.dropdowns = JSON.parse(JSON.stringify(DEFAULT_DB.dropdowns));
    }
    if (!db.dropdownLabels || typeof db.dropdownLabels !== "object") {
      db.dropdownLabels = JSON.parse(JSON.stringify(DEFAULT_DB.dropdownLabels));
    }
    for (const key of Object.keys(DEFAULT_DB.dropdowns)) {
      if (!db.dropdowns[key]) {
        db.dropdowns[key] = DEFAULT_DB.dropdowns[key];
      } else if (Array.isArray(db.dropdowns[key])) {
        for (const item of DEFAULT_DB.dropdowns[key]) {
          if (!db.dropdowns[key].includes(item)) {
            db.dropdowns[key].push(item);
          }
        }
      }
    }
    for (const key of Object.keys(DEFAULT_DB.dropdownLabels)) {
      if (!db.dropdownLabels[key]) {
        db.dropdownLabels[key] = DEFAULT_DB.dropdownLabels[key];
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
      db.labelNames.mobileNumber = "\u0631\u0642\u0645 \u0627\u0644\u0645\u0648\u0628\u0627\u064A\u0644";
    }
    if (db.dropdowns && Array.isArray(db.dropdowns.exceptions)) {
      if (!db.dropdowns.exceptions.includes("\u0628\u062F\u0648\u0646 \u0631\u062F \u0627\u0649 \u0645\u0628\u0644\u063A") && !db.dropdowns.exceptions.includes("\u0628\u062F\u0648\u0646 \u0631\u062F \u0623\u064A \u0645\u0628\u0644\u063A")) {
        db.dropdowns.exceptions.push("\u0628\u062F\u0648\u0646 \u0631\u062F \u0627\u0649 \u0645\u0628\u0644\u063A");
      }
    }
    if (Array.isArray(db.users)) {
      db.users.forEach((u) => {
        if (u.username === "manager1" || u.role === "first_manager") {
          if (u.name === "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0645\u0627\u0644\u064A \u0627\u0644\u0623\u0648\u0644 (\u0645\u0631\u0627\u062C\u0639\u0629)" || u.name === "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0645\u0627\u0644\u064A \u0627\u0644\u0623\u0648\u0644") {
            u.name = "Manager";
          }
        }
      });
    }
    if (Array.isArray(db.requests)) {
      db.requests = db.requests.map((r) => calculateRequestFields(r, db.formulas));
    }
    saveDb();
  } catch (err) {
    console.error("Error reading database, using fallback state:", err);
  }
}
async function ensureDbLoaded() {
  if (isDbLoaded) return;
  if (!dbLoadPromise) {
    dbLoadPromise = (async () => {
      await loadDb();
      isDbLoaded = true;
    })();
  }
  await dbLoadPromise;
}
var syncTimeout = null;
function saveDb() {
  try {
    import_fs.default.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
  }
  if (sqlDb) {
    const doSync = async () => {
      try {
        await sqlDb.insert(appData).values({
          key: "main_store",
          data: db,
          updatedAt: /* @__PURE__ */ new Date()
        }).onConflictDoUpdate({
          target: appData.key,
          set: {
            data: db,
            updatedAt: /* @__PURE__ */ new Date()
          }
        });
      } catch (sqlSyncErr) {
        console.error("Error persisting to PostgreSQL:", sqlSyncErr);
      }
    };
    if (process.env.VERCEL) {
      doSync();
    } else {
      if (syncTimeout) clearTimeout(syncTimeout);
      syncTimeout = setTimeout(doSync, 150);
    }
  }
}
ensureDbLoaded();
function logAudit(username, name, role, action, details, requestId) {
  try {
    if (!db.auditLogs || !Array.isArray(db.auditLogs)) {
      db.auditLogs = [];
    }
    const newLog = {
      id: "log-" + Date.now() + "-" + Math.floor(Math.random() * 1e3),
      username,
      name,
      role,
      action,
      details,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      requestId
    };
    db.auditLogs.unshift(newLog);
    saveDb();
  } catch (err) {
    console.warn("Could not write audit log:", err);
  }
}
app.use(async (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    await ensureDbLoaded();
  }
  next();
});
app.get("/api/health", async (req, res) => {
  let dbStatus = "in-memory / file";
  let dbError = null;
  if (sqlDb && pool) {
    try {
      await pool.query("SELECT 1");
      dbStatus = "connected-postgres";
    } catch (e) {
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
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
function getAuthenticatedUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.replace("Bearer ", "");
  if (!token.startsWith("WD-TOKEN-")) {
    return null;
  }
  const username = token.replace("WD-TOKEN-", "");
  return db?.users?.find((u) => u.username === username) || null;
}
var requireAuth = (req, res, next) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0627\u0644\u062F\u062E\u0648\u0644 - \u064A\u0631\u062C\u0649 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u0648\u0644\u0627\u064B" });
  }
  req.user = user;
  next();
};
app.post("/api/auth/login", (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0645\u0637\u0644\u0648\u0628\u0627\u0646" });
    }
    if (!db || !Array.isArray(db.users)) {
      db = { ...DEFAULT_DB, ...db };
      if (!Array.isArray(db.users)) db.users = DEFAULT_DB.users;
    }
    const trimmedUser = String(username).trim().toLowerCase();
    const user = db.users.find((u) => u.username && u.username.toLowerCase() === trimmedUser);
    if (!user) {
      return res.status(401).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
    }
    const hashedInput = hashPassword(String(password));
    if (user.password !== hashedInput) {
      return res.status(401).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
    }
    const token = `WD-TOKEN-${user.username}`;
    logAudit(user.username, user.name, user.role, "\u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644", `\u0642\u0627\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 ${user.name} \u0628\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644`);
    const { password: _, ...userSafe } = user;
    res.json({ token, user: userSafe });
  } catch (err) {
    console.error("Login route error:", err);
    res.status(500).json({ error: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u0645\u0639\u0627\u0644\u062C\u0629 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644: " + (err?.message || err) });
  }
});
app.get("/api/auth/me", requireAuth, (req, res) => {
  const { password: _, ...userSafe } = req.user;
  res.json({ user: userSafe });
});
app.post("/api/auth/change-password", requireAuth, (req, res) => {
  const user = req.user;
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "\u064A\u062C\u0628 \u0625\u062F\u062E\u0627\u0644 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0648\u0627\u0644\u062C\u062F\u064A\u062F\u0629" });
  }
  const dbUser = db.users.find((u) => u.id === user.id);
  if (!dbUser) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  if (dbUser.password !== hashPassword(currentPassword)) {
    return res.status(400).json({ error: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
  }
  dbUser.password = hashPassword(newPassword);
  dbUser.firstLogin = false;
  dbUser.passwordChanged = true;
  saveDb();
  logAudit(dbUser.username, dbUser.name, dbUser.role, "\u062A\u063A\u064A\u064A\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631", `\u0642\u0627\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u062A\u063A\u064A\u064A\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062E\u0627\u0635\u0629 \u0628\u0647 \u0628\u0646\u062C\u0627\u062D`);
  res.json({ success: true, message: "\u062A\u0645 \u062A\u063A\u064A\u064A\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0628\u0646\u062C\u0627\u062D" });
});
app.post("/api/auth/reset-password", requireAuth, (req, res) => {
  const reqUser = req.user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D - \u0647\u0630\u0647 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629 \u0644\u0644\u0623\u062F\u0645\u0646 \u0641\u0642\u0637" });
  }
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "\u064A\u062C\u0628 \u062A\u062D\u062F\u064A\u062F \u0645\u0639\u0631\u0641 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0645\u0631\u0627\u062F \u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646\u0647" });
  }
  const dbUser = db.users.find((u) => u.id === userId);
  if (!dbUser) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  dbUser.password = DEFAULT_HASH;
  dbUser.firstLogin = true;
  dbUser.passwordChanged = false;
  saveDb();
  logAudit(reqUser.username, reqUser.name, reqUser.role, "\u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631", `\u062A\u0645 \u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 ${dbUser.name} \u0625\u0644\u0649 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629 123`);
  res.json({ success: true, message: `\u062A\u0645 \u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0625\u0644\u0649 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629 (123)` });
});
app.get("/api/users", requireAuth, (req, res) => {
  const reqUser = req.user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
  }
  const safeUsers = db.users.map(({ password, ...u }) => u);
  res.json(safeUsers);
});
app.post("/api/users", requireAuth, (req, res) => {
  const reqUser = req.user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
  }
  const { id, username, name, role, club, allowedPages } = req.body;
  if (!username || !name || !role) {
    return res.status(400).json({ error: "\u062C\u0645\u064A\u0639 \u0627\u0644\u062D\u0642\u0648\u0644 \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629 \u0645\u0637\u0644\u0648\u0628\u0629" });
  }
  const exists = db.users.some((u) => u.username.toLowerCase() === username.toLowerCase());
  if (exists) {
    return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0647\u0630\u0627 \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0641\u0639\u0644 \u0628\u0627\u0644\u0645\u0646\u0638\u0648\u0645\u0629" });
  }
  const newUser = {
    id: id || "usr-" + Date.now(),
    username,
    name,
    role,
    club: role === "club" || role === "international_user" ? club : void 0,
    allowedPages: Array.isArray(allowedPages) ? allowedPages : void 0,
    firstLogin: true,
    passwordChanged: false,
    password: DEFAULT_HASH
    // Assign default '123'
  };
  db.users.push(newUser);
  saveDb();
  logAudit(reqUser.username, reqUser.name, reqUser.role, "\u0625\u0646\u0634\u0627\u0621 \u062D\u0633\u0627\u0628 \u0645\u0633\u062A\u062E\u062F\u0645 \u062C\u062F\u064A\u062F", `\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u062D\u0633\u0627\u0628 \u0645\u0633\u062A\u062E\u062F\u0645 \u062C\u062F\u064A\u062F \u0628\u0627\u0633\u0645 ${name} \u0648\u062F\u0648\u0631 ${role}`);
  res.json({ success: true, user: { id: newUser.id, username, name, role, club, allowedPages: newUser.allowedPages } });
});
app.put("/api/users/:id", requireAuth, (req, res) => {
  const reqUser = req.user;
  if (reqUser.role !== "admin" && reqUser.id !== req.params.id) {
    return res.status(403).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
  }
  const { name, role, club, signatureUrl, allowedPages } = req.body;
  const dbUser = db.users.find((u) => u.id === req.params.id);
  if (!dbUser) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  if (name) dbUser.name = name;
  if (reqUser.role === "admin") {
    if (role) dbUser.role = role;
    if (club !== void 0) dbUser.club = club;
    if (allowedPages !== void 0) dbUser.allowedPages = Array.isArray(allowedPages) ? allowedPages : void 0;
  } else {
    if (club && (dbUser.role === "club" || dbUser.role === "international_user")) dbUser.club = club;
  }
  if (signatureUrl !== void 0 && dbUser.role === "sector_manager") {
    dbUser.signatureUrl = signatureUrl;
  }
  saveDb();
  logAudit(reqUser.username, reqUser.name, reqUser.role, "\u062A\u0639\u062F\u064A\u0644 \u062D\u0633\u0627\u0628 \u0645\u0633\u062A\u062E\u062F\u0645", `\u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062D\u0633\u0627\u0628 \u0644\u0640 ${dbUser.name}`);
  res.json({ success: true, user: { id: dbUser.id, username: dbUser.username, name: dbUser.name, role: dbUser.role, club: dbUser.club, signatureUrl: dbUser.signatureUrl, allowedPages: dbUser.allowedPages } });
});
app.delete("/api/users/:id", requireAuth, (req, res) => {
  const reqUser = req.user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
  }
  const index = db.users.findIndex((u) => u.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  const targetUser = db.users[index];
  if (targetUser.username === "admin") {
    return res.status(400).json({ error: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u062D\u0633\u0627\u0628 \u0627\u0644\u0623\u062F\u0645\u0646 \u0627\u0644\u0623\u0633\u0627\u0633\u064A" });
  }
  db.users.splice(index, 1);
  saveDb();
  logAudit(reqUser.username, reqUser.name, reqUser.role, "\u062D\u0630\u0641 \u062D\u0633\u0627\u0628 \u0645\u0633\u062A\u062E\u062F\u0645", `\u062A\u0645 \u062D\u0630\u0641 \u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 ${targetUser.name}`);
  res.json({ success: true });
});
app.get("/api/dropdowns", (req, res) => {
  res.json({
    dropdowns: db.dropdowns || DEFAULT_DB.dropdowns,
    dropdownLabels: db.dropdownLabels || DEFAULT_DB.dropdownLabels
  });
});
app.post("/api/dropdowns/categories/create", requireAuth, (req, res) => {
  const reqUser = req.user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "\u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0623\u062F\u0645\u0646 \u0645\u0637\u0644\u0648\u0628\u0629 \u0644\u0625\u0636\u0627\u0641\u0629 \u0642\u0627\u0626\u0645\u0629 \u0627\u062E\u062A\u064A\u0627\u0631 \u062C\u062F\u064A\u062F\u0629" });
  }
  const { categoryKey, categoryLabel, initialOption } = req.body;
  if (!categoryLabel || !categoryLabel.trim()) {
    return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0628\u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0645\u0637\u0644\u0648\u0628" });
  }
  let key = categoryKey && categoryKey.trim() ? categoryKey.trim().replace(/\s+/g, "_") : `custom_${Date.now()}`;
  if (!db.dropdowns) db.dropdowns = { ...DEFAULT_DB.dropdowns };
  if (!db.dropdownLabels) db.dropdownLabels = { ...DEFAULT_DB.dropdownLabels };
  if (db.dropdowns[key]) {
    return res.status(400).json({ error: "\u0647\u0630\u0647 \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0645\u0648\u062C\u0648\u062F\u0629 \u0628\u0627\u0644\u0641\u0639\u0644" });
  }
  db.dropdowns[key] = initialOption && initialOption.trim() ? [initialOption.trim()] : ["\u062E\u064A\u0627\u0631 1"];
  db.dropdownLabels[key] = categoryLabel.trim();
  saveDb();
  logAudit(reqUser.username, reqUser.name, reqUser.role, "\u0625\u0636\u0627\u0641\u0629 \u0642\u0627\u0626\u0645\u0629 \u062C\u062F\u064A\u062F\u0629", `\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0642\u0627\u0626\u0645\u0629 \u0627\u062E\u062A\u064A\u0627\u0631 \u062C\u062F\u064A\u062F\u0629: ${categoryLabel.trim()}`);
  res.json({
    success: true,
    dropdowns: db.dropdowns,
    dropdownLabels: db.dropdownLabels
  });
});
app.delete("/api/dropdowns/categories/:category", requireAuth, (req, res) => {
  const reqUser = req.user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "\u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0623\u062F\u0645\u0646 \u0645\u0637\u0644\u0648\u0628\u0629 \u0644\u062D\u0630\u0641 \u0642\u0627\u0626\u0645\u0629 \u0627\u062E\u062A\u064A\u0627\u0631" });
  }
  const { category } = req.params;
  const coreCategories = ["clubs", "membershipTypes", "paymentMethods", "cancellationReasons", "committeeResults", "cancellationStatuses", "exceptions"];
  if (coreCategories.includes(category)) {
    return res.status(400).json({ error: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0627\u0644\u0642\u0648\u0627\u0626\u0645 \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629 \u0644\u0644\u0646\u0638\u0627\u0645" });
  }
  if (db.dropdowns && db.dropdowns[category]) {
    delete db.dropdowns[category];
  }
  if (db.dropdownLabels && db.dropdownLabels[category]) {
    delete db.dropdownLabels[category];
  }
  saveDb();
  logAudit(reqUser.username, reqUser.name, reqUser.role, "\u062D\u0630\u0641 \u0642\u0627\u0626\u0645\u0629 \u0627\u062E\u062A\u064A\u0627\u0631", `\u062A\u0645 \u062D\u0630\u0641 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0627\u062E\u062A\u064A\u0627\u0631: ${category}`);
  res.json({
    success: true,
    dropdowns: db.dropdowns,
    dropdownLabels: db.dropdownLabels
  });
});
app.get("/api/label-names", (req, res) => {
  res.json(db.labelNames || DEFAULT_DB.labelNames);
});
app.post("/api/label-names", requireAuth, (req, res) => {
  const reqUser = req.user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "\u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0623\u062F\u0645\u0646 \u0645\u0637\u0644\u0648\u0628\u0629 \u0644\u062A\u0639\u062F\u064A\u0644 \u062A\u0633\u0645\u064A\u0627\u062A \u0627\u0644\u062D\u0642\u0648\u0644" });
  }
  db.labelNames = {
    ...db.labelNames || DEFAULT_DB.labelNames,
    ...req.body
  };
  saveDb();
  logAudit(reqUser.username, reqUser.name, reqUser.role, "\u062A\u0639\u062F\u064A\u0644 \u062A\u0633\u0645\u064A\u0627\u062A \u0627\u0644\u062D\u0642\u0648\u0644", "\u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0628\u0639\u0636 \u062A\u0633\u0645\u064A\u0627\u062A \u062D\u0642\u0648\u0644 \u0627\u0644\u0625\u062F\u062E\u0627\u0644 \u0648\u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631");
  res.json({ success: true, labelNames: db.labelNames });
});
app.get("/api/custom-fields", (req, res) => {
  res.json(db.customFields || []);
});
app.post("/api/custom-fields", requireAuth, (req, res) => {
  const reqUser = req.user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "\u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0623\u062F\u0645\u0646 \u0645\u0637\u0644\u0648\u0628\u0629 \u0644\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u062D\u0642\u0648\u0644 \u0627\u0644\u0645\u062E\u0635\u0635\u0629" });
  }
  if (Array.isArray(req.body)) {
    db.customFields = req.body;
  } else if (req.body && typeof req.body === "object") {
    const field = req.body;
    if (!field.id) {
      field.id = "cf_" + Date.now() + "_" + Math.floor(Math.random() * 1e3);
    }
    if (!db.customFields) db.customFields = [];
    const index = db.customFields.findIndex((f) => f.id === field.id);
    if (index >= 0) {
      db.customFields[index] = field;
    } else {
      db.customFields.push(field);
    }
  }
  saveDb();
  logAudit(reqUser.username, reqUser.name, reqUser.role, "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u062D\u0642\u0648\u0644 \u0627\u0644\u0645\u062E\u0635\u0635\u0629", "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0623\u0648 \u0625\u0636\u0627\u0641\u0629 \u062D\u0642\u0648\u0644 \u0645\u062E\u0635\u0635\u0629 \u0644\u0644\u0646\u0638\u0627\u0645");
  res.json({ success: true, customFields: db.customFields });
});
app.delete("/api/custom-fields/:id", requireAuth, (req, res) => {
  const reqUser = req.user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "\u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0623\u062F\u0645\u0646 \u0645\u0637\u0644\u0648\u0628\u0629 \u0644\u062D\u0630\u0641 \u0627\u0644\u062D\u0642\u0648\u0644 \u0627\u0644\u0645\u062E\u0635\u0635\u0629" });
  }
  const { id } = req.params;
  if (db.customFields) {
    db.customFields = db.customFields.filter((f) => f.id !== id);
  }
  saveDb();
  logAudit(reqUser.username, reqUser.name, reqUser.role, "\u062D\u0630\u0641 \u062D\u0642\u0644 \u0645\u062E\u0635\u0635", `\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u062D\u0642\u0644 \u0627\u0644\u0645\u062E\u0635\u0635: ${id}`);
  res.json({ success: true, customFields: db.customFields || [] });
});
app.post("/api/dropdowns/:category", requireAuth, (req, res) => {
  const reqUser = req.user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "\u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0623\u062F\u0645\u0646 \u0645\u0637\u0644\u0648\u0628\u0629 \u0644\u062A\u0639\u062F\u064A\u0644 \u0642\u0648\u0627\u0626\u0645 \u0627\u0644\u0627\u062E\u062A\u064A\u0627\u0631" });
  }
  const { category } = req.params;
  const { option } = req.body;
  if (!option || !option.trim()) {
    return res.status(400).json({ error: "\u062E\u064A\u0627\u0631 \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0644\u0627 \u064A\u0645\u0643\u0646 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0641\u0627\u0631\u063A\u0627\u064B" });
  }
  if (!db.dropdowns[category]) {
    db.dropdowns[category] = [];
  }
  const list = db.dropdowns[category];
  if (list.includes(option.trim())) {
    return res.status(400).json({ error: "\u0647\u0630\u0627 \u0627\u0644\u062E\u064A\u0627\u0631 \u0645\u062A\u0648\u0627\u062C\u062F \u0628\u0627\u0644\u0641\u0639\u0644 \u0641\u064A \u0647\u0630\u0647 \u0627\u0644\u0642\u0627\u0626\u0645\u0629" });
  }
  list.push(option.trim());
  saveDb();
  logAudit(reqUser.username, reqUser.name, reqUser.role, "\u0625\u0636\u0627\u0641\u0629 \u062E\u064A\u0627\u0631 \u0644\u0642\u0627\u0626\u0645\u0629", `\u062A\u0645 \u0625\u0636\u0627\u0641\u0629 "${option.trim()}" \u0625\u0644\u0649 \u0642\u0627\u0626\u0645\u0629 ${category}`);
  res.json({ success: true, dropdowns: db.dropdowns, dropdownLabels: db.dropdownLabels });
});
app.put("/api/dropdowns/:category/rename", requireAuth, (req, res) => {
  const reqUser = req.user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
  }
  const { category } = req.params;
  const { oldOption, newOption } = req.body;
  if (!oldOption || !newOption || !newOption.trim()) {
    return res.status(400).json({ error: "\u0627\u0644\u062E\u064A\u0627\u0631 \u0627\u0644\u062C\u062F\u064A\u062F \u0648\u0627\u0644\u0642\u062F\u064A\u0645 \u0645\u0637\u0644\u0648\u0628\u0627\u0646" });
  }
  const list = db.dropdowns[category];
  if (!list) {
    return res.status(404).json({ error: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
  }
  const index = list.indexOf(oldOption);
  if (index === -1) {
    return res.status(404).json({ error: "\u0627\u0644\u062E\u064A\u0627\u0631 \u0627\u0644\u0642\u062F\u064A\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0628\u0627\u0644\u0642\u0627\u0626\u0645\u0629" });
  }
  list[index] = newOption.trim();
  saveDb();
  logAudit(reqUser.username, reqUser.name, reqUser.role, "\u062A\u0639\u062F\u064A\u0644 \u062E\u064A\u0627\u0631 \u0644\u0642\u0627\u0626\u0645\u0629", `\u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0627\u0633\u0645 \u0645\u0646 "${oldOption}" \u0625\u0644\u0649 "${newOption.trim()}" \u0641\u064A \u0642\u0627\u0626\u0645\u0629 ${category}`);
  res.json({ success: true, dropdowns: db.dropdowns });
});
app.delete("/api/dropdowns/:category", requireAuth, (req, res) => {
  const reqUser = req.user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "\u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0623\u062F\u0645\u0646 \u0645\u0637\u0644\u0648\u0628\u0629 \u0644\u062D\u0630\u0641 \u062E\u064A\u0627\u0631\u0627\u062A \u0642\u0648\u0627\u0626\u0645 \u0627\u0644\u0627\u062E\u062A\u064A\u0627\u0631" });
  }
  const { category } = req.params;
  const { option } = req.query;
  if (!option) {
    return res.status(400).json({ error: "\u064A\u062C\u0628 \u062A\u062D\u062F\u064A\u062F \u0627\u0644\u062E\u064A\u0627\u0631 \u0627\u0644\u0645\u0631\u0627\u062F \u062D\u0630\u0641\u0647" });
  }
  const list = db.dropdowns[category];
  if (!list) {
    return res.status(404).json({ error: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
  }
  const index = list.indexOf(option);
  if (index === -1) {
    return res.status(404).json({ error: "\u0627\u0644\u062E\u064A\u0627\u0631 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u063A\u064A\u0631 \u0645\u062A\u0648\u0627\u062C\u062F" });
  }
  list.splice(index, 1);
  saveDb();
  logAudit(reqUser.username, reqUser.name, reqUser.role, "\u062D\u0630\u0641 \u062E\u064A\u0627\u0631 \u0645\u0646 \u0642\u0627\u0626\u0645\u0629", `\u062A\u0645 \u062D\u0630\u0641 "${option}" \u0645\u0646 \u0642\u0627\u0626\u0645\u0629 ${category}`);
  res.json({ success: true, dropdowns: db.dropdowns });
});
app.get("/api/committees", (req, res) => {
  res.json(db.committees);
});
app.post("/api/committees", requireAuth, (req, res) => {
  const reqUser = req.user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "\u0627\u0644\u0623\u062F\u0645\u0646 \u0641\u0642\u0637 \u0644\u062F\u064A\u0647 \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u062A\u062D\u0643\u0645 \u0628\u0627\u0644\u0644\u062C\u0627\u0646" });
  }
  const { number, year, approvalDate } = req.body;
  if (!number) {
    return res.status(400).json({ error: "\u0631\u0642\u0645 \u0627\u0644\u0644\u062C\u0646\u0629 \u0645\u0637\u0644\u0648\u0628" });
  }
  const commYear = year && String(year).trim() ? String(year).trim() : (/* @__PURE__ */ new Date()).getFullYear().toString();
  db.committees.forEach((c) => {
    c.status = "closed";
  });
  const newComm = {
    id: `comm-${number}-${commYear}-${Date.now()}`,
    number: String(number).trim(),
    year: commYear,
    status: "open",
    approvalDate: approvalDate || ""
  };
  db.committees.push(newComm);
  saveDb();
  logAudit(reqUser.username, reqUser.name, reqUser.role, "\u0625\u0646\u0634\u0627\u0621 \u0644\u062C\u0646\u0629 \u062C\u062F\u064A\u062F\u0629", `\u062A\u0645 \u0641\u062A\u062D \u0644\u062C\u0646\u0629 \u062C\u062F\u064A\u062F\u0629 \u0628\u0631\u0642\u0645 ${number}`);
  res.json({ success: true, committee: newComm, committees: db.committees });
});
app.put("/api/committees/:id", requireAuth, (req, res) => {
  const reqUser = req.user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "\u0627\u0644\u0623\u062F\u0645\u0646 \u0641\u0642\u0637 \u0644\u062F\u064A\u0647 \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u062A\u062D\u0643\u0645 \u0628\u0627\u0644\u0644\u062C\u0627\u0646" });
  }
  const { status, approvalDate } = req.body;
  const comm = db.committees.find((c) => c.id === req.params.id);
  if (!comm) {
    return res.status(404).json({ error: "\u0627\u0644\u0644\u062C\u0646\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  }
  if (status) comm.status = status;
  if (approvalDate || status === "closed") {
    if (approvalDate) comm.approvalDate = approvalDate;
    db.requests.forEach((r) => {
      if (r.committeeNo === comm.number && (!comm.year || r.committeeYear === comm.year)) {
        if (approvalDate) r.approvalDate = approvalDate;
        if (r.result !== "Rejected" && r.status !== "Rejected" && r.firstManagerApproved !== false) {
          r.result = "Accepted";
        }
      }
    });
  }
  saveDb();
  logAudit(reqUser.username, reqUser.name, reqUser.role, "\u062A\u0639\u062F\u064A\u0644 \u062D\u0627\u0644\u0629 \u0627\u0644\u0644\u062C\u0646\u0629", `\u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0644\u062C\u0646\u0629 ${comm.number}-${comm.year}: \u0627\u0644\u062D\u0627\u0644\u0629=${comm.status}`);
  res.json({ success: true, committees: db.committees, requests: db.requests });
});
app.get("/api/formulas", requireAuth, (req, res) => {
  res.json(db.formulas || DEFAULT_DB.formulas);
});
app.put("/api/formulas", requireAuth, (req, res) => {
  const reqUser = req.user;
  if (reqUser.role !== "admin") {
    return res.status(403).json({ error: "\u0627\u0644\u0623\u062F\u0645\u0646 \u0641\u0642\u0637 \u0644\u062F\u064A\u0647 \u0635\u0644\u0627\u062D\u064A\u0629 \u062A\u0639\u062F\u064A\u0644 \u0645\u0639\u0627\u062F\u0644\u0627\u062A \u0627\u0644\u0646\u0638\u0627\u0645" });
  }
  const { formulas, recalculateScope } = req.body;
  if (!formulas) {
    return res.status(400).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0639\u0627\u062F\u0644\u0627\u062A \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629" });
  }
  db.formulas = { ...db.formulas, ...formulas };
  let updatedCount = 0;
  const cutoff = new Date(db.formulas.cutoffDate || "2026-07-01");
  if (recalculateScope && recalculateScope !== "none") {
    db.requests = db.requests.map((r) => {
      const subDate = new Date(r.subscriptionDate);
      const isAfterCutoff = !isNaN(subDate.getTime()) && subDate.getTime() >= cutoff.getTime();
      let shouldRecalc = false;
      if (recalculateScope === "all") {
        shouldRecalc = true;
      } else if (recalculateScope === "old" && !isAfterCutoff) {
        shouldRecalc = true;
      } else if (recalculateScope === "new" && isAfterCutoff) {
        shouldRecalc = true;
      }
      if (shouldRecalc) {
        updatedCount++;
        return calculateRequestFields(r, db.formulas);
      }
      return r;
    });
  }
  saveDb();
  logAudit(
    reqUser.username,
    reqUser.name,
    reqUser.role,
    "\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0642\u0648\u0627\u0639\u062F \u0648\u0627\u0644\u0645\u0639\u0627\u062F\u0644\u0627\u062A \u0627\u0644\u062D\u0633\u0627\u0628\u064A\u0629",
    `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0645\u0639\u0627\u062F\u0644\u0627\u062A \u0627\u0644\u0645\u0646\u0638\u0648\u0645\u0629 \u0648\u0646\u0637\u0627\u0642 \u0627\u0644\u062A\u0637\u0628\u064A\u0642: ${recalculateScope || "\u0627\u0644\u0645\u0633\u062A\u0642\u0628\u0644 \u0641\u0642\u0637"} (\u062A\u0645 \u0625\u0639\u0627\u062F\u0629 \u0627\u062D\u062A\u0633\u0627\u0628 ${updatedCount} \u0637\u0644\u0628)`
  );
  res.json({
    success: true,
    formulas: db.formulas,
    requests: db.requests,
    updatedCount
  });
});
function evaluateCustomFormula(expression, vars) {
  if (!expression || typeof expression !== "string") return 0;
  try {
    let safeExpr = expression;
    const sortedKeys = Object.keys(vars).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      const val = parseFloat(vars[key]) || 0;
      const regex = new RegExp(`\\b${key}\\b`, "g");
      safeExpr = safeExpr.replace(regex, `(${val})`);
    }
    const sanitized = safeExpr.replace(/[^0-9\.\+\-\*\/\%\(\)\s]/g, "");
    if (!sanitized.trim()) return 0;
    const func = new Function(`return (${sanitized});`);
    const result = func();
    return isNaN(result) || !isFinite(result) ? 0 : Math.round(result * 100) / 100;
  } catch (err) {
    return 0;
  }
}
function parseAnyDate(val) {
  if (val === null || val === void 0 || val === "") return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === "number") {
    if (val > 1e4 && val < 1e5) {
      return new Date(Math.round((val - 25569) * 86400 * 1e3));
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  const str = String(val).trim();
  if (!str) return null;
  if (/^\d{5,6}$/.test(str)) {
    const num = parseFloat(str);
    if (num > 1e4 && num < 1e5) {
      return new Date(Math.round((num - 25569) * 86400 * 1e3));
    }
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const parts = str.split("T")[0].split("-");
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return new Date(y, m, d);
  }
  const MONTH_NAME_MAP = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
    "\u064A\u0646\u0627\u064A\u0631": 0,
    "\u0641\u0628\u0631\u0627\u064A\u0631": 1,
    "\u0645\u0627\u0631\u0633": 2,
    "\u0623\u0628\u0631\u064A\u0644": 3,
    "\u0627\u0628\u0631\u064A\u0644": 3,
    "\u0645\u0627\u064A\u0648": 4,
    "\u064A\u0648\u0646\u064A\u0648": 5,
    "\u064A\u0648\u0644\u064A\u0648": 6,
    "\u0623\u063A\u0633\u0637\u0633": 7,
    "\u0627\u063A\u0633\u0637\u0633": 7,
    "\u0633\u0628\u062A\u0645\u0628\u0631": 8,
    "\u0623\u0643\u062A\u0648\u0628\u0631": 9,
    "\u0627\u0643\u062A\u0648\u0628\u0631": 9,
    "\u0646\u0648\u0641\u0645\u0628\u0631": 10,
    "\u062F\u064A\u0633\u0645\u0628\u0631": 11
  };
  const tokens = str.split(/[\/\-\.\s,]+/);
  if (tokens.length >= 3) {
    const t0 = tokens[0].toLowerCase();
    const t1 = tokens[1].toLowerCase();
    const t2 = tokens[2].toLowerCase();
    if (MONTH_NAME_MAP[t1] !== void 0) {
      const day = parseInt(t0, 10);
      const month = MONTH_NAME_MAP[t1];
      let year = parseInt(t2, 10);
      if (year < 100) year += 2e3;
      if (!isNaN(day) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
    if (MONTH_NAME_MAP[t1] !== void 0 && parseInt(t0, 10) > 1e3) {
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
      if (n0 > 1e3) {
        return new Date(n0, n1 - 1, n2);
      } else if (n2 > 1e3) {
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
function formatDateCustom(val) {
  const d = parseAnyDate(val);
  if (!d) return val ? String(val) : "";
  const ENGLISH_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = d.getDate();
  const monthStr = ENGLISH_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${monthStr}-${year}`;
}
function parseSmartNumber(val) {
  if (val === null || val === void 0 || val === "") return 0;
  if (typeof val === "number") {
    return isNaN(val) || !isFinite(val) ? 0 : val;
  }
  let s = String(val).trim();
  if (!s) return 0;
  const arabicDigits = ["\u0660", "\u0661", "\u0662", "\u0663", "\u0664", "\u0665", "\u0666", "\u0667", "\u0668", "\u0669"];
  for (let i = 0; i < arabicDigits.length; i++) {
    s = s.split(arabicDigits[i]).join(String(i));
  }
  const isNegative = /^\s*\(.*\)\s*$/.test(s) || /^\s*-/.test(s);
  s = s.replace(/ج\.?م|جم|جنيه|EGP|LE|L\.E\.|\$|ريال|USD/gi, "");
  s = s.replace(/٫/g, ".").replace(/،/g, ",");
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/,/g, "");
  } else if (s.includes(",")) {
    const parts = s.split(",");
    if (parts.length > 1 && parts[parts.length - 1].length === 3) {
      s = parts.join("");
    } else if (parts.length === 2 && parts[1].length <= 2) {
      s = parts.join(".");
    } else {
      s = parts.join("");
    }
  }
  s = s.replace(/[^0-9\.]/g, "");
  if (!s) return 0;
  const num = parseFloat(s);
  if (isNaN(num) || !isFinite(num)) return 0;
  return isNegative ? -Math.abs(num) : num;
}
function calculateRequestFields(reqData, customFormulas) {
  const formulas = customFormulas || db.formulas || DEFAULT_DB.formulas;
  const subDate = parseAnyDate(reqData.subscriptionDate);
  const reqDate = parseAnyDate(reqData.requestDate);
  const formattedSubDate = subDate ? formatDateCustom(subDate) : reqData.subscriptionDate || "";
  const formattedReqDate = reqDate ? formatDateCustom(reqDate) : reqData.requestDate || "";
  const cashAmount = parseSmartNumber(reqData.cashAmount);
  const visaAmount = parseSmartNumber(reqData.visaAmount);
  const transferValue = parseSmartNumber(reqData.transferValue);
  const checksPaid = parseSmartNumber(reqData.checksPaid);
  const checksUnpaid = parseSmartNumber(reqData.checksUnpaid);
  const annualRenewalDue = parseSmartNumber(reqData.annualRenewalDue);
  const debtABKCompanies = parseSmartNumber(reqData.debtABKCompanies);
  const rawAdv = parseSmartNumber(reqData.advancePaid);
  const advancePaid = cashAmount + visaAmount > 0 ? cashAmount + visaAmount : rawAdv;
  const rawSubVal = parseSmartNumber(reqData.subscriptionValue);
  const sumComponents = transferValue + cashAmount + visaAmount + checksPaid + checksUnpaid;
  const subscriptionValue = sumComponents > 0 ? sumComponents : rawSubVal;
  let days = 0;
  if (subDate && reqDate) {
    const diffTime = reqDate.getTime() - subDate.getTime();
    days = Math.max(0, Math.ceil(diffTime / (1e3 * 60 * 60 * 24)));
  }
  let type = "";
  let type2 = "Less 3 months";
  const cutoff = parseAnyDate(formulas.cutoffDate) || /* @__PURE__ */ new Date("2026-07-01");
  const isAfterCutoff = subDate && subDate.getTime() >= cutoff.getTime();
  if (isAfterCutoff) {
    if (days <= (formulas.newDaysThreshold ?? 30)) {
      type = formulas.newDaysLabel || "\u0627\u0642\u0644 \u0645\u0646 \u0634\u0647\u0631";
      type2 = "Less 1 month";
    } else {
      const yearsCount = Math.ceil(days / 365);
      type = `${yearsCount} \u0633\u0646\u0629`;
      type2 = "Over 1 month";
    }
  } else {
    if (days <= (formulas.oldDaysThreshold ?? 90)) {
      type = formulas.oldDaysLabel || "\u0627\u0642\u0644 \u0645\u0646 3 \u0634\u0647\u0648\u0631";
      type2 = "Less 3 months";
    } else {
      const yearsCount = Math.ceil(days / 365);
      type = `${yearsCount} \u0633\u0646\u0629`;
      type2 = "Over 3 months";
    }
  }
  const nonCompanyMethods = ["\u0646\u0642\u062F\u0627", "\u0646\u0642\u062F\u0627\u064B", "\u0634\u064A\u0643\u0627\u062A", "\u0641\u064A\u0632\u0627", "ABK", "\u0639\u0636\u0648\u064A\u0629 \u062F\u0648\u0644\u064A\u0629", "\u0627\u0644\u0645\u0634\u0631\u0642", "QNB", "\u062A\u062D\u0648\u064A\u0644 \u0628\u0646\u0643\u064A"];
  const isCompany = reqData.paymentMethod && !nonCompanyMethods.includes(reqData.paymentMethod.trim());
  const stdAdminFee = formulas.adminFeesStandard ?? 2500;
  const rules = formulas.exceptionRules || [
    { id: "1", name: "\u0639\u0636\u0648\u064A\u0629 \u062F\u0648\u0644\u064A\u0629", exemptAdminFee: true, exemptUsageFee: true, exemptVisaFee: false },
    { id: "2", name: "\u0628\u062F\u0648\u0646 \u062E\u0635\u0645 \u0645\u0635\u0627\u0631\u064A\u0641 \u0627\u062F\u0627\u0631\u064A\u0629", exemptAdminFee: true, exemptUsageFee: false, exemptVisaFee: true },
    { id: "3", name: "\u062C\u0647\u0629 \u0633\u064A\u0627\u062F\u064A\u0629", exemptAdminFee: false, exemptUsageFee: true, exemptVisaFee: false }
  ];
  const fullExceptionText = ((reqData.exceptionType || "") + " " + (reqData.exceptions || "") + " " + (reqData.clubNote || "") + " " + (reqData.adminNote || "") + " " + (reqData.documents || "")).toLowerCase();
  const isNoRefundException = Boolean(
    fullExceptionText.includes("\u0628\u062F\u0648\u0646 \u0631\u062F \u0627\u0649 \u0645\u0628\u0644\u063A") || fullExceptionText.includes("\u0628\u062F\u0648\u0646 \u0631\u062F \u0623\u064A \u0645\u0628\u0644\u063A") || fullExceptionText.includes("\u0628\u062F\u0648\u0646 \u0631\u062F \u0627\u0649 \u0645\u0628\u0627\u0644\u063A") || fullExceptionText.includes("\u0628\u062F\u0648\u0646 \u0631\u062F \u0623\u064A \u0645\u0628\u0627\u0644\u063A") || fullExceptionText.includes("\u0628\u062F\u0648\u0646 \u0631\u062F \u0645\u0628\u0644\u063A") || fullExceptionText.includes("\u0628\u062F\u0648\u0646 \u0631\u062F") || reqData.exceptionType && (reqData.exceptionType.includes("\u0628\u062F\u0648\u0646 \u0631\u062F") || reqData.exceptionType.includes("\u0628\u062F\u0648\u0646 \u0631\u062F \u0627\u0649 \u0645\u0628\u0644\u063A") || reqData.exceptionType.includes("\u0628\u062F\u0648\u0646 \u0631\u062F \u0623\u064A \u0645\u0628\u0644\u063A")) || reqData.exceptions && (reqData.exceptions.includes("\u0628\u062F\u0648\u0646 \u0631\u062F") || reqData.exceptions.includes("\u0628\u062F\u0648\u0646 \u0631\u062F \u0627\u0649 \u0645\u0628\u0644\u063A") || reqData.exceptions.includes("\u0628\u062F\u0648\u0646 \u0631\u062F \u0623\u064A \u0645\u0628\u0644\u063A"))
  );
  const isAdminExemptByRule = rules.some((r) => r.exemptAdminFee && r.name && fullExceptionText.includes(r.name.toLowerCase()));
  const isVisaExemptByRule = rules.some((r) => r.exemptVisaFee && r.name && fullExceptionText.includes(r.name.toLowerCase()));
  const isUsageExemptByRule = rules.some((r) => r.exemptUsageFee && r.name && fullExceptionText.includes(r.name.toLowerCase()));
  const companyNetBase = formulas.companyRefundFormula === "net_transfer" && transferValue > 0 ? transferValue : subscriptionValue > 0 ? subscriptionValue : transferValue > 0 ? transferValue : sumComponents;
  const net_amount = isCompany ? Math.max(0, companyNetBase - debtABKCompanies) : 0;
  let calculatedAdminFees = stdAdminFee;
  if (reqData.membershipType === "International" || isAdminExemptByRule || fullExceptionText.includes("\u0639\u0636\u0648\u064A\u0629 \u062F\u0648\u0644\u064A\u0629") || fullExceptionText.includes("\u0628\u062F\u0648\u0646 \u062E\u0635\u0645 \u0645\u0635\u0627\u0631\u064A\u0641 \u0627\u062F\u0627\u0631\u064A\u0629")) {
    calculatedAdminFees = 0;
  } else if (isCompany) {
    calculatedAdminFees = Math.max(0, Math.min(net_amount, stdAdminFee));
  }
  const adminFees = reqData.adminFeesOverride !== void 0 && reqData.adminFeesOverride !== null && reqData.adminFeesOverride !== "" ? parseFloat(reqData.adminFeesOverride) : calculatedAdminFees;
  const visaFeePct = formulas.visaFeePercentage ?? 0.02;
  const calculatedVisaFee = visaAmount * visaFeePct;
  let visaFees2Percent = calculatedVisaFee;
  if (reqData.visaFeeOverride !== void 0 && reqData.visaFeeOverride !== null && reqData.visaFeeOverride !== "") {
    visaFees2Percent = parseFloat(reqData.visaFeeOverride);
  } else if (isVisaExemptByRule || fullExceptionText.includes("\u0628\u062F\u0648\u0646 \u062E\u0635\u0645 \u0645\u0635\u0627\u0631\u064A\u0641 \u0627\u062F\u0627\u0631\u064A\u0629")) {
    visaFees2Percent = 0;
  } else if (isCompany) {
    if (adminFees < 2500 || net_amount < 2500) {
      visaFees2Percent = 0;
    } else {
      const remAfterAdmin = net_amount - adminFees;
      visaFees2Percent = Math.max(0, Math.min(remAfterAdmin, calculatedVisaFee));
    }
  }
  let calculatedUsageFee = 0;
  const exemptTypes = formulas.usageFeeExemptTypes || ["\u0627\u0642\u0644 \u0645\u0646 3 \u0634\u0647\u0648\u0631", "\u0627\u0642\u0644 \u0645\u0646 \u0634\u0647\u0631", "International"];
  const exemptClubs = formulas.usageFeeExemptClubs || ["Tanta", "\u0637\u0646\u0637\u0627"];
  const exemptDocs = formulas.usageFeeExemptDocuments || ["\u062C\u0647\u0629 \u0633\u064A\u0627\u062F\u064A\u0629"];
  const allowExceptionNotesExempt = formulas.usageFeeExemptExceptions !== false;
  const isTypeExempt = exemptTypes.includes(type) || exemptTypes.includes("International") && reqData.membershipType === "International";
  const isClubExempt = exemptClubs.some((c) => {
    if (!c) return false;
    const cLower = c.toLowerCase().trim();
    const reqClub = (reqData.club || "").toLowerCase().trim();
    if (!reqClub) return false;
    if (cLower === reqClub) return true;
    if ((cLower.includes("tanta") || cLower.includes("\u0637\u0646\u0637\u0627")) && (reqClub.includes("tanta") || reqClub.includes("\u0637\u0646\u0637\u0627"))) return true;
    return false;
  });
  const isDocExempt = exemptDocs.some((d) => d && ((reqData.documents || "").includes(d) || (reqData.exceptions || "").includes(d)));
  const usageExemptionKeywords = ["\u0625\u0639\u0641\u0627\u0621 \u0645\u0646 \u0645\u0642\u0627\u0628\u0644 \u0627\u0644\u0627\u0646\u062A\u0641\u0627\u0639", "\u0627\u0639\u0641\u0627\u0621 \u0645\u0646 \u0645\u0642\u0627\u0628\u0644 \u0627\u0644\u0627\u0646\u062A\u0641\u0627\u0639", "\u0645\u0639\u0641\u0649 \u0645\u0646 \u0645\u0642\u0627\u0628\u0644 \u0627\u0644\u0627\u0646\u062A\u0641\u0627\u0639", "\u0645\u0639\u0641\u064A \u0645\u0646 \u0645\u0642\u0627\u0628\u0644 \u0627\u0644\u0627\u0646\u062A\u0641\u0627\u0639", "\u0625\u0639\u0641\u0627\u0621 \u0645\u0646 \u0627\u0644\u0627\u0646\u062A\u0641\u0627\u0639", "\u0627\u0639\u0641\u0627\u0621 \u0645\u0646 \u0627\u0644\u0627\u0646\u062A\u0641\u0627\u0639"];
  const isExceptionExempt = allowExceptionNotesExempt && (reqData.usageFeeOverride !== void 0 && parseFloat(reqData.usageFeeOverride) === 0 || isUsageExemptByRule || fullExceptionText.includes("\u0639\u0636\u0648\u064A\u0629 \u062F\u0648\u0644\u064A\u0629") || fullExceptionText.includes("\u062C\u0647\u0629 \u0633\u064A\u0627\u062F\u064A\u0629") || usageExemptionKeywords.some((kw) => fullExceptionText.includes(kw)));
  if (isTypeExempt || isClubExempt || isDocExempt || isExceptionExempt) {
    calculatedUsageFee = 0;
  } else {
    const yearsCount = Math.ceil(days / 365);
    let percentage = 0;
    const regP = formulas.regularUsagePercentages || [0.1, 0.2, 0.3, 0.4, 0.5];
    const smartP = formulas.smartUsagePercentages || [0.15, 0.3, 0.45, 0.6, 0.75];
    if (reqData.membershipType === "Regular") {
      percentage = regP[Math.min(yearsCount - 1, regP.length - 1)] || 0;
    } else if (reqData.membershipType === "Smart") {
      percentage = smartP[Math.min(yearsCount - 1, smartP.length - 1)] || 0;
    }
    const baseVal = formulas.usageFeeBase === "subscriptionValue" ? subscriptionValue : transferValue;
    const stdUsageFee = baseVal * percentage;
    if (isCompany) {
      const remainder = net_amount - (adminFees + visaFees2Percent);
      if (net_amount <= adminFees + visaFees2Percent || remainder <= 0) {
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
  const usageFee = reqData.usageFeeOverride !== void 0 && reqData.usageFeeOverride !== null && reqData.usageFeeOverride !== "" ? parseFloat(reqData.usageFeeOverride) : calculatedUsageFee;
  const discountAmount = adminFees + usageFee + visaFees2Percent;
  let refundAmount = 0;
  const rawRefundInput = reqData.refundAmount !== void 0 && reqData.refundAmount !== null && reqData.refundAmount !== "" ? typeof reqData.refundAmount === "number" ? reqData.refundAmount : parseFloat(reqData.refundAmount) : void 0;
  const methodOptions = formulas.paymentMethodOptions || DEFAULT_DB.formulas.paymentMethodOptions;
  const customMethods = formulas.customPaymentMethods || [];
  const cashFormula = formulas.cashRefundFormula || "subscriptionValue";
  const checksFormula = formulas.checksRefundFormula || "all_checks";
  const bankFormula = formulas.bankRefundFormula || "transferValue";
  const companyFormula = formulas.companyRefundFormula || "net_subscription";
  const calcVars = {
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
  const matchedCustomMethod = customMethods.find((m) => m.methodName && m.methodName.trim().toLowerCase() === (reqData.paymentMethod || "").trim().toLowerCase());
  if (matchedCustomMethod) {
    const selectedOpt = (matchedCustomMethod.options || []).find((o) => o.value === matchedCustomMethod.selectedFormula || o.id === matchedCustomMethod.selectedFormula);
    if (selectedOpt && selectedOpt.expression) {
      refundAmount = Math.max(0, evaluateCustomFormula(selectedOpt.expression, calcVars));
    } else {
      refundAmount = Math.max(0, subscriptionValue - discountAmount);
    }
  } else if (reqData.paymentMethod === "\u0646\u0642\u062F\u0627" || reqData.paymentMethod === "\u0646\u0642\u062F\u0627\u064B") {
    const cashOpts = methodOptions?.cash || [];
    const selectedOpt = cashOpts.find((o) => o.value === cashFormula || o.id === cashFormula);
    if (selectedOpt && selectedOpt.expression && !["subscriptionValue", "transferValue", "collected"].includes(selectedOpt.value)) {
      refundAmount = Math.max(0, evaluateCustomFormula(selectedOpt.expression, calcVars));
    } else {
      let base = subscriptionValue;
      if (cashFormula === "transferValue") base = transferValue;
      else if (cashFormula === "collected") base = cashAmount + visaAmount;
      refundAmount = Math.max(0, base - discountAmount);
    }
  } else if (reqData.paymentMethod === "\u0634\u064A\u0643\u0627\u062A") {
    const checkOpts = methodOptions?.checks || [];
    const selectedOpt = checkOpts.find((o) => o.value === checksFormula || o.id === checksFormula);
    if (selectedOpt && selectedOpt.expression && !["all_checks", "paid_only", "subscriptionValue"].includes(selectedOpt.value)) {
      refundAmount = Math.max(0, evaluateCustomFormula(selectedOpt.expression, calcVars));
    } else {
      let base = advancePaid + checksPaid;
      if (checksFormula === "all_checks") base = advancePaid + checksPaid + checksUnpaid;
      else if (checksFormula === "subscriptionValue") base = subscriptionValue;
      refundAmount = Math.max(0, base - discountAmount);
    }
  } else if (reqData.paymentMethod === "ABK") {
    const baseRefund = Math.max(0, subscriptionValue - discountAmount);
    if (!debtABKCompanies || debtABKCompanies <= 0) {
      refundAmount = baseRefund;
    } else {
      const diff = debtABKCompanies - baseRefund;
      if (diff < 0) {
        refundAmount = debtABKCompanies;
      } else {
        refundAmount = baseRefund;
      }
    }
  } else if (["\u0627\u0644\u0645\u0634\u0631\u0642", "QNB"].includes(reqData.paymentMethod)) {
    const bankOpts = methodOptions?.banks || [];
    const selectedOpt = bankOpts.find((o) => o.value === bankFormula || o.id === bankFormula);
    if (selectedOpt && selectedOpt.expression && !["transferValue", "subscriptionValue", "collected"].includes(selectedOpt.value)) {
      refundAmount = Math.max(0, evaluateCustomFormula(selectedOpt.expression, calcVars));
    } else if (bankFormula === "collected") {
      refundAmount = Math.max(0, transferValue + advancePaid - discountAmount);
    } else {
      let base = transferValue;
      if (bankFormula === "subscriptionValue") base = subscriptionValue;
      refundAmount = Math.max(0, base - discountAmount);
    }
  } else if (isCompany) {
    if (!debtABKCompanies || debtABKCompanies <= 0) {
      refundAmount = "\u0641\u064A \u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u062F\u064A\u0648\u0646\u064A\u0629";
    } else {
      refundAmount = debtABKCompanies;
    }
  } else {
    refundAmount = Math.max(0, subscriptionValue - discountAmount);
  }
  if (isNoRefundException) {
    refundAmount = 0;
  } else {
    if (refundAmount === 0 && rawRefundInput !== void 0 && !isNaN(rawRefundInput) && rawRefundInput > 0 && !isCompany) {
      refundAmount = rawRefundInput;
    } else if (refundAmount === 0 && subscriptionValue > discountAmount && !isCompany) {
      refundAmount = Math.max(0, subscriptionValue - discountAmount);
    }
  }
  let refundToClient = "Not Required";
  if (reqData.paymentMethod === "ABK") {
    refundToClient = "Not Required";
  } else if (isNoRefundException) {
    refundToClient = 0;
  } else if (isCompany) {
    if (!debtABKCompanies || debtABKCompanies <= 0) {
      refundToClient = "\u0641\u064A \u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u062F\u064A\u0648\u0646\u064A\u0629";
    } else {
      const compOpts = methodOptions?.companies || [];
      const selectedOpt = compOpts.find((o) => o.value === companyFormula || o.id === companyFormula);
      if (selectedOpt && selectedOpt.expression && !["net_subscription", "net_transfer", "debt_only"].includes(selectedOpt.value)) {
        refundToClient = Math.max(0, evaluateCustomFormula(selectedOpt.expression, calcVars));
      } else if (companyFormula === "debt_only") {
        refundToClient = 0;
      } else {
        const companyNetBase2 = companyFormula === "net_transfer" && transferValue > 0 ? transferValue : subscriptionValue > 0 ? subscriptionValue : transferValue > 0 ? transferValue : sumComponents;
        refundToClient = Math.max(0, companyNetBase2 - debtABKCompanies - discountAmount);
      }
    }
  }
  let abkDebtDifference = "Not Required";
  if (reqData.paymentMethod === "ABK") {
    if (!debtABKCompanies || debtABKCompanies <= 0) {
      abkDebtDifference = "\u0641\u0649 \u0627\u0646\u062A\u0638\u0627\u0631 \u0645\u062F\u064A\u0648\u0646\u064A\u0629 \u0627\u0644\u0628\u0646\u0643";
    } else {
      const baseRefund = Math.max(0, subscriptionValue - discountAmount);
      abkDebtDifference = debtABKCompanies - baseRefund;
    }
  }
  const customFieldValues = { ...reqData.customFields || {} };
  if (db.customFields && Array.isArray(db.customFields)) {
    const vars = {
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
      refundAmount: typeof refundAmount === "number" ? refundAmount : 0,
      days
    };
    for (const field of db.customFields) {
      if (field.type === "formula" && field.formulaExpression) {
        customFieldValues[field.key] = evaluateCustomFormula(field.formulaExpression, vars);
      }
    }
  }
  const statusDateParsed = parseAnyDate(reqData.statusDate);
  const approvalDateParsed = parseAnyDate(reqData.approvalDate);
  let formattedStatusDate = statusDateParsed ? formatDateCustom(statusDateParsed) : reqData.statusDate || "";
  let formattedApprovalDate = approvalDateParsed ? formatDateCustom(approvalDateParsed) : reqData.approvalDate || "";
  if (!formattedStatusDate && (reqData.result === "Rejected" || reqData.status === "Rejected" || reqData.status === "Cancelled" || reqData.status === "Revoked" || reqData.status === "Deletion")) {
    formattedStatusDate = formattedApprovalDate || formattedReqDate || formatDateCustom(/* @__PURE__ */ new Date());
  }
  let fmApproved = reqData.firstManagerApproved;
  if (!reqData.approvalSentToFirstManager && fmApproved === false && !reqData.firstManagerComments) {
    fmApproved = void 0;
  }
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
    currency: reqData.currency || "\u062C\u0645",
    customFields: customFieldValues,
    requestYear: !isNaN(reqDate.getFullYear()) ? reqDate.getFullYear() : (/* @__PURE__ */ new Date()).getFullYear()
  };
}
function normalizeClubName(clubStr) {
  if (!clubStr || typeof clubStr !== "string") return "";
  let str = clubStr.trim().toLowerCase();
  str = str.replace(/^(نادي|نادى|فرع|club|branch)\s+/g, "").trim();
  const synonyms = {
    "maadi": "\u0627\u0644\u0645\u0639\u0627\u062F\u064A",
    "\u0645\u0639\u0627\u062F\u064A": "\u0627\u0644\u0645\u0639\u0627\u062F\u064A",
    "\u0627\u0644\u0645\u0639\u0627\u062F\u064A": "\u0627\u0644\u0645\u0639\u0627\u062F\u064A",
    "sheraton": "\u0634\u064A\u0631\u0627\u062A\u0648\u0646",
    "\u0627\u0644\u0634\u064A\u0631\u0627\u062A\u0648\u0646": "\u0634\u064A\u0631\u0627\u062A\u0648\u0646",
    "\u0634\u064A\u0631\u0627\u062A\u0648\u0646": "\u0634\u064A\u0631\u0627\u062A\u0648\u0646",
    "lotus": "\u0627\u0644\u0644\u0648\u062A\u0633",
    "\u0644\u0648\u062A\u0633": "\u0627\u0644\u0644\u0648\u062A\u0633",
    "\u0627\u0644\u0644\u0648\u062A\u0633": "\u0627\u0644\u0644\u0648\u062A\u0633",
    "alex": "\u0627\u0644\u0625\u0633\u0643\u0646\u062F\u0631\u064A\u0629",
    "\u0627\u0644\u0643\u0633": "\u0627\u0644\u0625\u0633\u0643\u0646\u062F\u0631\u064A\u0629",
    "\u0627\u0633\u0643\u0646\u062F\u0631\u064A\u0629": "\u0627\u0644\u0625\u0633\u0643\u0646\u062F\u0631\u064A\u0629",
    "\u0627\u0644\u0625\u0633\u0643\u0646\u062F\u0631\u064A\u0629": "\u0627\u0644\u0625\u0633\u0643\u0646\u062F\u0631\u064A\u0629",
    "\u0627\u0644\u0627\u0633\u0643\u0646\u062F\u0631\u064A\u0629": "\u0627\u0644\u0625\u0633\u0643\u0646\u062F\u0631\u064A\u0629",
    "tanta": "\u0637\u0646\u0637\u0627",
    "\u0637\u0646\u0637\u0627": "\u0637\u0646\u0637\u0627",
    "nakheel": "\u0627\u0644\u0646\u062E\u064A\u0644",
    "\u0646\u062E\u064A\u0644": "\u0627\u0644\u0646\u062E\u064A\u0644",
    "\u0627\u0644\u0646\u062E\u064A\u0644": "\u0627\u0644\u0646\u062E\u064A\u0644",
    "mansoura": "\u0627\u0644\u0645\u0646\u0635\u0648\u0631\u0629",
    "\u0645\u0646\u0635\u0648\u0631\u0629": "\u0627\u0644\u0645\u0646\u0635\u0648\u0631\u0629",
    "\u0627\u0644\u0645\u0646\u0635\u0648\u0631\u0629": "\u0627\u0644\u0645\u0646\u0635\u0648\u0631\u0629",
    "oct i": "\u0623\u0643\u062A\u0648\u0628\u0631 1",
    "oct 1": "\u0623\u0643\u062A\u0648\u0628\u0631 1",
    "october 1": "\u0623\u0643\u062A\u0648\u0628\u0631 1",
    "\u0627\u0643\u062A\u0648\u0628\u0631 1": "\u0623\u0643\u062A\u0648\u0628\u0631 1",
    "\u0623\u0643\u062A\u0648\u0628\u0631 1": "\u0623\u0643\u062A\u0648\u0628\u0631 1",
    "\u0623\u0643\u062A\u0648\u0628\u0631 \u0661": "\u0623\u0643\u062A\u0648\u0628\u0631 1",
    "oct ii": "\u0623\u0643\u062A\u0648\u0628\u0631 2",
    "oct 2": "\u0623\u0643\u062A\u0648\u0628\u0631 2",
    "october 2": "\u0623\u0643\u062A\u0648\u0628\u0631 2",
    "\u0627\u0643\u062A\u0648\u0628\u0631 2": "\u0623\u0643\u062A\u0648\u0628\u0631 2",
    "\u0623\u0643\u062A\u0648\u0628\u0631 2": "\u0623\u0643\u062A\u0648\u0628\u0631 2",
    "\u0623\u0643\u062A\u0648\u0628\u0631 \u0662": "\u0623\u0643\u062A\u0648\u0628\u0631 2",
    "damietta": "\u062F\u0645\u064A\u0627\u0637",
    "\u062F\u0645\u064A\u0627\u0637": "\u062F\u0645\u064A\u0627\u0637",
    "assiut": "\u0623\u0633\u064A\u0648\u0637",
    "\u0627\u0633\u064A\u0648\u0637": "\u0623\u0633\u064A\u0648\u0637",
    "\u0623\u0633\u064A\u0648\u0637": "\u0623\u0633\u064A\u0648\u0637",
    "elminya": "\u0627\u0644\u0645\u0646\u064A\u0627",
    "minya": "\u0627\u0644\u0645\u0646\u064A\u0627",
    "\u0645\u0646\u064A\u0627": "\u0627\u0644\u0645\u0646\u064A\u0627",
    "\u0627\u0644\u0645\u0646\u064A\u0627": "\u0627\u0644\u0645\u0646\u064A\u0627"
  };
  if (synonyms[str]) return synonyms[str];
  return str.replace(/[أإآ]/g, "\u0627").replace(/ى/g, "\u064A");
}
function isSameClub(clubA, clubB) {
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
function normalizeMembershipNumber(mem) {
  if (mem === null || mem === void 0) return "";
  return String(mem).trim().toLowerCase().replace(/[\u0660-\u0669]/g, (d) => (d.charCodeAt(0) - 1632).toString()).replace(/[\u06F0-\u06F9]/g, (d) => (d.charCodeAt(0) - 1776).toString()).replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[أإآٱ]/g, "\u0627").replace(/ة/g, "\u0647").replace(/ى/g, "\u064A").replace(/ئ/g, "\u064A").replace(/ؤ/g, "\u0648").replace(/[-_–—\s\/\.\\]/g, "");
}
function isSameMembershipNumber(mem1, mem2) {
  if (!mem1 || !mem2) return false;
  const s1 = String(mem1).trim().toLowerCase();
  const s2 = String(mem2).trim().toLowerCase();
  if (s1 === s2) return true;
  const n1 = normalizeMembershipNumber(mem1);
  const n2 = normalizeMembershipNumber(mem2);
  return n1.length > 0 && n1 === n2;
}
function isInternationalRequest(r) {
  if (!r) return false;
  const mType = String(r.membershipType || "").toLowerCase().trim();
  const pMethod = String(r.paymentMethod || "").toLowerCase().trim();
  const exc = String(r.exceptions || "").toLowerCase().trim();
  const curr = String(r.currency || "").toLowerCase().trim();
  if (mType === "international" || mType === "\u0639\u0636\u0648\u064A\u0629 \u062F\u0648\u0644\u064A\u0629" || mType === "\u062F\u0648\u0644\u064A" || mType === "\u062F\u0648\u0644\u064A\u0629" || mType.includes("international") || mType.includes("\u062F\u0648\u0644\u064A\u0629") || mType.includes("\u062F\u0648\u0644\u064A")) {
    return true;
  }
  if (pMethod === "international" || pMethod === "\u0639\u0636\u0648\u064A\u0629 \u062F\u0648\u0644\u064A\u0629" || pMethod.includes("\u0639\u0636\u0648\u064A\u0629 \u062F\u0648\u0644\u064A\u0629") || pMethod.includes("international")) {
    return true;
  }
  if (exc.includes("\u0639\u0636\u0648\u064A\u0629 \u062F\u0648\u0644\u064A\u0629") || exc.includes("international")) {
    return true;
  }
  if (curr.includes("\u0631\u064A\u0627\u0644") || curr === "sar" || curr.includes("\u0633\u0639\u0648\u062F\u064A") || curr.includes("\u0633\u0639\u0648\u062F\u0649") || curr === "usd" || curr.includes("\u062F\u0648\u0644\u0627\u0631")) {
    return true;
  }
  return false;
}
app.get("/api/requests/check-membership", requireAuth, (req, res) => {
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
  const isRejectedReq = (r) => {
    const st = String(r.status || "").toLowerCase().trim();
    const res2 = String(r.result || "").toLowerCase().trim();
    return st === "rejected" || st === "\u0645\u0631\u0641\u0648\u0636" || st.includes("\u0645\u0631\u0641\u0648\u0636") || res2 === "rejected" || res2 === "\u0645\u0631\u0641\u0648\u0636";
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
app.get("/api/requests", requireAuth, (req, res) => {
  const user = req.user;
  let resultRequests = [...db.requests];
  if (user.role === "club") {
    resultRequests = resultRequests.filter((r) => isSameClub(r.club, user.club));
  } else if (user.role === "international_user") {
    resultRequests = resultRequests.filter((r) => isInternationalRequest(r));
  }
  res.json(resultRequests);
});
app.post("/api/requests", requireAuth, (req, res) => {
  const user = req.user;
  const maxId = db.requests.reduce((max, r) => r.id > max ? r.id : max, 0);
  const newId = maxId + 1;
  const { membershipNumber } = req.body;
  const existingWithSameNum = db.requests.filter((r) => isSameMembershipNumber(r.membershipNumber, membershipNumber));
  const isDuplicateActive = existingWithSameNum.some((r) => r.status !== "Rejected" && r.result !== "Rejected" && !String(r.status || "").includes("\u0645\u0631\u0641\u0648\u0636") && !String(r.result || "").includes("\u0645\u0631\u0641\u0648\u0636"));
  if (isDuplicateActive) {
    const activeOne = existingWithSameNum.find((r) => r.status !== "Rejected" && r.result !== "Rejected" && !String(r.status || "").includes("\u0645\u0631\u0641\u0648\u0636") && !String(r.result || "").includes("\u0645\u0631\u0641\u0648\u0636"));
    const clubInfo = activeOne?.club ? ` \u0645\u0646 \u0641\u0631\u0639 (${activeOne.club})` : "";
    return res.status(400).json({ error: `\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0643\u0631\u0627\u0631 \u0631\u0642\u0645 \u0627\u0644\u0639\u0636\u0648\u064A\u0629 \u062D\u064A\u062B \u064A\u0648\u062C\u062F \u0637\u0644\u0628 \u0633\u0627\u0628\u0642 \u0646\u0634\u0637 \u0628\u0627\u0644\u0645\u0646\u0638\u0648\u0645\u0629${clubInfo}. \u0627\u0644\u062A\u0643\u0631\u0627\u0631 \u0645\u0633\u0645\u0648\u062D \u0641\u0642\u0637 \u0625\u0630\u0627 \u0643\u0627\u0646 \u0627\u0644\u0637\u0644\u0628 \u0627\u0644\u0633\u0627\u0628\u0642 \u0645\u0631\u0641\u0648\u0636\u0627\u064B (Rejected).` });
  }
  const isReReview = existingWithSameNum.length > 0 && !isDuplicateActive;
  let memberName = req.body.memberName || "";
  let cancellationReasonDetail = req.body.cancellationReasonDetail || "";
  if (isReReview) {
    if (!memberName.includes("\u0625\u0639\u0627\u062F\u0629 \u0639\u0631\u0636")) {
      memberName = `${memberName.trim()} (\u0625\u0639\u0627\u062F\u0629 \u0639\u0631\u0636)`;
    }
    if (cancellationReasonDetail && !cancellationReasonDetail.includes("\u0625\u0639\u0627\u062F\u0629 \u0639\u0631\u0636")) {
      cancellationReasonDetail = `${cancellationReasonDetail.trim()} (\u0625\u0639\u0627\u062F\u0629 \u0639\u0631\u0636)`;
    }
  }
  let clubName = req.body.club;
  if (user.role === "club") {
    clubName = user.club;
  }
  let reqMembershipType = req.body.membershipType;
  let reqCurrency = req.body.currency;
  let reqPaymentMethod = req.body.paymentMethod;
  if (user.role === "international_user") {
    reqMembershipType = reqMembershipType || "International";
    reqCurrency = reqCurrency || "\u0631\u064A\u0627\u0644 \u0633\u0639\u0648\u062F\u0649";
    reqPaymentMethod = reqPaymentMethod || "\u0639\u0636\u0648\u064A\u0629 \u062F\u0648\u0644\u064A\u0629";
  }
  const openCommittee = db.committees.find((c) => c.status === "open");
  let commNo = req.body.committeeNo;
  let commYear = req.body.committeeYear;
  let approvalDate = req.body.approvalDate;
  if (openCommittee) {
    commNo = commNo || openCommittee.number;
    commYear = commYear || openCommittee.year || (openCommittee.approvalDate ? String(new Date(openCommittee.approvalDate).getFullYear()) : "2026");
    approvalDate = approvalDate || openCommittee.approvalDate;
  }
  if (!commYear) {
    commYear = approvalDate ? String(new Date(approvalDate).getFullYear()) : "2026";
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
    approvalDate,
    result: "Pending",
    status: req.body.status || "Pending",
    statusDate: req.body.status && req.body.status !== "Pending" ? req.body.statusDate || "" : "",
    receiptReceived: req.body.receiptReceived ?? false,
    receiptReceivedDate: req.body.receiptReceivedDate || null,
    reviewed: req.body.reviewed ?? false
  });
  db.requests.push(processedData);
  saveDb();
  logAudit(user.username, user.name, user.role, "\u0625\u0646\u0634\u0627\u0621 \u0637\u0644\u0628 \u0625\u0644\u063A\u0627\u0621", `\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0637\u0644\u0628 \u0625\u0644\u063A\u0627\u0621 \u062C\u062F\u064A\u062F \u0628\u0631\u0642\u0645 \u0639\u0636\u0648\u064A\u0629 ${membershipNumber} \u0644\u0644\u0645\u0634\u062A\u0631\u0643 ${processedData.memberName}`, newId);
  res.json({ success: true, request: processedData });
});
function findRequestIndexById(rawId) {
  const strId = String(rawId);
  const numId = Number(rawId);
  return db.requests.findIndex((r) => String(r.id) === strId || r.id == rawId || !isNaN(numId) && r.id === numId);
}
function findRequestById(rawId) {
  const strId = String(rawId);
  const numId = Number(rawId);
  return db.requests.find((r) => String(r.id) === strId || r.id == rawId || !isNaN(numId) && r.id === numId);
}
app.put("/api/requests/:id", requireAuth, (req, res) => {
  const user = req.user;
  const rawId = req.params.id;
  const reqIndex = findRequestIndexById(rawId);
  if (reqIndex === -1) {
    return res.status(404).json({ error: "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A" });
  }
  const existingRequest = db.requests[reqIndex];
  const reqId = existingRequest.id;
  if (user.role === "international_user" && !isInternationalRequest(existingRequest)) {
    return res.status(403).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u062A\u0639\u062F\u064A\u0644 \u0637\u0644\u0628\u0627\u062A \u063A\u064A\u0631 \u062A\u0627\u0628\u0639\u0629 \u0644\u0644\u0639\u0636\u0648\u064A\u0627\u062A \u0627\u0644\u062F\u0648\u0644\u064A\u0629" });
  }
  const bodyKeys = Object.keys(req.body);
  const isOnlyReceiptUpdate = bodyKeys.length > 0 && bodyKeys.every((k) => k === "receiptReceived" || k === "receiptReceivedDate");
  if (!isOnlyReceiptUpdate) {
    if (existingRequest.reviewed && user.role !== "admin") {
      return res.status(403).json({ error: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0637\u0644\u0628 \u0628\u0639\u062F \u0645\u0631\u0627\u062C\u0639\u062A\u0647 (Reviewed) \u0625\u0644\u0627 \u0645\u0646 \u062E\u0644\u0627\u0644 \u0627\u0644\u0623\u062F\u0645\u0646 \u0627\u0644\u0645\u0631\u0643\u0632\u064A" });
    }
    if ((user.role === "club" || user.role === "international_user") && (existingRequest.result === "Accepted" || existingRequest.approvalSentToFirstManager || existingRequest.approvalSentToSectorManager)) {
      return res.status(403).json({ error: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0637\u0644\u0628 \u0628\u0639\u062F \u0625\u0631\u0633\u0627\u0644\u0647 \u0644\u0644\u0645\u0631\u0627\u062C\u0639\u064A\u0646 \u0648\u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F \u0625\u0644\u0627 \u0645\u0646 \u062E\u0644\u0627\u0644 \u0627\u0644\u0623\u062F\u0645\u0646 \u0627\u0644\u0645\u0631\u0643\u0632\u064A" });
    }
  }
  const { membershipNumber } = req.body;
  if (membershipNumber && !isSameMembershipNumber(membershipNumber, existingRequest.membershipNumber)) {
    const existingWithSameNum = db.requests.filter((r) => isSameMembershipNumber(r.membershipNumber, membershipNumber) && String(r.id) !== String(reqId));
    const isDuplicateActive = existingWithSameNum.some((r) => r.status !== "Rejected" && r.result !== "Rejected" && !String(r.status || "").includes("\u0645\u0631\u0641\u0648\u0636") && !String(r.result || "").includes("\u0645\u0631\u0641\u0648\u0636"));
    if (isDuplicateActive) {
      return res.status(400).json({ error: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u063A\u064A\u064A\u0631 \u0631\u0642\u0645 \u0627\u0644\u0639\u0636\u0648\u064A\u0629 \u0625\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0631\u0642\u0645 \u062D\u064A\u062B \u064A\u0648\u062C\u062F \u0637\u0644\u0628 \u0633\u0627\u0628\u0642 \u0646\u0634\u0637 \u0644\u0647 \u0628\u0627\u0644\u0645\u0646\u0638\u0648\u0645\u0629." });
    }
    if (existingWithSameNum.length > 0 && !isDuplicateActive) {
      req.body.isReReview = true;
      if (req.body.memberName && !req.body.memberName.includes("\u0625\u0639\u0627\u062F\u0629 \u0639\u0631\u0636")) {
        req.body.memberName = `${req.body.memberName.trim()} (\u0625\u0639\u0627\u062F\u0629 \u0639\u0631\u0636)`;
      }
    }
  }
  let bodyClub = req.body.club;
  if (user.role === "club") {
    bodyClub = user.club;
  }
  const reviewedValue = req.body.reviewed !== void 0 ? !!req.body.reviewed : existingRequest.reviewed ?? false;
  const updatedRequest = calculateRequestFields({
    ...existingRequest,
    ...req.body,
    reviewed: reviewedValue,
    id: reqId,
    club: bodyClub
  });
  db.requests[reqIndex] = updatedRequest;
  saveDb();
  let auditAction = "\u062A\u0639\u062F\u064A\u0644 \u0637\u0644\u0628 \u0625\u0644\u063A\u0627\u0621";
  let auditMsg = `\u0642\u0627\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 ${user.name} \u0628\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0637\u0644\u0628 \u0631\u0642\u0645 \u0627\u0644\u0639\u0636\u0648\u064A\u0629 ${updatedRequest.membershipNumber}`;
  if (user.role === "club") {
    auditAction = "\u062A\u0639\u062F\u064A\u0644 \u0637\u0644\u0628 \u0645\u0646 \u0627\u0644\u0641\u0631\u0639";
    auditMsg = `[\u062A\u0646\u0628\u064A\u0647 \u0641\u0631\u0639] \u0642\u0627\u0645 \u0627\u0644\u0641\u0631\u0639 \u0628\u062A\u0639\u062F\u064A\u0644 \u0637\u0644\u0628 \u0627\u0644\u0645\u0634\u062A\u0631\u0643 ${updatedRequest.memberName} \u0631\u0642\u0645 \u0627\u0644\u0639\u0636\u0648\u064A\u0629 ${updatedRequest.membershipNumber}`;
  } else if (user.role === "international_user") {
    auditAction = "\u062A\u0639\u062F\u064A\u0644 \u0637\u0644\u0628 \u0645\u0646 \u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0639\u0636\u0648\u064A\u0627\u062A \u0627\u0644\u062F\u0648\u0644\u064A\u0629";
    auditMsg = `[\u062A\u0646\u0628\u064A\u0647 \u062F\u0648\u0644\u064A] \u0642\u0627\u0645 \u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0639\u0636\u0648\u064A\u0627\u062A \u0627\u0644\u062F\u0648\u0644\u064A\u0629 \u0628\u062A\u0639\u062F\u064A\u0644 \u0637\u0644\u0628 \u0627\u0644\u0645\u0634\u062A\u0631\u0643 ${updatedRequest.memberName} \u0631\u0642\u0645 \u0627\u0644\u0639\u0636\u0648\u064A\u0629 ${updatedRequest.membershipNumber}`;
  }
  logAudit(user.username, user.name, user.role, auditAction, auditMsg, reqId);
  res.json({ success: true, request: updatedRequest });
});
app.post("/api/requests/bulk-review", requireAuth, (req, res) => {
  const user = req.user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "\u0627\u0644\u0623\u062F\u0645\u0646 \u0641\u0642\u0637 \u0644\u062F\u064A\u0647 \u0635\u0644\u0627\u062D\u064A\u0629 \u062A\u062D\u062F\u064A\u062F \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0637\u0644\u0628\u0627\u062A" });
  }
  const { ids, reviewed } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: "\u0627\u0644\u0631\u062C\u0627\u0621 \u062A\u062D\u062F\u064A\u062F \u0645\u0639\u0631\u0641\u0627\u062A \u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0628\u0634\u0643\u0644 \u0635\u062D\u064A\u062D" });
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
    saveDb();
    logAudit(
      user.username,
      user.name,
      user.role,
      reviewed ? "\u0645\u0631\u0627\u062C\u0639\u0629 \u062C\u0645\u0627\u0639\u064A\u0629 \u0644\u0644\u0637\u0644\u0628\u0627\u062A" : "\u0625\u0644\u063A\u0627\u0621 \u0645\u0631\u0627\u062C\u0639\u0629 \u062C\u0645\u0627\u0639\u064A\u0629",
      `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0629 \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0644\u0639\u062F\u062F ${updatedCount} \u0637\u0644\u0628\u0627\u062A \u0625\u0644\u0649 ${reviewed ? "\u0645\u064F\u0631\u0627\u062C\u0639" : "\u063A\u064A\u0631 \u0645\u064F\u0631\u0627\u062C\u0639"}`
    );
  }
  res.json({ success: true, requests: db.requests });
});
app.post("/api/requests/bulk-cancellation-status", requireAuth, (req, res) => {
  const user = req.user;
  if (user.role !== "admin" && user.role !== "first_manager" && user.role !== "sector_manager") {
    return res.status(403).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0625\u0644\u063A\u0627\u0621" });
  }
  const { ids, status, statusDate } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "\u0627\u0644\u0631\u062C\u0627\u0621 \u062A\u062D\u062F\u064A\u062F \u0639\u0636\u0648\u064A\u0629 \u0648\u0627\u062D\u062F\u0629 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644" });
  }
  if (!status) {
    return res.status(400).json({ error: "\u0627\u0644\u0631\u062C\u0627\u0621 \u0627\u062E\u062A\u064A\u0627\u0631 \u062D\u0627\u0644\u0629 \u0627\u0644\u0625\u0644\u063A\u0627\u0621" });
  }
  if (status !== "Pending" && !statusDate) {
    return res.status(400).json({ error: "\u062A\u0627\u0631\u064A\u062E \u062D\u0627\u0644\u0629 \u0627\u0644\u0625\u0644\u063A\u0627\u0621 \u0625\u062C\u0628\u0627\u0631\u064A \u0639\u0646\u062F \u0627\u062E\u062A\u064A\u0627\u0631 \u062D\u0627\u0644\u0629 \u0625\u0644\u063A\u0627\u0621 \u062C\u062F\u064A\u062F\u0629" });
  }
  let updatedCount = 0;
  const strIds = ids.map((id) => String(id));
  db.requests.forEach((r) => {
    if (strIds.includes(String(r.id))) {
      r.status = status;
      r.statusDate = status === "Pending" ? "" : statusDate || "";
      if (status === "Cancelled" || status === "Deletion" || status === "Revoked") {
        if (r.statusDate) {
          const sDate = new Date(r.statusDate);
          if (!isNaN(sDate.getFullYear())) {
            r.refundYear = sDate.getFullYear();
          }
        }
      } else {
        r.refundYear = void 0;
      }
      updatedCount++;
    }
  });
  if (updatedCount > 0) {
    saveDb();
    logAudit(
      user.username,
      user.name,
      user.role,
      "\u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0629 \u0627\u0644\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062C\u0645\u0627\u0639\u064A\u0629",
      `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0629 \u0627\u0644\u0625\u0644\u063A\u0627\u0621 \u0644\u0639\u062F\u062F ${updatedCount} \u0639\u0636\u0648\u064A\u0629 \u0625\u0644\u0649 (${status}) \u0648\u062A\u0627\u0631\u064A\u062E (${statusDate || "\u2014"})`
    );
  }
  res.json({ success: true, updatedCount, requests: db.requests });
});
app.post("/api/requests/bulk-delete", requireAuth, (req, res) => {
  const user = req.user;
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "\u0644\u0645 \u064A\u062A\u0645 \u062A\u062D\u062F\u064A\u062F \u0623\u064A \u0637\u0644\u0628\u0627\u062A \u0644\u0644\u062D\u0630\u0641" });
  }
  const idsSet = new Set(ids.map((id) => String(id)));
  const initialCount = db.requests ? db.requests.length : 0;
  db.requests = (db.requests || []).filter((r) => !idsSet.has(String(r.id)));
  const deletedCount = initialCount - db.requests.length;
  saveDb();
  logAudit(user.username, user.name, user.role, "\u062D\u0630\u0641 \u062C\u0645\u0627\u0639\u064A \u0644\u0644\u0637\u0644\u0628\u0627\u062A", `\u062A\u0645 \u062D\u0630\u0641 \u0639\u062F\u062F ${deletedCount} \u0637\u0644\u0628 \u0625\u0644\u063A\u0627\u0621 \u062F\u0641\u0639\u0629 \u0648\u0627\u062D\u062F\u0629`);
  res.json({ success: true, count: deletedCount, requests: db.requests });
});
app.delete("/api/requests/clear-all", requireAuth, (req, res) => {
  const user = req.user;
  const prevCount = db.requests ? db.requests.length : 0;
  db.requests = [];
  saveDb();
  logAudit(user.username, user.name, user.role, "\u0645\u0633\u062D \u0643\u0627\u0641\u0629 \u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0625\u0644\u063A\u0627\u0621", `\u062A\u0645 \u0645\u0633\u062D \u062C\u0645\u064A\u0639 \u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0625\u0644\u063A\u0627\u0621 \u0645\u0646 \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A (\u0639\u062F\u062F ${prevCount} \u0637\u0644\u0628)`);
  res.json({ success: true, count: prevCount, requests: [] });
});
app.delete("/api/requests/:id", requireAuth, (req, res) => {
  const user = req.user;
  const rawId = req.params.id;
  const index = findRequestIndexById(rawId);
  if (index === -1) {
    return res.status(404).json({ error: "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0628\u0645\u0644\u0641\u0627\u062A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A" });
  }
  const targetReq = db.requests[index];
  if (user.role !== "admin" && !isSameClub(user.club, targetReq.club)) {
    return res.status(403).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u062D\u0630\u0641 \u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628 (\u062E\u0627\u0635 \u0628\u0641\u0631\u0639 \u0622\u062E\u0631)" });
  }
  db.requests.splice(index, 1);
  saveDb();
  logAudit(user.username, user.name, user.role, "\u062D\u0630\u0641 \u0637\u0644\u0628 \u0625\u0644\u063A\u0627\u0621", `\u062A\u0645 \u062D\u0630\u0641 \u0637\u0644\u0628 \u0625\u0644\u063A\u0627\u0621 \u0644\u0644\u0645\u0634\u062A\u0631\u0643 ${targetReq.memberName} \u0631\u0642\u0645 \u0627\u0644\u0639\u0636\u0648\u064A\u0629 ${targetReq.membershipNumber}`, targetReq.id);
  res.json({ success: true, requests: db.requests });
});
app.post("/api/requests/:id/send-first-manager", requireAuth, (req, res) => {
  const user = req.user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "\u0627\u0644\u0623\u062F\u0645\u0646 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0641\u0642\u0637 \u064A\u0645\u0643\u0646\u0647 \u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F" });
  }
  const request = findRequestById(req.params.id);
  if (!request) {
    return res.status(404).json({ error: "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  const { pdfData, pdfName, pdfSize, notes } = req.body || {};
  request.approvalSentToFirstManager = true;
  request.firstManagerApproved = null;
  request.result = "Pending";
  if (pdfData !== void 0) {
    request.firstManagerPdfUrl = pdfData || "";
    request.firstManagerPdfName = pdfName || "\u0645\u0633\u062A\u0646\u062F\u0627\u062A_\u0627\u0644\u0637\u0644\u0628.pdf";
    request.firstManagerPdfSize = pdfSize || 0;
  }
  if (notes !== void 0) {
    request.firstManagerSendNotes = notes || "";
  }
  request.firstManagerSentAt = (/* @__PURE__ */ new Date()).toISOString();
  request.firstManagerSentBy = user.name || user.username;
  saveDb();
  logAudit(
    user.username,
    user.name,
    user.role,
    "\u0625\u0631\u0633\u0627\u0644 \u0644\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0623\u0648\u0644",
    `\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628 \u0627\u0644\u0645\u0634\u062A\u0631\u0643 ${request.memberName} (${request.membershipNumber}) \u0645\u0639 \u0645\u0644\u0641 PDF \u0648\u0645\u0633\u062A\u0646\u062F\u0627\u062A \u0627\u0644\u0623\u0648\u0631\u0627\u0642 \u0644\u0644\u0627\u0639\u062A\u0645\u0627\u062F`,
    request.id
  );
  res.json({ success: true, request, requests: db.requests });
});
app.post("/api/requests/:id/attach-first-manager-pdf", requireAuth, (req, res) => {
  const user = req.user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "\u0627\u0644\u0623\u062F\u0645\u0646 \u0641\u0642\u0637 \u064A\u0645\u0643\u0646\u0647 \u0625\u0631\u0641\u0627\u0642 \u0623\u0648 \u062A\u0639\u062F\u064A\u0644 \u0645\u0644\u0641 \u0627\u0644\u0640 PDF" });
  }
  const request = findRequestById(req.params.id);
  if (!request) {
    return res.status(404).json({ error: "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  const { pdfData, pdfName, pdfSize, notes } = req.body || {};
  if (pdfData !== void 0) {
    request.firstManagerPdfUrl = pdfData || "";
    request.firstManagerPdfName = pdfName || "\u0645\u0633\u062A\u0646\u062F\u0627\u062A_\u0627\u0644\u0637\u0644\u0628.pdf";
    request.firstManagerPdfSize = pdfSize || 0;
  }
  if (notes !== void 0) {
    request.firstManagerSendNotes = notes || "";
  }
  saveDb();
  logAudit(
    user.username,
    user.name,
    user.role,
    "\u062A\u062D\u062F\u064A\u062B \u0645\u0644\u0641 PDF \u0644\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0623\u0648\u0644",
    `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0645\u0644\u0641 \u0627\u0644\u0640 PDF \u0627\u0644\u0645\u0631\u0641\u0642 \u0644\u0637\u0644\u0628 \u0627\u0644\u0645\u0634\u062A\u0631\u0643 ${request.memberName} (${request.membershipNumber})`,
    request.id
  );
  res.json({ success: true, request, requests: db.requests });
});
app.post("/api/requests/:id/first-manager-action", requireAuth, (req, res) => {
  const user = req.user;
  if (user.role !== "first_manager") {
    return res.status(403).json({ error: "\u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0645\u0627\u0644\u064A \u0627\u0644\u0623\u0648\u0644 \u0641\u0642\u0637 \u0647\u064A \u0627\u0644\u0645\u0635\u0631\u062D \u0644\u0647\u0627 \u0628\u0627\u062A\u062E\u0627\u0630 \u0623\u0648 \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0642\u0631\u0627\u0631" });
  }
  const request = findRequestById(req.params.id);
  if (!request) {
    return res.status(404).json({ error: "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  const { approve, comments } = req.body;
  const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  if (approve) {
    request.firstManagerApproved = true;
    request.firstManagerComments = comments || "";
    request.firstManagerDecisionDate = todayStr;
    request.approvalSentToSectorManager = true;
    if (request.status === "Rejected" || request.result === "Rejected") {
      request.status = "Pending";
      request.result = "Pending";
      request.statusDate = "";
    }
  } else {
    request.firstManagerApproved = false;
    request.firstManagerComments = comments || "";
    request.firstManagerDecisionDate = todayStr;
    request.result = "Rejected";
    request.status = "Rejected";
    request.statusDate = todayStr;
    request.cancellationStatusDate = todayStr;
    request.approvalSentToSectorManager = false;
    request.sectorManagerApproved = null;
  }
  saveDb();
  logAudit(user.username, user.name, user.role, approve ? "\u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0645\u0627\u0644\u064A \u0627\u0644\u0623\u0648\u0644" : "\u0631\u0641\u0636 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0645\u0627\u0644\u064A \u0627\u0644\u0623\u0648\u0644", `\u062A\u0645 ${approve ? "\u0627\u0639\u062A\u0645\u0627\u062F (Accept)" : "\u0631\u0641\u0636 (Reject)"} \u0637\u0644\u0628 \u0627\u0644\u0639\u0636\u0648\u064A\u0629 ${request.membershipNumber} - \u0645\u0644\u0627\u062D\u0638\u0627\u062A: ${comments || "\u0644\u0627 \u062A\u0648\u062C\u062F"}`, request.id);
  res.json({ success: true, request });
});
app.post("/api/requests/:id/send-sector-manager", requireAuth, (req, res) => {
  const user = req.user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
  }
  const request = findRequestById(req.params.id);
  if (!request) {
    return res.status(404).json({ error: "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  request.approvalSentToSectorManager = true;
  request.sectorManagerApproved = null;
  request.result = "Pending";
  saveDb();
  logAudit(user.username, user.name, user.role, "\u0625\u0631\u0633\u0627\u0644 \u0644\u0631\u0626\u064A\u0633 \u0627\u0644\u0642\u0637\u0627\u0639", `\u062A\u0645 \u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u0637\u0644\u0628 \u0631\u0642\u0645 ${request.membershipNumber} \u0645\u0628\u0627\u0634\u0631\u0629 \u0644\u0631\u0626\u064A\u0633 \u0642\u0637\u0627\u0639 \u0627\u0644\u0634\u0624\u0648\u0646 \u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0644\u0644\u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0646\u0647\u0627\u0626\u064A`, request.id);
  res.json({ success: true, request });
});
app.post("/api/requests/:id/sector-manager-action", requireAuth, (req, res) => {
  const user = req.user;
  if (user.role !== "sector_manager" && user.role !== "admin") {
    return res.status(403).json({ error: "\u0635\u0644\u0627\u062D\u064A\u0629 \u0631\u0626\u064A\u0633 \u0627\u0644\u0642\u0637\u0627\u0639 \u0627\u0644\u0645\u0627\u0644\u064A \u0645\u0637\u0644\u0648\u0628\u0629 \u0644\u0644\u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0646\u0647\u0627\u0626\u064A" });
  }
  const request = findRequestById(req.params.id);
  if (!request) {
    return res.status(404).json({ error: "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  const { approve, comments } = req.body;
  const sectorUser = db.users.find((u) => u.role === "sector_manager");
  if (approve) {
    request.sectorManagerApproved = true;
    request.sectorManagerComments = comments;
    request.result = "Accepted";
    if (sectorUser && sectorUser.signatureUrl) {
      request.sectorManagerSignature = sectorUser.signatureUrl;
    }
    request.statusDate = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  } else {
    request.sectorManagerApproved = false;
    request.sectorManagerComments = comments;
    request.result = "Rejected";
    request.status = "Rejected";
  }
  saveDb();
  logAudit(user.username, user.name, user.role, approve ? "\u0627\u0639\u062A\u0645\u0627\u062F \u0631\u0626\u064A\u0633 \u0642\u0637\u0627\u0639 \u0627\u0644\u0645\u0627\u0644\u064A\u0629" : "\u0631\u0641\u0636 \u0631\u0626\u064A\u0633 \u0642\u0637\u0627\u0639 \u0627\u0644\u0645\u0627\u0644\u064A\u0629", `\u062A\u0645 \u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0646\u0647\u0627\u0626\u064A \u0644\u0644\u0637\u0644\u0628 ${request.membershipNumber} \u0645\u0639 \u0648\u0636\u0639 \u0627\u0644\u062E\u062A\u0645 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0648\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629`, request.id);
  res.json({ success: true, request });
});
app.get("/api/emails", requireAuth, (req, res) => {
  res.json(db.emailLogs);
});
app.post("/api/emails/send", requireAuth, (req, res) => {
  const user = req.user;
  const { requestId, type, recipient, subject, body } = req.body;
  const newEmail = {
    id: "mail-" + Date.now(),
    sender: "Wadi Degla Cancellation Hub <cancellations@wadidegla.com>",
    recipient,
    subject,
    body,
    sentAt: (/* @__PURE__ */ new Date()).toISOString(),
    requestId,
    type
  };
  db.emailLogs.unshift(newEmail);
  if (requestId && type === "Club Notification") {
    const request = db.requests.find((r) => r.id === requestId);
    if (request) {
      request.clubNote = (request.clubNote || "") + "\n[\u0628\u0631\u064A\u062F] \u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0625\u0634\u0639\u0627\u0631 \u0644\u0644\u0641\u0631\u0639 \u0628\u0637\u0644\u0628 \u0627\u0633\u062A\u0631\u062F\u0627\u062F \u0623\u0635\u0648\u0644 \u0625\u064A\u0635\u0627\u0644\u0627\u062A \u0627\u0644\u0639\u0636\u0648\u064A\u0629";
    }
  }
  saveDb();
  logAudit(user.username, user.name, user.role, `\u0625\u0631\u0633\u0627\u0644 \u0628\u0631\u064A\u062F \u0627\u0644\u0643\u062A\u0631\u0648\u0646\u064A - ${type}`, `\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0628\u0631\u064A\u062F \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0625\u0644\u0649 ${recipient} \u0628\u062E\u0635\u0648\u0635 \u0627\u0644\u0637\u0644\u0628 \u0631\u0642\u0645 ${requestId || "\u0639\u0627\u0645"}`, requestId);
  res.json({ success: true, email: newEmail });
});
app.post("/api/requests/reconcile-system-status", requireAuth, (req, res) => {
  const user = req.user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "\u0627\u0644\u0623\u062F\u0645\u0646 \u0641\u0642\u0637 \u0644\u062F\u064A\u0647 \u0647\u0630\u0647 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629" });
  }
  const { mappings } = req.body;
  if (!mappings || !Array.isArray(mappings)) {
    return res.status(400).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
  }
  let updatedCount = 0;
  mappings.forEach((item) => {
    const request = db.requests.find((r) => r.membershipNumber === item.membershipNumber);
    if (request) {
      request.systemStatus = item.systemStatus;
      updatedCount++;
    }
  });
  saveDb();
  logAudit(user.username, user.name, user.role, "\u0645\u0637\u0627\u0628\u0642\u0629 \u062D\u0627\u0644\u0629 \u0627\u0644\u0646\u0638\u0627\u0645", `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0629 \u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u062F\u0627\u062E\u0644\u064A \u0644\u0639\u062F\u062F ${updatedCount} \u0639\u0636\u0648\u064A\u0629 \u0628\u0646\u0627\u0621\u064B \u0639\u0644\u0649 \u0631\u0641\u0639 \u0645\u0644\u0641 \u0625\u0643\u0633\u0644 \u0644\u0644\u0645\u0637\u0627\u0628\u0642\u0629`);
  res.json({ success: true, updatedCount, requests: db.requests });
});
app.post("/api/requests/import-company-debts", requireAuth, (req, res) => {
  const user = req.user;
  if (user.role !== "admin" && user.role !== "auditor") {
    return res.status(403).json({ error: "\u0627\u0644\u0623\u062F\u0645\u0646 \u0648\u0627\u0644\u0645\u0631\u0627\u062C\u0639 \u0641\u0642\u0637 \u0644\u062F\u064A\u0647\u0645 \u0635\u0644\u0627\u062D\u064A\u0629 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0645\u062F\u064A\u0648\u0646\u064A\u0627\u062A" });
  }
  const { rows } = req.body;
  if (!rows || !Array.isArray(rows)) {
    return res.status(400).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0634\u064A\u062A \u0627\u0644\u0645\u062F\u064A\u0648\u0646\u064A\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
  }
  let updatedCount = 0;
  let nonZeroDebtCount = 0;
  let zeroDebtCount = 0;
  let totalDebtAmount = 0;
  const notFoundList = [];
  const updatedMembersList = [];
  rows.forEach((row) => {
    const mNumRaw = String(row.membershipNumber || "").trim();
    if (!mNumRaw) return;
    const cleanMNum = mNumRaw.replace(/^0+/, "");
    const cleanNatId = String(row.nationalId || "").trim();
    const matchingRequests = db.requests.filter((r) => {
      const dbMNum = String(r.membershipNumber || "").trim();
      const cleanDbMNum = dbMNum.replace(/^0+/, "");
      if (dbMNum === mNumRaw || cleanDbMNum && cleanMNum && cleanDbMNum === cleanMNum) return true;
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
      const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      matchingRequests.forEach((request) => {
        const prevDebt = request.debtABKCompanies || 0;
        request.debtABKCompanies = newDebt;
        if (row.loanUnderName && String(row.loanUnderName).trim() && row.loanUnderName !== "\u0644\u0627 \u064A\u0648\u062C\u062F") {
          request.loanUnderName = String(row.loanUnderName).trim();
        }
        if (row.nationalId && String(row.nationalId).trim()) {
          request.nationalId = String(row.nationalId).trim();
        }
        if (row.paymentMethod && String(row.paymentMethod).trim()) {
          request.paymentMethod = String(row.paymentMethod).trim();
        }
        request.statusDate = todayStr;
        const sDate = new Date(todayStr);
        if (!isNaN(sDate.getFullYear()) && (request.status === "Cancelled" || request.status === "Deletion" || request.status === "Revoked")) {
          request.refundYear = sDate.getFullYear();
        }
        const recalculated = calculateRequestFields(request, db.formulas);
        Object.assign(request, recalculated);
        updatedCount++;
        updatedMembersList.push({
          id: request.id,
          membershipNumber: request.membershipNumber,
          memberName: request.memberName,
          paymentMethod: request.paymentMethod,
          previousDebt: prevDebt,
          newDebt,
          statusDate: request.statusDate,
          refundAmount: request.refundAmount,
          refundToClient: request.refundToClient
        });
      });
    } else {
      notFoundList.push(mNumRaw);
    }
  });
  saveDb();
  logAudit(
    user.username,
    user.name,
    user.role,
    "\u062A\u062D\u062F\u064A\u062B \u0645\u062F\u064A\u0648\u0646\u064A\u0627\u062A \u0627\u0644\u0634\u0631\u0643\u0627\u062A \u0648\u0627\u0644\u0628\u0646\u0643",
    `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0645\u062F\u064A\u0648\u0646\u064A\u0629 \u0627\u0644\u0628\u0646\u0648\u0643/\u0627\u0644\u0634\u0631\u0643\u0627\u062A \u0644\u0639\u062F\u062F ${updatedCount} \u0637\u0644\u0628 (\u0628\u0625\u062C\u0645\u0627\u0644\u064A \u0645\u062F\u064A\u0648\u0646\u064A\u0627\u062A ${totalDebtAmount.toLocaleString()} \u062C.\u0645\u060C \u0645\u0646\u0647\u0627 ${nonZeroDebtCount} \u0645\u062F\u064A\u0648\u0646\u064A\u0629 \u0628\u0631\u0635\u064A\u062F \u0641\u0639\u0644\u064A) \u0639\u0628\u0631 \u0631\u0641\u0639 \u0634\u064A\u062A Excel`
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
app.post("/api/requests/:id/status-date", requireAuth, (req, res) => {
  const user = req.user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "\u0627\u0644\u0623\u062F\u0645\u0646 \u0641\u0642\u0637 \u0644\u062F\u064A\u0647 \u0635\u0644\u0627\u062D\u064A\u0629 \u062A\u0639\u062F\u064A\u0644 \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062D\u0627\u0644\u0629" });
  }
  const rawId = req.params.id;
  const reqIndex = findRequestIndexById(rawId);
  if (reqIndex === -1) {
    return res.status(404).json({ error: "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A" });
  }
  const { statusDate } = req.body;
  const request = db.requests[reqIndex];
  const prevDate = request.statusDate || "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F";
  request.statusDate = statusDate ? String(statusDate).trim() : "";
  if (request.statusDate) {
    const sDate = new Date(request.statusDate);
    if (!isNaN(sDate.getFullYear()) && (request.status === "Cancelled" || request.status === "Deletion" || request.status === "Revoked")) {
      request.refundYear = sDate.getFullYear();
    }
  }
  saveDb();
  logAudit(
    user.username,
    user.name,
    user.role,
    "\u062A\u0639\u062F\u064A\u0644 \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062D\u0627\u0644\u0629 \u064A\u062F\u0648\u064A\u064B\u0627",
    `\u0642\u0627\u0645 \u0627\u0644\u0623\u062F\u0645\u0646 \u0628\u062A\u0639\u062F\u064A\u0644 \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062D\u0627\u0644\u0629 \u0644\u0644\u0639\u0636\u0648\u064A\u0629 \u0631\u0642\u0645 ${request.membershipNumber} \u0645\u0646 (${prevDate}) \u0625\u0644\u0649 (${request.statusDate || "\u0641\u0627\u0631\u063A"})`,
    request.id
  );
  res.json({ success: true, request, requests: db.requests });
});
app.post("/api/requests/import", requireAuth, (req, res) => {
  const user = req.user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "\u0627\u0644\u0623\u062F\u0645\u0646 \u0641\u0642\u0637 \u064A\u0645\u0643\u0646\u0647 \u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A" });
  }
  const { rows } = req.body;
  if (!rows || !Array.isArray(rows)) {
    return res.status(400).json({ error: "\u062A\u0646\u0633\u064A\u0642 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" });
  }
  let importedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  rows.forEach((row) => {
    if (!row.membershipNumber || !row.memberName) {
      skippedCount++;
      return;
    }
    const existingWithSameNum = db.requests.filter((r) => String(r.membershipNumber).trim() === String(row.membershipNumber).trim());
    const existingActive = existingWithSameNum.find((r) => r.status !== "Rejected" && r.result !== "Rejected");
    if (existingActive) {
      if (row.firstManagerComments) {
        existingActive.firstManagerComments = row.firstManagerComments;
      }
      if (row.adminNote) {
        existingActive.adminNote = row.adminNote;
      }
      if (row.cancellationReasonDetail && row.cancellationReasonDetail !== "\u0628\u062F\u0648\u0646 \u0623\u0633\u0628\u0627\u0628 \u062A\u0641\u0635\u064A\u0644\u064A\u0629") {
        existingActive.cancellationReasonDetail = row.cancellationReasonDetail;
      }
      if (row.receiptReceived !== void 0) {
        existingActive.receiptReceived = row.receiptReceived;
        if (row.receiptReceived) {
          existingActive.receiptReceivedDate = row.receiptReceivedDate || existingActive.receiptReceivedDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        }
      }
      if (row.reviewed !== void 0) {
        existingActive.reviewed = row.reviewed;
      }
      if (row.approvalSentToFirstManager !== void 0) {
        existingActive.approvalSentToFirstManager = row.approvalSentToFirstManager;
      }
      if (row.firstManagerApproved !== void 0) {
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
    if (isReReview && !mName.includes("\u0625\u0639\u0627\u062F\u0629 \u0639\u0631\u0636")) {
      mName = `${mName.trim()} (\u0625\u0639\u0627\u062F\u0629 \u0639\u0631\u0636)`;
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
      receiptReceived: row.receiptReceived === void 0 ? false : row.receiptReceived,
      receiptReceivedDate: row.receiptReceived ? row.receiptReceivedDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0] : null,
      reviewed: row.reviewed === void 0 ? false : row.reviewed,
      approvalSentToFirstManager: row.approvalSentToFirstManager === void 0 ? false : row.approvalSentToFirstManager,
      subscriptionDate: row.subscriptionDate || "2026-01-01",
      requestDate: row.requestDate || "2026-06-01"
    });
    db.requests.push(processed);
    importedCount++;
  });
  saveDb();
  logAudit(user.username, user.name, user.role, "\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u062C\u0645\u0639", `\u062A\u0645 \u0627\u0633\u062A\u064A\u0631\u0627\u062F ${importedCount} \u0637\u0644\u0628 \u062C\u062F\u064A\u062F \u0648\u062A\u062D\u062F\u064A\u062B ${updatedCount} \u0637\u0644\u0628\u060C \u0648\u062A\u062E\u0637\u064A ${skippedCount} \u0633\u062C\u0644\u0627\u062A`);
  res.json({ success: true, importedCount: importedCount + updatedCount, skippedCount, requests: db.requests });
});
app.get("/api/backup", requireAuth, (req, res) => {
  const user = req.user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "\u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0623\u062F\u0645\u0646 \u0645\u0637\u0644\u0648\u0628\u0629 \u0644\u062A\u0635\u062F\u064A\u0631 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629" });
  }
  logAudit(user.username, user.name, user.role, "\u0646\u0633\u062E \u0627\u062D\u062A\u064A\u0627\u0637\u064A \u0644\u0644\u0645\u0631\u0643\u0632 \u0627\u0644\u0645\u0627\u0644\u064A", `\u062A\u0645 \u0639\u0645\u0644 \u0648\u062A\u0635\u062F\u064A\u0631 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u0643\u0627\u0645\u0644\u0629 \u0644\u0642\u0627\u0639\u062F\u0629 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0646\u0638\u0648\u0645\u0629`);
  res.json(db);
});
app.post("/api/backup/restore", requireAuth, (req, res) => {
  const user = req.user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "\u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0623\u062F\u0645\u0646 \u0645\u0637\u0644\u0648\u0628\u0629 \u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629" });
  }
  const restoredDb = req.body;
  if (!restoredDb || !restoredDb.users || !restoredDb.dropdowns || !restoredDb.requests) {
    return res.status(400).json({ error: "\u0645\u0644\u0641 \u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0623\u0648 \u0646\u0627\u0642\u0635 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0647\u064A\u0643\u0644\u064A\u0629" });
  }
  db = { ...restoredDb };
  saveDb();
  logAudit(user.username, user.name, user.role, "\u0627\u0633\u062A\u0631\u062C\u0627\u0639 \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A", `\u062A\u0645 \u0627\u0633\u062A\u0631\u062C\u0627\u0639 \u0648\u062A\u0637\u0628\u064A\u0642 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u062E\u0627\u0631\u062C\u064A\u0629 \u0644\u0642\u0627\u0639\u062F\u0629 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0646\u0638\u0627\u0645 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0628\u0646\u062C\u0627\u062D`);
  res.json({ success: true, message: "\u062A\u0645 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0628\u0646\u062C\u0627\u062D" });
});
app.get("/api/logs/audit", requireAuth, (req, res) => {
  const user = req.user;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "\u0627\u0644\u0623\u062F\u0645\u0646 \u0641\u0642\u0637 \u0644\u0647 \u062D\u0642 \u0627\u0644\u0627\u0637\u0644\u0627\u0639 \u0639\u0644\u0649 \u0633\u062C\u0644 \u0627\u0644\u062D\u0631\u0643\u0627\u062A" });
  }
  res.json(db.auditLogs);
});
app.use((err, req, res, next) => {
  console.error("Express API Error:", err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({
    error: err?.message || "\u062D\u062F\u062B \u062E\u0637\u0623 \u063A\u064A\u0631 \u0645\u062A\u0648\u0642\u0639 \u0641\u064A \u0645\u0639\u0627\u0644\u062C\u0629 \u0627\u0644\u0637\u0644\u0628 \u0639\u0644\u0649 \u0627\u0644\u062E\u0627\u062F\u0645",
    details: process.env.NODE_ENV === "development" ? String(err) : void 0
  });
});
async function startServer() {
  await ensureDbLoaded();
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Wadi Degla Cancellation Server running on port ${PORT}`);
  });
}
if (!process.env.VERCEL) {
  startServer();
}
var server_default = app;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  app,
  ensureDbLoaded
});
//# sourceMappingURL=server.cjs.map
