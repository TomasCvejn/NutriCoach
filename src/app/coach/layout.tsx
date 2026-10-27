import { AreaHeader } from "@/components/area-header";
import { requireCoach } from "@/lib/auth";

export default async function CoachLayout({ children }: LayoutProps<"/coach">) {
  const coach = await requireCoach();
  return (
    <>
      <AreaHeader home="/coach" userName={coach.name} />
      <main className="flex-1 px-4 py-6 sm:px-[29px] sm:py-9">{children}</main>
    </>
  );
}
