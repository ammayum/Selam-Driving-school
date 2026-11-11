import { CmsText } from "../pages/public/useCmsPage";
import { CmsCopy } from "./CmsCopy";
import { usePublicContactSettings } from "../pages/public/usePublicContactSettings";
import { usePublicAboutMediaSettings } from "../pages/public/usePublicAboutMediaSettings";

export function SocialIcon({ kind }: { kind: "facebook" | "instagram" | "tiktok" | "youtube" }) {
  if (kind === "facebook") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.6 1.7-1.6H16.7V4.8c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4V11H8v3h2.5v8h3z" />
      </svg>
    );
  }
  if (kind === "instagram") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2.2A2.8 2.8 0 0 0 4.2 7v10A2.8 2.8 0 0 0 7 19.8h10a2.8 2.8 0 0 0 2.8-2.8V7A2.8 2.8 0 0 0 17 4.2H7zm10.3 1.6a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2.2A2.8 2.8 0 1 0 12 14.8 2.8 2.8 0 0 0 12 9.2z" />
      </svg>
    );
  }
  if (kind === "tiktok") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M14.6 3c.3 2 1.4 3.5 3.4 4.2v2.7a6.5 6.5 0 0 1-3.3-1V15a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v2.8a2.8 2.8 0 1 0 1.9 2.7V3h2.7z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M23 7.5a3 3 0 0 0-2.1-2.1C19 5 12 5 12 5s-7 0-8.9.4A3 3 0 0 0 1 7.5 31 31 0 0 0 .5 12c0 1.5.1 3 .5 4.5a3 3 0 0 0 2.1 2.1C5 19 12 19 12 19s7 0 8.9-.4a3 3 0 0 0 2.1-2.1c.4-1.5.5-3 .5-4.5s-.1-3-.5-4.5zM9.7 15.3V8.7l5.8 3.3-5.8 3.3z" />
    </svg>
  );
}

export function SiteFooter() {
  const contact = usePublicContactSettings();
  const media = usePublicAboutMediaSettings();
  const socialLinks = [
    { kind: "facebook" as const, label: "Facebook", url: media.facebook_url },
    { kind: "instagram" as const, label: "Instagram", url: media.instagram_url },
    { kind: "tiktok" as const, label: "TikTok", url: media.tiktok_url },
    { kind: "youtube" as const, label: "YouTube", url: media.youtube_url },
  ].filter((item) => item.url);

  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <CmsCopy slug="site_footer" title="Selam Driving School" body="Manual and automatic driving lessons" level={4} />
          {socialLinks.length ? (
            <div className="footer-socials">
              {socialLinks.map((item) => (
                <a key={item.kind} href={item.url} target="_blank" rel="noreferrer" aria-label={item.label} title={item.label}>
                  <SocialIcon kind={item.kind} />
                </a>
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <h4><CmsText id="copy_site_contact">Contact</CmsText></h4>
          <p>{contact.phone}</p>
          {contact.email ? <p>{contact.email}</p> : null}
          <p>{contact.address}</p>
        </div>
      </div>
    </footer>
  );
}
