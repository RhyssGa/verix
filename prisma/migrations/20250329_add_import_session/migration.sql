-- CreateTable
CREATE TABLE "ImportSession" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "label" TEXT,
    "agences" JSONB NOT NULL,
    "quarterYear" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportSession_mode_quarterYear_quarter_idx" ON "ImportSession"("mode", "quarterYear", "quarter");

-- CreateIndex
CREATE INDEX "ImportSession_createdAt_idx" ON "ImportSession"("createdAt");
