import React, { useState } from 'react';
import { api } from '../lib/api';
import { MailIcon, SpinnerIcon, ShieldIcon } from '../components/Icons';
import { FloatingInput } from '../components/FloatingInput';

interface ForgotPasswordPageProps {
  onBackToLogin: () => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onBackToLogin }) => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await api.forgotPassword({ email });
      setMessage(res.message);
    } catch (err: any) {
      setError(err.message || 'Failed to request password reset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center p-3.5 bg-indigo-600/10 text-indigo-600 rounded-2xl mb-3 border border-indigo-200">
          <ShieldIcon className="w-9 h-9" />
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Reset Password</h2>
        <p className="mt-1.5 text-sm text-slate-600">Enter your email to receive a password reset link</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white border border-slate-200/80 shadow-xl rounded-2xl p-6 sm:p-8">
          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-medium">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <FloatingInput
              label="Enter your registered email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<MailIcon className="w-5 h-5" />}
              required
              autoComplete="email"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition duration-200 shadow-md shadow-indigo-600/20 flex items-center justify-center space-x-2 text-sm disabled:opacity-50 mt-2"
            >
              {loading ? <SpinnerIcon className="w-5 h-5" /> : <span>Send Reset Link</span>}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={onBackToLogin}
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition"
            >
              ← Back to Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
