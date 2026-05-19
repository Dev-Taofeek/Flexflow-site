import { IssueDetailView } from "@/components/issues/IssueDetailView";

import { fetchIssue } from "@/lib/issues-api";

export default async function IssueDetailPage({ params }) {
  const { projectId, issueId } = await params;

  const response = await fetchIssue({
    projectId,
    issueId,
  });

  return (
    <IssueDetailView
      project={response.data.project}
      issue={response.data.issue}
      comments={response.data.comments}
      activityLog={response.data.activityLog}
      people={response.data.people}
      availableLabels={response.data.availableLabels}
    />
  );
}
