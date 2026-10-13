"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(window.scrollY > 850);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  if (!visible) return null;
  return <button className="back-to-top" type="button" aria-label="חזרה לראש העמוד" title="חזרה למעלה" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><ArrowUp aria-hidden="true" /></button>;
}
