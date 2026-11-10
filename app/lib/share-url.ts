export type ShareKind = "place" | "event" | "article";

export function canonicalShareUrl(value: string, kind: ShareKind = "place") {
  const current = new URL(value);
  current.hash = "";
  const essential = new URLSearchParams();
  const id = current.searchParams.get("id");
  const world = current.searchParams.get("world");
  if (id) essential.set("id", id);
  if (world && world !== "vacation") essential.set("world", world);
  if (kind === "event" && /^\/events\/place\//.test(current.pathname)) current.search = "";
  else current.search = essential.toString();
  return current.toString();
}
