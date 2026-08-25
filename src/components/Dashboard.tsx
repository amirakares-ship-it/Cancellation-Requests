import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { 
  TrendingUp, Users, CheckCircle, XCircle, Clock, Percent, ShieldAlert, Filter, ListCollapse 
} from 'lucide-react';
import { translateStatus, isSameClub, isInternationalRequest, formatCommitteeYear } from '../utils';
import MultiSelect from './MultiSelect';

interface DashboardProps {
  requests: any[];
  dropdowns: any;
  user: any;
  filters: {
    startDate: string;
    endDate: string;
    committeeNo: string | string[];
    club: string | string[];
    year: string | string[];
  };
  setFilters: React.Dispatch<React.SetStateAction<any>>;
  labelNames?: Record<string, string>;
}

const COLORS = ['#eab308', '#ca8a04', '#171717', '#404040', '#737373', '#d97706', '#fbbf24', '#a16207'];

export default function Dashboard({ requests, dropdowns, user, filters, setFilters, labelNames }: DashboardProps) {

  const getLabel = (key: string, fallback: string) => {
    return labelNames?.[key] || fallback;
  };

  // Helper arrays for multi-select
  const selectedClubs = useMemo(() => {
    if (Array.isArray(filters.club)) return filters.club;
    return filters.club ? [filters.club] : [];
  }, [filters.club]);

  const selectedCommittees = useMemo(() => {
    if (Array.isArray(filters.committeeNo)) return filters.committeeNo;
    return filters.committeeNo ? [filters.committeeNo] : [];
  }, [filters.committeeNo]);

  const selectedYears = useMemo(() => {
    if (Array.isArray(filters.year)) return filters.year;
    return filters.year ? [filters.year] : [];
  }, [filters.year]);

  // Process and filter the requests based on filters
  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      // Club & Role filter
      if (user.role === 'club' && !isSameClub(r.club, user.club)) return false;
      if (user.role === 'international_user' && !isInternationalRequest(r)) return false;
      if (selectedClubs.length > 0 && !selectedClubs.some(sc => isSameClub(sc, r.club))) return false;

      // Date range filter
      if (filters.startDate && r.requestDate < filters.startDate) return false;
      if (filters.endDate && r.requestDate > filters.endDate) return false;

      // Committee filter
      if (selectedCommittees.length > 0 && !selectedCommittees.includes(r.committeeNo)) return false;

      // Committee Year filter
      if (selectedYears.length > 0) {
        const yr = formatCommitteeYear(r.committeeYear || r.approvalDate || r.requestDate || (r as any).createdAt);
        if (!selectedYears.includes(yr)) return false;
      }

      return true;
    });
  }, [requests, filters, selectedClubs, selectedCommittees, selectedYears, user]);

  // Status Metrics
  const metrics = useMemo(() => {
    const counts = { Pending: 0, Cancelled: 0, Revoked: 0, Deletion: 0, Rejected: 0 };
    filteredRequests.forEach(r => {
      if (r.status in counts) {
        counts[r.status as keyof typeof counts]++;
      } else {
        counts.Pending++;
      }
    });
    return counts;
  }, [filteredRequests]);

  // 1. Chart Data: Monthly Trends
  const monthlyData = useMemo(() => {
    const monthsArabic = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    
    const monthlyCounts = Array(12).fill(0).map((_, i) => ({
      name: monthsArabic[i],
      'الطلبات المقدمة': 0,
      'تم إلغاؤها': 0
    }));

    filteredRequests.forEach(r => {
      const date = new Date(r.requestDate);
      if (!isNaN(date.getTime())) {
        const month = date.getMonth();
        monthlyCounts[month]['الطلبات المقدمة']++;
        if (r.status === 'Cancelled') {
          monthlyCounts[month]['تم إلغاؤها']++;
        }
      }
    });

    return monthlyCounts;
  }, [filteredRequests]);

  // 2. Chart Data: Requests by Club
  const clubData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredRequests.forEach(r => {
      counts[r.club] = (counts[r.club] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredRequests]);

  // 3. Chart Data: Requests by Payment Method
  const paymentData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredRequests.forEach(r => {
      counts[r.paymentMethod] = (counts[r.paymentMethod] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredRequests]);

  // 4. Chart Data: Requests by Cancellation Reason
  const reasonData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredRequests.forEach(r => {
      counts[r.cancellationReason] = (counts[r.cancellationReason] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6); // Top 6 reasons
  }, [filteredRequests]);

  // Unique committees for filter list
  const uniqueCommittees = useMemo(() => {
    const comms = new Set<string>();
    requests.forEach(r => {
      if (r.committeeNo) comms.add(r.committeeNo);
    });
    return Array.from(comms).sort();
  }, [requests]);

  // Unique committee years for filter list
  const uniqueCommitteeYears = useMemo(() => {
    const years = new Set<string>();
    requests.forEach(r => {
      const yr = r.committeeYear || (r.approvalDate ? formatCommitteeYear(r.approvalDate) : (r.requestYear ? String(r.requestYear) : ''));
      if (yr) years.add(formatCommitteeYear(yr));
    });
    if (years.size === 0) {
      ['2026', '2025', '2024'].forEach(y => years.add(y));
    }
    return Array.from(years).sort().reverse();
  }, [requests]);

  // Reset filters
  const handleResetFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      committeeNo: [],
      club: user.role === 'club' ? [user.club] : [],
      year: []
    });
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Filters Header Card */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 text-slate-800">
            <Filter className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-bold">لوحة المراقبة ومؤشرات الأداء</h2>
          </div>
          <button 
            onClick={handleResetFilters}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg cursor-pointer"
          >
            إعادة تعيين الفلاتر
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {/* Club Filter */}
          {user.role !== 'club' && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">تصفية حسب النادي</label>
              <MultiSelect
                options={dropdowns.clubs}
                selected={selectedClubs}
                onChange={(selected) => setFilters((f: any) => ({ ...f, club: selected }))}
                placeholder="كل الفروع"
              />
            </div>
          )}

          {/* Committee Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{getLabel('committeeNo', 'رقم اللجنة')}</label>
            <MultiSelect
              options={uniqueCommittees.map(num => ({ label: `لجنة ${num}`, value: num }))}
              selected={selectedCommittees}
              onChange={(selected) => setFilters((f: any) => ({ ...f, committeeNo: selected }))}
              placeholder="كل اللجان"
            />
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">من تاريخ الطلب</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((f: any) => ({ ...f, startDate: e.target.value }))}
              className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 text-right font-sans"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">إلى تاريخ الطلب</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((f: any) => ({ ...f, endDate: e.target.value }))}
              className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 text-right font-sans"
            />
          </div>

          {/* Committee Year Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">سنة اللجنة</label>
            <MultiSelect
              options={uniqueCommitteeYears.map(yr => ({ label: `سنة ${yr}`, value: yr }))}
              selected={selectedYears}
              onChange={(selected) => setFilters((f: any) => ({ ...f, year: selected }))}
              placeholder="كل سنوات اللجان"
            />
          </div>
        </div>
      </div>

      {/* Main KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
        {/* Metric Card: Total Requests */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[110px]">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">إجمالي الحالات / Total Requests</p>
          <div className="flex items-end justify-between mt-2">
            <span className="text-2xl font-black text-slate-800 tracking-tight">{filteredRequests.length}</span>
            <span className="text-[10px] text-amber-500 font-bold bg-amber-400/10 px-2 py-1 rounded-full">+12 نشط</span>
          </div>
        </div>

        {/* Metric Card: Pending */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[110px]">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">قيد الانتظار / Pending</p>
          <div className="flex items-end justify-between mt-2">
            <span className="text-2xl font-black text-slate-800 tracking-tight">{metrics.Pending}</span>
            <span className="text-[10px] text-amber-500 font-bold bg-amber-400/10 px-2 py-1 rounded-full">بانتظار القرار</span>
          </div>
        </div>

        {/* Metric Card: Cancelled */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[110px]">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">تم إلغاؤها / Cancelled</p>
          <div className="flex items-end justify-between mt-2">
            <span className="text-2xl font-black text-slate-800 tracking-tight">{metrics.Cancelled}</span>
            <span className="text-[10px] text-amber-500 font-bold bg-amber-400/10 px-2 py-1 rounded-full">اعتماد مالي</span>
          </div>
        </div>

        {/* Metric Card: Revoked */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[110px]">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">تراجع عن الطلب / Revoked</p>
          <div className="flex items-end justify-between mt-2">
            <span className="text-2xl font-black text-slate-800 tracking-tight">{metrics.Revoked}</span>
            <span className="text-[10px] text-sky-500 font-bold bg-sky-50 px-2 py-1 rounded-full">مستمر بالنادي</span>
          </div>
        </div>

        {/* Metric Card: Deletion / Rejected */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between col-span-2 lg:col-span-1 min-h-[110px]">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">شطب / مرفوض / Rejected</p>
          <div className="flex items-end justify-between mt-2">
            <span className="text-xl font-black text-slate-800 tracking-tight">
              {metrics.Deletion} <span className="text-slate-300 font-normal text-xs">/</span> {metrics.Rejected}
            </span>
            <span className="text-[10px] text-rose-500 font-bold bg-rose-50 px-2 py-1 rounded-full">مستبعد</span>
          </div>
        </div>
      </div>

      {/* Charts Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Area Chart: Monthly Trends */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-amber-500" />
            معدل تدفق طلبات الإلغاء شهرياً
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#eab308" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip />
                <Area type="monotone" dataKey="الطلبات المقدمة" stroke="#eab308" strokeWidth={2} fillOpacity={1} fill="url(#colorRequests)" />
                <Area type="monotone" dataKey="تم إلغاؤها" stroke="#171717" strokeWidth={1.5} fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Payment Methods Distribution */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-4">طريقة دفع الاشتراكات</h3>
          {paymentData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-xs">لا يوجد بيانات للرسم</div>
          ) : (
            <div className="h-64 flex flex-col justify-between">
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {paymentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xxs max-h-20 overflow-y-auto pr-1">
                {paymentData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                    <span className="truncate">{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart: Requests by Club */}
        {user.role !== 'club' && (
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 mb-4">حجم إلغاء العضويات حسب فروع النادي</h3>
            {clubData.length === 0 ? (
              <div className="h-60 flex items-center justify-center text-slate-400 text-xs">لا يوجد بيانات للرسم</div>
            ) : (
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={clubData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#ca8a04" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Bar Chart: Top Cancellation Reasons */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm lg:col-span-1">
          <h3 className="text-sm font-bold text-slate-700 mb-4">الأسباب الأكثر شيوعاً لطلب الإلغاء</h3>
          {reasonData.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-slate-400 text-xs">لا يوجد بيانات للرسم</div>
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reasonData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={10} width={100} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#171717" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
