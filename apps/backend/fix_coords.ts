import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const table15 = await prisma.table.findFirst({ where: { number: '15' } });
  const table16 = await prisma.table.findFirst({ where: { number: '16' } });
  
  if (table15 && table16) {
    if (Math.abs(table15.x - table16.x) < 5 && Math.abs(table15.y - table16.y) < 5) {
      console.log('Tables overlap, fixing table 15...');
      // move table 15 left and up
      await prisma.table.update({
        where: { id: table15.id },
        data: { x: Math.max(0, table16.x - 12), y: Math.max(0, table16.y - 12) }
      });
      console.log('Table 15 moved.');
    } else {
      console.log('Tables already spaced apart. Current coords:');
      console.log(`15: x=${table15.x}, y=${table15.y}`);
      console.log(`16: x=${table16.x}, y=${table16.y}`);
      
      // Let's just force move 15 further left/up to be safe
      await prisma.table.update({
        where: { id: table15.id },
        data: { x: table16.x, y: table16.y - 12 }
      });
      console.log('Forced moved 15 above 16.');
    }
  }
}
main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
