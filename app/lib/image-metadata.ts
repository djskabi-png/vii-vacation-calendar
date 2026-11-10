export function imageTitle(alt: string | undefined, title: string | undefined, decorative = false): string {
  if (decorative && !alt?.trim()) return "";
  return title?.trim() ? title : (alt?.trim() ? alt : "");
}
