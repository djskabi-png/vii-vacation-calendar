"use client";
import { createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import { adminRouteAllowed, type AdminAccess } from "../lib/admin-permissions.ts";

const AccessContext = createContext<AdminAccess>({ fullAccess: false, manageUsers: false, permissions: {} });
export function useAdminCanEdit() {
  return adminRouteAllowed(useContext(AccessContext), usePathname(), "POST");
}
export default function AdminAccessProvider({ access, children }: { access: AdminAccess; children: React.ReactNode }) {
  const path = usePathname();
  const readOnly = !access.fullAccess && path !== "/admin/users" && !adminRouteAllowed(access, path, "POST");
  return <AccessContext.Provider value={access}>{readOnly ? <p role="status" dir="rtl" style={{ margin: "16px 24px", padding: "12px 16px", borderRadius: 12, background: "#eaf4f6", color: "#164a58", fontFamily: '"VII Heebo", Heebo, Arial, sans-serif' }}>הגישה לעמוד הזה היא לצפייה בלבד. שמירה ופעולות שינוי אינן זמינות לחשבון שלכם.</p> : null}{children}</AccessContext.Provider>;
}
