import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInstitution } from '../context/InstitutionContext';
import {
  AcademicCapIcon,
  UserIcon,
  CreditCardIcon,
  CalendarIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  BookIcon,
  ShieldIcon,
  AdjustmentsHorizontalIcon,
  ChevronRightIcon,
} from '../components/Icons';

interface SubModule {
  title: string;
  description: string;
  href: string;
  icon: React.FC<{ className?: string }>;
  tag: string;
  accentColor: string;
  accentBg: string;
}

interface SectionCard {
  id: string;
  title: string;
  description: string;
  icon: React.FC<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  roles: ('admin' | 'teacher' | 'student')[];
  modules: SubModule[];
}

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { institutionName } = useInstitution();
  const [activeTab, setActiveTab] = useState<string>('all');

  if (!user) return null;

  const role = user.role;

  const sections: SectionCard[] = [
    {
      id: 'academics',
      title: 'Academics & Operations',
      description: 'Manage class rosters, subject allocations, daily attendance, exam mark grids, and progress cards.',
      icon: AcademicCapIcon,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200',
      roles: ['admin', 'teacher', 'student'],
      modules: [
        ...(role === 'admin' || role === 'teacher'
          ? [
              {
                title: role === 'admin' ? 'Academic & Classes' : 'My Classes & Subjects',
                description: 'Class definitions, streams, subject allocations, and batch management.',
                href: '/academic',
                icon: AcademicCapIcon,
                tag: 'Classes',
                accentColor: 'text-indigo-600',
                accentBg: 'bg-indigo-50/80',
              },
            ]
          : []),
        {
          title: role === 'student' ? 'My Attendance' : 'Attendance Register',
          description: 'Mark daily attendance, generate statistical logs, and view history.',
          href: '/attendance',
          icon: CheckCircleIcon,
          tag: 'Attendance',
          accentColor: 'text-emerald-600',
          accentBg: 'bg-emerald-50/80',
        },
        {
          title: role === 'student' ? 'Progress Card' : 'Exams & Marks Entry',
          description: 'Exam score entry, grade boundary rules, and printable progress cards.',
          href: '/exams',
          icon: DocumentTextIcon,
          tag: 'Exams',
          accentColor: 'text-blue-600',
          accentBg: 'bg-blue-50/80',
        },
        {
          title: role === 'student' ? 'My Performance Charts' : 'Performance Analytics',
          description: 'Bar, line, and pie visualizations of attendance trends and exam scores.',
          href: '/analytics',
          icon: DocumentTextIcon,
          tag: 'Analytics',
          accentColor: 'text-purple-600',
          accentBg: 'bg-purple-50/80',
        },
      ],
    },
    {
      id: 'people',
      title: 'People & Directory',
      description: 'Directory of student profiles, teaching faculty, and administrative user credentials.',
      icon: UserIcon,
      color: 'text-sky-600',
      bgColor: 'bg-sky-50',
      borderColor: 'border-sky-200',
      roles: ['admin', 'teacher', 'student'],
      modules: [
        {
          title: role === 'admin' ? 'Students Directory' : role === 'teacher' ? 'My Students' : 'My Student Profile',
          description: 'Personal details, enrollment data, guardian info, and status records.',
          href: '/students',
          icon: UserIcon,
          tag: 'Directory',
          accentColor: 'text-sky-600',
          accentBg: 'bg-sky-50/80',
        },
        ...(role === 'admin'
          ? [
              {
                title: 'Teachers Directory',
                description: 'Faculty management, subject specializations, and class assignments.',
                href: '/teachers',
                icon: BookIcon,
                tag: 'Faculty',
                accentColor: 'text-amber-600',
                accentBg: 'bg-amber-50/80',
              },
              {
                title: 'User Accounts',
                description: 'User account creation, role delegation (Admin/Teacher/Student), and security.',
                href: '/admin-users',
                icon: ShieldIcon,
                tag: 'Security',
                accentColor: 'text-rose-600',
                accentBg: 'bg-rose-50/80',
              },
            ]
          : []),
      ],
    },
    {
      id: 'finance-hr',
      title: 'Finance & HR',
      description: 'Track tuition fee registers, payment receipts, due dates, and student/staff leave requests.',
      icon: CreditCardIcon,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      roles: ['admin', 'teacher', 'student'],
      modules: [
        ...(role === 'admin' || role === 'student'
          ? [
              {
                title: role === 'student' ? 'My Fee Register' : 'Fee Register & Payments',
                description: 'Tuition fees, dues breakdown, payment logging, and overdue tracking.',
                href: '/fees',
                icon: CreditCardIcon,
                tag: 'Finance',
                accentColor: 'text-emerald-600',
                accentBg: 'bg-emerald-50/80',
              },
            ]
          : []),
        {
          title: role === 'student' ? 'My Leave Requests' : 'Leave Register',
          description: 'Submit leave applications, process approvals, and review leave balances.',
          href: '/leaves',
          icon: CalendarIcon,
          tag: 'Leave HR',
          accentColor: 'text-teal-600',
          accentBg: 'bg-teal-50/80',
        },
      ],
    },
    ...(role === 'admin'
      ? [
          {
            id: 'settings',
            title: 'System Settings',
            description: 'Institution identity configuration, branding customization, and system options.',
            icon: AdjustmentsHorizontalIcon,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
            borderColor: 'border-purple-200',
            roles: ['admin'] as ('admin' | 'teacher' | 'student')[],
            modules: [
              {
                title: 'Institution Branding',
                description: 'Update institution official name, upload header logo, and set site options.',
                href: '/settings',
                icon: AdjustmentsHorizontalIcon,
                tag: 'System',
                accentColor: 'text-purple-600',
                accentBg: 'bg-purple-50/80',
              },
            ],
          },
        ]
      : []),
  ];

  // Filter sections accessible to current role
  const availableSections = sections.filter(
    (s) => s.roles.includes(role) && s.modules.length > 0
  );

  // Active section filtering for Gallery Tabs
  const displayedSections = activeTab === 'all'
    ? availableSections
    : availableSections.filter((s) => s.id === activeTab);

  const totalModulesCount = availableSections.reduce((acc, s) => acc + s.modules.length, 0);

  return (
    <div className="space-y-10 pb-16">
      {/* Welcome Hero Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900 text-white rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden border border-indigo-800/40">
        <div className="absolute -right-10 -top-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-1/4 -bottom-10 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-3.5 py-1 text-[11px] font-black tracking-widest uppercase bg-indigo-500/30 backdrop-blur-md text-indigo-200 rounded-full border border-indigo-400/30 shadow-xs">
              {role} Portal
            </span>
            <span className="text-xs text-indigo-200 font-medium tracking-wide flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{institutionName}</span>
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight">
            Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-sky-200 to-white">{user.email}</span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed font-normal">
            Explore the system section gallery below. Choose any section card or module tile to launch management workflows.
          </p>
        </div>
      </div>

      {/* GALLERY CONTROL BAR & FILTER TABS */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">System Gallery & Modules</h2>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Role-authorized workspace cards & quick launcher tiles
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-600">
            <span className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl border border-slate-200/80">
              {totalModulesCount} Modules
            </span>
            <span className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl border border-indigo-200/80 font-bold">
              {availableSections.length} Sections
            </span>
          </div>
        </div>

        {/* Gallery Section Filter Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition duration-200 cursor-pointer whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            All Sections ({availableSections.length})
          </button>
          {availableSections.map((sec) => {
            const isCurrent = activeTab === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveTab(sec.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition duration-200 cursor-pointer whitespace-nowrap ${
                  isCurrent
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {sec.title} ({sec.modules.length})
              </button>
            );
          })}
        </div>
      </div>

      {/* GALLERY SECTIONS GRID */}
      <div className="space-y-12">
        {displayedSections.map((section) => {
          const SectionIcon = section.icon;

          return (
            <section key={section.id} className="space-y-5">
              {/* Clean Section Header (No heavy background) */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center space-x-3">
                  <div className={`w-9 h-9 rounded-xl ${section.bgColor} ${section.color} border ${section.borderColor} flex items-center justify-center shrink-0`}>
                    <SectionIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold tracking-tight text-slate-900">{section.title}</h3>
                    <p className="text-xs text-slate-500 font-medium line-clamp-1">{section.description}</p>
                  </div>
                </div>

                <span className="hidden sm:inline-flex text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                  {section.modules.length} {section.modules.length === 1 ? 'module' : 'modules'}
                </span>
              </div>

              {/* Module Cards Gallery Tiles Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {section.modules.map((mod) => {
                  const ModIcon = mod.icon;

                  return (
                    <Link
                      key={mod.href}
                      to={mod.href}
                      className="group bg-white border border-slate-200/90 hover:border-indigo-300 rounded-2xl p-5 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between space-y-4 relative overflow-hidden"
                    >
                      {/* Top bar with tag & icon */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className={`w-10 h-10 rounded-xl ${mod.accentBg} ${mod.accentColor} border border-slate-200/50 flex items-center justify-center transition group-hover:scale-110 duration-200`}>
                            <ModIcon className="w-5 h-5" />
                          </div>

                          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200/70 group-hover:bg-indigo-50 group-hover:text-indigo-700 transition">
                            {mod.tag}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {mod.title}
                          </h4>
                          <p className="text-xs text-slate-500 font-normal leading-relaxed mt-1 line-clamp-2">
                            {mod.description}
                          </p>
                        </div>
                      </div>

                      {/* Action Footer Callout */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600 group-hover:text-indigo-600 transition">
                        <span>Launch Module</span>
                        <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-indigo-600 text-slate-500 group-hover:text-white flex items-center justify-center transition duration-200">
                          <ChevronRightIcon className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
