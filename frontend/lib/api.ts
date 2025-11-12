const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Handle token refresh or redirect to login
          if (typeof window !== "undefined") {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            window.location.href = "/login";
          }
        }
        const error = await response.json().catch(() => ({ error: `Request failed: ${response.status}` }));
        const errorMessage = error.error || error.message || `Request failed: ${response.status}`;
        console.error(`API Error [${response.status}]:`, errorMessage, error);
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error: any) {
      // Handle network errors
      if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
        throw new Error("Unable to connect to the server. Please check if the API Gateway is running.");
      }
      throw error;
    }
  }

  get<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: "GET" });
  }

  post<T>(endpoint: string, data?: unknown) {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  put<T>(endpoint: string, data?: unknown) {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: "DELETE" });
  }
}

export const api = new ApiClient(API_BASE_URL);

