"use client";

import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type InputHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { useSiteLanguage } from '../i18n/locale-provider';
import { parseCalendarDate as parse, calendarDateKey as iso, calendarDateValidity } from '../lib/modern-date-model';
import "./modern-date-input.css";

function monthDays(month: Date) { return new Date(month.getFullYear(), month.getMonth()+1, 0).getDate(); }

export type ModernDateInputProps = InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; labelClassName?: string; openRequest?: number };
export function ModernDateInput({ value, defaultValue, onChange, name, min, max, required, disabled, id, className, label, labelClassName, openRequest = 0, ...props }: ModernDateInputProps) {
  const { language } = useSiteLanguage();
  const locale = { he: 'he-IL', en: 'en-GB', ru: 'ru-RU', fr: 'fr-FR' }[language];
  const labels = { he: ['בחירת תאריך', 'החודש הקודם', 'החודש הבא', 'ניקוי', 'סגירה', 'בחרו תאריך תקין בטווח המותר'], en: ['Choose a date', 'Previous month', 'Next month', 'Clear', 'Close', 'Enter a valid date in the allowed range'], ru: ['Выбрать дату', 'Предыдущий месяц', 'Следующий месяц', 'Очистить', 'Закрыть', 'Укажите верную дату в допустимом диапазоне'], fr: ['Choisir une date', 'Mois précédent', 'Mois suivant', 'Effacer', 'Fermer', 'Choisissez une date dans la période autorisée'] }[language];
  const popupId = useId();
  const fieldId = id || `${popupId}-field`;
  const lower = typeof min === 'string' ? min : undefined;
  const upper = typeof max === 'string' ? max : undefined;
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue || "");
  const current = String(controlled ? value ?? "" : inner);
  const [open, setOpen] = useState(false);
  const selected = parse(current) || parse(lower || "") || new Date();
  const [month, setMonth] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1));
  const days = useMemo(() => { const first = new Date(month.getFullYear(), month.getMonth(), 1).getDay(); return [...Array(first).fill(null), ...Array.from({ length: monthDays(month) }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))]; }, [month]);
  const fieldRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const suppressFocusOpen = useRef(false);
  const close = () => { setOpen(false); suppressFocusOpen.current = true; fieldRef.current?.focus(); };
  useEffect(() => { fieldRef.current?.setCustomValidity(calendarDateValidity(current, lower, upper) === 'valid' ? '' : labels[5]); }, [current, lower, upper, language]);
  useEffect(() => { const form = fieldRef.current?.form; const reset = () => { if (!controlled) setInner(defaultValue || ''); setOpen(false); }; form?.addEventListener('reset', reset); return () => form?.removeEventListener('reset', reset); }, [controlled, defaultValue]);
  useEffect(() => { if (!open) return; const outside = (event: PointerEvent) => { if (!containerRef.current?.contains(event.target as Node)) setOpen(false); }; document.addEventListener('pointerdown', outside); return () => document.removeEventListener('pointerdown', outside); }, [open]);
  const choose = (next: string, event: MouseEvent<HTMLButtonElement>) => {
    // Clearing is an intentional form action and must not be rejected by the
    // date-range validator. A cleared required field remains invalid until the
    // visitor picks a valid date, while optional fields become genuinely empty.
    if (next !== "" && calendarDateValidity(next, lower, upper) !== 'valid') return;
    if (!fieldRef.current) return;
    fieldRef.current.value = next;
    if (!controlled) setInner(next);
    onChange?.({ ...event, type: 'change', target: fieldRef.current, currentTarget: fieldRef.current } as unknown as ChangeEvent<HTMLInputElement>);
    close();
  };
  const show = () => { if (disabled || props.readOnly) return; const date = parse(current) || parse(lower || '') || parse(upper || '') || new Date(); setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); setOpen(true); };
  useEffect(() => { if (openRequest > 0 && !disabled && !props.readOnly) { show(); fieldRef.current?.focus(); } }, [openRequest]);
  return <div ref={containerRef} className={`modern-date-input ${className || ""} ${labelClassName || ''}`} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={event => { if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(); } }}>
    {label ? <label htmlFor={fieldId}>{label}</label> : null}
    <div className="modern-date-input__control"><input {...props} ref={fieldRef} type="text" id={fieldId} className={`modern-date-input__field ${className || ""}`} name={name} value={current} placeholder={props.placeholder || labels[0]} dir="ltr" inputMode="numeric" pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}" required={required} disabled={disabled} aria-controls={popupId} aria-expanded={open} onChange={event => { const next = event.target.value; if (!controlled) setInner(next); onChange?.(event); }} onFocus={event => { props.onFocus?.(event); if (suppressFocusOpen.current) suppressFocusOpen.current = false; else show(); }} />
    <button type="button" className="modern-date-input__toggle" aria-label={labels[0]} aria-haspopup="dialog" aria-expanded={open} disabled={disabled || props.readOnly} onClick={() => open ? close() : show()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v4m10-4v4M4 10h16M5 5h14v15H4V5Z" /></svg></button></div>
    {open ? <div id={popupId} className="modern-date-input__popup" role="dialog" aria-label={labels[0]} dir={language === 'he' ? 'rtl' : 'ltr'}>
      <div className="modern-date-input__nav"><button type="button" aria-label={labels[1]} disabled={!!lower && iso(month).slice(0, 7) <= lower.slice(0, 7)} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()-1, 1))}>‹</button><strong>{month.toLocaleDateString(locale, { month: "long", year: "numeric" })}</strong><button type="button" aria-label={labels[2]} disabled={!!upper && iso(month).slice(0, 7) >= upper.slice(0, 7)} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()+1, 1))}>›</button></div>
      <div className="modern-date-input__weekdays" aria-hidden="true">{Array.from({length:7}, (_, i) => <span key={i}>{new Date(2026, 10, i + 1).toLocaleDateString(locale, {weekday:'narrow'})}</span>)}</div>
      <div className="modern-date-input__grid">{days.map((day, index) => day ? (() => { const key = iso(day); const blocked = calendarDateValidity(key, lower, upper) !== 'valid'; return <button type="button" key={key} disabled={blocked} aria-pressed={key === current} aria-label={day.toLocaleDateString(locale, {day:'numeric',month:'long',year:'numeric'})} onClick={event => choose(key, event)}>{day.getDate()}</button>; })() : <span key={`blank-${index}`} aria-hidden="true" />)}</div>
      <footer><button type="button" onClick={event => choose('', event)}>{labels[3]}</button><button type="button" onClick={close}>{labels[4]}</button></footer>
    </div> : null}
  </div>;
}
