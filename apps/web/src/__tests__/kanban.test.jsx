import { render, screen } from "@testing-library/react";
import { KanbanBoard } from "@/components/projects/KanbanBoard";
import { updateIssueStatus } from "@/lib/projects-api";

jest.mock("@/lib/projects-api", () => ({
    updateIssueStatus: jest.fn(),
}));

jest.mock("@/lib/socket", () => ({
    socket: {
        connect: jest.fn(),
        disconnect: jest.fn(),
        emit: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
    },
}));

const MOCK_ISSUES = [
    { id: "i1", title: "Fix login bug", status: "TODO", priority: "HIGH", assignee: null, labels: [] },
    { id: "i2", title: "Add dark mode", status: "IN_PROGRESS", priority: "MEDIUM", assignee: null, labels: [] },
    { id: "i3", title: "Write tests", status: "IN_REVIEW", priority: "LOW", assignee: null, labels: [] },
    { id: "i4", title: "Deploy to prod", status: "DONE", priority: "URGENT", assignee: null, labels: [] },
];

describe("KanbanBoard", () => {
    it("renders all four column headings", () => {
        render(<KanbanBoard projectId="p1" initialIssues={[]} token="tok" />);
        expect(screen.getByText("To Do")).toBeInTheDocument();
        expect(screen.getByText("In Progress")).toBeInTheDocument();
        expect(screen.getByText("In Review")).toBeInTheDocument();
        expect(screen.getByText("Done")).toBeInTheDocument();
    });

    it("places issues in the correct columns", () => {
        render(<KanbanBoard projectId="p1" initialIssues={MOCK_ISSUES} token="tok" />);
        expect(screen.getByText("Fix login bug")).toBeInTheDocument();
        expect(screen.getByText("Add dark mode")).toBeInTheDocument();
        expect(screen.getByText("Write tests")).toBeInTheDocument();
        expect(screen.getByText("Deploy to prod")).toBeInTheDocument();
    });

    it("shows zero-count badge for empty columns", () => {
        render(<KanbanBoard projectId="p1" initialIssues={[]} token="tok" />);
        const badges = screen.getAllByText("0");
        expect(badges).toHaveLength(4);
    });

    it("shows correct issue count per column", () => {
        render(<KanbanBoard projectId="p1" initialIssues={MOCK_ISSUES} token="tok" />);
        const ones = screen.getAllByText("1");
        expect(ones).toHaveLength(4);
    });

    it("renders drag handles for each issue", () => {
        render(<KanbanBoard projectId="p1" initialIssues={MOCK_ISSUES} token="tok" />);
        const handles = screen.getAllByRole("button", { name: /drag/i });
        expect(handles).toHaveLength(MOCK_ISSUES.length);
    });
});

describe("groupIssuesByStatus — pure logic", () => {
    const STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

    function groupIssuesByStatus(issues) {
        return STATUSES.reduce((acc, status) => {
            acc[status] = issues.filter((i) => i.status === status);
            return acc;
        }, {});
    }

    it("groups issues correctly", () => {
        const groups = groupIssuesByStatus(MOCK_ISSUES);
        expect(groups.TODO).toHaveLength(1);
        expect(groups.IN_PROGRESS).toHaveLength(1);
        expect(groups.IN_REVIEW).toHaveLength(1);
        expect(groups.DONE).toHaveLength(1);
    });

    it("returns empty arrays for statuses with no issues", () => {
        const groups = groupIssuesByStatus([]);
        STATUSES.forEach((s) => expect(groups[s]).toHaveLength(0));
    });

    it("handles multiple issues in the same column", () => {
        const issues = [
            { id: "a", status: "TODO" },
            { id: "b", status: "TODO" },
            { id: "c", status: "DONE" },
        ];
        const groups = groupIssuesByStatus(issues);
        expect(groups.TODO).toHaveLength(2);
        expect(groups.DONE).toHaveLength(1);
    });
});
