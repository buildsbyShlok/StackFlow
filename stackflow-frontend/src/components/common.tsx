import type { ReactNode } from "react";
import { useState } from "react";
import { ArrowUpRight, Layers2 } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Project, Status } from "@/types";
import { statusLabels } from "@/lib/format";

export function Brand() {
  return (
    <span className="brand">
      <Layers2 size={21} strokeWidth={1.7} />
      <span>
        stackflow<span className="brand-period">.</span>
      </span>
    </span>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="actions">{children}</div>
    </header>
  );
}
export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={"status status-" + status}>
      <i />
      {statusLabels[status]}
    </span>
  );
}
export function Progress({
  value,
  label = "Verified progress",
}: {
  value: number;
  label?: string;
}) {
  return (
    <div className="progress-group">
      <div
        className="progress-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <span style={{ width: value + "%" }} />
      </div>
      <span className="mono">{value}%</span>
    </div>
  );
}
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-line" />
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <p>{message}</p>
      {retry && (
        <button className="text-button" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading-state" role="status" aria-label="Loading workspace">
      <div className="skeleton skeleton-title" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="skeleton skeleton-row" />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
export function Modal({
  title,
  description,
  onClose,
  children,
  wide = false,
  busy = false,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  busy?: boolean;
}) {
  const [returnFocus] = useState(() => document.activeElement);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className={wide ? "sf-dialog sf-dialog-wide" : "sf-dialog"}
        onCloseAutoFocus={(event) => { if (returnFocus instanceof HTMLElement && returnFocus.isConnected) { event.preventDefault(); returnFocus.focus(); } }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function ProjectList({ projects }: { projects: Project[] }) {
  return (
    <div className="project-list">
      {projects.map((project, index) => (
        <Link
          className="project-list-row"
          key={project._id}
          to={"/projects/" + project._id}
        >
          <span className="project-index mono">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="project-name">
            <strong>{project.name}</strong>
            <span>{project.description || "No description yet"}</span>
          </div>
          <span className="subtle project-milestones">
            {project.milestones.length} milestones
          </span>
          <div className="project-progress">
            <Progress value={project.progress} />
            <small>
              {project.verifiedCount} of {project.taskCount} verified
            </small>
          </div>
          <ArrowUpRight size={16} className="row-arrow" />
        </Link>
      ))}
    </div>
  );
}
