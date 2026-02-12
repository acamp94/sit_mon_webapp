'use client';

import { useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';

type Cluster = {
  id: string;
  locationKey: string;
  name: string | null;
  lat: number;
  lon: number;
  count: number;
};

type Article = {
  id: string;
  title: string;
  url: string;
  sourceCountry: string | null;
  language: string | null;
  publishedAt: string | null;
};

const icon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

export default function MapCanvas({
  clusters,
  articlesByLocation
}: {
  clusters: Cluster[];
  articlesByLocation: Record<string, Article[]>;
}) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const prepared = useMemo(() => clusters.filter((cluster) => Number.isFinite(cluster.lat) && Number.isFinite(cluster.lon)), [clusters]);

  return (
    <MapContainer center={[20, 0]} zoom={2} minZoom={2} style={{ height: '100vh', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MarkerClusterGroup chunkedLoading>
        {prepared.map((cluster) => (
          <Marker
            key={cluster.id}
            position={[cluster.lat, cluster.lon]}
            icon={icon}
            eventHandlers={{
              click: () => setActiveKey(cluster.locationKey)
            }}
          >
            <Popup autoPan keepInView>
              <article tabIndex={0}>
                <h3>{cluster.name ?? 'Unknown location'}</h3>
                <p>{cluster.count} mentions</p>
                <ul>
                  {(articlesByLocation[cluster.locationKey] ?? []).slice(0, 5).map((article) => (
                    <li key={article.id}>
                      <a href={article.url} target="_blank" rel="noreferrer">
                        {article.title}
                      </a>
                      <div>
                        {(article.sourceCountry ?? 'N/A')} · {article.publishedAt ? new Date(article.publishedAt).toLocaleString() : 'Unknown'}
                      </div>
                    </li>
                  ))}
                </ul>
                {activeKey === cluster.locationKey ? <button onClick={() => setActiveKey(null)}>Close</button> : null}
              </article>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
