import { type FormEvent, startTransition } from "react";
import { z } from "zod";

// Optional form fields arrive as "" when left empty: empty → null (a 0 stays 0).
export const optional = <T extends z.ZodType>(schema: T) => z.union([z.literal(""), schema]).transform((v) => (v === "" ? null : (v as z.output<T>)));

// A form's onSubmit that runs its action (e.g. a useActionState dispatch) without React's reset after a form action, which
// would empty what the user typed when the server sends it back as invalid.
export const keepValues = (dispatch: (form: FormData) => void) => (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  startTransition(() => dispatch(form));
};
