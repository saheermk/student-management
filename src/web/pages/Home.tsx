import React, { useEffect, useState } from 'react';
import { fetchHealth } from '../lib/api';
import { HealthResponse } from '../../shared/schemas';

type ModalType = 'privacy' | 'terms' | 'contact' | 'faq' | 'security' | null;

export const Home: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  useEffect(() => {
    fetchHealth()
      .then((data) => {
        setHealth(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between selection:bg-indigo-600 selection:text-white">
      {/* Header */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-40 px-4 py-3 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              S
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none">
                Student Management
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Cloudflare Workers · Hono · D1</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${loading ? 'bg-amber-400' : error ? 'bg-rose-400' : 'bg-emerald-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${loading ? 'bg-amber-500' : error ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
              </span>
              <span className="text-slate-700">
                {loading ? 'Connecting' : error ? 'Offline' : 'Online'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 flex-1 w-full space-y-8">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
          <div className="absolute top-0 right-0 -mt-12 -mr-12 h-64 w-64 rounded-full bg-indigo-50/60 blur-3xl pointer-events-none"></div>
          
          <div className="relative z-10 max-w-3xl">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-3">
              Phase 0 · Setup
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-2">
              Academic records, attendance, fees, and progress cards.
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mb-6 max-w-2xl">
              System for 110 students. Built on Cloudflare Workers, Hono API, D1 SQLite, R2 files, and React.
            </p>

            {/* Health Card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 max-w-md">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs uppercase tracking-wider text-slate-500 font-semibold">API Health Status</h3>
                <span className="text-xs font-mono text-slate-400">/api/health</span>
              </div>
              
              {loading && <p className="text-xs text-amber-600 font-medium">Checking health status...</p>}
              {error && <p className="text-xs text-rose-600 font-medium">Connection failed: {error}</p>}
              {health && (
                <div className="space-y-1 text-xs text-slate-700">
                  <div className="flex justify-between py-0.5 border-b border-slate-200/60">
                    <span className="text-slate-500">Status</span>
                    <span className="font-semibold text-emerald-700 bg-emerald-100/60 px-1.5 py-0.2 rounded text-[11px]">
                      {health.status}
                    </span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-slate-200/60">
                    <span className="text-slate-500">Environment</span>
                    <span className="font-mono text-slate-800">{health.environment}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-500">Timestamp</span>
                    <span className="font-mono text-slate-800">{health.timestamp}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* System Modules */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 tracking-wide uppercase">Core Modules</h3>
            <span className="text-xs text-slate-500">8 Modules Planned</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                title: 'Progress Cards',
                desc: 'Marks and grades for monthly, semester, and degree exams.',
                svg: (
                  <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 012-2h2a2 2 0 012 2v6m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                )
              },
              {
                title: 'Fee Register',
                desc: 'Record charges and payments with full audit history.',
                svg: (
                  <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )
              },
              {
                title: 'Attendance',
                desc: 'Daily class marking and summary statistics.',
                svg: (
                  <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )
              },
              {
                title: 'Leave Register',
                desc: 'Leave requests, approvals, and schedule validation.',
                svg: (
                  <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )
              },
              {
                title: 'Reading Logs',
                desc: 'Track reading progress and teacher notes.',
                svg: (
                  <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                )
              },
              {
                title: 'Daily Routine',
                desc: 'Checklists for daily student habits.',
                svg: (
                  <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )
              },
              {
                title: 'Achievements',
                desc: 'Student awards and R2 photo uploads.',
                svg: (
                  <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4m6 17v-5m0 0a5 5 0 005-5V7a2 2 0 00-2-2H5a2 2 0 00-2 2v5a5 5 0 005 5m5 0h-5" />
                  </svg>
                )
              },
              {
                title: 'Access Control',
                desc: 'Role permissions for Admin, Teachers, and Students.',
                svg: (
                  <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )
              },
            ].map((item, index) => (
              <div
                key={index}
                className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-3">
                  {item.svg}
                </div>
                <h4 className="font-semibold text-slate-900 text-sm mb-1">{item.title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Mandatory Trust & Compliance Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 px-4 text-xs text-slate-600">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-900">Student Management System</span>
            <span>·</span>
            <span>Cloudflare Account Hosting</span>
          </div>

          {/* Legal / Mandatory Pages Links */}
          <div className="flex flex-wrap justify-center gap-4 text-slate-600">
            <button onClick={() => setActiveModal('privacy')} className="hover:text-indigo-600 font-medium transition-colors cursor-pointer">
              Privacy Policy
            </button>
            <button onClick={() => setActiveModal('terms')} className="hover:text-indigo-600 font-medium transition-colors cursor-pointer">
              Terms of Service
            </button>
            <button onClick={() => setActiveModal('contact')} className="hover:text-indigo-600 font-medium transition-colors cursor-pointer">
              Contact
            </button>
            <button onClick={() => setActiveModal('faq')} className="hover:text-indigo-600 font-medium transition-colors cursor-pointer">
              FAQ
            </button>
            <button onClick={() => setActiveModal('security')} className="hover:text-indigo-600 font-medium transition-colors cursor-pointer">
              Security
            </button>
          </div>
        </div>
      </footer>

      {/* Modal for Mandatory Legal / Trust Information */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
              aria-label="Close modal"
            >
              ✕
            </button>

            {activeModal === 'privacy' && (
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Privacy Policy</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  This system processes personal educational data including student attendance, exam records, fees, and leave requests strictly for institutional administration.
                </p>
                <ul className="text-xs text-slate-600 list-disc list-inside space-y-1">
                  <li>Data stored securely in encrypted Cloudflare D1 databases.</li>
                  <li>No third-party tracking or advertising cookies.</li>
                  <li>Access restricted strictly by user roles (Admin, Teacher, Student).</li>
                </ul>
              </div>
            )}

            {activeModal === 'terms' && (
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Terms of Service</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  Authorized access only. All actions within the Student Management System are logged for security and compliance.
                </p>
                <ul className="text-xs text-slate-600 list-disc list-inside space-y-1">
                  <li>Users must maintain password confidentiality.</li>
                  <li>Fee and mark entries are subject to administrative audit logs.</li>
                  <li>System access terminates upon student graduation or staff resignation.</li>
                </ul>
              </div>
            )}

            {activeModal === 'contact' && (
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Contact &amp; Support</h3>
                <p className="text-xs text-slate-600 mb-3">
                  For system administration, credential resets, or data updates:
                </p>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1 font-mono text-slate-700">
                  <p><strong>Office:</strong> Principal Administration Office</p>
                  <p><strong>Email:</strong> admin@institution.edu</p>
                  <p><strong>Hours:</strong> Mon – Fri, 9:00 AM – 4:00 PM</p>
                </div>
              </div>
            )}

            {activeModal === 'faq' && (
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Frequently Asked Questions</h3>
                <div className="space-y-3 text-xs text-slate-600">
                  <div>
                    <h4 className="font-semibold text-slate-800">Who can see my fee details?</h4>
                    <p>Only administrative staff and the individual student can view fee balances. Teachers do not have access.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800">How do leave approvals work?</h4>
                    <p>Students submit requests online. Assigned class teachers or admin review and approve them.</p>
                  </div>
                </div>
              </div>
            )}

            {activeModal === 'security' && (
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Security &amp; Data Protection</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  Built on Cloudflare global edge infrastructure following strict security guidelines.
                </p>
                <ul className="text-xs text-slate-600 list-disc list-inside space-y-1">
                  <li>HttpOnly, Secure, SameSite session cookies.</li>
                  <li>Parameterized database queries via Drizzle ORM.</li>
                  <li>Cloudflare R2 authenticated file storage for achievement uploads.</li>
                </ul>
              </div>
            )}

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
