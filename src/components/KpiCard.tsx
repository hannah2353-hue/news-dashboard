interface Props {
  title: string;
  value: number | string;
  sub?: string;
  color?: "blue" | "red" | "amber" | "slate" | "green";
}

const COLOR = {
  blue:  "bg-blue-50  border-blue-200  text-blue-700",
  red:   "bg-red-50   border-red-200   text-red-700",
  amber: "bg-amber-50 border-amber-200 text-amber-700",
  slate: "bg-slate-50 border-slate-200 text-slate-700",
  green: "bg-green-50 border-green-200 text-green-700",
};

export default function KpiCard({ title, value, sub, color = "blue" }: Props) {
  return (
    <div className={`rounded-xl border p-5 ${COLOR[color]}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs opacity-60">{sub}</p>}
    </div>
  );
}
