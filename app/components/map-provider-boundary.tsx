"use client";

import { Component, type ReactNode } from "react";
import Link from "next/link";
import type { MapPlace, MapTone } from "../lib/map/map-place";

type Props = { places: MapPlace[]; tone: MapTone; language: "he" | "en" | "ru" | "fr"; children: ReactNode; providerError?: unknown; onRetry?: () => void };
type State = { failed: boolean };

export class MapProviderBoundary extends Component<Props, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State { return { failed: true }; }
  componentDidCatch() {}
  render() {
    if (!this.state.failed && !this.props.providerError) return this.props.children;
    const copy = this.props.language === "en" ? { title: "The map could not load", text: "Your results and search are preserved.", retry: "Try again", list: "Results without map" } : this.props.language === "ru" ? { title: "Карта не загрузилась", text: "Результаты и поиск сохранены.", retry: "Повторить", list: "Результаты без карты" } : this.props.language === "fr" ? { title: "La carte n’a pas pu charger", text: "Vos résultats et votre recherche sont conservés.", retry: "Réessayer", list: "Résultats sans carte" } : { title: "המפה לא נטענה כרגע", text: "התוצאות והחיפוש נשמרו. אפשר להמשיך מהרשימה.", retry: "ניסיון חוזר", list: "תוצאות ללא מפה" };
    return <section className={`map-provider-fallback map-tone--${this.props.tone}`} role="alert">
      <strong>{copy.title}</strong><span>{copy.text}</span>
      <button type="button" onClick={() => { this.setState({ failed: false }); this.props.onRetry?.(); }}>{copy.retry}</button>
      <ul aria-label={copy.list}>{this.props.places.map((place) => <li key={place.id}><Link href={place.href}>{place.name}</Link></li>)}</ul>
    </section>;
  }
}
