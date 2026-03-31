import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function check() {
  const tables = await prisma.table.findMany({ select: { number: true } });
  const numbers = tables.map(t => t.number);
  const duplicates = numbers.filter((item, index) => numbers.indexOf(item) !== index);
  console.log('Duplicate numbers:', duplicates);
  console.log('Total tables:', tables.length);
}
check().finally(() => prisma.$disconnect());
