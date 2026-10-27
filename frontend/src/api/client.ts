export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

export interface HealthCheckData {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  environment: string;
  service: string;
  database: {
    status: string;
    healthy: boolean;
  };
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export async function apiClient<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const headers = new Headers(options?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const body = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !body.success) {
    const errorMessage = body.error?.message || `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return body.data;
}

export const fetchHealthCheck = async (): Promise<HealthCheckData> => {
  return apiClient<HealthCheckData>('/api/health');
};
