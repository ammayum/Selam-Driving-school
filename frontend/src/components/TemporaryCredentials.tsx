import { useEffect, useState } from "react";
import { CreatedUser } from "../types";

export function TemporaryCredentials({ user, onDismiss }: { user: CreatedUser; onDismiss: () => void }) {
  const [message,setMessage] = useState("");
  useEffect(() => { const timer=setTimeout(onDismiss,10*60*1000); return () => clearTimeout(timer); }, [onDismiss]);
  if(!user.temporary_password) return null;
  return <aside className="card" aria-label="Temporary login details">
    <h3>Temporary login details</h3><p>Share these securely with {user.full_name}. The password expires in 24 hours and must be changed at first sign-in. It cannot be viewed again after closing this notice.</p>
    <label>Username<input readOnly autoComplete="off" value={user.username} /></label>
    <label>Temporary password<input readOnly autoComplete="off" value={user.temporary_password} /></label>
    <div className="hero-actions"><button className="mini-btn" onClick={async () => {
      try { await navigator.clipboard.writeText(`Username: ${user.username}\nTemporary password: ${user.temporary_password}`); setMessage("Copied. Clear your clipboard after sharing securely."); }
      catch { setMessage("Copy is unavailable. Select the details manually."); }
    }}>Copy login details</button><button className="mini-btn" onClick={onDismiss}>I have saved the details</button></div><p role="status">{message}</p>
  </aside>;
}
