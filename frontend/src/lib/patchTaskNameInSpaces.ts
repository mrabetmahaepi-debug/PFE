import type { SpaceTreeNode, TreeTaskNode } from '../types/hierarchy';

function patchTasksInTree(
  tasks: TreeTaskNode[] | undefined,
  taskId: number,
  nom_t: string
): TreeTaskNode[] | undefined {
  if (!tasks?.length) return tasks;
  return tasks.map((t) => {
    if (t.id_tache === taskId) {
      return { ...t, nom_t };
    }
    if (t.subtasks?.length) {
      const subtasks = patchTasksInTree(t.subtasks, taskId, nom_t);
      if (subtasks !== t.subtasks) {
        return { ...t, subtasks };
      }
    }
    return t;
  });
}

function removeTaskFromTree(
  tasks: TreeTaskNode[] | undefined,
  taskId: number
): { tasks: TreeTaskNode[] | undefined; removed: boolean } {
  if (!tasks?.length) return { tasks, removed: false };
  let removed = false;
  const filtered = tasks.filter((t) => {
    if (t.id_tache === taskId) {
      removed = true;
      return false;
    }
    return true;
  });
  const next = filtered.map((t) => {
    if (!t.subtasks?.length) return t;
    const { tasks: subtasks, removed: subRemoved } = removeTaskFromTree(
      t.subtasks,
      taskId
    );
    if (subRemoved) {
      removed = true;
      return { ...t, subtasks: subtasks ?? [] };
    }
    return t;
  });
  return { tasks: next, removed };
}

/** Remove a subtask from the sidebar hierarchy and decrement task counts. */
export function removeSubtaskFromSpaces(
  spaces: SpaceTreeNode[],
  taskId: number
): SpaceTreeNode[] {
  return spaces.map((space) => ({
    ...space,
    projects: (space.projects ?? []).map((project) => {
      let projectChanged = false;
      const sprints = (project.sprints ?? []).map((sprint) => {
        let sprintChanged = false;
        const lists = (sprint.lists ?? []).map((list) => {
          const { tasks, removed } = removeTaskFromTree(list.tasks, taskId);
          if (!removed) return list;
          sprintChanged = true;
          projectChanged = true;
          const prevCount = list.task_count ?? list.tasks?.length ?? 0;
          return {
            ...list,
            tasks,
            task_count: Math.max(0, prevCount - 1),
          };
        });
        if (!sprintChanged) return sprint;
        return {
          ...sprint,
          lists,
          task_count: Math.max(0, (sprint.task_count ?? 0) - 1),
        };
      });
      if (!projectChanged) return project;
      return {
        ...project,
        sprints,
        task_count: Math.max(0, (project.task_count ?? 0) - 1),
      };
    }),
  }));
}

/** Update a task title in the sidebar hierarchy without a full reload. */
export function patchTaskNameInSpaces(
  spaces: SpaceTreeNode[],
  taskId: number,
  nom_t: string
): SpaceTreeNode[] {
  return spaces.map((space) => ({
    ...space,
    projects: (space.projects ?? []).map((project) => ({
      ...project,
      sprints: (project.sprints ?? []).map((sprint) => ({
        ...sprint,
        lists: (sprint.lists ?? []).map((list) => {
          const tasks = patchTasksInTree(list.tasks, taskId, nom_t);
          return tasks === list.tasks ? list : { ...list, tasks };
        }),
      })),
    })),
  }));
}
