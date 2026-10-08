import { beforeEach, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { AdminRequiredError, requireAdminUser } from "@/server/auth";
import { adminCoachApply, adminCoachPreview, adminCoachReport } from "@/server/admin-coaching";
vi.mock("@/server/auth", async (original) => ({ ...await original<typeof import("@/server/auth")>(), requireAdminUser: vi.fn() }));
vi.mock("@/server/admin-coaching", async (original) => ({ ...await original<typeof import("@/server/admin-coaching")>(), adminCoachApply: vi.fn(), adminCoachPreview: vi.fn(), adminCoachReport: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ getPrisma: () => ({}) }));
vi.mock("@/lib/http/same-origin", async (original) => ({ ...await original<typeof import("@/lib/http/same-origin")>(), assertSameOriginJson: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const owner = "10000000-0000-4000-8000-000000000001";
const context = (action: string) => ({ params: Promise.resolve({ userId: owner, action }) });
beforeEach(() => { vi.clearAllMocks(); vi.mocked(requireAdminUser).mockResolvedValue({ id: "admin", role: "ADMIN", email: "admin@example.com" }); });
it("denies USER before generating a report or processing a programme", async () => {
  vi.mocked(requireAdminUser).mockRejectedValue(new AdminRequiredError("Administrator access required"));
  expect((await GET(new Request("https://gym.test/report"), context("report"))).status).toBe(403);
  expect((await POST(new Request("https://gym.test/preview", { method: "POST" }), context("preview"))).status).toBe(403);
  expect(adminCoachReport).not.toHaveBeenCalled(); expect(adminCoachPreview).not.toHaveBeenCalled();
});
it("passes the route target and selected week to the report engine", async () => {
  vi.mocked(adminCoachReport).mockResolvedValue({ report: "Only owner data" } as never);
  const response = await GET(new Request("https://gym.test/report?week=2026-10-05"), context("report"));
  expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(adminCoachReport).toHaveBeenCalledWith({}, expect.objectContaining({ role: "ADMIN" }), owner, "2026-10-05");
});
it("requires confirmation and rejects browser-supplied ownership overrides", async () => {
  const post = (body: unknown) => POST(new Request("https://gym.test/apply", { method: "POST", body: JSON.stringify(body) }), context("apply"));
  expect((await post({ json: "{}" })).status).toBe(400);
  expect((await post({ json: "{}", confirmation: "APPLY_COACH_CHANGES", userId: "another-user" })).status).toBe(400);
  expect(adminCoachApply).not.toHaveBeenCalled();
  vi.mocked(adminCoachApply).mockResolvedValue({ kind: "patch", program: "small-gym", versionNumber: 2 } as never);
  expect((await post({ json: "{}", confirmation: "APPLY_COACH_CHANGES" })).status).toBe(200);
  expect(adminCoachApply).toHaveBeenCalledWith({}, expect.objectContaining({ role: "ADMIN" }), owner, "{}");
});
