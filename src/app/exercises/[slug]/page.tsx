import { ArrowLeft, Dumbbell, ExternalLink, Repeat2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ResponsiveEquipmentImage } from "@/components/responsive-equipment-image";
import { equipmentTypeLabel } from "@/lib/display";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ExerciseDetailPage({ params }: PageProps<"/exercises/[slug]">) {
  const { slug } = await params;
  const exercise = await getPrisma().exercise.findUnique({
    where: { slug, active: true },
    include: {
      equipment: { include: { media: { orderBy: { sortOrder: "asc" } } } },
      muscles: { include: { muscle: true } },
    },
  });
  if (!exercise) notFound();

  const primaryMuscle = exercise.muscles.find((relationship) => relationship.role === "PRIMARY")?.muscle;
  const secondaryMuscles = exercise.muscles.filter((relationship) => relationship.role === "SECONDARY").map((relationship) => relationship.muscle);
  const primaryPhoto = exercise.equipment?.media.find((media) => media.role === "PRIMARY");
  const referencePhotos = exercise.equipment?.media.filter((media) => media.role === "REFERENCE") ?? [];

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-8 sm:py-10">
        <Link href="/exercises" className="inline-flex items-center gap-2 rounded-xl py-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" />All exercises</Link>
        <article className="mt-3 overflow-hidden rounded-3xl border bg-card shadow-sm">
          <div className="overflow-hidden border-b bg-muted">
            <ResponsiveEquipmentImage image={primaryPhoto} priority sizes="(max-width: 1024px) 100vw, 960px" className="max-h-[34rem] object-cover" />
          </div>
          <div className="p-5 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-primary">{equipmentTypeLabel(exercise.equipment?.type)}</p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-5xl">{exercise.name}</h1>
                <p className="mt-3 text-sm text-muted-foreground">{exercise.equipment?.name ?? "Bodyweight / no equipment"}</p>
              </div>
              {exercise.techniqueUrl && (
                <a href={exercise.techniqueUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground">Technique video<ExternalLink className="size-4" aria-hidden="true" /></a>
              )}
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border bg-background p-4"><Dumbbell className="size-5 text-primary" aria-hidden="true" /><p className="mt-3 text-xs text-muted-foreground">Primary muscle</p><p className="mt-1 font-semibold">{primaryMuscle?.name ?? "—"}</p></div>
              <div className="rounded-2xl border bg-background p-4"><Repeat2 className="size-5 text-primary" aria-hidden="true" /><p className="mt-3 text-xs text-muted-foreground">Default target</p><p className="mt-1 font-semibold">{exercise.defaultTargetReps} reps{exercise.repMode === "PER_SIDE" ? " per side" : ""}</p></div>
              <div className="rounded-2xl border bg-background p-4"><p className="text-xs text-muted-foreground">Secondary muscles</p><p className="mt-2 font-semibold leading-6">{secondaryMuscles.length ? secondaryMuscles.map((muscle) => muscle.name).join(", ") : "None recorded"}</p></div>
            </div>
          </div>
        </article>

        {referencePhotos.length > 0 && (
          <section className="mt-8" aria-labelledby="reference-photos-title">
            <h2 id="reference-photos-title" className="text-xl font-semibold tracking-tight">Reference photos</h2>
            <p className="mt-1 text-sm text-muted-foreground">Label and alternate views of the same verified equipment.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {referencePhotos.map((photo) => (
                <figure key={photo.id} className="overflow-hidden rounded-3xl border bg-card">
                  <ResponsiveEquipmentImage image={photo} sizes="(max-width: 640px) 100vw, 50vw" />
                  <figcaption className="px-4 py-3 text-xs text-muted-foreground">Original: {photo.sourceFilename}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}
      </main>
    </AppShell>
  );
}
