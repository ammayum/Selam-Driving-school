import { useCmsPage } from "../pages/public/useCmsPage";
import { CmsCopy } from "./CmsCopy";

function Question({ slug, title, body }: { slug: string; title: string; body: string }) {
  const page = useCmsPage(slug);
  return <details><summary>{page?.title ?? title}</summary><p>{page?.body ?? body}</p></details>;
}
export function BookingFaq() {
  return <section className="section container"><CmsCopy slug="booking_faq" title="Booking Questions" level={2} />
    <Question slug="faq_booking" title="How do I book driving lessons?" body="Choose a package, enter your preferred start date and pickup location, and submit a booking request. The school will contact you to confirm your instructor and lesson details." />
    <Question slug="faq_account" title="Do I need an account to request a lesson?" body="No. Guest booking is available. Creating an account is optional and lets you use the student portal." />
    <Question slug="faq_payment" title="How can I pay for lessons?" body="The booking form offers advance payment for two hours or payment directly to the instructor in class. The school confirms the payment and lesson arrangements." />
  </section>;
}
