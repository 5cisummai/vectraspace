-- CreateEnum
CREATE TYPE "FsOperation" AS ENUM ('DELETE', 'MOVE', 'COPY', 'MKDIR', 'UPLOAD');

-- CreateEnum
CREATE TYPE "FsActionStatus" AS ENUM ('DONE', 'UNDONE');

-- CreateTable
CREATE TABLE "FileSystemAction" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "userId" TEXT NOT NULL,
    "operation" "FsOperation" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "FsActionStatus" NOT NULL DEFAULT 'DONE',
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileSystemAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FileSystemAction_workspaceId_createdAt_idx" ON "FileSystemAction"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FileSystemAction_userId_workspaceId_status_createdAt_idx" ON "FileSystemAction"("userId", "workspaceId", "status", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "FileSystemAction" ADD CONSTRAINT "FileSystemAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileSystemAction" ADD CONSTRAINT "FileSystemAction_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
