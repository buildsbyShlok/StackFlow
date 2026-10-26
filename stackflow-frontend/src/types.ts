export type Role = "admin" | "techlead" | "teammate";
export type Status =
  | "pending"
  | "in_progress"
  | "completed"
  | "verified"
  | "changes_requested";
export type Priority = "low" | "medium" | "high" | "urgent";
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  orgId: string | null;
}
export interface Member {
  _id: string;
  name: string;
  email: string;
  role: Role;
  createdAt?: string;
}
export interface HistoryItem {
  action: string;
  from?: Status;
  to?: Status;
  actorName: string;
  at: string;
  reason?: string;
}
export interface Task {
  _id: string;
  title: string;
  description?: string;
  status: Status;
  priority: Priority;
  dueDate?: string;
  assignedTo: Member | null;
  milestoneId: string;
  project: { _id: string; name: string };
  milestone: { _id: string; title: string; assignedTo: string };
  __v: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  verifiedAt?: string;
  reviewReason?: string;
  history?: HistoryItem[];
}
export interface Milestone {
  __v?: number;
  _id: string;
  title: string;
  description?: string;
  projectId: string;
  assignedTo: Member | null;
  dueDate?: string;
  progress: number;
  taskCount: number;
  verifiedCount: number;
  tasks: Task[];
}
export interface Project {
  __v?: number;
  _id: string;
  name: string;
  description: string;
  createdAt: string;
  milestones: Milestone[];
  progress: number;
  taskCount: number;
  verifiedCount: number;
}
export interface Org {
  _id: string;
  name: string;
  inviteCode?: string;
  members: Member[];
}
export interface Workspace {
  org: Org;
  projects: Project[];
  milestones: Milestone[];
  tasks: Task[];
  members: Member[];
}
export interface Session {
  accessToken: string;
  user: User;
}
export interface SearchItem {
  id: string;
  title: string;
  subtitle: string;
  url: string;
}
export type SearchResults = Record<
  "projects" | "milestones" | "tasks" | "people",
  SearchItem[]
>;
