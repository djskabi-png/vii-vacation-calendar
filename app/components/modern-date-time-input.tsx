"use client";

import { useEffect, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from 'react';
import { ModernDateInput, type ModernDateInputProps } from './modern-date-input';
import { useSiteLanguage } from '../i18n/locale-provider';

/** Keep the form's local ISO timestamp. Only the date portion opens a calendar;
 * the separate time field preserves arbitrary existing minute selections. */
export function ModernDateTimeInput({ value, defaultValue, name, onChange, required, disabled, ...props }: ModernDateInputProps) {
  const { language } = useSiteLanguage();
  const controlled = value !== undefined;
  const initial = String(defaultValue || '');
  const [inner, setInner] = useState(initial);
  const current = controlled ? String(value || '') : inner;
  const [datePart, setDatePart] = useState(current.split('T')[0]);
  const [timePart, setTimePart] = useState(current.split('T')[1] || '');
  const lastEmitted = useRef<string | undefined>(undefined);
  useEffect(() => {
    // An empty composite emitted while the user clears only the time is an
    // intentionally incomplete local edit. Do not let the controlled parent
    // echo that empty value erase the date the user already chose. A later
    // external value change (or reset) still synchronizes both parts.
    if (lastEmitted.current === current) { lastEmitted.current = undefined; return; }
    setDatePart(current.split('T')[0]); setTimePart(current.split('T')[1] || '');
  }, [current]);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const form = field.current?.form;
    const reset = () => { lastEmitted.current = undefined; const restored = controlled ? current : initial; if (!controlled) setInner(initial); setDatePart(restored.split('T')[0]); setTimePart(restored.split('T')[1] || ''); };
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, [controlled, initial, current]);
  function update(date: string, time: string, event: ChangeEvent<HTMLInputElement>) {
    setDatePart(date); setTimePart(time);
    // A date is not a full timestamp. Never silently schedule an invented time.
    const next = date && time ? `${date}T${time}` : '';
    lastEmitted.current = next;
    if (!controlled) setInner(next);
    if (field.current) {
      field.current.value = next;
      onChange?.({ ...event, target: field.current, currentTarget: field.current });
    }
  }
  return <div className="modern-date-time-input">
    <input type="hidden" ref={field} name={name} value={current} disabled={disabled} />
    <ModernDateInput {...props} min={typeof props.min === 'string' ? props.min.slice(0, 10) : undefined} max={typeof props.max === 'string' ? props.max.slice(0, 10) : undefined} required={required} disabled={disabled} value={datePart} onChange={event => update(event.target.value, timePart, event)} />
    <input type="time" aria-label={{ he: 'שעה', en: 'Time', ru: 'Время', fr: 'Heure' }[language]} min={typeof props.min === 'string' && props.min.slice(0, 10) === datePart ? props.min.split('T')[1] : undefined} max={typeof props.max === 'string' && props.max.slice(0, 10) === datePart ? props.max.split('T')[1] : undefined} required={required} disabled={disabled} readOnly={props.readOnly} step={props.step} value={timePart} onChange={event => update(datePart, event.target.value, event)} />
  </div>;
}
