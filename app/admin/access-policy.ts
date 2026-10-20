// Admin-only shared policy. No credentials, database access or owner identity.
export const adminModules = [
  { id: "overview", label: "תמונת מצב וקידום", editable: true, pages: ["/admin", "/admin/growth"], apis: ["overview", "sitemap"] },
  { id: "content", label: "סטודיו תוכן", editable: true, pages: ["/admin/content-studio"], apis: ["content-studio"] },
  { id: "search", label: "עמודי חיפוש ותור אישורים", editable: true, pages: ["/admin/search-pages", "/admin/content-queue"], apis: ["search-pages", "content-queue"] },
  { id: "analytics", label: "דוחות וביצועי עסקים", editable: true, pages: ["/admin/search-analytics", "/admin/business-performance"], apis: ["search-analytics", "business-performance"] },
  { id: "promotions", label: "קידום מקומות", editable: true, pages: ["/admin/discovery-promotions"], apis: ["discovery-promotions"] },
  { id: "redirects", label: "כתובות והפניות", editable: true, pages: ["/admin/redirects"], apis: ["redirects"] },
  { id: "catalogs", label: "קטלוגים וספקים", editable: true, pages: ["/admin/catalog-sync"], apis: ["catalog-sync"] },
  { id: "geography", label: "ערים ואזורים", editable: true, pages: ["/admin/geography"], apis: ["geography"] },
  { id: "operations", label: "הזמנות וחוות דעת", editable: true, pages: ["/admin/operations"], apis: ["operations"] },
  { id: "leads", label: "פניות וואטסאפ", editable: true, pages: ["/admin/whatsapp-leads"], apis: ["whatsapp-leads"] },
] as const;

export type AdminModule = typeof adminModules[number]["id"];
export type AdminPermissions = Partial<Record<AdminModule, "view" | "edit">>;
export type AdminAccess = { fullAccess: boolean; manageUsers: boolean; permissions: AdminPermissions };
export const fullAdminAccess: AdminAccess = { fullAccess: true, manageUsers: true, permissions: {} };

export function parseAdminPermissions(value: unknown): AdminPermissions | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const output: AdminPermissions = {};
  for (const [key, level] of Object.entries(value)) {
    const adminModule = adminModules.find((item) => item.id === key);
    if (!adminModule || (level !== "view" && level !== "edit") || (level === "edit" && !adminModule.editable)) return null;
    output[adminModule.id] = level;
  }
  return output;
}

export function adminRouteAllowed(access: AdminAccess, path: string, method = "GET") {
  const pathname = path.replace(/^\/(en|fr|ru)(?=\/)/, "").replace(/\/$/, "") || "/";
  if (pathname === "/admin/users" || pathname === "/api/admin/users") return access.manageUsers;
  if (access.fullAccess) return true;
  const adminModule = adminModules.find((item) => (item.pages as readonly string[]).includes(pathname)
    || item.apis.some((api) => pathname === `/api/admin/${api}`));
  if (!adminModule) return false; // New and technical endpoints are never implicitly delegated.
  const level = access.permissions[adminModule.id];
  return method === "GET" || method === "HEAD" ? !!level : level === "edit" && adminModule.editable;
}

export function adminLanding(access: AdminAccess) {
  if (access.manageUsers) return "/admin/users";
  return adminModules.find((item) => adminRouteAllowed(access, item.pages[0]))?.pages[0] || "/account?authError=admin_forbidden";
}
