import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type SeverityCount = { severity: string; reports: number };

export function MiniChart({ data, line = false }: { data: SeverityCount[]; line?: boolean }) {
  return <ResponsiveContainer width="100%" height={22}>
    {line
      ? <LineChart data={data}><Line dataKey="reports" stroke="#05d49a" strokeWidth={2} dot={false} /></LineChart>
      : <BarChart data={data}><Bar dataKey="reports" fill="#91a7b0" /></BarChart>}
  </ResponsiveContainer>;
}

export function SeverityChart({ data }: { data: SeverityCount[] }) {
  return <ResponsiveContainer width="100%" height={110}>
    <BarChart data={data}>
      <CartesianGrid stroke="#34343c" vertical={false} />
      <XAxis dataKey="severity" tick={{ fill: "#999", fontSize: 10 }} axisLine={false} tickLine={false} />
      <YAxis allowDecimals={false} tick={{ fill: "#999", fontSize: 9 }} axisLine={false} tickLine={false} />
      <Tooltip contentStyle={{ background: "#25252d", border: "1px solid #444", fontSize: 11 }} />
      <Bar dataKey="reports" fill="#a5b6ff" radius={[3, 3, 0, 0]} />
    </BarChart>
  </ResponsiveContainer>;
}
