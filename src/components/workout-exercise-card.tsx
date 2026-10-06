"use client";

import Link from "next/link";
import { ChevronDown, Dumbbell } from "lucide-react";
import { useState } from "react";
import { ActiveExercise } from "@/components/active-exercise";
import type { OfflineExercise } from "@/lib/offline-types";

export function WorkoutExerciseCard({ sessionId, exercise }: Readonly<{ sessionId: string; exercise: OfflineExercise }>) {
  const [expanded, setExpanded] = useState(false);
  const completed = exercise.sets.filter((set) => set.completedAt).length;
  const finished = exercise.sets.length > 0 && completed === exercise.sets.length;
  const details = `/exercises/${exercise.slug}?workout=${encodeURIComponent(sessionId)}`;
  return <article aria-label={exercise.name} className={`overflow-hidden rounded-2xl border bg-card shadow-sm ${finished ? "border-primary/40" : ""}`}>
    <div className="flex items-center gap-3 p-3 sm:p-4">
      <Link href={details} aria-label={`View ${exercise.name} details`} className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border bg-white">
        {exercise.imagePath ? (
          // Pre-generated local thumbnail also works from the offline media cache.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={exercise.imagePath.replace(/-1280\.webp$/, "-640.webp")} alt="" width={64} height={64} className="size-full object-contain p-1"/>
        ) : <Dumbbell className="size-6 text-primary"/>}
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={details} className="font-semibold leading-tight hover:underline">{exercise.name}</Link>
        <p className="mt-1 text-xs text-muted-foreground">{exercise.plannedSets} × {exercise.targetReps} · Rest {exercise.restSeconds}s · {exercise.autoRest ? "Auto rest" : "Manual rest"}</p>
        <p className="mt-1 text-xs font-medium text-primary">{finished ? "Completed" : `${completed}/${exercise.sets.length} sets complete`}{exercise.isAdHoc ? " · Extra exercise" : ""}</p>
      </div>
    </div>
    <button type="button" aria-expanded={expanded} aria-controls={`logging-${exercise.id}`} onClick={() => setExpanded((value) => !value)} className="flex min-h-11 w-full items-center justify-between border-t px-4 text-sm font-semibold text-primary">
      {expanded ? "Hide sets" : "Log sets"}<ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}/>
    </button>
    {/* Keep the editor mounted so collapsing never discards unfinished inputs. */}
    <div id={`logging-${exercise.id}`} hidden={!expanded} className="border-t px-3 pb-4 sm:px-4">
      {exercise.previousPerformance && <div className="mt-4 rounded-xl bg-background p-3 text-xs text-muted-foreground"><p className="font-semibold">Previous performance</p><p className="mt-1">{exercise.previousPerformance.length ? exercise.previousPerformance.join(" · ") : "No completed history with compatible load units."}</p></div>}
      <ActiveExercise sessionId={sessionId} exerciseSessionId={exercise.id} loadTrackingType={exercise.loadTrackingType} loadEntryMode={exercise.loadEntryMode} initialSets={exercise.sets} previousId={null} nextId={null} showNavigation={false}/>
    </div>
  </article>;
}
