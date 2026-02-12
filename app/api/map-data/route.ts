import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get('profileId');
  const language = searchParams.get('language') || 'all';
  const sourceCountry = searchParams.get('sourceCountry') || 'all';
  const topN = Number(searchParams.get('topN') || '100');

  const whereProfile = profileId ? { id: profileId } : undefined;

  const profile = await prisma.queryProfile.findFirst({
    where: whereProfile,
    orderBy: { createdAt: 'asc' }
  });

  if (!profile) {
    return Response.json({ clusters: [], articlesByLocation: {}, health: null, profile: null });
  }

  const articleWhere = {
    queryProfileId: profile.id,
    ...(language !== 'all' ? { language } : {}),
    ...(sourceCountry !== 'all' ? { sourceCountry } : {})
  };

  const clusters = await prisma.geoCluster.findMany({
    where: { queryProfileId: profile.id },
    orderBy: { count: 'desc' },
    take: topN
  });

  const articles = await prisma.article.findMany({
    where: articleWhere,
    orderBy: { publishedAt: 'desc' },
    take: 300
  });

  const articlesByLocation = articles.reduce<Record<string, typeof articles>>((acc, article) => {
    if (!article.locationKey) return acc;
    if (!acc[article.locationKey]) acc[article.locationKey] = [];
    acc[article.locationKey].push(article);
    return acc;
  }, {});

  const latestRun = await prisma.ingestRun.findFirst({
    where: { queryProfileId: profile.id },
    orderBy: { startedAt: 'desc' }
  });

  return Response.json({
    profile,
    clusters,
    articlesByLocation,
    health: latestRun
      ? {
          status: latestRun.status,
          startedAt: latestRun.startedAt,
          finishedAt: latestRun.finishedAt,
          errorText: latestRun.errorText
        }
      : null
  });
}
