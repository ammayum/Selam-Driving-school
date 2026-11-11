import { Role } from "../types";

const ROLE_KEY = "selam_php_role";
const STUDENT_ID_KEY = "selam_php_student_id";
const USER_ID_KEY = "selam_php_user_id";
const ACCESS_TOKEN_KEY = "selam_php_access_token";
const REFRESH_TOKEN_KEY = "selam_php_refresh_token";

export function setSession(role: Role, studentId?: number, userId?: number, accessToken?: string, refreshToken?: string): void {
  localStorage.setItem(ROLE_KEY, role);
  if (studentId) {
    localStorage.setItem(STUDENT_ID_KEY, String(studentId));
  }
  if (userId) {
    localStorage.setItem(USER_ID_KEY, String(userId));
  }
  if (accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, "cookie");
  }
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, "cookie");
  }
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, "cookie");
  localStorage.setItem(REFRESH_TOKEN_KEY, "cookie");
}

export function clearSession(): void {
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(STUDENT_ID_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getRole(): Role | null {
  const role = localStorage.getItem(ROLE_KEY);
  if (role === "admin" || role === "instructor" || role === "student") {
    return role;
  }
  return null;
}

export function getStudentId(): number | null {
  const raw = localStorage.getItem(STUDENT_ID_KEY);
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getUserId(): number | null {
  const raw = localStorage.getItem(USER_ID_KEY);
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}
