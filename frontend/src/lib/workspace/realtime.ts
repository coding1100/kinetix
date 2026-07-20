const listeners = new Set<() => void>();

export function subscribeWorkspaceMembersRefresh(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function bumpWorkspaceMembersRefresh() {
  listeners.forEach((listener) => listener());
}
