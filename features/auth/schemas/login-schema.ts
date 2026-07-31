import { z } from "zod";
import { isAustralianMobile } from "@/features/auth/services/au-mobile";

export const loginSchema = z.object({
  mobile: z
    .string()
    .min(1, "Mobile number is required")
    .refine(isAustralianMobile, "Enter a valid Australian mobile number"),
  pin: z
    .string()
    .regex(/^\d{4}$/, "Security PIN must be 4 digits"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
