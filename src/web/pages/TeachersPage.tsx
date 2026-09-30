import React, { useState, useEffect } from 'react';
import { TeacherDTO } from '../../shared/types';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  UserIcon,
  PlusIcon,
  SpinnerIcon,
  CloseIcon,
  CheckIcon,
  MailIcon,
  LockIcon,
} from '../components/Icons';
import { FloatingInput } from '../components/FloatingInput';

export const TeachersPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [teachersList, setTeachersList] = useState<TeacherDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Create Teacher Modal
  const [showModal, setShowModal] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [createLoading, setCreateLoading] = useState<boolean>(false);
  const [createdTempPass, setCreatedTempPass] = useState<string>('');

  const loadTeachers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getTeachers();
      setTeachersList(res.teachers);
    } catch (err: any) {
      setError(err.message || 'Failed to load teachers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeachers();
  }, []);

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreateLoading(true);
    setCreatedTempPass('');

    try {
      const res = await api.createTeacher({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password: password || undefined,
      });

      if (res.temporaryPassword) {
        setCreatedTempPass(res.temporaryPassword);
      } else {
        setShowModal(false);
        resetForm();
      }

      await loadTeachers();
    } catch (err: any) {
      setError(err.message || 'Failed to create teacher');
    } finally {
      setCreateLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setCreatedTempPass('');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <UserIcon className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Teachers & Staff</h1>
              <p className="text-sm text-slate-500">Manage staff profiles and assigned classes</p>
            </div>
          </div>

          {isAdmin && (
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition duration-200 shadow-md shadow-indigo-600/20"
            >
              <PlusIcon className="w-5 h-5" />
              <span>Add New Teacher</span>
            </button>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {/* Teachers Content */}
        {loading ? (
          <div className="flex justify-center items-center py-20 text-slate-400">
            <SpinnerIcon className="w-8 h-8 text-indigo-600" />
          </div>
        ) : teachersList.length === 0 ? (
          <div className="text-center py-16 bg-white border border-slate-200/80 rounded-2xl text-slate-400 shadow-sm">
            <UserIcon className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
            <p className="text-lg font-semibold text-slate-700">No teachers found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teachersList.map((t) => (
              <div
                key={t.id}
                className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm space-y-3"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold border border-blue-200 text-base">
                    {t.name[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-base">{t.name}</div>
                    <div className="text-xs text-slate-500">{t.email}</div>
                  </div>
                </div>

                {t.phone && (
                  <div className="text-xs text-slate-600 flex items-center space-x-1">
                    <span className="font-semibold text-slate-500">Phone:</span>
                    <span>{t.phone}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 text-xs">
                  <div className="text-slate-500 font-semibold uppercase tracking-wider mb-1">
                    Assigned Classes:
                  </div>
                  {t.assignedClassNames && t.assignedClassNames.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {t.assignedClassNames.map((cName, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg font-semibold border border-indigo-200"
                        >
                          {cName}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">No classes assigned yet</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Create Teacher */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 relative">
            <button
              onClick={() => {
                setShowModal(false);
                resetForm();
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <CloseIcon className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold text-slate-900 mb-4">Add New Teacher</h2>

            {createdTempPass ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl space-y-2 text-sm">
                  <div className="flex items-center space-x-2 font-bold text-emerald-700">
                    <CheckIcon className="w-5 h-5" />
                    <span>Teacher created successfully!</span>
                  </div>
                  <p>Provide the temporary password below to the teacher:</p>
                  <div className="p-3 bg-slate-50 font-mono text-lg text-indigo-700 rounded-lg select-all border border-slate-200 text-center tracking-widest font-bold">
                    {createdTempPass}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateTeacher} className="space-y-4">
                <FloatingInput
                  label="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  icon={<UserIcon className="w-5 h-5" />}
                  required
                />

                <FloatingInput
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon={<MailIcon className="w-5 h-5" />}
                  required
                />

                <FloatingInput
                  label="Phone Number (Optional)"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />

                <FloatingInput
                  label="Initial Password (Optional)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={<LockIcon className="w-5 h-5" />}
                  isPassword
                />

                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl flex items-center space-x-2 disabled:opacity-50 shadow-md shadow-indigo-600/20"
                  >
                    {createLoading ? <SpinnerIcon className="w-4 h-4" /> : <span>Create Teacher</span>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
