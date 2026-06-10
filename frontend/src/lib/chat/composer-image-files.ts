const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i;

export function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return IMAGE_EXT_RE.test(file.name);
}

export function extractImageFilesFromFileList(list: FileList | null): File[] {
  if (!list?.length) return [];
  return Array.from(list).filter(isImageFile);
}

export function extractImageFilesFromDataTransfer(dt: DataTransfer): File[] {
  const fromFiles = extractImageFilesFromFileList(dt.files);
  if (fromFiles.length > 0) return fromFiles;

  const fromItems: File[] = [];
  for (const item of Array.from(dt.items)) {
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file) fromItems.push(file);
  }
  return fromItems;
}

export function extractImageFilesFromClipboard(
  clipboardData: DataTransfer
): File[] {
  return extractImageFilesFromDataTransfer(clipboardData);
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
