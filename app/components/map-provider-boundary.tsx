"use client";

import { Component, type ReactNode } from "react";
import Link from "next/link";
import type { MapPlace, MapTone } from "../lib/map/map-place";
import { openPlaceInSameTabOnMobile } from "../lib/mobile-place-navigation";
import "./map-provider-boundary.css";

type Props = { places: MapPlace[]; tone: MapTone; language: "he" | "en" | "ru" | "fr"; children: ReactNode; providerError?: unknown; onRetry?: () => void; onClose?: () => void };
type State = { failed: boolean; visibleCount: number };

export class MapProviderBoundary extends Component<Props, State> {
  state: State = { failed: false, visibleCount: 25 };
  static getDerivedStateFromError(): Partial<State> { return { failed: true }; }
  componentDidCatch() {}
  render() {
    if (!this.state.failed && !this.props.providerError) return this.props.children;
    const copy = this.props.language === "en" ? { title: "The map could not load", text: "Your results and search are preserved.", retry: "Try again", list: "Results without map", more: "Show more places" } : this.props.language === "ru" ? { title: "Карта не загрузилась", text: "Результаты и поиск сохранены.", retry: "Повторить", list: "Результаты без карты", more: "Показать ещё" } : this.props.language === "fr" ? { title: "La carte n’a pas pu charger", text: "Vos résultats et votre recherche sont conservés.", retry: "Réessayer", list: "Résultats sans carte", more: "Afficher plus de lieux" } : { title: "המפה לא נטענה כרגע", text: "התוצאות והחיפוש נשמרו. אפשר להמשיך מהרשימה.", retry: "ניסיון חוזר", list: "תוצאות ללא מפה", more: "הצגת מקומות נוספים" };
    return <section className={`map-provider-fallback map-tone--${this.props.tone}`} role="alert">
      <strong>{copy.title}</strong><span>{copy.text}</span>
      <button type="button" onClick={() => { this.setState({ failed: false }); this.props.onRetry?.(); }}>{copy.retry}</button>
      {this.props.onClose && <button type="button" onClick={this.props.onClose}>{copy.list}</button>}
      <ul aria-label={copy.list}>{this.props.places.slice(0, this.state.visibleCount).map((place) => <li key={place.id}><Link href={place.href} target="_blank" rel="noopener noreferrer" onClick={(event) => openPlaceInSameTabOnMobile(event, place.href)}>{place.name}</Link></li>)}</ul>
      {this.state.visibleCount < this.props.places.length && <button type="button" onClick={() => this.setState(state => ({ visibleCount: state.visibleCount + 25 }))}>{copy.more}</button>}
    </section>;
  }
}
