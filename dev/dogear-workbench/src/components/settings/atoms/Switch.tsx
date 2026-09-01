interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export default function Switch({ checked, onChange, label }: Props) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch-track" aria-hidden="true" />
      {label && <span className="switch-label">{label}</span>}
    </label>
  );
}