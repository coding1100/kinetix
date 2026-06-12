import { describe, expect, it } from "vitest";
import {
  extractFilesFromFileList,
  extractImageFilesFromFileList,
  imageFileDisplayName,
  isImageFile,
  pastedFileDisplayName,
} from "@/lib/chat/composer-image-files";

function mockFileList(files: File[]): FileList {
  const list = files as unknown as FileList & { length: number; item: (i: number) => File | null };
  Object.defineProperty(list, "length", { value: files.length });
  list.item = (i: number) => files[i] ?? null;
  return list;
}

describe("composer-image-files", () => {
  it("detects image mime types", () => {
    expect(isImageFile(new File([], "a.bin", { type: "image/png" }))).toBe(true);
    expect(isImageFile(new File([], "a.pdf", { type: "application/pdf" }))).toBe(
      false
    );
  });

  it("filters image files from a list", () => {
    const list = mockFileList([
      new File([], "photo.png", { type: "image/png" }),
      new File([], "doc.pdf", { type: "application/pdf" }),
    ]);
    expect(extractImageFilesFromFileList(list)).toHaveLength(1);
  });

  it("keeps all file types from a list", () => {
    const list = mockFileList([
      new File([], "photo.png", { type: "image/png" }),
      new File([], "doc.pdf", { type: "application/pdf" }),
    ]);
    expect(extractFilesFromFileList(list)).toHaveLength(2);
  });

  it("names clipboard screenshots", () => {
    const file = new File([], "image.png", { type: "image/png" });
    expect(imageFileDisplayName(file, 0)).toMatch(/^pasted-image-\d+\.png$/);
    expect(pastedFileDisplayName(file, 0)).toMatch(/^pasted-image-\d+\.png$/);
  });

  it("names pasted non-image files", () => {
    const file = new File([], "report.pdf", { type: "application/pdf" });
    expect(pastedFileDisplayName(file, 0)).toBe("report.pdf");
    const blob = new File([], "blob", { type: "application/pdf" });
    expect(pastedFileDisplayName(blob, 0)).toMatch(/^pasted-file-\d+\.pdf$/);
  });
});
