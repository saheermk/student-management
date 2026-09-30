import React, { useState, useEffect, useRef } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AcademicPage } from './pages/AcademicPage';
import { TeachersPage } from './pages/TeachersPage';
import { StudentsPage } from './pages/StudentsPage';
import { AttendancePage } from './pages/AttendancePage';
import { ExamsPage } from './pages/ExamsPage';
import { FeesPage } from './pages/FeesPage';
import { LeavesPage } from './pages/LeavesPage';
import { SettingsPage } from './pages/SettingsPage';
import { DashboardPage } from './pages/DashboardPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { useInstitution } from './context/InstitutionContext';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import {
  ShieldIcon,
  LogoutIcon,
  UserIcon,
  SpinnerIcon,
  AcademicCapIcon,
  BookIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  CreditCardIcon,
  CalendarIcon,
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
  HomeIcon,
} from './components/Icons';

/**
 * Helper component to restrict route access based on user roles
 */
const ProtectedRoute: React.FC<{
  allowedRoles?: ('admin' | 'teacher' | 'student')[];
  element: React.ReactElement;
}> = ({ allowedRoles, element }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex justify-center items-center text-slate-500">
        <SpinnerIcon className="w-10 h-10 text-indigo-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return element;
};

interface NavItem {
  label: string;
  path: string;
  icon: React.FC<{ className?: string }>;
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  items: NavItem[];
}

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const { institutionName, logoUrl } = useInstitution();
  const location = useLocation();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setOpenDropdown(null);
  }, [location.pathname]);

  if (!user) return null;

  const isAdmin = user.role === 'admin';
  const isTeacher = user.role === 'teacher';

  const isActive = (path: string) => location.pathname === path;

  // Define section groups based on role
  const navGroups: NavGroup[] = [
    {
      id: 'academics',
      label: 'Academics',
      icon: AcademicCapIcon,
      items: [
        ...(isAdmin || isTeacher
          ? [
              {
                label: isAdmin ? 'Academic & Classes' : 'My Classes & Subjects',
                path: '/academic',
                icon: AcademicCapIcon,
              },
            ]
          : []),
        {
          label: user.role === 'student' ? 'My Attendance' : 'Attendance Register',
          path: '/attendance',
          icon: CheckCircleIcon,
        },
        {
          label: user.role === 'student' ? 'Progress Card' : 'Exams & Marks',
          path: '/exams',
          icon: DocumentTextIcon,
        },
        {
          label: user.role === 'student' ? 'My Performance Charts' : 'Performance Analytics',
          path: '/analytics',
          icon: DocumentTextIcon,
        },
      ],
    },
    {
      id: 'people',
      label: 'People',
      icon: UserIcon,
      items: [
        {
          label: isAdmin ? 'Students' : isTeacher ? 'My Students' : 'My Profile',
          path: '/students',
          icon: UserIcon,
        },
        ...(isAdmin
          ? [
              { label: 'Teachers', path: '/teachers', icon: BookIcon },
              { label: 'User Accounts', path: '/admin-users', icon: ShieldIcon },
            ]
          : []),
      ],
    },
    {
      id: 'finance-hr',
      label: 'Finance & HR',
      icon: CreditCardIcon,
      items: [
        ...(isAdmin || user.role === 'student'
          ? [
              {
                label: user.role === 'student' ? 'My Fees' : 'Fee Register',
                path: '/fees',
                icon: CreditCardIcon,
              },
            ]
          : []),
        {
          label: user.role === 'student' ? 'My Leaves' : 'Leave Register',
          path: '/leaves',
          icon: CalendarIcon,
        },
      ],
    },
    ...(isAdmin
      ? [
          {
            id: 'settings',
            label: 'Settings',
            icon: AdjustmentsHorizontalIcon,
            items: [{ label: 'Institution Settings', path: '/settings', icon: AdjustmentsHorizontalIcon }],
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <ChangePasswordModal />

      {/* Top Navigation Header */}
      <header className="bg-white border-b border-slate-200 text-slate-900 px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between shadow-xs sticky top-0 z-40">
        <div className="flex items-center space-x-6">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-9 h-9 p-1.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 flex items-center justify-center overflow-hidden group-hover:border-indigo-300 transition">
              {logoUrl ? (
                <img src={logoUrl} alt={institutionName} className="w-full h-full object-contain" />
              ) : (
                <ShieldIcon className="w-5 h-5" />
              )}
            </div>
            <span className="font-bold tracking-tight text-slate-900 text-base sm:text-lg group-hover:text-indigo-600 transition">
              {institutionName}
            </span>
          </Link>

          {/* Grouped Header Dropdown Navigation */}
          <nav ref={dropdownRef} className="hidden md:flex items-center space-x-1 relative">
            {/* Dashboard Link */}
            <Link
              to="/"
              className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                isActive('/')
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <HomeIcon className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>

            {/* Dropdown Section Groups */}
            {navGroups.map((group) => {
              const GroupIcon = group.icon;
              const hasActiveChild = group.items.some((item) => isActive(item.path));
              const isOpen = openDropdown === group.id;

              return (
                <div key={group.id} className="relative">
                  <button
                    onClick={() => setOpenDropdown(isOpen ? null : group.id)}
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      hasActiveChild
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : isOpen
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <GroupIcon className="w-4 h-4" />
                    <span>{group.label}</span>
                    <ChevronDownIcon
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-600' : 'text-slate-400'}`}
                    />
                  </button>

                  {/* Dropdown Menu Popup */}
                  {isOpen && (
                    <div className="absolute left-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                        {group.label} Section
                      </div>
                      {group.items.map((item) => {
                        const ItemIcon = item.icon;
                        const itemActive = isActive(item.path);

                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setOpenDropdown(null)}
                            className={`flex items-center space-x-2.5 px-3 py-2 text-xs font-semibold transition mx-1 rounded-xl ${
                              itemActive
                                ? 'bg-indigo-50 text-indigo-700 font-bold'
                                : 'text-slate-700 hover:bg-slate-50 hover:text-indigo-600'
                            }`}
                          >
                            <ItemIcon className={`w-4 h-4 ${itemActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* User Info & Actions */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            <UserIcon className="w-4 h-4 text-slate-500" />
            <span className="font-semibold">{user.email}</span>
            <span className="px-2 py-0.5 text-[10px] uppercase font-extrabold rounded-md bg-indigo-100 text-indigo-700 border border-indigo-200">
              {user.role}
            </span>
          </div>

          <button
            onClick={() => logout()}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            title="Sign Out"
          >
            <LogoutIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Mobile Navigation */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-2 flex items-center space-x-1 overflow-x-auto">
        <Link
          to="/"
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap ${
            isActive('/') ? 'bg-indigo-600 text-white' : 'text-slate-600 bg-slate-100'
          }`}
        >
          Dashboard
        </Link>
        {navGroups.flatMap((g) => g.items).map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap ${
              isActive(item.path) ? 'bg-indigo-600 text-white' : 'text-slate-600 bg-slate-100'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
    </div>
  );
};

const AuthWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex justify-center items-center text-slate-500">
        <SpinnerIcon className="w-10 h-10 text-indigo-600" />
      </div>
    );
  }
  if (user) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

export const App: React.FC = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get('token');

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route
            path="/login"
            element={
              resetToken ? (
                <ResetPasswordPage
                  token={resetToken}
                  onSuccess={() => {
                    window.history.replaceState({}, document.title, window.location.pathname);
                  }}
                />
              ) : (
                <AuthWrapper>
                  <LoginPage onNavigateForgotPassword={() => (window.location.href = '/forgot-password')} />
                </AuthWrapper>
              )
            }
          />
          <Route
            path="/forgot-password"
            element={
              <AuthWrapper>
                <ForgotPasswordPage onBackToLogin={() => (window.location.href = '/login')} />
              </AuthWrapper>
            }
          />
          <Route
            path="/reset-password"
            element={
              <ResetPasswordPage
                token={resetToken || ''}
                onSuccess={() => {
                  window.location.href = '/login';
                }}
              />
            }
          />

          {/* Protected Portal Routes */}
          <Route
            path="/"
            element={<ProtectedRoute element={<AppLayout><DashboardPage /></AppLayout>} />}
          />
          <Route
            path="/leaves"
            element={<ProtectedRoute element={<AppLayout><LeavesPage /></AppLayout>} />}
          />
          <Route
            path="/fees"
            element={<ProtectedRoute allowedRoles={['admin', 'student']} element={<AppLayout><FeesPage /></AppLayout>} />}
          />
          <Route
            path="/exams"
            element={<ProtectedRoute element={<AppLayout><ExamsPage /></AppLayout>} />}
          />
          <Route
            path="/analytics"
            element={<ProtectedRoute element={<AppLayout><AnalyticsPage /></AppLayout>} />}
          />
          <Route
            path="/attendance"
            element={<ProtectedRoute element={<AppLayout><AttendancePage /></AppLayout>} />}
          />
          <Route
            path="/students"
            element={<ProtectedRoute element={<AppLayout><StudentsPage /></AppLayout>} />}
          />
          <Route
            path="/academic"
            element={<ProtectedRoute element={<AppLayout><AcademicPage /></AppLayout>} />}
          />
          <Route
            path="/teachers"
            element={<ProtectedRoute allowedRoles={['admin']} element={<AppLayout><TeachersPage /></AppLayout>} />}
          />
          <Route
            path="/admin-users"
            element={<ProtectedRoute allowedRoles={['admin']} element={<AppLayout><AdminUsersPage /></AppLayout>} />}
          />
          <Route
            path="/settings"
            element={<ProtectedRoute allowedRoles={['admin']} element={<AppLayout><SettingsPage /></AppLayout>} />}
          />

          {/* Catch-All Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
