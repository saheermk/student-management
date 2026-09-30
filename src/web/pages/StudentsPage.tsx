import React, { useState, useEffect } from 'react';
import { StudentDTO, ClassDTO } from '../../shared/types';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  UserIcon,
  PlusIcon,
  UploadIcon,
  SearchIcon,
  SpinnerIcon,
  CheckIcon,
  RefreshIcon,
  AcademicCapIcon,
} from '../components/Icons';
import { FloatingInput } from '../components/FloatingInput';
import { CsvImportModal } from '../components/CsvImportModal';

export const StudentsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';

  // Data states
  const [studentsList, setStudentsList] = useState<StudentDTO[]>([]);
  const [classesList, setClassesList] = useState<ClassDTO[]>([]);
  const [ownStudentProfile, setOwnStudentProfile] = useState<StudentDTO | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Filters
  const [selectedClassFilter, setSelectedClassFilter] = useState<number | ''>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showCsvModal, setShowCsvModal] = useState<boolean>(false);
  const [showPromoteModal, setShowPromoteModal] = useState<boolean>(false);
  const [editingStudent, setEditingStudent] = useState<StudentDTO | null>(null);

  // Add Student Form State
  const [addName, setAddName] = useState<string>('');
  const [addAdmissionNo, setAddAdmissionNo] = useState<string>('');
  const [addEmail, setAddEmail] = useState<string>('');
  const [addClassId, setAddClassId] = useState<number | ''>('');
  const [addPhone, setAddPhone] = useState<string>('');
  const [addPassword, setAddPassword] = useState<string>('');
  const [addLoading, setAddLoading] = useState<boolean>(false);
  const [createdTempPass, setCreatedTempPass] = useState<string>('');

  // Edit Student Form State
  const [editName, setEditName] = useState<string>('');
  const [editAdmissionNo, setEditAdmissionNo] = useState<string>('');
  const [editClassId, setEditClassId] = useState<number | ''>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [editLoading, setEditLoading] = useState<boolean>(false);

  // Promote Class Form State
  const [promoteSourceClassId, setPromoteSourceClassId] = useState<number | ''>('');
  const [promoteTargetClassId, setPromoteTargetClassId] = useState<number | ''>('');
  const [promoteLoading, setPromoteLoading] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      if (isStudent) {
        const ownRes = await api.getStudentMe();
        setOwnStudentProfile(ownRes.student);
      } else {
        const [studentRes, classRes] = await Promise.all([
          api.getStudents(selectedClassFilter ? Number(selectedClassFilter) : undefined),
          api.getClasses(),
        ]);
        setStudentsList(studentRes.students);
        setClassesList(classRes.classes);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load student data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedClassFilter]);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !addAdmissionNo.trim() || !addEmail.trim() || !addClassId) {
      setError('Please fill in all required fields');
      return;
    }

    setAddLoading(true);
    setError('');
    setSuccessMsg('');
    setCreatedTempPass('');

    try {
      const res = await api.createStudent({
        name: addName.trim(),
        admissionNo: addAdmissionNo.trim(),
        email: addEmail.trim(),
        classId: Number(addClassId),
        phone: addPhone.trim() || undefined,
        password: addPassword.trim() || undefined,
      });

      setSuccessMsg(`Student account created for ${res.student.name}`);
      if (res.temporaryPassword) {
        setCreatedTempPass(res.temporaryPassword);
      }

      // Reset form
      setAddName('');
      setAddAdmissionNo('');
      setAddEmail('');
      setAddClassId('');
      setAddPhone('');
      setAddPassword('');

      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create student');
    } finally {
      setAddLoading(false);
    }
  };

  const handleOpenEdit = (student: StudentDTO) => {
    setEditingStudent(student);
    setEditName(student.name);
    setEditAdmissionNo(student.admissionNo);
    setEditClassId(student.classId || '');
    setEditPhone(student.phone || '');
    setEditStatus(student.status);
    setError('');
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    setEditLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      await api.updateStudent(editingStudent.id, {
        name: editName.trim(),
        admissionNo: editAdmissionNo.trim(),
        classId: Number(editClassId),
        phone: editPhone.trim() || undefined,
        status: editStatus,
      });

      setSuccessMsg('Student record updated successfully');
      setEditingStudent(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update student');
    } finally {
      setEditLoading(false);
    }
  };

  const handlePromoteClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoteSourceClassId || !promoteTargetClassId) {
      setError('Please select both source and target classes');
      return;
    }

    setPromoteLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await api.promoteClass(Number(promoteSourceClassId), Number(promoteTargetClassId));
      setSuccessMsg(res.message);
      setShowPromoteModal(false);
      setPromoteSourceClassId('');
      setPromoteTargetClassId('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to promote class');
    } finally {
      setPromoteLoading(false);
    }
  };

  const filteredStudents = studentsList.filter((s) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      s.name.toLowerCase().includes(query) ||
      s.admissionNo.toLowerCase().includes(query) ||
      s.email.toLowerCase().includes(query) ||
      (s.className && s.className.toLowerCase().includes(query))
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <UserIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Student Directory</h1>
              <p className="text-slate-500 text-xs sm:text-sm">
                {isStudent
                  ? 'View your personal student enrollment details'
                  : isTeacher
                  ? 'Manage and view students in your assigned classes'
                  : 'Manage student records, CSV bulk imports, and yearly class promotions'}
              </p>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowPromoteModal(true)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition cursor-pointer"
            >
              <RefreshIcon className="w-4 h-4 text-slate-600" />
              <span>Class Promotion</span>
            </button>
            <button
              onClick={() => setShowCsvModal(true)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition cursor-pointer"
            >
              <UploadIcon className="w-4 h-4 text-slate-600" />
              <span>Import CSV</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center space-x-2 px-4.5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition cursor-pointer"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Add Student</span>
            </button>
          </div>
        )}
      </div>

      {/* Global Banners */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm font-medium flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700 text-xs underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-medium flex flex-col space-y-2">
          <div className="flex items-center space-x-2">
            <CheckIcon className="w-5 h-5 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          {createdTempPass && (
            <div className="mt-2 p-3 bg-white border border-emerald-300 rounded-lg text-xs font-mono text-slate-900">
              Temporary Password: <span className="font-bold text-indigo-600">{createdTempPass}</span> (Note it down; student must change on login)
            </div>
          )}
        </div>
      )}

      {/* Student View (Self Profile Card) */}
      {isStudent && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-xs max-w-2xl mx-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <SpinnerIcon className="w-8 h-8 text-indigo-600" />
            </div>
          ) : ownStudentProfile ? (
            <div className="space-y-6">
              <div className="flex items-center space-x-4 border-b border-slate-100 pb-6">
                <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
                  <UserIcon className="w-10 h-10" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{ownStudentProfile.name}</h2>
                  <p className="text-slate-500 text-xs font-medium">{ownStudentProfile.email}</p>
                  <span className="inline-block mt-2 px-2.5 py-0.5 text-[10px] uppercase font-bold rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {ownStudentProfile.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60">
                  <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Admission No</span>
                  <span className="font-bold text-slate-900 text-base">{ownStudentProfile.admissionNo}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60">
                  <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Assigned Class</span>
                  <span className="font-bold text-indigo-600 text-base">{ownStudentProfile.className || 'Unassigned'}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60">
                  <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Contact Phone</span>
                  <span className="font-semibold text-slate-800">{ownStudentProfile.phone || 'N/A'}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60">
                  <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Enrolled On</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(ownStudentProfile.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 text-sm">No student profile record found.</div>
          )}
        </div>
      )}

      {/* Admin / Teacher View (Student Directory Table & Search) */}
      {!isStudent && (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
          {/* Table Filters & Search Controls */}
          <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
            <div className="relative flex-1 max-w-md">
              <SearchIcon className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, admission no, or class..."
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition"
              />
            </div>

            <div className="flex items-center space-x-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Filter Class:</span>
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value ? Number(e.target.value) : '')}
                className="px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition font-medium text-slate-800"
              >
                <option value="">All Classes</option>
                {classesList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Directory Table */}
          {loading ? (
            <div className="flex justify-center items-center py-16 text-slate-500">
              <SpinnerIcon className="w-8 h-8 text-indigo-600" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <UserIcon className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className="font-semibold text-slate-800">No students found</p>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your search query or class filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Student</th>
                    <th className="px-6 py-4">Admission No</th>
                    <th className="px-6 py-4">Class</th>
                    <th className="px-6 py-4">Phone</th>
                    <th className="px-6 py-4">Status</th>
                    {isAdmin && <th className="px-6 py-4 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
                            <UserIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{s.name}</span>
                            <span className="text-xs text-slate-500">{s.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-700">{s.admissionNo}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          <AcademicCapIcon className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{s.className || 'Unassigned'}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-xs">{s.phone || '—'}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-md border ${
                            s.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleOpenEdit(s)}
                            className="px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                          >
                            Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ADD STUDENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900">Add New Student</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="space-y-4">
              <FloatingInput
                label="Full Name"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                required
              />
              <FloatingInput
                label="Admission Number"
                value={addAdmissionNo}
                onChange={(e) => setAddAdmissionNo(e.target.value)}
                required
              />
              <FloatingInput
                label="Email Address"
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                required
              />

              <div className="mt-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Assign Class *
                </label>
                <select
                  value={addClassId}
                  onChange={(e) => setAddClassId(e.target.value ? Number(e.target.value) : '')}
                  required
                  className="w-full px-3.5 py-3 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition"
                >
                  <option value="">Select a Class...</option>
                  {classesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <FloatingInput
                label="Phone Number (Optional)"
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
              />

              <FloatingInput
                label="Custom Password (Optional - leave blank for auto temp pass)"
                isPassword
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
              />

              <div className="pt-3 flex justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition disabled:opacity-60 cursor-pointer"
                >
                  {addLoading ? <SpinnerIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
                  <span>Create Student</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STUDENT MODAL */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900">Edit Student Record</h3>
              <button
                onClick={() => setEditingStudent(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleUpdateStudent} className="space-y-4">
              <FloatingInput
                label="Full Name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
              <FloatingInput
                label="Admission Number"
                value={editAdmissionNo}
                onChange={(e) => setEditAdmissionNo(e.target.value)}
                required
              />

              <div className="mt-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Class</label>
                <select
                  value={editClassId}
                  onChange={(e) => setEditClassId(e.target.value ? Number(e.target.value) : '')}
                  required
                  className="w-full px-3.5 py-3 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition"
                >
                  {classesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <FloatingInput
                label="Phone Number"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
              />

              <div className="mt-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'active' | 'inactive')}
                  className="w-full px-3.5 py-3 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition disabled:opacity-60 cursor-pointer"
                >
                  {editLoading ? <SpinnerIcon className="w-4 h-4" /> : <CheckIcon className="w-4 h-4" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLASS PROMOTION MODAL (FR-S4) */}
      {showPromoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900">Yearly Class Promotion</h3>
              <button
                onClick={() => setShowPromoteModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Promoting a class will move all active students from the source class to the selected target class (e.g. promoting Class 9A to Class 10A for the new academic year).
            </p>

            <form onSubmit={handlePromoteClass} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Source Class (Current) *
                </label>
                <select
                  value={promoteSourceClassId}
                  onChange={(e) => setPromoteSourceClassId(e.target.value ? Number(e.target.value) : '')}
                  required
                  className="w-full px-3.5 py-3 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition"
                >
                  <option value="">Select Source Class...</option>
                  {classesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Target Class (New Class) *
                </label>
                <select
                  value={promoteTargetClassId}
                  onChange={(e) => setPromoteTargetClassId(e.target.value ? Number(e.target.value) : '')}
                  required
                  className="w-full px-3.5 py-3 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition"
                >
                  <option value="">Select Target Class...</option>
                  {classesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPromoteModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={promoteLoading}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition disabled:opacity-60 cursor-pointer"
                >
                  {promoteLoading ? <SpinnerIcon className="w-4 h-4" /> : <RefreshIcon className="w-4 h-4" />}
                  <span>Promote Class</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV BULK IMPORT MODAL */}
      <CsvImportModal
        isOpen={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        onSuccess={() => {
          setShowCsvModal(false);
          loadData();
        }}
      />
    </div>
  );
};

export default StudentsPage;
