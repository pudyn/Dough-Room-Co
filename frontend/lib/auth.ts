export interface AuthUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem("user");
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function hasRole(roles: string[], ...required: string[]): boolean {
  return required.some((r) => roles.includes(r));
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("access_token");
}

export function logout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
  window.location.href = "/login";
}
