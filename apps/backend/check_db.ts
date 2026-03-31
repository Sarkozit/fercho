import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const tables = await prisma.table.findMany({
    where: { number: { in: [13, 10] } },
    include: { activeSale: { include: { items: true } } }
  });
  console.log(JSON.stringify(tables, null, 2));
}

check().finally(() => prisma.$disconnect());
