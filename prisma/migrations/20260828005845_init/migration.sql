-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportedProduct" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierCredential" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "accessToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshToken" TEXT,
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierLink" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "supplierProductId" TEXT NOT NULL,
    "supplierVariantId" TEXT NOT NULL,
    "supplierSku" TEXT,
    "lastSyncedPrice" DOUBLE PRECISION,
    "lastSyncedStock" INTEGER,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierOrder" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "supplierOrderId" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportedProduct_shop_idx" ON "ImportedProduct"("shop");

-- CreateIndex
CREATE INDEX "ImportedProduct_shopifyProductId_idx" ON "ImportedProduct"("shopifyProductId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCredential_shop_provider_key" ON "SupplierCredential"("shop", "provider");

-- CreateIndex
CREATE INDEX "SupplierLink_shop_idx" ON "SupplierLink"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierLink_shop_shopifyVariantId_key" ON "SupplierLink"("shop", "shopifyVariantId");

-- CreateIndex
CREATE INDEX "SupplierOrder_shop_idx" ON "SupplierOrder"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierOrder_shop_shopifyOrderId_provider_key" ON "SupplierOrder"("shop", "shopifyOrderId", "provider");
