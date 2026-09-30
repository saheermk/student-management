import React, { useState, useEffect } from 'react';
import {
  LeaveRequestDTO,
  ClassDTO,
  StudentDTO,
} from '../../shared/types';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  CheckIcon,
  SpinnerIcon,
  PlusIcon,
  SearchIcon,
  CalendarIcon,
  UserIcon,
  AcademicCapIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  CloseIcon,
  AlertIcon,
} from '../components/Icons';

export const LeavesPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';

  const [leavesList, setLeavesList] = useState<LeaveRequestDTO[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState<boolean>(true);
  const [classesList, setClassesList] = useState<ClassDTO[]>([]);
  const [studentsInSelectedClass, setStudentsInSelectedClass] = useState<StudentDTO[]>([]);

  // Filter state
  const [selectedClassFilter, setSelectedClassFilter] = useState<number | ''>('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Student Request Modal State
  const [showRequestModal, setShowRequestModal] = useState<boolean>(false);
  const [requestForm, setRequestForm] = useState<{
    fromDate: string;
    toDate: string;
    reason: string;
  }>({
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: new Date().toISOString().slice(0, 10),
    reason: '',
  });
  const [requestingLoading, setRequestingLoading] = useState<boolean>(false);

  // Direct Entry Modal State (Teacher / Admin)
  const [showDirectModal, setShowDirectModal] = useState<boolean>(false);
  const [directForm, setDirectForm] = useState<{
    classId: number | '';
    studentId: number | '';
    fromDate: string;
    toDate: string;
    reason: string;
    decisionNote: string;
  }>({
    classId: '',
    studentId: '',
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: new Date().toISOString().slice(0, 10),
    reason: '',
    decisionNote: '',
  });
  const [directLoading, setDirectLoading] = useState<boolean>(false);

  // Review Modal State (Teacher / Admin)
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [reviewTarget, setReviewTarget] = useState<LeaveRequestDTO | null>(null);
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected'>('approved');
  const [decisionNote, setDecisionNote] = useState<string>('');
  const [reviewLoading, setReviewLoading] = useState<boolean>(false);

  // Error & Success Feedback
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // 1. Initial Data Fetching
  useEffect(() => {
    fetchInitialData();
  }, [user]);

  const fetchInitialData = async () => {
    setLoadingLeaves(true);
    setError('');
    try {
      if (isAdmin || isTeacher) {
        const classRes = await api.getClasses();
        setClassesList(classRes.classes || []);
      }
      await loadLeaves();
    } catch (err: any) {
      setError(err.message || 'Failed to load leaves data');
    } finally {
      setLoadingLeaves(false);
    }
  };

  const loadLeaves = async () => {
    try {
      if (isStudent) {
        const res = await api.getLeavesMe();
        setLeavesList(res.leaves || []);
      } else {
        const res = await api.getLeaves({
          classId: selectedClassFilter ? Number(selectedClassFilter) : undefined,
          status: selectedStatusFilter !== 'all' ? selectedStatusFilter : undefined,
        });
        setLeavesList(res.leaves || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch leaves');
    }
  };

  // Re-fetch when filters change (for teacher/admin)
  useEffect(() => {
    if (!isStudent) {
      loadLeaves();
    }
  }, [selectedClassFilter, selectedStatusFilter]);

  // Load students when class changes in Direct Modal
  useEffect(() => {
    if (directForm.classId) {
      api
        .getStudents(Number(directForm.classId))
        .then((res) => {
          setStudentsInSelectedClass(res.students.filter((s) => s.status === 'active'));
        })
        .catch(() => setStudentsInSelectedClass([]));
    } else {
      setStudentsInSelectedClass([]);
    }
  }, [directForm.classId]);

  // Handle Student Request Submit
  const handleStudentRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestForm.fromDate || !requestForm.toDate || !requestForm.reason.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setRequestingLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await api.requestLeave({
        fromDate: requestForm.fromDate,
        toDate: requestForm.toDate,
        reason: requestForm.reason.trim(),
      });
      setSuccessMsg(res.message || 'Leave request submitted successfully');
      setShowRequestModal(false);
      setRequestForm({
        fromDate: new Date().toISOString().slice(0, 10),
        toDate: new Date().toISOString().slice(0, 10),
        reason: '',
      });
      await loadLeaves();
    } catch (err: any) {
      setError(err.message || 'Failed to submit leave request');
    } finally {
      setRequestingLoading(false);
    }
  };

  // Handle Direct Leave Submit (Staff)
  const handleDirectLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directForm.studentId || !directForm.fromDate || !directForm.toDate || !directForm.reason.trim()) {
      setError('Please select a student and fill in all required dates and reason');
      return;
    }

    setDirectLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await api.createDirectLeave({
        studentId: Number(directForm.studentId),
        fromDate: directForm.fromDate,
        toDate: directForm.toDate,
        reason: directForm.reason.trim(),
        decisionNote: directForm.decisionNote.trim() || undefined,
      });
      setSuccessMsg(res.message || 'Direct leave created and approved');
      setShowDirectModal(false);
      setDirectForm({
        classId: '',
        studentId: '',
        fromDate: new Date().toISOString().slice(0, 10),
        toDate: new Date().toISOString().slice(0, 10),
        reason: '',
        decisionNote: '',
      });
      await loadLeaves();
    } catch (err: any) {
      setError(err.message || 'Failed to create direct leave');
    } finally {
      setDirectLoading(false);
    }
  };

  // Handle Review Submit (Approve / Reject)
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTarget) return;

    setReviewLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await api.reviewLeave(reviewTarget.id, {
        status: reviewAction,
        decisionNote: decisionNote.trim() || undefined,
      });
      setSuccessMsg(res.message || `Leave request ${reviewAction} successfully`);
      setShowReviewModal(false);
      setReviewTarget(null);
      setDecisionNote('');
      await loadLeaves();
    } catch (err: any) {
      setError(err.message || 'Failed to review leave request');
    } finally {
      setReviewLoading(false);
    }
  };

  // Filter leaves locally by search query
  const filteredLeaves = leavesList.filter((leave) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const nameMatch = leave.studentName?.toLowerCase().includes(query);
    const admMatch = leave.admissionNo?.toLowerCase().includes(query);
    const reasonMatch = leave.reason.toLowerCase().includes(query);
    return nameMatch || admMatch || reasonMatch;
  });

  const getStatusBadge = (status: 'pending' | 'approved' | 'rejected') => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <ClockIcon className="w-3.5 h-3.5 text-amber-500" />
            Pending
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircleIcon className="w-3.5 h-3.5 text-rose-500" />
            Rejected
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Leave Register</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isStudent
              ? 'Submit leave requests and check your approval status'
              : 'Manage student leave applications, staff direct entries, and approval workflows'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isStudent && (
            <button
              onClick={() => setShowRequestModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-sm shadow-indigo-200 active:scale-95"
            >
              <PlusIcon className="w-4 h-4" />
              Request Leave
            </button>
          )}

          {(isAdmin || isTeacher) && (
            <button
              onClick={() => setShowDirectModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-sm shadow-indigo-200 active:scale-95"
            >
              <PlusIcon className="w-4 h-4" />
              Direct Entry
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-start gap-3 animate-fadeIn">
          <AlertIcon className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-600">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm flex items-start gap-3 animate-fadeIn">
          <CheckIcon className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="flex-1">{successMsg}</div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-emerald-600">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters (Teacher / Admin) */}
      {!isStudent && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* Class Filter */}
          <div className="relative">
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value ? Number(e.target.value) : '')}
              className="peer w-full px-4 pt-5 pb-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            >
              <option value="">All Assigned Classes</option>
              {classesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label className="absolute left-4 top-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Class
            </label>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="peer w-full px-4 pt-5 pb-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <label className="absolute left-4 top-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Status Filter
            </label>
          </div>

          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search student or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="peer w-full pl-10 pr-4 pt-5 pb-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
            <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-4" />
            <label className="absolute left-10 top-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Search
            </label>
          </div>
        </div>
      )}

      {/* Main Leave Records Table / List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loadingLeaves ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
            <SpinnerIcon className="w-8 h-8 text-indigo-600" />
            <span className="text-sm font-medium">Loading leave records...</span>
          </div>
        ) : filteredLeaves.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <DocumentTextIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">No leave requests found</p>
            <p className="text-xs text-slate-400 mt-1">
              {isStudent
                ? 'You have not submitted any leave requests yet.'
                : 'No leave applications match the selected filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  {!isStudent && <th className="py-3.5 px-4">Student</th>}
                  <th className="py-3.5 px-4">Date Range</th>
                  <th className="py-3.5 px-4">Reason</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Requested By / On</th>
                  <th className="py-3.5 px-4">Review Notes</th>
                  {(!isStudent || leavesList.some((l) => l.status === 'pending')) && (
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredLeaves.map((leave) => (
                  <tr key={leave.id} className="hover:bg-slate-50/70 transition-colors">
                    {!isStudent && (
                      <td className="py-4 px-4 font-medium text-slate-900">
                        <div>{leave.studentName || 'Student'}</div>
                        <div className="text-xs text-slate-400">
                          {leave.admissionNo} • {leave.className}
                        </div>
                      </td>
                    )}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="font-medium text-slate-800">
                        {leave.fromDate} to {leave.toDate}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                        {leave.fromDate === leave.toDate
                          ? '1 Day'
                          : `${Math.round(
                              (new Date(leave.toDate).getTime() - new Date(leave.fromDate).getTime()) /
                                (1000 * 60 * 60 * 24)
                            ) + 1} Days`}
                      </div>
                    </td>
                    <td className="py-4 px-4 max-w-xs truncate" title={leave.reason}>
                      {leave.reason}
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">{getStatusBadge(leave.status)}</td>
                    <td className="py-4 px-4 text-xs text-slate-500 whitespace-nowrap">
                      <div>{leave.requestedByName || 'User'}</div>
                      <div className="text-slate-400">
                        {new Date(leave.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-600 max-w-xs">
                      {leave.decisionNote ? (
                        <div>
                          <span className="font-semibold text-slate-700">{leave.decidedByName || 'Reviewer'}:</span>{' '}
                          {leave.decisionNote}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No notes</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right whitespace-nowrap">
                      {(isAdmin || isTeacher) && leave.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setReviewTarget(leave);
                              setReviewAction('approved');
                              setDecisionNote('');
                              setShowReviewModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 transition-colors"
                          >
                            <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setReviewTarget(leave);
                              setReviewAction('rejected');
                              setDecisionNote('');
                              setShowReviewModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-200 transition-colors"
                          >
                            <CloseIcon className="w-3.5 h-3.5 text-rose-600" />
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Student Request Leave Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <h3 className="text-lg font-bold text-slate-800">Submit Leave Request</h3>
              <button
                onClick={() => setShowRequestModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStudentRequestSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={requestForm.fromDate}
                    onChange={(e) => setRequestForm({ ...requestForm, fromDate: e.target.value })}
                    className="peer w-full px-4 pt-5 pb-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  />
                  <label className="absolute left-4 top-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    From Date *
                  </label>
                </div>

                <div className="relative">
                  <input
                    type="date"
                    required
                    value={requestForm.toDate}
                    onChange={(e) => setRequestForm({ ...requestForm, toDate: e.target.value })}
                    className="peer w-full px-4 pt-5 pb-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  />
                  <label className="absolute left-4 top-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    To Date *
                  </label>
                </div>
              </div>

              <div className="relative">
                <textarea
                  required
                  rows={3}
                  placeholder="Explain reason for leave..."
                  value={requestForm.reason}
                  onChange={(e) => setRequestForm({ ...requestForm, reason: e.target.value })}
                  className="peer w-full px-4 pt-6 pb-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
                <label className="absolute left-4 top-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Reason *
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={requestingLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm shadow-indigo-200 active:scale-95 disabled:opacity-50"
                >
                  {requestingLoading ? <SpinnerIcon className="w-4 h-4" /> : <CheckIcon className="w-4 h-4" />}
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Direct Leave Entry Modal */}
      {showDirectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <h3 className="text-lg font-bold text-slate-800">Direct Leave Entry</h3>
              <button
                onClick={() => setShowDirectModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDirectLeaveSubmit} className="space-y-4">
              {/* Select Class */}
              <div className="relative">
                <select
                  required
                  value={directForm.classId}
                  onChange={(e) => setDirectForm({ ...directForm, classId: e.target.value ? Number(e.target.value) : '', studentId: '' })}
                  className="peer w-full px-4 pt-5 pb-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                >
                  <option value="">Select Class</option>
                  {classesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <label className="absolute left-4 top-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Class *
                </label>
              </div>

              {/* Select Student */}
              <div className="relative">
                <select
                  required
                  disabled={!directForm.classId}
                  value={directForm.studentId}
                  onChange={(e) => setDirectForm({ ...directForm, studentId: e.target.value ? Number(e.target.value) : '' })}
                  className="peer w-full px-4 pt-5 pb-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">Select Student</option>
                  {studentsInSelectedClass.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.admissionNo})
                    </option>
                  ))}
                </select>
                <label className="absolute left-4 top-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Student *
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={directForm.fromDate}
                    onChange={(e) => setDirectForm({ ...directForm, fromDate: e.target.value })}
                    className="peer w-full px-4 pt-5 pb-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  />
                  <label className="absolute left-4 top-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    From Date *
                  </label>
                </div>

                <div className="relative">
                  <input
                    type="date"
                    required
                    value={directForm.toDate}
                    onChange={(e) => setDirectForm({ ...directForm, toDate: e.target.value })}
                    className="peer w-full px-4 pt-5 pb-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  />
                  <label className="absolute left-4 top-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    To Date *
                  </label>
                </div>
              </div>

              <div className="relative">
                <textarea
                  required
                  rows={2}
                  placeholder="Reason for leave..."
                  value={directForm.reason}
                  onChange={(e) => setDirectForm({ ...directForm, reason: e.target.value })}
                  className="peer w-full px-4 pt-6 pb-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
                <label className="absolute left-4 top-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Reason *
                </label>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Optional decision/approval note"
                  value={directForm.decisionNote}
                  onChange={(e) => setDirectForm({ ...directForm, decisionNote: e.target.value })}
                  className="peer w-full px-4 pt-5 pb-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
                <label className="absolute left-4 top-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Approval Note
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDirectModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={directLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm shadow-indigo-200 active:scale-95 disabled:opacity-50"
                >
                  {directLoading ? <SpinnerIcon className="w-4 h-4" /> : <CheckIcon className="w-4 h-4" />}
                  Save & Approve
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Leave Modal */}
      {showReviewModal && reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <h3 className="text-lg font-bold text-slate-800">
                {reviewAction === 'approved' ? 'Approve Leave Request' : 'Reject Leave Request'}
              </h3>
              <button
                onClick={() => setShowReviewModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-slate-50 rounded-xl text-xs space-y-1 text-slate-600">
              <div>
                <span className="font-semibold text-slate-800">Student:</span> {reviewTarget.studentName} ({reviewTarget.admissionNo})
              </div>
              <div>
                <span className="font-semibold text-slate-800">Dates:</span> {reviewTarget.fromDate} to {reviewTarget.toDate}
              </div>
              <div>
                <span className="font-semibold text-slate-800">Reason:</span> {reviewTarget.reason}
              </div>
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div className="relative">
                <textarea
                  rows={2}
                  placeholder="Optional review note..."
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  className="peer w-full px-4 pt-6 pb-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
                <label className="absolute left-4 top-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Review Note
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewLoading}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50 ${
                    reviewAction === 'approved'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                      : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                  }`}
                >
                  {reviewLoading ? (
                    <SpinnerIcon className="w-4 h-4" />
                  ) : reviewAction === 'approved' ? (
                    <CheckIcon className="w-4 h-4" />
                  ) : (
                    <CloseIcon className="w-4 h-4" />
                  )}
                  {reviewAction === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
