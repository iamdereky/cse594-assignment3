import { notFound } from "next/navigation";
import { parseCondition } from "@/lib/calorie-config";
import { CalorieStudy } from "@/components/calorie-study";
export default async function StudyPage({ params }: { params: Promise<{ condition: string }> }) {
  const route = (await params).condition;
  const condition = parseCondition(route);
  if (!condition) notFound();
  return <CalorieStudy condition={condition} route={route} />;
}
