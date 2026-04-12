-- AlterTable
ALTER TABLE "Product" ADD COLUMN "excludeFromReports" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "tipEnabled" BOOLEAN NOT NULL DEFAULT true,
    "tipThreshold" INTEGER NOT NULL DEFAULT 150000,
    "tipPercent" INTEGER NOT NULL DEFAULT 10,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- Seed default AppSettings
INSERT INTO "AppSettings" ("id", "tipEnabled", "tipThreshold", "tipPercent")
VALUES ('singleton', true, 150000, 10)
ON CONFLICT ("id") DO NOTHING;
