import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

// Each role's home; the login form lands here after sign-in.
export default async function Home() {
  const user = (await getSession())?.user;
  redirect(!user?.active ? "/login" : user.role === "COACH" ? "/coach" : "/app");
}
