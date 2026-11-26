import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LabelList
} from 'recharts';
import {
  Layers, Users, CheckCircle2, XCircle, Clock, Gauge, FilterX, Search, Download, Eye, CalendarRange, Maximize2, X, Banknote, Globe, Filter, Paperclip, FileText, MessageSquareWarning
} from 'lucide-react';
import { formatCommitteeYear, formatDateCustom, isSameClub, isInternationalRequest, getDetailedStatus, DETAILED_STATUS_ORDER, getRejectionReason } from '../utils';
import DocumentViewerModal from './DocumentViewerModal';
import MultiSelect from './MultiSelect';
import TableScrollWrapper from './TableScrollWrapper';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export type SectorView = 'overview' | 'years' | 'committee';

type DurationKey = 'lt1m' | '1to3m' | 'gt3m';

const DURATION_LABELS: Record<DurationKey, string> = {
  lt1m: 'أقل من شهر',
  '1to3m': 'من شهر إلى 3 شهور',
  gt3m: 'أكثر من 3 شهور',
};

const DURATION_COLORS: Record<DurationKey, string> = {
  lt1m: '#10b981',
  '1to3m': '#eab308',
  gt3m: '#171717',
};

const RESULT_COLORS = { accepted: '#10b981', rejected: '#f43f5e', pending: '#a3a3a3' };

const getDurationKey = (r: any): DurationKey => {
  let days = Number(r.days);
  if (!Number.isFinite(days)) {
    // Fallback on the stored classification when days is missing
    return r.type2 === 'Over 3 months' ? 'gt3m' : '1to3m';
  }
  if (days <= 30) return 'lt1m';
  if (days <= 90) return '1to3m';
  return 'gt3m';
};

type ResultKey = 'accepted' | 'rejected' | 'pending';

const getResultKey = (r: any): ResultKey => {
  if (r.result === 'Accepted') return 'accepted';
  if (r.result === 'Rejected' || r.status === 'Rejected') return 'rejected';
  return 'pending';
};

// Committee number as one canonical string, so "03", "٣", "لجنة 3" and "3" are the same committee.
const normNo = (v: any): string => {
  let t = String(v ?? '').trim().replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  t = t.replace(/^لجنة\s*(رقم)?\s*/, '').trim();
  if (/^\d+$/.test(t)) t = String(parseInt(t, 10));
  return t;
};

// Committees defined in Settings (number + year). Used to place requests that have no committee year.
let KNOWN_COMMITTEES: any[] = [];
const setKnownCommittees = (c: any[]) => { KNOWN_COMMITTEES = Array.isArray(c) ? c : []; };

const yearOf = (v: any): string => {
  const m = String(v ?? '').match(/(19|20)\d{2}/);
  if (m) return m[0];
  const d = v ? new Date(v) : null;
  return d && !isNaN(d.getTime()) ? String(d.getFullYear()) : '';
};

/**
 * The year of the committee a request belongs to.
 * 1) the request's own committeeYear;
 * 2) otherwise the Settings committee with the same number (if several: the one whose approval year
 *    matches the request, else the open one, else the latest);
 * 3) otherwise the year of the approval / request date.
 * This stops one committee from being split into two because some requests lack a committee year.
 */
const getYear = (r: any): string => {
  const own = yearOf(r.committeeYear);
  if (own) return own;
  const no = normNo(r.committeeNo);
  const cands = KNOWN_COMMITTEES.filter((c) => normNo(c.number) === no && yearOf(c.year || c.approvalDate));
  if (cands.length === 1) return yearOf(cands[0].year || cands[0].approvalDate);
  if (cands.length > 1) {
    const reqYear = yearOf(r.approvalDate);
    const byApproval = cands.find((c) => reqYear && yearOf(c.approvalDate) === reqYear);
    const latest = cands.slice().sort((a, b) => Number(yearOf(b.year || b.approvalDate)) - Number(yearOf(a.year || a.approvalDate)))[0];
    const pick = byApproval || cands.find((c) => c.status === 'open') || latest;
    return yearOf(pick.year || pick.approvalDate);
  }
  return yearOf(r.approvalDate) || yearOf(r.requestDate) || yearOf(r.createdAt) || formatCommitteeYear(undefined);
};

// Distinct detailed statuses present in the data (Pending split into sub-statuses)
const buildStatusOptions = (requests: any[]): string[] => {
  const present = new Set<string>();
  requests.forEach((r) => present.add(getDetailedStatus(r)));
  const known = DETAILED_STATUS_ORDER.filter((s) => present.has(s));
  const rest = Array.from(present).filter((s) => !DETAILED_STATUS_ORDER.includes(s)).sort();
  return [...known, ...rest];
};

const committeeKey = (no: any, year: any) => `${normNo(no)}|${year}`;

const committeeLabel = (key: string) => {
  const [no, year] = key.split('|');
  return `لجنة ${no} (${year})`;
};

const sortCommitteeKeys = (a: string, b: string) => {
  const [an, ay] = a.split('|');
  const [bn, by] = b.split('|');
  if (ay !== by) return Number(by) - Number(ay); // newest year first
  return (parseInt(bn) || 0) - (parseInt(an) || 0);
};

interface CommitteeStat {
  key: string;
  no: string;
  year: string;
  total: number;
  accepted: number;
  rejected: number;
  pending: number;
  lt1m: number;
  m1to3: number;
  gt3m: number;
}

function buildCommitteeStats(requests: any[], knownCommittees: any[] = []): CommitteeStat[] {
  const map = new Map<string, CommitteeStat>();
  const ensure = (no: any, year: string) => {
    const key = committeeKey(no, year);
    if (!map.has(key)) {
      map.set(key, {
        key, no: normNo(no), year, total: 0, accepted: 0, rejected: 0, pending: 0, lt1m: 0, m1to3: 0, gt3m: 0,
      });
    }
    return map.get(key)!;
  };

  // Committees that exist in the system even if they have no requests yet
  knownCommittees.forEach((c) => {
    if (c?.number === undefined || c?.number === null || c?.number === '') return;
    ensure(c.number, yearOf(c.year || c.approvalDate) || formatCommitteeYear(c.year || c.approvalDate));
  });

  requests.forEach((r) => {
    if (!r.committeeNo || r.committeeNo === '—') return;
    const s = ensure(r.committeeNo, getYear(r));
    s.total++;
    s[getResultKey(r)]++;
    const d = getDurationKey(r);
    if (d === 'lt1m') s.lt1m++;
    else if (d === '1to3m') s.m1to3++;
    else s.gt3m++;
  });

  return Array.from(map.values()).sort((a, b) => sortCommitteeKeys(a.key, b.key));
}

type Tone = 'neutral' | 'amber' | 'green' | 'red' | 'gray' | 'indigo' | 'sky' | 'violet' | 'teal' | 'orange';

