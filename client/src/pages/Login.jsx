import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../services/api';
import AuthLayout, { ErrorBanner, SubmitButton, inputClass } from '../components/AuthLayout';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email.trim() || !form.password) return setError('Email and password are required');
    setLoading(true);
    try {
      await login(form.email.trim(), form.password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to continue your conversations."
      footer={
        <>
          New to ChatConnect?{' '}
          <Link to="/register" className="font-medium text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <ErrorBanner message={error} />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" value={form.email} onChange={onChange} className={inputClass} placeholder="you@example.com" disabled={loading} />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">Password</label>
            <Link to="/forgot-password" className="text-sm font-medium text-accent hover:underline">Forgot password?</Link>
          </div>
          <input id="password" name="password" type="password" autoComplete="current-password" value={form.password} onChange={onChange} className={inputClass} placeholder="Your password" disabled={loading} />
        </div>
        <SubmitButton loading={loading} loadingText="Logging in...">Log in</SubmitButton>
      </form>
    </AuthLayout>
  );
}