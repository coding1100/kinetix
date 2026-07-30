import { afterEach, describe, expect, it, vi } from "vitest";
import { getSocketConnectionConfig } from "./config";

function mockWindow(origin: string, hostname: string) {
  vi.stubGlobal("window", {
    location: { origin, hostname },
  });
}

describe("getSocketConnectionConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses browser origin and /staging path for proxied staging API", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/staging");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "/staging/api/v1");
    vi.stubEnv("NEXT_PUBLIC_SOCKET_URL", "");
    mockWindow("http://3.140.5.67", "3.140.5.67");

    expect(getSocketConnectionConfig()).toEqual({
      url: "http://3.140.5.67",
      path: "/staging/socket.io",
    });
  });

  it("ignores localhost socket env when page is not on localhost", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/staging");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "/staging/api/v1");
    vi.stubEnv("NEXT_PUBLIC_SOCKET_URL", "http://localhost:4001");
    mockWindow("http://3.140.5.67", "3.140.5.67");

    expect(getSocketConnectionConfig()).toEqual({
      url: "http://3.140.5.67",
      path: "/staging/socket.io",
    });
  });

  it("keeps the localhost socket URL when the page is on 127.0.0.1", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "/api/v1");
    vi.stubEnv("NEXT_PUBLIC_SOCKET_URL", "http://localhost:4001");
    mockWindow("http://127.0.0.1:3001", "127.0.0.1");

    expect(getSocketConnectionConfig()).toEqual({
      url: "http://localhost:4001",
      path: "/socket.io",
    });
  });

  it("uses explicit absolute socket URL on localhost dev", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:4001/api/v1");
    vi.stubEnv("NEXT_PUBLIC_SOCKET_URL", "http://localhost:4001");
    mockWindow("http://localhost:3000", "localhost");

    expect(getSocketConnectionConfig()).toEqual({
      url: "http://localhost:4001",
      path: "/socket.io",
    });
  });
});
