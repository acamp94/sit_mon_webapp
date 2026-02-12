const GDELT_DOC = 'https://api.gdeltproject.org/api/v2/doc/doc';
const GDELT_GEO = 'https://api.gdeltproject.org/api/v2/geo/geo';

const globalCache = globalThis as unknown as {
  gdeltCache?: Map<string, { expiresAt: number; value: unknown }>;
};

const cache = globalCache.gdeltCache ?? new Map<string, { expiresAt: number; value: unknown }>();
globalCache.gdeltCache = cache;

async function fetchWithRetry(url: string, retries = 3): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, { next: { revalidate: 60 } });
      if (!response.ok) {
        throw new Error(`GDELT request failed (${response.status})`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
  throw lastError;
}

async function cachedFetch(key: string, url: string, ttlMs = 90_000): Promise<unknown> {
  const existing = cache.get(key);
  if (existing && existing.expiresAt > Date.now()) {
    return existing.value;
  }
  const value = await fetchWithRetry(url);
  cache.set(key, { expiresAt: Date.now() + ttlMs, value });
  return value;
}

export async function fetchDocArticles(query: string, timespan: string) {
  const params = new URLSearchParams({
    query,
    mode: 'artlist',
    format: 'json',
    maxrecords: '75',
    sort: 'datedesc',
    timespan
  });
  const url = `${GDELT_DOC}?${params.toString()}`;
  const raw = (await cachedFetch(`doc:${query}:${timespan}`, url)) as Record<string, unknown>;
  const records = Array.isArray(raw.articles) ? raw.articles : [];

  return records.map((record: any) => ({
    title: record.title ?? 'Untitled',
    url: record.url,
    sourceCountry: record.sourcecountry ?? null,
    language: record.language ?? null,
    publishedAt: record.seendate ? new Date(record.seendate) : null
  })).filter((item: any) => Boolean(item.url));
}

export async function fetchGeoMentions(query: string, timespan: string) {
  const params = new URLSearchParams({
    query,
    mode: 'PointList',
    format: 'json',
    maxrecords: '250',
    sort: 'datedesc',
    timespan
  });
  const url = `${GDELT_GEO}?${params.toString()}`;
  const raw = (await cachedFetch(`geo:${query}:${timespan}`, url)) as Record<string, unknown>;

  const features = Array.isArray(raw.features)
    ? raw.features
    : Array.isArray(raw.articles)
      ? raw.articles
      : [];

  return features.map((feature: any) => {
    const props = feature.properties ?? feature;
    const lat = Number(feature?.geometry?.coordinates?.[1] ?? props.lat ?? props.latitude ?? 0);
    const lon = Number(feature?.geometry?.coordinates?.[0] ?? props.lon ?? props.longitude ?? 0);
    const locationKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    return {
      locationKey,
      name: props.name ?? props.location ?? props.admin1name ?? props.country ?? 'Unknown location',
      lat,
      lon,
      count: Number(props.count ?? props.numarticles ?? 1),
      url: props.url ?? props.documentidentifier ?? null
    };
  }).filter((row: any) => Number.isFinite(row.lat) && Number.isFinite(row.lon) && row.lat !== 0 && row.lon !== 0);
}
