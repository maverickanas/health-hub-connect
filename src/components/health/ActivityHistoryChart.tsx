import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Flame, Footprints, MapPin, Loader2 } from 'lucide-react';

type TimeRange = 'week' | 'month';
type Metric = 'steps' | 'calories' | 'distance';

interface HistoryEntry {
  date: string;
  label: string;
  steps: number;
  calories: number;
  distance: number;
}

interface ActivityHistoryChartProps {
  userId?: string;
}

const METRIC_CONFIG: Record<Metric, { label: string; icon: React.ElementType; color: string; unit: string }> = {
  steps: { label: 'Steps', icon: Footprints, color: '#CCFF00', unit: '' },
  calories: { label: 'Calories', icon: Flame, color: '#f97316', unit: 'kcal' },
  distance: { label: 'Distance', icon: MapPin, color: '#3b82f6', unit: 'km' },
};

const ActivityHistoryChart: React.FC<ActivityHistoryChartProps> = ({ userId }) => {
  const [range, setRange] = useState<TimeRange>('week');
  const [metric, setMetric] = useState<Metric>('steps');
  const [data, setData] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const fetchHistory = async () => {
      setLoading(true);
      const now = new Date();
      const days = range === 'week' ? 7 : 30;
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days + 1);

      const { data: rows } = await supabase
        .from('activity_data')
        .select('date, steps, calories, distance')
        .eq('user_id', userId)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

      // Fill in missing days
      const map = new Map((rows || []).map(r => [r.date, r]));
      const entries: HistoryEntry[] = [];

      for (let i = 0; i < days; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const row = map.get(dateStr);
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const label = range === 'week'
          ? dayNames[d.getDay()]
          : `${d.getMonth() + 1}/${d.getDate()}`;

        entries.push({
          date: dateStr,
          label,
          steps: row?.steps || 0,
          calories: row?.calories || 0,
          distance: Number(row?.distance || 0),
        });
      }

      setData(entries);
      setLoading(false);
    };

    fetchHistory();
  }, [userId, range]);

  const config = METRIC_CONFIG[metric];
  const total = data.reduce((sum, d) => sum + d[metric], 0);
  const avg = data.length ? Math.round(total / data.length) : 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const val = payload[0].value;
    return (
      <div className="glass-panel px-3 py-2 rounded-xl border border-border/50">
        <p className="text-[10px] font-bold text-muted-foreground uppercase">{label}</p>
        <p className="text-sm font-black text-foreground">
          {metric === 'distance' ? val.toFixed(1) : val.toLocaleString()}
          <span className="text-[10px] text-muted-foreground ml-1">{config.unit}</span>
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-[0.2em]">
          Activity Trends
        </h3>
        <div className="flex bg-muted rounded-xl p-0.5">
          {(['week', 'month'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                range === r
                  ? 'bg-luxury-neon text-primary-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {r === 'week' ? '7D' : '30D'}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Toggle */}
      <div className="flex gap-2">
        {(Object.keys(METRIC_CONFIG) as Metric[]).map(m => {
          const cfg = METRIC_CONFIG[m];
          const Icon = cfg.icon;
          const isActive = metric === m;
          return (
            <motion.button
              key={m}
              whileTap={{ scale: 0.95 }}
              onClick={() => setMetric(m)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all border ${
                isActive
                  ? 'border-luxury-neon/30 bg-luxury-neon/10 text-luxury-neon'
                  : 'border-border bg-muted text-muted-foreground'
              }`}
            >
              <Icon size={12} />
              {cfg.label}
            </motion.button>
          );
        })}
      </div>

      {/* Summary */}
      <div className="flex gap-4">
        <div>
          <p className="text-2xl font-black text-foreground">
            {metric === 'distance' ? total.toFixed(1) : total.toLocaleString()}
          </p>
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
            Total {config.label}
          </p>
        </div>
        <div>
          <p className="text-2xl font-black text-foreground">
            {metric === 'distance' ? avg.toFixed(1) : avg.toLocaleString()}
          </p>
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
            Daily Avg
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="glass-panel rounded-2xl p-4 h-48">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="animate-spin text-luxury-neon" size={24} />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barSize={range === 'week' ? 24 : 8}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                interval={range === 'month' ? 4 : 0}
              />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Bar
                dataKey={metric}
                fill={config.color}
                radius={[4, 4, 0, 0]}
                opacity={0.85}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default ActivityHistoryChart;
