import {
  Availability,
  AuthSession,
  AdminManagedUser,
  CreatedUser,
  ActivityLog,
  Booking,
  BookingStats,
  BookingPayload,
  CmsPageUpsertPayload,
  CmsPage,
  AdminPreference,
  ConfigGroup,
  DatabaseConnection,
  DatabaseApplyResponse,
  DatabaseMigrateResponse,
  DatabaseTestResponse,
  DashboardMetrics,
  HomeRepeatables,
  Invite,
  InvitePayload,
  LessonPackage,
  LoginResponse,
  LoginUsernameCheckResponse,
  Notification,
  NotificationPayload,
  PublicAboutMediaSettings,
  PublicContactSettings,
  PublicVideoSettings,
  ReviewTestimonial,
  BlogPost,
  BlogPostPayload,
  ReviewTestimonialSubmission,
  Role,
  SeoUpdatePayload,
  SignupPayload,
  SignupResponse,
  StudentProgress,
  User,
} from "../types";
import { clearSession, getAccessToken, getRefreshToken, setSession, setTokens } from "../lib/session";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

async function csrfHeaders(): Promise<Record<string, string>> {
  const response = await fetch(`${API_BASE}/auth/csrf`, { credentials: "same-origin" });
  if (!response.ok) throw new Error("Unable to initialize secure request");
  const data = await response.json();
  return { "X-CSRF-Token": data.csrf_token };
}

