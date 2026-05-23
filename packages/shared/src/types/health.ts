/**
 * Health check response shape — used by the API and consumed by the web client.
 */
export interface HealthLiveResponse {
  status: 'ok';
  uptime: number;
  timestamp: string;
}

export interface HealthReadyResponse {
  status: 'ok' | 'degraded';
  checks: {
    database: 'ok' | 'down';
    redis: 'ok' | 'down';
  };
  timestamp: string;
}
