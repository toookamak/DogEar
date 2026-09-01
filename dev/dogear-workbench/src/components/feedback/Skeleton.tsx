export default function Skeleton() {
  return (
    <div className="card-grid">
      {Array.from({ length: 8 }).map((_, i) => (
        <div className="skel-card" key={i}>
          <div className="skel-cover" />
          <div className="skel-preview" />
          <div className="skel-line w70" />
          <div className="skel-line" />
          <div className="skel-line" />
          <div className="skel-line w40" />
        </div>
      ))}
    </div>
  );
}