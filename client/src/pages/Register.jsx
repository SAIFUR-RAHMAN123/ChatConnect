import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../services/api';
import AuthLayout, { ErrorBanner, SubmitButton, inputClass } from '../components/AuthLayout';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const validate = () => {
    if (!form.name.trim() || !form.email.trim() || !form.password || !form.confirmPassword) return 'All fields are required';
    if (!EMAIL_RE.test(form.email.trim())) return 'Please enter a valid email';
    if (form.password.length < 6) return 'Password must be at least 6 characters';
    if (form.password !== form.confirmPassword) return 'Passwords do not match';
    return '';
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const problem = validate();
    setError(problem);
    if (problem) return;
    setLoading(true);
    try {
      await register({ ...form, name: form.name.trim(), email: form.email.trim() });
      navigate('/', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { name: 'name', label: 'Name', type: 'text', autoComplete: 'name', placeholder: 'Your name' },
    { name: 'email', label: 'Email', type: 'email', autoComplete: 'email', placeholder: 'you@example.com' },
    { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password', placeholder: 'At least 6 characters' },
    { name: 'confirmPassword', label: 'Confirm password', type: 'password', autoComplete: 'new-password', placeholder: 'Repeat your password' },
  ];

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start chatting in a few seconds."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <ErrorBanner message={error} />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {fields.map((f) => (
          <div key={f.name}>
            <label htmlFor={f.name} className="mb-1.5 block text-sm font-medium text-slate-700">{f.label}</label>
            <input id={f.name} {...f} value={form[f.name]} onChange={onChange} className={inputClass} disabled={loading} />
          </div>
        ))}
        <SubmitButton loading={loading} loadingText="Creating account...">Register</SubmitButton>
      </form>
    </AuthLayout>
  );
}