"use client";

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/** No UI, server reads or blocking work. Heavy observers load only after opt-in. */
export function ExperienceCollector() {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    let mounted = true;
    let loaded: typeof import('../lib/experience-runtime') | undefined;
    const consent = async () => {
      try {
        if (localStorage.getItem('vii-cookie-choice') !== 'all') { loaded?.experienceRuntime().stop(); return; }
        loaded = await import('../lib/experience-runtime');
        if (mounted) loaded.experienceRuntime().start();
      } catch { /* Optional measurement never interrupts the product. */ }
    };
    window.addEventListener('vii-cookie-choice-changed', consent);
    void consent();
    return () => { mounted = false; window.removeEventListener('vii-cookie-choice-changed', consent); loaded?.experienceRuntime().stop(); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    try { if (localStorage.getItem('vii-cookie-choice') === 'all') void import('../lib/experience-runtime').then(module => { if (!cancelled) module.experienceRuntime().routeCommitted(); }).catch(() => undefined); } catch { /* Storage may be unavailable. */ }
    return () => { cancelled = true; };
  }, [pathname, search]);
  return null;
}
