export function mapResultSummary(places: readonly { representedCount?: number }[], language: string, kind: "places" | "trails" = "places") {
  const count = places.reduce((total, place) => total + (Number.isSafeInteger(place.representedCount) && Number(place.representedCount) > 0 ? Number(place.representedCount) : 1), 0);
  const labels = language === "en" ? { trails: "trails", approximate: "Approximate area" }
    : language === "ru" ? { trails: "маршрутов", approximate: "Примерный район" }
    : language === "fr" ? { trails: "itinéraires", approximate: "Zone approximative" }
    : { trails: "מסלולים", approximate: "אזור משוער" };
  return { count, markers: places.length, trailLabel: kind === "trails" ? labels.trails : null, approximateLabel: labels.approximate };
}