// card = background + border, icon = icon chip, value = number color
const TONES: Record<Tone, { card: string; icon: string; value: string }> = {
  neutral: { card: 'bg-neutral-50 border-neutral-300', icon: 'bg-neutral-900 text-amber-400', value: 'text-neutral-900' },
  amber:   { card: 'bg-amber-50 border-amber-200',     icon: 'bg-amber-400 text-white',       value: 'text-amber-700' },
  green:   { card: 'bg-emerald-50 border-emerald-200', icon: 'bg-emerald-500 text-white',     value: 'text-emerald-700' },
  red:     { card: 'bg-rose-50 border-rose-200',       icon: 'bg-rose-500 text-white',        value: 'text-rose-700' },
  gray:    { card: 'bg-slate-50 border-slate-200',     icon: 'bg-slate-500 text-white',       value: 'text-slate-700' },
  indigo:  { card: 'bg-indigo-50 border-indigo-200',   icon: 'bg-indigo-500 text-white',      value: 'text-indigo-700' },
  sky:     { card: 'bg-sky-50 border-sky-200',         icon: 'bg-sky-500 text-white',         value: 'text-sky-700' },
  violet:  { card: 'bg-violet-50 border-violet-200',   icon: 'bg-violet-500 text-white',      value: 'text-violet-700' },
  teal:    { card: 'bg-teal-50 border-teal-200',       icon: 'bg-teal-500 text-white',        value: 'text-teal-700' },
  orange:  { card: 'bg-orange-50 border-orange-200',   icon: 'bg-orange-500 text-white',      value: 'text-orange-700' },
};

const KpiCard = ({ icon: Icon, label, value, tone = 'neutral', hint }: {
  icon: any; label: string; value: React.ReactNode; tone?: Tone; hint?: string;
}) => {
  const t = TONES[tone];
  return (
    <div className={`border rounded-2xl p-4 shadow-2xs flex items-center gap-3 ${t.card}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${t.icon}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 text-right">
        <p className="text-[11px] font-bold text-slate-600 truncate">{label}</p>
        <p className={`text-2xl font-black leading-tight ${t.value}`}>{value}</p>
        {hint && <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>}
      </div>
    </div>
  );
};

const ResultBadge = ({ r }: { r: any }) => {
  const k = getResultKey(r);
  const map = {
    accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-rose-50 text-rose-700 border-rose-200',
    pending: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  const text = { accepted: 'Accepted', rejected: 'Rejected', pending: 'Pending' };
  return <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black ${map[k]}`}>{text[k]}</span>;
};

const selectCls =
  'w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400/40';
const inputCls = selectCls;
const labelCls = 'block text-[10px] font-black text-slate-500 mb-1 text-right';

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  view: SectorView;
  requests: any[];
  committees: any[];
  dropdowns: any;
  user: any;
  selectedCommittee: string; // "no|year" or ''
  onSelectCommittee: (key: string) => void;
  onOpenCommittee: (key: string) => void; // select + navigate to committee view
  onExportExcel?: (data?: any[]) => void;
}

