"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { LanguageSwitcher, useSiteLanguage } from "./i18n/locale-provider";
import { localizedPath, stripLanguagePrefix } from "./i18n/locale-routing";
import { publicWorldNavigation, type WorldId } from "./data/world-navigation";
import { AccessibilityWidget } from "./components/accessibility-widget";
import { WorldSwitcher } from "./components/world-switcher";
import { useAccountAccess } from "./components/account-access";
import { SavedViewedMenu } from "./components/saved-viewed-menu";
import type { ManagedLink } from "./lib/content-studio";
import { useWorldAvailability } from "./components/world-availability-provider";

const defaultNav = publicWorldNavigation.map((world) => ({ id: String(world.id), href: world.href, label: world.shortLabel, description: world.description }));
const defaultSecondary: ManagedLink[] = [
  { id: "gift-card", label: "גיפט קארד", href: "/gift-card", group: "עוד באתר", order: 1, visible: true, newWindow: false },
  { id: "destinations", label: "יעדים", href: "/destinations", group: "עוד באתר", order: 2, visible: true, newWindow: false },
  { id: "holidays", label: "נופש בחג", href: "/holidays", group: "עוד באתר", order: 3, visible: true, newWindow: false },
  { id: "guides", label: "מגזין ומדריכים", href: "/guides", group: "עוד באתר", order: 4, visible: true, newWindow: false },
  { id: "questions", label: "שאלות ותשובות", href: "/questions", group: "עוד באתר", order: 5, visible: true, newWindow: false },
  { id: "accessibility", label: "הצהרת נגישות", href: "/accessibility", group: "עוד באתר", order: 6, visible: true, newWindow: false },
];

