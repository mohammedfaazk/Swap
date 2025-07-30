import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
export function VolumeChart({ data }: { data: any[] }) {
  return (
    <div>
      <h2 className="font-bold text-lg text-slate-100 mb-2">Volume (24h)</h2>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data}>
          <XAxis dataKey="hour" />
          <YAxis />
          <Tooltip />
          <Area type="monotone" dataKey="volume" stroke="#7f5af0" fill="#7f5af0" fillOpacity={0.2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
