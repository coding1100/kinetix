const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001/api/v1";

export function getSocketBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SOCKET_URL ??
    API_BASE.replace(/\/api\/v1\/?$/, "")
  );
}
