'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

type QueryProfile = {
  id: string;
  name: string;
  queryString: string;
  timespan: string;
};

type Cluster = {
  id: string;
  locationKey: string;
  name: string | null;
  lat: number;
  lon: number;
  count: number;
  updatedAt: string;
};

type Article = {
  id: string;
  title: string;
  url: string;
  sourceCountry: string | null;
  language: string | null;
  publishedAt: string | null;
};

const MapCanvas = dynamic(() => import('@/components/MapCanvas'), { ssr: false });

const refreshEveryMs = 180_000;

export default function SituationMonitorApp() {
  const [profiles, setProfiles] = useState<QueryProfile[]>([]);
  const [profileId, setProfileId] = useState<string>('');
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [articlesByLocation, setArticlesByLocation] = useState<Record<string, Article[]>>({});
  const [language, setLanguage] = useState('all');
  const [sourceCountry, setSourceCountry] = useState('all');
  const [topN, setTopN] = useState(100);
  const [health, setHealth] = useState<{ status: string; finishedAt?: string; errorText?: string } | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>('Never');
  const [loading, setLoading] = useState(true);

  const currentProfile = useMemo(() => profiles.find((profile) => profile.id === profileId), [profiles, profileId]);

  async function loadProfiles() {
    const response = await fetch('/api/query-profiles');
    const data = await response.json();
    setProfiles(data.profiles ?? []);
    if (!profileId && data.profiles?.[0]?.id) {
      setProfileId(data.profiles[0].id);
    }
  }

  async function loadMapData() {
    if (!profileId) return;
    setLoading(true);
    const params = new URLSearchParams({
      profileId,
      language,
      sourceCountry,
      topN: String(topN)
    });

    const response = await fetch(`/api/map-data?${params.toString()}`);
    const data = await response.json();
    setClusters(data.clusters ?? []);
    setArticlesByLocation(data.articlesByLocation ?? {});
    setHealth(data.health);
    setLoading(false);
  }

  async function triggerRefresh() {
    if (!profileId) return;
    await fetch('/api/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId })
    });
  }

  useEffect(() => {
    loadProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadMapData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, language, sourceCountry, topN]);

  useEffect(() => {
    const eventSource = new EventSource('/api/stream');
    eventSource.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'update' && (!payload.profileId || payload.profileId === profileId)) {
        setLastRefresh(payload.refreshedAt ?? new Date().toISOString());
        loadMapData();
      }
      if (payload.type === 'heartbeat') {
        setLastRefresh(payload.refreshedAt ?? new Date().toISOString());
      }
    };

    return () => eventSource.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  useEffect(() => {
    const interval = setInterval(() => {
      triggerRefresh();
    }, refreshEveryMs);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  return (
    <main className="app-shell">
      <aside className="panel">
        <h1>Situation Monitor</h1>
        <p className="muted">Real-time event map via GDELT + SSE.</p>

        <label>
          Query profile
          <select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Query preview
          <textarea value={currentProfile?.queryString ?? ''} readOnly rows={3} />
        </label>

        <label>
          Time window
          <input value={currentProfile?.timespan ?? ''} readOnly />
        </label>

        <label>
          Language
          <input value={language} onChange={(e) => setLanguage(e.target.value || 'all')} placeholder="all / eng / spa..." />
        </label>

        <label>
          Source country
          <input value={sourceCountry} onChange={(e) => setSourceCountry(e.target.value || 'all')} placeholder="all / US / GBR..." />
        </label>

        <label>
          Top locations
          <input
            type="number"
            min={5}
            max={500}
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value || 100))}
          />
        </label>

        <button onClick={triggerRefresh}>Refresh now</button>

        <section className="health" aria-live="polite">
          <h2>Feed health</h2>
          <p>Status: {health?.status ?? 'unknown'}</p>
          <p>Last refresh: {lastRefresh}</p>
          {health?.errorText ? <p className="error">Error: {health.errorText}</p> : null}
        </section>
      </aside>

      <section className="map-wrap" aria-busy={loading}>
        {loading ? <div className="loading">Loading map data…</div> : null}
        <MapCanvas clusters={clusters} articlesByLocation={articlesByLocation} />
      </section>
    </main>
  );
}
