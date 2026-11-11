import { CmsText } from "./useCmsPage";
import { CmsCopy } from "../../components/CmsCopy";
import { BookingFaq } from "../../components/BookingFaq";
import { HomePackageShowcase } from "../../components/HomePackageShowcase";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api, resolveApiUrl } from "../../api/client";
import { Seo } from "../../components/Seo";
import { CmsPage, HomeRepeatables, User } from "../../types";
import { usePublicContactSettings } from "./usePublicContactSettings";
import { useCmsPage } from "./useCmsPage";

export function HomePage() {
  const [instructors, setInstructors] = useState<User[]>([]);
  const [repeatables, setRepeatables] = useState<HomeRepeatables | null>(null);
  const hero = useCmsPage("home");
  const about = useCmsPage("home_about");
  const servicesPage = useCmsPage("home_services");
  const processPage = useCmsPage("home_process");
  const ctaPage = useCmsPage("home_cta");
  const contact = usePublicContactSettings();

  useEffect(() => {
    api.listInstructors().then(setInstructors).catch(() => setInstructors([]));
    api.getHomeRepeatables().then(setRepeatables).catch(() => setRepeatables(null));
  }, []);

  const fallbackHighlights = useMemo(
    () => [
      { title: "Manual & Automatic", text: "Choose lesson type based on your confidence level." },
      { title: "Flexible Times", text: "Weekday and weekend slots across Sheffield." },
      { title: "Progress Tracking", text: "Student progress and reminders through the portal." },
    ],
    []
  );
  const fallbackServiceBlocks = useMemo(
    () => [
      {
        title: "Automatic Lessons",
        text: "Build confidence faster with focused road awareness training.",
        badge: "Automatic",
        cta_label: "Book Package",
        cta_url: "/book",
      },
      {
        title: "Manual Lessons",
        text: "Master clutch control, hill starts, and real Sheffield routes.",
        badge: "Manual",
        cta_label: "Book Package",
        cta_url: "/book",
      },
      {
        title: "Intensive Courses",
        text: "Condensed plans for learners targeting near-term test dates.",
        badge: "Intensive",
        cta_label: "Book Package",
        cta_url: "/book",
      },
    ],
    []
  );
  const steps = useMemo(
    () => [
      { number: "01", title: "Choose Package", text: "Pick the lesson package that fits your plan." },
      { number: "02", title: "Share Your Start Date", text: "Tell us when you want to begin lessons." },
      { number: "03", title: "We Contact You", text: "We confirm the instructor and lesson details directly." },
      { number: "04", title: "Track Progress", text: "Manage lessons and reminders in portal." },
    ],
    []
  );

  const trustBadges = repeatables
    ? repeatables.trust_badges
    : [
        { title: "DVSA-style coaching", text: "" },
        { title: "Flexible schedules", text: "" },
        { title: "Guest booking available", text: "" },
      ];
  const highlights = repeatables ? repeatables.highlights : fallbackHighlights;
  const serviceBlocks = repeatables ? repeatables.services : fallbackServiceBlocks;
  const stepBlocks = repeatables ? repeatables.steps : steps.map((x) => ({ title: x.title, text: x.text, badge: x.number }));

  return (
    <>
      <Seo
        title={hero?.meta_title || "Selam Driving School Sheffield | Manual & Automatic Lessons"}
        description={hero?.meta_description || "Driving lessons in Sheffield with manual and automatic options, online booking, and instructor availability."}
        schema={{
          "@context": "https://schema.org",
          "@type": "DrivingSchool",
          name: "Selam Driving School",
          areaServed: "Sheffield",
          telephone: contact.phone || undefined,
        }}
      />
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <p className="eyebrow"><CmsText id="copy_home_trusted_in_sheffield">Trusted in Sheffield</CmsText></p>
            <h1>{hero?.title || "Learn Manual and Automatic Driving with Confidence"}</h1>
            <p>{hero?.body ?? "Professional instructors, fast booking, and a modern student portal to keep every lesson on track."}</p>
            <div className="hero-actions">
              <Link to="/book" className="btn btn-gold"><CmsText id="copy_home_book_lesson">Book Lesson</CmsText></Link>
              {contact.phone_link && contact.phone ? <a className="btn btn-outline" href={contact.phone_link}><CmsText id="copy_home_call_now">Call Now</CmsText></a> : null}
            </div>
            <div className="home-trust-strip">
              {trustBadges.map((item, idx) => (
                <span key={`${item.title}-${idx}`}>{item.title}</span>
              ))}
            </div>
          </div>
          <div className="hero-card hero-card-strong">
            <CmsCopy slug="home_quick_book" title="Book in 60 seconds" body="Choose a package and preferred start date, then we confirm the details with you." />
            <Link to="/book" className="btn btn-black"><CmsText id="copy_home_send_booking_request">Send Booking Request</CmsText></Link>
            <div className="hero-mini-stats">
              <article><strong>{instructors.length || 0}+</strong><span><CmsText id="copy_home_instructors">Instructors</CmsText></span></article>
              <article><strong>7 Days</strong><span><CmsText id="copy_home_weekly_support">Weekly Support</CmsText></span></article>
            </div>
          </div>
        </div>
      </section>

      <section className="section container">
        <h2>{about?.title || "Why Choose Selam Driving School"}</h2>
        <p>{about?.body ?? "Structured teaching, supportive feedback, and reliable scheduling for learners across Sheffield."}</p>
        <div className="card-grid">
          {highlights.map((item) => (
            <article key={item.title} className="card">
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section section-muted">
        <div className="container">
          <h2>{servicesPage?.title || "Training Services"}</h2>
          <p>{servicesPage?.body ?? "Choose the package that matches your confidence level and test timeline."}</p>
          <div className="card-grid">
            {serviceBlocks.map((item) => (
              <article key={item.title} className="card service-card">
                <p className="eyebrow">{item.badge || "Service"}</p>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <Link to={item.cta_url || "/book"} className="btn btn-black">{item.cta_label || "Book Now"}</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section container">
        <h2>{processPage?.title || "How Booking Works"}</h2>
        <p>{processPage?.body ?? "Simple flow designed for mobile-first learners."}</p>
        <div className="step-grid">
          {stepBlocks.map((step, index) => (
            <article key={`${step.title}-${index}`} className="step-card">
              <span className="step-no">{step.badge || String(index + 1).padStart(2, "0")}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <HomePackageShowcase />

      <section className="section section-muted">
        <div className="container">
          <CmsCopy slug="home_instructors" title="Meet Our Instructors" level={2} />
          <div className="card-grid">
            {instructors.length === 0 ? (
              <article className="card"><p><CmsText id="copy_home_add_instructors_from_admin_to_display_profiles_here">Add instructors from admin to display profiles here.</CmsText></p></article>
            ) : (
              instructors.slice(0, 6).map((instructor) => (
                <article key={instructor.id} className="card">
                  {instructor.profile_photo_url ? <img src={resolveApiUrl(instructor.profile_photo_url)} alt={instructor.full_name} className="profile-thumb" /> : null}
                  <h3>{instructor.full_name}</h3>
                  <p>Type: {instructor.instructor_type || "N/A"}</p>
                  <p>Permit: {instructor.permit_number || "N/A"}</p>
                  <p>{instructor.email}</p>
                  <p>{instructor.phone}</p>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="section container">
        <article className="cta-banner">
          <div>
            <p className="eyebrow"><CmsText id="copy_home_ready_to_start">Ready to start</CmsText></p>
            <h2>{ctaPage?.title || "Start Your Driving Journey in Sheffield"}</h2>
            <p>{ctaPage?.body ?? "Book your first lesson now or call us for quick guidance on the right course."}</p>
          </div>
          <div className="hero-actions">
            <Link to="/book" className="btn btn-gold"><CmsText id="copy_home_book_lesson">Book Lesson</CmsText></Link>
            {contact.phone_link && contact.phone ? <a className="btn btn-black" href={contact.phone_link}>Call {contact.phone}</a> : null}
          </div>
        </article>
      </section>
      <BookingFaq />
    </>
  );
}

export function BasicCmsPage({ slug, fallbackTitle, fallbackBody }: { slug: string; fallbackTitle: string; fallbackBody: string }) {
  const page = useCmsPage(slug);

  return (
    <section className="section container">
      <Seo title={page?.meta_title || fallbackTitle} description={page?.meta_description || fallbackBody} />
      <h1>{page?.title || fallbackTitle}</h1>
      <p>{page?.body ?? fallbackBody}</p>
    </section>
  );
}

export type PublicPageCms = CmsPage | null;
