import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.plan.upsert({
    where: { id: "free" },
    update: {},
    create: {
      id: "free",
      name: "Free",
      auditsPerMonth: 1,
      maxPages: 50,
      whiteLabel: false,
      price: 0,
    },
  });

  await prisma.plan.upsert({
    where: { id: "pro" },
    update: {},
    create: {
      id: "pro",
      name: "Pro",
      auditsPerMonth: 10,
      maxPages: 500,
      whiteLabel: false,
      price: 29,
    },
  });

  await prisma.plan.upsert({
    where: { id: "agency" },
    update: {},
    create: {
      id: "agency",
      name: "Agency",
      auditsPerMonth: 9999,
      maxPages: 2000,
      whiteLabel: true,
      price: 99,
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
