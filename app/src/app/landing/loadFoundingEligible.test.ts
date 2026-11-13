import { afterEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();

vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn(function MockConvex(this: { query: typeof query }) {
    this.query = query;
  }),
}));

describe("loadFoundingEligible", () => {
  afterEach(() => {
    query.mockReset();
    vi.unstubAllEnvs();
  });

  it("returns false when Convex URL is missing", async () => {
    vi.unstubAllEnvs();
    delete process.env.NEXT_PUBLIC_CONVEX_URL;
    const { loadFoundingEligible } = await import("./loadFoundingEligible");
    await expect(loadFoundingEligible()).resolves.toBe(false);
  });

  it("returns true only when the query reports eligible", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example.convex.cloud");
    query.mockResolvedValue({ eligible: true });
    const { loadFoundingEligible } = await import("./loadFoundingEligible");
    await expect(loadFoundingEligible()).resolves.toBe(true);
    expect(query).toHaveBeenCalledOnce();
  });

  it("returns false when the query throws", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example.convex.cloud");
    query.mockRejectedValue(new Error("offline"));
    const { loadFoundingEligible } = await import("./loadFoundingEligible");
    await expect(loadFoundingEligible()).resolves.toBe(false);
  });
});
