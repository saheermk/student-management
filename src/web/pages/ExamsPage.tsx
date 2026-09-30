import React, { useState, useEffect } from 'react';
import { ClassDTO, AcademicYearDTO, ProgressCardDTO } from '../../shared/types';
import { ExamType } from '../../shared/schemas';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { ProgressCardView } from '../components/ProgressCardView';
import {
  AcademicCapIcon,
  PlusIcon,
  SpinnerIcon,
  CheckIcon,
  UserIcon,
  SearchIcon,
  AdjustmentsHorizontalIcon,
} from '../components/Icons';

export const ExamsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';

  const [classesList, setClassesList] = useState<ClassDTO[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearDTO[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | ''>('');
  const [examsList, setExamsList] = useState<any[]>([]);
  const [loadingExams, setLoadingExams] = useState<boolean>(false);

  // Student Self State
  const [studentCard, setStudentCard] = useState<ProgressCardDTO | null>(null);
  const [loadingStudentCard, setLoadingStudentCard] = useState<boolean>(false);

  // Create Exam Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newExamData, setNewExamData] = useState<{
    classId: number | '';
    type: ExamType;
    name: string;
    examDate: string;
    academicYearId: number | '';
  }>({
    classId: '',
    type: 'monthly',
    name: '',
    examDate: new Date().toISOString().slice(0, 10),
    academicYearId: '',
  });
  const [createLoading, setCreateLoading] = useState<boolean>(false);

  // Marks Entry Grid State
  const [activeMarksExam, setActiveMarksExam] = useState<any | null>(null);
  const [marksGridData, setMarksGridData] = useState<{
    class: ClassDTO;
    subjects: any[];
    students: {
      studentId: number;
      studentName: string;
      admissionNo: string;
      marks: Record<number, { marks: number; maxMarks: number; remarks: string | null }>;
    }[];
  } | null>(null);
  const [loadingGrid, setLoadingGrid] = useState<boolean>(false);
  const [saveMarksLoading, setSaveMarksLoading] = useState<boolean>(false);

  // Grade Boundaries Modal State
  const [showBoundariesModal, setShowBoundariesModal] = useState<boolean>(false);
  const [boundariesList, setBoundariesList] = useState<any[]>([]);
  const [loadingBoundaries, setLoadingBoundaries] = useState<boolean>(false);
  const [saveBoundariesLoading, setSaveBoundariesLoading] = useState<boolean>(false);

  // View Student Progress Card Modal State
  const [viewCardModalStudentId, setViewCardModalStudentId] = useState<number | null>(null);
  const [selectedExamIdForCard, setSelectedExamIdForCard] = useState<number | undefined>(undefined);
  const [modalCardData, setModalCardData] = useState<ProgressCardDTO | null>(null);
  const [loadingModalCard, setLoadingModalCard] = useState<boolean>(false);

  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // 1. Initial Load
  useEffect(() => {
    if (isStudent) {
      loadStudentCard();
    } else {
      loadClassesAndYears();
    }
  }, [user]);

  const loadStudentCard = async (examId?: number) => {
    setLoadingStudentCard(true);
    setError('');
    try {
      const res = await api.getProgressCardMe(examId);
      setStudentCard(res.progressCard);
    } catch (err: any) {
      setError(err.message || 'Failed to load progress card');
    } finally {
      setLoadingStudentCard(false);
    }
  };

  const loadClassesAndYears = async () => {
    try {
      const [classesRes, yearsRes] = await Promise.all([api.getClasses(), api.getAcademicYears()]);
      setClassesList(classesRes.classes);
      setAcademicYears(yearsRes.academicYears);

      if (classesRes.classes.length > 0) {
        setSelectedClassId(classesRes.classes[0].id);
        setNewExamData((prev) => ({
          ...prev,
          classId: classesRes.classes[0].id,
          academicYearId: yearsRes.academicYears.find((y) => y.isCurrent)?.id || yearsRes.academicYears[0]?.id || '',
        }));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize academic data');
    }
  };

  // 2. Load Exams when selectedClassId changes
  useEffect(() => {
    if (!isStudent && selectedClassId) {
      loadExamsForClass(Number(selectedClassId));
    }
  }, [selectedClassId]);

  const loadExamsForClass = async (classId: number) => {
    setLoadingExams(true);
    setError('');
    try {
      const res = await api.getExams(classId);
      setExamsList(res.exams);
    } catch (err: any) {
      setError(err.message || 'Failed to load exams list');
    } finally {
      setLoadingExams(false);
    }
  };

  // 3. Create Exam Handler
  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamData.classId || !newExamData.academicYearId || !newExamData.name) {
      setError('Please fill in all required fields');
      return;
    }

    setCreateLoading(true);
    setError('');
    try {
      await api.createExam({
        classId: Number(newExamData.classId),
        academicYearId: Number(newExamData.academicYearId),
        type: newExamData.type,
        name: newExamData.name,
        examDate: newExamData.examDate,
      });

      setSuccessMsg('Exam created successfully');
      setShowCreateModal(false);
      setNewExamData({
        classId: selectedClassId,
        type: 'monthly',
        name: '',
        examDate: new Date().toISOString().slice(0, 10),
        academicYearId: newExamData.academicYearId,
      });
      if (selectedClassId) {
        await loadExamsForClass(Number(selectedClassId));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create exam');
    } finally {
      setCreateLoading(false);
    }
  };

  // 4. Open Marks Entry Grid
  const handleOpenMarksGrid = async (exam: any) => {
    setActiveMarksExam(exam);
    setLoadingGrid(true);
    setError('');
    try {
      const res = await api.getExamMarksGrid(exam.id);
      setMarksGridData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load marks grid');
    } finally {
      setLoadingGrid(false);
    }
  };

  const handleMarksCellChange = (studentId: number, subjectId: number, field: 'marks' | 'maxMarks', val: number) => {
    if (!marksGridData) return;
    setMarksGridData({
      ...marksGridData,
      students: marksGridData.students.map((s) => {
        if (s.studentId !== studentId) return s;
        return {
          ...s,
          marks: {
            ...s.marks,
            [subjectId]: {
              ...s.marks[subjectId],
              [field]: val,
            },
          },
        };
      }),
    });
  };

  const handleSaveMarksGrid = async () => {
    if (!activeMarksExam || !marksGridData) return;
    setSaveMarksLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const recordsToSave: { studentId: number; subjectId: number; marks: number; maxMarks: number }[] = [];
      marksGridData.students.forEach((s) => {
        marksGridData.subjects.forEach((sub) => {
          const item = s.marks[sub.id];
          if (item) {
            recordsToSave.push({
              studentId: s.studentId,
              subjectId: sub.id,
              marks: Number(item.marks) || 0,
              maxMarks: Number(item.maxMarks) || 50,
            });
          }
        });
      });

      const res = await api.saveExamMarks(activeMarksExam.id, recordsToSave);
      setSuccessMsg(res.message);
      // Refresh grid
      await handleOpenMarksGrid(activeMarksExam);
    } catch (err: any) {
      setError(err.message || 'Failed to save marks');
    } finally {
      setSaveMarksLoading(false);
    }
  };

  // 5. Open Student Progress Card Modal
  const handleOpenStudentCardModal = async (studentId: number, examId?: number) => {
    setViewCardModalStudentId(studentId);
    setSelectedExamIdForCard(examId);
    setLoadingModalCard(true);
    setError('');
    try {
      const res = await api.getProgressCardForStudent(studentId, examId);
      setModalCardData(res.progressCard);
    } catch (err: any) {
      setError(err.message || 'Failed to load student progress card');
    } finally {
      setLoadingModalCard(false);
    }
  };

  // 6. Open Grade Boundaries Config
  const handleOpenGradeBoundaries = async () => {
    setShowBoundariesModal(true);
    setLoadingBoundaries(true);
    try {
      const res = await api.getGradeBoundaries();
      setBoundariesList(res.boundaries);
    } catch (err: any) {
      setError(err.message || 'Failed to load grade boundaries');
    } finally {
      setLoadingBoundaries(false);
    }
  };

  const handleSaveGradeBoundaries = async () => {
    setSaveBoundariesLoading(true);
    setError('');
    try {
      const res = await api.updateGradeBoundaries(boundariesList);
      setSuccessMsg(res.message);
      setShowBoundariesModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update grade boundaries');
    } finally {
      setSaveBoundariesLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <AcademicCapIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Exams & Progress Cards</h1>
            <p className="text-slate-500 text-xs sm:text-sm">
              {isStudent
                ? 'View your official exam results and progress card'
                : 'Manage examinations, enter student marks grid, and generate progress card reports'}
            </p>
          </div>
        </div>

        {/* Action Controls for Admin / Teacher */}
        {!isStudent && (
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <button
                onClick={handleOpenGradeBoundaries}
                className="inline-flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition cursor-pointer shadow-xs"
              >
                <AdjustmentsHorizontalIcon className="w-4 h-4 text-slate-500" />
                <span>Grade Boundaries</span>
              </button>
            )}

            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition cursor-pointer"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Create Exam</span>
            </button>
          </div>
        )}
      </div>

      {/* Global Alerts */}
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

      {/* STUDENT READ-ONLY PROGRESS CARD VIEW */}
      {isStudent && (
        <div className="space-y-6">
          {loadingStudentCard ? (
            <div className="flex justify-center py-16">
              <SpinnerIcon className="w-8 h-8 text-indigo-600" />
            </div>
          ) : studentCard ? (
            <ProgressCardView card={studentCard} />
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
              No progress card report available yet.
            </div>
          )}
        </div>
      )}

      {/* ADMIN & TEACHER VIEW: EXAMS LIST & MARKS GRID */}
      {!isStudent && (
        <div className="space-y-6">
          {/* Class Filter Bar */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Select Class</label>
              <select
                value={selectedClassId}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : '';
                  setSelectedClassId(val);
                  setActiveMarksExam(null);
                  setMarksGridData(null);
                }}
                className="px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 font-semibold text-slate-900"
              >
                {classesList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Exams List & Active Grid Container */}
          {loadingExams ? (
            <div className="flex justify-center py-16">
              <SpinnerIcon className="w-8 h-8 text-indigo-600" />
            </div>
          ) : examsList.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center text-slate-500">
              No exams found for the selected class. Click "Create Exam" above to add one.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Exams Cards Panel */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">Exams List</h3>
                {examsList.map((exam) => (
                  <div
                    key={exam.id}
                    className={`p-5 rounded-2xl border transition cursor-pointer ${
                      activeMarksExam?.id === exam.id
                        ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-600/20'
                        : 'bg-white border-slate-200/80 hover:border-indigo-200 shadow-xs'
                    }`}
                    onClick={() => handleOpenMarksGrid(exam)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{exam.name}</span>
                      <span className="px-2 py-0.5 text-xs font-bold uppercase rounded bg-indigo-100 text-indigo-800">
                        {exam.type}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
                      <span>Date: {exam.examDate}</span>
                      <span className="font-semibold text-indigo-600">Marks Entry &rarr;</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Marks Entry Grid Main Workspace */}
              <div className="lg:col-span-2">
                {!activeMarksExam ? (
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center text-slate-500">
                    Select an exam from the left list to view or enter student marks.
                  </div>
                ) : loadingGrid ? (
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-16 flex justify-center">
                    <SpinnerIcon className="w-8 h-8 text-indigo-600" />
                  </div>
                ) : marksGridData ? (
                  <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden space-y-4">
                    {/* Header bar */}
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{activeMarksExam.name} - Marks Entry Grid</h3>
                        <p className="text-xs text-slate-500">Class: {marksGridData.class.name}</p>
                      </div>

                      <button
                        onClick={handleSaveMarksGrid}
                        disabled={saveMarksLoading}
                        className="inline-flex items-center space-x-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-60 cursor-pointer shadow-xs self-start sm:self-auto"
                      >
                        {saveMarksLoading ? <SpinnerIcon className="w-4 h-4" /> : <CheckIcon className="w-4 h-4" />}
                        <span>Save Marks Grid</span>
                      </button>
                    </div>

                    {/* Marks Table */}
                    <div className="overflow-x-auto p-4">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase">
                            <th className="p-3">Student Name</th>
                            {marksGridData.subjects.map((sub) => (
                              <th key={sub.id} className="p-3 text-center min-w-[90px]">
                                {sub.name} <span className="text-[10px] text-slate-400 block font-normal">(Max 50)</span>
                              </th>
                            ))}
                            <th className="p-3 text-center">Progress Card</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {marksGridData.students.map((stu) => (
                            <tr key={stu.studentId} className="hover:bg-slate-50/80">
                              <td className="p-3 font-bold text-slate-900">
                                <div>{stu.studentName}</div>
                                <div className="text-[10px] font-mono text-slate-400">Adm: {stu.admissionNo}</div>
                              </td>

                              {marksGridData.subjects.map((sub) => {
                                const currentVal = stu.marks[sub.id]?.marks ?? 0;
                                return (
                                  <td key={sub.id} className="p-2 text-center">
                                    <input
                                      type="number"
                                      min={0}
                                      max={50}
                                      value={currentVal}
                                      onChange={(e) =>
                                        handleMarksCellChange(
                                          stu.studentId,
                                          sub.id,
                                          'marks',
                                          parseInt(e.target.value || '0', 10)
                                        )
                                      }
                                      className="w-16 px-2 py-1.5 text-center font-bold text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                                    />
                                  </td>
                                );
                              })}

                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleOpenStudentCardModal(stu.studentId, activeMarksExam.id)}
                                  className="px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition cursor-pointer"
                                >
                                  View Card
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE EXAM MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900">Create New Exam</h3>

            <form onSubmit={handleCreateExam} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Class</label>
                <select
                  value={newExamData.classId}
                  onChange={(e) => setNewExamData({ ...newExamData, classId: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 font-semibold"
                  required
                >
                  {classesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Exam Type</label>
                <select
                  value={newExamData.type}
                  onChange={(e) => setNewExamData({ ...newExamData, type: e.target.value as ExamType })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 font-semibold"
                >
                  <option value="monthly">Monthly Exam</option>
                  <option value="semester">Semester Exam</option>
                  <option value="degree">Degree Exam</option>
                </select>
              </div>

              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder=" "
                  value={newExamData.name}
                  onChange={(e) => setNewExamData({ ...newExamData, name: e.target.value })}
                  className="peer w-full px-3.5 pt-5 pb-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 font-semibold text-slate-900"
                />
                <label className="absolute left-3.5 top-1.5 text-xs text-slate-400 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-indigo-600 pointer-events-none">
                  Exam Title (e.g. August Monthly Evaluation)
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Exam Date</label>
                <input
                  type="date"
                  required
                  value={newExamData.examDate}
                  onChange={(e) => setNewExamData({ ...newExamData, examDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 font-semibold"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition cursor-pointer"
                >
                  {createLoading ? <SpinnerIcon className="w-4 h-4" /> : 'Create Exam'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GRADE BOUNDARIES CONFIG MODAL */}
      {showBoundariesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 space-y-5">
            <h3 className="text-lg font-bold text-slate-900">Configurable Grade Boundaries</h3>

            {loadingBoundaries ? (
              <div className="flex justify-center py-8">
                <SpinnerIcon className="w-8 h-8 text-indigo-600" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {boundariesList.map((b, idx) => (
                    <div key={idx} className="grid grid-cols-4 gap-2 items-center p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Grade</span>
                        <input
                          type="text"
                          value={b.grade}
                          onChange={(e) => {
                            const updated = [...boundariesList];
                            updated[idx].grade = e.target.value;
                            setBoundariesList(updated);
                          }}
                          className="w-full px-2 py-1 text-xs font-bold border border-slate-300 rounded bg-white"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Min %</span>
                        <input
                          type="number"
                          value={b.minPercentage}
                          onChange={(e) => {
                            const updated = [...boundariesList];
                            updated[idx].minPercentage = parseInt(e.target.value || '0', 10);
                            setBoundariesList(updated);
                          }}
                          className="w-full px-2 py-1 text-xs font-bold border border-slate-300 rounded bg-white"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Max %</span>
                        <input
                          type="number"
                          value={b.maxPercentage}
                          onChange={(e) => {
                            const updated = [...boundariesList];
                            updated[idx].maxPercentage = parseInt(e.target.value || '0', 10);
                            setBoundariesList(updated);
                          }}
                          className="w-full px-2 py-1 text-xs font-bold border border-slate-300 rounded bg-white"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Pass / Fail</span>
                        <select
                          value={b.isPass ? 'true' : 'false'}
                          onChange={(e) => {
                            const updated = [...boundariesList];
                            updated[idx].isPass = e.target.value === 'true';
                            setBoundariesList(updated);
                          }}
                          className="w-full px-2 py-1 text-xs font-bold border border-slate-300 rounded bg-white"
                        >
                          <option value="true">PASS</option>
                          <option value="false">FAIL</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowBoundariesModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveGradeBoundaries}
                    disabled={saveBoundariesLoading}
                    className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition cursor-pointer"
                  >
                    {saveBoundariesLoading ? <SpinnerIcon className="w-4 h-4" /> : 'Save Boundaries'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW STUDENT PROGRESS CARD MODAL */}
      {viewCardModalStudentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            {loadingModalCard ? (
              <div className="flex justify-center py-16">
                <SpinnerIcon className="w-8 h-8 text-indigo-600" />
              </div>
            ) : modalCardData ? (
              <ProgressCardView card={modalCardData} onClose={() => setViewCardModalStudentId(null)} />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamsPage;
