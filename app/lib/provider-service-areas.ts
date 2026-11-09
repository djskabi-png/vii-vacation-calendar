const verifiedServiceAreas = new Set(["צפון", "כנרת", "חיפה", "מרכז", "תל אביב", "ירושלים", "דרום ונגב", "אילת והסביבה", "כל הארץ", "בכל הארץ", "חיפה ועד אשדוד", "יקיר והשומרון"]);

export function hasVerifiedProviderServiceArea(serviceAreas: readonly string[] | undefined): boolean {
  return (serviceAreas || []).some((area) => verifiedServiceAreas.has(area));
}

export const providerServiceAreaLabels = [...verifiedServiceAreas];
