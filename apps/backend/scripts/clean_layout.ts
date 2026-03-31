import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanLayout() {
  const rooms = await prisma.room.findMany({ include: { tables: true } });
  
  for (const room of rooms) {
    console.log(`Processing room: ${room.name}`);
    const tables = room.tables.sort((a, b) => a.number - b.number);
    
    // Grid 12x10
    let col = 0;
    let row = 0;
    
    for (const table of tables) {
      const gridX = 100 / 12;
      const gridY = 10;
      
      const x = (col * gridX) + (gridX / 2); // strictly centered 4.16% increments
      const y = (row * gridY) + (gridY / 2);  // strictly centered 5% increments
      
      await prisma.table.update({
        where: { id: table.id },
        data: { x, y }
      });
      
      console.log(`Table ${table.number} -> (${x.toFixed(2)}, ${y.toFixed(2)})`);
      
      col++;
      if (col >= 12) {
        col = 0;
        row++;
      }
    }
  }
}

cleanLayout()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
