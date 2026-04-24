ALTER TABLE "ChatMessage"
ADD COLUMN "authorUserId" TEXT,
ADD COLUMN "authorDisplayName" TEXT,
ADD COLUMN "authorUsername" TEXT;

UPDATE "ChatMessage" AS message
SET
	"authorUserId" = session."userId",
	"authorDisplayName" = author."displayName",
	"authorUsername" = author."username"
FROM "ChatSession" AS session
JOIN "User" AS author ON author."id" = session."userId"
WHERE
	message."chatSessionId" = session."id"
	AND message."role" = 'USER'
	AND message."authorUserId" IS NULL;

ALTER TABLE "ChatMessage"
ADD CONSTRAINT "ChatMessage_authorUserId_fkey"
FOREIGN KEY ("authorUserId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "ChatMessage_authorUserId_idx" ON "ChatMessage"("authorUserId");
