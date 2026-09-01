interface Props {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "mint" | "red";
}

export default function StatCard({ label, value, sub, tone = "default" }: Props) {
  return (
    <div className={`stat-card${tone === "mint" ? " stat-mint" : ""}${tone === "red" ? " stat-red" : ""}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}