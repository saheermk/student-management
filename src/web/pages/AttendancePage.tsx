import React, { useState, useEffect } from 'react';
import { ClassDTO, StudentDTO, AttendanceSummaryDTO, StudentAttendanceStatsDTO, AttendanceDTO } from '../../shared/types';
import { AttendanceStatus } from '../../shared/schemas';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  CheckIcon,
  SpinnerIcon,
  UserIcon,
  SearchIcon,
  CalendarIcon,
  AcademicCapIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from '../components/Icons';

export const AttendancePage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';

  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = new Date().toISOString().slice(0, 7);

  const [activeTab, setActiveTab] = useState<'mark' | 'summary'>('mark');

  // Common State
  const [classesList, setClassesList] = useState<ClassDTO[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | ''>('');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);

  // Mark Attendance State
  const [studentsInClass, setStudentsInClass] = useState<StudentDTO[]>([]);
  const [attendanceRecordsMap, setAttendanceRecordsMap] = useState<Record<number, AttendanceStatus>>({});
  const [markedByInfo, setMarkedByInfo] = useState<string>('');
  const [loadingMarkData, setLoadingMarkData] = useState<boolean>(false);
  const [saveLoading, setSaveLoading] = useState<boolean>(false);
  const [hasRestoredDraft, setHasRestoredDraft] = useState<boolean>(false);

  // Class Summary State
  const [classSummary, setClassSummary] = useState<AttendanceSummaryDTO | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false);

  // Student Self State
  const [studentSelfData, setStudentSelfData] = useState<{
    student: { id: number; name: string; admissionNo: string; className: string };
    stats: StudentAttendanceStatsDTO;
    logs: AttendanceDTO[];
  } | null>(null);
  const [loadingSelf, setLoadingSelf] = useState<boolean>(false);

  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // 1. Initial Load of Classes / Student Self Data
  useEffect(() => {
    if (isStudent) {
      loadStudentSelfData();
    } else {
      loadClasses();
    }
  }, [user]);

  const loadClasses = async () => {
    try {
      const res = await api.getClasses();
      setClassesList(res.classes);
      if (res.classes.length > 0) {
        setSelectedClassId(res.classes[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load classes');
    }
  };

  const loadStudentSelfData = async () => {
    setLoadingSelf(true);
    setError('');
    try {
      const res = await api.getAttendanceMe();
      setStudentSelfData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load attendance record');
    } finally {
      setLoadingSelf(false);
    }
  };

  // 2. Load Mark Attendance Data when selectedClassId or selectedDate changes
  useEffect(() => {
    if (!isStudent && selectedClassId && activeTab === 'mark') {
      loadMarkData();
    }
  }, [selectedClassId, selectedDate, activeTab]);

  const loadMarkData = async () => {
    if (!selectedClassId) return;
    setLoadingMarkData(true);
    setError('');
    setSuccessMsg('');
    setMarkedByInfo('');

    try {
      const [studentsRes, attendanceRes] = await Promise.all([
        api.getStudents(Number(selectedClassId)),
        api.getAttendance({ classId: Number(selectedClassId), date: selectedDate }),
      ]);

      const activeStus = studentsRes.students.filter((s) => s.status === 'active');
      setStudentsInClass(activeStus);

      const existingMap: Record<number, AttendanceStatus> = {};
      let lastMarkedBy = '';

      attendanceRes.attendance.forEach((att) => {
        existingMap[att.studentId] = att.status;
        if (att.markedByName) {
          lastMarkedBy = att.markedByName;
        }
      });

      // Default unrecorded active students to 'present'
      activeStus.forEach((s) => {
        if (!existingMap[s.id]) {
          existingMap[s.id] = 'present';
        }
      });

      // Check if an unsaved draft exists in localStorage for this class & date
      const draftKey = `attendance_draft_${selectedClassId}_${selectedDate}`;
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        try {
          const parsedDraft = JSON.parse(savedDraft);
          Object.assign(existingMap, parsedDraft);
          setHasRestoredDraft(true);
        } catch {
          localStorage.removeItem(draftKey);
          setHasRestoredDraft(false);
        }
      } else {
        setHasRestoredDraft(false);
      }

      setAttendanceRecordsMap(existingMap);
      if (lastMarkedBy) {
        setMarkedByInfo(lastMarkedBy);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load attendance sheet');
    } finally {
      setLoadingMarkData(false);
    }
  };

  // 3. Load Monthly Class Summary when selectedClassId or selectedMonth changes
  useEffect(() => {
    if (!isStudent && selectedClassId && activeTab === 'summary') {
      loadClassSummary();
    }
  }, [selectedClassId, selectedMonth, activeTab]);

  const loadClassSummary = async () => {
    if (!selectedClassId) return;
    setLoadingSummary(true);
    setError('');

    try {
      const res = await api.getClassAttendanceSummary(Number(selectedClassId), selectedMonth);
      setClassSummary(res.summary);
    } catch (err: any) {
      setError(err.message || 'Failed to load monthly summary');
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleStatusToggle = (studentId: number, status: AttendanceStatus) => {
    setAttendanceRecordsMap((prev) => {
      const updated = { ...prev, [studentId]: status };
      if (selectedClassId && selectedDate) {
        localStorage.setItem(`attendance_draft_${selectedClassId}_${selectedDate}`, JSON.stringify(updated));
      }
      return updated;
    });
  };

  const handleMarkAll = (status: AttendanceStatus) => {
    const updated: Record<number, AttendanceStatus> = {};
    studentsInClass.forEach((s) => {
      updated[s.id] = status;
    });
    setAttendanceRecordsMap(updated);
    if (selectedClassId && selectedDate) {
      localStorage.setItem(`attendance_draft_${selectedClassId}_${selectedDate}`, JSON.stringify(updated));
    }
  };

  const handleDiscardDraft = () => {
    if (selectedClassId && selectedDate) {
      localStorage.removeItem(`attendance_draft_${selectedClassId}_${selectedDate}`);
      setHasRestoredDraft(false);
      loadMarkData();
    }
  };

  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId || studentsInClass.length === 0) return;

    setSaveLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const recordsToSave = studentsInClass.map((s) => ({
        studentId: s.id,
        status: attendanceRecordsMap[s.id] || 'present',
      }));

      const res = await api.markAttendance({
        classId: Number(selectedClassId),
        date: selectedDate,
        records: recordsToSave,
      });

      if (selectedClassId && selectedDate) {
        localStorage.removeItem(`attendance_draft_${selectedClassId}_${selectedDate}`);
        setHasRestoredDraft(false);
      }

      setSuccessMsg(res.message);
      await loadMarkData();
    } catch (err: any) {
      setError(err.message || 'Failed to save attendance');
    } finally {
      setSaveLoading(false);
    }
  };


  const getStatusBadgeClass = (status: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'absent':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'late':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'leave':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <CheckCircleIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Attendance Register</h1>
            <p className="text-slate-500 text-xs sm:text-sm">
              {isStudent
                ? 'View your attendance record and percentage history'
                : 'Mark daily class attendance, edit past dates, and view monthly summary reports'}
            </p>
          </div>
        </div>

        {/* Admin / Teacher Sub-tabs */}
        {!isStudent && (
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 self-start md:self-auto">
            <button
              onClick={() => setActiveTab('mark')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                activeTab === 'mark'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mark Attendance
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                activeTab === 'summary'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly Summary
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
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-medium flex items-center space-x-2">
          <CheckIcon className="w-5 h-5 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {hasRestoredDraft && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm font-medium flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ClockIcon className="w-5 h-5 text-amber-600" />
            <span>Restored unsaved attendance draft for this class & date from your browser.</span>
          </div>
          <button
            onClick={handleDiscardDraft}
            className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold rounded-lg transition cursor-pointer"
          >
            Discard Draft
          </button>
        </div>
      )}


      {/* STUDENT SELF ATTENDANCE VIEW (FR-AT5) */}
      {isStudent && (
        <div className="space-y-6">
          {loadingSelf ? (
            <div className="flex justify-center py-16">
              <SpinnerIcon className="w-8 h-8 text-indigo-600" />
            </div>
          ) : studentSelfData ? (
            <>
              {/* Stat Cards Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="block text-xs font-semibold text-slate-400 uppercase">Attendance Rate</span>
                  <span
                    className={`text-2xl sm:text-3xl font-extrabold mt-1 block ${
                      studentSelfData.stats.percentage >= 75 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {studentSelfData.stats.percentage}%
                  </span>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="block text-xs font-semibold text-slate-400 uppercase">Present Days</span>
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 block">
                    {studentSelfData.stats.presentDays}
                  </span>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="block text-xs font-semibold text-slate-400 uppercase">Absent Days</span>
                  <span className="text-2xl sm:text-3xl font-extrabold text-rose-600 mt-1 block">
                    {studentSelfData.stats.absentDays}
                  </span>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="block text-xs font-semibold text-slate-400 uppercase">Late / Leave</span>
                  <span className="text-2xl sm:text-3xl font-extrabold text-indigo-600 mt-1 block">
                    {studentSelfData.stats.lateDays + studentSelfData.stats.leaveDays}
                  </span>
                </div>
              </div>

              {/* Attendance Log History */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">Attendance History</h3>
                {studentSelfData.logs.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">No attendance logs found yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Class</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {studentSelfData.logs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/80 transition">
                            <td className="px-4 py-3 font-medium text-slate-900">{log.date}</td>
                            <td className="px-4 py-3 text-slate-600">{log.className}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block px-2.5 py-0.5 text-xs font-bold uppercase rounded-md border ${getStatusBadgeClass(
                                  log.status
                                )}`}
                              >
                                {log.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ADMIN & TEACHER MARK ATTENDANCE VIEW (FR-AT1, FR-AT2) */}
      {!isStudent && activeTab === 'mark' && (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-6 space-y-6">
          {/* Controls Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Select Class</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 font-semibold text-slate-900"
              >
                {classesList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Attendance Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 font-semibold text-slate-900"
              />
            </div>

            <div className="flex items-end justify-end space-x-2">
              <button
                type="button"
                onClick={() => handleMarkAll('present')}
                className="px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition cursor-pointer"
              >
                All Present
              </button>
              <button
                type="button"
                onClick={() => handleMarkAll('absent')}
                className="px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition cursor-pointer"
              >
                All Absent
              </button>
            </div>
          </div>

          {markedByInfo && (
            <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-700 flex items-center justify-between">
              <span>
                Attendance for <span className="font-bold">{selectedDate}</span> was previously recorded by{' '}
                <span className="font-bold">{markedByInfo}</span>. Edits will be recorded in audit log.
              </span>
            </div>
          )}

          {/* Marking Sheet */}
          {loadingMarkData ? (
            <div className="flex justify-center py-16">
              <SpinnerIcon className="w-8 h-8 text-indigo-600" />
            </div>
          ) : studentsInClass.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              No active students found in the selected class.
            </div>
          ) : (
            <form onSubmit={handleSaveAttendance} className="space-y-6">
              <div className="divide-y divide-slate-100">
                {studentsInClass.map((s) => {
                  const currentStatus = attendanceRecordsMap[s.id] || 'present';

                  return (
                    <div
                      key={s.id}
                      className="py-3.5 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 rounded-xl transition"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
                          <UserIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 text-sm block">{s.name}</span>
                          <span className="text-xs text-slate-500 font-mono">Adm: {s.admissionNo}</span>
                        </div>
                      </div>

                      {/* 1-Tap Toggle Buttons */}
                      <div className="flex items-center space-x-1.5 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => handleStatusToggle(s.id, 'present')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer ${
                            currentStatus === 'present'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          Present
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusToggle(s.id, 'absent')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer ${
                            currentStatus === 'absent'
                              ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          Absent
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusToggle(s.id, 'late')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer ${
                            currentStatus === 'late'
                              ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          Late
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusToggle(s.id, 'leave')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer ${
                            currentStatus === 'leave'
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          Leave
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="inline-flex items-center space-x-2 px-6 py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition disabled:opacity-60 cursor-pointer"
                >
                  {saveLoading ? <SpinnerIcon className="w-5 h-5" /> : <CheckIcon className="w-5 h-5" />}
                  <span>Save Attendance</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ADMIN & TEACHER MONTHLY SUMMARY VIEW (FR-AT4) */}
      {!isStudent && activeTab === 'summary' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Select Class</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value ? Number(e.target.value) : '')}
                  className="px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 font-semibold text-slate-900"
                >
                  {classesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Month</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 font-semibold text-slate-900"
                />
              </div>
            </div>
          </div>

          {loadingSummary ? (
            <div className="flex justify-center py-16">
              <SpinnerIcon className="w-8 h-8 text-indigo-600" />
            </div>
          ) : classSummary ? (
            <>
              {/* Class Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="block text-xs font-semibold text-slate-400 uppercase">Class Overall Percentage</span>
                  <span className="text-3xl font-extrabold text-indigo-600 mt-1 block">
                    {classSummary.overallPercentage}%
                  </span>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="block text-xs font-semibold text-slate-400 uppercase">Total School Days Marked</span>
                  <span className="text-3xl font-extrabold text-slate-900 mt-1 block">
                    {classSummary.totalSchoolDays} Days
                  </span>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="block text-xs font-semibold text-slate-400 uppercase">Enrolled Students</span>
                  <span className="text-3xl font-extrabold text-slate-900 mt-1 block">
                    {classSummary.totalStudents} Students
                  </span>
                </div>
              </div>

              {/* Student Breakdown Table */}
              <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/60 font-bold text-slate-900 text-sm">
                  Student Monthly Attendance Breakdown
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="px-6 py-3.5">Student</th>
                        <th className="px-6 py-3.5">Admission No</th>
                        <th className="px-6 py-3.5">Present</th>
                        <th className="px-6 py-3.5">Absent</th>
                        <th className="px-6 py-3.5">Late</th>
                        <th className="px-6 py-3.5">Leave</th>
                        <th className="px-6 py-3.5 text-right">Percentage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {classSummary.students.map((s) => (
                        <tr key={s.studentId} className="hover:bg-slate-50/80 transition">
                          <td className="px-6 py-3.5 font-bold text-slate-900">{s.studentName}</td>
                          <td className="px-6 py-3.5 font-mono text-xs text-slate-600">{s.admissionNo}</td>
                          <td className="px-6 py-3.5 font-semibold text-emerald-700">{s.presentDays}</td>
                          <td className="px-6 py-3.5 font-semibold text-rose-700">{s.absentDays}</td>
                          <td className="px-6 py-3.5 text-slate-700">{s.lateDays}</td>
                          <td className="px-6 py-3.5 text-slate-700">{s.leaveDays}</td>
                          <td className="px-6 py-3.5 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <div className="w-20 bg-slate-100 h-2 rounded-full overflow-hidden hidden sm:block">
                                <div
                                  className={`h-full rounded-full ${
                                    s.percentage >= 75 ? 'bg-emerald-500' : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${s.percentage}%` }}
                                ></div>
                              </div>
                              <span
                                className={`font-bold text-xs ${
                                  s.percentage >= 75 ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                {s.percentage}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default AttendancePage;
