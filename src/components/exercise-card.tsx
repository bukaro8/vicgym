import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { ResponsiveEquipmentImage } from "@/components/responsive-equipment-image";
import { equipmentTypeLabel } from "@/lib/display";
import { getExercisePrimaryMedia } from "@/lib/exercise-media";

type ExerciseCardProps = {
  exercise: {
    slug: string;
    name: string;
    defaultTargetReps: number;
    media: Array<{ storagePath: string; altText: string; role: string; kind?: string }>;
    equipment: {
      name: string;
      type: string;
      media: Array<{ storagePath: string; altText: string; role: string; kind?: string }>;
    } | null;
    muscles: Array<{ role: string; muscle: { name: string } }>;
  };
};

export function ExerciseCard({ exercise }: Readonly<ExerciseCardProps>) {
  const primaryPhoto = getExercisePrimaryMedia(exercise);
  const primaryMuscle = exercise.muscles.find((relationship) => relationship.role === "PRIMARY")?.muscle.name;
  const secondaryMuscles = exercise.muscles.filter((relationship) => relationship.role === "SECONDARY").map((relationship) => relationship.muscle.name);

  return (
    <Link href={`/exercises/${exercise.slug}`} className="group overflow-hidden rounded-3xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
      <div className="overflow-hidden border-b bg-muted">
        <ResponsiveEquipmentImage image={primaryPhoto} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="transition duration-300 group-hover:scale-[1.02]" />
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{exercise.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{primaryMuscle ?? "Muscle mapping pending"}</p>
          </div>
          <ArrowUpRight className="mt-1 size-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
        </div>
        {secondaryMuscles.length > 0 && <p className="mt-3 line-clamp-1 text-xs text-muted-foreground">Also: {secondaryMuscles.join(", ")}</p>}
        <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3 text-xs">
          <span className="font-medium text-accent-foreground">{equipmentTypeLabel(exercise.equipment?.type)}</span>
          <span className="text-muted-foreground">Default {exercise.defaultTargetReps} reps</span>
        </div>
      </div>
    </Link>
  );
}
