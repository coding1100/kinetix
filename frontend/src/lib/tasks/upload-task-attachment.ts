import {
  presignTaskAttachment,
  uploadTaskAttachmentContent,
} from "@/lib/api/spaces";

export async function uploadTaskAttachment(
  token: string,
  workspaceId: string,
  taskId: string,
  file: File
): Promise<string> {
  const presign = await presignTaskAttachment(token, workspaceId, taskId, {
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  });

  await uploadTaskAttachmentContent(
    token,
    workspaceId,
    taskId,
    presign.attachmentId,
    file,
    file.name
  );

  return presign.attachmentId;
}
