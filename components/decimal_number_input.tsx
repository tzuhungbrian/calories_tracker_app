"use client";

import { useEffect, useState } from "react";

type DecimalNumberInputProps = {
  value: number;
  onValueChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
};

const decimalPattern = /^\d*\.?\d*$/;

function formatDraft(value: number): string {
  return Number.isFinite(value) ? String(value) : "0";
}

function parseDraft(value: string): number | null {
  if (!value || value === ".") {
    return null;
  }

  const normalized = value.startsWith(".") ? `0${value}` : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function DecimalNumberInput({ value, onValueChange, className, placeholder, "aria-label": ariaLabel }: DecimalNumberInputProps) {
  const [draft, setDraft] = useState(formatDraft(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(formatDraft(value));
    }
  }, [isFocused, value]);

  return (
    <input
      aria-label={ariaLabel}
      className={className}
      inputMode="decimal"
      min="0"
      placeholder={placeholder}
      type="text"
      value={draft}
      onBlur={() => {
        setIsFocused(false);
        const parsed = parseDraft(draft);
        setDraft(formatDraft(parsed ?? 0));
        onValueChange(parsed ?? 0);
      }}
      onChange={(event) => {
        const nextDraft = event.target.value.replace(",", ".");
        if (!decimalPattern.test(nextDraft)) {
          return;
        }

        setDraft(nextDraft);
        const parsed = parseDraft(nextDraft);
        if (parsed !== null) {
          onValueChange(parsed);
        }
      }}
      onFocus={() => setIsFocused(true)}
    />
  );
}
