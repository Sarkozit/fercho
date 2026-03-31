import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  const table = await prisma.table.findFirst({ where: { status: 'OCCUPIED' }, include: { activeSale: { include: { items: true } } }});
  if (!table) return console.log("No occupied table");
  console.log("Before: table status", table.status, "activeSale items", table.activeSale?.items.length);
  
  await prisma.sale.updateMany({
    where: { tableId: table.id, NOT: { status: 'CLOSED' } },
    data: { status: 'CLOSED', tableId: null, closedAt: new Date() }
  });

  const updatedTable = await prisma.table.update({
    where: { id: table.id },
    data: { status: 'FREE' },
    include: { activeSale: { include: { items: true } } }
  });
  console.log("After: table status", updatedTable.status, "activeSale", updatedTable.activeSale);
}
test().finally(() => prisma.$disconnect());
