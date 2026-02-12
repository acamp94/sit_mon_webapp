export type Timespan = '1h' | '6h' | '24h' | '7d';

export type FilterState = {
  language?: string;
  sourceCountry?: string;
  topN?: number;
};

export type StreamPayload = {
  type: 'connected' | 'heartbeat' | 'update' | 'error';
  profileId?: string;
  message?: string;
  refreshedAt?: string;
};