let refreshInFlight: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await csrfHeaders()) },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!response.ok) {
          clearSession();
          return false;
        }
        const payload = (await response.json()) as LoginResponse;
        setSession(
          payload.role,
          payload.student_id ?? undefined,
          payload.user_id,
          payload.access_token,
          payload.refresh_token
        );
        setTokens(payload.access_token, payload.refresh_token);
        return true;
      } catch {
        clearSession();
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

export function resolveApiUrl(url: string | null | undefined): string {
  if (!url) {
    return "";
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${API_BASE}${url.startsWith("/") ? url : `/${url}`}`;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = getAccessToken();
  const mergedHeaders: Record<string, string> = {
    ...((init?.method && init.method !== "GET") ? await csrfHeaders() : {}),
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (accessToken) {
    mergedHeaders.Authorization = `Bearer ${accessToken}`;
  }

  let response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: mergedHeaders,
  });

  if (response.status === 401 && accessToken) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      const retriedToken = getAccessToken();
      if (retriedToken) {
        mergedHeaders.Authorization = `Bearer ${retriedToken}`;
      }
      response = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: mergedHeaders,
      });
    }
  }

  if (!response.ok) {
    const text = await response.text();
    try {
      const parsed = JSON.parse(text) as { detail?: string };
      if(parsed.detail === "Change your temporary password before continuing" && window.location.pathname !== "/change-password") window.location.assign("/change-password");
      throw new Error(parsed.detail || text || "Request failed");
    } catch {
      throw new Error(text || "Request failed");
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function requestFormData<T>(path: string, formData: FormData, headers?: Record<string, string>): Promise<T> {
  const accessToken = getAccessToken();
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    body: formData,
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(headers ?? {}),
      ...(await csrfHeaders()),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    try {
      const parsed = JSON.parse(text) as { detail?: string };
      if(parsed.detail === "Change your temporary password before continuing" && window.location.pathname !== "/change-password") window.location.assign("/change-password");
      throw new Error(parsed.detail || text || "Request failed");
    } catch {
      throw new Error(text || "Request failed");
    }
  }
  return response.json() as Promise<T>;
}

export const api = {
  uploadPhoto: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return requestFormData<{ url: string }>("/media/upload-photo", formData);
  },
  signup: (payload: SignupPayload) => request<SignupResponse>("/auth/signup", { method: "POST", body: JSON.stringify(payload) }),
  checkUsername: (username: string) =>
    request<LoginUsernameCheckResponse>("/auth/check-username", { method: "POST", body: JSON.stringify({ username }) }),
  checkSession: () => request<AuthSession>("/auth/session"),
  login: (username: string, password: string) =>
    request<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  refresh: (refreshToken: string) =>
    request<LoginResponse>("/auth/refresh", { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) }),
  logout: (refreshToken: string) =>
    request<{ message: string }>("/auth/logout", { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) }),
  requestPasswordReset: (username: string) =>
    request<{ message: string }>("/auth/forgot-password/request", {
      method: "POST",
      body: JSON.stringify({ username }),
    }),
  confirmPasswordReset: (token: string, newPassword: string) =>
    request<{ message: string }>("/auth/forgot-password/confirm", {
      method: "POST",
      body: JSON.stringify({ token, new_password: newPassword }),
    }),
  listInstructors: () => request<User[]>("/users/instructors"),
  listPackages: () => request<LessonPackage[]>("/packages"),
  createPackage: (payload: { title: string; hours: number; package_type: "manual" | "automatic"; price: number; description?: string; is_active: boolean }) =>
    request<LessonPackage>("/packages", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updatePackage: (
    packageId: number,
    payload: { title: string; hours: number; package_type: "manual" | "automatic"; price: number; description?: string; is_active: boolean }
  ) =>
    request<LessonPackage>(`/packages/${packageId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  listCmsPages: () => request<CmsPage[]>("/cms/pages"),
  getCmsPage: (slug: string) => request<CmsPage>(`/cms/pages/${slug}`),
  upsertCmsPage: (slug: string, payload: CmsPageUpsertPayload) =>
    request<CmsPage>(`/cms/pages/${slug}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  updateSeo: (slug: string, payload: SeoUpdatePayload) =>
    request<CmsPage>(`/cms/pages/${slug}/seo`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  createBooking: (payload: BookingPayload) => request<Booking>("/bookings", { method: "POST", body: JSON.stringify(payload) }),
  getAvailability: (instructorId: number, day: string) =>
    request<Availability>(`/bookings/availability?instructor_id=${instructorId}&day=${day}`),
  getDashboard: (_role: Role) => request<DashboardMetrics>("/dashboard"),
  listBookings: (_role: Role) => request<Booking[]>("/bookings"),
  getBookingStats: (role: "admin" | "instructor", userId?: number) =>
    request<BookingStats>("/bookings/stats"),
  listMyBookings: (role: "instructor" | "student", userId: number) =>
    request<Booking[]>("/bookings/my"),
  updateBooking: (
    bookingId: number,
    role: "admin" | "instructor",
    payload: {
      instructor_id?: number;
      package_id?: number;
      package_title?: string;
      status?: string;
      start_time?: string;
      end_time?: string;
      notes?: string;
      attendance_status?: "pending" | "attended" | "missed";
      progress_notes?: string;
      progress_score?: number;
      payment_method?: "advance_2_hours" | "pay_instructor_in_class";
    },
    userId?: number
  ) =>
    request<Booking>(`/bookings/${bookingId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  requestBookingPayment: (bookingId: number, role: "admin" | "instructor", userId?: number) =>
    request<Booking>(`/bookings/${bookingId}/request-payment`, {
      method: "POST",
    }),
  updateBookingPaymentStatus: (
    bookingId: number,
    role: "admin" | "instructor",
    payment_status: "not_requested" | "waiting" | "paid",
    userId?: number
  ) =>
    request<Booking>(`/bookings/${bookingId}/payment`, {
      method: "PATCH",
      body: JSON.stringify({ payment_status }),
    }),
  acceptBookingByEmail: (bookingId: number, instructor_email: string) =>
    request<Booking>(`/bookings/${bookingId}/accept-by-email`, {
      method: "POST",
      body: JSON.stringify({ instructor_email }),
    }),
  getStudentProgress: (studentId: number, role: Role) =>
    request<StudentProgress>(`/students/${studentId}/progress`),
  listInvites: (role: Role) => request<Invite[]>("/invites"),
  createInvite: (payload: InvitePayload, role: Role, userId: number) =>
    request<Invite>(`/invites`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listNotifications: (role: Role) => request<Notification[]>("/notifications"),
  listActivityLogs: (role: "admin" | "instructor", userId?: number, limit = 200) =>
    request<ActivityLog[]>(`/activity-logs?limit=${limit}`),
  retryNotification: (id: number) => request<{ message: string }>(`/notifications/${id}/retry`, { method: "POST" }),
  createNotification: (payload: NotificationPayload, role: Role) =>
    request<Notification>("/notifications", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getConfigGroup: (group: "smtp" | "sms" | "cms_repeatables" | "media" | "contact") =>
    request<ConfigGroup>(`/admin/config/${group}`),
  updateConfigGroup: (group: "smtp" | "sms" | "cms_repeatables" | "media" | "contact", values: Record<string, string>) =>
    request<ConfigGroup>(`/admin/config/${group}`, {
      method: "PUT",
      body: JSON.stringify({ values }),
    }),
  getPublicVideoSettings: () => request<PublicVideoSettings>("/public/settings/video"),
  getPublicAboutMediaSettings: () => request<PublicAboutMediaSettings>("/public/settings/about-media"),
  getPublicContactSettings: () => request<PublicContactSettings>("/public/settings/contact"),
  getHomeRepeatables: () => request<HomeRepeatables>("/cms/pages/home/repeatables"),
  getReviewTestimonials: (minRating?: number) =>
    request<{ items: ReviewTestimonial[] }>(
      `/cms/pages/reviews/testimonials${typeof minRating === "number" ? `?min_rating=${minRating}` : ""}`
    ),
  updateReviewTestimonials: (items: ReviewTestimonial[]) =>
    request<{ items: ReviewTestimonial[] }>("/cms/pages/reviews/testimonials", {
      method: "PUT",
      body: JSON.stringify({ items }),
    }),
  submitReviewTestimonial: (payload: { author: string; email?: string; testimonial: string; rating: number; photo?: File; photo_consent?: boolean }) => {
    if (payload.photo) {
      const form = new FormData();
      form.set("author", payload.author);
      form.set("email", payload.email || "");
      form.set("testimonial", payload.testimonial);
      form.set("rating", String(payload.rating));
      form.set("photo", payload.photo);
      form.set("photo_consent", payload.photo_consent ? "1" : "0");
      return requestFormData<{ message: string; submission_id: number }>("/cms/pages/reviews/testimonials/submit", form);
    }
    return request<{ message: string; submission_id: number }>("/cms/pages/reviews/testimonials/submit", {
      method: "POST",
      body: JSON.stringify({ author: payload.author, email: payload.email, testimonial: payload.testimonial, rating: payload.rating }),
    });
  },
  listBlogPosts: (admin = false) => request<BlogPost[]>(`/blog/posts${admin ? "?admin=1" : ""}`),
  getBlogPost: (slug: string) => request<BlogPost>(`/blog/posts/${encodeURIComponent(slug)}`),
  saveBlogPost: (payload: BlogPostPayload, id?: number) => request<BlogPost>(id ? `/blog/posts/${id}` : "/blog/posts", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(payload),
  }),
  listReviewTestimonialSubmissions: (status?: "pending" | "approved" | "rejected") =>
    request<ReviewTestimonialSubmission[]>(
      `/cms/pages/reviews/testimonials/submissions${status ? `?status=${status}` : ""}`
    ),
  moderateReviewTestimonialSubmission: (submissionId: number, status: "approved" | "rejected") =>
    request<ReviewTestimonialSubmission>(`/cms/pages/reviews/testimonials/submissions/${submissionId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  getDatabaseConnection: () => request<DatabaseConnection>("/admin/database/connection"),
  saveDatabaseConnection: (payload: { host: string; port: number; username: string; password: string; database: string }) =>
    request<DatabaseConnection>("/admin/database/connection", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  testDatabaseConnection: () =>
    request<DatabaseTestResponse>("/admin/database/test", {
      method: "POST",
    }),
  migrateToMySql: () =>
    request<DatabaseMigrateResponse>("/admin/database/migrate", {
      method: "POST",
    }),
  applyMySqlAsDefault: () =>
    request<DatabaseApplyResponse>("/admin/database/apply", {
      method: "POST",
    }),
  listAdminUsers: (role: "instructor" | "student", includeDeleted = false) =>
    request<AdminManagedUser[]>(`/admin/users?role=${role}&include_deleted=${includeDeleted}`),
  listAdminPreferences: () => request<AdminPreference[]>("/admin/users/preferences"),
  updateAdminPreferences: (userId: number, payload: { allow_email_assign?: boolean; receive_booking_emails?: boolean }) =>
    request<AdminPreference>(`/admin/users/preferences/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  createAdminUser: (payload: {
    full_name: string;
    email: string;
    phone: string;
    role: "instructor" | "student";
    profile_photo_url?: string;
    permit_number?: string;
    instructor_type?: "manual" | "automatic" | "both";
  }) =>
    request<CreatedUser>("/admin/users", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateAdminUser: (
    userId: number,
    payload: {
      full_name?: string;
      email?: string;
      phone?: string;
      profile_photo_url?: string;
      permit_number?: string;
      instructor_type?: "manual" | "automatic" | "both";
    }
  ) =>
    request<AdminManagedUser>(`/admin/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  freezeAdminUser: (userId: number, isFrozen: boolean) =>
    request<AdminManagedUser>(`/admin/users/${userId}/freeze`, {
      method: "PATCH",
      body: JSON.stringify({ is_frozen: isFrozen }),
    }),
  deleteAdminUser: (userId: number) =>
    request<{ status: string }>(`/admin/users/${userId}`, {
      method: "DELETE",
    }),
  assignBookingByToken: (bookingId: number, token: string) =>
    request<Booking>(`/bookings/${bookingId}/assign-by-token`, { method: "POST", body: JSON.stringify({ token }) }),
};
