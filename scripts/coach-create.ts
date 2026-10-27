import { parseArgs } from "node:util";
import { z } from "zod";
import { createUser } from "../src/lib/auth";

// npm run coach:create -- --email … --name … --password …  (timezone Europe/Prague, locale cs; editable in settings)
const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string" }, password: { type: "string" } } });
const args = z
  .object({ email: z.email(), name: z.string().trim().min(1), password: z.string().min(8) })
  .safeParse(values);
if (!args.success) {
  console.error(z.prettifyError(args.error));
  process.exit(1);
}
createUser({ ...args.data, role: "COACH" }).then((coach) => console.log(`Coach ${coach.email} created.`));
