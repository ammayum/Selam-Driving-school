import { useEffect, useRef, useState } from "react";
import { request } from "../api/client";
import { TemporaryCredentials } from "./TemporaryCredentials";
import { AdminManagedUser, CreatedUser } from "../types";
import "./UserManagement.css";

type Action = "add" | "edit" | "reset" | "delete" | "freeze" | "restore";
type Selection = { action: Action; user?: AdminManagedUser };
const roles = ["student", "instructor", "admin"] as const;
const labels = {student:"Student", instructor:"Instructor", admin:"Administrator"};
const stateOf = (u: AdminManagedUser) => u.is_deleted ? "Deleted" : u.is_frozen ? "Frozen" : "Active";

export function UserManagement({ currentUserId, onChanged }: { currentUserId?: number; onChanged: () => void }) {
  const [created,setCreated]=useState<CreatedUser | null>(null);
  const [users, setUsers] = useState<AdminManagedUser[]>([]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [statusFilter, setStatusFilter] = useState("current");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [createRole, setCreateRole] = useState<AdminManagedUser["role"]>("student");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const mounted = useRef(true);
  async function load() {
    setLoading(true);
    try {
      const rows = await Promise.all(roles.map(r => request<AdminManagedUser[]>(`/admin/users?role=${r}&include_deleted=true`)));
      if(mounted.current) setUsers(rows.flat().sort((a,b) => a.full_name.localeCompare(b.full_name)));
    } finally { if(mounted.current) setLoading(false); }
  }
  useEffect(() => { mounted.current=true; load().catch(e => { if(mounted.current) setError(e.message); }); return () => { mounted.current=false; }; }, []);
  useEffect(() => { if(selection) dialog.current?.showModal(); else dialog.current?.close(); }, [selection]);
  useEffect(() => { setPage(1); }, [query,role,statusFilter]);
  const filtered = users.filter(u => (role==="all" || u.role===role) &&
    (statusFilter==="all" || (statusFilter==="current" ? !u.is_deleted : stateOf(u).toLowerCase()===statusFilter)) &&
    `${u.full_name} ${u.email} ${u.phone} ${u.id}`.toLowerCase().includes(query.toLowerCase().trim()));
  const pages = Math.max(1,Math.ceil(filtered.length/10));
  const currentPage = Math.min(page,pages);
  const user = selection?.user;
  const editing = selection?.action==="add" || selection?.action==="edit";
  const needsPassword = selection?.action==="reset" || user?.role==="admin" || (selection?.action==="add" && createRole==="admin");
  const actionTitle = selection?.action==="add" ? "Add user" : selection?.action==="edit" ? "Edit user" : selection?.action==="reset" ? "Reset password" : selection?.action==="freeze" ? (user?.is_frozen ? "Unfreeze account" : "Freeze account") : selection?.action==="restore" ? "Restore account" : "Delete account";
  function open(action: Action, user?: AdminManagedUser) { setError(""); setStatus(""); setCreateRole(user?.role || "student"); setSelection({action,user}); }
  return <section className="user-management" aria-labelledby="users-title">
    <header className="users-heading"><div><p className="eyebrow">People &amp; access</p><h2 id="users-title">User Management</h2><p>One place to manage your school accounts.</p></div><button className="btn btn-gold" onClick={() => open("add")}>Add User</button></header>
    {created && <TemporaryCredentials user={created} onDismiss={() => setCreated(null)} />}
    <div className="users-summary">{roles.map(r => <article key={r}><span>{labels[r]}s</span><strong>{users.filter(u => u.role===r && !u.is_deleted).length}</strong></article>)}</div>
    <article className="card users-directory">
      <div className="users-filters"><label>Search users<input type="search" placeholder="Name, email, phone or ID" value={query} onChange={e => setQuery(e.target.value)} /></label>
        <label>Role<select value={role} onChange={e => setRole(e.target.value)}><option value="all">All roles</option>{roles.map(r => <option key={r} value={r}>{labels[r]}</option>)}</select></label>
        <label>Status<select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="current">Current accounts</option><option value="active">Active</option><option value="frozen">Frozen</option><option value="deleted">Deleted</option><option value="all">All accounts</option></select></label>
        <button className="mini-btn" disabled={loading} onClick={() => { setError(""); load().catch(e => setError(e.message)); }}>Refresh</button>
      </div>
      <p role="status">{status || (loading ? "Loading accounts..." : `${filtered.length} matching accounts`)}</p>
      {!selection && error && <p role="alert">{error}</p>}
      <div className="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Contact</th><th>Actions</th></tr></thead><tbody>
        {filtered.slice((currentPage-1)*10,currentPage*10).map(u => <tr key={u.id}>
          <td><strong>{u.full_name}</strong><small>#{u.id}{u.id===currentUserId ? " / You" : ""}</small></td><td>{labels[u.role]}</td><td><span className={`user-state ${stateOf(u).toLowerCase()}`}>{stateOf(u)}</span></td><td>{u.email}<small>{u.phone}</small></td>
          <td><div className="user-actions">{u.is_deleted ? <button className="mini-btn" onClick={() => open("restore",u)}>Restore</button> : <>
            <button className="mini-btn" onClick={() => open("edit",u)}>Edit</button>
            <button className="mini-btn" disabled={u.is_frozen} onClick={() => open("reset",u)}>Reset password</button>
            <button className="mini-btn" disabled={u.id===currentUserId} onClick={() => open("freeze",u)}>{u.is_frozen ? "Unfreeze" : "Freeze"}</button>
            <button className="mini-btn danger" disabled={u.id===currentUserId} onClick={() => open("delete",u)}>Delete</button>
          </>}</div></td></tr>)}
        {!loading && !filtered.length && <tr><td colSpan={5}>No accounts match these filters.</td></tr>}
      </tbody></table></div>
      <div className="users-pagination"><button className="mini-btn" disabled={currentPage===1} onClick={() => setPage(currentPage-1)}>Previous</button><span>Page {currentPage} of {pages}</span><button className="mini-btn" disabled={currentPage===pages} onClick={() => setPage(currentPage+1)}>Next</button></div>
    </article>
    <p className="users-note">Deleting an account removes access, not booking history. Deleted accounts can be restored. Password emails require SMTP and the mail worker.</p>
    <dialog ref={dialog} className="user-dialog" aria-labelledby="user-dialog-title" onCancel={e => { if(busy) e.preventDefault(); else setSelection(null); }}>
      {selection && <form key={`${selection.action}-${user?.id || "new"}`} ref={form} onSubmit={async e => {
        e.preventDefault(); const data=Object.fromEntries(new FormData(e.currentTarget)); setBusy(true); setError("");
        try {
          const root=`/admin/users${user ? `/${user.id}` : ""}`;
          if(selection.action==="add") { const result=await request<CreatedUser>(root,{method:"POST",body:JSON.stringify({...data,role:createRole})}); setCreated(result.temporary_password ? result : null); }
          else if(selection.action==="edit") await request(root,{method:"PUT",body:JSON.stringify(data)});
          else if(selection.action==="reset") await request(root+"/reset-password",{method:"POST",body:JSON.stringify(data)});
          else if(selection.action==="delete") await request(root,{method:"DELETE",body:JSON.stringify(data)});
          else await request(root+`/${selection.action}`,{method:"PATCH",body:JSON.stringify({...data,...(selection.action==="freeze" ? {is_frozen:!user?.is_frozen} : {})})});
          setSelection(null); setStatus(selection.action==="reset" ? "Password reset email queued." : selection.action==="add" ? "Account created. Password setup email queued." : "Account updated.");
          try { await load(); onChanged(); } catch { setError("Change saved. Refresh or sign in again to reload accounts."); }
        } catch(e) { setError(e instanceof Error ? e.message : "Unable to update account"); }
        finally { const input=form.current?.elements.namedItem("current_password") as HTMLInputElement | null; if(input) input.value=""; setBusy(false); }
      }}>
        <div className="users-heading"><h2 id="user-dialog-title">{actionTitle}</h2><button type="button" className="mini-btn" disabled={busy} onClick={() => setSelection(null)} aria-label="Close user editor">Close</button></div>
        {user && <p>{user.full_name} / {labels[user.role]}</p>}
        <fieldset disabled={busy} className="form-grid">
          {editing ? <>
            {selection.action==="add" && <label>Account role<select value={createRole} onChange={e => setCreateRole(e.target.value as AdminManagedUser["role"])}>{roles.map(r => <option key={r} value={r}>{labels[r]}</option>)}</select></label>}
            <label>Full name<input name="full_name" autoFocus required maxLength={120} defaultValue={user?.full_name || ""} /></label>
            <label>Email<input name="email" type="email" required maxLength={255} defaultValue={user?.email || ""} /></label>
            <label>Phone<input name="phone" type="tel" required maxLength={30} defaultValue={user?.phone || ""} /></label>
            {createRole==="instructor" && <><label>Transmission<select name="instructor_type" defaultValue={user?.instructor_type || "both"}><option value="both">Both</option><option value="manual">Manual</option><option value="automatic">Automatic</option></select></label><label>Permit number<input name="permit_number" maxLength={120} defaultValue={user?.permit_number || ""} /></label></>}
            <p>{selection.action==="add" ? (createRole==="admin" ? "A setup email lets the administrator choose their password." : "A temporary password will be shown once after creation. It expires in 24 hours; the user must change it at sign-in.") : "Roles and usernames stay unchanged. Changing email invalidates active sessions and pending reset tokens."}</p>
          </> : <p>{selection.action==="delete" ? "Confirm deletion: this user will lose access immediately. Bookings and audit history will be kept." : selection.action==="reset" ? `Queue a single-use password reset email to ${user?.email}.` : selection.action==="restore" ? "Restore this account. If it was frozen, unfreeze it separately to enable sign-in." : "This changes sign-in access and invalidates existing sessions."}</p>}
          {needsPassword && <label>Your administrator password<input name="current_password" type="password" autoComplete="current-password" required maxLength={128} /></label>}
          {error && <p role="alert">{error}</p>}
          <button type="submit" className={selection.action==="delete" ? "btn btn-black" : "btn btn-gold"}>{busy ? "Saving..." : selection.action==="reset" ? "Send Reset Email" : selection.action==="add" ? "Create Account" : selection.action==="edit" ? "Save Changes" : actionTitle}</button>
        </fieldset>
      </form>}
    </dialog>
  </section>;
}
