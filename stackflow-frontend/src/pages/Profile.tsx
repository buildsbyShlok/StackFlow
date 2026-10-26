import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/auth";
import { PageHeader, ErrorState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { saveProfile, changePassword } from "@/services/workspace";
import { errorMessage } from "@/utils/api";
import { initials, roleLabels } from "@/lib/format";

export default function Profile({ workspaceName }: { workspaceName?: string }) {
  const { user, accept, endSession } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || "");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const inFlight = useRef(false);
  if (!user) return null;
  async function save(action: "details" | "password") {
    if (inFlight.current) return;
    setError(""); setNotice("");
    if (action === "password" && passwords.next !== passwords.confirm) { setError("Your new passwords do not match."); return; }
    inFlight.current = true; setBusy(action);
    try {
      if (action === "details") { accept(await saveProfile(name)); setName(name.trim()); setNotice("Personal details saved."); }
      else {
        await changePassword(passwords.current, passwords.next);
        endSession("Password changed. Sign in with your new password.");
        navigate("/login", { replace: true, state: { message: "Password changed. Sign in with your new password." } });
      }
    } catch (e) { setError(errorMessage(e)); }
    finally { inFlight.current = false; setBusy(""); }
  }
  return <>
    <PageHeader eyebrow="YOUR ACCOUNT" title="Profile" description="Your details, workspace access, and account security." />
    <div className="profile-summary"><span className="avatar">{initials(user.name)}</span><div><strong>{user.name}</strong><span>{user.email}</span></div></div>
    {error && <ErrorState message={error} />}
    {notice && <p className="success-notice" role="status">{notice}</p>}
    <section className="settings-section"><div><h2>Personal details</h2><p>Your name appears on assignments and new activity.</p></div>
      <form className="form-stack" onSubmit={(e) => { e.preventDefault(); void save("details"); }}>
        <label>Name<input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} disabled={!!busy} /></label>
        <label>Email address<input type="email" value={user.email} readOnly /></label>
        <p className="form-hint">Email changes are not available. Your sign-in address stays the same.</p>
        <dl className="profile-access"><div><dt>Workspace</dt><dd>{workspaceName || (user.orgId ? "Loading workspace…" : "No workspace")}</dd></div><div><dt>Role</dt><dd>{user.orgId ? roleLabels[user.role] : "No workspace role"}</dd></div></dl>
        <p className="form-hint">Workspace access and roles are managed by your Admin.</p>
        <div className="form-footer"><Button type="button" variant="outline" disabled={!!busy || name === user.name} onClick={() => { setName(user.name); setError(""); setNotice(""); }}>Cancel</Button><Button disabled={!!busy || !name.trim() || name.trim() === user.name}>{busy === "details" ? "Saving…" : "Save changes"}</Button></div>
      </form>
    </section>
    <section className="settings-section"><div><h2>Change password</h2><p>Changing your password signs you out of every session, including this one.</p></div>
      <form className="form-stack" onSubmit={(e) => { e.preventDefault(); void save("password"); }}>
        {([['current', 'Current password'], ['next', 'New password'], ['confirm', 'Confirm new password']] as const).map(([key, label]) => <label key={key}>{label}<input type="password" autoComplete={key === "current" ? "current-password" : "new-password"} value={passwords[key]} onChange={(e) => setPasswords({ ...passwords, [key]: e.target.value })} required minLength={key === "current" ? undefined : 10} maxLength={72} disabled={!!busy} /></label>)}
        <p className="form-hint">Use at least 10 characters. Maximum 72 bytes.</p>
        <div className="form-footer"><Button type="button" variant="outline" disabled={!!busy} onClick={() => { setPasswords({ current: "", next: "", confirm: "" }); setError(""); setNotice(""); }}>Cancel</Button><Button disabled={!!busy}>{busy === "password" ? "Updating…" : "Change password"}</Button></div>
      </form>
    </section>
  </>;
}
