export type Role = "admin" | "instructor" | "student";
export type InstructorType = "manual" | "automatic" | "both";

export type DashboardMetrics = {
  total_students: number;
  total_instructors: number;
  total_bookings: number;
  pending_bookings: number;
  upcoming_lessons: number;
};

export type BookingStats = {
  total: number;
  by_status: Record<string, number>;
  by_attendance: Record<string, number>;
  by_payment: Record<string, number>;
  completion_rate: number;
  average_progress_score: number;
};

export type ActivityLog = {
  id: number;
  actor_role: string;
  actor_id: number | null;
  actor_username: string | null;
  action: string;
  target_type: string;
  target_id: number | null;
  details: string | null;
  created_at: string;
};

export type User = {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  role: Role;
  profile_photo_url?: string | null;
  permit_number?: string | null;
  instructor_type?: InstructorType | null;
};

export type Booking = {
  id: number;
  student_id: number | null;
  instructor_id: number | null;
  package_id: number | null;
  package_title: string | null;
  package_price: number | null;
  package_hours: number | null;
  package_currency: string | null;
  lesson_type: string;
  start_time: string;
  end_time: string;
  pickup_location: string;
  status: string;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  notes: string | null;
  attendance_status: "pending" | "attended" | "missed";
  progress_notes: string | null;
  progress_score: number | null;
  payment_method: "advance_2_hours" | "pay_instructor_in_class" | null;
  payment_status: "not_requested" | "waiting" | "paid";
  payment_requested_at: string | null;
  created_at: string;
  student_name?: string | null;
  student_email?: string | null;
  student_phone?: string | null;
  instructor_name?: string | null;
  instructor_email?: string | null;
  instructor_phone?: string | null;
};

export type BookingPayload = {
  student_id?: number;
  instructor_id?: number;
  package_id?: number;
  package_title?: string;
  lesson_type: string;
  start_time: string;
  end_time: string;
  pickup_location: string;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  notes?: string;
  payment_method: "advance_2_hours" | "pay_instructor_in_class";
};

export type LessonPackage = {
  id: number;
  title: string;
  hours: number;
  package_type: "manual" | "automatic";
  price: number;
  description?: string;
  is_active: boolean;
};

export type CmsPage = {
  id: number;
  slug: string;
  title: string;
  body: string;
  meta_title?: string | null;
  meta_description?: string | null;
  is_published: boolean;
};

export type Availability = {
  instructor_id: number;
  date: string;
  slots: string[];
};

export type StudentProgress = {
  student_id: number;
  total_lessons: number;
  completed_lessons: number;
  pending_lessons: number;
  attended_lessons: number;
  missed_lessons: number;
};

export type Invite = {
  id: number;
  code: string;
  email: string;
  phone: string | null;
  role: string;
  instructor_id: number | null;
  created_by_id: number;
  status: string;
  expires_at: string;
};

export type InvitePayload = {
  email: string;
  phone?: string;
  role?: "student" | "instructor";
  instructor_id?: number;
  expires_in_days?: number;
};

export type Notification = {
  id: number;
  recipient: string;
  channel: string;
  message: string;
  category: string;
  status: string;
  created_at: string;
};

export type NotificationPayload = {
  recipient: string;
  channel: string;
  message: string;
  category: string;
};

export type SignupPayload = {
  full_name: string;
  username?: string;
  password?: string;
  email: string;
  phone: string;
  invite_code?: string;
};

export type SignupResponse = {
  user_id: number;
  username: string;
  role: string;
  email: string;
  linked_instructor_id: number | null;
};

export type LoginUsernameCheckResponse = {
  exists: boolean;
  full_name: string | null;
};

export type LoginResponse = {
  must_change_password: boolean;
  user_id: number;
  role: "admin" | "instructor" | "student";
  student_id: number | null;
  username: string;
  full_name: string;
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
};

export type AuthSession = {
  must_change_password: boolean;
  user_id: number;
  role: "admin" | "instructor" | "student";
  student_id: number | null;
  username: string;
  full_name: string;
};

export type CmsPageUpsertPayload = {
  title: string;
  body: string;
  meta_title?: string;
  meta_description?: string;
  is_published: boolean;
};

export type SeoUpdatePayload = {
  meta_title?: string;
  meta_description?: string;
  is_published?: boolean;
};

export type ConfigGroup = {
  group: "smtp" | "sms" | "cms_repeatables" | "media" | "contact";
  values: Record<string, string>;
};

export type PublicVideoSettings = {
  title: string;
  youtube_url: string;
};

export type PublicAboutVideoItem = {
  title: string;
  youtube_url: string;
};

export type PublicAboutMediaSettings = {
  facebook_url: string;
  instagram_url: string;
  tiktok_url: string;
  youtube_url: string;
  videos: PublicAboutVideoItem[];
};

export type PublicContactSettings = {
  phone: string;
  phone_link: string;
  email: string;
  address: string;
  whatsapp: string;
  whatsapp_link: string;
  contact_note: string;
};

export type HomeRepeatableItem = {
  title: string;
  text: string;
  badge?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
};

export type HomeRepeatables = {
  trust_badges: HomeRepeatableItem[];
  highlights: HomeRepeatableItem[];
  services: HomeRepeatableItem[];
  steps: HomeRepeatableItem[];
};

export type ReviewTestimonial = {
  author: string;
  testimonial: string;
  rating: number;
  photo_url?: string | null;
};

export type BlogPost = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover_image_url: string | null;
  image_alt: string | null;
  is_published: boolean | number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type BlogPostPayload = Pick<BlogPost, "slug" | "title" | "excerpt" | "body" | "cover_image_url" | "image_alt"> & {
  is_published: boolean;
};

export type ReviewTestimonialSubmission = {
  id: number;
  author: string;
  email: string | null;
  testimonial: string;
  rating: number;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  photo_url?: string | null;
};

export type DatabaseConnection = {
  host: string;
  port: number;
  username: string;
  database: string;
  has_password: boolean;
};

export type DatabaseTestResponse = {
  ok: boolean;
  message: string;
};

export type DatabaseMigrateResponse = {
  ok: boolean;
  tables: number;
  rows: number;
  target_host: string;
};

export type DatabaseApplyResponse = {
  ok: boolean;
  message: string;
};

export type AdminManagedUser = {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  role: "instructor" | "student" | "admin";
  profile_photo_url?: string | null;
  permit_number?: string | null;
  instructor_type?: InstructorType | null;
  is_frozen: boolean;
  is_deleted: boolean;
  created_at: string;
};

export type AdminPreference = {
  user_id: number;
  full_name: string;
  email: string;
  allow_email_assign: boolean;
  receive_booking_emails: boolean;
};

export type CreatedUser = AdminManagedUser & { username: string; temporary_password: string | null };
