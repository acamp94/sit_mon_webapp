import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const defaults = [
    {
      name: 'World Breaking',
      queryString: '(war OR earthquake OR shooting OR flood OR protest)',
      timespan: '24h',
      filtersJson: { language: 'all', sourceCountry: 'all', topN: 100 }
    },
    {
      name: 'Elections',
      queryString: 'election OR vote OR campaign',
      timespan: '24h',
      filtersJson: { language: 'all', sourceCountry: 'all', topN: 100 }
    },
    {
      name: 'Cyber',
      queryString: '(ransomware OR data breach OR malware)',
      timespan: '7d',
      filtersJson: { language: 'all', sourceCountry: 'all', topN: 100 }
    }
  ];

  for (const profile of defaults) {
    await prisma.queryProfile.upsert({
      where: { name: profile.name },
      update: {
        queryString: profile.queryString,
        timespan: profile.timespan,
        filtersJson: profile.filtersJson
      },
      create: profile
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
