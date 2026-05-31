const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getApiBaseUrl() {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  if (process.env.NODE_ENV !== "development") {
    return "";
  }

  return normalizeBaseUrl(configuredBaseUrl || DEFAULT_API_BASE_URL);
}

export function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${normalizedPath}`;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function requestApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "detail" in payload && typeof payload.detail === "string"
        ? payload.detail
        : `Request failed with status ${response.status}.`;
    throw new ApiError(detail, response.status);
  }

  return payload as T;
}
