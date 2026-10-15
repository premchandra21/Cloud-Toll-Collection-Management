-- CreateTable
CREATE TABLE "operator_plazas" (
    "userId" UUID NOT NULL,
    "plazaId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operator_plazas_pkey" PRIMARY KEY ("userId","plazaId")
);

-- CreateIndex
CREATE INDEX "operator_plazas_plazaId_idx" ON "operator_plazas"("plazaId");

-- AddForeignKey
ALTER TABLE "operator_plazas" ADD CONSTRAINT "operator_plazas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_plazas" ADD CONSTRAINT "operator_plazas_plazaId_fkey" FOREIGN KEY ("plazaId") REFERENCES "toll_plazas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
