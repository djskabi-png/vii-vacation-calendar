/** Inline in the first HTML head: an external stylesheet before the locale
 * bootstrap blocks parsing of the body while its request is pending. Keep the
 * navigation indicator styling available without a render-blocking request. */
export const navigationProgressCriticalCss = `.navigation-progress{position:fixed;z-index:10050;inset:0;pointer-events:none;opacity:0;visibility:hidden;background:#f4fcfc70;backdrop-filter:blur(2px);transition:opacity .12s,visibility 0s .12s;font-family:Rubik,Heebo,Arial,sans-serif}
.navigation-progress.is-active,html[data-navigation-pending="true"] .navigation-progress{opacity:1;visibility:visible;transition:none}
.navigation-progress__bar{position:absolute;inset:0 0 auto;height:4px;background:linear-gradient(90deg,#087e8b,#2c8ed6,#087e8b);background-size:220%;animation:navigation-progress-run 1.05s ease-in-out infinite}
.navigation-progress__panel{position:absolute;bottom:max(24px,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);min-width:min(310px,calc(100vw - 32px));display:flex;align-items:center;justify-content:center;gap:14px;padding:13px 18px;border:1px solid #087e8b33;border-radius:20px;background:#fff;color:#103741;box-shadow:0 18px 55px #1037413d;text-align:start}
.navigation-progress__label{display:block}.navigation-progress__label strong,.navigation-progress__label small{display:block;white-space:nowrap}.navigation-progress__label strong{font-size:15px;line-height:1.45}.navigation-progress__label small{color:#527079;font-size:12px}
.navigation-progress__mark{display:flex;gap:4px}.navigation-progress__mark i{width:8px;height:8px;border-radius:50%;background:#087e8b;animation:navigation-dot-pulse .9s ease-in-out infinite}.navigation-progress__mark i:nth-child(2){animation-delay:.14s}.navigation-progress__mark i:nth-child(3){animation-delay:.28s}
@keyframes navigation-progress-run{0%{transform:translateX(-120%)}65%{transform:translateX(150%)}100%{transform:translateX(280%)}}
@keyframes navigation-dot-pulse{50%{transform:translateY(-5px);opacity:1}}
@media(max-width:560px){.navigation-progress__panel{bottom:max(18px,env(safe-area-inset-bottom));padding:12px 16px}}
@media(prefers-reduced-motion:reduce){.navigation-progress__bar,.navigation-progress__mark i{animation:none}}
`;
