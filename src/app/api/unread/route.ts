import { requireUser } from "@/lib/auth";
import { badgesOf } from "@/lib/messages";

// The nav badges, fetched by the shell on client navigation (its layout isn't re-rendered then).
export async function GET() {
  return Response.json(await badgesOf(await requireUser()));
}
