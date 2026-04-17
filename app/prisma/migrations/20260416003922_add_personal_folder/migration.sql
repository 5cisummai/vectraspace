-- CreateTable
CREATE TABLE "PersonalFolder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PersonalFolder_userId_key" ON "PersonalFolder"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalFolder_path_key" ON "PersonalFolder"("path");

-- AddForeignKey
ALTER TABLE "PersonalFolder" ADD CONSTRAINT "PersonalFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
