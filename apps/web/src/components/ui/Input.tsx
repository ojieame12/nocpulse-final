'use client';

interface InputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  className?: string;
}

export function Input({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  className,
}: InputProps) {
  return (
    <div className={`input-group${className ? ` ${className}` : ''}`}>
      {label && <label className="input-group__label">{label}</label>}
      <div className="input-group__field">
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
