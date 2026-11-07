/** Inline in the first HTML head: an external stylesheet before the locale
 * bootstrap blocks parsing of the body while its request is pending. Keep the
 * navigation indicator styling available without a render-blocking request. */
export const navigationProgressCriticalCss = `.navigation-progress{position:fixed;z-index:10050;inset:0 0 auto;height:4px;pointer-events:none;opacity:0;overflow:visible;background:rgba(8,126,139,.14);transition:opacity .12s ease}
.navigation-progress__label{position:absolute;top:16px;left:50%;transform:translateX(-50%);padding:10px 20px;border-radius:999px;background:#fff;color:#103741;box-shadow:0 4px 20px #10374126;font:600 14px/1.5 Heebo,Arial,sans-serif;white-space:nowrap}
.navigation-progress.is-active{opacity:1}
.navigation-progress i{display:block;width:42%;height:100%;border-radius:999px;background:linear-gradient(90deg,#087e8b,#2c8ed6,#087e8b);transform:translateX(-120%)}
.navigation-progress.is-active i{animation:navigation-progress-run 1.05s ease-in-out infinite}
@keyframes navigation-progress-run{0%{transform:translateX(-120%)}65%{transform:translateX(150%)}100%{transform:translateX(280%)}}
@media(prefers-reduced-motion:reduce){.navigation-progress.is-active i{animation:none;width:100%;transform:none}}
`;
