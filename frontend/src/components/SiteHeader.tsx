import { CmsText } from "../pages/public/useCmsPage";
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className="site-header">
      <div className="container nav-wrap">
        <Link to="/" className="brand">
          <span className="brand-badge">S</span>
          <span><CmsText id="copy_site_selam_driving_school">Selam Driving School</CmsText></span>
        </Link>
        <button
          className={`hamburger-btn ${menuOpen ? "open" : ""}`}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((prev) => !prev)}
          type="button"
        >
          <span />
          <span />
          <span />
        </button>
        <nav className={`menu ${menuOpen ? "open" : ""}`}>
          <NavLink to="/"><CmsText id="copy_site_home">Home</CmsText></NavLink>
          <NavLink to="/about"><CmsText id="copy_site_about">About</CmsText></NavLink>
          <NavLink to="/lessons"><CmsText id="copy_site_lessons">Lessons</CmsText></NavLink>
          <NavLink to="/prices"><CmsText id="copy_site_prices">Prices</CmsText></NavLink>
          <NavLink to="/instructors"><CmsText id="copy_site_instructors">Instructors</CmsText></NavLink>
          <NavLink to="/reviews"><CmsText id="copy_site_reviews">Reviews</CmsText></NavLink>
          <NavLink to="/contact"><CmsText id="copy_site_contact">Contact</CmsText></NavLink>
          <NavLink to="/login"><CmsText id="copy_site_portal">Portal</CmsText></NavLink>
          <NavLink to="/book" className="cta-nav"><CmsText id="copy_site_book_lesson">Book Lesson</CmsText></NavLink>
        </nav>
      </div>
    </header>
  );
}
