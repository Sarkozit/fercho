import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const adminPassword = 'adminpassword123';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      name: 'System Administrator',
      role: UserRole.ADMIN,
      active: true,
    },
  });

  // Rooms
  const salon1 = await prisma.room.upsert({
    where: { id: 'room-1' },
    update: {},
    create: {
      id: 'room-1',
      name: 'Salón 1',
    },
  });

  const afuera = await prisma.room.upsert({
    where: { id: 'room-2' },
    update: {},
    create: {
      id: 'room-2',
      name: 'Afuera',
    },
  });

  // Tables for Salón 1
  const tablesData = [
    // Col 0 (4.16%)
    { number: 16, x: 4.16, y: 5, shape: 'square' },
    { number: 15, x: 4.16, y: 15, shape: 'circle' },
    { number: 11, x: 4.16, y: 25, shape: 'square' },
    { number: 5, x: 4.16, y: 75, shape: 'circle' },
    { number: 4, x: 4.16, y: 85, shape: 'circle' },
    { number: 1, x: 4.16, y: 95, shape: 'square' },

    // Col 1 (12.5%)
    { number: 17, x: 12.5, y: 5, shape: 'square', status: 'OCCUPIED' },
    { number: 12, x: 12.5, y: 25, shape: 'square' },
    { number: 2, x: 12.5, y: 95, shape: 'square' },

    // Col 2 (20.83%)
    { number: 6, x: 20.83, y: 75, shape: 'circle' },
    { number: 18, x: 20.83, y: 25, shape: 'square' },
    { number: 3, x: 20.83, y: 95, shape: 'square' },

    // Col 7 (62.5%)
    { number: 8, x: 62.5, y: 75, shape: 'square' },
    { number: 7, x: 62.5, y: 85, shape: 'square' },

    // Col 10 (87.5%)
    { number: 13, x: 87.5, y: 45, shape: 'square' },
    { number: 19, x: 87.5, y: 25, shape: 'square' },

    // Col 11 (95.83%)
    { number: 95.83, x: 95.83, y: 45, shape: 'square' }, // Fixed mapping below
    { number: 14, x: 95.83, y: 45, shape: 'square' },
    { number: 10, x: 95.83, y: 75, shape: 'square' },
    { number: 9, x: 95.83, y: 85, shape: 'square' },
  ];

  // CLEAN ALL TABLES IN SALON 1 BEFORE SEEDED TO AVOID DUPLICATES AND MISALIGNMENTS
  await prisma.table.deleteMany({
    where: { roomId: salon1.id }
  });

  // Re-adjusting for 8x8 Grid (12.5% unit)
  // Center snapped for 8x8: 6.25, 18.75, 31.25, 43.75, 56.25, 68.75, 81.25, 93.75
  const cleanedTables = [
    // --- ROW 0 (Y: 6.25 for all) ---
    { number: 16, x: 6.25, y: 6.25, shape: 'square' },
    { number: 17, x: 18.75, y: 6.25, shape: 'square' },
    { number: 18, x: 31.25, y: 6.25, shape: 'square' },
    { number: 19, x: 43.75, y: 6.25, shape: 'square' },
    { number: 20, x: 56.25, y: 6.25, shape: 'square' },
    { number: 21, x: 68.75, y: 6.25, shape: 'square' },
    { number: 22, x: 81.25, y: 6.25, shape: 'square' },
    { number: 23, x: 93.75, y: 6.25, shape: 'square' },

    // --- ROW 1 (Y: 18.75) ---
    { number: 15, x: 6.25, y: 18.75, shape: 'circle' },
    { number: 24, x: 18.75, y: 18.75, shape: 'square' },
    { number: 25, x: 31.25, y: 18.75, shape: 'square' },
    { number: 26, x: 43.75, y: 18.75, shape: 'square' },
    { number: 27, x: 56.25, y: 18.75, shape: 'square' },
    { number: 28, x: 68.75, y: 18.75, shape: 'square' },
    { number: 29, x: 81.25, y: 18.75, shape: 'square' },
    { number: 30, x: 93.75, y: 18.75, shape: 'square' },

    // --- ROW 2 (Y: 31.25) ---
    { number: 11, x: 6.25, y: 31.25, shape: 'square' },
    { number: 12, x: 18.75, y: 31.25, shape: 'square' },
    { number: 31, x: 31.25, y: 31.25, shape: 'square' },
    { number: 32, x: 43.75, y: 31.25, shape: 'square' },
    { number: 33, x: 56.25, y: 31.25, shape: 'square' },

    // --- ROW 3 & 4 (Mid-Right) ---
    { number: 13, x: 68.75, y: 43.75, shape: 'square' },
    { number: 14, x: 81.25, y: 43.75, shape: 'square' },

    // --- ROW 6 (Y: 81.25) ---
    { number: 5, x: 6.25, y: 81.25, shape: 'circle' },
    { number: 6, x: 18.75, y: 81.25, shape: 'circle' },
    { number: 8, x: 56.25, y: 81.25, shape: 'square' },
    { number: 10, x: 81.25, y: 81.25, shape: 'square' },

    // --- ROW 7 (Bottom - Y: 93.75) ---
    { number: 4, x: 6.25, y: 93.75, shape: 'circle' },
    { number: 1, x: 18.75, y: 93.75, shape: 'square' },
    { number: 2, x: 31.25, y: 93.75, shape: 'square' },
    { number: 3, x: 43.75, y: 93.75, shape: 'square' },
    { number: 7, x: 56.25, y: 93.75, shape: 'square' },
    { number: 9, x: 81.25, y: 93.75, shape: 'square' },
  ];

  for (const table of cleanedTables) {
    await prisma.table.create({
      data: {
        id: `table-s1-${table.number}`,
        ...table,
        roomId: salon1.id,
      },
    });
  }

  // Categories and Products
  const bebidas = await prisma.category.upsert({
    where: { name: 'Bebidas' },
    update: {},
    create: { name: 'Bebidas' }
  });

  const productsData = [
    { name: 'Adición de Michelada', price: 12000, favorite: true },
    { name: 'Agua', price: 5000, favorite: true },
    { name: 'Aguila Light', price: 8000, favorite: true },
    { name: 'Aguila Normal', price: 8000, favorite: true },
    { name: 'Cocacola', price: 6000, favorite: true },
    { name: 'Corona', price: 15000, favorite: true },
    { name: 'Gatorade', price: 9000, favorite: true },
    { name: 'Pilsen', price: 8000, favorite: true },
    { name: 'Hamburguesa Fercho', price: 28000, favorite: false },
    { name: 'Papas Fritas', price: 12000, favorite: false },
  ];

  for (const product of productsData) {
    await prisma.product.upsert({
      where: { name: product.name },
      update: { ...product, categoryId: bebidas.id },
      create: { ...product, categoryId: bebidas.id }
    });
  }

  // Kitchens
  const kitchensData = [
    { name: 'Barra', sortOrder: 0 },
    { name: 'Cocina', sortOrder: 1 },
    { name: 'Tienda', sortOrder: 2 },
    { name: 'Cabalgatas', sortOrder: 3 },
  ];
  for (const kitchen of kitchensData) {
    await prisma.kitchen.upsert({
      where: { name: kitchen.name },
      update: { sortOrder: kitchen.sortOrder },
      create: kitchen,
    });
  }

  // Payment Methods
  const paymentMethodsData = [
    { name: 'Efectivo', sortOrder: 0 },
    { name: 'QR', sortOrder: 1 },
    { name: 'Bold', sortOrder: 2 },
  ];
  for (const pm of paymentMethodsData) {
    await prisma.paymentMethod.upsert({
      where: { name: pm.name },
      update: { sortOrder: pm.sortOrder },
      create: pm,
    });
  }

  console.log('Seeded admin user, rooms, tables, products, kitchens, and payment methods.');

  // Suppliers (examples — user will add real ones)
  const suppliersData = [
    { name: 'Proveedor General', sortOrder: 0 },
  ];
  for (const sup of suppliersData) {
    await prisma.supplier.upsert({
      where: { name: sup.name },
      update: { sortOrder: sup.sortOrder },
      create: sup,
    });
  }

  console.log('Seeded suppliers.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
