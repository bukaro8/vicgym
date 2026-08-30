export function equipmentTypeLabel(type?: string | null): string {
  const labels: Record<string, string> = {
    MACHINE: "Machine",
    DUMBBELL: "Dumbbells",
    BARBELL: "Barbell",
    BODYWEIGHT: "Bodyweight",
    CARDIO: "Cardio",
    STEP: "Studio accessories",
  };
  return type ? (labels[type] ?? type) : "Bodyweight / no equipment";
}

export function greetingFor(date: Date, timeZone = "Europe/London"): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone }).format(date));
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
