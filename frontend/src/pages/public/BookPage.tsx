import { CmsText } from "./useCmsPage";
import { CmsCopy } from "../../components/CmsCopy";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { api } from "../../api/client";
import { Seo } from "../../components/Seo";
import { LessonPackage } from "../../types";

const PAYMENT_OPTIONS = [
  { value: "advance_2_hours", label: "Advance 2 hours" },
  { value: "pay_instructor_in_class", label: "Pay instructor in class" },
] as const;

export function BookPage() {
  const [searchParams] = useSearchParams();
  const requestedPackage = Number(searchParams.get("package")) || 0;
  const [packages, setPackages] = useState<LessonPackage[]>([]);
  const [status, setStatus] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState(0);
  const [lessonType, setLessonType] = useState<"manual" | "automatic">("manual");

  useEffect(() => {
    api
      .listPackages()
      .then((rows) => {
        const active = rows.filter((item) => item.is_active);
        setPackages(active);
        const requested = active.find(item => item.id === requestedPackage);
        if (requested) {
          setLessonType(requested.package_type);
          setSelectedPackageId(requested.id);
        }
      })
      .catch(() => setPackages([]));
  }, [requestedPackage]);

  const filteredPackages = useMemo(() => packages.filter(item => item.package_type === lessonType), [packages, lessonType]);
  const selectedPackage = useMemo(
    () => filteredPackages.find((item) => item.id === selectedPackageId) || null,
    [filteredPackages, selectedPackageId]
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const packageId = Number(form.get("package_id"));
    const preferredStart = String(form.get("preferred_start"));
    const paymentMethod = String(form.get("payment_method")) as "advance_2_hours" | "pay_instructor_in_class";
    const packageItem = filteredPackages.find((item) => item.id === packageId);

    if (!packageItem) {
      setStatus("Please select a package.");
      return;
    }
    if (!preferredStart) {
      setStatus("Please tell us when you want to start.");
      return;
    }

    const start = new Date(preferredStart);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    try {
      await api.createBooking({
        package_id: packageItem.id,
        package_title: packageItem.title,
        lesson_type: lessonType,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        pickup_location: String(form.get("pickup_location")),
        guest_name: String(form.get("guest_name")),
        guest_email: String(form.get("guest_email")),
        guest_phone: String(form.get("guest_phone")),
        notes: String(form.get("notes") || ""),
        payment_method: paymentMethod,
      });
      setStatus("Booking submitted. We will be in contact with your lesson details and assigned instructor.");
      formElement.reset();
      setSelectedPackageId(0);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Booking failed");
    }
  }

  return (
    <section className="section container">
      <Seo title="Book Driving Lesson Sheffield" description="Choose a package, your preferred start date, and payment option." />
      <CmsCopy slug="book" title="Book Lesson" body="Tell us when you want to start, choose your package, and we will contact you with the full lesson details." level={1} />
      <div className="hero-actions"><Link to="/signup" className="btn btn-black"><CmsText id="copy_book_create_optional_account">Create Optional Account</CmsText></Link></div>
      <div className="two-col">
        <article className="card">
          <CmsCopy slug="book_process" title="How Booking Works" body="Choose your package and preferred start date. We confirm your lesson details." />
          <div className="slot-wrap">
            {filteredPackages.map((item) => (
              <span key={item.id} className="slot">
                {item.title} - {item.hours} hours - GBP {item.price}
              </span>
            ))}
          </div>
        </article>

        <article className="card">
          <CmsCopy slug="book_request" title="Booking Request" />
          <form onSubmit={onSubmit} className="form-grid">
            <label htmlFor="booking-lesson-type"><CmsText id="copy_book_lesson_type">Lesson type</CmsText></label>
            <select id="booking-lesson-type" name="lesson_type" value={lessonType} onChange={e => { setLessonType(e.target.value as "manual" | "automatic"); setSelectedPackageId(0); setStatus(""); }} required>
              <option value="manual"><CmsText id="copy_book_manual">Manual</CmsText></option><option value="automatic"><CmsText id="copy_book_automatic">Automatic</CmsText></option>
            </select>
            <label htmlFor="booking-package"><CmsText id="copy_book_package">Package</CmsText></label>
            <select
              id="booking-package"
              name="package_id"
              value={selectedPackageId || ""}
              onChange={(e) => setSelectedPackageId(Number(e.target.value) || 0)}
              required
            >
              <option value="">{filteredPackages.length ? "Select package" : `No ${lessonType} packages available`}</option>
              {filteredPackages.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} - {item.hours} hours - GBP {item.price}
                </option>
              ))}
            </select>
            {selectedPackage ? <p>{selectedPackage.hours} hours included. {selectedPackage.description}</p> : null}
            {!filteredPackages.length && <p role="status">No {lessonType} packages are currently available. Please choose another type or contact us.</p>}

            <label><CmsText id="copy_book_when_do_you_want_to_start">When do you want to start?</CmsText></label>
            <input name="preferred_start" type="datetime-local" required />

            <label><CmsText id="copy_book_payment_method">Payment Method</CmsText></label>
            <select name="payment_method" defaultValue="advance_2_hours" required>
              {PAYMENT_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <label><CmsText id="copy_book_pickup_location">Pickup Location</CmsText></label>
            <input name="pickup_location" placeholder="Sheffield" required />
            <label><CmsText id="copy_book_full_name">Full Name</CmsText></label>
            <input name="guest_name" required />
            <label><CmsText id="copy_book_email">Email</CmsText></label>
            <input name="guest_email" type="email" required />
            <label><CmsText id="copy_book_phone">Phone</CmsText></label>
            <input name="guest_phone" required />
            <label><CmsText id="copy_book_notes_optional">Notes (optional)</CmsText></label>
            <textarea name="notes" rows={3} placeholder="Anything we should know before contacting you?" />
            <button className="btn btn-gold" type="submit" disabled={!filteredPackages.length}><CmsText id="copy_book_submit_booking">Submit Booking</CmsText></button>
          </form>
          <p>{status}</p>
        </article>
      </div>
    </section>
  );
}
