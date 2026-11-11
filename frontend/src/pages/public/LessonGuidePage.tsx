import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { request } from "../../api/client";
import { Seo } from "../../components/Seo";

type Guide = {
  heading: string;
  intro: string;
  service_type: string;
  booking_type: "manual" | "automatic";
  sections: { title: string; body: string }[];
  faqs: { question: string; answer: string }[];
};
type GuideResponse = {
  title: string;
  description: string;
  heading: string;
  body: string;
  guide: Guide | null;
};

/**
 * Guide content comes from PHP, which also renders it as crawlable HTML before
 * the React application starts. This keeps visible copy and JSON-LD FAQs aligned.
 */
export function LessonGuidePage({ lessonType }: { lessonType: "manual" | "automatic" }) {
  const { pathname } = useLocation();
  const [data, setData] = useState<GuideResponse | null>(null);
  const [error, setError] = useState("");
  const fallbackTitle = (lessonType === "manual" ? "Manual" : "Automatic") + " Driving Lessons in Sheffield";
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    request<GuideResponse>("/seo?path=" + encodeURIComponent(pathname), { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setData(result); })
      .catch(() => { if (!controller.signal.aborted) setError("Lesson information is temporarily unavailable."); });
    return () => controller.abort();
  }, [pathname]);

  const guide = data?.guide;
  return (
    <section className="section container lesson-guide">
      <Seo
        title={data?.title || fallbackTitle}
        description={data?.description || "Explore " + lessonType + " driving lessons in Sheffield. Compare lesson packages and send a booking enquiry to Selam Driving School."}
      />
      <nav aria-label="Breadcrumb" className="guide-breadcrumbs">
        <Link to="/">Home</Link> / <Link to="/lessons">Driving Lessons</Link>
      </nav>
      <h1>{data?.heading || fallbackTitle}</h1>
      <p className="guide-intro">{data?.body || "Learn about " + lessonType + " lessons and request a preferred booking time from Selam Driving School in Sheffield."}</p>
      <div className="hero-actions">
        <Link to={"/book?lesson_type=" + lessonType} className="btn btn-gold">Request {lessonType === "manual" ? "Manual" : "Automatic"} Lessons</Link>
        <Link to="/prices" className="btn btn-outline">View Current Prices</Link>
      </div>
      {guide ? (
        <>
          <div className="card-grid guide-cards">
            {guide.sections.map((section) => (
              <article className="card" key={section.title}>
                <h2>{section.title}</h2>
                <p>{section.body}</p>
              </article>
            ))}
          </div>
          <h2>Frequently asked questions</h2>
          <div className="guide-faqs">
            {guide.faqs.map((faq) => (
              <details key={faq.question}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </>
      ) : error ? <p role="status">{error}</p> : <p role="status">Loading lesson information…</p>}
      <p className="guide-related">
        Also explore <Link to="/lessons">all driving lessons</Link>, <Link to="/instructors">our instructors</Link> and <Link to="/contact">contact options</Link>.
      </p>
    </section>
  );
}
