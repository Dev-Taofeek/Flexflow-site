export function ProjectProgressWidget({ projects }) {
  return (
    <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-2xl border p-6">
      <div>
        <h2 className="text-foreground dark:text-foreground-dark text-lg font-semibold">
          Project Progress
        </h2>

        <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-sm">
          Track completion rates across active projects
        </p>
      </div>

      <div className="mt-6 space-y-6">
        {projects.map((project) => (
          <div key={project.id}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-foreground dark:text-foreground-dark text-sm font-medium">
                  {project.name}
                </h3>

                <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-xs">
                  {project.completedIssues}/{project.totalIssues} issues completed
                </p>
              </div>

              <span className="text-foreground dark:text-foreground-dark text-sm font-semibold">
                {project.progress}%
              </span>
            </div>

            <div className="bg-muted dark:bg-muted-dark mt-3 h-2 overflow-hidden rounded-full">
              <div
                className="bg-brand-600 dark:bg-brand-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${project.progress}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
