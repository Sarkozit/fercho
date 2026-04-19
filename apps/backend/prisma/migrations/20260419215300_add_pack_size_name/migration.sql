-- Add packSize and packName to Product
ALTER TABLE "Product" ADD COLUMN "packSize" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Product" ADD COLUMN "packName" TEXT NOT NULL DEFAULT 'Unidad';

-- Add packSize and packName to InventoryItem
ALTER TABLE "InventoryItem" ADD COLUMN "packSize" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "InventoryItem" ADD COLUMN "packName" TEXT NOT NULL DEFAULT 'Unidad';
