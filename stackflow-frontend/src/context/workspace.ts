import { useOutletContext } from "react-router-dom";
import type { Workspace } from "@/types";
export interface WorkspaceContext {
  data: Workspace;
  reload: () => Promise<void>;
  notify: (message: string) => void;
}
export const useWorkspace = () => useOutletContext<WorkspaceContext>();
