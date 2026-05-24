import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tasks = await prisma.tache.findMany({
    take: 15,
    orderBy: { id_tache: "desc" },
    select: {
      id_tache: true,
      nom_t: true,
      id_projet: true,
      id_list: true,
      id_sprint: true,
      deleted_at: true,
    },
  });
  console.log("Recent tasks:", JSON.stringify(tasks, null, 2));

  const lists = await prisma.list_pm.findMany({
    take: 10,
    orderBy: { id_list: "desc" },
    select: {
      id_list: true,
      nom: true,
      id_projet: true,
      id_sprint: true,
      deleted_at: true,
    },
  });
  console.log("Recent lists:", JSON.stringify(lists, null, 2));

  const projects = await prisma.projet.findMany({
    take: 5,
    orderBy: { id_projet: "desc" },
    select: { id_projet: true, nom_p: true },
  });
  console.log("Recent projects:", JSON.stringify(projects, null, 2));

  for (const proj of projects) {
    const pid = proj.id_projet;
    const direct = await prisma.tache.count({
      where: { id_projet: pid, deleted_at: null },
    });
    const listIds = (
      await prisma.list_pm.findMany({
        where: { id_projet: pid, deleted_at: null },
        select: { id_list: true },
      })
    ).map((l) => l.id_list);
    const viaList =
      listIds.length > 0
        ? await prisma.tache.count({
            where: { id_list: { in: listIds }, deleted_at: null },
          })
        : 0;
    console.log(
      `Project ${pid} (${proj.nom_p}): direct=${direct}, viaList=${viaList}, listIds=${listIds.length}`
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
