import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PermissionMatrix } from "@/components/settings/roles/PermissionMatrix";
import { updatePermission } from "@/lib/roles-api";

jest.mock("@/lib/roles-api", () => ({
    updatePermission: jest.fn(),
}));

const ROLES = ["ADMIN", "MEMBER", "VIEWER"];
const RESOURCES = ["issues", "projects"];
const INITIAL_PERMISSIONS = {
    ADMIN: { issues: ["create", "edit", "delete"], projects: ["create", "edit"] },
    MEMBER: { issues: ["create", "edit"], projects: [] },
    VIEWER: { issues: [], projects: [] },
};

describe("PermissionMatrix", () => {
    beforeEach(() => {
        updatePermission.mockReset();
    });

    it("renders a checkbox for every role × resource × action combination", () => {
        render(
            <PermissionMatrix
                roles={ROLES}
                resources={RESOURCES}
                initialPermissions={INITIAL_PERMISSIONS}
            />
        );
        const checkboxes = screen.getAllByRole("checkbox");
        expect(checkboxes.length).toBeGreaterThan(0);
    });

    it("ADMIN delete-issues checkbox is checked, VIEWER is not", () => {
        render(
            <PermissionMatrix
                roles={ROLES}
                resources={RESOURCES}
                initialPermissions={INITIAL_PERMISSIONS}
            />
        );
        const checked = screen.getAllByRole("checkbox", { checked: true });
        const unchecked = screen.getAllByRole("checkbox", { checked: false });
        expect(checked.length).toBeGreaterThan(0);
        expect(unchecked.length).toBeGreaterThan(0);
    });

    it("calls updatePermission when a checkbox is toggled", async () => {
        const user = userEvent.setup();
        updatePermission.mockResolvedValue({
            data: { permissions: INITIAL_PERMISSIONS },
        });

        render(
            <PermissionMatrix
                roles={ROLES}
                resources={RESOURCES}
                initialPermissions={INITIAL_PERMISSIONS}
            />
        );

        const unchecked = screen.getAllByRole("checkbox", { checked: false });
        await user.click(unchecked[0]);

        await waitFor(() => {
            expect(updatePermission).toHaveBeenCalledTimes(1);
            expect(updatePermission).toHaveBeenCalledWith(
                expect.objectContaining({ enabled: true })
            );
        });
    });

    it("optimistically toggles the checkbox before the API responds", async () => {
        const user = userEvent.setup();
        let resolvePermission;
        updatePermission.mockReturnValue(new Promise((r) => { resolvePermission = r; }));

        render(
            <PermissionMatrix
                roles={ROLES}
                resources={RESOURCES}
                initialPermissions={INITIAL_PERMISSIONS}
            />
        );

        const unchecked = screen.getAllByRole("checkbox", { checked: false });
        const target = unchecked[0];
        await user.click(target);
        expect(target).toBeChecked();

        resolvePermission({ data: { permissions: INITIAL_PERMISSIONS } });
    });
});

describe("RBAC role hierarchy — pure logic", () => {
    function canPerform(role, permissions, resource, action) {
        return permissions[role]?.[resource]?.includes(action) ?? false;
    }

    it("ADMIN can delete issues", () => {
        expect(canPerform("ADMIN", INITIAL_PERMISSIONS, "issues", "delete")).toBe(true);
    });

    it("MEMBER cannot delete issues", () => {
        expect(canPerform("MEMBER", INITIAL_PERMISSIONS, "issues", "delete")).toBe(false);
    });

    it("VIEWER cannot create issues", () => {
        expect(canPerform("VIEWER", INITIAL_PERMISSIONS, "issues", "create")).toBe(false);
    });

    it("MEMBER can edit issues", () => {
        expect(canPerform("MEMBER", INITIAL_PERMISSIONS, "issues", "edit")).toBe(true);
    });
});
