import { CmsText } from "./public/useCmsPage";
import { CmsCopy } from "../components/CmsCopy";
import { Seo } from "../components/Seo";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api/client";
import { getAccessToken, setSession } from "../lib/session";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"username" | "password">("username");
  const [status, setStatus] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [forgotPassword, setForgotPassword] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    async function checkExistingSession() {
      const accessToken = getAccessToken();
      if (!accessToken) {
        if (mounted) {
          setCheckingSession(false);
        }
        return;
      }
      try {
        const session = await api.checkSession();
        if (!mounted) return;
        setSession(session.role, session.student_id ?? undefined, session.user_id);
        navigate(session.must_change_password ? "/change-password" : "/portal", { replace: true });
      } catch {
        if (mounted) {
          setCheckingSession(false);
        }
      }
    }
    checkExistingSession();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  async function onCheckUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const result = await api.checkUsername(username.trim().toLowerCase());
      if (!result.exists) {
        setStatus("Username not found.");
        return;
      }
      setStatus(result.full_name ? `Welcome ${result.full_name}. Enter your password.` : "Enter your password to continue.");
      setStep("password");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Username check failed");
    }
  }

  async function onLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const result = await api.login(username.trim().toLowerCase(), password);
      setSession(
        result.role,
        result.student_id ?? undefined,
        result.user_id,
        result.access_token,
        result.refresh_token
      );
      navigate(result.must_change_password ? "/change-password" : "/portal");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Login failed");
    }
  }

  async function onForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const res = await api.requestPasswordReset(username.trim().toLowerCase());
      setStatus(res.message);
      setResetRequested(true);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Password reset request failed");
    }
  }

  async function onConfirmReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const res = await api.confirmPasswordReset(resetToken, forgotPassword);
      setStatus(res.message);
      setForgotMode(false);
      setResetRequested(false);
      setStep("password");
      setPassword("");
      setResetToken("");
      setForgotPassword("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Password reset failed");
    }
  }

  return (
    <section className="section container"><Seo title="Portal Login | Selam Driving School" description="Sign in to your account." />
      <article className="card narrow">
        <CmsCopy slug="login" title="Portal Login" level={1} />
        <p><CmsText id="copy_login_login_with_your_username_and_password">Login with your username and password.</CmsText></p>
        {checkingSession ? (
          <p><CmsText id="copy_login_checking_existing_session">Checking existing session...</CmsText></p>
        ) : null}
        {checkingSession ? null : (
          !forgotMode ? (
            step === "username" ? (
              <form onSubmit={onCheckUsername} className="form-grid">
                <label><CmsText id="copy_login_username">Username</CmsText></label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} required />
                <button className="btn btn-gold" type="submit"><CmsText id="copy_login_continue">Continue</CmsText></button>
              </form>
            ) : (
              <form onSubmit={onLogin} className="form-grid">
                <label><CmsText id="copy_login_username">Username</CmsText></label>
                <input value={username} disabled />
                <label><CmsText id="copy_login_password">Password</CmsText></label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button className="btn btn-gold" type="submit"><CmsText id="copy_login_login">Login</CmsText></button>
                <button className="mini-btn" type="button" onClick={() => setStep("username")}><CmsText id="copy_login_back">Back</CmsText></button>
                <button className="mini-btn" type="button" onClick={() => setForgotMode(true)}><CmsText id="copy_login_forgot_password">Forgot Password</CmsText></button>
              </form>
            )
          ) : (
            !resetRequested ? (
              <form onSubmit={onForgotPassword} className="form-grid">
                <label><CmsText id="copy_login_username">Username</CmsText></label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} required />
                <button className="btn btn-gold" type="submit"><CmsText id="copy_login_send_reset_token">Send Reset Token</CmsText></button>
                <button className="mini-btn" type="button" onClick={() => setForgotMode(false)}><CmsText id="copy_login_back_to_login">Back to Login</CmsText></button>
              </form>
            ) : (
              <form onSubmit={onConfirmReset} className="form-grid">
                <label><CmsText id="copy_login_reset_token_from_email">Reset Token (from email)</CmsText></label>
                <input value={resetToken} onChange={(e) => setResetToken(e.target.value)} required />
                <label><CmsText id="copy_login_new_password">New Password</CmsText></label>
                <input type="password" value={forgotPassword} onChange={(e) => setForgotPassword(e.target.value)} required minLength={12} />
                <button className="btn btn-gold" type="submit"><CmsText id="copy_login_confirm_reset">Confirm Reset</CmsText></button>
                <button className="mini-btn" type="button" onClick={() => setResetRequested(false)}><CmsText id="copy_login_resend_back">Resend / Back</CmsText></button>
              </form>
            )
          )
        )}
        <p>{status}</p>
      </article>
    </section>
  );
}
