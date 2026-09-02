import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearPrivateOfflineData, getOfflineOutbox, queueOfflineMutation } from "@/lib/offline-db";
import { syncOfflineMutations } from "@/lib/offline-sync";

describe("offline synchronization", () => {
  beforeEach(async () => { await clearPrivateOfflineData(); vi.restoreAllMocks(); Object.defineProperty(navigator, "onLine", { configurable: true, value: true }); });

  it("removes applied work, stops at the first rejected mutation, and preserves later work", async () => {
    await queueOfflineMutation({ id: "one", type: "UPSERT_SET", sessionId: "session", targetId: "set-1", payload: {} }); await queueOfflineMutation({ id: "two", type: "UPSERT_SET", sessionId: "session", targetId: "set-2", payload: {} }); await queueOfflineMutation({ id: "three", type: "FINISH_WORKOUT", sessionId: "session", targetId: "session", payload: {} });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ results: [{ id: "one", status: "applied" }, { id: "two", status: "failed", error: "SESSION_ALREADY_COMPLETED" }] }), { status: 409, headers: { "Content-Type": "application/json" } }));
    expect(await syncOfflineMutations()).toBe("needs-attention");
    const remaining = await getOfflineOutbox(); expect(remaining.map((item) => item.id)).toEqual(["two", "three"]); expect(remaining[0]).toMatchObject({ attempts: 1, lastError: "UPSERT_SET #2: SESSION_ALREADY_COMPLETED" });
  });

  it("treats duplicate mutation ids as success and clears them", async () => {
    await queueOfflineMutation({ id: "duplicate", type: "UPSERT_SET", sessionId: "session", targetId: "set-1", payload: {} });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ results: [{ id: "duplicate", status: "duplicate" }] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    expect(await syncOfflineMutations()).toBe("synced"); expect(await getOfflineOutbox()).toEqual([]);
  });

  it("keeps local work and reports the HTTP and server error when a request has no acknowledgements", async () => {
    await queueOfflineMutation({ id: "pending", type: "FINISH_WORKOUT", sessionId: "session", targetId: "session", payload: {} });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "A matching Origin header is required" }), { status: 403, headers: { "Content-Type": "application/json" } }));
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await syncOfflineMutations()).toBe("saved-local");
    expect((await getOfflineOutbox()).map((item) => item.id)).toEqual(["pending"]);
    expect(error).toHaveBeenCalledWith("VicGym synchronization request failed", expect.objectContaining({ clientError: "Sync request failed (403): A matching Origin header is required" }));
  });
});
