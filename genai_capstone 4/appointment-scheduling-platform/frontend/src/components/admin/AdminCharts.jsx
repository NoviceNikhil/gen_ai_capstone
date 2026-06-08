import React from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";

const chartTooltipStyle = {
  backgroundColor: "rgba(17,24,39,0.92)",
  border: "1px solid rgba(148,163,184,0.35)",
  borderRadius: 10,
  color: "white",
  fontSize: 12,
};

function Wrapper({ title, subtitle, children }) {
  return (
    <Card variant="glass" className="p-6">
      <CardContent className="space-y-4">
        {(title || subtitle) && (
          <div>
            {title && (
              <h3 className="text-sm font-black uppercase tracking-widest text-text-faint">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-text-muted mt-1">{subtitle}</p>
            )}
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

export function AdminPieChart({
  data,
  title,
  subtitle,
  dataKey = "value",
  nameKey = "name",
  height = 280,
  onClickSegment,
}) {
  const safe = Array.isArray(data) ? data : [];
  const total =
    safe.reduce((sum, d) => sum + (Number(d[dataKey]) || 0), 0) || 1;

  return (
    <Wrapper title={title} subtitle={subtitle}>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={safe}
              nameKey={nameKey}
              dataKey={dataKey}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={110}
              labelLine={false}
              label={({ payload }) => {
                const v = Number(payload?.[dataKey]) || 0;
                const pct = (v / total) * 100;
                if (pct < 6) return "";
                return `${payload?.[nameKey] ?? ""}: ${pct.toFixed(0)}%`;
              }}
              onClick={(entry) => onClickSegment?.(entry?.payload)}
            >
              {safe.map((entry, idx) => (
                <Cell
                  key={`${entry[nameKey] ?? idx}-${idx}`}
                  fill={
                    entry.fill ??
                    entry.color ??
                    ["#C4441A", "#3D5A47", "#2563eb", "#10b981", "#94a3b8"][
                      idx % 5
                    ]
                  }
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={chartTooltipStyle}
              formatter={(v) => [`${v}`, "Count"]}
              labelFormatter={(lbl) => lbl}
              cursor={false}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Wrapper>
  );
}

export function AdminLineChart({
  data,
  title,
  subtitle,
  height = 280,
  xKey = "x",
  lines = [{ dataKey: "y", name: "Series" }],
}) {
  const safe = Array.isArray(data) ? data : [];
  return (
    <Wrapper title={title} subtitle={subtitle}>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <LineChart data={safe}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(148,163,184,0.35)"
            />
            <XAxis dataKey={xKey} stroke="rgba(148,163,184,0.9)" />
            <YAxis stroke="rgba(148,163,184,0.9)" />
            <Tooltip contentStyle={chartTooltipStyle} cursor={false} />
            <Legend />
            {lines.map((ln, idx) => (
              <Line
                key={`${ln.dataKey}-${idx}`}
                type="monotone"
                dataKey={ln.dataKey}
                name={ln.name}
                stroke={
                  ln.stroke ??
                  ["#C4441A", "#3D5A47", "#2563eb", "#10b981"][idx % 4]
                }
                strokeWidth={ln.strokeWidth ?? 3}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Wrapper>
  );
}

export function AdminBarChart({
  data,
  title,
  subtitle,
  height = 280,
  xKey = "x",
  bars = [{ dataKey: "y", name: "Series", fill: "#C4441A" }],
  stacked = false,
}) {
  const safe = Array.isArray(data) ? data : [];
  return (
    <Wrapper title={title} subtitle={subtitle}>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <BarChart data={safe}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(148,163,184,0.35)"
            />
            <XAxis dataKey={xKey} stroke="rgba(148,163,184,0.9)" />
            <YAxis stroke="rgba(148,163,184,0.9)" />
            <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: 'transparent' }} />
            <Legend />
            {bars.map((b, idx) => (
              <Bar
                key={`${b.dataKey}-${idx}`}
                dataKey={b.dataKey}
                name={b.name}
                fill={
                  b.fill ??
                  ["#C4441A", "#3D5A47", "#2563eb", "#10b981"][idx % 4]
                }
                radius={[8, 8, 0, 0]}
                stackId={stacked ? "stack" : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Wrapper>
  );
}
