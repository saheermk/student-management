import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { ClassDTO, StudentDTO, ClassAnalyticsDTO, StudentAnalyticsDTO } from '../../shared/types';
import { PerformanceChart } from '../components/PerformanceChart';
import { SpinnerIcon, AcademicCapIcon, UserIcon, CheckCircleIcon, DocumentTextIcon, AlertIcon } from '../components/Icons';

export const AnalyticsPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Class selection state
  const [classesList, setClassesList] = useState<ClassDTO[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);

  // Student drill-down state (for Teachers & Admin)
  const [studentsList, setStudentsList] = useState<StudentDTO[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);

  // Analytics data states
  const [classAnalytics, setClassAnalytics] = useState<ClassAnalyticsDTO | null>(null);
  const [studentAnalytics, setStudentAnalytics] = useState<StudentAnalyticsDTO | null>(null);
  const [meStudent, setMeStudent] = useState<StudentDTO | null>(null);

  const role = user?.role;

  // Initial Data Load
  useEffect(() => {
    async function initData() {
      setLoading(true);
      setError('');
      try {
        if (role === 'admin' || role === 'teacher') {
          // Fetch accessible classes
          const res = await api.getClasses();
          setClassesList(res.classes);

          if (res.classes.length > 0) {
            const firstClassId = res.classes[0].id;
            setSelectedClassId(firstClassId);
            await fetchClassAnalytics(firstClassId);
            await fetchStudentsForClass(firstClassId);
          }
        } else if (role === 'student') {
          // Student role - fetch own analytics directly
          const data = await api.getStudentMeAnalytics();
          setStudentAnalytics(data);
          // Also fetch student profile details if needed
          const studentProfile = await api.getStudentMe();
          setMeStudent(studentProfile.student);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    }

    initData();
  }, [role]);

  // Fetch Class Analytics
  const fetchClassAnalytics = async (classId: number) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getClassAnalytics(classId);
      setClassAnalytics(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch class analytics');
      setClassAnalytics(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Students for Class drill-down
  const fetchStudentsForClass = async (classId: number) => {
    try {
      const res = await api.getStudents(classId);
      setStudentsList(res.students);
      setSelectedStudentId(null);
      setStudentAnalytics(null);
    } catch {
      setStudentsList([]);
    }
  };

  // Handle Class Selection Change
  const handleClassChange = async (classId: number) => {
    setSelectedClassId(classId);
    setSelectedStudentId(null);
    setStudentAnalytics(null);
    await fetchClassAnalytics(classId);
    await fetchStudentsForClass(classId);
  };

  // Handle Student Selection Change (Drill-down)
  const handleStudentChange = async (studentId: number | null) => {
    setSelectedStudentId(studentId);
    if (!studentId) {
      setStudentAnalytics(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await api.getStudentAnalytics(studentId);
      setStudentAnalytics(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch student analytics');
      setStudentAnalytics(null);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Role Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-[10px] uppercase font-extrabold rounded-md bg-indigo-100 text-indigo-700 border border-indigo-200">
              {role} View
            </span>
            <span className="text-xs text-slate-500 font-medium">Performance Dashboard</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-1">
            Performance Visualizations & Analytics
          </h1>
        </div>

        {/* Class & Student Selectors for Admin & Teacher */}
        {(role === 'admin' || role === 'teacher') && (
          <div className="flex flex-wrap items-center gap-3">
            {/* Class Selector */}
            <div className="flex items-center space-x-2">
              <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Class:</label>
              <select
                value={selectedClassId || ''}
                onChange={(e) => handleClassChange(Number(e.target.value))}
                className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
              >
                {classesList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Student Drill-Down Selector (Teacher & Admin) */}
            <div className="flex items-center space-x-2">
              <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Student Drill-Down:</label>
              <select
                value={selectedStudentId || ''}
                onChange={(e) => handleStudentChange(e.target.value ? Number(e.target.value) : null)}
                className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
              >
                <option value="">-- All Class Summary --</option>
                {studentsList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.admissionNo})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
          <AlertIcon className="w-5 h-5 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="min-h-64 flex justify-center items-center bg-white border border-slate-200 rounded-2xl">
          <SpinnerIcon className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      ) : (
        <>
          {/* STUDENT INDIVIDUAL PERFORMANCE VIEW */}
          {(selectedStudentId !== null || role === 'student') && studentAnalytics && (
            <div className="space-y-6">
              <div className="bg-indigo-900 text-white rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-md">
                    Individual Student Performance
                  </span>
                  <h2 className="text-lg font-bold">
                    {studentAnalytics.studentName} ({studentAnalytics.admissionNo})
                  </h2>
                  <p className="text-xs text-indigo-200">
                    Class: {studentAnalytics.className || meStudent?.className || 'Assigned Class'}
                  </p>
                </div>
                <div className="flex items-center space-x-4 bg-white/10 p-3 rounded-xl border border-white/10 text-xs">
                  <div>
                    <div className="text-[10px] uppercase text-indigo-200">Attendance Rate</div>
                    <div className="text-base font-extrabold text-emerald-400">
                      {studentAnalytics.attendanceSummary.attendanceRate}%
                    </div>
                  </div>
                  <div className="w-px h-8 bg-white/20" />
                  <div>
                    <div className="text-[10px] uppercase text-indigo-200 font-medium">Exams Logged</div>
                    <div className="text-base font-extrabold text-white">
                      {studentAnalytics.examPerformance.examHistory.length}
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts Grid for Student */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Chart 1: Attendance Distribution */}
                <PerformanceChart
                  title="Attendance Breakdown"
                  subtitle="Distribution of attendance records"
                  data={studentAnalytics.attendanceSummary.distribution}
                  xKey="name"
                  series={[{ key: 'value', name: 'Records', color: '#10b981' }]}
                  initialType="pie"
                  allowTypeSwitch={true}
                  valueFormatter={(v) => `${v} Days`}
                  pieColorKey="color"
                />

                {/* Chart 2: Exam Performance by Subject */}
                <PerformanceChart
                  title="Exam Marks by Subject"
                  subtitle="Average percentage per subject"
                  data={studentAnalytics.examPerformance.subjectScores}
                  xKey="subject"
                  series={[{ key: 'percentage', name: 'Percentage (%)', color: '#6366f1' }]}
                  initialType="bar"
                  allowTypeSwitch={true}
                  valueFormatter={(v) => `${v}%`}
                />

                {/* Chart 3: Exam Scores Timeline */}
                <PerformanceChart
                  title="Exam Progress Timeline"
                  subtitle="Average percentage trends across exams"
                  data={studentAnalytics.examPerformance.examHistory}
                  xKey="examName"
                  series={[{ key: 'avgPercentage', name: 'Total Score (%)', color: '#3b82f6' }]}
                  initialType="line"
                  allowTypeSwitch={true}
                  valueFormatter={(v) => `${v}%`}
                />

                {/* Chart 4: Grade Breakdown */}
                <PerformanceChart
                  title="Grade Distribution"
                  subtitle="Count of grades achieved across subjects"
                  data={studentAnalytics.examPerformance.gradeDistribution}
                  xKey="grade"
                  series={[{ key: 'count', name: 'Count', color: '#f59e0b' }]}
                  initialType="pie"
                  allowTypeSwitch={true}
                  valueFormatter={(v) => `${v} Marks`}
                  pieColorKey="color"
                />
              </div>
            </div>
          )}

          {/* CLASS SUMMARY VIEW (Admin & Teacher when no specific student selected) */}
          {selectedStudentId === null && role !== 'student' && classAnalytics && (
            <div className="space-y-6">
              <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-600 px-2.5 py-0.5 rounded-md text-white">
                    Class Summary Analytics
                  </span>
                  <h2 className="text-lg font-bold">{classAnalytics.className}</h2>
                  <p className="text-xs text-slate-400">Total Enrolled Students: {classAnalytics.studentCount}</p>
                </div>
                <div className="flex items-center space-x-4 bg-slate-800 p-3 rounded-xl border border-slate-700 text-xs">
                  <div>
                    <div className="text-[10px] uppercase text-slate-400">Class Attendance Rate</div>
                    <div className="text-base font-extrabold text-emerald-400">
                      {classAnalytics.attendanceSummary.attendanceRate}%
                    </div>
                  </div>
                  <div className="w-px h-8 bg-slate-700" />
                  <div>
                    <div className="text-[10px] uppercase text-slate-400">Total Attendance Logs</div>
                    <div className="text-base font-extrabold text-white">
                      {classAnalytics.attendanceSummary.totalRecords}
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts Grid for Class */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Chart 1: Attendance Distribution (Pie) */}
                <PerformanceChart
                  title="Class Attendance Breakdown"
                  subtitle="Distribution of present, absent, late & leave"
                  data={classAnalytics.attendanceSummary.distribution}
                  xKey="name"
                  series={[{ key: 'value', name: 'Students', color: '#10b981' }]}
                  initialType="pie"
                  allowTypeSwitch={true}
                  valueFormatter={(v) => `${v} Records`}
                  pieColorKey="color"
                />

                {/* Chart 2: Daily Attendance Trend (Line) */}
                <PerformanceChart
                  title="Daily Attendance Trend"
                  subtitle="Count of present vs absent vs late per date"
                  data={classAnalytics.attendanceSummary.dailyTrend}
                  xKey="date"
                  series={[
                    { key: 'present', name: 'Present', color: '#10b981' },
                    { key: 'absent', name: 'Absent', color: '#ef4444' },
                    { key: 'late', name: 'Late', color: '#f59e0b' },
                  ]}
                  initialType="line"
                  allowTypeSwitch={true}
                  valueFormatter={(v) => `${v}`}
                />

                {/* Chart 3: Subject Performance Averages (Bar) */}
                <PerformanceChart
                  title="Class Subject Performance Averages"
                  subtitle="Average percentage scored per subject"
                  data={classAnalytics.examPerformance.subjectAverages}
                  xKey="subject"
                  series={[{ key: 'percentage', name: 'Avg Percentage (%)', color: '#6366f1' }]}
                  initialType="bar"
                  allowTypeSwitch={true}
                  valueFormatter={(v) => `${v}%`}
                />

                {/* Chart 4: Class Grade Distribution (Pie) */}
                <PerformanceChart
                  title="Class Grade Distribution"
                  subtitle="Breakdown of letter grades across all exams"
                  data={classAnalytics.examPerformance.gradeDistribution}
                  xKey="grade"
                  series={[{ key: 'count', name: 'Count', color: '#3b82f6' }]}
                  initialType="pie"
                  allowTypeSwitch={true}
                  valueFormatter={(v) => `${v} Scores`}
                  pieColorKey="color"
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
