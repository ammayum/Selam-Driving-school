import { Dispatch, SetStateAction } from "react";

import { AdminManagedUser, Booking, BookingStats, DashboardMetrics, Role } from "../../types";
import { StatCard } from "../../components/StatCard";

type BookingSortField = "start_time" | "status" | "attendance_status" | "payment_status" | "student_name" | "instructor_name";

type Props = {
  role: Role;
  metrics: DashboardMetrics;
  bookingStats: BookingStats | null;
  pagedBookings: Booking[];
  filteredCount: number;
  bookingPage: number;
  bookingTotalPages: number;
  setBookingPage: Dispatch<SetStateAction<number>>;
  bookingSearch: string;
  setBookingSearch: Dispatch<SetStateAction<string>>;
  bookingStatusFilter: "all" | "pending" | "approved" | "completed" | "cancelled";
  setBookingStatusFilter: Dispatch<SetStateAction<"all" | "pending" | "approved" | "completed" | "cancelled">>;
  bookingAttendanceFilter: "all" | "pending" | "attended" | "missed";
  setBookingAttendanceFilter: Dispatch<SetStateAction<"all" | "pending" | "attended" | "missed">>;
  bookingPaymentFilter: "all" | "not_requested" | "waiting" | "paid";
  setBookingPaymentFilter: Dispatch<SetStateAction<"all" | "not_requested" | "waiting" | "paid">>;
  bookingSortField: BookingSortField;
  setBookingSortField: Dispatch<SetStateAction<BookingSortField>>;
  bookingSortDirection: "asc" | "desc";
  setBookingSortDirection: Dispatch<SetStateAction<"asc" | "desc">>;
  bookingPageSize: number;
  setBookingPageSize: Dispatch<SetStateAction<number>>;
  rescheduleDrafts: Record<number, { start_time: string; end_time: string }>;
  setRescheduleDrafts: Dispatch<SetStateAction<Record<number, { start_time: string; end_time: string }>>>;
  lessonProgressDrafts: Record<number, { attendance_status: "pending" | "attended" | "missed"; progress_notes: string; progress_score: string }>;
  setLessonProgressDrafts: Dispatch<
    SetStateAction<Record<number, { attendance_status: "pending" | "attended" | "missed"; progress_notes: string; progress_score: string }>>
  >;
  assignmentDrafts: Record<number, string>;
  setAssignmentDrafts: Dispatch<SetStateAction<Record<number, string>>>;
  instructors: AdminManagedUser[];
  onRescheduleBooking: (bookingId: number) => Promise<void>;
  onSetBookingStatus: (bookingId: number, status: "approved" | "completed" | "cancelled") => Promise<void>;
  onRequestPayment: (bookingId: number) => Promise<void>;
  onSetPaymentStatus: (bookingId: number, paymentStatus: "not_requested" | "waiting" | "paid") => Promise<void>;
  onSaveLessonProgress: (bookingId: number) => Promise<void>;
  onAssignInstructor: (bookingId: number) => Promise<void>;
};

function formatPaymentMethod(value: Booking["payment_method"]): string {
  if (value === "advance_2_hours") return "Advance 2 hours";
  if (value === "pay_instructor_in_class") return "Pay instructor in class";
  return "-";
}

