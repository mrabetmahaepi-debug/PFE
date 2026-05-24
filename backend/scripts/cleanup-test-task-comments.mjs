/**
 * One-off: remove debug/test rows from tache_comment (and related history snippets).
 * Run: node scripts/cleanup-test-task-comments.mjs
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const deletedComments = await p.$executeRaw`
    DELETE FROM tache_comment
    WHERE contenu REGEXP '^(test comment |http test )[0-9]+$'
  `;
  const deletedHistory = await p.$executeRaw`
    DELETE FROM tache_history
    WHERE field_key = 'comment'
      AND new_value REGEXP '^(test comment |http test )[0-9]+$'
  `;
  const remaining = await p.$queryRaw`
    SELECT id_comment, id_tache, contenu, createdAt
    FROM tache_comment
    ORDER BY id_comment DESC
    LIMIT 20
  `;
  console.log("Deleted comments:", Number(deletedComments));
  console.log("Deleted history rows:", Number(deletedHistory));
  console.log("Remaining (latest 20):", remaining);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
