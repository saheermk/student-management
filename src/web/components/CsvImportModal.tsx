import React, { useState } from 'react';
import { api } from '../lib/api';
import { CsvPreviewResponse, CsvExecuteImportResponse } from '../../shared/types';
import { CsvImportRow } from '../../shared/schemas';
import {
  CloseIcon,
  SpinnerIcon,
  CheckIcon,
  AlertIcon,
  PlusIcon,
} from './Icons';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [csvContent, setCsvContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [previewResult, setPreviewResult] = useState<CsvPreviewResponse | null>(null);
  const [executeResult, setExecuteResult] = useState<CsvExecuteImportResponse | null>(null);

  if (!isOpen) return null;

  const handleFillSample = () => {
    setCsvContent(
      `name,admission_no,email,class,phone\nAlice Smith,ADM101,alice@school.com,Class 10A,9876543210\nBob Jones,ADM102,bob@school.com,Class 10A,9876543211\nCharlie Brown,ADM103,charlie@school.com,Class 10A,9876543212`
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCsvContent(content);
      }
    };
    reader.readAsText(file);
  };

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvContent.trim()) {
      setError('Please paste or upload CSV content.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.previewStudentCsv(csvContent);
      setPreviewResult(res);
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to preview CSV');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!previewResult) return;

    const validRowsToImport: CsvImportRow[] = previewResult.results
      .filter((r) => r.isValid)
      .map((r) => ({
        name: r.data.name,
        admissionNo: r.data.admissionNo,
        email: r.data.email,
        class: r.data.class,
        phone: r.data.phone || '',
      }));

    if (validRowsToImport.length === 0) {
      setError('No valid rows found to import.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.executeStudentCsv(validRowsToImport);
      setExecuteResult(res);
      setStep(3);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to execute CSV import');
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setStep(1);
    setCsvContent('');
    setError('');
    setPreviewResult(null);
    setExecuteResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 sm:p-8 relative my-8">
        <button
          onClick={() => {
            resetModal();
            onClose();
          }}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 transition"
        >
          <CloseIcon className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-slate-900 mb-1">Bulk Import Students (CSV)</h2>
        <p className="text-sm text-slate-500 mb-6">
          Import multiple student records from a CSV file (Columns: name, admission_no, email, class, phone)
        </p>

        {error && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {/* STEP 1: Paste / Upload CSV */}
        {step === 1 && (
          <form onSubmit={handlePreview} className="space-y-4">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-semibold text-slate-700">CSV Content</label>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={handleFillSample}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition"
                >
                  Paste Sample Data
                </button>
                <label className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer transition">
                  Upload .csv File
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <textarea
              rows={8}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder={`name,admission_no,email,class,phone\nAlice Smith,ADM101,alice@school.com,Class 10A,9876543210\nBob Jones,ADM102,bob@school.com,Class 10A,9876543211`}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  resetModal();
                  onClose();
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl flex items-center space-x-2 disabled:opacity-50 shadow-md shadow-indigo-600/20"
              >
                {loading ? <SpinnerIcon className="w-4 h-4" /> : <span>Preview & Validate CSV</span>}
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Preview & Validation Report */}
        {step === 2 && previewResult && (
          <div className="space-y-5">
            {/* Summary Stat Badges */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <div className="text-xs font-semibold text-slate-500 uppercase">Total Rows</div>
                <div className="text-xl font-extrabold text-slate-900">{previewResult.totalRows}</div>
              </div>
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <div className="text-xs font-semibold text-emerald-700 uppercase">Valid Rows</div>
                <div className="text-xl font-extrabold text-emerald-700">{previewResult.validRowsCount}</div>
              </div>
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-center">
                <div className="text-xs font-semibold text-rose-700 uppercase">Invalid Rows</div>
                <div className="text-xl font-extrabold text-rose-700">{previewResult.invalidRowsCount}</div>
              </div>
            </div>

            {/* Validation Table */}
            <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl bg-slate-50/50">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Adm No</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3">Class</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {previewResult.results.map((row) => (
                    <tr key={row.rowNumber} className={row.isValid ? '' : 'bg-rose-50/40'}>
                      <td className="py-2.5 px-3 text-slate-400 font-mono">{row.rowNumber}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{row.data.name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">{row.data.admissionNo}</td>
                      <td className="py-2.5 px-3 text-slate-700">{row.data.email}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">{row.data.class}</td>
                      <td className="py-2.5 px-3">
                        {row.isValid ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-700">
                            Valid
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-700" title={row.errors.join('; ')}>
                            Invalid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Error Report List if invalid rows exist */}
            {previewResult.invalidRowsCount > 0 && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5 text-xs text-rose-700">
                <div className="font-bold flex items-center space-x-1 mb-1">
                  <AlertIcon className="w-4 h-4" />
                  <span>Validation Error Report ({previewResult.invalidRowsCount} issues)</span>
                </div>
                {previewResult.results
                  .filter((r) => !r.isValid)
                  .map((r) => (
                    <div key={r.rowNumber}>
                      Row {r.rowNumber} ({r.data.email || r.data.name}): {r.errors.join(' | ')}
                    </div>
                  ))}
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition"
              >
                ← Edit CSV Text
              </button>

              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={loading || previewResult.validRowsCount === 0}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl flex items-center space-x-2 disabled:opacity-50 shadow-md shadow-emerald-600/20"
              >
                {loading ? (
                  <SpinnerIcon className="w-4 h-4" />
                ) : (
                  <span>Import {previewResult.validRowsCount} Valid Student(s)</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Execution Success Screen */}
        {step === 3 && executeResult && (
          <div className="space-y-5">
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl space-y-2 text-sm">
              <div className="flex items-center space-x-2 font-bold text-emerald-700 text-base">
                <CheckIcon className="w-6 h-6" />
                <span>Import Complete! Successfully created {executeResult.successCount} student accounts.</span>
              </div>
              <p className="text-xs text-emerald-700">
                User accounts (`role = 'student'`) have been bootstrapped with temporary passwords below:
              </p>
            </div>

            {/* Generated Student Passwords Table */}
            <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl bg-slate-50/50">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Admission No</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3">Temporary Password</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white font-mono">
                  {executeResult.importedStudents.map((s: any) => (
                    <tr key={s.id}>
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-900">{s.name}</td>
                      <td className="py-2.5 px-3 text-slate-700">{s.admissionNo}</td>
                      <td className="py-2.5 px-3 text-slate-700">{s.email}</td>
                      <td className="py-2.5 px-3 text-indigo-600 font-bold select-all">{s.temporaryPassword}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  resetModal();
                  onClose();
                }}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
