import { prisma } from '@/lib/prisma';
import { fetchDocArticles, fetchGeoMentions } from '@/lib/gdelt';
import { broadcast } from '@/lib/sse';

const globalState = globalThis as unknown as {
  ingestLock?: boolean;
  lastRefreshAt?: string;
};

type RefreshOptions = {
  profileId?: string;
};

export async function refreshProfiles(options: RefreshOptions = {}) {
  if (globalState.ingestLock) {
    return { ok: true, skipped: true, refreshedAt: globalState.lastRefreshAt ?? null };
  }

  globalState.ingestLock = true;

  try {
    const profiles = await prisma.queryProfile.findMany({
      where: options.profileId ? { id: options.profileId } : undefined,
      orderBy: { createdAt: 'asc' }
    });

    for (const profile of profiles) {
      const ingestRun = await prisma.ingestRun.create({
        data: {
          queryProfileId: profile.id,
          status: 'running'
        }
      });

      try {
        const articles = await fetchDocArticles(profile.queryString, profile.timespan);
        const geo = await fetchGeoMentions(profile.queryString, profile.timespan);

        const geoByUrl = new Map<string, string>();
        const topGeo = geo.slice(0, 300);
        for (const point of topGeo) {
          if (point.url) {
            geoByUrl.set(normalizeUrl(point.url), point.locationKey);
          }
          await prisma.geoCluster.upsert({
            where: {
              locationKey_queryProfileId: {
                locationKey: point.locationKey,
                queryProfileId: profile.id
              }
            },
            update: {
              name: point.name,
              lat: point.lat,
              lon: point.lon,
              count: point.count
            },
            create: {
              queryProfileId: profile.id,
              locationKey: point.locationKey,
              name: point.name,
              lat: point.lat,
              lon: point.lon,
              count: point.count
            }
          });
        }

        for (const article of articles) {
          const normalized = normalizeUrl(article.url);
          const locationKey = geoByUrl.get(normalized) ?? topGeo[0]?.locationKey ?? null;
          await prisma.article.upsert({
            where: { url: article.url },
            update: {
              queryProfileId: profile.id,
              title: article.title,
              sourceCountry: article.sourceCountry,
              language: article.language,
              publishedAt: article.publishedAt,
              locationKey
            },
            create: {
              queryProfileId: profile.id,
              title: article.title,
              url: article.url,
              sourceCountry: article.sourceCountry,
              language: article.language,
              publishedAt: article.publishedAt,
              locationKey
            }
          });
        }

        await prisma.ingestRun.update({
          where: { id: ingestRun.id },
          data: {
            status: 'success',
            finishedAt: new Date()
          }
        });

        broadcast({
          type: 'update',
          profileId: profile.id,
          refreshedAt: new Date().toISOString()
        });
      } catch (error) {
        await prisma.ingestRun.update({
          where: { id: ingestRun.id },
          data: {
            status: 'failed',
            errorText: error instanceof Error ? error.message : String(error),
            finishedAt: new Date()
          }
        });

        broadcast({
          type: 'error',
          profileId: profile.id,
          message: error instanceof Error ? error.message : 'Unknown ingest error'
        });
      }
    }

    const refreshedAt = new Date().toISOString();
    globalState.lastRefreshAt = refreshedAt;
    return { ok: true, refreshedAt, skipped: false };
  } finally {
    globalState.ingestLock = false;
  }
}

function normalizeUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString();
  } catch {
    return url;
  }
}
