import { parseArgs } from "node:util";
import { z } from "zod";
import { createUser } from "../src/lib/auth";

// npm run coach:create -- --email … --name …  (timezone Europe/Prague, locale cs; editable in settings)
// The coach signs in with the Google account of that email; the first sign-in links it.
const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string" } } });
const args = z.object({ email: z.email(), name: z.string().trim().min(1) }).safeParse(values);
if (!args.success) {
  console.error(z.prettifyError(args.error));
  process.exit(1);
}
createUser({ ...args.data, role: "COACH" }).then((coach) => console.log(`Coach ${coach.email} created.`));