export default function SectorManagerDashboard(props: Props) {
  const { view } = props;
  setKnownCommittees(props.committees);
  return (
    <div className="space-y-6">
      {view === 'overview' && <OverviewView {...props} />}
      {view === 'years' && <YearsView {...props} />}
      {view === 'committee' && <CommitteeView {...props} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable pieces for the overview dashboard
// ---------------------------------------------------------------------------

const toNum = (v: any): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const fmtNum = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

const isSarCurrency = (c: any) => {
  const s = String(c || '').toLowerCase().trim();
  return s === '' || /sar|ريال|سعود/.test(s);
};

// The statuses whose money is counted as "refund / fees": Cancelled + the two
// Pending sub-statuses that mean the memo reached Finance.
const MONEY_STATUSES = [
  'Cancelled',
  'Pending (تم ارسال المذكرة الى الادارة المالية)',
  'Pending (الشيك جاهز للاستلام)',
];

const CHART_COLORS = ['#eab308', '#171717', '#10b981', '#f43f5e', '#6366f1', '#d97706', '#0ea5e9', '#a16207', '#737373'];

/** Chart container with a "full screen" button. */
function ChartCard({ title, children, height = 260, className = '' }: {
  title: string;
  children: (height: number | string) => React.ReactNode;
  height?: number;
  className?: string;
}) {
  const [full, setFull] = useState(false);

  React.useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [full]);

  const header = (isFull: boolean) => (
    <div className="flex items-center justify-between mb-3">
      <button
        type="button"
        onClick={() => setFull(!isFull)}
        title={isFull ? 'إغلاق ملء الشاشة' : 'عرض بملء الشاشة'}
        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50 cursor-pointer"
      >
        {isFull ? <X className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>
      <h3 className={`${isFull ? 'text-base' : 'text-sm'} font-black text-slate-800 text-right`}>{title}</h3>
    </div>
  );

  return (
    <>
      <div className={`bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs ${className}`}>
        {header(false)}
        <div style={{ height }}>{children('100%')}</div>
      </div>
      {full && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 md:p-8" onClick={() => setFull(false)} dir="rtl">
          <div className="bg-white rounded-3xl shadow-2xl w-full h-full max-w-[1400px] p-5 md:p-7 flex flex-col" onClick={(e) => e.stopPropagation()}>
            {header(true)}
            <div className="flex-1 min-h-0">{children('100%')}</div>
          </div>
        </div>
      )}
    </>
  );
}

const Section = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <div className="text-right border-r-4 border-amber-400 pr-3">
      <h3 className="text-sm font-black text-slate-900">{title}</h3>
      {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
    {children}
  </section>
);

const MoneyCard = ({ icon: Icon, label, amount, currency, tone, hint }: {
  icon: any; label: string; amount: number; currency: string; tone: Tone; hint?: string;
}) => {
  const t = TONES[tone];
  return (
    <div className={`border rounded-2xl p-4 shadow-2xs ${t.card}`}>
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${t.icon}`}><Icon className="w-4 h-4" /></div>
        <p className="text-[11px] font-bold text-slate-600 text-right">{label}</p>
      </div>
      <p className={`mt-3 text-right text-xl font-black leading-tight ${t.value}`}>
        {fmtNum(amount)} <span className="text-xs font-bold opacity-70">{currency}</span>
      </p>
      {hint && <p className="text-[10px] text-slate-500 mt-1 text-right">{hint}</p>}
    </div>
  );
};

const FilterGroup = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <p className="text-[11px] font-black text-amber-600 mb-2 text-right">{title}</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{children}</div>
  </div>
);

const countBy = (list: any[], pick: (r: any) => string) => {
  const m: Record<string, number> = {};
  list.forEach((r) => {
    const k = (pick(r) || '').toString().trim() || 'غير محدد';
    m[k] = (m[k] || 0) + 1;
  });
  return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
};

// ---- Chart value labels: bold, dark text with a white halo so numbers stay readable on any background ----
type LabelPos = 'top' | 'bottom' | 'center' | 'right';
const valueLabel = (pos: LabelPos, color = '#0f172a', size = 12, minSize = 0) => (props: any) => {
  const { x, y, width, height, value } = props;
  const v = Number(value);
  if (!v) return null; // hide zeros
  const X = Number(x), Y = Number(y), W = Number(width) || 0, H = Number(height) || 0;
  if (minSize && ((pos === 'center' && H < minSize))) return null; // too small a segment to hold a number
  let tx = X + W / 2, ty = Y - 7, anchor: 'middle' | 'start' = 'middle';
  if (pos === 'bottom') ty = Y + 18;
  if (pos === 'center') ty = Y + H / 2 + size / 3;
  if (pos === 'right') { tx = X + W + 8; ty = Y + H / 2 + size / 3; anchor = 'start'; }
  return (
    <text x={tx} y={ty} textAnchor={anchor} fontSize={size} fontWeight={800} fill={color} style={{ direction: 'ltr' }}
      stroke={pos === 'center' ? 'none' : '#fff'} strokeWidth={pos === 'center' ? 0 : 3} paintOrder="stroke">
      {fmtNum(v)}
    </text>
  );
};

// Y-axis category label for horizontal bars (kept LTR so it sits to the left of the axis, never over the bars)
const CatTick = (props: any) => {
  const { x, y, payload } = props;
  const t = String(payload?.value ?? '');
  const short = t.length > 48 ? `${t.slice(0, 47)}…` : t;
  return (
    <text x={Number(x) - 8} y={Number(y)} dy={4} textAnchor="end" fontSize={11} fontWeight={600} fill="#475569" style={{ direction: 'ltr' }}>
      <title>{t}</title>{short}
    </text>
  );
};

const RAD = Math.PI / 180;
// Pie labels sit outside the ring: "value (percent)"
const pieLabel = (props: any) => {
  const { cx, cy, midAngle, outerRadius, value, percent } = props;
  const r = Number(outerRadius) + 16;
  const x = Number(cx) + r * Math.cos(-midAngle * RAD);
  const y = Number(cy) + r * Math.sin(-midAngle * RAD);
  return (
    <text x={x} y={y} textAnchor={x > Number(cx) ? 'start' : 'end'} dominantBaseline="central" fontSize={12} fontWeight={800} fill="#0f172a" style={{ direction: 'ltr' }}>
      {value} <tspan fontSize={10} fontWeight={600} fill="#64748b">({(percent * 100).toFixed(0)}%)</tspan>
    </text>
  );
};


function PieBlock({ data }: { data: { name: string; value: number; color?: string }[] }) {
  const rows = data.filter((d) => d.value > 0);
  if (!rows.length) return <div className="h-full flex items-center justify-center text-slate-400 text-xs">لا يوجد بيانات للرسم</div>;
  const total = rows.reduce((a, d) => a + d.value, 0);
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius="30%" outerRadius="55%" paddingAngle={2}
              label={pieLabel} labelLine={{ stroke: '#cbd5e1' }}>
              {rows.map((d, i) => <Cell key={i} fill={d.color || CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 max-h-24 overflow-y-auto text-[11px] text-slate-600">
        {rows.map((d, i) => (
          <div key={d.name} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color || CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="truncate">{d.name}: <b>{d.value}</b> <span className="text-slate-400">({((d.value / total) * 100).toFixed(0)}%)</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// View 1: Dashboard (overview with filters)
// ---------------------------------------------------------------------------

type IntlMode = 'all' | 'only' | 'exclude';
type AmountScope = 'finance' | 'all';

function OverviewView({ requests, committees, onOpenCommittee }: Props) {
  // ---- filters ----
  const [years, setYears] = useState<string[]>([]);
  const [committeeKeys, setCommitteeKeys] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [clubs, setClubs] = useState<string[]>([]);
  const [payments, setPayments] = useState<string[]>([]);
  const [membershipTypes, setMembershipTypes] = useState<string[]>([]);
  const [intl, setIntl] = useState<IntlMode>('all');
  const [reasons, setReasons] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [result, setResult] = useState('');
  const [duration, setDuration] = useState('');
  const [amountScope, setAmountScope] = useState<AmountScope>('finance');
  const [showFilters, setShowFilters] = useState(false);

  const hasCommittee = (r: any) => !!r.committeeNo && r.committeeNo !== '—';

  // ---- filter options (built from the data itself) ----
  const allStats = useMemo(() => buildCommitteeStats(requests, committees), [requests, committees]);
  const yearOptions = useMemo(() => Array.from(new Set(allStats.map((s) => s.year))).sort((a, b) => Number(b) - Number(a)), [allStats]);
  const committeeOptions = useMemo(
    () => allStats.filter((s) => years.length === 0 || years.includes(s.year)).map((s) => ({ label: committeeLabel(s.key), value: s.key })),
    [allStats, years]
  );
  const distinct = (pick: (r: any) => any) =>
    Array.from(new Set(requests.map((r) => String(pick(r) || '').trim()).filter(Boolean))).sort();
  const clubOptions = useMemo(() => distinct((r) => r.club), [requests]);
  const paymentOptions = useMemo(() => distinct((r) => r.paymentMethod), [requests]);
  const membershipOptions = useMemo(() => distinct((r) => r.membershipType), [requests]);
  const reasonOptions = useMemo(() => distinct((r) => r.cancellationReason), [requests]);
  const statusOptions = useMemo(() => buildStatusOptions(requests), [requests]);

  // ---- filtering ----
  const filtered = useMemo(() => requests.filter((r) => {
    const yr = getYear(r);
    if (years.length && !years.includes(yr)) return false;
    if (committeeKeys.length && !(hasCommittee(r) && committeeKeys.includes(committeeKey(r.committeeNo, yr)))) return false;
    if (clubs.length && !clubs.some((c) => isSameClub(c, r.club))) return false;
    if (payments.length && !payments.includes(String(r.paymentMethod || '').trim())) return false;
    if (membershipTypes.length && !membershipTypes.includes(String(r.membershipType || '').trim())) return false;
    if (intl === 'only' && !isInternationalRequest(r)) return false;
    if (intl === 'exclude' && isInternationalRequest(r)) return false;
    if (reasons.length && !reasons.includes(String(r.cancellationReason || '').trim())) return false;
    if (startDate && (r.requestDate || '') < startDate) return false;
    if (endDate && (r.requestDate || '') > endDate) return false;
    if (result && getResultKey(r) !== result) return false;
    if (duration && getDurationKey(r) !== duration) return false;
    if (statuses.length && !statuses.includes(getDetailedStatus(r))) return false;
    return true;
  }), [requests, years, committeeKeys, clubs, payments, membershipTypes, intl, reasons, startDate, endDate, result, duration, statuses]);

  const activeFilters = [years, committeeKeys, clubs, payments, membershipTypes, reasons, statuses].filter((a) => a.length).length
    + [startDate, endDate, result, duration].filter(Boolean).length + (intl !== 'all' ? 1 : 0);

  const reset = () => {
    setYears([]); setCommitteeKeys([]); setClubs([]); setPayments([]); setMembershipTypes([]); setIntl('all');
    setReasons([]); setStatuses([]); setStartDate(''); setEndDate(''); setResult(''); setDuration('');
  };

  // ---- committees ----
  const withCommittee = useMemo(() => filtered.filter(hasCommittee), [filtered]);
  const stats = useMemo(() => {
    const s = buildCommitteeStats(withCommittee, activeFilters ? [] : committees);
    return s.filter((x) => (years.length === 0 || years.includes(x.year)) && (committeeKeys.length === 0 || committeeKeys.includes(x.key)));
  }, [withCommittee, committees, activeFilters, years, committeeKeys]);
  const committeeCount = stats.length;
  const committeesWithRequests = stats.filter((x) => x.total > 0).length;
  const average = committeeCount ? withCommittee.length / committeeCount : 0;

  // ---- counts ----
  const totals = useMemo(() => {
    const t = { total: filtered.length, accepted: 0, rejected: 0, pending: 0, lt1m: 0, m1to3: 0, gt3m: 0 };
    filtered.forEach((r) => {
      t[getResultKey(r)]++;
      const d = getDurationKey(r);
      if (d === 'lt1m') t.lt1m++; else if (d === '1to3m') t.m1to3++; else t.gt3m++;
    });
    return t;
  }, [filtered]);

  // ---- money ----
  const money = useMemo(() => {
    const inScope = (r: any) => amountScope === 'all' || MONEY_STATUSES.includes(getDetailedStatus(r));
    const local = filtered.filter((r) => !isInternationalRequest(r) && inScope(r));
    const sum = (list: any[], pick: (r: any) => any) => list.reduce((a, r) => a + toNum(pick(r)), 0);
    // مبلغ الاسترداد = Refund Amount + رد للعميل (الشركات)
    const refundOf = (r: any) => toNum(r.refundAmount) + toNum(r.refundToClient);

    const intlAll = filtered.filter((r) => isInternationalRequest(r));
    const intlScope = intlAll.filter(inScope);
    const intlSar = intlScope.filter((r) => isSarCurrency(r.currency));
    // Where every request's money went (so the card can be audited line by line)
    const rowsMap = new Map<string, { label: string; intl: boolean; included: boolean; count: number; refund: number; client: number }>();
    let nonNumeric = 0;
    filtered.forEach((r) => {
      const intlReq = isInternationalRequest(r);
      const st = getDetailedStatus(r);
      const included = inScope(r) && !intlReq;
      const label = intlReq ? `دولية (SAR) — ${st}` : st;
      const row = rowsMap.get(label) || { label, intl: intlReq, included, count: 0, refund: 0, client: 0 };
      row.count++;
      row.refund += toNum(r.refundAmount);
      row.client += toNum(r.refundToClient);
      rowsMap.set(label, row);
      if (!intlReq && typeof r.refundAmount === 'string' && r.refundAmount.trim() !== '' && !Number.isFinite(Number(r.refundAmount.replace(/,/g, '')))) nonNumeric++;
    });
    const breakdown = Array.from(rowsMap.values()).sort((a, b) => Number(b.included) - Number(a.included) || Number(a.intl) - Number(b.intl) || (b.refund + b.client) - (a.refund + a.client));
    const allLocalRefund = breakdown.filter((x) => !x.intl).reduce((a, x) => a + x.refund + x.client, 0);

    return {
      breakdown, nonNumeric, allLocalRefund,
      localCount: local.length,
      refund: sum(local, refundOf),
      usage: sum(local, (r) => r.usageFee),
      admin: sum(local, (r) => r.adminFees),
      visa: sum(local, (r) => r.visaFees2Percent),
      intlCount: intlAll.length,
      intlScopeCount: intlScope.length,
      intlRefundSar: sum(intlSar, refundOf),
      intlOtherCurrency: intlScope.length - intlSar.length,
    };
  }, [filtered, amountScope]);

  // ---- chart data ----
  const monthlyData = useMemo(() => {
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const rows = months.map((name) => ({ name, 'الطلبات المقدمة': 0, 'تم إلغاؤها': 0 }));
    filtered.forEach((r) => {
      const d = new Date(r.requestDate);
      if (isNaN(d.getTime())) return;
      rows[d.getMonth()]['الطلبات المقدمة']++;
      if (r.status === 'Cancelled') rows[d.getMonth()]['تم إلغاؤها']++;
    });
    return rows;
  }, [filtered]);
  const paymentData = useMemo(() => countBy(filtered, (r) => r.paymentMethod), [filtered]);
  const clubData = useMemo(() => countBy(filtered, (r) => r.club), [filtered]);
  const reasonData = useMemo(() => countBy(filtered, (r) => r.cancellationReason).slice(0, 8), [filtered]);
  const statusData = useMemo(() => countBy(filtered, (r) => getDetailedStatus(r)), [filtered]);

  const barData = stats.slice().reverse().map((s) => ({
    name: `${s.no} (${s.year})`, Accepted: s.accepted, Rejected: s.rejected, Pending: s.pending,
  }));
  const durationPie = [
    { name: DURATION_LABELS.lt1m, value: totals.lt1m, color: DURATION_COLORS.lt1m },
    { name: DURATION_LABELS['1to3m'], value: totals.m1to3, color: DURATION_COLORS['1to3m'] },
    { name: DURATION_LABELS.gt3m, value: totals.gt3m, color: DURATION_COLORS.gt3m },
  ];
  const resultPie = [
    { name: 'Accepted', value: totals.accepted, color: RESULT_COLORS.accepted },
    { name: 'Rejected', value: totals.rejected, color: RESULT_COLORS.rejected },
    { name: 'Pending', value: totals.pending, color: RESULT_COLORS.pending },
  ];

  const tickAngle = (n: number) => (n > 6 ? { angle: -30, textAnchor: 'end' as const, height: 55 } : {});

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="text-right">
          <h2 className="text-xl font-black text-slate-900">لوحة Director</h2>
          <p className="text-xs text-slate-500 mt-1">كل الأرقام والرسومات تتغير حسب الفلاتر المختارة.</p>
        </div>
        <button type="button" onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">
          <Filter className="w-3.5 h-3.5 text-amber-500" />
          الفلاتر
          {activeFilters > 0 && <span className="bg-amber-400 text-neutral-950 text-[10px] font-black px-1.5 rounded-md">{activeFilters}</span>}
        </button>
      </div>

      {/* ================= Filters ================= */}
      {showFilters && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-4">
          <FilterGroup title="اللجنة والفترة">
            <div><label className={labelCls}>سنة اللجنة</label>
              <MultiSelect options={yearOptions} selected={years} onChange={(v) => { setYears(v); setCommitteeKeys([]); }} placeholder="كل السنوات" /></div>
            <div><label className={labelCls}>اللجنة</label>
              <MultiSelect options={committeeOptions} selected={committeeKeys} onChange={setCommitteeKeys} placeholder="كل اللجان" /></div>
            <div><label className={labelCls}>تاريخ الطلب من</label>
              <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div><label className={labelCls}>تاريخ الطلب إلى</label>
              <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </FilterGroup>

          <FilterGroup title="العضوية">
            <div><label className={labelCls}>النادي</label>
              <MultiSelect options={clubOptions} selected={clubs} onChange={setClubs} placeholder="كل الأندية" /></div>
            <div><label className={labelCls}>طريقة الدفع</label>
              <MultiSelect options={paymentOptions} selected={payments} onChange={setPayments} placeholder="كل الطرق" /></div>
            <div><label className={labelCls}>نوع العضوية</label>
              <MultiSelect options={membershipOptions} selected={membershipTypes} onChange={setMembershipTypes} placeholder="كل الأنواع" /></div>
            <div><label className={labelCls}>العضويات الدولية</label>
              <select className={selectCls} value={intl} onChange={(e) => setIntl(e.target.value as IntlMode)}>
                <option value="all">الكل</option>
                <option value="only">الدولية فقط</option>
                <option value="exclude">بدون الدولية</option>
              </select></div>
            <div className="sm:col-span-2"><label className={labelCls}>سبب الإلغاء</label>
              <MultiSelect options={reasonOptions} selected={reasons} onChange={setReasons} placeholder="كل الأسباب" wide /></div>
          </FilterGroup>

          <FilterGroup title="الحالة والمدة">
            <div className="sm:col-span-2"><label className={labelCls}>الحالة</label>
              <MultiSelect options={statusOptions} selected={statuses} onChange={setStatuses} placeholder="كل الحالات"
                groups={[{ label: 'كل الـ Pending', values: statusOptions.filter((o) => o.startsWith('Pending')) }]} wide /></div>
            <div><label className={labelCls}>النتيجة</label>
              <select className={selectCls} value={result} onChange={(e) => setResult(e.target.value)}>
                <option value="">الكل</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="pending">Pending</option>
              </select></div>
            <div><label className={labelCls}>مدة الاشتراك</label>
              <select className={selectCls} value={duration} onChange={(e) => setDuration(e.target.value)}>
                <option value="">الكل</option>
                <option value="lt1m">{DURATION_LABELS.lt1m}</option>
                <option value="1to3m">{DURATION_LABELS['1to3m']}</option>
                <option value="gt3m">{DURATION_LABELS.gt3m}</option>
              </select></div>
          </FilterGroup>

          <div className="flex flex-wrap items-end justify-between gap-3 pt-3 border-t border-slate-100">
            <button type="button" onClick={reset}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">
              <FilterX className="w-3.5 h-3.5" /> مسح كل الفلاتر
            </button>
            <div className="min-w-[260px]">
              <label className={labelCls}>المبالغ (الاسترداد / الانتفاع / المصاريف) تُحسب على</label>
              <select className={selectCls} value={amountScope} onChange={(e) => setAmountScope(e.target.value as AmountScope)}>
                <option value="finance">الحالات المالية فقط (Cancelled + أُرسلت للمالية + الشيك جاهز)</option>
                <option value="all">كل الطلبات بعد الفلاتر</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ================= 1. Counts ================= */}
      <Section title="1) الطلبات واللجان" subtitle={`${totals.total} طلب بعد الفلاتر${totals.total - withCommittee.length > 0 ? ` — منها ${totals.total - withCommittee.length} بدون لجنة` : ''}`}>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiCard icon={Layers} label="عدد اللجان" value={committeeCount} tone="indigo" hint={committeesWithRequests !== committeeCount ? `منها ${committeesWithRequests} لها طلبات` : 'اللجنة = رقم + سنة'} />
          <KpiCard icon={Users} label="إجمالي الطلبات" value={totals.total} tone="amber" />
          <KpiCard icon={Gauge} label="متوسط الطلبات / لجنة" value={average.toFixed(1)} tone="sky" hint="للطلبات التي لها لجنة" />
          <KpiCard icon={CheckCircle2} label="Accepted" value={totals.accepted} tone="green" />
          <KpiCard icon={XCircle} label="Rejected" value={totals.rejected} tone="red" />
          <KpiCard icon={Clock} label="Pending" value={totals.pending} tone="orange" />
        </div>
      </Section>

      {/* ================= 2. Money ================= */}
      <Section
        title="2) المبالغ — العضويات المحلية (EGP)"
        subtitle={amountScope === 'finance'
          ? `محسوبة على ${money.localCount} طلب: Cancelled + Pending (تم الارسال للإدارة المالية) + Pending (الشيك جاهز) — بدون العضويات الدولية`
          : `محسوبة على ${money.localCount} طلب (كل الحالات) — بدون العضويات الدولية`}
      >
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <MoneyCard icon={Banknote} label="مبلغ الاسترداد" amount={money.refund} currency="EGP" tone="green" />
          <MoneyCard icon={Banknote} label="مبلغ حق الانتفاع" amount={money.usage} currency="EGP" tone="amber" />
          <MoneyCard icon={Banknote} label="المصاريف الإدارية" amount={money.admin} currency="EGP" tone="sky" />
          <MoneyCard icon={Banknote} label="مصاريف الفيزا 2%" amount={money.visa} currency="EGP" tone="violet" />
        </div>
      </Section>

      <details className="bg-white border border-slate-200 rounded-2xl shadow-2xs group">
        <summary className="cursor-pointer select-none px-4 py-3 text-xs font-black text-slate-700 flex items-center justify-between">
          <span className="text-[10px] font-bold text-amber-600">اضغط للعرض / الإخفاء</span>
          <span>كيف تم حساب مبلغ الاسترداد؟ (تفصيل حسب الحالة)</span>
        </summary>
        <div className="px-4 pb-4 space-y-2">
          <p className="text-[11px] text-slate-500 text-right">
            الإجمالي = Refund Amount + رد للعميل. الصفوف المعلّمة بـ ✓ هي اللي دخلت في الكارت، والباقي مستبعد. العضويات الدولية بالـ SAR ومنفصلة.
          </p>
          <TableScrollWrapper>
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50 text-slate-500 font-black">
                <tr>
                  <th className="px-3 py-2">الحالة</th>
                  <th className="px-3 py-2">عدد الطلبات</th>
                  <th className="px-3 py-2">Refund Amount</th>
                  <th className="px-3 py-2">رد للعميل</th>
                  <th className="px-3 py-2">الإجمالي</th>
                  <th className="px-3 py-2">داخل الكارت؟</th>
                </tr>
              </thead>
              <tbody>
                {money.breakdown.map((row) => (
                  <tr key={row.label} className={`border-t border-slate-100 ${row.included ? 'bg-emerald-50/40' : ''}`}>
                    <td className="px-3 py-2 font-bold text-slate-800">{row.label}</td>
                    <td className="px-3 py-2">{row.count}</td>
                    <td className="px-3 py-2 font-mono">{fmtNum(row.refund)}</td>
                    <td className="px-3 py-2 font-mono">{fmtNum(row.client)}</td>
                    <td className="px-3 py-2 font-mono font-black">{fmtNum(row.refund + row.client)}</td>
                    <td className="px-3 py-2 font-black">{row.included ? <span className="text-emerald-600">✓</span> : <span className="text-slate-300">—</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-black">
                <tr className="border-t border-slate-200">
                  <td className="px-3 py-2" colSpan={4}>المحسوب في الكارت (EGP)</td>
                  <td className="px-3 py-2 font-mono text-emerald-700" colSpan={2}>{fmtNum(money.refund)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2" colSpan={4}>إجمالي كل الطلبات المحلية بكل الحالات (EGP)</td>
                  <td className="px-3 py-2 font-mono" colSpan={2}>{fmtNum(money.allLocalRefund)}</td>
                </tr>
              </tfoot>
            </table>
          </TableScrollWrapper>
          {money.nonNumeric > 0 && (
            <p className="text-[11px] font-bold text-rose-600 text-right">تنبيه: {money.nonNumeric} طلب مبلغ الاسترداد فيه نص مش رقم، واتحسب صفر.</p>
          )}
        </div>
      </details>

      {/* ================= 3. International ================= */}
      <Section title="3) العضويات الدولية (SAR)" subtitle="منفصلة عن العضويات المحلية ولا تدخل في مبالغ الجنيه">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
          <KpiCard icon={Globe} label="عدد العضويات الدولية" value={money.intlCount} tone="indigo"
            hint={`منها ${money.intlScopeCount} ${amountScope === 'finance' ? 'في حالات مالية' : 'محسوبة'}`} />
          <MoneyCard icon={Banknote} label="مبلغ الاسترداد (دولي)" amount={money.intlRefundSar} currency="SAR" tone="teal"
            hint={money.intlOtherCurrency > 0 ? `${money.intlOtherCurrency} طلب بعملة غير SAR غير محسوب` : undefined} />
        </div>
      </Section>

      {/* ================= 4. Duration ================= */}
      <Section title="4) مدة الاشتراك">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(['lt1m', '1to3m', 'gt3m'] as DurationKey[]).map((k) => {
            const v = k === 'lt1m' ? totals.lt1m : k === '1to3m' ? totals.m1to3 : totals.gt3m;
            return (
              <div key={k}>
                <KpiCard icon={Clock} label={DURATION_LABELS[k]} value={v} tone={k === 'gt3m' ? 'violet' : k === 'lt1m' ? 'green' : 'amber'}
                  hint={totals.total ? `${((v / totals.total) * 100).toFixed(0)}% من الطلبات` : undefined} />
              </div>
            );
          })}
        </div>
      </Section>

      {/* ================= 5. Charts ================= */}
      <Section title="5) الرسومات البيانية" subtitle="اضغط على أيقونة التكبير في أي رسم لعرضه بملء الشاشة">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <ChartCard title="عدد الطلبات بكل لجنة" className="xl:col-span-2">
            {() => barData.length === 0 ? <div className="h-full flex items-center justify-center text-slate-400 text-xs">لا يوجد بيانات للرسم</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 28, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} {...tickAngle(barData.length)} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Accepted" stackId="a" fill={RESULT_COLORS.accepted}><LabelList dataKey="Accepted" content={valueLabel('center', '#ffffff', 12, 16)} /></Bar>
                  <Bar dataKey="Rejected" stackId="a" fill={RESULT_COLORS.rejected}><LabelList dataKey="Rejected" content={valueLabel('center', '#ffffff', 12, 16)} /></Bar>
                  <Bar dataKey="Pending" stackId="a" fill={RESULT_COLORS.pending}><LabelList dataKey="Pending" content={valueLabel('center', '#ffffff', 12, 16)} /></Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Accepted / Rejected / Pending">{() => <PieBlock data={resultPie} />}</ChartCard>

          <ChartCard title="مدة الاشتراك">{() => <PieBlock data={durationPie} />}</ChartCard>

          <ChartCard title="معدل تدفق الطلبات شهرياً" className="xl:col-span-2">
            {() => (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 32, right: 20, left: -15, bottom: 14 }}>
                  <defs>
                    <linearGradient id="sectorReq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#eab308" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" fontSize={11} stroke="#94a3b8" />
                  <YAxis allowDecimals={false} fontSize={11} stroke="#94a3b8" />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="الطلبات المقدمة" stroke="#eab308" strokeWidth={2} fill="url(#sectorReq)" dot>
                    <LabelList dataKey="الطلبات المقدمة" content={valueLabel('top', '#a16207', 12)} />
                  </Area>
                  <Area type="monotone" dataKey="تم إلغاؤها" stroke="#171717" strokeWidth={1.5} fillOpacity={0} dot>
                    <LabelList dataKey="تم إلغاؤها" content={valueLabel('bottom', '#171717', 12)} />
                  </Area>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="طريقة دفع الاشتراكات">{() => <PieBlock data={paymentData} />}</ChartCard>

          <ChartCard title="حجم الإلغاء حسب الفروع" className="xl:col-span-2">
            {() => clubData.length === 0 ? <div className="h-full flex items-center justify-center text-slate-400 text-xs">لا يوجد بيانات للرسم</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={clubData} margin={{ top: 28, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" fontSize={11} stroke="#94a3b8" interval={0} {...tickAngle(clubData.length)} />
                  <YAxis allowDecimals={false} fontSize={11} stroke="#94a3b8" />
                  <Tooltip />
                  <Bar dataKey="value" name="الطلبات" fill="#ca8a04" radius={[4, 4, 0, 0]}><LabelList dataKey="value" content={valueLabel('top', '#713f12', 13)} /></Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="الحالات (Pending مفصّلة)" className="xl:col-span-2">
            {() => statusData.length === 0 ? <div className="h-full flex items-center justify-center text-slate-400 text-xs">لا يوجد بيانات للرسم</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} layout="vertical" margin={{ top: 5, right: 50, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" allowDecimals={false} fontSize={11} stroke="#94a3b8" />
                  <YAxis type="category" dataKey="name" tick={<CatTick />} stroke="#94a3b8" width={300} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" name="الطلبات" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20}><LabelList dataKey="value" content={valueLabel('right', '#3730a3', 13)} /></Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="الأسباب الأكثر شيوعاً لطلب الإلغاء">
            {() => reasonData.length === 0 ? <div className="h-full flex items-center justify-center text-slate-400 text-xs">لا يوجد بيانات للرسم</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reasonData} layout="vertical" margin={{ top: 5, right: 50, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" allowDecimals={false} fontSize={11} stroke="#94a3b8" />
                  <YAxis type="category" dataKey="name" tick={<CatTick />} stroke="#94a3b8" width={190} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" name="الطلبات" fill="#171717" radius={[0, 4, 4, 0]} barSize={20}><LabelList dataKey="value" content={valueLabel('right', '#171717', 13)} /></Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </Section>

      {/* ================= 6. Committees table ================= */}
      <Section title="6) تفاصيل اللجان">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <TableScrollWrapper>
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50 text-slate-500 font-black">
                <tr>
                  <th className="px-3 py-2.5">اللجنة</th>
                  <th className="px-3 py-2.5">السنة</th>
                  <th className="px-3 py-2.5">عدد الطلبات</th>
                  <th className="px-3 py-2.5">Accepted</th>
                  <th className="px-3 py-2.5">Rejected</th>
                  <th className="px-3 py-2.5">Pending</th>
                  <th className="px-3 py-2.5">أقل من شهر</th>
                  <th className="px-3 py-2.5">شهر - 3 شهور</th>
                  <th className="px-3 py-2.5">أكثر من 3 شهور</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {stats.length === 0 && (
                  <tr><td colSpan={10} className="px-3 py-8 text-center text-slate-400 font-bold">لا توجد لجان مطابقة</td></tr>
                )}
                {stats.map((s) => (
                  <tr key={s.key} className="border-t border-slate-100 hover:bg-amber-50/40">
                    <td className="px-3 py-2.5 font-black text-slate-800">لجنة {s.no}</td>
                    <td className="px-3 py-2.5 font-mono">{s.year}</td>
                    <td className="px-3 py-2.5 font-black">{s.total}</td>
                    <td className="px-3 py-2.5 text-emerald-600 font-bold">{s.accepted}</td>
                    <td className="px-3 py-2.5 text-rose-600 font-bold">{s.rejected}</td>
                    <td className="px-3 py-2.5 text-slate-500 font-bold">{s.pending}</td>
                    <td className="px-3 py-2.5">{s.lt1m}</td>
                    <td className="px-3 py-2.5">{s.m1to3}</td>
                    <td className="px-3 py-2.5">{s.gt3m}</td>
                    <td className="px-3 py-2.5">
                      <button type="button" onClick={() => onOpenCommittee(s.key)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-900 text-amber-400 text-[10px] font-black hover:bg-neutral-800 cursor-pointer">
                        <Eye className="w-3 h-3" /> عرض الطلبات
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollWrapper>
        </div>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------
// View 2: Committees per year (standalone page)
// ---------------------------------------------------------------------------

function YearsView({ requests, committees, onOpenCommittee }: Props) {
  const [expandedYear, setExpandedYear] = useState<string>('');
  const stats = useMemo(() => buildCommitteeStats(requests, committees), [requests, committees]);

  const byYear = useMemo(() => {
    const map = new Map<string, { year: string; committees: CommitteeStat[]; total: number; accepted: number; rejected: number }>();
    stats.forEach((s) => {
      if (!map.has(s.year)) map.set(s.year, { year: s.year, committees: [], total: 0, accepted: 0, rejected: 0 });
      const y = map.get(s.year)!;
      y.committees.push(s);
      y.total += s.total; y.accepted += s.accepted; y.rejected += s.rejected;
    });
    return Array.from(map.values()).sort((a, b) => Number(b.year) - Number(a.year));
  }, [stats]);

  const chartData = byYear.slice().reverse().map((y) => ({ name: y.year, 'عدد اللجان': y.committees.length, 'عدد الطلبات': y.total }));

  return (
    <>
      <div>
        <h2 className="text-xl font-black text-slate-900 text-right">عدد اللجان لكل سنة</h2>
        <p className="text-xs text-slate-500 mt-1 text-right">عدد اللجان وإجمالي الطلبات ومتوسط الطلبات في اللجنة لكل سنة.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={CalendarRange} label="عدد السنوات" value={byYear.length} tone="neutral" />
        <KpiCard icon={Layers} label="إجمالي اللجان" value={stats.length} tone="amber" />
        <KpiCard icon={Users} label="إجمالي الطلبات" value={stats.reduce((a, s) => a + s.total, 0)} tone="amber" />
        <KpiCard icon={Gauge} label="المتوسط العام / لجنة"
          value={(stats.length ? stats.reduce((a, s) => a + s.total, 0) / stats.length : 0).toFixed(1)} tone="gray" />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 28, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="عدد اللجان" fill="#eab308" radius={[6, 6, 0, 0]}><LabelList dataKey="عدد اللجان" content={valueLabel('top', '#a16207', 13)} /></Bar>
              <Bar dataKey="عدد الطلبات" fill="#171717" radius={[6, 6, 0, 0]}><LabelList dataKey="عدد الطلبات" content={valueLabel('top', '#171717', 13)} /></Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        <TableScrollWrapper>
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-50 text-slate-500 font-black">
              <tr>
                <th className="px-3 py-2.5">السنة</th>
                <th className="px-3 py-2.5">عدد اللجان</th>
                <th className="px-3 py-2.5">إجمالي الطلبات</th>
                <th className="px-3 py-2.5">متوسط الطلبات / لجنة</th>
                <th className="px-3 py-2.5">Accepted</th>
                <th className="px-3 py-2.5">Rejected</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {byYear.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400 font-bold">لا توجد لجان</td></tr>
              )}
              {byYear.map((y) => (
                <React.Fragment key={y.year}>
                  <tr className="border-t border-slate-100 hover:bg-amber-50/40">
                    <td className="px-3 py-2.5 font-black font-mono text-slate-800">{y.year}</td>
                    <td className="px-3 py-2.5 font-black">{y.committees.length}</td>
                    <td className="px-3 py-2.5 font-bold">{y.total}</td>
                    <td className="px-3 py-2.5 font-bold">{(y.committees.length ? y.total / y.committees.length : 0).toFixed(1)}</td>
                    <td className="px-3 py-2.5 text-emerald-600 font-bold">{y.accepted}</td>
                    <td className="px-3 py-2.5 text-rose-600 font-bold">{y.rejected}</td>
                    <td className="px-3 py-2.5">
                      <button type="button" onClick={() => setExpandedYear(expandedYear === y.year ? '' : y.year)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 text-[10px] font-black text-slate-600 hover:bg-slate-50 cursor-pointer">
                        {expandedYear === y.year ? 'إخفاء اللجان' : 'عرض اللجان'}
                      </button>
                    </td>
                  </tr>
                  {expandedYear === y.year && (
                    <tr className="bg-slate-50/60">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="flex flex-wrap gap-2 justify-end">
                          {y.committees.map((c) => (
                            <button key={c.key} type="button" onClick={() => onOpenCommittee(c.key)}
                              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-amber-400 text-[11px] font-bold text-slate-700 cursor-pointer">
                              لجنة {c.no} <span className="text-slate-400">({c.total} طلب)</span>
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </TableScrollWrapper>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Popups used by the committee requests table
// ---------------------------------------------------------------------------

const fmtSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function DocumentsPopup({ request, onClose, onOpen }: { request: any; onClose: () => void; onOpen: (a: any) => void }) {
  const docs: any[] = request.attachments || [];
  return (
    <div className="fixed inset-0 z-40 bg-slate-900/60 flex items-center justify-center p-4" onClick={onClose} dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="text-right">
            <h3 className="text-sm font-black text-slate-900">مستندات الطلب ({docs.length})</h3>
            <p className="text-[11px] text-slate-500">{request.memberName} — {request.membershipNumber}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-3 overflow-y-auto space-y-2">
          {docs.map((a, i) => (
            <button key={a.id || i} type="button" onClick={() => onOpen({ ...a, requestId: request.id, membershipNumber: request.membershipNumber, memberName: request.memberName, club: request.club })}
              className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/50 text-right cursor-pointer">
              <span dir="ltr" className="text-[10px] text-slate-400 shrink-0">{a.fileSize ? fmtSize(a.fileSize) : ''}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-bold text-slate-800 truncate">{a.fileName || `مستند ${i + 1}`}</span>
                <span className="block text-[10px] text-slate-500 truncate">{[a.category, a.uploadedAt ? formatDateCustom(a.uploadedAt) : ''].filter(Boolean).join(' • ')}</span>
              </span>
              <FileText className="w-5 h-5 text-amber-500 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function RejectionPopup({ request, onClose }: { request: any; onClose: () => void }) {
  const reason = getRejectionReason(request);
  return (
    <div className="fixed inset-0 z-40 bg-slate-900/60 flex items-center justify-center p-4" onClick={onClose} dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 text-rose-700">
          <MessageSquareWarning className="w-5 h-5" />
          <h3 className="text-sm font-black">سبب رفض الطلب</h3>
        </div>
        <div className="text-[11px] text-slate-500">{request.memberName} — {request.membershipNumber}</div>
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-3.5 text-xs font-bold text-slate-800 leading-relaxed whitespace-pre-wrap min-h-[48px]">
          {reason || <span className="text-slate-400 font-normal italic">لم يتم تسجيل سبب محدد للرفض بعد.</span>}
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer">إغلاق</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// View 3: Single committee requests (pick any committee + filters)
// ---------------------------------------------------------------------------

function CommitteeView({ requests, committees, dropdowns, selectedCommittee, onSelectCommittee, onExportExcel }: Props) {
  const [search, setSearch] = useState('');
  const [result, setResult] = useState('');
  const [duration, setDuration] = useState('');
  const [clubs, setClubs] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [docsTarget, setDocsTarget] = useState<any | null>(null);
  const [rejectionTarget, setRejectionTarget] = useState<any | null>(null);
  const [viewerAttachment, setViewerAttachment] = useState<any | null>(null);

  const allStats = useMemo(() => buildCommitteeStats(requests, committees), [requests, committees]);
  const clubOptions: string[] = dropdowns?.clubs || [];

  const committeeRequests = useMemo(() => {
    if (!selectedCommittee) return [];
    return requests.filter((r) => r.committeeNo && committeeKey(r.committeeNo, getYear(r)) === selectedCommittee);
  }, [requests, selectedCommittee]);

  const statusOptions = useMemo(() => buildStatusOptions(committeeRequests), [committeeRequests]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return committeeRequests.filter((r) => {
      if (q) {
        const hay = [r.memberName, r.membershipNumber, r.nationalId, r.externalId, r.mobileNumber].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (clubs.length && !clubs.some((c) => isSameClub(c, r.club))) return false;
      if (result && getResultKey(r) !== result) return false;
      if (duration && getDurationKey(r) !== duration) return false;
      if (statuses.length && !statuses.includes(getDetailedStatus(r))) return false;
      if (startDate && (r.requestDate || '') < startDate) return false;
      if (endDate && (r.requestDate || '') > endDate) return false;
      return true;
    });
  }, [committeeRequests, search, clubs, result, duration, statuses, startDate, endDate]);

  const counts = useMemo(() => {
    const t = { accepted: 0, rejected: 0, pending: 0, lt1m: 0, m1to3: 0, gt3m: 0 };
    filtered.forEach((r) => {
      t[getResultKey(r)]++;
      const d = getDurationKey(r);
      if (d === 'lt1m') t.lt1m++; else if (d === '1to3m') t.m1to3++; else t.gt3m++;
    });
    return t;
  }, [filtered]);

  const reset = () => { setSearch(''); setResult(''); setDuration(''); setClubs([]); setStatuses([]); setStartDate(''); setEndDate(''); };

  const fmtMoney = (v: any) => (typeof v === 'number' ? v.toLocaleString('en-US') : v || '—');

  return (
    <>
      <div>
        <h2 className="text-xl font-black text-slate-900 text-right">طلبات اللجنة</h2>
        <p className="text-xs text-slate-500 mt-1 text-right">اختر أي لجنة لعرض طلباتها وتصفيتها.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-2">
            <label className={labelCls}>اختر اللجنة</label>
            <select className={selectCls} value={selectedCommittee} onChange={(e) => { onSelectCommittee(e.target.value); reset(); }}>
              <option value="">— اختر لجنة —</option>
              {allStats.map((s) => (
                <option key={s.key} value={s.key}>{committeeLabel(s.key)} — {s.total} طلب</option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className={labelCls}>بحث (الاسم / رقم العضوية / الرقم القومي)</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input className={`${inputCls} pr-9`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث..." disabled={!selectedCommittee} />
            </div>
          </div>
          <div>
            <label className={labelCls}>النادي</label>
            <MultiSelect options={clubOptions} selected={clubs} onChange={setClubs} placeholder="كل الأندية" />
          </div>
          <div>
            <label className={labelCls}>النتيجة</label>
            <select className={selectCls} value={result} onChange={(e) => setResult(e.target.value)}>
              <option value="">الكل</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>مدة الاشتراك</label>
            <select className={selectCls} value={duration} onChange={(e) => setDuration(e.target.value)}>
              <option value="">الكل</option>
              <option value="lt1m">{DURATION_LABELS.lt1m}</option>
              <option value="1to3m">{DURATION_LABELS['1to3m']}</option>
              <option value="gt3m">{DURATION_LABELS.gt3m}</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>الحالة</label>
            <MultiSelect options={statusOptions} selected={statuses} onChange={setStatuses} placeholder="كل الحالات" groups={[{ label: 'كل الـ Pending', values: statusOptions.filter((o) => o.startsWith('Pending')) }]} wide />
          </div>
          <div>
            <label className={labelCls}>تاريخ الطلب من</label>
            <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>تاريخ الطلب إلى</label>
            <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-between gap-2">
          <button type="button" onClick={() => onExportExcel?.(filtered)} disabled={!filtered.length}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-900 text-amber-400 text-xs font-bold hover:bg-neutral-800 disabled:opacity-40 cursor-pointer">
            <Download className="w-3.5 h-3.5" /> تصدير Excel
          </button>
          <button type="button" onClick={reset}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">
            <FilterX className="w-3.5 h-3.5" /> مسح الفلاتر
          </button>
        </div>
      </div>

      {!selectedCommittee ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-400 font-bold text-sm">
          اختر لجنة من القائمة لعرض طلباتها
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <KpiCard icon={Users} label="الطلبات" value={filtered.length} tone="amber" hint={`من ${committeeRequests.length}`} />
            <KpiCard icon={CheckCircle2} label="Accepted" value={counts.accepted} tone="green" />
            <KpiCard icon={XCircle} label="Rejected" value={counts.rejected} tone="red" />
            <KpiCard icon={Clock} label={DURATION_LABELS.lt1m} value={counts.lt1m} tone="gray" />
            <KpiCard icon={Clock} label={DURATION_LABELS['1to3m']} value={counts.m1to3} tone="gray" />
            <KpiCard icon={Clock} label={DURATION_LABELS.gt3m} value={counts.gt3m} tone="neutral" />
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 text-right">
              <h3 className="text-sm font-black text-slate-800">{committeeLabel(selectedCommittee)}</h3>
            </div>
            <TableScrollWrapper>
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 text-slate-500 font-black">
                  <tr>
                    <th className="px-3 py-2.5">#</th>
                    <th className="px-3 py-2.5">رقم العضوية</th>
                    <th className="px-3 py-2.5">اسم العضو</th>
                    <th className="px-3 py-2.5">النادي</th>
                    <th className="px-3 py-2.5">تاريخ الاشتراك</th>
                    <th className="px-3 py-2.5">تاريخ الطلب</th>
                    <th className="px-3 py-2.5">المدة (يوم)</th>
                    <th className="px-3 py-2.5">التصنيف</th>
                    <th className="px-3 py-2.5">سبب الإلغاء</th>
                    <th className="px-3 py-2.5">مبلغ الاسترداد</th>
                    <th className="px-3 py-2.5">النتيجة</th>
                    <th className="px-3 py-2.5">الحالة</th>
                    <th className="px-3 py-2.5">المستندات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={13} className="px-3 py-8 text-center text-slate-400 font-bold">لا توجد طلبات مطابقة</td></tr>
                  )}
                  {filtered.map((r, i) => (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-amber-50/40">
                      <td className="px-3 py-2.5 text-slate-400 font-mono">{i + 1}</td>
                      <td className="px-3 py-2.5 font-mono">{r.membershipNumber}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-800">{r.memberName}</td>
                      <td className="px-3 py-2.5">{r.club}</td>
                      <td className="px-3 py-2.5 font-mono">{r.subscriptionDate ? formatDateCustom(r.subscriptionDate) : '—'}</td>
                      <td className="px-3 py-2.5 font-mono">{r.requestDate ? formatDateCustom(r.requestDate) : '—'}</td>
                      <td className="px-3 py-2.5 font-mono">{r.days ?? '—'}</td>
                      <td className="px-3 py-2.5">{DURATION_LABELS[getDurationKey(r)]}</td>
                      <td className="px-3 py-2.5">{r.cancellationReason || '—'}</td>
                      <td className="px-3 py-2.5 font-mono">{fmtMoney(r.refundAmount)}</td>
                      <td className="px-3 py-2.5">
                        {getResultKey(r) === 'rejected' ? (
                          <button type="button" onClick={() => setRejectionTarget(r)} title="اضغط لعرض سبب الرفض"
                            className="px-2 py-0.5 rounded-md border bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 text-[10px] font-black cursor-pointer underline decoration-dotted">
                            Rejected
                          </button>
                        ) : <ResultBadge r={r} />}
                      </td>
                      <td className="px-3 py-2.5 font-bold text-slate-700 whitespace-nowrap">{getDetailedStatus(r)}</td>
                      <td className="px-3 py-2.5">
                        {(r.attachments || []).length === 0 ? <span className="text-slate-300">—</span> : (
                          <button type="button" onClick={() => setDocsTarget(r)} title="عرض كل المستندات"
                            className="inline-flex items-center gap-1.5 max-w-[190px] px-2 py-1 rounded-lg border border-slate-200 hover:border-amber-300 hover:bg-amber-50 text-[11px] font-bold text-slate-700 cursor-pointer">
                            <Paperclip className="w-3 h-3 text-amber-500 shrink-0" />
                            <span className="truncate">{r.attachments[0].fileName || 'مستند 1'}</span>
                            {r.attachments.length > 1 && <span dir="ltr" className="bg-amber-400 text-neutral-950 text-[9px] font-black rounded px-1 shrink-0">+{r.attachments.length - 1}</span>}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScrollWrapper>
          </div>
        </>
      )}

      {docsTarget && <DocumentsPopup request={docsTarget} onClose={() => setDocsTarget(null)} onOpen={(a) => setViewerAttachment(a)} />}
      {rejectionTarget && <RejectionPopup request={rejectionTarget} onClose={() => setRejectionTarget(null)} />}
      {viewerAttachment && <DocumentViewerModal attachment={viewerAttachment} onClose={() => setViewerAttachment(null)} canDelete={false} />}
    </>
  );
}