export function OverviewSection({
  role,
  metrics,
  bookingStats,
  pagedBookings,
  filteredCount,
  bookingPage,
  bookingTotalPages,
  setBookingPage,
  bookingSearch,
  setBookingSearch,
  bookingStatusFilter,
  setBookingStatusFilter,
  bookingAttendanceFilter,
  setBookingAttendanceFilter,
  bookingPaymentFilter,
  setBookingPaymentFilter,
  bookingSortField,
  setBookingSortField,
  bookingSortDirection,
  setBookingSortDirection,
  bookingPageSize,
  setBookingPageSize,
  rescheduleDrafts,
  setRescheduleDrafts,
  lessonProgressDrafts,
  setLessonProgressDrafts,
  assignmentDrafts,
  setAssignmentDrafts,
  instructors,
  onRescheduleBooking,
  onSetBookingStatus,
  onRequestPayment,
  onSetPaymentStatus,
  onSaveLessonProgress,
  onAssignInstructor,
}: Props) {
  return (
    <>
      <div className="stat-grid">
        <StatCard title="Students" value={metrics.total_students} />
        <StatCard title="Instructors" value={metrics.total_instructors} />
        <StatCard title="Bookings" value={metrics.total_bookings} />
        <StatCard title="Pending" value={metrics.pending_bookings} />
      </div>
      {bookingStats ? (
        <article className="card">
          <h3>Booking Statistics View</h3>
          <div className="stat-grid">
            <StatCard title="Total" value={bookingStats.total} />
            <StatCard title="Completion %" value={bookingStats.completion_rate} />
            <StatCard title="Avg Progress %" value={bookingStats.average_progress_score} />
          </div>
          <div className="three-col">
            <div>
              <h4>By Status</h4>
              {Object.entries(bookingStats.by_status).map(([k, v]) => <p key={k}>{k}: {v}</p>)}
            </div>
            <div>
              <h4>By Attendance</h4>
              {Object.entries(bookingStats.by_attendance).map(([k, v]) => <p key={k}>{k}: {v}</p>)}
            </div>
            <div>
              <h4>By Payment</h4>
              {Object.entries(bookingStats.by_payment).map(([k, v]) => <p key={k}>{k}: {v}</p>)}
            </div>
          </div>
        </article>
      ) : null}
      <article className="card">
        <h3>Booking Filters, Sorting & Pagination</h3>
        <div className="booking-toolbar">
          <input
            placeholder="Search by id, student, instructor, lesson..."
            value={bookingSearch}
            onChange={(e) => setBookingSearch(e.target.value)}
          />
          <select value={bookingStatusFilter} onChange={(e) => setBookingStatusFilter(e.target.value as typeof bookingStatusFilter)}>
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={bookingAttendanceFilter} onChange={(e) => setBookingAttendanceFilter(e.target.value as typeof bookingAttendanceFilter)}>
            <option value="all">All Attendance</option>
            <option value="pending">Pending</option>
            <option value="attended">Attended</option>
            <option value="missed">Missed</option>
          </select>
          <select value={bookingPaymentFilter} onChange={(e) => setBookingPaymentFilter(e.target.value as typeof bookingPaymentFilter)}>
            <option value="all">All Payment</option>
            <option value="not_requested">Not Requested</option>
            <option value="waiting">Waiting</option>
            <option value="paid">Paid</option>
          </select>
          <select value={bookingSortField} onChange={(e) => setBookingSortField(e.target.value as BookingSortField)}>
            <option value="start_time">Sort: Start Time</option>
            <option value="status">Sort: Status</option>
            <option value="attendance_status">Sort: Attendance</option>
            <option value="payment_status">Sort: Payment</option>
            <option value="student_name">Sort: Student</option>
            <option value="instructor_name">Sort: Instructor</option>
          </select>
          <select value={bookingSortDirection} onChange={(e) => setBookingSortDirection(e.target.value as "asc" | "desc")}>
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
          <select value={bookingPageSize} onChange={(e) => setBookingPageSize(Number(e.target.value))}>
            <option value={5}>5 / page</option>
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
          </select>
        </div>
        <div className="booking-pagination">
          <button className="mini-btn" onClick={() => setBookingPage((p) => Math.max(1, p - 1))} disabled={bookingPage <= 1}>Prev</button>
          <span>Page {bookingPage} of {bookingTotalPages} ({filteredCount} results)</span>
          <button className="mini-btn" onClick={() => setBookingPage((p) => Math.min(bookingTotalPages, p + 1))} disabled={bookingPage >= bookingTotalPages}>Next</button>
        </div>
      </article>
      <article className="card">
        <h3>Upcoming Bookings</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>Instructor</th><th>Package</th><th>Start</th><th>Status</th><th>Payment Way</th><th>Payment</th></tr>
            </thead>
            <tbody>
              {pagedBookings.map((b) => (
                <tr key={b.id}>
                  <td>{b.id}</td>
                  <td>{b.instructor_name || "Unassigned"}</td>
                  <td>{b.package_title || b.lesson_type}<small style={{ display: "block" }}>{b.package_price != null && b.package_hours != null ? `${b.package_hours} hours / ${b.package_currency} ${b.package_price.toFixed(2)} agreed` : "Original package terms not recorded"}</small></td>
                  <td>{new Date(b.start_time).toLocaleString()}</td>
                  <td><span className="pill">{b.status}</span></td>
                  <td><span className="pill">{formatPaymentMethod(b.payment_method)}</span></td>
                  <td><span className="pill">{b.payment_status}</span></td>
                </tr>
              ))}
              {pagedBookings.length === 0 ? (
                <tr><td colSpan={7}>No bookings found.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
      {role === "instructor" ? (
        <article className="card">
          <h3>Instructor Booking Actions</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Student</th><th>Package</th><th>Start</th><th>End</th><th>Status</th><th>Attendance</th><th>Progress</th><th>Payment</th><th>Reschedule</th><th>Action</th></tr></thead>
              <tbody>
                {pagedBookings.map((b) => (
                  <tr key={`manage-${b.id}`}>
                    <td>{b.id}</td>
                    <td>{b.student_name || b.guest_name || "-"}</td>
                    <td>{b.package_title || b.lesson_type}<small style={{ display: "block" }}>{b.package_price != null && b.package_hours != null ? `${b.package_hours} hours / ${b.package_currency} ${b.package_price.toFixed(2)} agreed` : "Original package terms not recorded"}</small></td>
                    <td>
                      <input
                        className="inline-input"
                        type="datetime-local"
                        value={rescheduleDrafts[b.id]?.start_time || ""}
                        onChange={(e) =>
                          setRescheduleDrafts((prev) => ({
                            ...prev,
                            [b.id]: { ...(prev[b.id] || { start_time: "", end_time: "" }), start_time: e.target.value },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="inline-input"
                        type="datetime-local"
                        value={rescheduleDrafts[b.id]?.end_time || ""}
                        onChange={(e) =>
                          setRescheduleDrafts((prev) => ({
                            ...prev,
                            [b.id]: { ...(prev[b.id] || { start_time: "", end_time: "" }), end_time: e.target.value },
                          }))
                        }
                      />
                    </td>
                    <td>{b.status}</td>
                    <td>
                      <select
                        className="inline-input"
                        value={lessonProgressDrafts[b.id]?.attendance_status || "pending"}
                        onChange={(e) =>
                          setLessonProgressDrafts((prev) => ({
                            ...prev,
                            [b.id]: {
                              ...(prev[b.id] || { attendance_status: "pending", progress_notes: "", progress_score: "" }),
                              attendance_status: e.target.value as "pending" | "attended" | "missed",
                            },
                          }))
                        }
                      >
                        <option value="pending">Pending</option>
                        <option value="attended">Attended</option>
                        <option value="missed">Missed</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="inline-input inline-compact"
                        placeholder="Score 0-100"
                        value={lessonProgressDrafts[b.id]?.progress_score || ""}
                        onChange={(e) =>
                          setLessonProgressDrafts((prev) => ({
                            ...prev,
                            [b.id]: {
                              ...(prev[b.id] || { attendance_status: "pending", progress_notes: "", progress_score: "" }),
                              progress_score: e.target.value,
                            },
                          }))
                        }
                      />
                      <textarea
                        className="inline-textarea"
                        rows={2}
                        value={lessonProgressDrafts[b.id]?.progress_notes || ""}
                        onChange={(e) =>
                          setLessonProgressDrafts((prev) => ({
                            ...prev,
                            [b.id]: {
                              ...(prev[b.id] || { attendance_status: "pending", progress_notes: "", progress_score: "" }),
                              progress_notes: e.target.value,
                            },
                          }))
                        }
                        placeholder="Progress notes"
                      />
                      <button className="mini-btn" onClick={() => onSaveLessonProgress(b.id)}>Save Progress</button>
                    </td>
                    <td>{b.payment_status}</td>
                    <td>
                      <button className="mini-btn" onClick={() => onRescheduleBooking(b.id)}>Reschedule</button>
                    </td>
                    <td>
                      <button className="mini-btn" onClick={() => onSetBookingStatus(b.id, "approved")}>Accept</button>
                      <button className="mini-btn" onClick={() => onSetBookingStatus(b.id, "completed")}>Complete</button>
                      <button className="mini-btn" onClick={() => onRequestPayment(b.id)}>Request Pay</button>
                      <button className="mini-btn" onClick={() => onSetPaymentStatus(b.id, "waiting")}>Waiting</button>
                      <button className="mini-btn" onClick={() => onSetPaymentStatus(b.id, "paid")}>Paid</button>
                      <button className="mini-btn danger" onClick={() => onSetBookingStatus(b.id, "cancelled")}>Cancel</button>
                    </td>
                  </tr>
                ))}
                {pagedBookings.length === 0 ? (
                  <tr><td colSpan={11}>No bookings found.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}
      {role === "admin" ? (
        <article className="card">
          <h3>Admin Assignment & Progress</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Student</th><th>Contact</th><th>Package</th><th>Payment Way</th><th>Assigned Instructor</th><th>Assign</th><th>Attendance</th><th>Progress Score</th><th>Progress Notes</th><th>Save</th></tr></thead>
              <tbody>
                {pagedBookings.map((b) => (
                  <tr key={`admin-progress-${b.id}`}>
                    <td>{b.id}</td>
                    <td>{b.student_name || b.guest_name || "-"}</td>
                    <td>{b.student_email || b.guest_email || "-"} / {b.student_phone || b.guest_phone || "-"}</td>
                    <td>{b.package_title || b.lesson_type}<small style={{ display: "block" }}>{b.package_price != null && b.package_hours != null ? `${b.package_hours} hours / ${b.package_currency} ${b.package_price.toFixed(2)} agreed` : "Original package terms not recorded"}</small></td>
                    <td>{formatPaymentMethod(b.payment_method)}</td>
                    <td>{b.instructor_name || "Unassigned"}</td>
                    <td>
                      <select
                        className="inline-input"
                        value={assignmentDrafts[b.id] || ""}
                        onChange={(e) => setAssignmentDrafts((prev) => ({ ...prev, [b.id]: e.target.value }))}
                      >
                        <option value="">Select instructor</option>
                        {instructors.map((item) => (
                          <option key={item.id} value={item.id}>{item.full_name}</option>
                        ))}
                      </select>
                      <button className="mini-btn" onClick={() => onAssignInstructor(b.id)}>Assign</button>
                    </td>
                    <td>
                      <select
                        className="inline-input"
                        value={lessonProgressDrafts[b.id]?.attendance_status || "pending"}
                        onChange={(e) =>
                          setLessonProgressDrafts((prev) => ({
                            ...prev,
                            [b.id]: {
                              ...(prev[b.id] || { attendance_status: "pending", progress_notes: "", progress_score: "" }),
                              attendance_status: e.target.value as "pending" | "attended" | "missed",
                            },
                          }))
                        }
                      >
                        <option value="pending">Pending</option>
                        <option value="attended">Attended</option>
                        <option value="missed">Missed</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="inline-input inline-compact"
                        value={lessonProgressDrafts[b.id]?.progress_score || ""}
                        onChange={(e) =>
                          setLessonProgressDrafts((prev) => ({
                            ...prev,
                            [b.id]: {
                              ...(prev[b.id] || { attendance_status: "pending", progress_notes: "", progress_score: "" }),
                              progress_score: e.target.value,
                            },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <textarea
                        className="inline-textarea"
                        rows={2}
                        value={lessonProgressDrafts[b.id]?.progress_notes || ""}
                        onChange={(e) =>
                          setLessonProgressDrafts((prev) => ({
                            ...prev,
                            [b.id]: {
                              ...(prev[b.id] || { attendance_status: "pending", progress_notes: "", progress_score: "" }),
                              progress_notes: e.target.value,
                            },
                          }))
                        }
                      />
                    </td>
                    <td><button className="mini-btn" onClick={() => onSaveLessonProgress(b.id)}>Save</button></td>
                  </tr>
                ))}
                {pagedBookings.length === 0 ? (
                  <tr><td colSpan={11}>No bookings found.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}
    </>
  );
}
