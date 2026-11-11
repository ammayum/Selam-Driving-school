import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import { Seo } from "../../components/Seo";
export function AssignBookingPage() {
  const { bookingId } = useParams();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  async function confirm() {
    setBusy(true);
    try { await api.assignBookingByToken(Number(bookingId), token); setDone(true); setMessage("Booking assigned successfully."); window.history.replaceState({}, "", window.location.pathname); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Assignment failed"); }
    finally { setBusy(false); }
  }
  return <section className="section container"><Seo title="Assign Booking | Selam Driving School" description="Confirm instructor assignment." />
    <article className="card narrow"><h1>Assign Booking</h1><p>Confirm this instructor assignment for booking #{bookingId}.</p>
    {!done && <button className="btn btn-gold" disabled={busy || !token} onClick={confirm}>{busy ? "Assigning..." : "Confirm Assignment"}</button>}
    <p role="status">{message}</p><Link className="btn btn-outline" to="/portal">Open Portal</Link></article></section>;
}
