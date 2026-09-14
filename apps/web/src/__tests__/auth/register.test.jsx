import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { signIn } from "next-auth/react";
import RegisterPage from "@/app/(auth)/register/page";
import { ToastProvider } from "@/contexts/ToastContext";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { I18nProvider } from "@/i18n";

jest.mock("next-auth/react", () => ({
    signIn: jest.fn(),
}));

jest.mock("next/navigation", () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
    useSearchParams: () => ({ get: jest.fn() }),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

function renderPage() {
    return render(
        <PreferencesProvider>
            <I18nProvider>
                <ToastProvider>
                    <RegisterPage />
                </ToastProvider>
            </I18nProvider>
        </PreferencesProvider>
    );
}

describe("Register page", () => {
    beforeEach(() => {
        signIn.mockReset();
        mockFetch.mockReset();
    });

    it("renders name, email, password fields and submit button", () => {
        renderPage();
        expect(screen.getByPlaceholderText(/jane smith/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/you@company\.com/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/at least 8 characters/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
    });

    it("shows validation errors for empty fields", async () => {
        const user = userEvent.setup();
        renderPage();
        await user.click(screen.getByRole("button", { name: /create account/i }));
        await waitFor(() => {
            expect(screen.getByText(/full name is required/i)).toBeInTheDocument();
        });
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("shows error for short password", async () => {
        const user = userEvent.setup();
        renderPage();
        await user.type(screen.getByPlaceholderText(/jane smith/i), "Jane Smith");
        await user.type(screen.getByPlaceholderText(/you@company\.com/i), "jane@example.com");
        await user.type(screen.getByPlaceholderText(/at least 8 characters/i), "short");
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

        renderPage();
        await user.type(screen.getByPlaceholderText(/jane smith/i), "Jane Smith");
        await user.type(screen.getByPlaceholderText(/you@company\.com/i), "jane@example.com");
        await user.type(screen.getByPlaceholderText(/at least 8 characters/i), "Password123!");
        await user.click(screen.getByRole("button", { name: /create account/i }));

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining("/auth/register"),
                expect.objectContaining({ method: "POST" })
            );
        });
    });

    it(
        "shows API error message on failed registration",
        async () => {
            const user = userEvent.setup();
            mockFetch.mockResolvedValueOnce({
                ok: false,
                json: async () => ({ success: false, error: { message: "Email already in use" } }),
            });

            renderPage();
            await user.type(screen.getByPlaceholderText(/jane smith/i), "Jane Smith");
            await user.type(screen.getByPlaceholderText(/you@company\.com/i), "existing@example.com");
            await user.type(screen.getByPlaceholderText(/at least 8 characters/i), "Password123!");
            await user.click(screen.getByRole("button", { name: /create account/i }));

            await waitFor(() => {
                // The error appears both in the inline form message and the toast
                expect(screen.getAllByText(/email already in use/i).length).toBeGreaterThan(0);
            });
        },
        15000
    );
});
