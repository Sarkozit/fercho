import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixDuplicates() {
  console.log('--- Reseteando Numeración de Mesas ---');
  
  // Get all tables ordered by their current number then ID
  const allTables = await prisma.table.findMany({
    orderBy: [
      { number: 'asc' },
      { id: 'asc' }
    ]
  });

  console.log(`Encontradas ${allTables.length} mesas. Re-numerando...`);

  for (let i = 0; i < allTables.length; i++) {
    const table = allTables[i];
    const newNumber = i + 1;
    
    await prisma.table.update({
      where: { id: table.id },
      data: { number: newNumber }
    });
    
    console.log(`Mesa ID ${table.id}: ${table.number} -> ${newNumber}`);
  }

  console.log('--- Proceso Completado ---');
}

fixDuplicates()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
