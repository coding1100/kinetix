import { toast } from "sonner";

/**
 * Downloads a file with instant in-app feedback via Sonner toasts.
 *
 * Handles both same-origin and cross-origin (e.g. S3 / CDN presigned) URLs by
 * fetching the binary as a blob to ensure the browser's download dialog triggers
 * with the exact filename instead of opening in a blank tab.
 */
export async function downloadFileWithFeedback(
  url: string,
  fileName: string
): Promise<void> {
  const toastId = `download-${Date.now()}`;
  toast.loading(`Downloading ${fileName}…`, { id: toastId });

  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);

    toast.success(`Downloaded ${fileName}`, {
      id: toastId,
      description: "File saved to your downloads.",
      duration: 3500,
    });
  } catch {
    // Fallback: trigger native browser download or open in new tab if CORS prevents direct fetch
    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.target = "_blank";
      anchor.rel = "noreferrer noopener";
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      toast.success(`Download started for ${fileName}`, {
        id: toastId,
        description: "Your browser is downloading the file.",
        duration: 3500,
      });
    } catch {
      toast.error(`Could not download ${fileName}`, {
        id: toastId,
        description: "Please check your network connection and try again.",
      });
    }
  }
}
