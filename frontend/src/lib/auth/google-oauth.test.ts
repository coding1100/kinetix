import { afterEach, describe, expect, it, vi } from "vitest";
import { apiOrigin, googleOAuthStartUrl } from "./google-oauth";

describe("google-oauth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds google start URL via app origin (Next proxy)", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:4001/api/v1");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3001");
    expect(apiOrigin()).toBe("http://localhost:4001");
    expect(googleOAuthStartUrl("/home/inbox")).toBe(
      "http://localhost:3001/api/v1/auth/google/start?next=%2Fhome%2Finbox"
    );
  });

  it("defaults invalid next paths to /home/inbox", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3001");
    expect(googleOAuthStartUrl("")).toBe(
      "http://localhost:3001/api/v1/auth/google/start?next=%2Fhome%2Finbox"
    );
    expect(googleOAuthStartUrl("relative")).toBe(
      "http://localhost:3001/api/v1/auth/google/start?next=%2Fhome%2Finbox"
    );
  });

  it("strips trailing /api/v1 from API base", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:4001/api/v1/");
    expect(apiOrigin()).toBe("http://localhost:4001");
  });

  it("uses app URL for google start when API URL is proxied (relative)", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "/api/v1");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3001");
    expect(apiOrigin()).toBe("http://localhost:4001");
    expect(googleOAuthStartUrl("/home/inbox")).toBe(
      "http://localhost:3001/api/v1/auth/google/start?next=%2Fhome%2Finbox"
    );
  });
});