export function SiteHeader({ variant = "vacation" }: { variant?: WorldId }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [managedChrome, setManagedChrome] = useState<{ language: string; primary?: ManagedLink[] | null; secondary?: ManagedLink[] | null } | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = stripLanguagePrefix(usePathname());
  const { language, translate } = useSiteLanguage();
  const { enabled } = useWorldAvailability();
  const managedNav = (managedChrome?.language === language && managedChrome.primary?.length
    ? managedChrome.primary.filter((item) => item.visible).map((item) => ({ ...item, description: defaultNav.find((entry) => entry.id === item.id)?.description || item.group }))
    : defaultNav).filter((item) => enabled(item.id === "activities" ? "attractions" : item.id));
  const usingDefaultSecondary = !(managedChrome?.language === language && managedChrome.secondary?.length);
  const secondaryNav = (usingDefaultSecondary
    ? defaultSecondary
    : managedChrome!.secondary!.filter((item) => item.visible))
    .filter((item) => (item.id !== "gift-card" && !item.href.startsWith("/gift-card")) || enabled("gift-card"));
  const homeHref = localizedPath("/", language);
  const advertiseHref = localizedPath("/join#join-pricing", language);
  const homeLoadingLabel = translate("פותחים את דף הבית...");
  const { account, openLogin } = useAccountAccess();
  const magazineActive = pathname === "/guides" || pathname.startsWith("/guides/");
  const activeWorld = pathname === "/trails" || pathname.startsWith("/trails/")
    ? "trails"
    : pathname === "/attractions" || pathname.startsWith("/attractions/")
      ? "attractions"
      : variant;
  const hasInPageSearch = pathname === "/"
    || pathname === "/search" || pathname.startsWith("/search/")
    || pathname === "/events" || pathname.startsWith("/events/search")
    || pathname === "/spas" || pathname.startsWith("/spas/search")
    || pathname === "/hourly" || pathname.startsWith("/hourly/search")
    || pathname === "/providers" || pathname.startsWith("/providers/search")
    || pathname === "/attractions" || pathname.startsWith("/attractions/search")
    || pathname === "/trails" || pathname.startsWith("/trails/search");
  const searchPaths: Record<string, string> = { events: "/events", spa: "/spas", hourly: "/hourly", providers: "/providers", activities: "/attractions", attractions: "/attractions", trails: "/trails" };
  const searchHref = localizedPath(searchPaths[activeWorld] || "/search", language);
  const searchLabel = {
    he: "חיפוש באתר",
    en: "Search the site",
    ru: "Поиск по сайту",
    fr: "Rechercher sur le site",
  }[language];
  const magazineCopy = {
    he: { badge: "חדש", label: "מגזין", menuLabel: "מגזין ומדריכים" },
    en: { badge: "New", label: "Magazine", menuLabel: "Magazine and guides" },
    ru: { badge: "Новое", label: "Журнал", menuLabel: "Журнал и путеводители" },
    fr: { badge: "Nouveau", label: "Magazine", menuLabel: "Magazine et guides" },
  }[language];
  const accountCopy = {
    he: { connected: "מחוברים לחשבון", title: "החשבון האישי שלי", summary: "אהובים, הזמנות ובקשות במקום אחד" },
    en: { connected: "Signed in", title: "My account", summary: "Favorites, bookings and requests in one place" },
    ru: { connected: "Вы вошли", title: "Мой аккаунт", summary: "Избранное, бронирования и запросы в одном месте" },
    fr: { connected: "Connecté", title: "Mon compte", summary: "Favoris, réservations et demandes au même endroit" },
  }[language];

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/content/chrome?locale=${language}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : null)
      .then((payload: { primary?: ManagedLink[] | null; secondary?: ManagedLink[] | null } | null) => {
        if (payload) setManagedChrome({ language, ...payload });
      }).catch(() => undefined);
    return () => controller.abort();
  }, [language]);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
        return;
      }

      if (event.key !== "Tab") return;
      const panel = document.querySelector<HTMLElement>(".menu-panel");
      const focusable = panel?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const desktopViewport = window.matchMedia("(min-width: 821px)");
    const openedFromMobile = !desktopViewport.matches;
    const handleViewportChange = () => {
      if (desktopViewport.matches) setMenuOpen(false);
    };
    const viewportFallback = openedFromMobile ? window.setInterval(handleViewportChange, 120) : undefined;

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);
    desktopViewport.addEventListener("change", handleViewportChange);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("orientationchange", handleViewportChange);
      desktopViewport.removeEventListener("change", handleViewportChange);
      if (viewportFallback !== undefined) window.clearInterval(viewportFallback);
    };
  }, [menuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
    window.setTimeout(() => menuButtonRef.current?.focus(), 0);
  };


  const openAccountLogin = () => {
    setMenuOpen(false);
    window.setTimeout(() => {
      menuButtonRef.current?.focus();
      openLogin();
    }, 0);
  };
  const menu = menuOpen && typeof document !== "undefined" ? createPortal(
    <div className="menu-layer" role="dialog" aria-modal="true" aria-label={translate("תפריט האתר")} onMouseDown={(event) => event.target === event.currentTarget && closeMenu()}>
      <nav className="menu-panel" aria-label={translate("ניווט מלא")}>
        <div className="menu-panel__head">
          <Link href={homeHref} prefetch onClick={closeMenu} aria-label={translate("וי פור ויקיישן, דף הבית")} data-global-feedback="true" data-loading-label={homeLoadingLabel}>
            <img src="/vii-logo.png" alt={translate("וי פור ויקיישן")} title={translate("וי פור ויקיישן")} />
          </Link>
          <button ref={closeButtonRef} type="button" onClick={closeMenu} aria-label={translate("סגירת תפריט")}><CloseIcon /></button>
        </div>


        {account ? (
          <Link className="menu-panel__account" href="/account" onClick={closeMenu}>
            <span className="menu-panel__account-avatar" aria-hidden="true">{account.name.trim().slice(0, 1).toUpperCase()}</span>
            <span className="menu-panel__account-copy">
              <small>{accountCopy.connected}</small>
              <strong>{account.name}</strong>
              <span>{account.email}</span>
            </span>
          </Link>
        ) : (
          <button className="menu-panel__account" type="button" onClick={openAccountLogin}>
            <span className="menu-panel__account-avatar menu-panel__account-avatar--guest" aria-hidden="true"><UserIcon /></span>
            <span className="menu-panel__account-copy">
              <strong>{accountCopy.title}</strong>
              <span>{accountCopy.summary}</span>
            </span>
          </button>
        )}
        <div className="menu-panel__intro">
          <h2>{translate("לאן תרצו להגיע?")}</h2>
        </div>

        <div className="menu-panel__main">
          <Link href={advertiseHref} onClick={closeMenu}>
            <span><strong>{translate("פרסום באתר")}</strong><small>{translate("פרסום עסק, ספק, אטרקציה או מקום אירוח")}</small></span>
            <ArrowIcon />
          </Link>
          {managedNav.map((item) => (
            <Link key={item.href} href={item.href} onClick={closeMenu}>
              <span><strong>{translate(item.label)}</strong><small>{translate(item.description)}</small></span>
              <ArrowIcon />
            </Link>
          ))}
        </div>

        <Link className="menu-panel__join" href={advertiseHref} onClick={closeMenu}>
          <ContactIcon />
          <span>
            <strong>{translate("פרסום והצטרפות לאתר")}</strong>
            <small>{translate("פרסום עסק, ספק, אטרקציה או מקום אירוח")}</small>
          </span>
          <ArrowIcon />
        </Link>

        <span className="menu-panel__section-title">{translate("עוד באתר")}</span>
        <div className="menu-panel__secondary">
          {usingDefaultSecondary ? <>{enabled("gift-card") ? <Link href={localizedPath("/gift-card", language)} onClick={closeMenu}><GiftIcon /><span>{translate("גיפט קארד")}</span></Link> : null}<Link href="/destinations" onClick={closeMenu}><PinIcon /><span>{translate("יעדים")}</span></Link><Link href={localizedPath("/holidays", language)} onClick={closeMenu}><CalendarIcon /><span>{translate("נופש בחג")}</span></Link><Link href="/guides" onClick={closeMenu} aria-current={magazineActive ? "page" : undefined}><InfoIcon /><span>{magazineCopy.menuLabel}</span></Link><Link href="/questions" onClick={closeMenu}><InfoIcon /><span>{translate("שאלות ותשובות")}</span></Link><Link href="/accessibility" onClick={closeMenu}><AccessibilityIcon /><span>{translate("הצהרת נגישות")}</span></Link></> : <>{secondaryNav.map((item) => <Link key={item.id} href={localizedPath(item.href, language)} onClick={closeMenu} target={item.newWindow ? "_blank" : undefined} rel={item.newWindow ? "noopener noreferrer" : undefined} aria-current={item.id === "guides" && magazineActive ? "page" : undefined}><InfoIcon /><span>{translate(item.id === "guides" ? magazineCopy.menuLabel : item.label)}</span></Link>)}{secondaryNav.some((item) => item.href === "/holidays") ? null : <Link href={localizedPath("/holidays", language)} onClick={closeMenu}><CalendarIcon /><span>{translate("נופש בחג")}</span></Link>}</>}
          <AccessibilityWidget placement="menu" />
        </div>

        <div className="menu-panel__footer">
          <LanguageSwitcher compact />
        </div>
      </nav>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <header className="site-header">
        <div className="site-header__inner shell">
          <Link className="brand" href={homeHref} prefetch aria-label={translate("וי פור ויקיישן, דף הבית")} data-global-feedback="true" data-loading-label={homeLoadingLabel}>
            <img src="/vii-logo.png" alt={translate("וי פור ויקיישן")} title={translate("וי פור ויקיישן")} />
          </Link>

          <div className="header-actions">
            <SavedViewedMenu />
            <LanguageSwitcher compact iconOnly />
            <AccessibilityWidget placement="icon" />
            {!hasInPageSearch ? <Link className="icon-button header-search" href={searchHref} aria-label={searchLabel}><SearchIcon /></Link> : null}
            {enabled("gift-card") ? <Link className={`icon-button header-gift${pathname === "/gift-card" ? " active" : ""}`} href={localizedPath("/gift-card", language)} aria-label={translate("גיפט קארד")} aria-current={pathname === "/gift-card" ? "page" : undefined}><GiftIcon /></Link> : null}
            <WorldSwitcher active={activeWorld} />
            <button ref={menuButtonRef} className="menu-button" type="button" aria-expanded={menuOpen} aria-haspopup="dialog" aria-label={translate("פתיחת תפריט")} onClick={() => setMenuOpen(true)}><MenuIcon /><span>{translate("תפריט")}</span></button>
          </div>
        </div>
      </header>
      {menu}
    </>
  );
}

