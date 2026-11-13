import bundles, { criticalStyles } from 'virtual:vii-public-style-bundles';
import { publicStyleWorld } from '../lib/public-style-world';
import { hasQualifiedCriticalTemplate, publicStylesReadyBootstrap } from '../lib/public-critical-style-policy';

export function PublicStyleResources({ initialPath, isFlight = true }: { initialPath: string; isFlight?: boolean }) {
  const world = publicStyleWorld(initialPath);
  const href = bundles[world];
  // The Worker supplies the destination path on HTML and Flight requests.
  // Keep this a Server Component: an already open predecessor client must
  // receive a native link resource, never a new unknown client-module ID.
  // React owns insertion, de-duplication and stylesheet readiness on navigation.
  if (isFlight || !hasQualifiedCriticalTemplate(initialPath)) return <link key={href} rel="stylesheet" href={href} precedence="vii-public" />;
  return <>
    <style href={`vii-critical:${href}`} precedence="vii-critical">{criticalStyles[world]}</style>
    <script dangerouslySetInnerHTML={{ __html: publicStylesReadyBootstrap }} />
    <link key={href} rel="stylesheet" href={href} precedence="vii-public" media="print" data-vii-deferred-style="" suppressHydrationWarning />
    {/* Keep the no-JavaScript fallback as raw markup. A JSX stylesheet inside
        noscript is hoisted by React into the document head and turns the full
        bundle back into a render-blocking resource. */}
    <noscript dangerouslySetInnerHTML={{ __html: `<link rel="stylesheet" href="${href}">` }} />
  </>;
}
