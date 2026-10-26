import API from "@/utils/api";
import type { Workspace, Task, SearchResults, Session, User } from "@/types";
export const getWorkspace = () =>
  API.get<Workspace>("/workspace").then((r) => r.data);
export const getTask = (id: string) =>
  API.get<{ task: Task }>("/tasks/details/" + id).then((r) => r.data.task);
export const searchWorkspace = (q: string, signal: AbortSignal) =>
  API.get<SearchResults>("/search", { params: { q }, signal }).then(
    (r) => r.data,
  );
export const getProfile = () =>
  API.get<{ user: User }>("/auth/profile").then((r) => r.data.user);
export const authenticate = (
  mode: "login" | "register",
  body: Record<string, string>,
) => API.post<Session>("/auth/" + mode, body).then((r) => r.data);
export const logout = () => API.post("/auth/logout");
export const saveProfile = (name: string) => API.patch<Session>("/auth/profile", { name }).then((r) => r.data);
export const changePassword = (currentPassword: string, newPassword: string) => API.post("/auth/password", { currentPassword, newPassword });
export const deleteProject = (id: string, version: number, confirmation: string) => API.delete("/projects/" + id, { data: { version, confirmation } });
export const deleteMilestone = (id: string, version: number, confirmation: string) => API.delete("/milestones/" + id, { data: { version, confirmation } });
export const joinWorkspace = (inviteCode: string) =>
  API.post<Session>("/org/join", { inviteCode }).then((r) => r.data);
export const leaveWorkspace = () =>
  API.post<Session>("/org/leave").then((r) => r.data);
export const removeMember = (userId: string) =>
  API.post("/org/remove-user", { userId });
export const updateRole = (userId: string, role: string) =>
  API.patch("/org/members/" + userId, { role });
export const saveProject = (body: Record<string, unknown>, id?: string) =>
  id ? API.patch("/projects/" + id, body) : API.post("/projects/create", body);
export const saveMilestone = (
  projectId: string,
  body: Record<string, unknown>,
  id?: string,
) =>
  id
    ? API.patch("/milestones/" + id, body)
    : API.post("/milestones/create/" + projectId, body);
export const saveTask = (
  milestoneId: string,
  body: Record<string, unknown>,
  id?: string,
) =>
  id
    ? API.patch("/tasks/" + id, body)
    : API.post("/tasks/create/" + milestoneId, body);
export const actOnTask = (
  id: string,
  action: string,
  version: number,
  reason?: string,
) => API.post("/tasks/" + action + "/" + id, { version, reason });
export const deleteTask = (id: string) => API.delete("/tasks/" + id);
