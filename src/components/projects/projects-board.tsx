"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { FolderKanban, Plus } from "lucide-react";
import { ProjectCard } from "@/components/projects/project-card";
import { ProjectFormModal, type ClientOption, type GoalOption } from "@/components/projects/project-form-modal";
import { EmptyState } from "@/components/ui/empty-state";
import type { ProjectWithStats } from "@/lib/queries/projects";

export function ProjectsBoard({
  projects,
  goals = [],
  clients = [],
}: {
  projects: ProjectWithStats[];
  goals?: GoalOption[];
  clients?: ClientOption[];
}) {
  const searchParams = useSearchParams();
  const [modalOpen, setModalOpen] = useState(() => searchParams.get("new") === "1");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          <Plus size={16} />
          New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create your first project to start tracking meaningful work."
          action={
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              New Project
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      <ProjectFormModal open={modalOpen} onClose={() => setModalOpen(false)} goals={goals} clients={clients} />
    </div>
  );
}
