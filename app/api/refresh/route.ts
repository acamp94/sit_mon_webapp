import { refreshProfiles } from '@/lib/ingest';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const result = await refreshProfiles({ profileId: body?.profileId });
  return Response.json(result);
}
