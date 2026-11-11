import { TemporaryCredentials } from "../components/TemporaryCredentials";
import { CreatedUser } from "../types";
import { CmsManager } from "../components/CmsManager";
import { UserManagement } from "../components/UserManagement";
import { AuditDetails } from "../components/AuditDetails";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { AdminNavigation, adminPages } from "../components/AdminNavigation";

import { api, resolveApiUrl } from "../api/client";
import { Seo } from "../components/Seo";
import { clearSession, getRole, getStudentId, getUserId } from "../lib/session";
import { OverviewSection } from "./portal/OverviewSection";
import { ActivityLog, AdminManagedUser, AdminPreference, Booking, BookingStats, CmsPage, DashboardMetrics, HomeRepeatableItem, InstructorType, Invite, LessonPackage, Notification, ReviewTestimonial, ReviewTestimonialSubmission, StudentProgress } from "../types";
import { StatCard } from "../components/StatCard";

type Tab = "passwords" | "overview" | "logs" | "instructors" | "students" | "packages" | "invites" | "notifications" | "cms" | "seo" | "config";

function DashboardError({ message }: { message: string }) {
  return <article className="card"><p>{message}</p></article>;
}

type ManageRole = "instructor" | "student";
type RepeatableSection = "trust_badges" | "highlights" | "services" | "steps";
type BookingSortField = "start_time" | "status" | "attendance_status" | "payment_status" | "student_name" | "instructor_name";

