import { describe, expect, it } from "vitest";
import {
  extractImageFilesFromFileList,
  imageFileDisplayName,
  isImageFile,
} from "@/lib/chat/composer-image-files";

describe("composer-image-files", () => {
  it("detects image mime types", () => {
    expect(isImageFile(new File([], "a.bin", { type: "image/png" }))).toBe(true);
    expect(isImageFile(new File([], "a.pdf", { type: "application/pdf" }))).toBe(
      false
    );
  });

  it("filters image files from a list", () => {
    const dt = new DataTransfer();
    dt.items.add(new File([], "photo.png", { type: "image/png" }));
    dt.items.add(new File([], "doc.pdf", { type: "application/pdf" }));
    expect(extractImageFilesFromFileList(dt.files)).toHaveLength(1);
  });

  it("names clipboard screenshots", () => {
    const file = new File([], "image.png", { type: "image/png" });
    expect(imageFileDisplayName(file, 0)).toMatch(/^pasted-image-\d+\.png$/);
  });
});
