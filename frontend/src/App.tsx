import { ChangePasswordPage } from "./pages/ChangePasswordPage";
import { DynamicPage } from "./pages/public/DynamicPage";
import { Route, Routes } from "react-router-dom";
import { CmsContentProvider } from "./pages/public/useCmsPage";

import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { SideVideoPlayer } from "./components/SideVideoPlayer";
import { LoginPage } from "./pages/LoginPage";
import { PortalPage } from "./pages/PortalPage";
import { InstructorTimelinePage } from "./pages/InstructorTimelinePage";
import { BusinessCardPage } from "./pages/BusinessCardPage";
import {
  AboutPage,
  AssignBookingPage,
  BlogPage,
  BookPage,
  ContactPage,
  HomePage,
  InstructorsPage,
  LessonsPage,
  PricesPage,
  ReviewsPage,
  SignupPage,
} from "./pages/PublicPages";

function SiteFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <SideVideoPlayer />
      <SiteFooter />
    </>
  );
}

export default function App() {
  return (
    <CmsContentProvider><Routes>
      <Route path="/" element={<SiteFrame><HomePage /></SiteFrame>} />
      <Route path="/about" element={<SiteFrame><AboutPage /></SiteFrame>} />
      <Route path="/lessons" element={<SiteFrame><LessonsPage /></SiteFrame>} />
      <Route path="/prices" element={<SiteFrame><PricesPage /></SiteFrame>} />
      <Route path="/instructors" element={<SiteFrame><InstructorsPage /></SiteFrame>} />
      <Route path="/reviews" element={<SiteFrame><ReviewsPage /></SiteFrame>} />
      <Route path="/book" element={<SiteFrame><BookPage /></SiteFrame>} />
      <Route path="/assign/booking/:bookingId" element={<SiteFrame><AssignBookingPage /></SiteFrame>} />
      <Route path="/signup" element={<SiteFrame><SignupPage /></SiteFrame>} />
      <Route path="/contact" element={<SiteFrame><ContactPage /></SiteFrame>} />
      <Route path="/blog" element={<SiteFrame><BlogPage /></SiteFrame>} />
      <Route path="/login" element={<SiteFrame><LoginPage /></SiteFrame>} />
      <Route path="/change-password" element={<SiteFrame><ChangePasswordPage /></SiteFrame>} />
      <Route path="/portal" element={<SiteFrame><PortalPage /></SiteFrame>} />
      <Route path="/admin" element={<SiteFrame><PortalPage /></SiteFrame>} />
      <Route path="/admin/:section" element={<SiteFrame><PortalPage /></SiteFrame>} />
      <Route path="/admin/cms/:contentGroup" element={<SiteFrame><PortalPage /></SiteFrame>} />
      <Route path="/instructor/timeline" element={<SiteFrame><InstructorTimelinePage /></SiteFrame>} />
      <Route path="/instructor/business-card" element={<SiteFrame><BusinessCardPage /></SiteFrame>} />
      <Route path="*" element={<SiteFrame><DynamicPage /></SiteFrame>} />
    </Routes></CmsContentProvider>
  );
}
