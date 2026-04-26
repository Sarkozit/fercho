-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN "countSortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "countSortOrder" INTEGER NOT NULL DEFAULT 0;
