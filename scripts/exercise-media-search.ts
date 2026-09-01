import "dotenv/config";

import { getExerciseDbExercise, searchExerciseDb } from "../src/lib/exercisedb-core";

async function main() {
  const args = process.argv.slice(2);
  const afterIndex = args.indexOf("--after");
  const query = args.slice(0, afterIndex >= 0 ? afterIndex : args.length).join(" ");
  const after = afterIndex >= 0 ? args[afterIndex + 1] : undefined;
  const result = await searchExerciseDb(query, { after });
  const detailed = await Promise.all(result.candidates.map(async (candidate) => getExerciseDbExercise(candidate.exerciseId)));

  console.log(`Found ${result.total ?? detailed.length} candidate(s).${result.nextCursor ? ` Next cursor: ${result.nextCursor}` : ""}`);
  for (const candidate of detailed) {
    console.log(JSON.stringify({
      exerciseId: candidate.exerciseId,
      name: candidate.name,
      bodyParts: candidate.bodyParts,
      targetMuscles: candidate.targetMuscles,
      equipments: candidate.equipments,
      image: candidate.imageUrls ?? candidate.imageUrl ?? null,
      videoUrl: candidate.videoUrl ?? null,
    }, null, 2));
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "ExerciseDB search failed.");
  process.exitCode = 1;
});
