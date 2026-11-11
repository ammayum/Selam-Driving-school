import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, request } from "../api/client";
import { Seo } from "../components/Seo";
import { CardDetails, CardSide, cardSvg, downloadCard } from "../lib/businessCard";
import { User } from "../types";
import "./BusinessCardPage.css";

export function BusinessCardPage() {
  const [role, setRole] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [id, setId] = useState(0);
  const [details, setDetails] = useState<CardDetails | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; api.checkSession().then(async session => {
    if (session.role !== "instructor" && session.role !== "admin") throw new Error("An instructor or administrator account is required.");
    if (!active) return; setRole(session.role);
    if (session.role === "admin") { const list = await api.listInstructors(); if (active) { setUsers(list); setId(list[0]?.id || 0); } } else setId(session.user_id);
  }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, []);
  useEffect(() => { if (!id) return; let active = true; setDetails(null); setMessage(""); setError(""); request<{details: CardDetails}>(`/instructor/business-card?instructor_id=${id}`).then(data => { if (active) setDetails(data.details); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [id]);
  let previews: Record<CardSide, string> = { front: "", back: "" }, previewError = "";
  if (details) { try { previews = { front: cardSvg(details, "front"), back: cardSvg(details, "back") }; } catch (e) { previewError = (e as Error).message; } }
  async function perform(action: () => Promise<unknown>, success: string) { setBusy(true); setError(""); setMessage(""); try { await action(); setMessage(success); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  const fields: [keyof CardDetails, string, number][] = [["name", "Instructor name", 120], ["qualification", "Qualification / title", 65], ["phone", "Phone number", 35], ["instagram", "Instagram handle", 65], ["facebook", "Facebook name", 65], ["location", "Location", 90], ["booking_url", "QR booking link", 300]];
  return <section className="business-cards container"><Seo title="Instructor Business Cards | Selam Driving School" description="Private instructor business card studio." />
    <header><div><p className="card-eyebrow">SELAM / INSTRUCTOR STUDIO</p><h1>Your next introduction.</h1><p>Personalised business cards, in the school's red and gold.</p></div><Link to="/portal">Back to portal</Link></header>
    {error && <p role="alert" className="card-error">{error}</p>}{message && <p role="status">{message}</p>}
    {!role && <Link to="/login">Sign in to continue</Link>}
    {role === "admin" && <label className="card-owner">Select instructor<select aria-label="Select instructor" value={id} disabled={busy} onChange={e => setId(Number(e.target.value))}>{users.map(user => <option key={user.id} value={user.id}>{user.full_name}</option>)}</select>{!users.length && <span>No active instructors yet.</span>}</label>}
    {details && <div className="card-studio"><form onSubmit={e => { e.preventDefault(); void perform(() => request(`/instructor/business-card?instructor_id=${id}`, { method: "PUT", body: JSON.stringify(details) }), "Card details saved."); }}><h2>Make it yours</h2><p>These details only change the card, not the instructor's account.</p><fieldset disabled={busy}>{fields.map(([key, label, max]) => <label key={key}>{label}<input type={key === "booking_url" ? "url" : "text"} required={["name", "phone", "booking_url"].includes(key)} maxLength={max} value={details[key]} onChange={e => { setDetails({ ...details, [key]: e.target.value }); setMessage(""); }} /></label>)}<small>Only enter qualifications you hold. Confirm the phone number, social accounts and public booking link before printing.</small><button type="submit" disabled={!!previewError}>Save card details</button></fieldset></form>
      <div className="card-previews">{previewError && <p role="alert" className="card-error">{previewError}</p>}{(["front", "back"] as CardSide[]).map(side => <article key={side}><div className="card-side-heading"><h2>{side === "front" ? "01 / Front" : "02 / Back"}</h2><span>85 x 55 mm</span></div><div className="card-art" aria-label={`${side} card preview`} dangerouslySetInnerHTML={{ __html: previews[side] }} /><div className="card-downloads">{(["png", "svg"] as const).map(format => <button key={format} disabled={busy || !!previewError || !details.name.trim() || !details.phone.trim()} onClick={() => perform(() => downloadCard(details, side, format), `${side === "front" ? "Front" : "Back"} ${format.toUpperCase()} download prepared.`)}>Download {side} {format === "png" ? "HD PNG" : "vector SVG"}</button>)}</div></article>)}
        <aside><strong>Ready for a sharp first impression.</strong><p>HD PNG: 2550 x 1650 pixels. SVG: scalable vector artwork at 85 x 55 mm. Both downloads use the details currently shown, even before saving.</p><p>Artwork is trim-size RGB without bleed. Ask your printer for bleed and colour requirements, and scan the QR code before ordering. The dove mark is a clean vector recreation of your reference, not the original logo file.</p></aside>
      </div></div>}
  </section>;
}
