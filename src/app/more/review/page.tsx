import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/server/auth";

export default async function WeeklyReviewPage() {
  const user = await requireCurrentUser();
  redirect(user.role === "ADMIN" ? "/admin/users" : "/programme");
}
