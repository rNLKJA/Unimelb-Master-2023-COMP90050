"use client";

import { useId } from "react";

/** A labelled native range input with its current value shown. */
export function RangeField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v) => String(v),
  disabled,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  disabled?: boolean;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="kicker">
          {label}
        </label>
        <output htmlFor={id} className="text-foreground tabular font-mono text-xs">
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-[var(--mint)] disabled:cursor-not-allowed disabled:opacity-60"
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-muted-foreground mt-1 text-xs">
          {hint}
        </p>
      )}
    </div>
  );
}