export function MenuIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>; }
export function CloseIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>; }
export function HeartIcon({ filled = false }: { filled?: boolean }) { return <svg viewBox="0 0 24 24" aria-hidden="true" className={filled ? "filled" : ""}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg>; }
export function EyeIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.8" /></svg>; }
export function AccessibilityIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="4" r="2" /><path d="M5 8h14M12 6v7m0 0-4 7m4-7 4 7" /></svg>; }
export function ArrowIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>; }
export function SearchIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>; }
export function PinIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>; }
export function MapIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 5-2 8 3 5-2v13l-5 2-8-3-5 2V6Z" /><path d="M8 4v13m8-10v13" /></svg>; }
export function CalendarIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4m8-4v4M3 10h18" /></svg>; }
export function PeopleIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M3 20c0-4 2-7 6-7s6 3 6 7m0-9c3 0 5 2 5 5v4" /></svg>; }
export function UserIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c.7-5 3.3-8 8-8s7.3 3 8 8" /></svg>; }
export function GiftIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16v11H4zM3 6h18v4H3zM12 6v15" /><path d="M12 6c-4 0-5-2-4-3s4 0 4 3Zm0 0c4 0 5-2 4-3s-4 0-4 3Z" /></svg>; }
function ContactIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v12H8l-4 3V5Z" /><path d="M8 9h8M8 13h5" /></svg>; }
function InfoIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></svg>; }
