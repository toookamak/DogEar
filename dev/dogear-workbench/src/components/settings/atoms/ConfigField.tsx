interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
}

export default function ConfigField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  hint,
}: Props) {
  return (
    <label className="config-field">
      <span className="config-label">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <span className="config-hint">{hint}</span>}
    </label>
  );
}