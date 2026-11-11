import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { request } from "../api/client";
import { Seo } from "../components/Seo";
import { clearSession } from "../lib/session";

export function ChangePasswordPage() {
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const navigate=useNavigate();
  return <section className="section container"><Seo title="Change Password" description="Secure your account with your own password." />
    <article className="card narrow"><h1>Choose your own password</h1><p>Replace your temporary password before using your account.</p>
      <form className="form-grid" onSubmit={async e => {
        e.preventDefault(); const form=e.currentTarget; const data=new FormData(form); setError("");
        if(data.get("new_password")!==data.get("confirm_password")) { setError("Passwords do not match."); return; }
        setBusy(true);
        try { await request("/auth/change-password",{method:"POST",body:JSON.stringify({current_password:data.get("current_password"),new_password:data.get("new_password")})}); form.reset(); navigate("/portal",{replace:true}); }
        catch(e) { setError(e instanceof Error ? e.message : "Password change failed"); }
        finally { setBusy(false); }
      }}><label>Current or temporary password<input name="current_password" type="password" autoComplete="current-password" required maxLength={128} /></label>
        <label>New password<input name="new_password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
        <label>Confirm new password<input name="confirm_password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
        <button className="btn btn-gold" disabled={busy}>{busy ? "Saving..." : "Save New Password"}</button>
      </form><p role="alert">{error}</p><button className="mini-btn" disabled={busy} onClick={async () => {
        try { await request("/auth/logout",{method:"POST"}); clearSession(); navigate("/login",{replace:true}); }
        catch { setError("Unable to sign out. Please try again."); }
      }}>Sign out or request a reset</button>
    </article></section>;
}
