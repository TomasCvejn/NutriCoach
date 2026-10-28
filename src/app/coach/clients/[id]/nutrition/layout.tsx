import { requireCoachOf } from "@/lib/auth";
import { NutritionNav } from "../client-header";

// The Nutrition tab: the plan and targets, and the client's daily log.
export default async function NutritionLayout({ params, children }: LayoutProps<"/coach/clients/[id]/nutrition">) {
  const { client } = await requireCoachOf((await params).id);
  return (
    <div className="flex flex-col gap-6">
      <NutritionNav clientId={client.id} />
      {children}
    </div>
  );
}
