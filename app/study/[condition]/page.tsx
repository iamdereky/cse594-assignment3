import { notFound, redirect } from "next/navigation";
import { parseCondition } from "@/lib/calorie-config";
export default async function StudyPage({ params }: { params: Promise<{ condition: string }> }) {
  const route = (await params).condition;
  const condition = parseCondition(route);
  if (!condition) notFound();
  redirect(`/${route}`);
}
