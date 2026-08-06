"use client";

import { useEffect, useId, useRef, useState } from "react";

export type ModernSelectOption = {
  value: string;
  label: string;
};

type ModernSelectProps = {
  label: string;
  value?: string;
  defaultValue?: string;
  options: ModernSelectOption[];
  onChange?: (value: string) => void;
  name?: string;
  className?: string;
  compact?: boolean;
  disabled?: boolean;
};

export function ModernSelect({
  label,
  value,
  defaultValue,
  options,
  onChange,
  name,
  className = "",
  compact = false,
  disabled = false,
}: ModernSelectProps) {
  const generatedId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue ?? options[0]?.value ?? "");
  const selectedValue = value ?? internalValue;
  const selected = options.find((option) => option.value === selectedValue) ?? options[0];

  useEffect(() => {
    function closeFromOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeFromKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, []);

  function choose(nextValue: string) {
    if (value === undefined) setInternalValue(nextValue);
    onChange?.(nextValue);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`modern-select ${compact ? "modern-select--compact" : ""} ${open ? "is-open" : ""} ${className}`.trim()}>
      <span className="modern-select__label" id={`${generatedId}-label`}>{label}</span>
      {name ? <input type="hidden" name={name} value={selectedValue} /> : null}
      <button
        type="button"
        className="modern-select__trigger"
        aria-labelledby={`${generatedId}-label ${generatedId}-value`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${generatedId}-options`}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <strong id={`${generatedId}-value`}>{selected?.label ?? "בחרו"}</strong>
        <span className="modern-select__chevron" aria-hidden="true" />
      </button>
      {open ? (
        <div className="modern-select__menu" id={`${generatedId}-options`} role="listbox" aria-labelledby={`${generatedId}-label`}>
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === selectedValue}
              className={option.value === selectedValue ? "is-selected" : ""}
              key={option.value}
              onClick={() => choose(option.value)}
            >
              <span>{option.label}</span>
              {option.value === selectedValue ? <span className="modern-select__check" aria-hidden="true">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
