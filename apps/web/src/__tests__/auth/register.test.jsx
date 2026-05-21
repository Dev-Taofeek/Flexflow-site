import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { signIn } from "next-auth/react";
import RegisterPage from "@/app/(auth)/register/page";

jest.mock("next-auth/react", () => ({
    signIn: jest.fn(),
}));

jest.mock("next/navigation", () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("Register page", () => {
    beforeEach(() => {
        signIn.mockReset();
        mockFetch.mockReset();
    });

    it("renders name, email, password fields and submit button", () => {
        render(<RegisterPage />);
        expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
    });

    it("shows validation errors for empty fields", async () => {
        const user = userEvent.setup();
        render(<RegisterPage />);
        await user.click(screen.getByRole("button", { name: /create account/i }));
        await waitFor(() => {
            expect(screen.getByText(/full name is required/i)).toBeInTheDocument();
        });
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("shows error for short password", async () => {
        const user = userEvent.setup();
        render(<RegisterPage />);
        await user.type(screen.getByLabelText(/full name/i), "Jane Smith");
        await user.type(screen.getByLabelText(/work email/i), "jane@example.com");
        await user.type(screen.getByLabelText(/password/i), "short");
        await user.click(screen.getByRole("button", { name: /create account/i }));
        await waitFor(() => {
            expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
        });
    });

    it("registers and auto-signs-in on valid submission", async () => {
        const user = userEvent.setup();
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true, data: { user: { id: "1" } } }),
        });
        signIn.mockResolvedValueOnce({ ok: true, error: null });

        render(<RegisterPage />);
        await user.type(screen.getByLabelText(/full name/i), "Jane Smith");
        await user.type(screen.getByLabelText(/work email/i), "jane@example.com");
        await user.type(screen.getByLabelText(/password/i), "Password123!");
        await user.click(screen.getByRole("button", { name: /create account/i }));

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining("/auth/register"),
                expect.objectContaining({ method: "POST" })
            );
            expect(signIn).toHaveBeenCalledWith(
                "credentials",
                expect.objectContaining({ email: "jane@example.com", redirect: false })
            );
        });
    });

    it("shows API error message on failed registration", async () => {
        const user = userEvent.setup();
        mockFetch.mockResolvedValueOnce({
            ok: false,
            json: async () => ({ success: false, error: { message: "Email already in use" } }),
        });

        render(<RegisterPage />);
        await user.type(screen.getByLabelText(/full name/i), "Jane Smith");
        await user.type(screen.getByLabelText(/work email/i), "existing@example.com");
        await user.type(screen.getByLabelText(/password/i), "Password123!");
        await user.click(screen.getByRole("button", { name: /create account/i }));

        await waitFor(() => {
            expect(screen.getByText(/email already in use/i)).toBeInTheDocument();
        });
    });
});
