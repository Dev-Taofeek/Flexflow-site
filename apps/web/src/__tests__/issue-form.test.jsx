import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createProject } from "@/lib/projects-api";
import ProjectsPage from "@/app/(app)/projects/page";

jest.mock("@/lib/projects-api", () => ({
    fetchProjects: jest.fn().mockResolvedValue([]),
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
}));

describe("Issue / Project creation form", () => {
    beforeEach(() => {
        createProject.mockReset();
    });

    it("shows New Project button", () => {
        render(<ProjectsPage />);
        expect(screen.getByRole("button", { name: /new project/i })).toBeInTheDocument();
    });

    it("reveals the create form when New Project is clicked", async () => {
        const user = userEvent.setup();
        render(<ProjectsPage />);
        await user.click(screen.getByRole("button", { name: /new project/i }));
        expect(screen.getByRole("heading", { name: /new project/i })).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/project name/i)).toBeInTheDocument();
    });

    it("does not submit when name is empty", async () => {
        const user = userEvent.setup();
        render(<ProjectsPage />);
        await user.click(screen.getByRole("button", { name: /new project/i }));
        await user.click(screen.getByRole("button", { name: /create project/i }));
        expect(createProject).not.toHaveBeenCalled();
    });

    it("calls createProject with correct payload on valid submit", async () => {
        const user = userEvent.setup();
        createProject.mockResolvedValueOnce({ id: "p1", name: "My API", description: "", visibility: "PRIVATE" });

        render(<ProjectsPage />);
        await user.click(screen.getByRole("button", { name: /new project/i }));
        await user.type(screen.getByPlaceholderText(/project name/i), "My API");
        await user.click(screen.getByRole("button", { name: /create project/i }));

        await waitFor(() => {
            expect(createProject).toHaveBeenCalledWith(
                expect.objectContaining({ name: "My API", workspaceId: "ws1" }),
                "test-token"
            );
        });
    });

    it("closes the form after successful creation", async () => {
        const user = userEvent.setup();
        createProject.mockResolvedValueOnce({ id: "p2", name: "Backend", description: "", visibility: "PRIVATE" });

        render(<ProjectsPage />);
        await user.click(screen.getByRole("button", { name: /new project/i }));
        await user.type(screen.getByPlaceholderText(/project name/i), "Backend");
        await user.click(screen.getByRole("button", { name: /create project/i }));

        await waitFor(() => {
            expect(screen.queryByPlaceholderText(/project name/i)).not.toBeInTheDocument();
        });
    });

    it("Cancel button hides the form without submitting", async () => {
        const user = userEvent.setup();
        render(<ProjectsPage />);
        await user.click(screen.getByRole("button", { name: /new project/i }));
        expect(screen.getByPlaceholderText(/project name/i)).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: /cancel/i }));
        expect(screen.queryByPlaceholderText(/project name/i)).not.toBeInTheDocument();
        expect(createProject).not.toHaveBeenCalled();
    });
});
