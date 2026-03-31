/*
  Warnings:

  - You are about to drop the column `paymentMethod` on the `Expense` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Expense" DROP COLUMN "paymentMethod";

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "tableName" TEXT;

-- CreateTable
CREATE TABLE "Printer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ticket',
    "connectionType" TEXT NOT NULL DEFAULT 'USB',
    "address" TEXT,
    "kitchens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "printCommands" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Printer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "header" TEXT NOT NULL DEFAULT '',
    "footer" TEXT NOT NULL DEFAULT '',
    "showLogo" BOOLEAN NOT NULL DEFAULT false,
    "qrImage" TEXT,
    "qrText" TEXT NOT NULL DEFAULT 'Si deseas pagar desde cualquier banco o billetera virtual, usa este QR',

    CONSTRAINT "PrintSettings_pkey" PRIMARY KEY ("id")
);
