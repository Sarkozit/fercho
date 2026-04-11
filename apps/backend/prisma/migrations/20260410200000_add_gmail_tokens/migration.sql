-- CreateTable
CREATE TABLE "GmailTokens" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiryDate" BIGINT,
    "historyId" TEXT,

    CONSTRAINT "GmailTokens_pkey" PRIMARY KEY ("id")
);
