import { useEffect } from "react";
import { useLocation } from "react-router-dom";
type Props = { title: string; description: string; schema?: Record<string, unknown> };
export function Seo({ title, description }: Props) {
  const { pathname } = useLocation();
  useEffect(() => {
    const controller = new AbortController();
    document.title = title;
    function meta(selector: string, attribute: string, value: string) {
      document.querySelector(selector)?.setAttribute(attribute, value);
    }
    meta('meta[name="description"]', "content", description);
    fetch(`/api/seo?path=${encodeURIComponent(pathname)}`, { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error("Metadata unavailable"); return r.json(); })
      .then((data) => {
        document.title = data.title;
        meta('meta[name="description"]', "content", data.description);
        meta('meta[name="robots"]', "content", data.robots);
        meta('link[rel="canonical"]', "href", data.canonical);
        meta('meta[property="og:title"]', "content", data.title);
        meta('meta[property="og:description"]', "content", data.description);
        meta('meta[property="og:url"]', "content", data.canonical);
        const script = document.getElementById("ld-json");
        if (script) script.textContent = JSON.stringify(data.schema);
      }).catch(() => {});
    return () => controller.abort();
  }, [pathname, title, description]);
  return null;
}
