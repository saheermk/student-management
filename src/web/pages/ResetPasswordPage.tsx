import React, { useState } from 'react';
import { api } from '../lib/api';
import { LockIcon, SpinnerIcon, ShieldIcon } from '../components/Icons';
import { FloatingInput } from '../components/FloatingInput';

interface ResetPasswordPageProps {
  token: string;
  onSuccess: () => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ token, onSuccess }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.resetPassword({ token, newPassword });
      setMessage(res.message);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
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
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Set New Password</h2>
        <p className="mt-1.5 text-sm text-slate-600">Choose a new password for your account</p>
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
              {message} Redirecting to login...
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <FloatingInput
              label="Enter your new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              icon={<LockIcon className="w-5 h-5" />}
              isPassword
              required
              autoComplete="new-password"
            />

            <FloatingInput
              label="Confirm your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              icon={<LockIcon className="w-5 h-5" />}
              isPassword
              required
              autoComplete="new-password"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition duration-200 shadow-md shadow-indigo-600/20 flex items-center justify-center space-x-2 text-sm disabled:opacity-50 mt-2"
            >
              {loading ? <SpinnerIcon className="w-5 h-5" /> : <span>Update Password</span>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
