import { authStore } from "./auth";
import { getApiBase } from "./config";

export interface ApiError extends Error {
  status: number;
  body: unknown;
}

async function request<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (init.auth !== false) {
    const token = authStore.getState().accessToken;
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${getApiBase()}${path}`, { ...init, headers });
  const ct = res.headers.get("content-type") ?? "";
  const body = ct.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    if (typeof body === "object" && body && "detail" in body) {
      const detail = (body as { detail: unknown }).detail;
      if (Array.isArray(detail)) {
        message = detail.map((e: { msg?: string }) => e.msg ?? String(e)).join("; ");
      } else {
        message = String(detail);
      }
    }
    const err = new Error(message) as ApiError;
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body as T;
}

export interface Fire {
  id: string;
  lat: number;
  lon: number;
  confidence: number;
  report_count: number;
  first_seen_at: string;
  last_seen_at: string;
  is_active: boolean;
}

export interface FireDetail extends Fire {
  photo_urls: string[];
}

export interface Report {
  id: string;
  user_id: string;
  lat: number;
  lon: number;
  bearing_deg: number;
  bearing_acc_deg: number;
  gps_acc_m: number;
  photo_url: string | null;
  taken_at: string;
  fire_id: string | null;
  status: string;
}

export interface PublicReport {
  id: string;
  lat: number;
  lon: number;
  bearing_deg: number;
  bearing_acc_deg: number;
  taken_at: string;
  fire_id: string | null;
  status: string;
}

export interface Weather {
  temperature: number;
  wind_speed: number;
  wind_direction_deg: number;
  wind_direction: string;
}

export interface FireZone {
  id: string;
  created_by: string;
  coordinates: [number, number][];
  label: string | null;
  color: string;
  is_active: boolean;
  created_at: string;
}

export const api = {
  fires: {
    list: (bbox?: { minLat: number; maxLat: number; minLon: number; maxLon: number }) => {
      const qs = bbox
        ? `?min_lat=${bbox.minLat}&max_lat=${bbox.maxLat}&min_lon=${bbox.minLon}&max_lon=${bbox.maxLon}`
        : "";
      return request<Fire[]>(`/api/v1/fires${qs}`, { auth: false });
    },
    detail: (id: string) => request<FireDetail>(`/api/v1/fires/${id}`, { auth: false }),
  },
  auth: {
    register: (body: { email: string; password: string; display_name: string; role?: string }) =>
      request<{ access_token: string; refresh_token: string; role: string }>("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
        auth: false,
      }),
    login: (body: { email: string; password: string }) =>
      request<{ access_token: string; refresh_token: string; role: string }>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
        auth: false,
      }),
    refresh: (refresh_token: string) =>
      request<{ access_token: string; refresh_token: string }>("/api/v1/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token }),
        auth: false,
      }),
    me: () =>
      request<{ id: string; email: string; display_name: string; is_verified: boolean }>(
        "/api/v1/users/me",
      ),
  },
  reports: {
    submit: (form: FormData) =>
      request<{ report: Report; fire_id: string | null; matched: boolean }>("/api/v1/reports", {
        method: "POST",
        body: form,
      }),
    mine: () => request<Report[]>("/api/v1/reports/mine"),
    list: (opts?: { sinceMin?: number }) => {
      const qs = opts?.sinceMin ? `?since_min=${opts.sinceMin}` : "";
      return request<PublicReport[]>(`/api/v1/reports${qs}`, { auth: false });
    },
    submitDemo: (body: {
      lat: number;
      lon: number;
      bearing_deg: number;
      bearing_acc_deg?: number;
      gps_acc_m?: number;
    }) =>
      request<{ report: Report; fire_id: string | null; matched: boolean }>(
        "/api/v1/reports/demo",
        {
          method: "POST",
          body: JSON.stringify(body),
          auth: false,
        },
      ),
  },
  weather: {
    get: (lat: number, lon: number) =>
      request<Weather>(`/api/v1/weather?lat=${lat}&lon=${lon}`, { auth: false }),
  },
  fireZones: {
    list: () => request<FireZone[]>("/api/v1/fire-zones", { auth: false }),
    create: (body: { coordinates: [number, number][]; label?: string | null; color?: string }) =>
      request<FireZone>("/api/v1/fire-zones", { method: "POST", body: JSON.stringify(body) }),
    delete: (id: string) =>
      request<void>(`/api/v1/fire-zones/${id}`, { method: "DELETE" }),
  },
};
