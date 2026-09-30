import React, { useState, useEffect } from 'react';
import { useInstitution } from '../context/InstitutionContext';
import { useAuth } from '../context/AuthContext';
import {
  CheckIcon,
  SpinnerIcon,
  UploadIcon,
  ShieldIcon,
  AlertIcon,
  CloseIcon,
  AcademicCapIcon,
} from '../components/Icons';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { institutionName, logoUrl, updateSettings, uploadLogo, refreshSettings } = useInstitution();

  const [nameInput, setNameInput] = useState<string>(institutionName);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  const [savingName, setSavingName] = useState<boolean>(false);
  const [uploadingLogo, setUploadingLogo] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  useEffect(() => {
    setNameInput(institutionName);
  }, [institutionName]);

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      setError('Institution name cannot be empty');
      return;
    }

    setSavingName(true);
    setError('');
    setSuccessMsg('');

    try {
      await updateSettings(nameInput.trim());
      setSuccessMsg('Institution name updated successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to update institution name');
    } finally {
      setSavingName(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Logo file size must be less than 5 MB');
        return;
      }
      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleLogoUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select an image file to upload');
      return;
    }

    setUploadingLogo(true);
    setError('');
    setSuccessMsg('');

    try {
      await uploadLogo(selectedFile);
      setSuccessMsg('Institution logo uploaded to R2 storage successfully');
      setSelectedFile(null);
      setFilePreview(null);
      await refreshSettings();
    } catch (err: any) {
      setError(err.message || 'Failed to upload logo image');
    } finally {
      setUploadingLogo(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
        <ShieldIcon className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Access Denied</h2>
        <p className="text-xs text-slate-500 mt-1">
          Only Admin accounts are authorized to modify Institution Settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Institution Settings</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure global institution branding, logo storage in R2, and system title propagation
          </p>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-start gap-3">
          <AlertIcon className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-600">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm flex items-start gap-3">
          <CheckIcon className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="flex-1">{successMsg}</div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-emerald-600">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Institution Name Form */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800 mb-1">Institution Name</h3>
            <p className="text-xs text-slate-500 mb-6">
              This name will propagate to the top navbar, browser page title, progress card reports, and PDF exports.
            </p>

            <form onSubmit={handleNameSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Wafi Academy"
                  className="peer w-full px-4 pt-5 pb-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
                <label className="absolute left-4 top-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Institution Name *
                </label>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingName}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {savingName ? <SpinnerIcon className="w-4 h-4" /> : <CheckIcon className="w-4 h-4" />}
                  Save Name
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Card 2: Institution Logo & R2 Upload */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800 mb-1">Institution Logo</h3>
            <p className="text-xs text-slate-500 mb-4">
              Upload a logo image (PNG, JPEG, WebP, SVG max 5 MB). Stored securely in Cloudflare R2 and propagated to favicon & reports.
            </p>

            <div className="flex items-center gap-4 mb-6">
              <div className="w-20 h-20 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden p-2 shadow-inner">
                {filePreview ? (
                  <img src={filePreview} alt="Selected Logo Preview" className="w-full h-full object-contain" />
                ) : logoUrl ? (
                  <img src={logoUrl} alt="Current Institution Logo" className="w-full h-full object-contain" />
                ) : (
                  <AcademicCapIcon className="w-10 h-10 text-slate-400" />
                )}
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                <div className="font-semibold text-slate-700">
                  {filePreview ? 'New Preview Selected' : logoUrl ? 'Active Logo in R2' : 'Default Canvas Icon Active'}
                </div>
                <div className="text-slate-400">Supported formats: PNG, JPG, WebP, SVG</div>
              </div>
            </div>

            <form onSubmit={handleLogoUploadSubmit} className="space-y-4">
              <input
                type="file"
                accept="image/png, image/jpeg, image/svg+xml, image/webp"
                onChange={handleFileChange}
                className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              />

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={uploadingLogo || !selectedFile}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {uploadingLogo ? <SpinnerIcon className="w-4 h-4" /> : <UploadIcon className="w-4 h-4" />}
                  Upload to R2
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
