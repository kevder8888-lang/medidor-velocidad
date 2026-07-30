"use client";

import { useMemo } from "react";

export type AppSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type Props = {
  id?: string;
  value: string;
  options: AppSelectOption[];
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  onChange: (value: string) => void;
};

/**
 * Select nativo de Android/iOS (lista del sistema) + texto cerrado
 * con la misma tipografía de la app.
 *
 * Técnica: capa visual con la letra de la app; el <select> va encima
 * transparente y abre el picker nativo del SO.
 */
export function AppSelect({
  id,
  value,
  options,
  disabled,
  className,
  onChange,
  "aria-label": ariaLabel,
}: Props) {
  const label = useMemo(() => {
    const hit = options.find((o) => o.value === value);
    return hit?.label ?? value ?? "—";
  }, [options, value]);

  return (
    <div
      className={`app-select ${disabled ? "is-disabled" : ""} ${className ?? ""}`}
    >
      <span className="app-select-text" aria-hidden>
        {label}
      </span>
      <span className="app-select-chevron" aria-hidden>
        ▾
      </span>
      <select
        id={id}
        className="app-select-native"
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
