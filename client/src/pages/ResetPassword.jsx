import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../services/api';
import AuthLayout, { ErrorBanner, SubmitButton, inputClass } from '../components/AuthLayout';

export default function ResetPassword() {
  const { token } = useParams();
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match');
    setLoading(true);
    try {
      await resetPassword(token, form);
      navigate('/', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose a new password for your account."
      footer={
        <Link to="/login" className="font-medium text-accent hover:underline">
          Back to log in
        </Link>
      }
    >
      <ErrorBanner message={error} />
      {error && /invalid or has expired/i.test(error) && (
        <p className="-mt-2 mb-4 text-sm text-slate-600">
          <Link to="/forgot-password" className="font-medium text-accent hover:underline">Request a new link</Link>
        </p>
      )}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">New password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" value={form.password} onChange={onChange} className={inputClass} placeholder="At least 6 characters" disabled={loading} />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-slate-700">Confirm new password</label>
          <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={onChange} className={inputClass} placeholder="Repeat your password" disabled={loading} />
        </div>
        <SubmitButton loading={loading} loadingText="Updating...">Reset password</SubmitButton>
      </form>
    </AuthLayout>
  );
}