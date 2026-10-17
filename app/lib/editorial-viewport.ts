export function editorialAreaVisible(rect: { top: number; bottom: number }, viewportHeight: number) {
  return viewportHeight > 0 && rect.top < viewportHeight && rect.bottom > 0;
}
