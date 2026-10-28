import { z } from "zod";

// Optional form fields arrive as "" when left empty: empty → null (a 0 stays 0).
export const optional = <T extends z.ZodType>(schema: T) => z.union([z.literal(""), schema]).transform((v) => (v === "" ? null : (v as z.output<T>)));
