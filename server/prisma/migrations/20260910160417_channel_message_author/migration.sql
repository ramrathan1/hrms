-- AddForeignKey
ALTER TABLE "channel_messages" ADD CONSTRAINT "channel_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
