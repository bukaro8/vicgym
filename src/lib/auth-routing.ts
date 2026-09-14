export function authenticatedHomePath(role: "USER" | "ADMIN"): "/" | "/admin/requests" {
  return role === "ADMIN" ? "/admin/requests" : "/";
}
