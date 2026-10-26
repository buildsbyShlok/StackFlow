import { useCallback, useEffect, useState } from "react";
import {
  NavLink,
  Link,
  Outlet,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare2,
  ShieldCheck,
  Users,
  Search,
  Menu,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAuth } from "@/context/auth";
import { getWorkspace, joinWorkspace } from "@/services/workspace";
import { errorMessage } from "@/utils/api";
import type { Workspace } from "@/types";
import { Brand, ErrorState, Loading, Modal } from "@/components/common";
import { Button } from "@/components/ui/button";
import CommandPalette from "@/components/CommandPalette";
import TaskPanel from "@/pages/tasks/TaskPanel";
import { initials, roleLabels } from "@/lib/format";
import Profile from "@/pages/Profile";

const links = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/my-tasks", label: "My tasks", icon: CheckSquare2 },
  { to: "/verification", label: "Verification", icon: ShieldCheck },
  { to: "/team", label: "Team", icon: Users },
];
export default function AppLayout() {
  const { user, accept, signOut } = useAuth();
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState(false);
  const [busy, setBusy] = useState(false);
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const taskId = params.get("task");
  const reload = useCallback(async () => {
    if (!user?.orgId) return;
    try {
      setData(await getWorkspace());
      setError("");
    } catch (e) {
      setError(errorMessage(e));
      throw e;
    }
  }, [user?.orgId]);
  useEffect(() => {
    let active = true;
    if (user?.orgId)
      getWorkspace()
        .then((result) => {
          if (active) {
            setData(result);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(errorMessage(e));
        });
    const onFocus = () => {
      if (document.visibilityState === "visible") void reload().catch(() => { });
    };
    const interval = setInterval(onFocus, 30000);
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [user?.orgId, reload]);
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
      if (e.key === "Escape") setMobile(false);
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  if (!user) return null;
  const pending =
    data?.tasks.filter(
      (t) =>
        t.status === "completed" &&
        (user.role === "admin" || t.milestone.assignedTo === user.id),
    ).length || 0;
  const nav = (
    <>
      <div className="sidebar-brand">
        <Brand />
      </div>
      <div className="workspace-identity">
        <span className="workspace-letter">
          {(data?.org.name || "Workspace")[0]}
        </span>
        <div>
          <strong>{data?.org.name || "Workspace"}</strong>
          <small>Team workspace</small>
        </div>
      </div>
      <div className="nav-label">WORKSPACE</div>
      <nav aria-label="Main navigation">
        {links
          .filter(
            (link) => link.to !== "/verification" || user.role !== "teammate",
          )
          .map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              title={collapsed ? label : undefined}
              onClick={() => setMobile(false)}
              className={({ isActive }) =>
                "nav-link" + (isActive ? " active" : "")
              }
            >
              <Icon size={17} strokeWidth={1.7} />
              <span>{label}</span>
              {to === "/verification" && pending > 0 && <b>{pending}</b>}
            </NavLink>
          ))}
      </nav>
      <div className="sidebar-note">
        <span className="tiny-rule" />
        <p>
          A little structure.
          <br />A lot of forward motion.
        </p>
      </div>
      <div className="sidebar-user">
        <Link to="/profile" className="profile-link" aria-label="Your profile" title="Your profile" onClick={() => setMobile(false)}>
          <span className="avatar">{initials(user.name)}</span>
          <div>
            <strong>{user.name}</strong>
            <small>{roleLabels[user.role]}</small>
          </div>
        </Link>
        <button
          title="Sign out"
          aria-label="Sign out"
          className="icon-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await signOut();
            } catch (e) {
              setNotice(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <LogOut size={15} />
        </button>
      </div>
    </>
  );
  return (
    <div className={"app-shell" + (collapsed ? " is-collapsed" : "")}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">{nav}</aside>
      {mobile && (
        <Modal
          title="Workspace navigation"
          description="Choose a section."
          onClose={() => setMobile(false)}
        >
          <div className="mobile-nav">{nav}</div>
        </Modal>
      )}
      <div className="app-main">
        <header className="topbar">
          <button
            className="icon-button desktop-collapse"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? (
              <PanelLeftOpen size={17} />
            ) : (
              <PanelLeftClose size={17} />
            )}
          </button>
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobile(true)}
          >
            <Menu size={19} />
          </button>
          <div className="breadcrumb">
            <span>Workspace</span>
            <span>/</span>
            <strong>
              {links.find((l) => l.to === location.pathname)?.label ||
                (location.pathname === "/profile" ? "Profile" : location.pathname.startsWith("/projects/")
                  ? "Project details"
                  : "Tasks")}
            </strong>
          </div>
          <button className="search-trigger" onClick={() => setSearch(true)}>
            <Search size={15} />
            <span>Find anything</span>
            <kbd>Ctrl K</kbd>
          </button>
        </header>
        <main id="main-content" className="page-content">
          {location.pathname === "/profile" ? <Profile key={user.id} workspaceName={data?.org._id === user.orgId ? data.org.name : undefined} /> : !user.orgId ? (
            <div className="join-workspace">
              <span className="eyebrow">A PLACE FOR YOUR WORK</span>
              <h1>Join a workspace</h1>
              <p>Enter an invite from your workspace admin.</p>
              <form
                className="form-stack"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const invite = new FormData(e.currentTarget).get(
                    "inviteCode",
                  ) as string;
                  setBusy(true);
                  setError("");
                  try {
                    accept(await joinWorkspace(invite));
                  } catch (err) {
                    setError(errorMessage(err));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  Invite code
                  <input name="inviteCode" required />
                </label>
                {error && <ErrorState message={error} />}
                <Button disabled={busy}>Join workspace</Button>
              </form>
            </div>
          ) : (
            <>
              {error && (
                <ErrorState
                  message={error}
                  retry={() => void reload().catch(() => { })}
                />
              )}{" "}
              {!data ? (
                !error && <Loading />
              ) : (
                <Outlet context={{ data, reload, notify: setNotice }} />
              )}
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>StackFlow</span>
          <span>Progress is earned. Verified work counts.</span>
        </footer>
      </div>
      {search && user.orgId && (
        <CommandPalette onClose={() => setSearch(false)} />
      )}
      {taskId && data && (
        <Modal
          title="Task details"
          description="Review context, update work, and see its history."
          onClose={() => {
            const next = new URLSearchParams(params);
            next.delete("task");
            setParams(next);
          }}
          wide
        >
          <TaskPanel
            key={taskId}
            id={taskId}
            workspace={{ data, reload, notify: setNotice }}
          />
        </Modal>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button onClick={() => setNotice("")} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
