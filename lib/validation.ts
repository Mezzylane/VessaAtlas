import { z } from "zod";

export const submitRatingSchema = z.object({
  rating: z.number().int().min(1).max(10),
  comment: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : undefined)),
  website: z.string().optional(), // honeypot field
});

// floorLabel is intentionally not accepted here — it's derived from
// floorNumber server-side (see lib/floors.ts) so it can never drift out of
// sync with the number an admin actually entered.
export const createRestroomSchema = z.object({
  building: z.string().trim().min(1).max(200),
  floorNumber: z.number().int().min(-5).max(50),
  wing: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => (v ? v : undefined)),
  gender: z.enum(["men", "women", "unisex"]),
  xCoord: z.number().int().min(0),
  yCoord: z.number().int().min(0),
});

export const updateRestroomSchema = createRestroomSchema;

export const adminLoginSchema = z.object({
  password: z.string().min(1).max(200),
});
