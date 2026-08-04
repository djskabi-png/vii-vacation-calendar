import Link from "next/link";
import { PageShell } from "./components/page-shell";
export default function NotFound(){return <PageShell><main id="main-content"><section className="not-found shell"><span>404</span><h1>העמוד שחיפשתם לא נמצא</h1><p>אפשר לחזור לדף הבית או להתחיל חיפוש חדש.</p><div><Link className="button primary" href="/">לדף הבית</Link><Link className="button subtle" href="/search/">לחיפוש חופשה</Link></div></section></main></PageShell>}
