import { parseFragment } from "parse5";
import type { SupplierCatalogEntry } from "./supplier-catalog-store.ts";
import { SupplierCatalogRedirectError, SpaCatalogJsonError } from "./supplier-catalog-diagnostics.ts";

type ParseNode = { nodeName: string; value?: string; childNodes?: ParseNode[] };

const endpoint = "https://www.spaplus.co.il/vii/";
const imageField = "CONCAT('https://www.spaplus.co.il/gallery/',picture)";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function plainText(value: unknown) {
  const parts: string[] = [];
  function walk(node: ParseNode) {
    if (node.nodeName === "#text") parts.push(node.value || "");
    if (["br", "p", "div", "li"].includes(node.nodeName)) parts.push("\n");
    for (const child of node.childNodes || []) walk(child);
    if (["p", "div", "li"].includes(node.nodeName)) parts.push("\n");
  }
  walk(parseFragment(String(value || "")) as unknown as ParseNode);
  return parts.join("").replace(/\u00a0/g, " ").split(/\n+/)
    .map((part) => part.replace(/\s+/g, " ").trim()).filter(Boolean);
}

function safeUrl(value: unknown) {
  if (!value) return null;
  if (typeof value !== "string") throw new Error("invalid_spa_url");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "www.spaplus.co.il") throw new Error("invalid_spa_url");
  return url.href;
}

function positive(value: unknown) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function sourceFacilities(site: Record<string, unknown>) {
  const ids = new Set<number>();
  const labels = new Set<string>();
  const fields = ["facilityIds", "facility_ids", "accessoryIds", "accessories", "facilities", "features"];
  const present = fields.some((field) => Object.prototype.hasOwnProperty.call(site, field));
  for (const field of fields) {
    const value = site[field];
    for (const item of Array.isArray(value) ? value : typeof value === "object" && value ? Object.values(value as Record<string, unknown>) : [value]) {
      if (typeof item === "number" || typeof item === "string" && /^\d+$/.test(item)) ids.add(Number(item));
      else if (item && typeof item === "object" && !Array.isArray(item)) {
        const row = item as Record<string, unknown>;
        const id = positive(row.id ?? row.facilityId ?? row.accessoryId);
        if (id) ids.add(id);
        const label = typeof (row.label ?? row.title ?? row.name ?? row.description) === "string"
          ? String(row.label ?? row.title ?? row.name ?? row.description).trim() : "";
        if (label) labels.add(label);
      } else if (typeof item === "string" && item.trim() && !/^\d+$/.test(item)) labels.add(item.trim());
    }
  }
  return { ids: [...ids].sort((a, b) => a - b), labels: [...labels], present };
}

export function normalizeSpaPlusCatalog(payload: unknown): SupplierCatalogEntry[] {
  const body = record(payload);
  const sites = body.sites;
  if (body.status !== "ok" || !sites || typeof sites !== "object" || Array.isArray(sites)) {
    throw new Error("invalid_spa_catalog");
  }
  const entries = Object.entries(sites).map(([key, value]) => {
    const site = record(value);
    const id = positive(site.siteid);
    const title = typeof site.title === "string" ? site.title.trim() : "";
    if (!id || Number(key) !== id || !title) throw new Error("invalid_spa_site");
    if (site.gallery !== undefined && !Array.isArray(site.gallery)) throw new Error("invalid_spa_gallery");
    const gallery = [...new Set((site.gallery || []).map((value) => safeUrl(value)).filter((url): url is string => Boolean(url)))];
    const packages = Object.values(record(site.packages)).map((value) => {
      const pack = record(value);
      const packageId = positive(pack.MainPageID);
      const supplierPackageId = positive(pack.idPack);
      const packageTitle = typeof pack.MainPageTitle === "string" ? pack.MainPageTitle.trim() : "";
      const price = Number(pack.price);
      if (!packageId || !supplierPackageId || !packageTitle || !Number.isFinite(price) || price <= 0) {
        throw new Error("invalid_spa_package");
      }
      return {
        id: packageId,
        supplierPackageId,
        title: packageTitle,
        price,
        durationMinutes: positive(pack.treatmentDuration),
        people: positive(pack.packPeoples),
        group: Boolean(Number(pack.isGroupPackage)),
        image: safeUrl(pack.pack_picture ?? pack[imageField]),
        bookingUrl: safeUrl(pack.iframeurl),
      };
    });
    const facilities = sourceFacilities(site);
    return { supplierId: id, summary: {
      id,
      title,
      titleEN: String(site.titleEN || "").trim(),
      address: String(site.address || "").trim(),
      city: String(site.city || "").trim(),
      shortDescription: String(site.short_desc || "").trim(),
      about: plainText(site.about),
      phone: String(site.phone || "").trim(),
      image: safeUrl(site.spa_picture ?? site[imageField]),
      gallery,
      opening: Array.isArray(site.opening) ? site.opening.map(String) : [],
      bookingUrl: safeUrl(site.iframeurl),
      packages,
      ...(facilities.present ? { facilityIds: facilities.ids, features: facilities.labels } : {}),
    } };
  });
  if (!entries.length || new Set(entries.map((entry) => entry.supplierId)).size !== entries.length) {
    throw new Error("invalid_spa_catalog");
  }
  return entries;
}

export function createSpaPlusCatalogClient(options: { apiKey: string; fetchImpl?: typeof fetch }) {
  const apiKey = options.apiKey.trim();
  const fetchImpl = options.fetchImpl || fetch;
  return {
    async fetchCandidate() {
      if (!apiKey) throw new Error("missing_spa_key");
      const url = new URL(endpoint);
      url.searchParams.set("key", apiKey);
      url.searchParams.set("action", "sites");
      let response: Response;
      try {
        response = await fetchImpl(url, { signal: AbortSignal.timeout(30_000), redirect: "manual", cache: "no-store" });
      } catch {
        throw new Error("spa_transport_error");
      }
      if (response.status >= 300 && response.status < 400) throw new SupplierCatalogRedirectError("spa_redirect_not_allowed", response.status, response.headers.get("Location"), url.href);
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "spa_not_authorized" : "spa_provider_error");
      let bytes: ArrayBuffer;
      try { bytes = await response.arrayBuffer(); } catch {
        throw new SpaCatalogJsonError({ httpStatus: response.status, contentType: response.headers.get("Content-Type"),
          responseBytes: null, firstCharacterKind: "other", parseErrorKind: "body_read_error" });
      }
      // Decode once as response.json() does, including UTF-8 BOM handling. Body stays in memory only.
      const text = new TextDecoder().decode(bytes);
      let body: unknown;
      try { body = JSON.parse(text); } catch (error) {
        const first = text.trimStart()[0];
        throw new SpaCatalogJsonError({ httpStatus: response.status, contentType: response.headers.get("Content-Type"),
          responseBytes: bytes.byteLength,
          firstCharacterKind: first === "{" || first === "[" ? "json-like" : first === "<" ? "html-like" : "other",
          parseErrorKind: error instanceof SyntaxError ? "syntax_error" : "other" });
      }
      return { fetchedAt: new Date().toISOString(), entries: normalizeSpaPlusCatalog(body) };
    },
  };
}
