import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter")
  .regex(/[a-z]/, "Password must include at least one lowercase letter")
  .regex(/[0-9]/, "Password must include at least one number");

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const registerAccountSchema = z.object({
  name: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(80, "Full name is too long"),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: passwordSchema,
});

export const registerOrganizationSchema = z.object({
  organizationName: z
    .string()
    .min(2, "Organization name must be at least 2 characters")
    .max(80, "Organization name is too long"),
  workspaceName: z
    .string()
    .min(2, "Workspace name must be at least 2 characters")
    .max(80, "Workspace name is too long"),
});

export const registerInviteSchema = z.object({
  inviteEmails: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((email) => email.trim())
            .filter(Boolean)
        : []
    )
    .refine(
      (emails) => emails.every((email) => z.string().email().safeParse(email).success),
      "Enter valid email addresses separated by commas"
    ),
});

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
