import { useLocation } from "react-router-dom";
import { Seo } from "../../components/Seo";
import { useCmsPage } from "./useCmsPage";
export function DynamicPage() {
  const { pathname } = useLocation();
  const page = useCmsPage(pathname.slice(1));
  return <section className="section container"><Seo title={page?.meta_title || page?.title || "Page not found"} description={page?.meta_description || page?.body || "Return to the home page."}/><h1>{page?.title || "Page not found"}</h1><p>{page?.body ?? "This page is unavailable."}</p><a href="/">Return home</a></section>;
}
