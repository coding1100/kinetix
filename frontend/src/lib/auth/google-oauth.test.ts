import { afterEach, describe, expect, it, vi } from "vitest";
import { apiOrigin, googleOAuthStartUrl } from "./google-oauth";

describe("google-oauth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds google start URL on API origin", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:4000/api/v1");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    expect(apiOrigin()).toBe("http://localhost:4000");
    expect(googleOAuthStartUrl("/home/inbox")).toBe(
      "http://localhost:4000/api/v1/auth/google/start?next=%2Fhome%2Finbox"
    );
  });

  it("defaults invalid next paths to /home/inbox", () => {
    vi.stubEnv("NEXT_PUBLIC_API_ORIGIN", "http://localhost:4000");
    expect(googleOAuthStartUrl("")).toBe(
      "http://localhost:4000/api/v1/auth/google/start?next=%2Fhome%2Finbox"
    );
    expect(googleOAuthStartUrl("relative")).toBe(
      "http://localhost:4000/api/v1/auth/google/start?next=%2Fhome%2Finbox"
    );
  });

  it("strips trailing /api/v1 from API base", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:4000/api/v1/");
    expect(apiOrigin()).toBe("http://localhost:4000");
  });

  it("uses NEXT_PUBLIC_API_ORIGIN when API URL is proxied (relative)", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "/api/v1");
    vi.stubEnv("NEXT_PUBLIC_API_ORIGIN", "http://localhost:4000");
    expect(apiOrigin()).toBe("http://localhost:4000");
    expect(googleOAuthStartUrl("/home/inbox")).toBe(
      "http://localhost:4000/api/v1/auth/google/start?next=%2Fhome%2Finbox"
    );
  });
});
