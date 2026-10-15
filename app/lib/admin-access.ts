function parseEmails(value: string | undefined) {
  return (value || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function adminEmails() {
  return combineAdminEmails(process.env.VII_ADMIN_EMAILS, process.env.VII_ADMIN_EMAILS_EXTRA);
}

export function combineAdminEmails(primary: string | undefined, extra: string | undefined) {
  return [...new Set([...parseEmails(primary), ...parseEmails(extra)])];
}

export function isAdminEmail(email: string | null | undefined) {
  return !!email && adminEmails().includes(email.trim().toLowerCase());
}

export function adminEmailsCsv() {
  return adminEmails().join(",");
}
