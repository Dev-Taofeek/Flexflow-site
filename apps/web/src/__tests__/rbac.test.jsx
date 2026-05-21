import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PermissionMatrix } from "@/components/settings/roles/PermissionMatrix";
import { updatePermission } from "@/lib/roles-api";

jest.mock("@/lib/roles-api", () => ({
    updatePermission: jest.fn(),
}));

const ROLES = ["Admin", "Member", "Viewer"];
const RESOURCES = [
    { id: "issues",   label: "Issues",   actions: ["create", "read", "update", "delete"] },
    { id: "projects", label: "Projects", actions: ["create", "read", "update", "delete"] },
];
const INITIAL_PERMISSIONS = {
    Admin:  { issues: ["create", "read", "update", "delete"], projects: ["create", "read", "update", "delete"] },
    Member: { issues: ["create", "read", "update"],           projects: ["read"] },
    Viewer: { issues: ["read"],                               projects: ["read"] },
};

describe("PermissionMatrix", () => {
    beforeEach(() => {
        updatePermission.mockReset();
    });

    function renderMatrix() {
        return render(
            <PermissionMatrix
                roles={ROLES}
                resources={RESOURCES}
                initialPermissions={INITIAL_PERMISSIONS}
            />
        );
    }

    it("renders a toggle button for every role × resource × action combination", () => {
        renderMatrix();
        // 2 resources × 4 actions × 3 roles = 24 buttons
        const btns = screen.getAllByRole("button", { name: /enable|disable/i });
        expect(btns.length).toBe(2 * 4 * 3);
    });

    it("Admin has more 'Disable' buttons than Viewer (Admin has more permissions)", () => {
        renderMatrix();
        const disable = screen.getAllByRole("button", { name: /disable admin/i });
        const viewerDisable = screen.getAllByRole("button", { name: /disable viewer/i });
        expect(disable.length).toBeGreaterThan(viewerDisable.length);
    });

    it("calls updatePermission when a toggle is clicked", async () => {
        const user = userEvent.setup();
        updatePermission.mockResolvedValue({
            data: { permissions: INITIAL_PERMISSIONS },
        });
        renderMatrix();

        // Click an "Enable" button (a permission Viewer doesn't have)
        const enableBtns = screen.getAllByRole("button", { name: /enable viewer/i });
        await user.click(enableBtns[0]);

        await waitFor(() => {
            expect(updatePermission).toHaveBeenCalledTimes(1);
            expect(updatePermission).toHaveBeenCalledWith(
                expect.objectContaining({ enabled: true })
            );
        });
    });

    it("optimistically flips the button label before the API responds", async () => {
        const user = userEvent.setup();
        let resolve;
        updatePermission.mockReturnValue(new Promise((r) => { resolve = r; }));
        renderMatrix();

        const enableBtns = screen.getAllByRole("button", { name: /enable viewer/i });
        const target = enableBtns[0];
        const label = target.getAttribute("aria-label");

        await user.click(target);
        // After optimistic update the button label should flip
        await waitFor(() => {
            expect(target.getAttribute("aria-label")).not.toBe(label);
        });

        resolve({ data: { permissions: INITIAL_PERMISSIONS } });
    });
});

describe("RBAC role hierarchy — pure logic", () => {
    function canPerform(role, permissions, resource, action) {
        return permissions[role]?.[resource]?.includes(action) ?? false;
    }

    it("Admin can delete issues", () => {
        expect(canPerform("Admin", INITIAL_PERMISSIONS, "issues", "delete")).toBe(true);
    });

    it("Member cannot delete issues", () => {
        expect(canPerform("Member", INITIAL_PERMISSIONS, "issues", "delete")).toBe(false);
    });

    it("Viewer cannot create issues", () => {
        expect(canPerform("Viewer", INITIAL_PERMISSIONS, "issues", "create")).toBe(false);
    });

    it("Member can update issues", () => {
        expect(canPerform("Member", INITIAL_PERMISSIONS, "issues", "update")).toBe(true);
    });
});
