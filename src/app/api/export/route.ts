import { requireClient } from "@/lib/auth";
import { db } from "@/lib/db";

// "Download my data" (home-and-basics.md): everything the client logged or was set, as a JSON file. The coach's own rows
// on the client (private notes, the client history) aren't the client's data and stay out.
export async function GET() {
  const { user, client } = await requireClient();
  const [account, data] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, email: true, timezone: true, locale: true, createdAt: true, foods: true, notifications: true } }),
    db.client.findUniqueOrThrow({
      where: { id: client.id },
      include: {
        targets: true,
        planMeals: true,
        planRecommendations: true,
        nutritionDays: true,
        foodEntries: true,
        portionLogs: true,
        guidanceLogs: true,
        savedRecipes: { include: { recipe: { select: { name: true } } } },
        fluidLogs: true,
        drinkPresets: true,
        checkIns: true,
        bodyComps: true,
        trainingSessions: true,
        competitions: { include: { schedule: true } },
        supplements: true,
        messages: true,
        calls: true,
      },
    }),
  ]);
  return new Response(JSON.stringify({ account, ...data }, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="nutricoach-data.json"' },
  });
}
