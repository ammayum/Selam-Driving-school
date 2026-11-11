import { CmsText } from "../pages/public/useCmsPage";
import { useCmsPage } from "../pages/public/useCmsPage";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { LessonPackage } from "../types";
import "./HomePackageShowcase.css";

const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

export function HomePackageShowcase() {
  const copy = useCmsPage("home_packages");
  const [packages, setPackages] = useState<LessonPackage[]>([]);
  const [filter, setFilter] = useState("all");
  const [state, setState] = useState("loading");
  useEffect(() => {
    let active = true;
    api.listPackages().then(rows => {
      if (!active) return;
      setPackages(rows.filter(item => item.is_active));
      setState("ready");
    }).catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, []);
  const visible = packages.filter(item => filter === "all" || item.package_type === filter);
  return (
    <section className="package-showcase section" aria-labelledby="package-heading">
      <div className="container">
        <div className="package-heading-row">
          <div><p className="eyebrow"><CmsText id="copy_home_your_next_chapter_behind_the_wheel">Your next chapter, behind the wheel</CmsText></p>
            <h2 id="package-heading">{copy?.title ?? "Find your starting gear."}</h2>
            <p>{copy?.body ?? "Manual or automatic. Choose your hours, then let us help you take the next turn."}</p>
          </div>
          <Link to="/prices" className="package-text-link"><CmsText id="copy_home_explore_all_prices">Explore all prices </CmsText><span aria-hidden="true">&rarr;</span></Link>
        </div>
        <div className="package-filters" role="group" aria-label="Filter packages by lesson type">
          {[["all", "All packages"], ["manual", "Manual"], ["automatic", "Automatic"]].map(([value, label]) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>
        <div role="status" className="package-status">
          {state === "loading" ? "Finding your next journey..." : state === "error" ? "Packages could not be loaded. Please refresh or contact us for current options." : !visible.length ? "No packages available for this selection. Contact us to discuss your lessons." : `${visible.length} ${visible.length === 1 ? "package" : "packages"} to get you moving`}
        </div>
        <div className="package-pass-grid" aria-busy={state === "loading"}>
          {visible.map(item => (
            <article className="package-pass" key={item.id}>
              <div className="package-pass-top"><span className="package-type">{item.package_type === "automatic" ? "Automatic" : "Manual"}</span><span className="package-pass-mark" aria-hidden="true"><CmsText id="copy_home_selam_drive">SELAM / DRIVE</CmsText></span></div>
              <div className="package-hours"><strong>{item.hours}</strong><span>{Number(item.hours) === 1 ? "hour" : "hours"}<small><CmsText id="copy_home_of_driving_tuition">of driving tuition</CmsText></small></span></div>
              <h3>{item.title}</h3>
              <p className="package-description">{item.description || "Take the next step in your driving journey with Selam."}</p>
              <div className="package-pass-bottom"><div><span><CmsText id="copy_home_package_total">Package total</CmsText></span><strong>{money.format(item.price)}</strong></div>
                <Link to={`/book?package=${item.id}`} className="btn btn-gold" aria-label={`Choose ${item.title}, ${item.package_type}, ${item.hours} hours`}><CmsText id="copy_home_choose_package">Choose package </CmsText><span aria-hidden="true">&rarr;</span></Link>
              </div>
            </article>
          ))}
        </div>
        <p className="package-footnote"><CmsText id="copy_home_hours_shown_are_your_total_package_allowance_we_confirm_individual_lesson_times_">Hours shown are your total package allowance. We confirm individual lesson times and instructor availability after your request. </CmsText><Link to="/contact"><CmsText id="copy_home_need_a_hand_choosing">Need a hand choosing?</CmsText></Link></p>
      </div>
    </section>
  );
}
