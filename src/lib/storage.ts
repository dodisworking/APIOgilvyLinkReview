import { seededAppData } from "@/data/seed";
import { AppData, LoginActivityEntry, Role } from "@/types";

const APP_DATA_KEY = "production-review-app-data-v1";
const ROLE_KEY = "production-review-role-v1";
const USER_NAME_KEY = "production-review-name-v1";
const LOGIN_ACTIVITY_KEY = "production-review-login-activity-v1";

export const loadAppData = (): AppData => {
  if (typeof window === "undefined") {
    return seededAppData;
  }

  const raw = window.localStorage.getItem(APP_DATA_KEY);
  if (!raw) {
    window.localStorage.setItem(APP_DATA_KEY, JSON.stringify(seededAppData));
    return seededAppData;
  }

  try {
    return JSON.parse(raw) as AppData;
  } catch {
    window.localStorage.setItem(APP_DATA_KEY, JSON.stringify(seededAppData));
    return seededAppData;
  }
};

export const saveAppData = (data: AppData): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(APP_DATA_KEY, JSON.stringify(data));
};

export const saveSession = (role: Role, name: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(ROLE_KEY, role);
  window.localStorage.setItem(USER_NAME_KEY, name);
};

export const loadSession = (): { role: Role | null; name: string } => {
  if (typeof window === "undefined") {
    return { role: null, name: "" };
  }

  const role = window.localStorage.getItem(ROLE_KEY) as Role | null;
  const name = window.localStorage.getItem(USER_NAME_KEY) ?? "";
  return { role, name };
};

export const clearSession = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ROLE_KEY);
  window.localStorage.removeItem(USER_NAME_KEY);
};

export const loadLoginActivity = (): LoginActivityEntry[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(LOGIN_ACTIVITY_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as LoginActivityEntry[];
  } catch {
    return [];
  }
};

export const recordLoginActivity = (params: {
  name: string;
  email: string;
  role: Role;
}): LoginActivityEntry[] => {
  const current = loadLoginActivity();
  const now = new Date().toISOString();
  const keyName = params.name.trim().toLowerCase();
  const keyEmail = params.email.trim().toLowerCase();

  const idx = current.findIndex((entry) => {
    if (keyEmail) {
      return entry.email.trim().toLowerCase() === keyEmail;
    }
    return entry.name.trim().toLowerCase() === keyName;
  });

  let next: LoginActivityEntry[];
  if (idx >= 0) {
    next = [...current];
    next[idx] = {
      ...next[idx],
      name: params.name.trim() || next[idx].name,
      email: params.email.trim() || next[idx].email,
      role: params.role,
      lastLoginAt: now,
      loginCount: next[idx].loginCount + 1,
    };
  } else {
    next = [
      {
        id: crypto.randomUUID(),
        name: params.name.trim() || "Unknown",
        email: params.email.trim(),
        role: params.role,
        lastLoginAt: now,
        loginCount: 1,
      },
      ...current,
    ];
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(LOGIN_ACTIVITY_KEY, JSON.stringify(next));
  }
  return next;
};
