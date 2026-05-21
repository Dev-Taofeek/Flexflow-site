import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { signIn } from "next-auth/react";
import LoginPage from "@/app/(auth)/login/page";

jest.mock("next-auth/react", () => ({
    signIn: jest.fn(),
}));

jest.mock("next/navigation", () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
    useSearchParams: () => ({ get: jest.fn() }),
}));

jest.mock("framer-motion", () => ({
    motion: {
        div: ({ children, ...props }) => <div {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }) => children,
}));

describe("Login page", () => {
    beforeEach(() => {
        signIn.mockReset();
    });

    it("renders email, password fields and submit button", () => {
        render(<LoginPage />);
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    });

    it("shows validation errors when submitting empty form", async () => {
        const user = userEvent.setup();
        render(<LoginPage />);
        await user.click(screen.getByRole("button", { name: /sign in/i }));
        await waitFor(() => {
            // Zod fires "Email is required" for empty email
            expect(screen.getByText(/email is required/i)).toBeInTheDocument();
        });
        expect(signIn).not.toHaveBeenCalled();
    });

    it("calls signIn with credentials on valid submit", async () => {
        const user = userEvent.setup();
        signIn.mockResolvedValue({ ok: true, error: null });
        render(<LoginPage />);

        await user.type(screen.getByLabelText(/email/i), "test@example.com");
        await user.type(screen.getByLabelText(/password/i), "Password123!");
        await user.click(screen.getByRole("button", { name: /sign in/i }));

        await waitFor(() => {
            expect(signIn).toHaveBeenCalledWith(
                "credentials",
                expect.objectContaining({
                    email: "test@example.com",
                    password: "Password123!",
                    redirect: false,
                })
            );
        });
    });

    it("toggles password visibility", async () => {
        const user = userEvent.setup();
        render(<LoginPage />);
        const passwordInput = screen.getByLabelText(/password/i);
        expect(passwordInput).toHaveAttribute("type", "password");
        await user.click(screen.getByRole("button", { name: /toggle password visibility/i }));
        expect(passwordInput).toHaveAttribute("type", "text");
    });
});
