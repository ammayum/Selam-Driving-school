import { CmsText } from "./useCmsPage";
import { CmsCopy } from "../../components/CmsCopy";
import { FormEvent, useState } from "react";

import { api } from "../../api/client";
import { Seo } from "../../components/Seo";
import { setSession } from "../../lib/session";

export function SignupPage() {
  const [status, setStatus] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
      const result = await api.signup({
        full_name: String(form.get("full_name")),
        username: String(form.get("username") || "") || undefined,
        password: String(form.get("password") || "") || undefined,
        email: String(form.get("email")),
        phone: String(form.get("phone")),
        invite_code: String(form.get("invite_code") || "") || undefined,
      });
      setSession("student", result.user_id, result.user_id);
      setStatus(`Signup complete. Username: ${result.username}`);
      formElement.reset();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Signup failed");
    }
  }

  return (
    <section className="section container">
      <Seo title="Student Signup | Selam Driving School" description="Create an optional student account to manage bookings and reminders." />
      <article className="card narrow">
        <CmsCopy slug="signup" title="Student Signup" body="Optional account for managing bookings and progress. You can still book as a guest." level={1} />
        <form onSubmit={onSubmit} className="form-grid">
          <label><CmsText id="copy_signup_full_name">Full Name</CmsText></label>
          <input name="full_name" required />
          <label><CmsText id="copy_signup_email">Email</CmsText></label>
          <input name="email" type="email" required />
          <label><CmsText id="copy_signup_username_optional">Username (optional)</CmsText></label>
          <input name="username" placeholder="Choose username" />
          <label><CmsText id="copy_signup_password_optional">Password (optional)</CmsText></label>
          <input name="password" type="password" placeholder="Min 8 chars" />
          <label><CmsText id="copy_signup_phone">Phone</CmsText></label>
          <input name="phone" required />
          <label><CmsText id="copy_signup_invite_code_optional">Invite Code (optional)</CmsText></label>
          <input name="invite_code" placeholder="Paste invite code" />
          <button className="btn btn-gold" type="submit"><CmsText id="copy_signup_create_account">Create Account</CmsText></button>
        </form>
        <p>{status}</p>
      </article>
    </section>
  );
}
