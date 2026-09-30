import React, { useState, useEffect } from 'react';
import { AcademicYearDTO, ClassDTO, SubjectDTO, TeacherDTO, SubjectCsvPreviewResponse } from '../../shared/types';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  ShieldIcon,
  PlusIcon,
  SpinnerIcon,
  CheckIcon,
  SearchIcon,
  UserIcon,
  PencilIcon,
  TrashIcon,
  UploadIcon,
  CloseIcon,
  BookIcon,
  AlertIcon,
} from '../components/Icons';
import { FloatingInput } from '../components/FloatingInput';

export const AcademicPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState<'years' | 'classes' | 'subjects'>('years');
  const [academicYears, setAcademicYears] = useState<AcademicYearDTO[]>([]);
  const [classesList, setClassesList] = useState<ClassDTO[]>([]);
  const [subjectsList, setSubjectsList] = useState<SubjectDTO[]>([]);
  const [teachersList, setTeachersList] = useState<TeacherDTO[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Create Year Form
  const [yearName, setYearName] = useState<string>('');
  const [yearIsCurrent, setYearIsCurrent] = useState<boolean>(false);
  const [yearLoading, setYearLoading] = useState<boolean>(false);

  // Create Class Form
  const [className, setClassName] = useState<string>('');
  const [selectedAyId, setSelectedAyId] = useState<number | ''>('');
  const [classLoading, setClassLoading] = useState<boolean>(false);

  // Edit Class Modal State
  const [editClassRecord, setEditClassRecord] = useState<ClassDTO | null>(null);
  const [editClassName, setEditClassName] = useState<string>('');
  const [editAyId, setEditAyId] = useState<number | ''>('');
  const [editClassLoading, setEditClassLoading] = useState<boolean>(false);

  // Delete Class Modal State
  const [deleteClassTarget, setDeleteClassTarget] = useState<{ record: ClassDTO; studentCount: number } | null>(null);
  const [deleteStudentsChoice, setDeleteStudentsChoice] = useState<boolean>(false); // false = keep students (archive), true = delete students
  const [deleteClassLoading, setDeleteClassLoading] = useState<boolean>(false);

  // Create Subject Form
  const [subjectName, setSubjectName] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<number | ''>('');
  const [subjectLoading, setSubjectLoading] = useState<boolean>(false);

  // Subject CSV Import Modal State
  const [showSubjectCsvModal, setShowSubjectCsvModal] = useState<boolean>(false);
  const [csvTargetClassId, setCsvTargetClassId] = useState<number | ''>('');
  const [csvTextContent, setCsvTextContent] = useState<string>('');
  const [subjectCsvPreview, setSubjectCsvPreview] = useState<SubjectCsvPreviewResponse | null>(null);
  const [csvPreviewLoading, setCsvPreviewLoading] = useState<boolean>(false);
  const [csvExecuteLoading, setCsvExecuteLoading] = useState<boolean>(false);

  // Assign Class Teacher Form
  const [assignClassId, setAssignClassId] = useState<number | ''>('');
  const [assignTeacherId, setAssignTeacherId] = useState<number | ''>('');
  const [assignLoading, setAssignLoading] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [ayRes, classRes, subRes] = await Promise.all([
        api.getAcademicYears(),
        api.getClasses(),
        api.getSubjects(),
      ]);
      setAcademicYears(ayRes.academicYears);
      setClassesList(classRes.classes);
      setSubjectsList(subRes.subjects);

      if (isAdmin) {
        const teacherRes = await api.getTeachers();
        setTeachersList(teacherRes.teachers);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load academic data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yearName.trim()) return;

    setYearLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      await api.createAcademicYear({ name: yearName.trim(), isCurrent: yearIsCurrent });
      setSuccessMsg('Academic year created successfully');
      setYearName('');
      setYearIsCurrent(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create academic year');
    } finally {
      setYearLoading(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim() || !selectedAyId) return;

    setClassLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      await api.createClass({ name: className.trim(), academicYearId: Number(selectedAyId) });
      setSuccessMsg('Class created successfully');
      setClassName('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create class');
    } finally {
      setClassLoading(false);
    }
  };

  const handleOpenEditClass = (cls: ClassDTO) => {
    setEditClassRecord(cls);
    setEditClassName(cls.name);
    setEditAyId(cls.academicYearId);
  };

  const handleSaveEditClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editClassRecord || !editClassName.trim() || !editAyId) return;

    setEditClassLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      await api.updateClass(editClassRecord.id, {
        name: editClassName.trim(),
        academicYearId: Number(editAyId),
      });
      setSuccessMsg(`Class "${editClassName.trim()}" updated successfully`);
      setEditClassRecord(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update class');
    } finally {
      setEditClassLoading(false);
    }
  };

  const handleOpenDeleteClass = async (cls: ClassDTO) => {
    setError('');
    try {
      const studentRes = await api.getStudents(cls.id);
      const studentCount = studentRes.students.length;
      setDeleteClassTarget({ record: cls, studentCount });
      setDeleteStudentsChoice(false); // Default to keep students (archive)
    } catch (err: any) {
      setError('Failed to fetch class student information');
    }
  };

  const handleConfirmDeleteClass = async () => {
    if (!deleteClassTarget) return;

    setDeleteClassLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await api.deleteClass(deleteClassTarget.record.id, deleteStudentsChoice);
      setSuccessMsg(res.message);
      setDeleteClassTarget(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete class');
    } finally {
      setDeleteClassLoading(false);
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim() || !selectedClassId) return;

    setSubjectLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      await api.createSubject({ name: subjectName.trim(), classId: Number(selectedClassId) });
      setSuccessMsg('Subject created successfully');
      setSubjectName('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create subject');
    } finally {
      setSubjectLoading(false);
    }
  };

  // Subject CSV Handlers
  const handleOpenSubjectCsvModal = () => {
    setShowSubjectCsvModal(true);
    setCsvTargetClassId(selectedClassId || (classesList[0]?.id || ''));
    setCsvTextContent('');
    setSubjectCsvPreview(null);
  };

  const handleSubjectCsvPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvTextContent.trim() || !csvTargetClassId) return;

    setCsvPreviewLoading(true);
    setError('');

    try {
      const previewRes = await api.previewSubjectCsv(csvTextContent, Number(csvTargetClassId));
      setSubjectCsvPreview(previewRes);
    } catch (err: any) {
      setError(err.message || 'Failed to preview CSV file');
    } finally {
      setCsvPreviewLoading(false);
    }
  };

  const handleSubjectCsvExecute = async () => {
    if (!subjectCsvPreview || !csvTargetClassId) return;

    const validRows = subjectCsvPreview.results
      .filter((r) => r.isValid)
      .map((r) => ({ name: r.data.name }));

    if (validRows.length === 0) return;

    setCsvExecuteLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await api.executeSubjectCsv(Number(csvTargetClassId), validRows);
      setSuccessMsg(`Successfully imported ${res.successCount} subjects into target class`);
      setShowSubjectCsvModal(false);
      setCsvTextContent('');
      setSubjectCsvPreview(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to execute subject import');
    } finally {
      setCsvExecuteLoading(false);
    }
  };

  const handleAssignTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignClassId || !assignTeacherId) return;

    setAssignLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      await api.assignClassTeacher(Number(assignClassId), Number(assignTeacherId));
      setSuccessMsg('Teacher assigned to class successfully');
      setAssignClassId('');
      setAssignTeacherId('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to assign teacher to class');
    } finally {
      setAssignLoading(false);
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
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Academic Structure</h1>
              <p className="text-sm text-slate-500">Manage academic years, classes, subjects, and staff assignments</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('years')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                activeTab === 'years'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Academic Years
            </button>
            <button
              onClick={() => setActiveTab('classes')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                activeTab === 'classes'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Classes & Teachers
            </button>
            <button
              onClick={() => setActiveTab('subjects')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                activeTab === 'subjects'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Subjects
            </button>
          </div>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-medium flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        )}
        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-medium flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckIcon className="w-5 h-5" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-500 hover:text-emerald-700">
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* TAB 1: ACADEMIC YEARS */}
        {activeTab === 'years' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Create Form (Admin) */}
            {isAdmin && (
              <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-4">
                <h2 className="text-lg font-bold text-slate-900">Add Academic Year</h2>
                <form onSubmit={handleCreateYear} className="space-y-4">
                  <FloatingInput
                    label="Academic Year (e.g., 2025-2026)"
                    value={yearName}
                    onChange={(e) => setYearName(e.target.value)}
                    required
                  />

                  <div className="flex items-center space-x-2 pt-1">
                    <input
                      type="checkbox"
                      id="isCurrent"
                      checked={yearIsCurrent}
                      onChange={(e) => setYearIsCurrent(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="isCurrent" className="text-sm font-medium text-slate-700">
                      Set as Current Academic Year
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={yearLoading}
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition duration-200 shadow-md shadow-indigo-600/20 flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
                  >
                    {yearLoading ? <SpinnerIcon className="w-5 h-5" /> : <span>Save Academic Year</span>}
                  </button>
                </form>
              </div>
            )}

            {/* List View */}
            <div className={`space-y-3 ${isAdmin ? 'md:col-span-2' : 'md:col-span-3'}`}>
              <h2 className="text-lg font-bold text-slate-900 mb-4">Academic Years</h2>
              {academicYears.length === 0 ? (
                <div className="p-8 text-center bg-white border border-slate-200/80 rounded-2xl text-slate-500">
                  No academic years created yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {academicYears.map((ay) => (
                    <div
                      key={ay.id}
                      className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm flex items-center justify-between"
                    >
                      <div>
                        <div className="text-lg font-extrabold text-slate-900">{ay.name}</div>
                        <div className="text-xs text-slate-400">Created {new Date(ay.createdAt).toLocaleDateString()}</div>
                      </div>
                      {ay.isCurrent ? (
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-extrabold flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>Current</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-semibold">
                          Past
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: CLASSES & TEACHERS */}
        {activeTab === 'classes' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Create Class & Assign Teacher Forms (Admin) */}
            {isAdmin && (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-4">
                  <h2 className="text-lg font-bold text-slate-900">Add New Class</h2>
                  <form onSubmit={handleCreateClass} className="space-y-4">
                    <FloatingInput
                      label="Class Name (e.g., Class 10A)"
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      required
                    />

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Academic Year <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={selectedAyId}
                        onChange={(e) => setSelectedAyId(Number(e.target.value))}
                        required
                        className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium transition"
                      >
                        <option value="">-- Select Academic Year --</option>
                        {academicYears.map((ay) => (
                          <option key={ay.id} value={ay.id}>
                            {ay.name} {ay.isCurrent ? '(Current)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={classLoading}
                      className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition duration-200 shadow-md shadow-indigo-600/20 flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
                    >
                      {classLoading ? <SpinnerIcon className="w-5 h-5" /> : <span>Create Class</span>}
                    </button>
                  </form>
                </div>

                {/* Assign Class Teacher Card */}
                <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-4">
                  <h2 className="text-lg font-bold text-slate-900">Assign Teacher to Class</h2>
                  <form onSubmit={handleAssignTeacher} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Select Class <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={assignClassId}
                        onChange={(e) => setAssignClassId(Number(e.target.value))}
                        required
                        className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium transition"
                      >
                        <option value="">-- Select Class --</option>
                        {classesList.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.academicYearName})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Select Teacher <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={assignTeacherId}
                        onChange={(e) => setAssignTeacherId(Number(e.target.value))}
                        required
                        className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium transition"
                      >
                        <option value="">-- Select Teacher --</option>
                        {teachersList.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={assignLoading}
                      className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition duration-200 shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
                    >
                      {assignLoading ? <SpinnerIcon className="w-5 h-5" /> : <span>Assign Teacher</span>}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* List Classes View */}
            <div className={`space-y-4 ${isAdmin ? 'md:col-span-2' : 'md:col-span-3'}`}>
              <h2 className="text-lg font-bold text-slate-900 mb-4">Classes & Staff</h2>
              {classesList.length === 0 ? (
                <div className="p-8 text-center bg-white border border-slate-200/80 rounded-2xl text-slate-500">
                  No classes created yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {classesList.map((cls) => (
                    <div
                      key={cls.id}
                      className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm space-y-3 relative group"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-lg font-extrabold text-slate-900">{cls.name}</div>
                          <span className="inline-block mt-1 px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-bold">
                            {cls.academicYearName}
                          </span>
                        </div>

                        {/* Admin Action Buttons (Edit & Delete) */}
                        {isAdmin && (
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleOpenEditClass(cls)}
                              title="Edit Class"
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenDeleteClass(cls)}
                              title="Delete Class"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 text-xs space-y-1">
                        <div className="text-slate-500 font-semibold uppercase tracking-wider">Assigned Teachers:</div>
                        {cls.teacherNames && cls.teacherNames.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {cls.teacherNames.map((tName, i) => (
                              <span
                                key={i}
                                className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg font-medium border border-slate-200"
                              >
                                {tName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No teacher assigned yet</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SUBJECTS */}
        {activeTab === 'subjects' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Create Subject Form & CSV Import Button (Admin) */}
            {isAdmin && (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-4">
                  <h2 className="text-lg font-bold text-slate-900">Add Subject to Class</h2>
                  <form onSubmit={handleCreateSubject} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Target Class <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(Number(e.target.value))}
                        required
                        className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium transition"
                      >
                        <option value="">-- Select Class --</option>
                        {classesList.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.academicYearName})
                          </option>
                        ))}
                      </select>
                    </div>

                    <FloatingInput
                      label="Subject Name (e.g., Mathematics)"
                      value={subjectName}
                      onChange={(e) => setSubjectName(e.target.value)}
                      required
                    />

                    <button
                      type="submit"
                      disabled={subjectLoading}
                      className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition duration-200 shadow-md shadow-indigo-600/20 flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
                    >
                      {subjectLoading ? <SpinnerIcon className="w-5 h-5" /> : <span>Add Subject</span>}
                    </button>
                  </form>
                </div>

                {/* CSV Import Subjects Button Card */}
                <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-3 text-center">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto border border-indigo-100">
                    <UploadIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Bulk CSV Upload</h3>
                    <p className="text-xs text-slate-500 mt-1">Import multiple subjects into a class with live validation preview</p>
                  </div>
                  <button
                    onClick={handleOpenSubjectCsvModal}
                    className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition duration-200 text-sm flex items-center justify-center space-x-2 shadow-sm"
                  >
                    <UploadIcon className="w-4 h-4" />
                    <span>Import Subjects via CSV</span>
                  </button>
                </div>
              </div>
            )}

            {/* List Subjects View */}
            <div className={`space-y-4 ${isAdmin ? 'md:col-span-2' : 'md:col-span-3'}`}>
              <h2 className="text-lg font-bold text-slate-900 mb-4">Class Subjects</h2>
              {subjectsList.length === 0 ? (
                <div className="p-8 text-center bg-white border border-slate-200/80 rounded-2xl text-slate-500">
                  No subjects added yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {subjectsList.map((sub) => (
                    <div
                      key={sub.id}
                      className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm flex items-center justify-between"
                    >
                      <div>
                        <div className="text-base font-bold text-slate-900">{sub.name}</div>
                        <div className="text-xs text-slate-500">Class: {sub.className || 'Unassigned / Archived'}</div>
                      </div>
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200">
                        Subject
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL 1: EDIT CLASS MODAL */}
        {editClassRecord && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Edit Class</h3>
                <button onClick={() => setEditClassRecord(null)} className="text-slate-400 hover:text-slate-600">
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditClass} className="space-y-4">
                <FloatingInput
                  label="Class Name"
                  value={editClassName}
                  onChange={(e) => setEditClassName(e.target.value)}
                  required
                />

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Academic Year <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editAyId}
                    onChange={(e) => setEditAyId(Number(e.target.value))}
                    required
                    className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium transition"
                  >
                    <option value="">-- Select Academic Year --</option>
                    {academicYears.map((ay) => (
                      <option key={ay.id} value={ay.id}>
                        {ay.name} {ay.isCurrent ? '(Current)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditClassRecord(null)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editClassLoading}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition shadow-md shadow-indigo-600/20 flex items-center space-x-2"
                  >
                    {editClassLoading ? <SpinnerIcon className="w-4 h-4" /> : <span>Save Changes</span>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: DELETE CLASS CONFIRMATION MODAL */}
        {deleteClassTarget && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
                    <AlertIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Delete Class: {deleteClassTarget.record.name}</h3>
                    <p className="text-xs text-slate-500">{deleteClassTarget.record.academicYearName}</p>
                  </div>
                </div>
                <button onClick={() => setDeleteClassTarget(null)} className="text-slate-400 hover:text-slate-600">
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-800 space-y-1">
                <div className="font-bold flex items-center space-x-1">
                  <span>Enrolled Students Notice</span>
                </div>
                <p>
                  This class currently has <strong>{deleteClassTarget.studentCount}</strong> enrolled student(s).
                  Please choose how to handle student records before proceeding.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Select Student Handling Action
                </label>

                {/* Option 1: Keep Students & Archive (Recommended default) */}
                <div
                  onClick={() => setDeleteStudentsChoice(false)}
                  className={`p-4 rounded-xl border cursor-pointer transition flex items-start space-x-3 ${
                    !deleteStudentsChoice
                      ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="deleteChoice"
                    checked={!deleteStudentsChoice}
                    onChange={() => setDeleteStudentsChoice(false)}
                    className="mt-1 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <div className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                      <span>Keep Students & Archive History</span>
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-extrabold rounded-full">
                        Recommended
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Moves students to an unassigned/archived state. All past attendance logs, exam marks, progress cards, fee receipts, and leave records remain 100% intact.
                    </p>
                  </div>
                </div>

                {/* Option 2: Delete Students & All Data */}
                <div
                  onClick={() => setDeleteStudentsChoice(true)}
                  className={`p-4 rounded-xl border cursor-pointer transition flex items-start space-x-3 ${
                    deleteStudentsChoice
                      ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-500/20'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="deleteChoice"
                    checked={deleteStudentsChoice}
                    onChange={() => setDeleteStudentsChoice(true)}
                    className="mt-1 text-rose-600 focus:ring-rose-500"
                  />
                  <div>
                    <div className="text-sm font-bold text-rose-900">
                      Permanently Delete Enrolled Students
                    </div>
                    <p className="text-xs text-rose-700 mt-1">
                      Permanently deletes student user accounts and all associated data records for these {deleteClassTarget.studentCount} students.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeleteClassTarget(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteClass}
                  disabled={deleteClassLoading}
                  className={`px-5 py-2.5 text-white rounded-xl text-sm font-semibold transition shadow-md flex items-center space-x-2 ${
                    deleteStudentsChoice
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                  }`}
                >
                  {deleteClassLoading ? <SpinnerIcon className="w-4 h-4" /> : <span>Confirm Delete</span>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 3: SUBJECT CSV IMPORT MODAL */}
        {showSubjectCsvModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <BookIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Import Subjects via CSV</h3>
                    <p className="text-xs text-slate-500">Paste or upload CSV text containing subject names</p>
                  </div>
                </div>
                <button onClick={() => setShowSubjectCsvModal(false)} className="text-slate-400 hover:text-slate-600">
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Step 1: Input Form */}
              <form onSubmit={handleSubjectCsvPreview} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Target Class <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={csvTargetClassId}
                    onChange={(e) => {
                      setCsvTargetClassId(Number(e.target.value));
                      setSubjectCsvPreview(null);
                    }}
                    required
                    className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium transition"
                  >
                    <option value="">-- Select Target Class --</option>
                    {classesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.academicYearName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    CSV Content (One subject name per line or CSV list) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={6}
                    value={csvTextContent}
                    onChange={(e) => {
                      setCsvTextContent(e.target.value);
                      setSubjectCsvPreview(null);
                    }}
                    placeholder={`Subject Name\nMathematics\nEnglish Grammar\nPhysical Science\nSocial Studies`}
                    required
                    className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  ></textarea>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={csvPreviewLoading || !csvTextContent.trim() || !csvTargetClassId}
                    className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition text-sm flex items-center space-x-2 shadow-sm disabled:opacity-50"
                  >
                    {csvPreviewLoading ? <SpinnerIcon className="w-4 h-4" /> : <span>Preview CSV Validation</span>}
                  </button>
                </div>
              </form>

              {/* Step 2: Validation Preview Table */}
              {subjectCsvPreview && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-sm">Validation Preview Results</h4>
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">
                        Total: {subjectCsvPreview.totalRows}
                      </span>
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">
                        Valid: {subjectCsvPreview.validRowsCount}
                      </span>
                      <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-bold">
                        Errors: {subjectCsvPreview.invalidRowsCount}
                      </span>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
                    {subjectCsvPreview.results.map((res) => (
                      <div key={res.rowNumber} className="p-3 flex items-start justify-between bg-white hover:bg-slate-50">
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-900">
                            Row {res.rowNumber}: <span className="font-mono text-indigo-600">{res.data.name || '(empty)'}</span>
                          </div>
                          {res.errors.length > 0 && (
                            <div className="text-rose-600 font-medium">
                              {res.errors.join(' • ')}
                            </div>
                          )}
                        </div>
                        {res.isValid ? (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-bold text-[10px]">
                            Valid
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded font-bold text-[10px]">
                            Error
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setShowSubjectCsvModal(false)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSubjectCsvExecute}
                      disabled={csvExecuteLoading || subjectCsvPreview.validRowsCount === 0}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition shadow-md shadow-emerald-600/20 flex items-center space-x-2 disabled:opacity-50"
                    >
                      {csvExecuteLoading ? (
                        <SpinnerIcon className="w-4 h-4" />
                      ) : (
                        <span>Import {subjectCsvPreview.validRowsCount} Valid Subject(s)</span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
