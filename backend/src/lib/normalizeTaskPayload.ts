/** Maps REST aliases (title, projectId, …) to internal task fields. */
export function normalizeCreateTaskPayload(body: Record<string, unknown>) {
  const projectId = Number(
    body.id_projet ?? body.projectId ?? body.project_id
  );
  const sprintRaw = body.id_sprint ?? body.sprintId ?? body.sprint_id;
  const listRaw = body.id_list ?? body.listId ?? body.list_id;
  const assigneeRaw =
    body.assigne_a ?? body.assignedToId ?? body.assigneeId ?? body.assignee_id;

  return {
    nom_t: String(body.nom_t ?? body.title ?? body.nom ?? "").trim(),
    description_t:
      body.description_t ?? body.description ?? body.description_t ?? "",
    statut_t: body.statut_t ?? body.status,
    priorite_t: body.priorite_t ?? body.priority ?? body.priorite,
    date_limite_t:
      body.date_limite_t ?? body.dueDate ?? body.date_limite ?? body.due_date,
    id_projet: projectId,
    id_space:
      body.id_space != null
        ? Number(body.id_space)
        : body.spaceId != null
          ? Number(body.spaceId)
          : null,
    id_sprint:
      sprintRaw != null && sprintRaw !== ""
        ? Number(sprintRaw)
        : null,
    id_list:
      listRaw != null && listRaw !== "" ? Number(listRaw) : null,
    id_group: body.id_group != null ? Number(body.id_group) : null,
    id_folder: body.id_folder != null ? Number(body.id_folder) : null,
    assigne_a:
      assigneeRaw === undefined || assigneeRaw === null || assigneeRaw === ""
        ? null
        : Number(assigneeRaw),
    cree_par: body.cree_par != null ? Number(body.cree_par) : undefined,
  };
}
