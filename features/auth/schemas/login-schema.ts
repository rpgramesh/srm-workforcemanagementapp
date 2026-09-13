import { z } from "zod";

export const loginSchema = z.object({
  mobile: z
    .string()
    .trim()
    .min(1, "Mobile number is required"),
  pin: z
    .string()
    .regex(/^\d{4}$/, "Security PIN must be 4 digits"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
