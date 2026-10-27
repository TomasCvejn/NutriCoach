import { AreaHeader } from "@/components/area-header";
import { requireClient } from "@/lib/auth";

export default async function ClientLayout({ children }: LayoutProps<"/app">) {
  const { user } = await requireClient();
  return (
    <>
      <AreaHeader home="/app" userName={user.name} />
      <main className="flex-1 px-4 py-6 sm:px-[29px] sm:py-9">{children}</main>
    </>
  );
}
