import { useCmsPage } from "../pages/public/useCmsPage";

export function CmsCopy({ slug, title, body = "", level = 3 }: { slug: string; title: string; body?: string; level?: 1 | 2 | 3 | 4 }) {
  const page = useCmsPage(slug);
  const Heading = `h${level}` as "h1" | "h2" | "h3" | "h4";
  return <><Heading>{page?.title ?? title}</Heading>{(page?.body ?? body) && <p style={{whiteSpace:"pre-line"}}>{page?.body ?? body}</p>}</>;
}
