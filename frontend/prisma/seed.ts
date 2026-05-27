import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.plan.upsert({
    where: { id: "free" },
    update: {
      name: "Free",
      auditsPerMonth: 3,
      maxPages: 20,
      whiteLabel: false,
      price: 0,
      maxSites: 1,
      autoIndexing: false,
      reportFrequency: "none",
    },
    create: {
      id: "free",
      name: "Free",
      auditsPerMonth: 3,
      maxPages: 20,
      whiteLabel: false,
      price: 0,
      maxSites: 1,
      autoIndexing: false,
      reportFrequency: "none",
    },
  });

  await prisma.plan.upsert({
    where: { id: "pro" },
    update: {
      name: "Pro",
      auditsPerMonth: 999999,
      maxPages: 200,
      whiteLabel: false,
      price: 15,
      maxSites: 5,
      autoIndexing: true,
      reportFrequency: "weekly",
    },
    create: {
      id: "pro",
      name: "Pro",
      auditsPerMonth: 999999,
      maxPages: 200,
      whiteLabel: false,
      price: 15,
      maxSites: 5,
      autoIndexing: true,
      reportFrequency: "weekly",
    },
  });

  await prisma.plan.upsert({
    where: { id: "agency" },
    update: {
      name: "Agency",
      auditsPerMonth: 999999,
      maxPages: 1000,
      whiteLabel: true,
      price: 35,
      maxSites: 10,
      autoIndexing: true,
      reportFrequency: "daily",
    },
    create: {
      id: "agency",
      name: "Agency",
      auditsPerMonth: 999999,
      maxPages: 1000,
      whiteLabel: true,
      price: 35,
      maxSites: 10,
      autoIndexing: true,
      reportFrequency: "daily",
    },
  });

  console.log("Seeded 3 plans: free, pro, agency");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
