import { NavLink } from "react-router-dom";
import "./AdminNavigation.css";

export const adminPages = [
  ["overview", "Overview"], ["users", "User Management"],
  ["instructors", "Instructors"], ["students", "Students"],
  ["packages", "Packages"], ["invites", "Invites"],
  ["notifications", "Notifications"], ["cms", "Website Content"],
  ["seo", "SEO"], ["logs", "Audit Logs"], ["config", "Settings"],
] as const;

export function AdminNavigation() {
  return <nav className="admin-navigation" aria-label="Administration">
    <p className="eyebrow">Administration</p>
    {adminPages.map(([path, label]) => <NavLink key={path} to={`/admin/${path}`}>{label}</NavLink>)}
  </nav>;
}
