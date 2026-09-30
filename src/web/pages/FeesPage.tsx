import React, { useState, useEffect } from 'react';
import {
  ClassDTO,
  AcademicYearDTO,
  StudentDTO,
  DuesListSummaryDTO,
  StudentFeeSummaryDTO,
  FeeItemDTO,
} from '../../shared/types';
import { PaymentMethod } from '../../shared/schemas';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  CheckIcon,
  SpinnerIcon,
  PlusIcon,
  SearchIcon,
  UserIcon,
  CalendarIcon,
  AcademicCapIcon,
  CreditCardIcon,
  TrashIcon,
  PencilIcon,
} from '../components/Icons';

export const FeesPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isStudent = user?.role === 'student';

  const [classesList, setClassesList] = useState<ClassDTO[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearDTO[]>([]);

  // Admin View State
  const [duesSummary, setDuesSummary] = useState<DuesListSummaryDTO | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false);
  const [selectedClassFilter, setSelectedClassFilter] = useState<number | ''>('');
  const [isOverdueFilter, setIsOverdueFilter] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Student View State
  const [studentSelfSummary, setStudentSelfSummary] = useState<StudentFeeSummaryDTO | null>(null);
  const [loadingSelfSummary, setLoadingSelfSummary] = useState<boolean>(false);

  // Add Fee Item Modal State
  const [showAddFeeModal, setShowAddFeeModal] = useState<boolean>(false);
  const [feeCreationMode, setFeeCreationMode] = useState<'single' | 'bulk'>('bulk');
  const [studentsInSelectedClass, setStudentsInSelectedClass] = useState<StudentDTO[]>([]);
  const [feeForm, setFeeForm] = useState<{
    title: string;
    amount: number | '';
    dueDate: string;
    classId: number | '';
    studentId: number | '';
    academicYearId: number | '';
    remarks: string;
  }>({
    title: '',
    amount: '',
    dueDate: new Date().toISOString().slice(0, 10),
    classId: '',
    studentId: '',
    academicYearId: '',
    remarks: '',
  });
  const [addFeeLoading, setAddFeeLoading] = useState<boolean>(false);

  // Record Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [paymentTargetFee, setPaymentTargetFee] = useState<{
    feeItemId: number;
    studentId: number;
    studentName: string;
    title: string;
    amount: number;
    amountPaid: number;
    balance: number;
  } | null>(null);
  const [paymentForm, setPaymentForm] = useState<{
    amountPaid: number | '';
    paymentDate: string;
    receiptNo: string;
    paymentMethod: PaymentMethod;
    remarks: string;
  }>({
    amountPaid: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    receiptNo: `RCP-${Date.now().toString().slice(-6)}`,
    paymentMethod: 'cash',
    remarks: '',
  });
  const [paymentLoading, setPaymentLoading] = useState<boolean>(false);

  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // 1. Initial Load
  useEffect(() => {
    if (isStudent) {
      loadStudentSelfSummary();
    } else if (isAdmin) {
      loadClassesAndYears();
      loadDuesSummary();
    }
  }, [user]);

  const loadStudentSelfSummary = async () => {
    setLoadingSelfSummary(true);
    setError('');
    try {
      const res = await api.getFeesMe();
      setStudentSelfSummary(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load fee summary');
    } finally {
      setLoadingSelfSummary(false);
    }
  };

  const loadClassesAndYears = async () => {
    try {
      const [classesRes, yearsRes] = await Promise.all([api.getClasses(), api.getAcademicYears()]);
      setClassesList(classesRes.classes);
      setAcademicYears(yearsRes.academicYears);

      if (classesRes.classes.length > 0) {
        const defaultClassId = classesRes.classes[0].id;
        const currentYearId =
          yearsRes.academicYears.find((y) => y.isCurrent)?.id || yearsRes.academicYears[0]?.id || '';

        setFeeForm((prev) => ({
          ...prev,
          classId: defaultClassId,
          academicYearId: currentYearId,
        }));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize class list');
    }
  };

  // 2. Load Dues Summary when filters change
  useEffect(() => {
    if (isAdmin) {
      loadDuesSummary();
    }
  }, [selectedClassFilter, isOverdueFilter, searchQuery]);

  const loadDuesSummary = async () => {
    setLoadingSummary(true);
    setError('');
    try {
      const res = await api.getFees({
        classId: selectedClassFilter ? Number(selectedClassFilter) : undefined,
        isOverdue: isOverdueFilter,
        search: searchQuery || undefined,
      });
      setDuesSummary(res.summary);
    } catch (err: any) {
      setError(err.message || 'Failed to load dues list');
    } finally {
      setLoadingSummary(false);
    }
  };

  // 3. Load Students for single-student selection modal when classId changes
  useEffect(() => {
    if (feeForm.classId && feeCreationMode === 'single') {
      loadStudentsForClass(Number(feeForm.classId));
    }
  }, [feeForm.classId, feeCreationMode]);

  const loadStudentsForClass = async (classId: number) => {
    try {
      const res = await api.getStudents(classId);
      const activeStus = res.students.filter((s) => s.status === 'active');
      setStudentsInSelectedClass(activeStus);
      if (activeStus.length > 0) {
        setFeeForm((prev) => ({ ...prev, studentId: activeStus[0].id }));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load students for class');
    }
  };

  // 4. Add Fee Item Form Submission
  const handleAddFeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feeForm.title || !feeForm.amount || !feeForm.dueDate || !feeForm.academicYearId) {
      setError('Please fill in all required fee fields');
      return;
    }

    setAddFeeLoading(true);
    setError('');
    try {
      if (feeCreationMode === 'bulk') {
        if (!feeForm.classId) {
          setError('Class is required for bulk fee assignment');
          setAddFeeLoading(false);
          return;
        }

        const res = await api.createBulkClassFee({
          title: feeForm.title,
          amount: Number(feeForm.amount),
          dueDate: feeForm.dueDate,
          classId: Number(feeForm.classId),
          academicYearId: Number(feeForm.academicYearId),
          remarks: feeForm.remarks || undefined,
        });

        setSuccessMsg(res.message);
      } else {
        if (!feeForm.studentId) {
          setError('Student selection is required');
          setAddFeeLoading(false);
          return;
        }

        const res = await api.createFeeItem({
          title: feeForm.title,
          amount: Number(feeForm.amount),
          dueDate: feeForm.dueDate,
          studentId: Number(feeForm.studentId),
          classId: Number(feeForm.classId) || undefined,
          academicYearId: Number(feeForm.academicYearId),
          remarks: feeForm.remarks || undefined,
        });

        setSuccessMsg(res.message);
      }

      setShowAddFeeModal(false);
      setFeeForm({
        title: '',
        amount: '',
        dueDate: new Date().toISOString().slice(0, 10),
        classId: feeForm.classId,
        studentId: '',
        academicYearId: feeForm.academicYearId,
        remarks: '',
      });
      await loadDuesSummary();
    } catch (err: any) {
      setError(err.message || 'Failed to create fee item');
    } finally {
      setAddFeeLoading(false);
    }
  };

  // 5. Open Payment Modal
  const handleOpenPaymentModal = (dueItem: any) => {
    setPaymentTargetFee(dueItem);
    setPaymentForm({
      amountPaid: dueItem.balance,
      paymentDate: new Date().toISOString().slice(0, 10),
      receiptNo: `RCP-${Date.now().toString().slice(-6)}`,
      paymentMethod: 'cash',
      remarks: '',
    });
    setShowPaymentModal(true);
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTargetFee || !paymentForm.amountPaid || !paymentForm.receiptNo) {
      setError('Please provide valid payment details');
      return;
    }

    setPaymentLoading(true);
    setError('');
    try {
      const res = await api.recordFeePayment({
        feeItemId: paymentTargetFee.feeItemId,
        studentId: paymentTargetFee.studentId,
        amountPaid: Number(paymentForm.amountPaid),
        paymentDate: paymentForm.paymentDate,
        receiptNo: paymentForm.receiptNo,
        paymentMethod: paymentForm.paymentMethod,
        remarks: paymentForm.remarks || undefined,
      });

      setSuccessMsg(res.message);
      setShowPaymentModal(false);
      setPaymentTargetFee(null);
      await loadDuesSummary();
    } catch (err: any) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  // 6. Delete Fee Item
  const handleDeleteFeeItem = async (feeItemId: number) => {
    if (!window.confirm('Are you sure you want to delete this fee item? Associated payments will be deleted.')) return;
    try {
      const res = await api.deleteFeeItem(feeItemId);
      setSuccessMsg(res.message);
      await loadDuesSummary();
    } catch (err: any) {
      setError(err.message || 'Failed to delete fee item');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <CreditCardIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Fee Register</h1>
            <p className="text-slate-500 text-xs sm:text-sm">
              {isStudent
                ? 'View your personal fee statements, payments, and receipt history'
                : 'Manage student fees, record payments, and track pending dues list'}
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowAddFeeModal(true)}
            className="inline-flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition cursor-pointer self-start md:self-auto"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Add Fee Item</span>
          </button>
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

      {/* STUDENT SELF FEE DASHBOARD (FR-F6) */}
      {isStudent && (
        <div className="space-y-6">
          {loadingSelfSummary ? (
            <div className="flex justify-center py-16">
              <SpinnerIcon className="w-8 h-8 text-indigo-600" />
            </div>
          ) : studentSelfSummary ? (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="block text-xs font-semibold text-slate-400 uppercase">Total Charged</span>
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 block">
                    ₹{studentSelfSummary.totals.totalCharged.toLocaleString()}
                  </span>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="block text-xs font-semibold text-slate-400 uppercase">Total Paid</span>
                  <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 mt-1 block">
                    ₹{studentSelfSummary.totals.totalPaid.toLocaleString()}
                  </span>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="block text-xs font-semibold text-slate-400 uppercase">Remaining Balance</span>
                  <span
                    className={`text-2xl sm:text-3xl font-extrabold mt-1 block ${
                      studentSelfSummary.totals.balance > 0 ? 'text-rose-600' : 'text-slate-900'
                    }`}
                  >
                    ₹{studentSelfSummary.totals.balance.toLocaleString()}
                  </span>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="block text-xs font-semibold text-slate-400 uppercase">Overdue Items</span>
                  <span
                    className={`text-2xl sm:text-3xl font-extrabold mt-1 block ${
                      studentSelfSummary.totals.overdueCount > 0 ? 'text-rose-600' : 'text-slate-900'
                    }`}
                  >
                    {studentSelfSummary.totals.overdueCount}
                  </span>
                </div>
              </div>

              {/* Fee Breakdown Cards */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">Fee Statements & History</h3>

                {studentSelfSummary.feeItems.length === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center">No fee statements found.</p>
                ) : (
                  <div className="space-y-4">
                    {studentSelfSummary.feeItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-5 bg-slate-50/60 rounded-2xl border border-slate-200 space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900 text-base">{item.title}</span>
                              {item.isOverdue && (
                                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-rose-100 text-rose-700 border border-rose-200">
                                  Overdue
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-500">
                              Academic Year: {item.academicYearName} • Due Date: {item.dueDate}
                            </span>
                          </div>

                          <div className="text-right self-start sm:self-auto">
                            <span className="text-xs text-slate-400 uppercase font-semibold block">Total Amount</span>
                            <span className="text-xl font-black text-slate-900">₹{item.amount.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Payment Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-emerald-700">Paid: ₹{item.amountPaid.toLocaleString()}</span>
                            <span className={item.balance > 0 ? 'text-rose-700' : 'text-slate-500'}>
                              Balance: ₹{item.balance.toLocaleString()}
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                item.balance === 0 ? 'bg-emerald-500' : 'bg-indigo-600'
                              }`}
                              style={{ width: `${Math.min(100, (item.amountPaid / item.amount) * 100)}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Payment Receipts History */}
                        {item.payments && item.payments.length > 0 && (
                          <div className="pt-2">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                              Payment Receipts
                            </span>
                            <div className="divide-y divide-slate-200/60 bg-white rounded-xl border border-slate-200/80 px-3 py-1 text-xs">
                              {item.payments.map((p) => (
                                <div key={p.id} className="py-2 flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-mono font-bold text-indigo-700">{p.receiptNo}</span>
                                    <span className="text-slate-400">•</span>
                                    <span className="text-slate-600">{p.paymentDate}</span>
                                    <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-slate-100 text-slate-700 rounded">
                                      {p.paymentMethod}
                                    </span>
                                  </div>
                                  <span className="font-bold text-emerald-700">+₹{p.amountPaid.toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ADMIN DUES MANAGEMENT VIEW (FR-F1 to FR-F5) */}
      {isAdmin && (
        <div className="space-y-6">
          {/* Stat Overview Cards */}
          {duesSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <span className="block text-xs font-semibold text-slate-400 uppercase">Total Charged</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 block">
                  ₹{duesSummary.totalCharged.toLocaleString()}
                </span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <span className="block text-xs font-semibold text-slate-400 uppercase">Total Collected</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 mt-1 block">
                  ₹{duesSummary.totalCollected.toLocaleString()}
                </span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <span className="block text-xs font-semibold text-slate-400 uppercase">Pending Dues</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-indigo-600 mt-1 block">
                  ₹{duesSummary.totalPendingDues.toLocaleString()}
                </span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <span className="block text-xs font-semibold text-slate-400 uppercase">Overdue Items</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-rose-600 mt-1 block">
                  {duesSummary.overdueCount}
                </span>
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
              {/* Search Bar */}
              <div className="relative flex-1">
                <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  placeholder="Search student name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 font-semibold"
                />
              </div>

              {/* Class Filter Dropdown */}
              <div className="sm:w-48">
                <select
                  value={selectedClassFilter}
                  onChange={(e) => setSelectedClassFilter(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 font-semibold text-slate-900"
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

            {/* Overdue Filter Toggle */}
            <div className="flex items-center space-x-2 self-start md:self-auto">
              <button
                type="button"
                onClick={() => setIsOverdueFilter(false)}
                className={`px-3 py-2 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                  !isOverdueFilter
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                All Fees
              </button>
              <button
                type="button"
                onClick={() => setIsOverdueFilter(true)}
                className={`px-3 py-2 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                  isOverdueFilter
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                Overdue Only
              </button>
            </div>
          </div>

          {/* Dues List Table */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
            {loadingSummary ? (
              <div className="flex justify-center py-16">
                <SpinnerIcon className="w-8 h-8 text-indigo-600" />
              </div>
            ) : !duesSummary || duesSummary.dues.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm">
                No fee items found matching the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="px-6 py-3.5">Student</th>
                      <th className="px-6 py-3.5">Class</th>
                      <th className="px-6 py-3.5">Fee Title</th>
                      <th className="px-6 py-3.5">Due Date</th>
                      <th className="px-6 py-3.5 text-right">Charged</th>
                      <th className="px-6 py-3.5 text-right">Paid</th>
                      <th className="px-6 py-3.5 text-right">Balance</th>
                      <th className="px-6 py-3.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {duesSummary.dues.map((item) => (
                      <tr key={item.feeItemId} className="hover:bg-slate-50/80 transition">
                        <td className="px-6 py-3.5 font-bold text-slate-900">
                          <div>{item.studentName}</div>
                          <div className="text-xs font-mono font-normal text-slate-400">Adm: {item.admissionNo}</div>
                        </td>
                        <td className="px-6 py-3.5 text-slate-600 text-xs font-medium">{item.className}</td>
                        <td className="px-6 py-3.5 font-semibold text-slate-900">{item.title}</td>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-xs text-slate-600 font-medium">{item.dueDate}</span>
                            {item.isOverdue && (
                              <span className="px-1.5 py-0.5 text-[10px] font-extrabold uppercase rounded bg-rose-100 text-rose-700 border border-rose-200">
                                Overdue
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-right font-semibold text-slate-900">
                          ₹{item.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-3.5 text-right font-semibold text-emerald-700">
                          ₹{item.amountPaid.toLocaleString()}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <span
                            className={`font-black ${
                              item.balance > 0 ? 'text-rose-700' : 'text-slate-400'
                            }`}
                          >
                            ₹{item.balance.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            {item.balance > 0 && (
                              <button
                                type="button"
                                onClick={() => handleOpenPaymentModal(item)}
                                className="px-2.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition cursor-pointer"
                              >
                                Pay
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteFeeItem(item.feeItemId)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Delete Fee Item"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD FEE ITEM MODAL (FR-F1) */}
      {showAddFeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900">Add Fee Item</h3>

            {/* Mode Switcher */}
            <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setFeeCreationMode('bulk')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  feeCreationMode === 'bulk'
                    ? 'bg-white text-indigo-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bulk Whole Class
              </button>
              <button
                type="button"
                onClick={() => setFeeCreationMode('single')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  feeCreationMode === 'single'
                    ? 'bg-white text-indigo-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Single Student
              </button>
            </div>

            <form onSubmit={handleAddFeeSubmit} className="space-y-4">
              {/* Floating Label: Title */}
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder=" "
                  value={feeForm.title}
                  onChange={(e) => setFeeForm({ ...feeForm, title: e.target.value })}
                  className="peer w-full px-3.5 pt-5 pb-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 font-semibold text-slate-900"
                />
                <label className="absolute left-3.5 top-1.5 text-xs text-slate-400 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-indigo-600 pointer-events-none">
                  Fee Title (e.g. Term 1 Tuition Fee)
                </label>
              </div>

              {/* Floating Label: Amount */}
              <div className="relative">
                <input
                  type="number"
                  required
                  min={1}
                  placeholder=" "
                  value={feeForm.amount}
                  onChange={(e) =>
                    setFeeForm({ ...feeForm, amount: e.target.value ? Number(e.target.value) : '' })
                  }
                  className="peer w-full px-3.5 pt-5 pb-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 font-semibold text-slate-900"
                />
                <label className="absolute left-3.5 top-1.5 text-xs text-slate-400 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-indigo-600 pointer-events-none">
                  Amount (₹)
                </label>
              </div>

              {/* Class Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Target Class
                </label>
                <select
                  value={feeForm.classId}
                  onChange={(e) => setFeeForm({ ...feeForm, classId: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 font-semibold text-slate-900"
                  required
                >
                  {classesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Single Student Selection */}
              {feeCreationMode === 'single' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Select Student
                  </label>
                  <select
                    value={feeForm.studentId}
                    onChange={(e) => setFeeForm({ ...feeForm, studentId: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 font-semibold text-slate-900"
                    required
                  >
                    {studentsInSelectedClass.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.admissionNo})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Academic Year Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Academic Year
                </label>
                <select
                  value={feeForm.academicYearId}
                  onChange={(e) => setFeeForm({ ...feeForm, academicYearId: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 font-semibold text-slate-900"
                  required
                >
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name} {y.isCurrent ? '(Current)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  required
                  value={feeForm.dueDate}
                  onChange={(e) => setFeeForm({ ...feeForm, dueDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 font-semibold text-slate-900"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddFeeModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addFeeLoading}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition cursor-pointer"
                >
                  {addFeeLoading ? <SpinnerIcon className="w-4 h-4" /> : 'Create Fee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL (FR-F2) */}
      {showPaymentModal && paymentTargetFee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Record Fee Payment</h3>
              <p className="text-xs text-slate-500 mt-1">
                Student: <span className="font-bold text-slate-900">{paymentTargetFee.studentName}</span> • Item:{' '}
                <span className="font-bold text-slate-900">{paymentTargetFee.title}</span>
              </p>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="space-y-4">
              {/* Floating Label: Amount Paid */}
              <div className="relative">
                <input
                  type="number"
                  required
                  min={1}
                  max={paymentTargetFee.balance}
                  placeholder=" "
                  value={paymentForm.amountPaid}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      amountPaid: e.target.value ? Number(e.target.value) : '',
                    })
                  }
                  className="peer w-full px-3.5 pt-5 pb-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 font-semibold text-slate-900"
                />
                <label className="absolute left-3.5 top-1.5 text-xs text-slate-400 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-indigo-600 pointer-events-none">
                  Amount Paid (Max ₹{paymentTargetFee.balance.toLocaleString()})
                </label>
              </div>

              {/* Floating Label: Receipt Number */}
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder=" "
                  value={paymentForm.receiptNo}
                  onChange={(e) => setPaymentForm({ ...paymentForm, receiptNo: e.target.value })}
                  className="peer w-full px-3.5 pt-5 pb-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 font-semibold text-slate-900 font-mono"
                />
                <label className="absolute left-3.5 top-1.5 text-xs text-slate-400 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-indigo-600 pointer-events-none">
                  Receipt Number (e.g. RCP-001)
                </label>
              </div>

              {/* Payment Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Payment Date
                </label>
                <input
                  type="date"
                  required
                  value={paymentForm.paymentDate}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 font-semibold text-slate-900"
                />
              </div>

              {/* Payment Method Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, paymentMethod: e.target.value as PaymentMethod })
                  }
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 font-semibold text-slate-900"
                >
                  <option value="cash">Cash</option>
                  <option value="online">Online Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentLoading}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition cursor-pointer"
                >
                  {paymentLoading ? <SpinnerIcon className="w-4 h-4" /> : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeesPage;
