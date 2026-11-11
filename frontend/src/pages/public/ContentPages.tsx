import { CmsText } from "./useCmsPage";
import { CmsCopy } from "../../components/CmsCopy";
import { FormEvent, useEffect, useState } from "react";

import { api, resolveApiUrl } from "../../api/client";
import { Seo } from "../../components/Seo";
import { BlogPost, ReviewTestimonial, User } from "../../types";
import { Link, useParams } from "react-router-dom";
import { BasicCmsPage } from "./HomePage";
import { usePublicAboutMediaSettings } from "./usePublicAboutMediaSettings";
import { usePublicContactSettings } from "./usePublicContactSettings";
import { useCmsPage } from "./useCmsPage";
import { SocialIcon } from "../../components/SiteFooter";
export function AboutPage() {
  const page = useCmsPage("about");
  const aboutMedia = usePublicAboutMediaSettings();
  const socialLinks = [
  { kind: "facebook" as const, label: "Facebook", url: aboutMedia.facebook_url },
  { kind: "instagram" as const, label: "Instagram", url: aboutMedia.instagram_url },
  { kind: "tiktok" as const, label: "TikTok", url: aboutMedia.tiktok_url },
  { kind: "youtube" as const, label: "YouTube", url: aboutMedia.youtube_url },
].filter((item) => item.url);

  function toEmbedUrl(url: string): string {
    if (!url) return "";
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes("youtu.be")) {
        const id = parsed.pathname.replace("/", "");
        return id ? `https://www.youtube.com/embed/${id}` : "";
      }
      if (parsed.hostname.includes("youtube.com")) {
        const id = parsed.searchParams.get("v");
        if (id) return `https://www.youtube.com/embed/${id}`;
        const parts = parsed.pathname.split("/").filter(Boolean);
        const maybeId = parts[parts.length - 1];
        return maybeId ? `https://www.youtube.com/embed/${maybeId}` : "";
      }
      if (parsed.hostname.includes("instagram.com")) {
        const parts = parsed.pathname.split("/").filter(Boolean);
        const mediaType = parts[0];
        const mediaId = parts[1];
        if ((mediaType === "reel" || mediaType === "p") && mediaId) {
          return `https://www.instagram.com/${mediaType}/${mediaId}/embed`;
        }
      }
      if (parsed.hostname.includes("tiktok.com")) {
        const parts = parsed.pathname.split("/").filter(Boolean);
        const videoIndex = parts.findIndex((part) => part === "video");
        const mediaId = videoIndex >= 0 ? parts[videoIndex + 1] : "";
        if (mediaId) {
          return `https://www.tiktok.com/embed/v2/${mediaId}`;
        }
      }
      return "";
    } catch {
      return "";
    }
  }

  return (
    <section className="section container">
      <Seo
        title={page?.meta_title || "About Selam Driving School"}
        description={page?.meta_description || "We help learners in Sheffield pass confidently using structured lessons and supportive coaching."}
      />
      <h1>{page?.title || "About Selam Driving School"}</h1>
      <p>{page?.body ?? "We help learners in Sheffield pass confidently using structured lessons and supportive coaching."}</p>
      <div className="card-grid">
        {socialLinks.length === 0 ? (
          <article className="card"><p><CmsText id="copy_about_content_coming_soon">Content coming soon.</CmsText></p></article>
        ) : (
         socialLinks.map((item) => (
  <article className="card" key={item.kind}>
    <h3 className="social-title">
      <SocialIcon kind={item.kind} />
      {item.label}
    </h3>

    <a className="btn btn-black" href={item.url} target="_blank" rel="noreferrer">
      <SocialIcon kind={item.kind} />
      Visit {item.label}
    </a>
  </article>
))
        )}
      </div>
      <div className="card-grid review-grid">
        {aboutMedia.videos.length === 0 ? (
          <article className="card"><p><CmsText id="copy_about_videos_coming_soon">Videos coming soon.</CmsText></p></article>
        ) : (
          aboutMedia.videos.map((item, index) => {
            const embedUrl = toEmbedUrl(item.youtube_url);
            if (!embedUrl) {
              return (
              <article className="card" key={`video-${index}`}>
                <h3>{item.title || `Video ${index + 1}`}</h3>
                <p><CmsText id="copy_about_invalid_or_missing_youtube_instagram_or_tiktok_video_url">Invalid or missing YouTube, Instagram, or TikTok video URL.</CmsText></p>
              </article>
            );
          }
            return (
              <article className="card review-card" key={`video-${index}`}>
                <h3>{item.title || `Video ${index + 1}`}</h3>
                <div className="video-card-frame">
                  <iframe
                    src={embedUrl}
                    title={item.title || `About video ${index + 1}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

export function LessonsPage() {
  return (
    <section className="section container">
      <BasicCmsPage slug="lessons" fallbackTitle="Driving Lessons" fallbackBody="Manual, automatic and intensive driving courses in Sheffield." />
      <div className="card-grid">
        <article className="card"><CmsCopy slug="lessons_manual" title="Manual" body="Clutch control, hill starts, junctions, and exam route confidence." /></article>
        <article className="card"><CmsCopy slug="lessons_automatic" title="Automatic" body="Focus faster on road awareness and decision making." /></article>
        <article className="card"><CmsCopy slug="lessons_intensive" title="Intensive" body="Compact schedules for learners targeting a quick test date." /></article>
      </div>
      <nav aria-label="Explore lesson types" className="guide-related-links">
        <Link to="/manual-driving-lessons-sheffield" className="btn btn-black">Explore Manual Driving Lessons</Link>
        <Link to="/automatic-driving-lessons-sheffield" className="btn btn-black">Explore Automatic Driving Lessons</Link>
        <Link to="/prices" className="btn btn-outline">Compare Lesson Prices</Link>
      </nav>
    </section>
  );
}

export function PricesPage() {
  const [packs, setPacks] = useState<{ id: number; title: string; hours: number; package_type: "manual" | "automatic"; price: number; is_active: boolean }[]>([]);
  const page = useCmsPage("prices");

  useEffect(() => {
    api.listPackages().then(setPacks).catch(() => setPacks([]));
  }, []);

  return (
    <section className="section container">
      <Seo title={page?.meta_title || "Lesson Prices | Selam Driving School"} description={page?.meta_description || "See lesson package pricing for manual and automatic driving in Sheffield."} />
      <h1>{page?.title || "Prices"}</h1>
      <p>{page?.body ?? "Transparent package pricing for Sheffield learners."}</p>
      <div className="card-grid">
        {packs.length === 0 ? <article className="card"><p><CmsText id="copy_prices_no_packages_yet_add_from_admin_dashboard">No packages yet. Add from admin dashboard.</CmsText></p></article> : null}
        {packs.filter((x) => x.is_active).map((pack) => (
          <article className="card" key={pack.id}>
            <h3>{pack.title}</h3>
            <p>{pack.package_type === "manual" ? "Manual" : "Automatic"} - {pack.hours} hours</p>
            <strong>GBP {pack.price}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

export function InstructorsPage() {
  const [instructors, setInstructors] = useState<User[]>([]);
  const page = useCmsPage("instructors");

  useEffect(() => {
    api.listInstructors().then(setInstructors).catch(() => setInstructors([]));
  }, []);

  return (
    <section className="section container">
      <Seo title={page?.meta_title || "Instructors | Selam Driving School"} description={page?.meta_description || "Meet Selam Driving School instructors in Sheffield."} />
      <h1>{page?.title || "Our Instructors"}</h1>
      <p>{page?.body ?? "Experienced and friendly instructors ready to support your journey."}</p>
      <div className="card-grid">
        {instructors.map((instructor) => (
          <article className="card" key={instructor.id}>
            {instructor.profile_photo_url ? <img src={resolveApiUrl(instructor.profile_photo_url)} alt={instructor.full_name} className="profile-thumb" /> : null}
            <h3>{instructor.full_name}</h3>
            <p>Type: {instructor.instructor_type || "N/A"}</p>
            <p>Permit: {instructor.permit_number || "N/A"}</p>
            <p>{instructor.email}</p>
            <p>{instructor.phone}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ReviewsPage() {
  const page = useCmsPage("reviews");
  const [testimonials, setTestimonials] = useState<ReviewTestimonial[]>([]);
  const [minRating, setMinRating] = useState<"all" | number>("all");
  const [submitStatus, setSubmitStatus] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);

  useEffect(() => {
    const filter = minRating === "all" ? undefined : minRating;
    api.getReviewTestimonials(filter).then((res) => setTestimonials(res.items)).catch(() => setTestimonials([]));
  }, [minRating]);

  async function onSubmitTestimonial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const candidate = form.get("photo");
    const file = candidate instanceof File && candidate.size > 0 ? candidate : undefined;
    if (file && (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setSubmitStatus("Photo must be a JPEG, PNG or WebP image under 5 MB.");
      return;
    }
    try {
      const res = await api.submitReviewTestimonial({
        author: String(form.get("author") || "").trim(),
        email: String(form.get("email") || "").trim() || undefined,
        testimonial: String(form.get("testimonial") || "").trim(),
        rating: Number(form.get("rating") || 5),
        photo: file,
        photo_consent: form.get("photo_consent") === "on",
      });
      setSubmitStatus(res.message);
      formEl.reset();
      setSelectedPhoto(null);
    } catch (error) {
      setSubmitStatus(error instanceof Error ? error.message : "Unable to submit testimonial");
    }
  }

  return (
    <section className="section container">
      <Seo title={page?.meta_title || "Student Reviews | Selam Driving School"} description={page?.meta_description || "What learners say about Selam Driving School."} />
      <h1>{page?.title || "Student Reviews"}</h1>
      <p>{page?.body ?? "Feedback from learners."}</p>
      <div className="card review-filter-card">
        <label><CmsText id="copy_reviews_filter_by_rating">Filter by Rating</CmsText></label>
        <select value={String(minRating)} onChange={(e) => setMinRating(e.target.value === "all" ? "all" : Number(e.target.value))}>
          <option value="all"><CmsText id="copy_reviews_all_ratings">All ratings</CmsText></option>
          <option value={5}>★★★★★ only</option>
          <option value={4}>★★★★☆ and above</option>
          <option value={3}>★★★☆☆ and above</option>
          <option value={2}>★★☆☆☆ and above</option>
          <option value={1}>★☆☆☆☆ and above</option>
        </select>
      </div>
      <div className="card-grid review-grid">
        {testimonials.length === 0 ? (
          <article className="card review-card"><p><CmsText id="copy_reviews_no_testimonials_available_for_this_rating_filter_yet">No testimonials available for this rating filter yet.</CmsText></p></article>
        ) : null}
        {testimonials.map((item, idx) => (
          <article className="card review-card" key={`${item.author}-${idx}`}>
            {item.photo_url ? <img className="review-photo" src={resolveApiUrl(item.photo_url)} alt={`Photo accompanying a review by ${item.author}`} loading="lazy" /> : null}
            <p className="review-stars">{"★".repeat(Math.max(1, Math.min(5, item.rating)))}</p>
            <p className="review-quote">"{item.testimonial}"</p>
            <strong className="review-author">- {item.author}</strong>
          </article>
        ))}
      </div>
      <article className="card review-submit-card">
        <CmsCopy slug="reviews_submit" title="Share Your Testimonial" />
        <form onSubmit={onSubmitTestimonial} className="form-grid">
          <label><CmsText id="copy_reviews_your_name">Your Name</CmsText></label>
          <input name="author" required />
          <label><CmsText id="copy_reviews_email_optional">Email (optional)</CmsText></label>
          <input name="email" type="email" />
          <label><CmsText id="copy_reviews_rating">Rating</CmsText></label>
          <select name="rating" defaultValue={5}>
            <option value={5}>★★★★★</option>
            <option value={4}>★★★★☆</option>
            <option value={3}>★★★☆☆</option>
            <option value={2}>★★☆☆☆</option>
            <option value={1}>★☆☆☆☆</option>
          </select>
          <label><CmsText id="copy_reviews_your_testimonial">Your Testimonial</CmsText></label>
          <textarea name="testimonial" rows={4} required minLength={10} />
          <label>Optional review photo (JPEG, PNG or WebP, maximum 5 MB)</label>
          <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" onChange={(e) => setSelectedPhoto(e.target.files?.[0] || null)} />
          {selectedPhoto ? <label className="media-consent"><input type="checkbox" name="photo_consent" required /> I own or have permission to share this photo and agree it may be shown publicly with my name and review after approval.</label> : null}
          <button className="btn btn-gold" type="submit"><CmsText id="copy_reviews_submit_testimonial">Submit Testimonial</CmsText></button>
        </form>
        <p>{submitStatus}</p>
      </article>
    </section>
  );
}

export function ContactPage() {
  const page = useCmsPage("contact");
  const contact = usePublicContactSettings();

  return (
    <section className="section container">
      <Seo title={page?.meta_title || "Contact Selam Driving School"} description={page?.meta_description || "Call or message Selam Driving School in Sheffield."} />
      <h1>{page?.title || "Contact"}</h1>
      <p>{page?.body ?? (contact.contact_note || "Contact details coming soon.")}</p>
      <div className="card-grid">
        <article className="card"><h3><CmsText id="copy_contact_phone">Phone</CmsText></h3><p>{contact.phone || "-"}</p></article>
        <article className="card"><h3><CmsText id="copy_contact_email">Email</CmsText></h3><p>{contact.email || "-"}</p></article>
        <article className="card"><h3><CmsText id="copy_contact_location">Location</CmsText></h3><p>{contact.address || "-"}</p></article>
        <article className="card"><h3><CmsText id="copy_contact_whatsapp">WhatsApp</CmsText></h3><p>{contact.whatsapp || "-"}</p></article>
      </div>
    </section>
  );
}

export function BlogPage() {
  const page = useCmsPage("blog");
  const [posts, setPosts] = useState<BlogPost[]>([]);
  useEffect(() => {
    api.listBlogPosts().then(setPosts).catch(() => setPosts([]));
  }, []);
  return (
    <section className="section container">
      <Seo title={page?.meta_title || "Sheffield Driving Blog | Selam Driving School"} description={page?.meta_description || "Sheffield driving lesson guides, learner advice and local driving school updates."} />
      <h1>{page?.title || "Driving Tips & Learning Hub"}</h1>
      <p>{page?.body ?? "Explore Sheffield driving tips, learner advice and guides from Selam Driving School."}</p>
      <div className="card-grid blog-grid">
        {posts.length === 0 ? <p>No published articles yet. Visit again for new driving tips.</p> : null}
        {posts.map((post) => (
          <article className="card blog-card" key={post.id}>
            {post.cover_image_url ? <img src={resolveApiUrl(post.cover_image_url)} alt={post.image_alt || post.title} loading="lazy" /> : null}
            <h2><Link to={ "/blog/" + post.slug }>{post.title}</Link></h2>
            <p>{post.excerpt}</p>
            <Link to={ "/blog/" + post.slug } className="btn btn-black">Read Article</Link>
          </article>
        ))}
      </div>
    </section>
  );
}

export function BlogArticlePage() {
  const { slug = "" } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setPost(null);
    setError("");
    api.getBlogPost(slug).then(setPost).catch(() => setError("This article is not available."));
  }, [slug]);
  if (error) return <section className="section container"><h1>Article unavailable</h1><p>{error}</p><Link to="/blog">Return to learning hub</Link></section>;
  if (!post) return <section className="section container"><p>Loading article...</p></section>;
  return (
    <article className="section container blog-article">
      <Seo title={post.title + " | Selam Driving School"} description={post.excerpt} />
      <Link to="/blog">All driving guides</Link>
      <h1>{post.title}</h1>
      {post.published_at ? <p><time dateTime={post.published_at}>{post.published_at.slice(0, 10)}</time></p> : null}
      <p>{post.excerpt}</p>
      {post.cover_image_url ? <img src={resolveApiUrl(post.cover_image_url)} alt={post.image_alt || post.title} /> : null}
      <div className="blog-article-body">{post.body}</div>
    </article>
  );
}
