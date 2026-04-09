import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Clock, Users, Euro, Receipt, Percent } from 'lucide-react';
import { fmt } from '../../../utils/projectCalc';

// ---------------------------------------------------------------------------
// Color constants
// ---------------------------------------------------------------------------

const COLORS = {
  lohn: '#3B82F6',
  stoffe: '#10B981',
  geraete: '#F59E0B',
  nu: '#8B5CF6',
};

const CATEGORY_CONFIG = [
  { key: 'lohn', label: 'Lohn', color: COLORS.lohn, bgLight: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: Users },
  { key: 'stoffe', label: 'Stoffe', color: COLORS.stoffe, bgLight: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: Receipt },
  { key: 'geraete', label: 'Geräte', color: COLORS.geraete, bgLight: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: Euro },
  { key: 'nu', label: 'Nachunternehmer', color: COLORS.nu, bgLight: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', icon: Percent },
];

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      {label && <p className="text-slate-500 font-medium mb-1.5">{label}</p>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.color || entry.payload?.fill }}
          />
          <span className="text-slate-600">{entry.name}:</span>
          <span className="font-semibold text-slate-800 font-mono">
            {fmt.currency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CostBreakdown Component
// ---------------------------------------------------------------------------

export default function CostBreakdown({ summary }) {
  if (!summary) return null;

  const { netto, mwst_amount, brutto, breakdown, total_hours, total_days, ueberschuss } = summary;

  // Pie chart data (VK distribution)
  const pieData = CATEGORY_CONFIG
    .map((cat) => ({
      name: cat.label,
      value: breakdown[cat.key]?.vk || 0,
      color: cat.color,
    }))
    .filter((d) => d.value > 0);

  // Bar chart data (EK vs VK)
  const barData = CATEGORY_CONFIG.map((cat) => ({
    name: cat.label,
    EK: breakdown[cat.key]?.ek || 0,
    VK: breakdown[cat.key]?.vk || 0,
  }));

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* 1. Top Summary Cards                                              */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label="Netto"
          value={fmt.currency(netto)}
          className="border border-slate-200"
        />
        <SummaryCard
          label="MwSt."
          value={fmt.currency(mwst_amount)}
          className="border border-slate-200"
        />
        <SummaryCard
          label="Brutto"
          value={fmt.currency(brutto)}
          className="bg-gradient-to-br from-blue-600 to-blue-700 text-white border-0"
          valueClass="text-white"
          labelClass="text-blue-100"
          highlighted
        />
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 2. Category Breakdown Cards                                       */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CATEGORY_CONFIG.map((cat) => {
          const data = breakdown[cat.key];
          if (!data) return null;
          const Icon = cat.icon;
          const isPositive = data.differenz >= 0;

          return (
            <div
              key={cat.key}
              className={`rounded-2xl border p-5 ${cat.bgLight} ${cat.border} transition-shadow hover:shadow-md`}
            >
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: cat.color + '20' }}
                >
                  <Icon size={16} style={{ color: cat.color }} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${cat.text}`}>{cat.label}</p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Zuschlag {data.zuschlag_pct.toFixed(1).replace('.', ',')} %
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Row label="EK" value={fmt.currency(data.ek)} />
                <Row label="VK" value={fmt.currency(data.vk)} bold />
                <div className="border-t border-slate-200/60 pt-2 mt-2">
                  <Row
                    label="Differenz"
                    value={(isPositive ? '+' : '') + fmt.currency(data.differenz)}
                    valueClass={isPositive ? 'text-emerald-600' : 'text-red-600'}
                    bold
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 3. Profit + Time Cards                                            */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Ueberschuss */}
        <div
          className={`rounded-2xl p-5 border-0 ${
            ueberschuss >= 0
              ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
              : 'bg-gradient-to-br from-red-500 to-red-600'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-white/80" />
            <p className="text-sm font-medium text-white/80">Überschuss</p>
          </div>
          <p className="text-2xl font-bold text-white font-mono">
            {(ueberschuss >= 0 ? '+' : '') + fmt.currency(ueberschuss)}
          </p>
        </div>

        {/* Gesamtstunden */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-slate-400" />
            <p className="text-sm font-medium text-slate-500">Gesamtstunden</p>
          </div>
          <p className="text-2xl font-bold text-slate-800 font-mono">
            {fmt.number(total_hours)} <span className="text-sm font-normal text-slate-400">h</span>
          </p>
        </div>

        {/* Gesamttage */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} className="text-slate-400" />
            <p className="text-sm font-medium text-slate-500">Gesamttage</p>
          </div>
          <p className="text-2xl font-bold text-slate-800 font-mono">
            {fmt.number(total_days)} <span className="text-sm font-normal text-slate-400">Tage</span>
          </p>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 4. Charts                                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart: VK Distribution */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">
            VK-Verteilung nach Kostenart
          </h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span className="text-xs text-slate-600 ml-1">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-sm text-slate-400">
              Keine Daten vorhanden
            </div>
          )}
        </div>

        {/* Bar Chart: EK vs VK */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">
            EK vs. VK Vergleich
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} barGap={4} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#64748B' }}
                axisLine={{ stroke: '#E2E8F0' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748B' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => fmt.currency(v)}
                width={100}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                verticalAlign="bottom"
                iconType="rect"
                iconSize={10}
                formatter={(value) => (
                  <span className="text-xs text-slate-600 ml-1">{value}</span>
                )}
              />
              <Bar dataKey="EK" name="Einkauf (EK)" fill="#94A3B8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="VK" name="Verkauf (VK)" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper sub-components
// ---------------------------------------------------------------------------

function SummaryCard({ label, value, className = '', valueClass = '', labelClass = '', highlighted = false }) {
  return (
    <div className={`rounded-2xl p-5 ${className}`}>
      <p className={`text-sm font-medium mb-1 ${labelClass || 'text-slate-500'}`}>{label}</p>
      <p className={`text-2xl font-bold font-mono ${valueClass || 'text-slate-800'}`}>{value}</p>
    </div>
  );
}

function Row({ label, value, bold = false, valueClass = '' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500">{label}</span>
      <span
        className={`text-sm font-mono ${bold ? 'font-semibold' : ''} ${valueClass || 'text-slate-700'}`}
      >
        {value}
      </span>
    </div>
  );
}
