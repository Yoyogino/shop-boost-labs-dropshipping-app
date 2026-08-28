-- CreateTable
CREATE TABLE "UsageCharge" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "importedRevenue" DOUBLE PRECISION NOT NULL,
    "amountCharged" DOUBLE PRECISION NOT NULL,
    "shopifyUsageRecordId" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageCharge_shop_idx" ON "UsageCharge"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "UsageCharge_shop_shopifyOrderId_key" ON "UsageCharge"("shop", "shopifyOrderId");
