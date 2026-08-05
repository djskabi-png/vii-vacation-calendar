"use client";

import Link from "next/link";
import { useState } from "react";
import { worlds, type WorldId } from "../data/world-data";

export function WorldSwitcher({ active = "vacation" }: { active?: WorldId }) {
  const [open, setOpen] = useState(false);
  const current = worlds.find((world) => world.id === active) || worlds[0];

  return (
    <div className={`world-dock ${open ? "open" : ""}`}>
      {open && <nav className="world-dock__panel" aria-label="מעבר בין עולמות">
        <header><span>כל מה שכיף לעשות</span><strong>לאיזה עולם עוברים?</strong></header>
        {worlds.map((world) => <Link key={world.id} className={world.id === active ? "active" : ""} href={world.href} onClick={() => setOpen(false)}><span className={`world-mark world-mark--${world.id}`} aria-hidden="true" /><span><b>{world.label}</b><small>{world.description}</small></span></Link>)}
      </nav>}
      <button type="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((value) => !value)}><span className={`world-mark world-mark--${current.id}`} aria-hidden="true" /><span><small>{current.shortLabel}</small><strong>{open ? "סגירה" : "בחירת עולם"}</strong></span></button>
    </div>
  );
}

export function SearchWorldTabs({ active }: { active: WorldId }) {
  return <nav className="search-world-tabs" aria-label="בחירת עולם לחיפוש">
    <span className="search-world-tabs__prompt">מה מחפשים?</span>
    <div className="search-world-tabs__options">
      {worlds.slice(0, 4).map((world) => <Link key={world.id} href={world.href} className={world.id === active ? "active" : ""} aria-current={world.id === active ? "page" : undefined}><span className={`world-mark world-mark--${world.id}`} aria-hidden="true" />{world.shortLabel}</Link>)}
    </div>
  </nav>;
}
