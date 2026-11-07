import bundles from 'virtual:vii-public-style-bundles';
import { publicStyleWorld } from '../lib/public-style-world';

export function PublicStyleResources({ initialPath }: { initialPath: string }) {
  const href = bundles[publicStyleWorld(initialPath)];
  // The Worker supplies the destination path on HTML and Flight requests.
  // Keep this a Server Component: an already open predecessor client must
  // receive a native link resource, never a new unknown client-module ID.
  // React owns insertion, de-duplication and stylesheet readiness on navigation.
  return <link key={href} rel="stylesheet" href={href} precedence="vii-public" />;
}
