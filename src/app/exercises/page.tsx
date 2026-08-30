import { Dumbbell } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ExerciseCard } from "@/components/exercise-card";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ExercisesPage() {
  const prisma = getPrisma();
  const [exercises, equipmentCount] = await Promise.all([
    prisma.exercise.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: {
        equipment: { include: { media: { orderBy: { sortOrder: "asc" } } } },
        muscles: { include: { muscle: true } },
      },
    }),
    prisma.equipment.count({ where: { available: true } }),
  ]);

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-7 sm:px-8 sm:py-10">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-primary"><Dumbbell className="size-5" aria-hidden="true" /></span>
          <div>
            <p className="text-sm font-semibold text-primary">Verified catalogue</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Exercises</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{exercises.length} available exercises using {equipmentCount} photographed equipment records or no equipment.</p>
          </div>
        </div>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {exercises.map((exercise) => <ExerciseCard key={exercise.id} exercise={exercise} />)}
        </div>
      </main>
    </AppShell>
  );
}
