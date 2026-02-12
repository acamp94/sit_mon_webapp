import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  const profiles = await prisma.queryProfile.findMany({
    orderBy: { createdAt: 'asc' }
  });
  return Response.json({ profiles });
}
