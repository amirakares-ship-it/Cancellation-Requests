import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import {
  Layers, Users, CheckCircle2, XCircle, Clock, Gauge, FilterX, Search, Download, Eye, CalendarRange
} from 'lucide-react';
import { formatCommitteeYear, formatDateCustom, isSameClub } from '../utils';
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

const getYear = (r: any): string =>
  formatCommitteeYear(r.committeeYear || r.approvalDate || r.requestDate || r.createdAt);

const committeeKey = (no: any, year: any) => `${String(no).trim()}|${year}`;

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
        key, no: String(no).trim(), year, total: 0, accepted: 0, rejected: 0, pending: 0, lt1m: 0, m1to3: 0, gt3m: 0,
      });
    }
    return map.get(key)!;
  };

  // Committees that exist in the system even if they have no requests yet
  knownCommittees.forEach((c) => {
    if (c?.number === undefined || c?.number === null || c?.number === '') return;
    ensure(c.number, formatCommitteeYear(c.year || c.approvalDate));
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

const KpiCard = ({ icon: Icon, label, value, tone = 'neutral', hint }: {
  icon: any; label: string; value: React.ReactNode; tone?: 'neutral' | 'amber' | 'green' | 'red' | 'gray'; hint?: string;
}) => {
  const tones: Record<string, string> = {
    neutral: 'bg-neutral-900 text-amber-400',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-rose-50 text-rose-600',
    gray: 'bg-slate-100 text-slate-500',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tones[tone]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 text-right">
        <p className="text-[11px] font-bold text-slate-500 truncate">{label}</p>
        <p className="text-2xl font-black text-slate-900 leading-tight">{value}</p>
        {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
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
  return (
    <div className="space-y-6">
      {view === 'overview' && <OverviewView {...props} />}
      {view === 'years' && <YearsView {...props} />}
      {view === 'committee' && <CommitteeView {...props} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// View 1: Dashboard (overview with filters)
// ---------------------------------------------------------------------------

function OverviewView({ requests, committees, dropdowns, onOpenCommittee }: Props) {
  const [years, setYears] = useState<string[]>([]);
  const [committeeKeys, setCommitteeKeys] = useState<string[]>([]);
  const [clubs, setClubs] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [result, setResult] = useState('');
  const [duration, setDuration] = useState('');

  const allStats = useMemo(() => buildCommitteeStats(requests, committees), [requests, committees]);
  const yearOptions = useMemo(
    () => Array.from(new Set(allStats.map((s) => s.year))).sort((a, b) => Number(b) - Number(a)),
    [allStats]
  );
  const committeeOptions = useMemo(
    () => allStats
      .filter((s) => years.length === 0 || years.includes(s.year))
      .map((s) => ({ label: committeeLabel(s.key), value: s.key })),
    [allStats, years]
  );
  const clubOptions: string[] = dropdowns?.clubs || [];

  const filtered = useMemo(() => requests.filter((r) => {
    if (!r.committeeNo || r.committeeNo === '—') return false;
    const key = committeeKey(r.committeeNo, getYear(r));
    if (years.length && !years.includes(getYear(r))) return false;
    if (committeeKeys.length && !committeeKeys.includes(key)) return false;
    if (clubs.length && !clubs.some((c) => isSameClub(c, r.club))) return false;
    if (startDate && (r.requestDate || '') < startDate) return false;
    if (endDate && (r.requestDate || '') > endDate) return false;
    if (result && getResultKey(r) !== result) return false;
    if (duration && getDurationKey(r) !== duration) return false;
    return true;
  }), [requests, years, committeeKeys, clubs, startDate, endDate, result, duration]);

  // Per-committee stats, computed from the filtered requests. Committees with
  // no matching requests are dropped when any filter is active.
  const anyFilter = !!(years.length || committeeKeys.length || clubs.length || startDate || endDate || result || duration);
  const stats = useMemo(() => {
    const s = buildCommitteeStats(filtered, anyFilter ? [] : committees);
    return s.filter((x) => (years.length === 0 || years.includes(x.year)) && (committeeKeys.length === 0 || committeeKeys.includes(x.key)));
  }, [filtered, committees, anyFilter, years, committeeKeys]);

  const totals = useMemo(() => {
    const t = { total: filtered.length, accepted: 0, rejected: 0, pending: 0, lt1m: 0, m1to3: 0, gt3m: 0 };
    filtered.forEach((r) => {
      t[getResultKey(r)]++;
      const d = getDurationKey(r);
      if (d === 'lt1m') t.lt1m++; else if (d === '1to3m') t.m1to3++; else t.gt3m++;
    });
    return t;
  }, [filtered]);

  const committeeCount = stats.length;
  const average = committeeCount ? totals.total / committeeCount : 0;

  const reset = () => {
    setYears([]); setCommitteeKeys([]); setClubs([]); setStartDate(''); setEndDate(''); setResult(''); setDuration('');
  };

  const barData = stats.slice().reverse().map((s) => ({
    name: `${s.no} (${s.year})`, key: s.key, Accepted: s.accepted, Rejected: s.rejected, Pending: s.pending,
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

  return (
    <>
      <div>
        <h2 className="text-xl font-black text-slate-900 text-right">لوحة رئيس القطاع</h2>
        <p className="text-xs text-slate-500 mt-1 text-right">نظرة عامة على اللجان وطلبات الإلغاء، مع إمكانية التصفية والدخول لأي لجنة.</p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className={labelCls}>سنة اللجنة</label>
            <MultiSelect options={yearOptions} selected={years} onChange={(v) => { setYears(v); setCommitteeKeys([]); }} placeholder="كل السنوات" />
          </div>
          <div>
            <label className={labelCls}>اللجنة</label>
            <MultiSelect options={committeeOptions} selected={committeeKeys} onChange={setCommitteeKeys} placeholder="كل اللجان" />
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
            <label className={labelCls}>تاريخ الطلب من</label>
            <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>تاريخ الطلب إلى</label>
            <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button type="button" onClick={reset}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">
              <FilterX className="w-3.5 h-3.5" /> مسح الفلاتر
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard icon={Layers} label="عدد اللجان" value={committeeCount} tone="neutral" />
        <KpiCard icon={Users} label="إجمالي الطلبات" value={totals.total} tone="amber" />
        <KpiCard icon={Gauge} label="متوسط الطلبات / لجنة" value={average.toFixed(1)} tone="amber" />
        <KpiCard icon={CheckCircle2} label="Accepted" value={totals.accepted} tone="green" />
        <KpiCard icon={XCircle} label="Rejected" value={totals.rejected} tone="red" />
        <KpiCard icon={Clock} label="Pending" value={totals.pending} tone="gray" />
      </div>

      {/* Duration cards + pies */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <h3 className="text-sm font-black text-slate-800 text-right mb-3">التصنيف بمدة الاشتراك</h3>
          <div className="grid grid-cols-3 gap-2 mb-2">
            {(['lt1m', '1to3m', 'gt3m'] as DurationKey[]).map((k) => {
              const v = k === 'lt1m' ? totals.lt1m : k === '1to3m' ? totals.m1to3 : totals.gt3m;
              return (
                <div key={k} className="rounded-xl border border-slate-200 p-2 text-center">
                  <p className="text-[10px] font-bold text-slate-500 leading-tight">{DURATION_LABELS[k]}</p>
                  <p className="text-xl font-black" style={{ color: k === 'gt3m' ? '#171717' : DURATION_COLORS[k] }}>{v}</p>
                </div>
              );
            })}
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={durationPie} dataKey="value" nameKey="name" innerRadius={40} outerRadius={65} paddingAngle={2}>
                  {durationPie.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-400 text-center">
            إجمالي ≤ 3 شهور: {totals.lt1m + totals.m1to3} • أكثر من 3 شهور: {totals.gt3m}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <h3 className="text-sm font-black text-slate-800 text-right mb-3">Accepted / Rejected</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={resultPie} dataKey="value" nameKey="name" outerRadius={75} label>
                  {resultPie.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <h3 className="text-sm font-black text-slate-800 text-right mb-3">عدد الطلبات بكل لجنة</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Accepted" stackId="a" fill={RESULT_COLORS.accepted} />
                <Bar dataKey="Rejected" stackId="a" fill={RESULT_COLORS.rejected} />
                <Bar dataKey="Pending" stackId="a" fill={RESULT_COLORS.pending} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Committees table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">اضغط "عرض الطلبات" لفتح أي لجنة</p>
          <h3 className="text-sm font-black text-slate-800">تفاصيل اللجان</h3>
        </div>
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
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="عدد اللجان" fill="#eab308" radius={[6, 6, 0, 0]} />
              <Bar dataKey="عدد الطلبات" fill="#171717" radius={[6, 6, 0, 0]} />
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
// View 3: Single committee requests (pick any committee + filters)
// ---------------------------------------------------------------------------

function CommitteeView({ requests, committees, dropdowns, selectedCommittee, onSelectCommittee, onExportExcel }: Props) {
  const [search, setSearch] = useState('');
  const [result, setResult] = useState('');
  const [duration, setDuration] = useState('');
  const [clubs, setClubs] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const allStats = useMemo(() => buildCommitteeStats(requests, committees), [requests, committees]);
  const clubOptions: string[] = dropdowns?.clubs || [];

  const committeeRequests = useMemo(() => {
    if (!selectedCommittee) return [];
    return requests.filter((r) => r.committeeNo && committeeKey(r.committeeNo, getYear(r)) === selectedCommittee);
  }, [requests, selectedCommittee]);

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
      if (startDate && (r.requestDate || '') < startDate) return false;
      if (endDate && (r.requestDate || '') > endDate) return false;
      return true;
    });
  }, [committeeRequests, search, clubs, result, duration, startDate, endDate]);

  const counts = useMemo(() => {
    const t = { accepted: 0, rejected: 0, pending: 0, lt1m: 0, m1to3: 0, gt3m: 0 };
    filtered.forEach((r) => {
      t[getResultKey(r)]++;
      const d = getDurationKey(r);
      if (d === 'lt1m') t.lt1m++; else if (d === '1to3m') t.m1to3++; else t.gt3m++;
    });
    return t;
  }, [filtered]);

  const reset = () => { setSearch(''); setResult(''); setDuration(''); setClubs([]); setStartDate(''); setEndDate(''); };

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
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={11} className="px-3 py-8 text-center text-slate-400 font-bold">لا توجد طلبات مطابقة</td></tr>
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
                      <td className="px-3 py-2.5"><ResultBadge r={r} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScrollWrapper>
          </div>
        </>
      )}
    </>
  );
}
