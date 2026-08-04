export function SiteHeader({ compact = false, homeHref = "./" }: { compact?: boolean; homeHref?: string }) {
  return (
    <header className={`vii-header${compact ? " compact" : ""}`}>
      <div className="vii-header-inner">
        <a className="vii-logo-link" href={homeHref} aria-label="דף הבית בהמחשה">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://www.vii.co.il/assets/img/logo_new.png" alt="וי פור ויקיישן" width="160" height="122" />
        </a>

        <nav className="vii-main-nav" aria-label="ניווט ראשי">
          <a className="active" href={homeHref}>נופש <span aria-hidden="true">🏝️</span></a>
          <a href="https://www.vii.co.il/events/" target="_blank" rel="noreferrer">אירועים <span aria-hidden="true">🏡</span></a>
        </nav>

        <div className="vii-utility-nav" aria-label="פעולות משתמש">
          <button type="button" aria-label="תפריט">☰</button>
          <button type="button" aria-label="אזור אישי">●</button>
          <button type="button" aria-label="מועדפים">♡</button>
          <button type="button" aria-label="נגישות">♿</button>
        </div>
      </div>
    </header>
  );
}
