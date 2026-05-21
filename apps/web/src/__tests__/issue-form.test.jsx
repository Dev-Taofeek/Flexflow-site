import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createProject, fetchProjects } from "@/lib/projects-api";
import ProjectsPage from "@/app/(app)/projects/page";

jest.mock("@/lib/projects-api", () => ({
    fetchProjects: jest.fn(),
    createProject: jest.fn(),
}));

jest.mock("@/contexts/AppContext", () => ({
    useApp: () => ({
        currentWorkspace: { id: "ws1", name: "My Workspace" },
        accessToken: "test-token",
        isReady: true,
    }),
}));

jest.mock("next/navigation", () => ({
    useRouter: () => ({ push: jest.fn() }),
    useParams: () => ({}),
    usePathname: () => "/projects",
}));

// Helper: render and wait for the initial fetch to settle
async function renderReady() {
    fetchProjects.mockResolvedValue([]);
    let result;
    await act(async () => {
        result = render(<ProjectsPage />);
    });
    return result;
}

describe("Issue / Project creation form", () => {
    beforeEach(() => {
        createProject.mockReset();
        fetchProjects.mockReset();
    });

    it("shows New Project button after loading", async () => {
        await renderReady();
        expect(screen.getByRole("button", { name: /new project/i })).toBeInTheDocument();
    });

    it("reveals the create form when New Project is clicked", async () => {
        const user = userEvent.setup();
        await renderReady();
        await user.click(screen.getByRole("button", { name: /new project/i }));
        expect(screen.getByPlaceholderText(/project name/i)).toBeInTheDocument();
    });

    it("does not submit when name is empty", async () => {
        const user = userEvent.setup();
        await renderReady();
        await user.click(screen.getByRole("button", { name: /new project/i }));
        await user.click(screen.getByRole("button", { name: /create project/i }));
        expect(createProject).not.toHaveBeenCalled();
    });

    it("calls createProject with correct payload on valid submit", async () => {
        const user = userEvent.setup();
        createProject.mockResolvedValueOnce({
            id: "p1", name: "My API", description: "", visibility: "PRIVATE",
        });
        await renderReady();
        await user.click(screen.getByRole("button", { name: /new project/i }));
        await user.type(screen.getByPlaceholderText(/project name/i), "My API");
        await act(async () => {
            await user.click(screen.getByRole("button", { name: /create project/i }));
        });
        expect(createProject).toHaveBeenCalledWith(
            expect.objectContaining({ name: "My API", workspaceId: "ws1" }),
            "test-token"
        );
    });

    it("closes the form after successful creation", async () => {
        const user = userEvent.setup();
        createProject.mockResolvedValueOnce({
            id: "p2", name: "Backend", description: "", visibility: "PRIVATE",
        });
        await renderReady();
        await user.click(screen.getByRole("button", { name: /new project/i }));
        await user.type(screen.getByPlaceholderText(/project name/i), "Backend");
        await act(async () => {
            await user.click(screen.getByRole("button", { name: /create project/i }));
        });
        await waitFor(() => {
            expect(screen.queryByPlaceholderText(/project name/i)).not.toBeInTheDocument();
        });
    });

    it("Cancel hides the form without submitting", async () => {
        const user = userEvent.setup();
        await renderReady();
        await user.click(screen.getByRole("button", { name: /new project/i }));
        expect(screen.getByPlaceholderText(/project name/i)).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: /cancel/i }));
        expect(screen.queryByPlaceholderText(/project name/i)).not.toBeInTheDocument();
        expect(createProject).not.toHaveBeenCalled();
    });
});
