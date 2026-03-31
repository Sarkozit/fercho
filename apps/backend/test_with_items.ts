import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  const admin = await prisma.user.findFirst();
  const product = await prisma.product.findFirst();
  let table = await prisma.table.findFirst();

  // force occupy
  await prisma.table.update({ where: { id: table!.id }, data: { status: 'OCCUPIED' } });
  let sale = await prisma.sale.create({ data: { tableId: table!.id, userId: admin!.id, status: 'OPEN' } });

  await prisma.saleItem.create({
    data: { saleId: sale.id, productId: product!.id, price: product!.price, quantity: 1 }
  });

  const before = await prisma.table.findUnique({ where: { id: table!.id }, include: { activeSale: { include: { items: true } } } });
  console.log("Before items:", before?.activeSale?.items.length);

  await prisma.sale.updateMany({
    where: { tableId: table!.id, NOT: { status: 'CLOSED' } },
    data: { status: 'CLOSED', tableId: null, closedAt: new Date() }
  });
  await prisma.table.update({ where: { id: table!.id }, data: { status: 'FREE' } });

  const after = await prisma.table.findUnique({ where: { id: table!.id }, include: { activeSale: { include: { items: true } } } });
  console.log("After activeSale:", after?.activeSale);
}
test().finally(() => prisma.$disconnect());
