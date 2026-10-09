import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../services/api';
import AuthLayout, { ErrorBanner, SubmitButton, inputClass } from '../components/AuthLayout';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null); // server response once sent

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!EMAIL_RE.test(email.trim())) return setError('Please enter a valid email');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email: email.trim() });
      setDone(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Forgot password?"
      subtitle="Enter your email and we'll send you a link to reset it."
      footer={
        <Link to="/login" className="font-medium text-accent hover:underline">
          Back to log in
        </Link>
      }
    >
      {done ? (
        <div role="status" className="space-y-3 text-sm">
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-emerald-800">{done.message}</p>
          <p className="text-slate-500">The link is valid for 15 minutes. Check your spam folder if you don't see it.</p>
          {/* only present when the server runs with SHOW_RESET_LINK=true (local development) */}
          {done.resetLink && (
            <a href={done.resetLink} className="block break-all font-medium text-accent hover:underline">
              Dev mode: open reset link
            </a>
          )}
        </div>
      ) : (
        <>
          <ErrorBanner message={error} />
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@example.com"
                disabled={loading}
              />
            </div>
            <SubmitButton loading={loading} loadingText="Sending...">Send reset link</SubmitButton>
          </form>
        </>
      )}
    </AuthLayout>
  );
}