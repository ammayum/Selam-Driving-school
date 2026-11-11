import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { api, request } from "../api/client";
import { CmsPage } from "../types";
import "./AdminControls.css";
import { NotificationTemplateManager } from "./NotificationTemplateManager";

const groups = ["home", "about", "lessons", "prices", "instructors", "reviews", "book", "contact", "blog", "login", "signup", "site", "custom", "notifications"];
function groupFor(slug: string) {
  if(slug.startsWith("faq_") || slug === "booking_faq") return "home";
  const prefix = slug.replace(/^copy_/, "").split("_")[0];
  return groups.includes(prefix) ? prefix : "custom";
}

export function CmsManager({ onSaved, group = "home" }: { onSaved: () => void; group?: string }) {
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [draft, setDraft] = useState<CmsPage | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const selectedPages = pages.filter(p => groupFor(p.slug) === group);
  const visiblePages = selectedPages.filter(p => `${p.slug} ${p.title}`.toLowerCase().includes(search.toLowerCase()));
  useEffect(() => { request<CmsPage[]>("/cms/pages/catalog").then(rows => { setPages(rows); setDraft(rows[0] || null); }).catch(e => setStatus(e.message)); }, []);
  useEffect(() => {
    setDraft(current => pages.find(p => p.slug === current?.slug && groupFor(p.slug) === group) || pages.find(p => groupFor(p.slug) === group) || null);
    setSearch("");
  }, [group, pages]);
  return <article className="card cms-manager"><h3>Pages &amp; Sections</h3>
    <p>Choose a website page to manage its headings, body, sections, buttons and labels. Shared header and footer copy is under Site.</p>
    <nav className="cms-directory" aria-label="Website pages">{groups.map(name => <NavLink key={name} to={`/admin/cms/${name}`}>{name === "site" ? "Header & Footer" : name.charAt(0).toUpperCase()+name.slice(1)}</NavLink>)}</nav>
    {group === "notifications" ? <NotificationTemplateManager /> : <>
    <div className="cms-tools"><Link to="/admin/packages">Manage package content</Link><Link to="/admin/instructors">Manage instructor profiles</Link></div>
    <p>Draft overrides are not public. Built-in pages/sections use their default copy until published. New custom pages are available at their slug; navigation links are not added automatically.</p>
    <label>Find content<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search titles or section names" /></label>
    <label>Select page or section<select value={draft?.slug || ""} disabled={busy} onChange={e => { setDraft(pages.find(p => p.slug === e.target.value) || null); setStatus(""); }}><option value="">Select content</option>{visiblePages.map(p => <option key={p.slug} value={p.slug}>{p.slug} - {p.id ? (p.is_published ? "Published" : "Draft") : "Default content"}</option>)}</select></label>
    <button className="mini-btn" disabled={busy} onClick={() => setDraft({id:0,slug:"",title:"",body:"",meta_title:"",meta_description:"",is_published:false} as CmsPage)}>New custom page</button>
    {draft && <form className="form-grid" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setStatus("");
      try {
        await api.upsertCmsPage(draft.slug, {...draft, meta_title:draft.meta_title || "", meta_description:draft.meta_description || ""});
        const rows = await request<CmsPage[]>("/cms/pages/catalog"); setPages(rows); setDraft(rows.find(p => p.slug===draft.slug) || null); onSaved(); setStatus("Content saved.");
      } catch(e) { setStatus(e instanceof Error ? e.message : "Save failed"); }
      finally { setBusy(false); }
    }}><fieldset className="form-grid" disabled={busy}>
      <label>Slug<input required pattern="[a-z0-9_-]+" maxLength={120} disabled={!!draft.id || pages.some(p => p.slug===draft.slug)} value={draft.slug} onChange={e => setDraft({...draft,slug:e.target.value})} /></label>
      <label>{draft.slug.startsWith("copy_") ? "Displayed text" : "Title"}<input required maxLength={200} value={draft.title} onChange={e => setDraft({...draft,title:e.target.value})} /></label>
      {!draft.slug.startsWith("copy_") && <>
        <label>Body<textarea rows={6} maxLength={20000} value={draft.body} onChange={e => setDraft({...draft,body:e.target.value})} /></label>
        <label>Meta title<input maxLength={255} value={draft.meta_title || ""} onChange={e => setDraft({...draft,meta_title:e.target.value})} /></label>
        <label>Meta description<textarea maxLength={500} value={draft.meta_description || ""} onChange={e => setDraft({...draft,meta_description:e.target.value})} /></label>
      </>}
      <label><input type="checkbox" checked={draft.is_published} onChange={e => setDraft({...draft,is_published:e.target.checked})} /> Published</label>
      <button type="submit" className="btn btn-gold">Save Content</button>
    </fieldset></form>}<p role="status">{status}</p></>}
  </article>;
}
