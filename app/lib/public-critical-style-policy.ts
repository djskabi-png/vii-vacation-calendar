// Only templates whose initial viewport has an observed desktop/mobile capture.
// Other routes and all Flight responses retain the established stylesheet path.
export function hasQualifiedCriticalTemplate(pathname: string) {
  return pathname === '/' || /^\/vacations\/(?:north|kinneret|western-galilee|haifa-carmel|center|tel-aviv|tel-aviv-area|jerusalem|dead-sea|south-negev|eilat)$/.test(pathname);
}

// Load listeners are captured at document level before hydration. No inline
// event handlers, new client-module reference, polling or request retry is used.
export const publicStylesReadyBootstrap = `(function(){if(window.__viiStylesReady)return;window.__viiStylesReady=true;function promote(e){var n=e&&e.target;if(n&&n.tagName==='LINK'&&n.hasAttribute('data-vii-deferred-style'))n.media='all'}function scan(){document.querySelectorAll('link[data-vii-deferred-style]').forEach(function(n){if(n.sheet)n.media='all'})}document.addEventListener('load',promote,true);document.addEventListener('DOMContentLoaded',scan,{once:true});window.addEventListener('pageshow',scan);scan()})()`;
