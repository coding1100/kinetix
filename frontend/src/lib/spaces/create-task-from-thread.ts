import { fetchSpacesTree, createListTask, firstListIdFromSpaces } from "@/lib/api/spaces";

export async function createTaskFromThreadMessage(
  token: string,
  workspaceId: string,
  messageBody: string
) {
  const spacesRes = await fetchSpacesTree(token, workspaceId);
  const listId = firstListIdFromSpaces(spacesRes.data);
  if (!listId) {
    throw new Error("No list available. Add a space and list first.");
  }
  const trimmed = messageBody.trim();
  const name =
    trimmed.length > 0
      ? trimmed.length > 200
        ? `${trimmed.slice(0, 197)}…`
        : trimmed
      : "Follow-up from thread";
  const task = await createListTask(token, workspaceId, listId, {
    name,
    description: trimmed || undefined,
  });
  return { task, listId };
}
