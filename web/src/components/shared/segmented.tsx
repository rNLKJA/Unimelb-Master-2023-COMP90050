"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/** A radio group styled as a segmented control (native inputs, so keyboard arrows work). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  className,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  const name = useId();
  return (
    <fieldset className={cn("min-w-0", className)} disabled={disabled}>
      <legend className="kicker mb-1.5">{label}</legend>
      <div className="border-border bg-surface-2 flex flex-wrap gap-1 rounded-lg border p-1">
        {options.map((o) => (
          <label
            key={o.value}
            title={o.hint}
            className={cn(
              "text-muted-foreground hover:text-foreground has-[:focus-visible]:outline-ring relative flex-1 cursor-pointer rounded-md px-2.5 py-1.5 text-center text-sm whitespace-nowrap transition-colors select-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1",
              value === o.value && "bg-surface text-foreground ring-border shadow-sm ring-1",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
