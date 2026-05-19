import { Router } from "express";

import { successResponse } from "../utils/api-response.js";

const router = Router();

const roles = ["Owner", "Admin", "Member", "Viewer"];

const resources = [
    {
        id: "projects",
        label: "Projects",
        actions: ["create", "read", "update", "delete"],
    },
    {
        id: "issues",
        label: "Issues",
        actions: ["create", "read", "update", "delete"],
    },
    {
        id: "comments",
        label: "Comments",
        actions: ["create", "read", "update", "delete"],
    },
    {
        id: "team",
        label: "Team",
        actions: ["invite", "read", "update", "remove"],
    },
    {
        id: "settings",
        label: "Settings",
        actions: ["read", "update", "billing", "danger_zone"],
    },
];

let permissions = {
    Owner: {
        projects: ["create", "read", "update", "delete"],
        issues: ["create", "read", "update", "delete"],
        comments: ["create", "read", "update", "delete"],
        team: ["invite", "read", "update", "remove"],
        settings: ["read", "update", "billing", "danger_zone"],
    },
    Admin: {
        projects: ["create", "read", "update", "delete"],
        issues: ["create", "read", "update", "delete"],
        comments: ["create", "read", "update", "delete"],
        team: ["invite", "read", "update"],
        settings: ["read", "update"],
    },
    Member: {
        projects: ["read"],
        issues: ["create", "read", "update"],
        comments: ["create", "read", "update"],
        team: ["read"],
        settings: ["read"],
    },
    Viewer: {
        projects: ["read"],
        issues: ["read"],
        comments: ["read"],
        team: ["read"],
        settings: ["read"],
    },
};

router.get("/", async (req, res) => {
    return res.status(200).json(
        successResponse({
            roles,
            resources,
            permissions,
        }),
    );
});

router.patch("/", async (req, res) => {
    const { role, resource, action, enabled } = req.body;

    if (!roles.includes(role)) {
        return res.status(422).json({
            success: false,
            error: {
                code: "INVALID_ROLE",
                message: "Role is invalid",
            },
        });
    }

    const foundResource = resources.find((item) => item.id === resource);

    if (!foundResource || !foundResource.actions.includes(action)) {
        return res.status(422).json({
            success: false,
            error: {
                code: "INVALID_PERMISSION",
                message: "Permission is invalid",
            },
        });
    }

    const currentActions = permissions[role][resource] || [];

    permissions = {
        ...permissions,
        [role]: {
            ...permissions[role],
            [resource]: enabled
                ? Array.from(new Set([...currentActions, action]))
                : currentActions.filter((item) => item !== action),
        },
    };

    return res.status(200).json(
        successResponse({
            role,
            resource,
            action,
            enabled,
            permissions,
        }),
    );
});

export { router as rolesRouter };
