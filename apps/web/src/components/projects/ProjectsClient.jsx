"use client";

import { useMemo, useState } from "react";

import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectsToolbar } from "@/components/projects/ProjectsToolbar";

export function ProjectsClient({ initialProjects }) {
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState("all");
  const [sort, setSort] = useState("recent");

  const projects = useMemo(() => {
    let result = [...initialProjects];

    if (search) {
      result = result.filter((project) => {
        const query = search.toLowerCase();

        return (
          project.name.toLowerCase().includes(query) ||
          project.description.toLowerCase().includes(query)
        );
      });
    }

    if (visibility !== "all") {
      result = result.filter(
        (project) => project.visibility.toLowerCase() === visibility.toLowerCase()
      );
    }

    if (sort === "name") {
      result.sort((firstProject, secondProject) =>
        firstProject.name.localeCompare(secondProject.name)
      );
    }

    if (sort === "progress") {
      result.sort((firstProject, secondProject) => secondProject.progress - firstProject.progress);
    }

    if (sort === "recent") {
      result.sort(
        (firstProject, secondProject) =>
          new Date(secondProject.updatedAt) - new Date(firstProject.updatedAt)
      );
    }

    return result;
  }, [initialProjects, search, visibility, sort]);

  return (
    <div className="space-y-6">
      <ProjectsToolbar
        search={search}
        visibility={visibility}
        sort={sort}
        onSearchChange={setSearch}
        onVisibilityChange={setVisibility}
        onSortChange={setSort}
      />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>

      {projects.length === 0 ? (
        <div className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-10 text-center">
          <h3 className="text-foreground dark:text-foreground-dark text-lg font-semibold">
            No projects found
          </h3>

          <p className="text-muted-foreground dark:text-muted-foreground-dark mt-2 text-sm">
            Try changing your search, filter, or sort options.
          </p>
        </div>
      ) : null}
    </div>
  );
}
