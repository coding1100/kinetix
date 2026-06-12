const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i;

export function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return IMAGE_EXT_RE.test(file.name);
}

export function extractImageFilesFromFileList(list: FileList | null): File[] {
  if (!list?.length) return [];
  return Array.from(list).filter(isImageFile);
}

function extractFilesFromItems(dt: DataTransfer): File[] {
  const fromItems: File[] = [];
  for (const item of Array.from(dt.items)) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file) fromItems.push(file);
  }
  return fromItems;
}

export function extractFilesFromFileList(list: FileList | null): File[] {
  if (!list?.length) return [];
  return Array.from(list);
}

export function extractFilesFromDataTransfer(dt: DataTransfer): File[] {
  const fromFiles = extractFilesFromFileList(dt.files);
  if (fromFiles.length > 0) return fromFiles;
  return extractFilesFromItems(dt);
}

export function extractImageFilesFromDataTransfer(dt: DataTransfer): File[] {
  return extractFilesFromDataTransfer(dt).filter(isImageFile);
}

export function extractImageFilesFromClipboard(
  clipboardData: DataTransfer
): File[] {
  return extractImageFilesFromDataTransfer(clipboardData);
}

export function extractFilesFromClipboard(clipboardData: DataTransfer): File[] {
  return extractFilesFromDataTransfer(clipboardData);
}

export function imageFileDisplayName(file: File, index: number): string {
  const trimmed = file.name?.trim();
  if (trimmed && trimmed !== "image.png" && trimmed !== "blob") {
    return trimmed;
  }
  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
  const suffix = index > 0 ? `-${index + 1}` : "";
  return `pasted-image-${Date.now()}${suffix}.${ext}`;
}

function extensionFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "text/plain": "txt",
    "text/markdown": "md",
    "application/json": "json",
    "application/zip": "zip",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/webm": "webm",
  };
  if (map[mimeType]) return map[mimeType];
  const part = mimeType.split("/")[1];
  return part?.replace("jpeg", "jpg") || "bin";
}

export function pastedFileDisplayName(file: File, index: number): string {
  const trimmed = file.name?.trim();
  if (
    trimmed &&
    trimmed !== "blob" &&
    trimmed !== "image.png" &&
    !/^file\d*$/i.test(trimmed)
  ) {
    return trimmed;
  }
  if (isImageFile(file)) {
    return imageFileDisplayName(file, index);
  }
  const ext =
    trimmed?.includes(".") && trimmed !== "blob"
      ? trimmed.split(".").pop()!
      : extensionFromMime(file.type || "application/octet-stream");
  const suffix = index > 0 ? `-${index + 1}` : "";
  return `pasted-file-${Date.now()}${suffix}.${ext}`;
}
