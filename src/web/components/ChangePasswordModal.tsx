import React, { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { LockIcon, SpinnerIcon, ShieldIcon } from './Icons';
import { FloatingInput } from './FloatingInput';

export const ChangePasswordModal: React.FC = () => {
  const { user, setUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!user || !user.mustChangePassword) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      await api.changePassword({ currentPassword, newPassword });
      setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : null));
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 sm:p-8">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-200">
            <ShieldIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Password Change Required</h2>
            <p className="text-sm text-slate-500">Please set a new password to continue</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <FloatingInput
            label="Current / Temporary password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            icon={<LockIcon className="w-5 h-5" />}
            isPassword
            required
          />

          <FloatingInput
            label="Enter your new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            icon={<LockIcon className="w-5 h-5" />}
            isPassword
            required
          />

          <FloatingInput
            label="Confirm your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            icon={<LockIcon className="w-5 h-5" />}
            isPassword
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition duration-200 flex items-center justify-center space-x-2 shadow-md shadow-indigo-600/20 disabled:opacity-50 text-sm mt-2"
          >
            {loading ? <SpinnerIcon className="w-5 h-5" /> : <span>Update Password</span>}
          </button>
        </form>
      </div>
    </div>
  );
};
