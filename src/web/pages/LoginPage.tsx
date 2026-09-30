import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useInstitution } from '../context/InstitutionContext';
import { MailIcon, LockIcon, SpinnerIcon, ShieldIcon } from '../components/Icons';
import { FloatingInput } from '../components/FloatingInput';

interface LoginPageProps {
  onNavigateForgotPassword: () => void;
  onSeedSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onNavigateForgotPassword,
  onSeedSuccess,
}) => {
  const { login } = useAuth();
  const { institutionName, logoUrl } = useInstitution();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedMessage, setSeedMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ email, password });
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSeed = async () => {
    setSeedLoading(true);
    setError('');
    setSeedMessage('');
    try {
      const res = await fetch('/api/seed/admin', { method: 'POST' });
      const data = (await res.json()) as any;
      if (res.ok) {
        setSeedMessage(`Admin seeded! Email: ${data.user.email} / Password: ${data.initialPassword}`);
        setEmail(data.user.email);
        setPassword(data.initialPassword);
        if (onSeedSuccess) onSeedSuccess();
      } else {
        setError(data.error || 'Seeding failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
    } finally {
      setSeedLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center p-3 bg-indigo-600/10 text-indigo-600 rounded-2xl mb-3 border border-indigo-200 w-16 h-16 overflow-hidden">
          {logoUrl ? (
            <img src={logoUrl} alt={institutionName} className="w-full h-full object-contain" />
          ) : (
            <ShieldIcon className="w-9 h-9" />
          )}
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">{institutionName}</h2>
        <p className="mt-1.5 text-sm text-slate-600">Sign in to your account</p>
      </div>


      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white border border-slate-200/80 shadow-xl rounded-2xl p-6 sm:p-8">
          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          {seedMessage && (
            <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-medium">
              {seedMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <FloatingInput
              label="Enter your email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<MailIcon className="w-5 h-5" />}
              required
              autoComplete="email"
            />

            <div>
              <FloatingInput
                label="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<LockIcon className="w-5 h-5" />}
                isPassword
                required
                autoComplete="current-password"
              />
              <div className="flex justify-end mt-1.5">
                <button
                  type="button"
                  onClick={onNavigateForgotPassword}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition duration-200 shadow-md shadow-indigo-600/20 flex items-center justify-center space-x-2 text-sm disabled:opacity-50 mt-2"
            >
              {loading ? <SpinnerIcon className="w-5 h-5" /> : <span>Sign In</span>}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={handleQuickSeed}
              disabled={seedLoading}
              className="text-xs text-slate-500 hover:text-indigo-600 transition underline font-medium flex items-center justify-center space-x-1 mx-auto"
            >
              {seedLoading ? <SpinnerIcon className="w-3.5 h-3.5" /> : <span>Seed Default Admin Account</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
