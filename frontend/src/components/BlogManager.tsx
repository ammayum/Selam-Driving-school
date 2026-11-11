import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, resolveApiUrl } from "../api/client";
import { BlogPost, BlogPostPayload } from "../types";

type Draft = BlogPostPayload & { id?: number };
const empty: Draft = {
  slug: "", title: "", excerpt: "", body: "",
  cover_image_url: null, image_alt: "", is_published: false,
};

function toDraft(post: BlogPost): Draft {
  return {
    id: post.id, slug: post.slug, title: post.title,
    excerpt: post.excerpt, body: post.body,
    cover_image_url: post.cover_image_url, image_alt: post.image_alt || "",
    is_published: Boolean(post.is_published),
  };
}

export function BlogManager() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [draft, setDraft] = useState<Draft>({ ...empty });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function load(selectedId?: number) {
    const rows = await api.listBlogPosts(true);
    setPosts(rows);
    if (selectedId) {
      const chosen = rows.find((p) => p.id === selectedId);
      if (chosen) setDraft(toDraft(chosen));
    }
  }
  useEffect(() => {
    load().catch((e) => setStatus(e instanceof Error ? e.message : "Could not load articles"));
  }, []);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setStatus("Please select a JPEG, PNG or WebP image under 5 MB.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const { url } = await api.uploadPhoto(file);
      setDraft((previous) => ({ ...previous, cover_image_url: url }));
      setStatus("Photo uploaded. Save the article to attach it.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Image upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      const { id, ...payload } = draft;
      const saved = await api.saveBlogPost(payload, id);
      await load(saved.id);
      setStatus("Article saved successfully.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not save article");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="card blog-manager">
      <h3>Blog Articles &amp; Photos</h3>
      <p>Create a driving guide or news article, upload a featured photo and publish when ready.</p>
      <label>
        Choose article
        <select value={draft.id || ""} onChange={(e) => {
          const chosen = posts.find((post) => post.id === Number(e.target.value));
          setDraft(chosen ? toDraft(chosen) : { ...empty });
          setStatus("");
        }}>
          <option value="">New article</option>
          {posts.map((post) => (
            <option key={post.id} value={post.id}>
              {post.title} {post.is_published ? "(Published)" : "(Draft)"}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="mini-btn" disabled={busy} onClick={() => {
        setDraft({ ...empty });
        setStatus("");
      }}>New article</button>
      <form className="form-grid" onSubmit={save}>
        <fieldset className="form-grid" disabled={busy}>
          <label>Article title
            <input value={draft.title} required maxLength={200} onChange={(e) => {
              const title = e.target.value;
              setDraft((current) => ({
                ...current, title,
                slug: !current.id && (!current.slug || current.slug === current.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
                  ? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120)
                  : current.slug,
              }));
            }} />
          </label>
          <label>URL slug
            <input value={draft.slug} required maxLength={120} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="sheffield-driving-test-tips" onChange={(e) => update("slug", e.target.value)} />
          </label>
          <label>Summary for previews and search engines
            <textarea value={draft.excerpt} rows={3} required maxLength={500} onChange={(e) => update("excerpt", e.target.value)} />
          </label>
          <label>Article content (plain text)
            <textarea value={draft.body} rows={9} required maxLength={20000} onChange={(e) => update("body", e.target.value)} />
          </label>
          <label>Featured photo (optional — JPEG, PNG or WebP, maximum 5 MB)
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {draft.cover_image_url ? (
            <div className="media-preview">
              <img src={resolveApiUrl(draft.cover_image_url)} alt={draft.image_alt || "Blog article preview"} />
              <button type="button" className="mini-btn danger" onClick={() => {
                update("cover_image_url", null);
                update("image_alt", "");
              }}>Remove featured photo</button>
            </div>
          ) : null}
          {draft.cover_image_url ? (
            <label>Photo description (for accessibility and image search)
              <input required maxLength={200} value={draft.image_alt || ""} onChange={(e) => update("image_alt", e.target.value)} placeholder="A learner driver practising in Sheffield" />
            </label>
          ) : null}
          <label><input type="checkbox" checked={draft.is_published} onChange={(e) => update("is_published", e.target.checked)} /> Publish article publicly</label>
          <button className="btn btn-gold" type="submit">{draft.id ? "Update Article" : "Create Article"}</button>
        </fieldset>
      </form>
      {draft.id && draft.is_published ? <p><Link to={"/blog/" + draft.slug}>View published article</Link></p> : null}
      <p role="status">{status}</p>
    </article>
  );
}
