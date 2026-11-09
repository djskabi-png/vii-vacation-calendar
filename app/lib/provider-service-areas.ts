const verifiedServiceAreas = new Set(["צפון", "כנרת", "חיפה", "מרכז", "תל אביב", "ירושלים", "דרום ונגב", "אילת והסביבה", "כל הארץ", "בכל הארץ", "חיפה ועד אשדוד", "יקיר והשומרון"]);

export function hasVerifiedProviderServiceArea(serviceAreas: readonly string[] | undefined): boolean {
  return (serviceAreas || []).some((area) => verifiedServiceAreas.has(area));
}

export function providerGeographicServiceAreas(serviceAreas: readonly string[] | undefined): string[] {
  return (serviceAreas || []).filter((area) => verifiedServiceAreas.has(area));
}

export function providerServesRegion(serviceAreas: readonly string[] | undefined, selectedRegion: string): boolean {
  if (selectedRegion === "כל הארץ") return true;
  const areas = providerGeographicServiceAreas(serviceAreas);
  return areas.includes(selectedRegion) || areas.includes("כל הארץ") || areas.includes("בכל הארץ");
}

export const providerServiceAreaLabels = [...verifiedServiceAreas];
