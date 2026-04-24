-- CreateTable
CREATE TABLE "AgentV2StreamEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "eventName" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentV2StreamEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentV2StreamEvent_runId_sequence_key" ON "AgentV2StreamEvent"("runId", "sequence");

-- CreateIndex
CREATE INDEX "AgentV2StreamEvent_runId_sequence_idx" ON "AgentV2StreamEvent"("runId", "sequence");

-- AddForeignKey
ALTER TABLE "AgentV2StreamEvent" ADD CONSTRAINT "AgentV2StreamEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
