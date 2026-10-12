import { parseFragment } from "parse5";
import type { SupplierCatalogEntry } from "./supplier-catalog-store.ts";

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
        image: safeUrl(pack[imageField]),
        bookingUrl: safeUrl(pack.iframeurl),
      };
    });
    return { supplierId: id, summary: {
      id,
      title,
      titleEN: String(site.titleEN || "").trim(),
      address: String(site.address || "").trim(),
      city: String(site.city || "").trim(),
      shortDescription: String(site.short_desc || "").trim(),
      about: plainText(site.about),
      phone: String(site.phone || "").trim(),
      image: safeUrl(site[imageField]),
      opening: Array.isArray(site.opening) ? site.opening.map(String) : [],
      bookingUrl: safeUrl(site.iframeurl),
      packages,
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
      if (response.status >= 300 && response.status < 400) throw new Error("spa_redirect_not_allowed");
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "spa_not_authorized" : "spa_provider_error");
      let body: unknown;
      try { body = await response.json(); } catch { throw new Error("invalid_spa_response"); }
      return { fetchedAt: new Date().toISOString(), entries: normalizeSpaPlusCatalog(body) };
    },
  };
}
