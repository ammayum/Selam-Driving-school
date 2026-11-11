import { useEffect, useMemo, useState } from "react";

import { api } from "../api/client";

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
    return "";
  } catch {
    return "";
  }
}

export function SideVideoPlayer() {
  const [title, setTitle] = useState("How Lessons Work");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    api
      .getPublicVideoSettings()
      .then((data) => {
        setTitle(data.title || "How Lessons Work");
        setYoutubeUrl(data.youtube_url || "");
      })
      .catch(() => {
        setYoutubeUrl("");
      });
  }, []);

  const embedUrl = useMemo(() => toEmbedUrl(youtubeUrl), [youtubeUrl]);
  if (!embedUrl) return null;

  return (
    <aside className={`side-video ${collapsed ? "collapsed" : ""}`}>
      <div className="side-video-head">
        <strong>{title}</strong>
        <button className="mini-btn" onClick={() => setCollapsed((prev) => !prev)}>{collapsed ? "Open" : "Hide"}</button>
      </div>
      {!collapsed ? (
        <div className="side-video-body">
          <iframe
            src={embedUrl}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      ) : null}
    </aside>
  );
}
