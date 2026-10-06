import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExerciseDetailPage from "@/app/exercises/[slug]/page";

const { findFirst, findUnique } = vi.hoisted(() => ({ findFirst: vi.fn(), findUnique: vi.fn() }));
vi.mock("@/server/auth", () => ({ requireCurrentUser: async () => ({ id: "owner" }) }));
vi.mock("@/lib/prisma", () => ({ getPrisma: () => ({ exercise: { findUnique }, workoutSession: { findFirst } }) }));
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/responsive-equipment-image", () => ({ ResponsiveEquipmentImage: () => <div>Exercise image</div> }));
const id = "11111111-1111-4111-8111-111111111111";

describe("workout exercise details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockResolvedValue({ name: "Dumbbell Row", slug: "row", defaultTargetReps: 12, loadTrackingType: "KILOGRAM", loadEntryMode: "PER_DUMBBELL", equipment: null, muscles: [], media: [], techniqueUrl: null });
  });
  it("links back to the owned workout without changing session data", async () => {
    findFirst.mockResolvedValue({ id, exerciseSessions: [{ id: "exercise" }] });
    render(await ExerciseDetailPage({ params: Promise.resolve({ slug: "row" }), searchParams: Promise.resolve({ workout: id }) }));
    expect(screen.getByRole("link", { name: "Back to workout" })).toHaveAttribute("href", `/workouts/${id}`);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id, userId: "owner" } }));
    expect(screen.queryByRole("link", { name: "Watch movement" })).not.toBeInTheDocument();
  });
  it("does not expose a return link to another user's workout", async () => {
    findFirst.mockResolvedValue(null);
    render(await ExerciseDetailPage({ params: Promise.resolve({ slug: "row" }), searchParams: Promise.resolve({ workout: id }) }));
    expect(screen.queryByRole("link", { name: "Back to workout" })).not.toBeInTheDocument();
  });
});
