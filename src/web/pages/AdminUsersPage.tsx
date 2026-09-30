import React, { useState, useEffect } from 'react';
import { UserDTO } from '../../shared/types';
import { UserRole } from '../../shared/schemas';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  UserIcon,
  SearchIcon,
  PlusIcon,
  PowerIcon,
  KeyIcon,
  SpinnerIcon,
  CloseIcon,
  ShieldIcon,
  CheckIcon,
  MailIcon,
  LockIcon,
} from '../components/Icons';
import { FloatingInput } from '../components/FloatingInput';

export const AdminUsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [usersList, setUsersList] = useState<UserDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Create User Modal state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newEmail, setNewEmail] = useState<string>('');
  const [newRole, setNewRole] = useState<UserRole>('student');
  const [newPassword, setNewPassword] = useState<string>('');
  const [createMustChangePass, setCreateMustChangePass] = useState<boolean>(true);
  const [createLoading, setCreateLoading] = useState<boolean>(false);
  const [createdTempPass, setCreatedTempPass] = useState<string>('');

  // Reset Password Modal state
  const [resetModalUser, setResetModalUser] = useState<UserDTO | null>(null);
  const [tempPasswordInput, setTempPasswordInput] = useState<string>('');
  const [resetLoading, setResetLoading] = useState<boolean>(false);
  const [resetResultPass, setResetResultPass] = useState<string>('');

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getUsers();
      setUsersList(res.users);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreateLoading(true);
    setCreatedTempPass('');

    try {
      const res = await api.createUser({
        email: newEmail,
        role: newRole,
        password: newPassword || undefined,
        mustChangePassword: createMustChangePass,
      });

      if (res.temporaryPassword) {
        setCreatedTempPass(res.temporaryPassword);
      } else {
        setShowCreateModal(false);
        resetCreateForm();
      }

      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  const resetCreateForm = () => {
    setNewEmail('');
    setNewRole('student');
    setNewPassword('');
    setCreateMustChangePass(true);
    setCreatedTempPass('');
  };

  const handleToggleStatus = async (userToToggle: UserDTO) => {
    if (userToToggle.id === currentUser?.id) {
      alert('You cannot deactivate your own admin account.');
      return;
    }

    const actionText = userToToggle.isActive ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${actionText} user ${userToToggle.email}?`)) {
      return;
    }

    try {
      await api.updateUserStatus(userToToggle.id, !userToToggle.isActive);
      await loadUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to update user status');
    }
  };

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser) return;

    setResetLoading(true);
    setResetResultPass('');

    try {
      const res = await api.adminResetPassword(resetModalUser.id, tempPasswordInput || undefined);
      if (res.temporaryPassword) {
        setResetResultPass(res.temporaryPassword);
      }
      await loadUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to reset user password');
    } finally {
      setResetLoading(false);
    }
  };

  const filteredUsers = usersList.filter((u) => {
    const matchesSearch = u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-50 text-purple-700 border border-purple-200">
            Admin
          </span>
        );
      case 'teacher':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            Teacher
          </span>
        );
      case 'student':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Student
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <ShieldIcon className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">User Management</h1>
              <p className="text-sm text-slate-500">Manage user accounts, roles, and access permissions</p>
            </div>
          </div>

          <button
            onClick={() => {
              resetCreateForm();
              setShowCreateModal(true);
            }}
            className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition duration-200 shadow-md shadow-indigo-600/20"
          >
            <PlusIcon className="w-5 h-5" />
            <span>Create New User</span>
          </button>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-slate-200/80 p-4 rounded-xl shadow-sm">
          <div className="w-full sm:w-80">
            <FloatingInput
              label="Search by email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<SearchIcon className="w-4 h-4" />}
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <label className="text-xs text-slate-500 font-bold uppercase tracking-wider">Role:</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium transition"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="teacher">Teacher</option>
              <option value="student">Student</option>
            </select>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {/* Users Content */}
        {loading ? (
          <div className="flex justify-center items-center py-20 text-slate-400">
            <SpinnerIcon className="w-8 h-8 text-indigo-600" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-16 bg-white border border-slate-200/80 rounded-2xl text-slate-400 shadow-sm">
            <UserIcon className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
            <p className="text-lg font-semibold text-slate-700">No users found</p>
            <p className="text-sm text-slate-500">Try adjusting your search or role filter</p>
          </div>
        ) : (
          <>
            {/* Desktop & Tablet Table */}
            <div className="hidden sm:block overflow-hidden bg-white border border-slate-200/80 rounded-2xl shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-4 px-6">User</th>
                    <th className="py-4 px-6">Role</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6">Password Requirement</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-4 px-6 font-medium text-slate-900 flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold border border-slate-200 text-sm">
                          {u.email[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{u.email}</div>
                          <div className="text-xs text-slate-400">ID: {u.id}</div>
                        </div>
                      </td>
                      <td className="py-4 px-6">{getRoleBadge(u.role)}</td>
                      <td className="py-4 px-6">
                        {u.isActive ? (
                          <span className="inline-flex items-center space-x-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1.5 text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                            <span>Deactivated</span>
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-500">
                        {u.mustChangePassword ? (
                          <span className="text-amber-700 font-semibold bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">Must Change Password</span>
                        ) : (
                          <span className="text-slate-400 font-normal">Normal</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right space-x-2">
                        <button
                          onClick={() => {
                            setResetModalUser(u);
                            setTempPasswordInput('');
                            setResetResultPass('');
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition inline-flex items-center space-x-1 border border-slate-200"
                        >
                          <KeyIcon className="w-3.5 h-3.5" />
                          <span>Reset Pass</span>
                        </button>

                        <button
                          onClick={() => handleToggleStatus(u)}
                          disabled={u.id === currentUser?.id}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition inline-flex items-center space-x-1 border ${
                            u.isActive
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 disabled:opacity-40'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          <PowerIcon className="w-3.5 h-3.5" />
                          <span>{u.isActive ? 'Deactivate' : 'Activate'}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List (360px+ responsive) */}
            <div className="sm:hidden space-y-3">
              {filteredUsers.map((u) => (
                <div
                  key={u.id}
                  className="bg-white border border-slate-200/80 p-4 rounded-xl space-y-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold border border-slate-200 text-sm">
                        {u.email[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm break-all">{u.email}</div>
                        <div className="text-xs text-slate-400">ID: {u.id}</div>
                      </div>
                    </div>
                    {getRoleBadge(u.role)}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2.5 border-t border-slate-100">
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-500 font-medium">Status:</span>
                      {u.isActive ? (
                        <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Active</span>
                      ) : (
                        <span className="text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">Deactivated</span>
                      )}
                    </div>
                    {u.mustChangePassword && (
                      <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Change Pass Required</span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 pt-2.5 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setResetModalUser(u);
                        setTempPasswordInput('');
                        setResetResultPass('');
                      }}
                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold text-center flex items-center justify-center space-x-1"
                    >
                      <KeyIcon className="w-3.5 h-3.5" />
                      <span>Reset Pass</span>
                    </button>

                    <button
                      onClick={() => handleToggleStatus(u)}
                      disabled={u.id === currentUser?.id}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold text-center flex items-center justify-center space-x-1 border ${
                        u.isActive
                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 disabled:opacity-40'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      <PowerIcon className="w-3.5 h-3.5" />
                      <span>{u.isActive ? 'Deactivate' : 'Activate'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal: Create User */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 relative">
            <button
              onClick={() => {
                setShowCreateModal(false);
                resetCreateForm();
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <CloseIcon className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold text-slate-900 mb-4">Create New User</h2>

            {createdTempPass ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl space-y-2 text-sm">
                  <div className="flex items-center space-x-2 font-bold text-emerald-700">
                    <CheckIcon className="w-5 h-5" />
                    <span>User created successfully!</span>
                  </div>
                  <p>Provide the temporary password below to the user:</p>
                  <div className="p-3 bg-slate-50 font-mono text-lg text-indigo-700 rounded-lg select-all border border-slate-200 text-center tracking-widest font-bold">
                    {createdTempPass}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    resetCreateForm();
                  }}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateUser} className="space-y-4">
                <FloatingInput
                  label="Enter user email address"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  icon={<MailIcon className="w-5 h-5" />}
                  required
                />

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Select Role <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium transition"
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <FloatingInput
                  label="Initial temporary password (Optional)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  icon={<LockIcon className="w-5 h-5" />}
                  isPassword
                />

                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="mustChange"
                    checked={createMustChangePass}
                    onChange={(e) => setCreateMustChangePass(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="mustChange" className="text-sm font-medium text-slate-700">
                    Require user to change password on first login
                  </label>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      resetCreateForm();
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
                    {createLoading ? <SpinnerIcon className="w-4 h-4" /> : <span>Create User</span>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Admin Reset Password */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 relative">
            <button
              onClick={() => setResetModalUser(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <CloseIcon className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold text-slate-900 mb-1">Reset Password</h2>
            <p className="text-sm text-slate-500 mb-4">User: {resetModalUser.email}</p>

            {resetResultPass ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl space-y-2 text-sm">
                  <div className="flex items-center space-x-2 font-bold text-emerald-700">
                    <CheckIcon className="w-5 h-5" />
                    <span>Password Reset Successful!</span>
                  </div>
                  <p>Provide this temporary password to the user:</p>
                  <div className="p-3 bg-slate-50 font-mono text-lg text-indigo-700 rounded-lg select-all border border-slate-200 text-center tracking-widest font-bold">
                    {resetResultPass}
                  </div>
                </div>
                <button
                  onClick={() => setResetModalUser(null)}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleAdminResetPassword} className="space-y-4">
                <FloatingInput
                  label="New temporary password (Optional)"
                  value={tempPasswordInput}
                  onChange={(e) => setTempPasswordInput(e.target.value)}
                  icon={<LockIcon className="w-5 h-5" />}
                  isPassword
                />

                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setResetModalUser(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl flex items-center space-x-2 disabled:opacity-50 shadow-md shadow-indigo-600/20"
                  >
                    {resetLoading ? <SpinnerIcon className="w-4 h-4" /> : <span>Reset Password</span>}
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