export function PortalPage() {
  const role = getRole();
  const userId = getUserId();
  const [staffTab, setTab] = useState<Tab>("overview");
  const { section: routeSection, contentGroup } = useParams();
  const section = routeSection ?? (contentGroup ? "cms" : undefined);
  const location = useLocation();
  const adminRoute = location.pathname === "/admin" || location.pathname.startsWith("/admin/");
  const tab: Tab = role === "admin" ? (section === "users" ? "passwords" : (section || "overview") as Tab) : staffTab;
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingStats, setBookingStats] = useState<BookingStats | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [packages, setPackages] = useState<LessonPackage[]>([]);
  const [createdUser,setCreatedUser]=useState<CreatedUser | null>(null);
  const [instructors, setInstructors] = useState<AdminManagedUser[]>([]);
  const [students, setStudents] = useState<AdminManagedUser[]>([]);
  const [adminPreferences, setAdminPreferences] = useState<AdminPreference[]>([]);
  const [smtpConfig, setSmtpConfig] = useState<Record<string, string>>({});
  const [smsConfig, setSmsConfig] = useState<Record<string, string>>({});
  const [videoConfig, setVideoConfig] = useState<Record<string, string>>({});
  const [contactConfig, setContactConfig] = useState<Record<string, string>>({});
  const [dbConfig, setDbConfig] = useState({
    host: "",
    port: "3306",
    username: "",
    password: "",
    database: "",
  });
  const [homeRepeatables, setHomeRepeatables] = useState<Record<RepeatableSection, HomeRepeatableItem[]>>({
    trust_badges: [],
    highlights: [],
    services: [],
    steps: [],
  });
  const [reviewTestimonials, setReviewTestimonials] = useState<ReviewTestimonial[]>([]);
  const [reviewSubmissions, setReviewSubmissions] = useState<ReviewTestimonialSubmission[]>([]);
  const [error, setError] = useState<string>("");
  const [actionStatus, setActionStatus] = useState<string>("");
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editingPackageId, setEditingPackageId] = useState<number | null>(null);
  const [rescheduleDrafts, setRescheduleDrafts] = useState<Record<number, { start_time: string; end_time: string }>>({});
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<number, string>>({});
  const [lessonProgressDrafts, setLessonProgressDrafts] = useState<
    Record<number, { attendance_status: "pending" | "attended" | "missed"; progress_notes: string; progress_score: string }>
  >({});
  const [showInstructorCreatePanel, setShowInstructorCreatePanel] = useState(true);
  const [showInstructorListPanel, setShowInstructorListPanel] = useState(true);
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState<"all" | "pending" | "approved" | "completed" | "cancelled">("all");
  const [bookingAttendanceFilter, setBookingAttendanceFilter] = useState<"all" | "pending" | "attended" | "missed">("all");
  const [bookingPaymentFilter, setBookingPaymentFilter] = useState<"all" | "not_requested" | "waiting" | "paid">("all");
  const [bookingSortField, setBookingSortField] = useState<BookingSortField>("start_time");
  const [bookingSortDirection, setBookingSortDirection] = useState<"asc" | "desc">("asc");
  const [bookingPage, setBookingPage] = useState(1);
  const [bookingPageSize, setBookingPageSize] = useState(10);
  const [packageDraft, setPackageDraft] = useState({
    title: "",
    hours: "5",
      package_type: "manual" as "manual" | "automatic",
    price: "0",
    description: "",
    is_active: true,
  });
  const [editingDraft, setEditingDraft] = useState<{
    full_name: string;
    email: string;
    phone: string;
    profile_photo_url: string;
    permit_number: string;
    instructor_type: InstructorType;
  }>({
    full_name: "",
    email: "",
    phone: "",
    profile_photo_url: "",
    permit_number: "",
    instructor_type: "both",
  });

  const isAdmin = role === "admin";
  const isStaff = role === "admin" || role === "instructor";

  function parseRepeatables(values: Record<string, string>): Record<RepeatableSection, HomeRepeatableItem[]> {
    const read = (key: RepeatableSection): HomeRepeatableItem[] => {
      const raw = values[key] || "[]";
      try {
        const parsed = JSON.parse(raw) as HomeRepeatableItem[];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };
    return {
      trust_badges: read("trust_badges"),
      highlights: read("highlights"),
      services: read("services"),
      steps: read("steps"),
    };
  }

  function toDateTimeLocal(value: string): string {
    const date = new Date(value);
    const tzOffsetMs = date.getTimezoneOffset() * 60 * 1000;
    return new Date(date.getTime() - tzOffsetMs).toISOString().slice(0, 16);
  }

  async function loadData() {
    if (!role) return;

    try {
      setError("");
      if (isStaff) {
        const dashboardPromise = api.getDashboard(role);
        const bookingPromise =
          role === "instructor" && userId
            ? api.listMyBookings("instructor", userId)
            : api.listBookings(role);
        const statsPromise = role === "instructor" && userId ? api.getBookingStats("instructor", userId) : api.getBookingStats("admin");
        const logsPromise = role === "instructor" && userId ? api.listActivityLogs("instructor", userId, 300) : api.listActivityLogs("admin", undefined, 300);
        const [dashboardData, bookingData, statsData, logsData, inviteData, notificationData, cmsData] = await Promise.all([
          dashboardPromise,
          bookingPromise,
          statsPromise,
          logsPromise,
          api.listInvites(role),
          api.listNotifications(role),
          api.listCmsPages(),
        ]);
        setMetrics(dashboardData);
        setBookings(bookingData);
        setBookingStats(statsData);
        setActivityLogs(logsData);
        setInvites(inviteData);
        setNotifications(notificationData);
        setPages(cmsData);
      }

      if (isAdmin) {
        const [smtp, sms, mediaCfg, contactCfg, dbConnection, repeatablesConfig, reviewRows, reviewSubmissionRows, instructorRows, studentRows, packageRows, adminPrefs] = await Promise.all([
          api.getConfigGroup("smtp"),
          api.getConfigGroup("sms"),
          api.getConfigGroup("media"),
          api.getConfigGroup("contact"),
          api.getDatabaseConnection(),
          api.getConfigGroup("cms_repeatables"),
          api.getReviewTestimonials(),
          api.listReviewTestimonialSubmissions(),
          api.listAdminUsers("instructor"),
          api.listAdminUsers("student"),
          api.listPackages(),
          api.listAdminPreferences(),
        ]);
        setSmtpConfig(smtp.values);
        setSmsConfig(sms.values);
        setVideoConfig(mediaCfg.values);
        setContactConfig(contactCfg.values);
        setDbConfig({
          host: dbConnection.host || "",
          port: String(dbConnection.port || 3306),
          username: dbConnection.username || "",
          password: "",
          database: dbConnection.database || "",
        });
        setHomeRepeatables(parseRepeatables(repeatablesConfig.values));
        setReviewTestimonials(reviewRows.items || []);
        setReviewSubmissions(reviewSubmissionRows || []);
        setInstructors(instructorRows);
        setStudents(studentRows);
        setPackages(packageRows);
        setAdminPreferences(adminPrefs);
      }

      if (role === "student") {
        const studentId = getStudentId();
        if (!studentId) {
          setError("Student role requires a student id. Please login again.");
          return;
        }
        const [progressData, studentBookings] = await Promise.all([
          api.getStudentProgress(studentId, role),
          api.listMyBookings("student", studentId),
        ]);
        setProgress(progressData);
        setBookings(studentBookings);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dashboard failed to load");
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    const next: Record<number, { start_time: string; end_time: string }> = {};
    const assignmentNext: Record<number, string> = {};
    const progressNext: Record<
      number,
      { attendance_status: "pending" | "attended" | "missed"; progress_notes: string; progress_score: string }
    > = {};
    for (const booking of bookings) {
      next[booking.id] = {
        start_time: toDateTimeLocal(booking.start_time),
        end_time: toDateTimeLocal(booking.end_time),
      };
      assignmentNext[booking.id] = booking.instructor_id != null ? String(booking.instructor_id) : "";
      progressNext[booking.id] = {
        attendance_status: booking.attendance_status || "pending",
        progress_notes: booking.progress_notes || "",
        progress_score: booking.progress_score != null ? String(booking.progress_score) : "",
      };
    }
    setRescheduleDrafts(next);
    setAssignmentDrafts(assignmentNext);
    setLessonProgressDrafts(progressNext);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings]);

  const title = useMemo(() => {
    if (role === "admin") return "Admin Dashboard";
    if (role === "instructor") return "Instructor Dashboard";
    if (role === "student") return "Student Dashboard";
    return "Portal";
  }, [role]);

  const filteredSortedBookings = useMemo(() => {
    const needle = bookingSearch.trim().toLowerCase();
    const rows = bookings.filter((b) => {
      if (bookingStatusFilter !== "all" && b.status !== bookingStatusFilter) return false;
      if (bookingAttendanceFilter !== "all" && b.attendance_status !== bookingAttendanceFilter) return false;
      if (bookingPaymentFilter !== "all" && b.payment_status !== bookingPaymentFilter) return false;
      if (!needle) return true;
      const haystack = [
        String(b.id),
        b.student_name || "",
        b.guest_name || "",
        b.instructor_name || "",
        b.lesson_type || "",
        b.pickup_location || "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });

    rows.sort((a, b) => {
      let av = "";
      let bv = "";
      if (bookingSortField === "start_time") {
        av = a.start_time;
        bv = b.start_time;
      } else if (bookingSortField === "status") {
        av = a.status;
        bv = b.status;
      } else if (bookingSortField === "attendance_status") {
        av = a.attendance_status;
        bv = b.attendance_status;
      } else if (bookingSortField === "payment_status") {
        av = a.payment_status;
        bv = b.payment_status;
      } else if (bookingSortField === "student_name") {
        av = a.student_name || a.guest_name || "";
        bv = b.student_name || b.guest_name || "";
      } else {
        av = a.instructor_name || "";
        bv = b.instructor_name || "";
      }
      const cmp = av.localeCompare(bv);
      return bookingSortDirection === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [bookings, bookingSearch, bookingStatusFilter, bookingAttendanceFilter, bookingPaymentFilter, bookingSortField, bookingSortDirection]);

  const bookingTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredSortedBookings.length / bookingPageSize)), [filteredSortedBookings.length, bookingPageSize]);
  const pagedBookings = useMemo(() => {
    const start = (bookingPage - 1) * bookingPageSize;
    return filteredSortedBookings.slice(start, start + bookingPageSize);
  }, [filteredSortedBookings, bookingPage, bookingPageSize]);

  useEffect(() => {
    setBookingPage(1);
  }, [bookingSearch, bookingStatusFilter, bookingAttendanceFilter, bookingPaymentFilter, bookingSortField, bookingSortDirection, bookingPageSize]);

  useEffect(() => {
    if (bookingPage > bookingTotalPages) {
      setBookingPage(bookingTotalPages);
    }
  }, [bookingPage, bookingTotalPages]);

  async function onCreateInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!role || !userId) {
      setActionStatus("Missing role/user id session.");
      return;
    }

    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    try {
      await api.createInvite(
        {
          email: String(form.get("email")),
          phone: String(form.get("phone")),
          role: "student",
          instructor_id: form.get("instructor_id") ? Number(form.get("instructor_id")) : undefined,
        },
        role,
        userId
      );
      setActionStatus("Invite created successfully.");
      formEl.reset();
      loadData();
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "Invite failed");
    }
  }

  async function onCreateNotification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!role) {
      setActionStatus("Missing role session.");
      return;
    }
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    try {
      await api.createNotification(
        {
          recipient: String(form.get("recipient")),
          channel: String(form.get("channel")),
          category: String(form.get("category")),
          message: String(form.get("message")),
        },
        role
      );
      setActionStatus("Notification queued.");
      formEl.reset();
      loadData();
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "Notification failed");
    }
  }

  async function onCreateManagedUser(event: FormEvent<HTMLFormElement>, manageRole: ManageRole) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    try {
      let profilePhotoUrl: string | undefined;
      if (manageRole === "instructor") {
        const file = form.get("profile_photo");
        if (file instanceof File && file.size > 0) {
          const uploaded = await api.uploadPhoto(file);
          profilePhotoUrl = uploaded.url;
        }
      }
      const created = await api.createAdminUser({
        full_name: String(form.get("full_name")),
        email: String(form.get("email")),
        phone: String(form.get("phone")),
        role: manageRole,
        profile_photo_url: profilePhotoUrl,
        permit_number: String(form.get("permit_number") || "") || undefined,
        instructor_type: (String(form.get("instructor_type") || "") || undefined) as InstructorType | undefined,
      });
      setCreatedUser(created);
      setActionStatus(`${manageRole} created.`);
      formEl.reset();
      loadData();
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "Create failed");
    }
  }

  async function onSaveInlineUser(userIdValue: number) {
    try {
      await api.updateAdminUser(userIdValue, {
        full_name: editingDraft.full_name || undefined,
        email: editingDraft.email || undefined,
        phone: editingDraft.phone || undefined,
        profile_photo_url: editingDraft.profile_photo_url || undefined,
        permit_number: editingDraft.permit_number || undefined,
        instructor_type: (editingDraft.instructor_type || undefined) as InstructorType | undefined,
      });
      setActionStatus("User updated.");
      setEditingUserId(null);
      loadData();
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "Update failed");
    }
  }

  function onStartInlineEdit(user: AdminManagedUser) {
    setEditingUserId(user.id);
    setEditingDraft({
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      profile_photo_url: user.profile_photo_url || "",
      permit_number: user.permit_number || "",
      instructor_type: user.instructor_type || "both",
    });
  }

  async function onInlinePhotoSelected(file: File) {
    try {
      const uploaded = await api.uploadPhoto(file);
      setEditingDraft((prev) => ({ ...prev, profile_photo_url: uploaded.url }));
      setActionStatus("Photo uploaded.");
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "Photo upload failed");
    }
  }

  async function onToggleFreeze(userIdValue: number, isFrozen: boolean) {
    try {
      await api.freezeAdminUser(userIdValue, !isFrozen);
      setActionStatus(!isFrozen ? "User frozen." : "User unfrozen.");
      loadData();
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "Freeze toggle failed");
    }
  }

  async function onDeleteManagedUser(userIdValue: number) {
    try {
      await api.deleteAdminUser(userIdValue);
      setActionStatus("User deleted.");
      loadData();
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function onSetBookingStatus(bookingId: number, status: "approved" | "completed" | "cancelled") {
    if (!role || (role !== "admin" && role !== "instructor")) {
      return;
    }
    try {
      await api.updateBooking(bookingId, role, { status }, userId || undefined);
      setActionStatus(`Booking ${status}.`);
      loadData();
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "Booking update failed");
    }
  }

  async function onRescheduleBooking(bookingId: number) {
    if (!role || (role !== "admin" && role !== "instructor")) {
      return;
    }
    const draft = rescheduleDrafts[bookingId];
    if (!draft?.start_time || !draft?.end_time) {
      setActionStatus("Select start and end time first.");
      return;
    }
    try {
      await api.updateBooking(
        bookingId,
        role,
        {
          start_time: new Date(draft.start_time).toISOString(),
          end_time: new Date(draft.end_time).toISOString(),
        },
        userId || undefined
      );
      setActionStatus("Booking rescheduled.");
      loadData();
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "Reschedule failed");
    }
  }

  async function onAssignInstructor(bookingId: number) {
    if (role !== "admin") {
      return;
    }
    const instructorId = Number(assignmentDrafts[bookingId]);
    if (!instructorId) {
      setActionStatus("Select an instructor before assigning.");
      return;
    }
    try {
      await api.updateBooking(bookingId, role, { instructor_id: instructorId }, userId || undefined);
      setActionStatus("Instructor assigned and notified.");
      loadData();
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "Assignment failed");
    }
  }

  async function onRequestPayment(bookingId: number) {
    if (!role || (role !== "admin" && role !== "instructor")) {
      return;
    }
    try {
      await api.requestBookingPayment(bookingId, role, userId || undefined);
      setActionStatus("Payment requested (waiting).");
      loadData();
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "Payment request failed");
    }
  }

  async function onSetPaymentStatus(bookingId: number, paymentStatus: "not_requested" | "waiting" | "paid") {
    if (!role || (role !== "admin" && role !== "instructor")) {
      return;
    }
    try {
      await api.updateBookingPaymentStatus(bookingId, role, paymentStatus, userId || undefined);
      setActionStatus(`Payment status set to ${paymentStatus}.`);
      loadData();
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "Payment status update failed");
    }
  }

  async function onSaveLessonProgress(bookingId: number) {
    if (!role || (role !== "admin" && role !== "instructor")) {
      return;
    }
    const draft = lessonProgressDrafts[bookingId];
    if (!draft) {
      setActionStatus("No progress draft found.");
      return;
    }
    try {
      await api.updateBooking(
        bookingId,
        role,
        {
          attendance_status: draft.attendance_status,
          progress_notes: draft.progress_notes || undefined,
          progress_score: draft.progress_score ? Number(draft.progress_score) : undefined,
        },
        userId || undefined
      );
      setActionStatus("Lesson progress updated.");
      loadData();
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "Lesson progress update failed");
    }
  }

  async function onUpdateSeo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) return;
    const form = new FormData(event.currentTarget);
    try {
      await api.updateSeo(String(form.get("slug")), {
        meta_title: String(form.get("meta_title") || ""),
        meta_description: String(form.get("meta_description") || ""),
        is_published: form.get("is_published") === "on",
      });
      setActionStatus("SEO settings updated.");
      loadData();
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "SEO update failed");
    }
  }

  async function onSaveSmtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) return;
    const form = new FormData(event.currentTarget);
    const values = {
      host: String(form.get("host") || ""),
      port: String(form.get("port") || ""),
      username: String(form.get("username") || ""),
      password: String(form.get("password") || ""),
      encryption: String(form.get("encryption") || "tls"),
      from_email: String(form.get("from_email") || ""),
    };
    try {
      await api.updateConfigGroup("smtp", values);
      setActionStatus("SMTP configuration saved.");
      loadData();
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "SMTP save failed");
    }
  }

  async function onSaveSms(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) return;
    const form = new FormData(event.currentTarget);
    const values = {
      provider: String(form.get("provider") || ""),
      api_key: String(form.get("api_key") || ""),
      sender_id: String(form.get("sender_id") || ""),
    };
    try {
      await api.updateConfigGroup("sms", values);
      setActionStatus("SMS configuration saved.");
      loadData();
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "SMS save failed");
    }
  }

  async function onSaveVideoConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) return;
    const form = new FormData(event.currentTarget);
    const values = {
      video_title: String(form.get("video_title") || ""),
      youtube_url: String(form.get("youtube_url") || ""),
    };
    try {
      await api.updateConfigGroup("media", values);
      setActionStatus("Side video settings saved.");
      loadData();
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "Video settings save failed");
    }
  }

  async function onSaveAboutMediaConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) return;
    const form = new FormData(event.currentTarget);
    const values = {
      social_facebook_url: String(form.get("social_facebook_url") || ""),
      social_instagram_url: String(form.get("social_instagram_url") || ""),
      social_tiktok_url: String(form.get("social_tiktok_url") || ""),
      social_youtube_url: String(form.get("social_youtube_url") || ""),
      about_video_1_title: String(form.get("about_video_1_title") || ""),
      about_video_1_url: String(form.get("about_video_1_url") || ""),
      about_video_2_title: String(form.get("about_video_2_title") || ""),
      about_video_2_url: String(form.get("about_video_2_url") || ""),
      about_video_3_title: String(form.get("about_video_3_title") || ""),
      about_video_3_url: String(form.get("about_video_3_url") || ""),
    };
    try {
      await api.updateConfigGroup("media", values);
      setActionStatus("About social links and video cards saved.");
      loadData();
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "About media save failed");
    }
  }

  async function onSaveContactConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) return;
    const form = new FormData(event.currentTarget);
    const values = {
      phone: String(form.get("phone") || ""),
      phone_link: String(form.get("phone_link") || ""),
      email: String(form.get("email") || ""),
      address: String(form.get("address") || ""),
      whatsapp: String(form.get("whatsapp") || ""),
      whatsapp_link: String(form.get("whatsapp_link") || ""),
      contact_note: String(form.get("contact_note") || ""),
    };
    try {
      await api.updateConfigGroup("contact", values);
      setActionStatus("Contact details saved.");
      loadData();
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "Contact details save failed");
    }
  }

  async function onUpdateAdminPreference(userIdValue: number, field: "allow_email_assign" | "receive_booking_emails", value: boolean) {
    if (!isAdmin) return;
    try {
      const updated = await api.updateAdminPreferences(userIdValue, { [field]: value });
      setAdminPreferences((prev) => prev.map((item) => (item.user_id === userIdValue ? updated : item)));
      setActionStatus("Admin email access updated.");
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "Admin preferences update failed");
    }
  }

  async function onSaveDatabaseConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) return;
    try {
      await api.saveDatabaseConnection({
        host: dbConfig.host,
        port: Number(dbConfig.port || 3306),
        username: dbConfig.username,
        password: dbConfig.password,
        database: dbConfig.database,
      });
      setActionStatus("Database connection saved.");
      loadData();
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "Database config save failed");
    }
  }

  async function onTestDatabaseConnection() {
    if (!isAdmin) return;
    try {
      const res = await api.testDatabaseConnection();
      setActionStatus(res.ok ? `DB test success: ${res.message}` : `DB test failed: ${res.message}`);
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "Database test failed");
    }
  }

  async function onMigrateToMySql() {
    if (!isAdmin) return;
    try {
      const res = await api.migrateToMySql();
      setActionStatus(`Migration completed. Tables: ${res.tables}, Rows: ${res.rows}`);
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "Migration failed");
    }
  }

  async function onApplyMySqlAsDefault() {
    if (!isAdmin) return;
    try {
      const res = await api.applyMySqlAsDefault();
      setActionStatus(res.message);
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "Apply default DB failed");
    }
  }

  function onAddRepeatable(section: RepeatableSection) {
    setHomeRepeatables((prev) => ({
      ...prev,
      [section]: [...prev[section], { title: "", text: "", badge: "", cta_label: "", cta_url: "" }],
    }));
  }

  function onRemoveRepeatable(section: RepeatableSection, index: number) {
    setHomeRepeatables((prev) => ({
      ...prev,
      [section]: prev[section].filter((_, idx) => idx !== index),
    }));
  }

  function onChangeRepeatable(
    section: RepeatableSection,
    index: number,
    field: keyof HomeRepeatableItem,
    value: string
  ) {
    setHomeRepeatables((prev) => ({
      ...prev,
      [section]: prev[section].map((item, idx) => (idx === index ? { ...item, [field]: value } : item)),
    }));
  }

  async function onSaveHomeRepeatables() {
    if (!isAdmin) return;
    const values: Record<string, string> = {
      trust_badges: JSON.stringify(homeRepeatables.trust_badges),
      highlights: JSON.stringify(homeRepeatables.highlights),
      services: JSON.stringify(homeRepeatables.services),
      steps: JSON.stringify(homeRepeatables.steps),
    };
    try {
      await api.updateConfigGroup("cms_repeatables", values);
      setActionStatus("Home repeatable cards saved.");
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "Home repeatables save failed");
    }
  }

  function onAddReviewTestimonial() {
    setReviewTestimonials((prev) => [...prev, { author: "", testimonial: "", rating: 5 }]);
  }

  function onRemoveReviewTestimonial(index: number) {
    setReviewTestimonials((prev) => prev.filter((_, idx) => idx !== index));
  }

  function onChangeReviewTestimonial(index: number, field: keyof ReviewTestimonial, value: string | number) {
    setReviewTestimonials((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: field === "rating" ? Number(value) : value } : item))
    );
  }

  async function onSaveReviewTestimonials() {
    if (!isAdmin) return;
    try {
      const sanitized = reviewTestimonials
        .map((item) => ({
          author: item.author.trim(),
          testimonial: item.testimonial.trim(),
          rating: Math.max(1, Math.min(5, Number(item.rating || 1))),
        }))
        .filter((item) => item.author && item.testimonial);
      await api.updateReviewTestimonials(sanitized);
      setReviewTestimonials(sanitized);
      setActionStatus("Review testimonials saved.");
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "Review testimonials save failed");
    }
  }

  async function onModerateReviewSubmission(submissionId: number, status: "approved" | "rejected") {
    if (!isAdmin) return;
    try {
      await api.moderateReviewTestimonialSubmission(submissionId, status);
      const [submissions, reviews] = await Promise.all([
        api.listReviewTestimonialSubmissions(),
        api.getReviewTestimonials(),
      ]);
      setReviewSubmissions(submissions || []);
      setReviewTestimonials(reviews.items || []);
      setActionStatus(`Submission ${status}.`);
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "Moderation failed");
    }
  }

  function onStartPackageEdit(item: LessonPackage) {
    setEditingPackageId(item.id);
    setPackageDraft({
      title: item.title,
      hours: String(item.hours),
      package_type: item.package_type,
      price: String(item.price),
      description: item.description || "",
      is_active: item.is_active,
    });
  }

  function resetPackageDraft() {
    setEditingPackageId(null);
    setPackageDraft({
      title: "",
      hours: "5",
      package_type: "manual" as "manual" | "automatic",
      price: "0",
      description: "",
      is_active: true,
    });
  }

  async function onSavePackage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) return;
    try {
      const payload = {
        title: packageDraft.title,
        hours: Number(packageDraft.hours),
        package_type: packageDraft.package_type,
        price: Number(packageDraft.price),
        description: packageDraft.description || undefined,
        is_active: packageDraft.is_active,
      };
      if (editingPackageId) {
        await api.updatePackage(editingPackageId, payload);
        setActionStatus("Package updated.");
      } else {
        await api.createPackage(payload);
        setActionStatus("Package created.");
      }
      resetPackageDraft();
      loadData();
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "Package save failed");
    }
  }

  async function onTogglePackageActive(item: LessonPackage) {
    if (!isAdmin) return;
    try {
      await api.updatePackage(item.id, {
        title: item.title,
        hours: item.hours,
        package_type: item.package_type,
        price: item.price,
        description: item.description || undefined,
        is_active: !item.is_active,
      });
      setActionStatus(item.is_active ? "Package deactivated." : "Package activated.");
      loadData();
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : "Package update failed");
    }
  }

  if (!role) {
    return (
      <section className="section container">
        <article className="card">
          <h1>Portal access required</h1>
          <p>Please login to continue.</p>
          <Link className="btn btn-gold" to="/login">Go to Login</Link>
        </article>
      </section>
    );
  }

  if (adminRoute && !isAdmin) return <section className="section container"><h1>Administrator access required</h1><Link to="/portal">Return to your portal</Link></section>;
  if (isAdmin && (!adminRoute || !section)) return <Navigate to="/admin/overview" replace />;
  if (isAdmin && !adminPages.some(([path]) => path === section)) return <section className="section container"><h1>Admin page not found</h1><Link to="/admin/overview">Return to overview</Link></section>;

  return (
    <section className="section container">
      <Seo title={`${isAdmin ? adminPages.find(([path]) => path === section)?.[1] : title} | Selam Driving School`} description="Manage bookings, users, invites, notifications and content." />
      <div className="portal-head">
        <h1>{isAdmin ? adminPages.find(([path]) => path === section)?.[1] : title}</h1>
        {isStaff && <Link className="btn" to="/instructor/timeline">Bookings &amp; Events Timeline</Link>}
        {isStaff && <Link className="btn" to="/instructor/business-card">Instructor Business Cards</Link>}
        <div className="portal-actions">
          <span className="pill">Role: {role}</span>
          <button className="btn btn-outline" onClick={() => { clearSession(); window.location.href = "/login"; }}>Logout</button>
        </div>
      </div>

      {createdUser && <TemporaryCredentials user={createdUser} onDismiss={() => setCreatedUser(null)} />}
      {error ? <DashboardError message={error} /> : null}

      <div className={isAdmin ? "admin-layout" : undefined}>
      {isAdmin && <AdminNavigation />}
      <div className="admin-content">
      {isStaff && !isAdmin ? (
        <div className="tab-row">
          <button className={tab === "overview" ? "tab-btn active" : "tab-btn"} onClick={() => setTab("overview")}>Overview</button>
          <button className={tab === "logs" ? "tab-btn active" : "tab-btn"} onClick={() => setTab("logs")}>Logs</button>
          <button className={tab === "invites" ? "tab-btn active" : "tab-btn"} onClick={() => setTab("invites")}>Invites</button>
          <button className={tab === "notifications" ? "tab-btn active" : "tab-btn"} onClick={() => setTab("notifications")}>Notifications</button>
        </div>
      ) : null}

      {isAdmin && tab === "passwords" && <UserManagement currentUserId={userId ?? undefined} onChanged={loadData} />}

      {isStaff && tab === "overview" && metrics ? (
        <OverviewSection
          role={role}
          metrics={metrics}
          bookingStats={bookingStats}
          pagedBookings={pagedBookings}
          filteredCount={filteredSortedBookings.length}
          bookingPage={bookingPage}
          bookingTotalPages={bookingTotalPages}
          setBookingPage={setBookingPage}
          bookingSearch={bookingSearch}
          setBookingSearch={setBookingSearch}
          bookingStatusFilter={bookingStatusFilter}
          setBookingStatusFilter={setBookingStatusFilter}
          bookingAttendanceFilter={bookingAttendanceFilter}
          setBookingAttendanceFilter={setBookingAttendanceFilter}
          bookingPaymentFilter={bookingPaymentFilter}
          setBookingPaymentFilter={setBookingPaymentFilter}
          bookingSortField={bookingSortField}
          setBookingSortField={setBookingSortField}
          bookingSortDirection={bookingSortDirection}
          setBookingSortDirection={setBookingSortDirection}
          bookingPageSize={bookingPageSize}
          setBookingPageSize={setBookingPageSize}
          rescheduleDrafts={rescheduleDrafts}
          setRescheduleDrafts={setRescheduleDrafts}
          lessonProgressDrafts={lessonProgressDrafts}
          setLessonProgressDrafts={setLessonProgressDrafts}
          assignmentDrafts={assignmentDrafts}
          setAssignmentDrafts={setAssignmentDrafts}
          instructors={instructors}
          onRescheduleBooking={onRescheduleBooking}
          onSetBookingStatus={onSetBookingStatus}
          onRequestPayment={onRequestPayment}
          onSetPaymentStatus={onSetPaymentStatus}
          onSaveLessonProgress={onSaveLessonProgress}
          onAssignInstructor={onAssignInstructor}
        />
      ) : null}

      {isStaff && tab === "logs" ? (
        <article className="card">
          <h3>Audit Log</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Time</th><th>Role</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
              <tbody>
                {activityLogs.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.created_at.replace(" ", "T") + (/Z$|[+-]\d{2}:\d{2}$/.test(item.created_at) ? "" : "Z")).toLocaleString()}</td>
                    <td>{item.actor_role}</td>
                    <td>{item.actor_username || item.actor_id || "-"}</td>
                    <td>{item.action}</td>
                    <td>{item.target_type}{item.target_id ? `#${item.target_id}` : ""}</td>
                    <td><AuditDetails details={item.details} /></td>
                  </tr>
                ))}
                {activityLogs.length === 0 ? <tr><td colSpan={6}>No logs available.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}

      {isAdmin && tab === "instructors" ? (
        <div className="stack-rows">
          <article className="card">
            <div className="collapse-head">
              <h3>Add Instructor</h3>
              <button className="mini-btn" onClick={() => setShowInstructorCreatePanel((prev) => !prev)}>
                {showInstructorCreatePanel ? "Collapse" : "Expand"}
              </button>
            </div>
            {showInstructorCreatePanel ? (
              <form onSubmit={(e) => onCreateManagedUser(e, "instructor")} className="form-grid">
                <label>Full Name</label><input name="full_name" required />
                <label>Email</label><input name="email" type="email" required />
                <label>Phone</label><input name="phone" required />
                <label>Profile Photo</label><input name="profile_photo" type="file" accept="image/*" />
                <label>Permit Number</label><input name="permit_number" />
                <label>Instructor Type</label>
                <select name="instructor_type" defaultValue="both">
                  <option value="manual">Manual</option>
                  <option value="automatic">Automatic</option>
                  <option value="both">Both</option>
                </select>
                <button className="btn btn-gold" type="submit">Add</button>
              </form>
            ) : null}
            <p>{actionStatus}</p>
          </article>
          <article className="card">
            <div className="collapse-head">
              <h3>Instructor List</h3>
              <button className="mini-btn" onClick={() => setShowInstructorListPanel((prev) => !prev)}>
                {showInstructorListPanel ? "Collapse" : "Expand"}
              </button>
            </div>
            {showInstructorListPanel ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    {tab === "instructors" ? <th>Photo</th> : null}
                    {tab === "instructors" ? <th>Permit</th> : null}
                    {tab === "instructors" ? <th>Type</th> : null}
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {instructors.map((user) => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>
                        {editingUserId === user.id ? (
                          <input className="inline-input" value={editingDraft.full_name} onChange={(e) => setEditingDraft((prev) => ({ ...prev, full_name: e.target.value }))} />
                        ) : (
                          user.full_name
                        )}
                      </td>
                      <td>
                        {editingUserId === user.id ? (
                          <input className="inline-input" value={editingDraft.email} onChange={(e) => setEditingDraft((prev) => ({ ...prev, email: e.target.value }))} />
                        ) : (
                          user.email
                        )}
                      </td>
                      <td>
                        {editingUserId === user.id ? (
                          <input className="inline-input" value={editingDraft.phone} onChange={(e) => setEditingDraft((prev) => ({ ...prev, phone: e.target.value }))} />
                        ) : (
                          user.phone
                        )}
                      </td>
                      {tab === "instructors" ? (
                        <td>
                          {editingUserId === user.id ? (
                            <div className="inline-upload">
                              <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { onInlinePhotoSelected(file); } }} />
                              {editingDraft.profile_photo_url ? (
                                <img src={resolveApiUrl(editingDraft.profile_photo_url)} alt="Instructor preview" className="table-thumb" />
                              ) : null}
                            </div>
                          ) : user.profile_photo_url ? (
                            <img src={resolveApiUrl(user.profile_photo_url)} alt={user.full_name} className="table-thumb" />
                          ) : (
                            "-"
                          )}
                        </td>
                      ) : null}
                      {tab === "instructors" ? (
                        <td>
                          {editingUserId === user.id ? (
                            <input className="inline-input" value={editingDraft.permit_number} onChange={(e) => setEditingDraft((prev) => ({ ...prev, permit_number: e.target.value }))} />
                          ) : (
                            user.permit_number || "-"
                          )}
                        </td>
                      ) : null}
                      {tab === "instructors" ? (
                        <td>
                          {editingUserId === user.id ? (
                            <select className="inline-input" value={editingDraft.instructor_type} onChange={(e) => setEditingDraft((prev) => ({ ...prev, instructor_type: e.target.value as InstructorType }))}>
                              <option value="manual">Manual</option>
                              <option value="automatic">Automatic</option>
                              <option value="both">Both</option>
                            </select>
                          ) : (
                            user.instructor_type || "-"
                          )}
                        </td>
                      ) : null}
                      <td>{user.is_deleted ? "deleted" : user.is_frozen ? "frozen" : "active"}</td>
                      <td>
                        {editingUserId === user.id ? (
                          <>
                            <button className="mini-btn" onClick={() => onSaveInlineUser(user.id)}>Save</button>
                            <button className="mini-btn" onClick={() => setEditingUserId(null)}>Cancel</button>
                          </>
                        ) : (
                          <button className="mini-btn" onClick={() => onStartInlineEdit(user)}>Edit</button>
                        )}
                        <button className="mini-btn" onClick={() => onToggleFreeze(user.id, user.is_frozen)}>{user.is_frozen ? "Unfreeze" : "Freeze"}</button>
                        <button className="mini-btn danger" onClick={() => onDeleteManagedUser(user.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            ) : null}
          </article>
        </div>
      ) : null}

      {isAdmin && tab === "students" ? (
        <div className="two-col">
          <article className="card">
            <h3>Add Student</h3>
            <form onSubmit={(e) => onCreateManagedUser(e, "student")} className="form-grid">
              <label>Full Name</label><input name="full_name" required />
              <label>Email</label><input name="email" type="email" required />
              <label>Phone</label><input name="phone" required />
              <button className="btn btn-gold" type="submit">Add</button>
            </form>
            <p>{actionStatus}</p>
          </article>
          <article className="card">
            <h3>Student List</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {students.map((user) => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>
                        {editingUserId === user.id ? (
                          <input className="inline-input" value={editingDraft.full_name} onChange={(e) => setEditingDraft((prev) => ({ ...prev, full_name: e.target.value }))} />
                        ) : user.full_name}
                      </td>
                      <td>
                        {editingUserId === user.id ? (
                          <input className="inline-input" value={editingDraft.email} onChange={(e) => setEditingDraft((prev) => ({ ...prev, email: e.target.value }))} />
                        ) : user.email}
                      </td>
                      <td>
                        {editingUserId === user.id ? (
                          <input className="inline-input" value={editingDraft.phone} onChange={(e) => setEditingDraft((prev) => ({ ...prev, phone: e.target.value }))} />
                        ) : user.phone}
                      </td>
                      <td>{user.is_deleted ? "deleted" : user.is_frozen ? "frozen" : "active"}</td>
                      <td>
                        {editingUserId === user.id ? (
                          <>
                            <button className="mini-btn" onClick={() => onSaveInlineUser(user.id)}>Save</button>
                            <button className="mini-btn" onClick={() => setEditingUserId(null)}>Cancel</button>
                          </>
                        ) : (
                          <button className="mini-btn" onClick={() => onStartInlineEdit(user)}>Edit</button>
                        )}
                        <button className="mini-btn" onClick={() => onToggleFreeze(user.id, user.is_frozen)}>{user.is_frozen ? "Unfreeze" : "Freeze"}</button>
                        <button className="mini-btn danger" onClick={() => onDeleteManagedUser(user.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      ) : null}

      {isAdmin && tab === "packages" ? (
        <div className="two-col">
          <article className="card">
            <h3>{editingPackageId ? "Edit Lesson Package" : "Add Lesson Package"}</h3>
            <form onSubmit={onSavePackage} className="form-grid">
              <label>Title</label>
              <input value={packageDraft.title} onChange={(e) => setPackageDraft((prev) => ({ ...prev, title: e.target.value }))} required />
              <label htmlFor="package-type">Type</label>
              <select id="package-type" value={packageDraft.package_type} onChange={e => setPackageDraft(prev => ({ ...prev, package_type: e.target.value as "manual" | "automatic" }))} required>
                <option value="manual">Manual</option><option value="automatic">Automatic</option>
              </select>
              <label htmlFor="package-hours">Hours</label>
              <input
                id="package-hours"
                type="number"
                min={0.01}
                max={10000}
                step="0.01"
                value={packageDraft.hours}
                onChange={(e) => setPackageDraft((prev) => ({ ...prev, hours: e.target.value }))}
                required
              />
              <label>Price (GBP)</label>
              <input
                type="number"
                min={1}
                step="0.01"
                value={packageDraft.price}
                onChange={(e) => setPackageDraft((prev) => ({ ...prev, price: e.target.value }))}
                required
              />
              <label>Description</label>
              <textarea rows={3} value={packageDraft.description} onChange={(e) => setPackageDraft((prev) => ({ ...prev, description: e.target.value }))} />
              <label>
                <input
                  type="checkbox"
                  checked={packageDraft.is_active}
                  onChange={(e) => setPackageDraft((prev) => ({ ...prev, is_active: e.target.checked }))}
                />{" "}
                Active
              </label>
              <div className="hero-actions">
                <button className="btn btn-gold" type="submit">{editingPackageId ? "Update Package" : "Create Package"}</button>
                {editingPackageId ? <button className="mini-btn" type="button" onClick={resetPackageDraft}>Cancel Edit</button> : null}
              </div>
            </form>
            <p>{actionStatus}</p>
          </article>
          <article className="card">
            <h3>Lesson Packages</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Title</th><th>Type</th><th>Hours</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {packages.map((item) => (
                    <tr key={item.id}>
                      <td>{item.title}</td>
                      <td>{item.package_type === "manual" ? "Manual" : "Automatic"}</td><td>{item.hours}</td>
                      <td>GBP {item.price}</td>
                      <td>{item.is_active ? "active" : "inactive"}</td>
                      <td>
                        <button className="mini-btn" onClick={() => onStartPackageEdit(item)}>Edit</button>
                        <button className="mini-btn" onClick={() => onTogglePackageActive(item)}>{item.is_active ? "Deactivate" : "Activate"}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      ) : null}

      {isStaff && tab === "invites" ? (
        <div className="two-col">
          <article className="card">
            <h3>Create Student Invite</h3>
            <form onSubmit={onCreateInvite} className="form-grid">
              <label>Email</label><input name="email" type="email" required />
              <label>Phone</label><input name="phone" />
              <label>Link to Instructor ID (optional)</label><input name="instructor_id" type="number" />
              <button className="btn btn-gold" type="submit">Send Invite</button>
            </form>
            <p>{actionStatus}</p>
          </article>
          <article className="card">
            <h3>Recent Invites</h3>
            <div className="table-wrap"><table><thead><tr><th>Email</th><th>Code</th><th>Status</th></tr></thead><tbody>{invites.map((item) => <tr key={item.id}><td>{item.email}</td><td>{item.code.slice(0, 12)}...</td><td>{item.status}</td></tr>)}</tbody></table></div>
          </article>
        </div>
      ) : null}

      {isStaff && tab === "notifications" ? (
        <div className="two-col">
          <article className="card">
            <h3>Create Notification</h3>
            <form onSubmit={onCreateNotification} className="form-grid">
              <label>Recipient</label><input name="recipient" required placeholder="student@example.com" />
              <label>Channel</label><select name="channel"><option value="email">Email</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option></select>
              <label>Category</label><input name="category" required placeholder="booking_confirmation" />
              <label>Message</label><textarea name="message" rows={4} required />
              <button className="btn btn-gold" type="submit">Queue Notification</button>
            </form>
            <p>{actionStatus}</p>
          </article>
          <article className="card">
            <h3>Notification Queue</h3>
            <div className="table-wrap"><table><thead><tr><th>Recipient</th><th>Channel</th><th>Status</th></tr></thead><tbody>{notifications.map((item) => <tr key={item.id}><td>{item.recipient}</td><td>{item.channel}</td><td>{item.status}{isAdmin && ["failed", "retrying"].includes(item.status) ? <button type="button" className="mini-btn" onClick={() => api.retryNotification(item.id).then(() => loadData()).catch((e) => setActionStatus(String(e)))}>Retry Email</button> : null}</td></tr>)}</tbody></table></div>
          </article>
        </div>
      ) : null}

      {isAdmin && tab === "cms" ? (
        <div className="two-col cms-layout">
          <CmsManager onSaved={loadData} group={contentGroup || "home"} />
          {["site"].includes(contentGroup || "home") && (<article className="card">
            <h3>Side Video (YouTube)</h3>
            <form onSubmit={onSaveVideoConfig} className="form-grid">
              <label>Video Title</label><input name="video_title" defaultValue={videoConfig.video_title || ""} placeholder="How Lessons Work" />
              <label>YouTube URL</label><input name="youtube_url" defaultValue={videoConfig.youtube_url || ""} placeholder="https://www.youtube.com/watch?v=..." />
              <button className="btn btn-gold" type="submit">Save Side Video</button>
            </form>
          </article>)}
          {["about","site"].includes(contentGroup || "home") && (<article className="card">
            <h3>About Social Links & Videos</h3>
            <form onSubmit={onSaveAboutMediaConfig} className="form-grid">
              <label>Facebook URL</label><input name="social_facebook_url" defaultValue={videoConfig.social_facebook_url || ""} placeholder="https://facebook.com/yourpage" />
              <label>Instagram URL</label><input name="social_instagram_url" defaultValue={videoConfig.social_instagram_url || ""} placeholder="https://instagram.com/yourpage" />
              <label>TikTok URL</label><input name="social_tiktok_url" defaultValue={videoConfig.social_tiktok_url || ""} placeholder="https://www.tiktok.com/@yourpage" />
              <label>YouTube Channel URL</label><input name="social_youtube_url" defaultValue={videoConfig.social_youtube_url || ""} placeholder="https://youtube.com/@yourchannel" />
              <label>Video Card 1 Title</label><input name="about_video_1_title" defaultValue={videoConfig.about_video_1_title || ""} placeholder="Instructor introduction" />
              <label>Video Card 1 Video URL</label><input name="about_video_1_url" defaultValue={videoConfig.about_video_1_url || ""} placeholder="https://www.youtube.com/watch?v=... or Instagram/TikTok URL" />
              <label>Video Card 2 Title</label><input name="about_video_2_title" defaultValue={videoConfig.about_video_2_title || ""} placeholder="Lesson walkthrough" />
              <label>Video Card 2 Video URL</label><input name="about_video_2_url" defaultValue={videoConfig.about_video_2_url || ""} placeholder="https://www.youtube.com/watch?v=... or Instagram/TikTok URL" />
              <label>Video Card 3 Title</label><input name="about_video_3_title" defaultValue={videoConfig.about_video_3_title || ""} placeholder="Student success story" />
              <label>Video Card 3 Video URL</label><input name="about_video_3_url" defaultValue={videoConfig.about_video_3_url || ""} placeholder="https://www.youtube.com/watch?v=... or Instagram/TikTok URL" />
              <button className="btn btn-gold" type="submit">Save About Media</button>
            </form>
          </article>)}
          {["contact","site"].includes(contentGroup || "home") && (<article className="card">
            <h3>Public Contact Details</h3>
            <form onSubmit={onSaveContactConfig} className="form-grid">
              <label>Phone</label><input name="phone" defaultValue={contactConfig.phone || ""} placeholder="07960 872 048" />
              <label>Phone Link</label><input name="phone_link" defaultValue={contactConfig.phone_link || ""} placeholder="tel:07960872048" />
              <label>Email</label><input name="email" defaultValue={contactConfig.email || ""} placeholder="info@example.com" />
              <label>Address</label><input name="address" defaultValue={contactConfig.address || ""} placeholder="Sheffield, UK" />
              <label>WhatsApp Number</label><input name="whatsapp" defaultValue={contactConfig.whatsapp || ""} placeholder="07960 872 048" />
              <label>WhatsApp Link</label><input name="whatsapp_link" defaultValue={contactConfig.whatsapp_link || ""} placeholder="https://wa.me/447960872048" />
              <label>Contact Note</label><textarea name="contact_note" rows={3} defaultValue={contactConfig.contact_note || ""} placeholder="Call, WhatsApp, or message us to find your next lesson slot." />
              <button className="btn btn-gold" type="submit">Save Contact Details</button>
            </form>
          </article>)}

          {["home"].includes(contentGroup || "home") && (<article className="card">
            <h3>Home Repeatable Cards</h3>
            <p>Manage list items used by landing page cards and process blocks.</p>
            {(
              [
                ["trust_badges", "Trust Badges"],
                ["highlights", "Why Choose Cards"],
                ["services", "Service Cards"],
                ["steps", "How It Works Steps"],
              ] as [RepeatableSection, string][]
            ).map(([section, label]) => (
              <div key={section} className="repeatable-box">
                <div className="collapse-head">
                  <h4>{label}</h4>
                  <button className="mini-btn" type="button" onClick={() => onAddRepeatable(section)}>Add Item</button>
                </div>
                {homeRepeatables[section].length === 0 ? <p>No items yet.</p> : null}
                {homeRepeatables[section].map((item, index) => (
                  <div key={`${section}-${index}`} className="repeatable-item">
                    <label>Title</label>
                    <input value={item.title || ""} onChange={(e) => onChangeRepeatable(section, index, "title", e.target.value)} />
                    <label>Text</label>
                    <textarea rows={2} value={item.text || ""} onChange={(e) => onChangeRepeatable(section, index, "text", e.target.value)} />
                    <label>Badge</label>
                    <input value={item.badge || ""} onChange={(e) => onChangeRepeatable(section, index, "badge", e.target.value)} />
                    <label>CTA Label</label>
                    <input value={item.cta_label || ""} onChange={(e) => onChangeRepeatable(section, index, "cta_label", e.target.value)} />
                    <label>CTA URL</label>
                    <input value={item.cta_url || ""} onChange={(e) => onChangeRepeatable(section, index, "cta_url", e.target.value)} />
                    <button className="mini-btn danger" type="button" onClick={() => onRemoveRepeatable(section, index)}>Remove</button>
                  </div>
                ))}
              </div>
            ))}
            <button className="btn btn-gold" type="button" onClick={onSaveHomeRepeatables}>Save Home Cards</button>
            <p>{actionStatus}</p>
          </article>)}
          {["reviews"].includes(contentGroup || "home") && (<article className="card">
            <div className="collapse-head">
              <h3>Reviews Testimonials</h3>
              <button className="mini-btn" type="button" onClick={onAddReviewTestimonial}>Add Testimonial</button>
            </div>
            <p>Manage public reviews with star ratings.</p>
            {reviewTestimonials.length === 0 ? <p>No testimonials yet.</p> : null}
            {reviewTestimonials.map((item, index) => (
              <div key={`review-${index}`} className="repeatable-item">
                <label>Author</label>
                <input value={item.author} onChange={(e) => onChangeReviewTestimonial(index, "author", e.target.value)} />
                <label>Rating</label>
                <select value={item.rating} onChange={(e) => onChangeReviewTestimonial(index, "rating", Number(e.target.value))}>
                  <option value={5}>★★★★★</option>
                  <option value={4}>★★★★☆</option>
                  <option value={3}>★★★☆☆</option>
                  <option value={2}>★★☆☆☆</option>
                  <option value={1}>★☆☆☆☆</option>
                </select>
                <label>Testimonial</label>
                <textarea rows={3} value={item.testimonial} onChange={(e) => onChangeReviewTestimonial(index, "testimonial", e.target.value)} />
                <button className="mini-btn danger" type="button" onClick={() => onRemoveReviewTestimonial(index)}>Remove</button>
              </div>
            ))}
            <button className="btn btn-gold" type="button" onClick={onSaveReviewTestimonials}>Save Testimonials</button>
            <p>{actionStatus}</p>
          </article>)}
          {["reviews"].includes(contentGroup || "home") && (<article className="card">
            <h3>Client Testimonial Submissions</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Author</th>
                    <th>Rating</th>
                    <th>Testimonial</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={5}>No client submissions yet.</td>
                    </tr>
                  ) : null}
                  {reviewSubmissions.map((item) => (
                    <tr key={`submission-${item.id}`}>
                      <td>{item.author}</td>
                      <td>{item.rating}</td>
                      <td>{item.testimonial}</td>
                      <td>{item.status}</td>
                      <td>
                        {item.status === "pending" ? (
                          <>
                            <button className="mini-btn" type="button" onClick={() => onModerateReviewSubmission(item.id, "approved")}>Approve</button>
                            <button className="mini-btn danger" type="button" onClick={() => onModerateReviewSubmission(item.id, "rejected")}>Reject</button>
                          </>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>{actionStatus}</p>
          </article>)}
        </div>
      ) : null}

      {isAdmin && tab === "seo" ? (
        <article className="card">
          <h3>SEO Settings</h3>
          <form onSubmit={onUpdateSeo} className="form-grid">
            <label>Page Slug</label><select name="slug">{pages.map((page) => <option key={page.id} value={page.slug}>{page.slug}</option>)}</select>
            <label>Meta Title</label><input name="meta_title" />
            <label>Meta Description</label><textarea name="meta_description" rows={3} />
            <label><input type="checkbox" name="is_published" /> Indexed/Published</label>
            <button className="btn btn-gold" type="submit">Save SEO</button>
          </form>
          <p>{actionStatus}</p>
        </article>
      ) : null}

      {isAdmin && tab === "config" ? (
        <div className="two-col">
          <article className="card">
            <h3>SMTP Configuration</h3>
            <form onSubmit={onSaveSmtp} className="form-grid">
              <label>Host</label><input name="host" defaultValue={smtpConfig.host || ""} />
              <label>Port</label><input name="port" defaultValue={smtpConfig.port || ""} />
              <label>Username</label><input name="username" defaultValue={smtpConfig.username || ""} />
              <label>Password</label><input name="password" type="password" defaultValue={smtpConfig.password} />
              <label>From Email</label><input name="from_email" defaultValue={smtpConfig.from_email || ""} />
              <label>Encryption</label><select name="encryption" defaultValue={smtpConfig.encryption || "tls"}><option value="tls">STARTTLS (usually port 587)</option><option value="ssl">TLS (usually port 465)</option></select>
              <button className="btn btn-gold" type="submit">Save SMTP</button>
            </form>
          </article>
          <article className="card">
            <h3>SMS Configuration</h3>
            <form onSubmit={onSaveSms} className="form-grid">
              <label>Provider</label><input name="provider" defaultValue={smsConfig.provider || ""} />
              <label>API Key</label><input name="api_key" defaultValue={smsConfig.api_key || ""} />
              <label>Sender ID</label><input name="sender_id" defaultValue={smsConfig.sender_id || ""} />
              <button className="btn btn-gold" type="submit">Save SMS</button>
            </form>
          </article>
          <article className="card">
            <h3>Admin Email Access</h3>
            <p>Control who receives booking alerts and assignment links.</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Admin</th>
                    <th>Email</th>
                    <th>Receive Booking Emails</th>
                    <th>Allow Email Assign</th>
                  </tr>
                </thead>
                <tbody>
                  {adminPreferences.map((pref) => (
                    <tr key={`admin-pref-${pref.user_id}`}>
                      <td>{pref.full_name}</td>
                      <td>{pref.email}</td>
                      <td>
                        <input
                          type="checkbox"
                          checked={pref.receive_booking_emails}
                          onChange={(e) => onUpdateAdminPreference(pref.user_id, "receive_booking_emails", e.target.checked)}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={pref.allow_email_assign}
                          onChange={(e) => onUpdateAdminPreference(pref.user_id, "allow_email_assign", e.target.checked)}
                        />
                      </td>
                    </tr>
                  ))}
                  {adminPreferences.length === 0 ? (
                    <tr>
                      <td colSpan={4}>No admin preferences found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>
          <article className="card">
            <h3>MySQL Database Connection</h3>
            <form onSubmit={onSaveDatabaseConfig} className="form-grid">
              <label>Host</label>
              <input value={dbConfig.host} onChange={(e) => setDbConfig((prev) => ({ ...prev, host: e.target.value }))} />
              <label>Port</label>
              <input value={dbConfig.port} onChange={(e) => setDbConfig((prev) => ({ ...prev, port: e.target.value }))} />
              <label>Username</label>
              <input value={dbConfig.username} onChange={(e) => setDbConfig((prev) => ({ ...prev, username: e.target.value }))} />
              <label>Password</label>
              <input type="password" value={dbConfig.password} onChange={(e) => setDbConfig((prev) => ({ ...prev, password: e.target.value }))} />
              <label>Database</label>
              <input value={dbConfig.database} onChange={(e) => setDbConfig((prev) => ({ ...prev, database: e.target.value }))} />
              <button className="btn btn-gold" type="submit">Save MySQL Connection</button>
            </form>
            <div className="hero-actions">
              <button className="mini-btn" onClick={onTestDatabaseConnection}>Test Connection</button>
              <button className="mini-btn danger" onClick={onMigrateToMySql}>Migrate All Data</button>
              <button className="mini-btn" onClick={onApplyMySqlAsDefault}>Apply As Active DB</button>
            </div>
          </article>
          <p>{actionStatus}</p>
        </div>
      ) : null}

      {role === "student" && progress ? (
        <>
          <div className="stat-grid">
            <StatCard title="Total Lessons" value={progress.total_lessons} />
            <StatCard title="Completed" value={progress.completed_lessons} />
            <StatCard title="Pending" value={progress.pending_lessons} />
            <StatCard title="Attended" value={progress.attended_lessons} />
            <StatCard title="Missed" value={progress.missed_lessons} />
          </div>
          <article className="card">
            <h3>My Bookings</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>ID</th><th>Instructor</th><th>Date</th><th>Status</th><th>Attendance</th><th>Progress</th><th>Payment</th><th>Pickup</th></tr></thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={`student-${b.id}`}>
                      <td>{b.id}</td>
                      <td>{b.instructor_name || b.instructor_id}</td>
                      <td>{new Date(b.start_time).toLocaleString()}</td>
                      <td>{b.status}</td>
                      <td>{b.attendance_status}</td>
                      <td>{b.progress_score != null ? `${b.progress_score}%` : "-"}</td>
                      <td>{b.payment_status}</td>
                      <td>{b.pickup_location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </>
      ) : null}
      </div>
      </div>
    </section>
  );
}
