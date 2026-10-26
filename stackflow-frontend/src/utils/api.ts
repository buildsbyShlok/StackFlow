import axios from "axios";
import type { Session } from "@/types";
const baseURL =
  (import.meta.env.PROD ? "" : (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000")).replace(
    /\/$/,
    "",
  ) + "/api";
let token: string | null = null;
export function saveSession(session: Session) {
  token = session.accessToken;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("user");
}
export function clearSession() {
  token = null;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("user");
}
const API = axios.create({ baseURL, withCredentials: true, timeout: 15000 });
const refreshClient = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 15000,
});
let refreshPromise: Promise<Session> | null = null;
export function refreshSession() {
  if (!refreshPromise)
    refreshPromise = refreshClient
      .get<Session>("/auth/refresh")
      .then(({ data }) => {
        saveSession(data);
        return data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  return refreshPromise;
}
API.interceptors.request.use((config) => {
  if (token) config.headers.Authorization = "Bearer " + token;
  return config;
});
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (
      error.response?.status === 401 &&
      config &&
      !config._retried &&
      !config.url?.startsWith("/auth/")
    ) {
      config._retried = true;
      try {
        await refreshSession();
        return API(config);
      } catch {
        clearSession();
        window.dispatchEvent(new Event("session-expired"));
      }
    }
    return Promise.reject(error);
  },
);
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response)
      return "Cannot reach StackFlow. Check your connection and try again.";
    if (error.response.status >= 500)
      return "The server could not complete this request. Please try again.";
    return typeof error.response.data?.message === "string"
      ? error.response.data.message
      : "This request could not be completed.";
  }
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
export default API;
