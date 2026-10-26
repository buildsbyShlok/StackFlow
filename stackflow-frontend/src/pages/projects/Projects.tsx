import { useState } from "react";
import { Search, Plus } from "lucide-react";
import { useWorkspace } from "@/context/workspace";
import { useAuth } from "@/context/auth";
import { EmptyState, PageHeader, ProjectList } from "@/components/common";
import { ProjectEditor } from "@/components/WorkForms";
import { Button } from "@/components/ui/button";
export default function Projects() {
  const workspace = useWorkspace();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const projects = workspace.data.projects.filter((p) =>
    (p.name + " " + p.description).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        eyebrow="PLAN / EXECUTE / VERIFY"
        title="Projects"
        description="Outcomes, ownership, and a shared sense of direction."
      >
        {user?.role === "admin" && (
          <Button onClick={() => setOpen(true)}>
            <Plus size={15} />
            New project
          </Button>
        )}
      </PageHeader>
      <div className="list-toolbar">
        <span className="list-count">
          {workspace.data.projects.length} projects
        </span>
        <label className="search-field">
          <Search size={15} />
          <input
            aria-label="Search projects"
            placeholder="Find a project…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      {projects.length ? (
        <ProjectList projects={projects} />
      ) : (
        <EmptyState
          title={query ? "No matching projects" : "A fresh start."}
          description={
            query
              ? "Try a different search."
              : user?.role === "admin"
                ? "Create a project to define your next outcome."
                : "Your workspace Admin can create a project."
          }
        >
          {!query && user?.role === "admin" && (
            <Button onClick={() => setOpen(true)}>Create project</Button>
          )}
        </EmptyState>
      )}
      {open && (
        <ProjectEditor workspace={workspace} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
