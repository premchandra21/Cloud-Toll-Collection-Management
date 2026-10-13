import { z } from "zod";

// Query strings arrive as text. "" (an empty form field) is treated as "not provided".
export function optionalQuery<T extends z.ZodType>(schema: T) {
  return z.preprocess((v) => (v === "" ? undefined : v), schema.optional());
}

// z.coerce.boolean() would turn the text "false" into true, so parse the words explicitly.
export const queryBoolean = z.enum(["true", "false"]).transform((v) => v === "true");