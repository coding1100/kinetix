import { useState, useCallback } from "react";
import { toast } from "sonner";

export function useOptimisticState<T>(
  initialData: T,
  onServerSync: (updatedData: T) => Promise<void>,
  options?: {
    errorMessage?: string;
    successMessage?: string;
  }
) {
  const [data, setData] = useState<T>(initialData);
  const [isPending, setIsPending] = useState(false);

  const mutate = useCallback(
    async (nextData: T | ((prev: T) => T)) => {
      const previousData = data;
      const updatedData =
        typeof nextData === "function"
          ? (nextData as (prev: T) => T)(previousData)
          : nextData;

      // 1. Instant local optimistic update
      setData(updatedData);
      setIsPending(true);

      try {
        // 2. Background server API call
        await onServerSync(updatedData);
        if (options?.successMessage) {
          toast.success(options.successMessage);
        }
      } catch (err) {
        // 3. Rollback local state on error
        setData(previousData);
        const msg =
          err instanceof Error
            ? err.message
            : options?.errorMessage || "Action failed to sync with server";
        toast.error(msg);
      } finally {
        setIsPending(false);
      }
    },
    [data, onServerSync, options]
  );

  return [data, mutate, isPending] as const;
}
