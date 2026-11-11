import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { request } from "../../api/client";
import { CmsPage } from "../../types";

const ContentContext = createContext<Record<string, CmsPage>>({});

export function CmsContentProvider({ children }: { children: ReactNode }) {
  const [pages, setPages] = useState<Record<string, CmsPage>>({});
  const { pathname } = useLocation();
  useEffect(() => {
    let active = true;
    request<CmsPage[]>("/cms/pages/published").then(rows => {
      if(active) setPages(Object.fromEntries(rows.map(row => [row.slug, row])));
    }).catch(() => { if(active) setPages({}); });
    return () => { active = false; };
  }, [pathname]);
  return <ContentContext.Provider value={pages}>{children}</ContentContext.Provider>;
}

export function useCmsPage(slug: string): CmsPage | null {
  return useContext(ContentContext)[slug] ?? null;
}

export function CmsText({ id, children }: { id: string; children: string }) {
  return <>{useCmsPage(id)?.title ?? children}</>;
}
