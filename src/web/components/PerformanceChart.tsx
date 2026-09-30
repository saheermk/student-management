import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

export type ChartType = 'bar' | 'line' | 'pie';

export interface ChartSeriesConfig {
  key: string;
  name: string;
  color: string;
}

export interface PerformanceChartProps {
  title: string;
  subtitle?: string;
  data: any[];
  xKey: string;
  series?: ChartSeriesConfig[];
  initialType?: ChartType;
  allowTypeSwitch?: boolean;
  height?: number;
  valueFormatter?: (value: number) => string;
  pieColorKey?: string;
}

const DEFAULT_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export const PerformanceChart: React.FC<PerformanceChartProps> = ({
  title,
  subtitle,
  data,
  xKey,
  series = [{ key: 'value', name: 'Value', color: '#4f46e5' }],
  initialType = 'bar',
  allowTypeSwitch = true,
  height = 320,
  valueFormatter = (val: number) => `${val}`,
  pieColorKey = 'color',
}) => {
  const [chartType, setChartType] = useState<ChartType>(initialType);

  if (!data || data.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 font-medium">{subtitle}</p>}
          </div>
        </div>
        <div className="h-64 flex flex-col justify-center items-center text-slate-400 space-y-2">
          <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-xs font-semibold">No performance data recorded yet</span>
        </div>
      </div>
    );
  }

  // Formatting tooltip values
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/95 text-white text-xs rounded-xl p-3 shadow-xl backdrop-blur-md border border-slate-700/50 space-y-1 z-50">
          <p className="font-bold text-slate-200 border-b border-slate-700 pb-1">{`${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center justify-between space-x-4">
              <span className="flex items-center space-x-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                <span>{entry.name}:</span>
              </span>
              <span className="font-extrabold text-white">{valueFormatter(entry.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 hover:shadow-md transition">
      {/* Chart Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 font-medium">{subtitle}</p>}
        </div>

        {allowTypeSwitch && (
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setChartType('bar')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                chartType === 'bar' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Bar View"
            >
              Bar
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                chartType === 'line' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Line View"
            >
              Line
            </button>
            <button
              onClick={() => setChartType('pie')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                chartType === 'pie' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Pie View"
            >
              Pie
            </button>
          </div>
        )}
      </div>

      {/* Chart Render Area */}
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart data={data} margin={{ top: 10, right: 15, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              {series.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[6, 6, 0, 0]} maxBarSize={40} />
              ))}
            </BarChart>
          ) : chartType === 'line' ? (
            <LineChart data={data} margin={{ top: 10, right: 15, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              {series.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: s.color, strokeWidth: 2, stroke: '#ffffff' }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          ) : (
            <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <Pie
                data={data}
                dataKey={series[0]?.key || 'value'}
                nameKey={xKey}
                cx="50%"
                cy="50%"
                outerRadius={85}
                innerRadius={45}
                paddingAngle={4}
                label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {data.map((entry, idx) => (
                  <Cell
                    key={`cell-${idx}`}
                    fill={entry[pieColorKey] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
