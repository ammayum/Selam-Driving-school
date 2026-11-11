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
    <Question slug="faq_types" title="Does Selam Driving School offer manual and automatic lessons in Sheffield?" body="Selam Driving School lists both manual and automatic lesson options in Sheffield. Choose your preferred type when enquiring; availability is confirmed after your request." />
    <Question slug="faq_prices" title="Where can I find driving lesson prices in Sheffield?" body="Visit the Prices page to compare currently available lesson packages, hours and prices before booking." />
    <Question slug="faq_confirmation" title="Is my driving lesson confirmed when I submit a booking request?" body="No. Your request includes a preferred date and location. Selam Driving School will contact you to confirm your instructor and lesson arrangements." />
  </section>;
}
