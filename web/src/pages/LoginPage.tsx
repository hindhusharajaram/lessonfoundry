import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, GraduationCap, School, ArrowRight } from 'lucide-react';
import { useRole } from '../context/RoleContext';
import { api } from '../services/api';
import { TeacherIllustration } from '../components/TeacherIllustration';
import { StudentIllustration } from '../components/StudentIllustration';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setRole, setStudentId, setStudentName, setTeacherName, setTeacherEmail } = useRole();

  // Active portal state: 'teacher' | 'student'
  const [activePortal, setActivePortal] = useState<'teacher' | 'student'>('student');
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const isFormValid = username.trim().length > 0 && password.trim().length > 0;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isFormValid) return;

    const cleanUser = username.trim();
    const email = cleanUser.includes('@')
      ? cleanUser.toLowerCase()
      : `${cleanUser.toLowerCase().replace(/ /g, '.')}@lessonfoundry.edu`;
    const cleanName = cleanUser.includes('@') ? cleanUser.split('@')[0] : cleanUser;
    const formatted = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

    try {
      let authUser: any = null;
      try {
        authUser = await api.login({ email, password });
      } catch (loginErr: any) {
        if (loginErr.status === 401 || loginErr.status === 404 || isSignUp) {
          authUser = await api.register({
            name: formatted,
            email,
            password,
            role: activePortal,
          });
        } else {
          throw loginErr;
        }
      }

      if (authUser) {
        if (activePortal === 'teacher') {
          setRole('teacher');
          setTeacherName(authUser.name || formatted);
          setTeacherEmail(authUser.email || email);
          localStorage.setItem('lessonfoundry_user_id', String(authUser.user_id));
          localStorage.setItem('lessonfoundry_teacher_name', authUser.name || formatted);
          localStorage.setItem('lessonfoundry_email', authUser.email || email);
          localStorage.setItem('lessonfoundry_role', 'teacher');
          navigate('/units');
        } else {
          setRole('student');
          setStudentName(authUser.name || formatted);
          const stId = String(authUser.student_id || authUser.user_id || '1');
          setStudentId(stId);
          localStorage.setItem('lessonfoundry_user_id', String(authUser.user_id));
          localStorage.setItem('lessonfoundry_student_id', stId);
          localStorage.setItem('lessonfoundry_student_name', authUser.name || formatted);
          localStorage.setItem('lessonfoundry_email', authUser.email || email);
          localStorage.setItem('lessonfoundry_role', 'student');
          navigate('/student');
        }
      }
    } catch (err) {
      console.warn('Backend login fallback to local session:', err);
      if (activePortal === 'teacher') {
        setRole('teacher');
        setTeacherName(formatted);
        setTeacherEmail(email);
        localStorage.setItem('lessonfoundry_role', 'teacher');
        localStorage.setItem('lessonfoundry_teacher_name', formatted);
        localStorage.setItem('lessonfoundry_email', email);
        navigate('/units');
      } else {
        setRole('student');
        setStudentName(formatted);
        setStudentId('1');
        localStorage.setItem('lessonfoundry_role', 'student');
        localStorage.setItem('lessonfoundry_student_id', '1');
        localStorage.setItem('lessonfoundry_student_name', formatted);
        localStorage.setItem('lessonfoundry_email', email);
        navigate('/student');
      }
    }
  };

  const handleToggleSignUp = () => {
    if (!isSignUp && isFormValid) {
      // If user filled form and clicked "Sign up", immediately complete sign up and login
      handleSubmit();
    } else {
      // Toggle between login and sign up mode
      setIsSignUp(!isSignUp);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#070D24] flex items-center justify-center p-3 sm:p-6 lg:p-8 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Main Split-Screen Container Card */}
      <div className="w-full max-w-[1240px] min-h-[720px] lg:h-[780px] bg-[#0B1437] rounded-3xl md:rounded-[32px] overflow-hidden shadow-2xl shadow-black/60 flex flex-col md:flex-row border border-slate-800/80">
        
        {/* ================= LEFT HALF: DARK NAVY FORM ================= */}
        <div className="w-full md:w-[46%] lg:w-[42%] bg-[#0B1437] flex flex-col justify-between p-8 sm:p-12 lg:p-14 text-white z-10">
          {/* Top Brand Logo */}
          <div className="flex items-center">
            <span className="font-extrabold text-2xl tracking-tight text-white">LessonFoundry</span>
          </div>

          {/* Center Form Section */}
          <div className="my-8 sm:my-auto max-w-sm w-full mx-auto md:mx-0">
            <div className="mb-8">
              <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                {isSignUp ? 'Sign up' : 'Login'}
              </h1>
              <p className="text-sm text-slate-400 mt-2">
                {isSignUp ? 'Create your account to get started' : 'Enter your account details'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username Input */}
              <div>
                <label
                  htmlFor="login-username"
                  className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2"
                >
                  Username
                </label>
                <div className="relative">
                  <input
                    id="login-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={activePortal === 'teacher' ? 'teacher@school.edu' : 'alex.chen'}
                    className="w-full bg-[#111C44]/90 border border-slate-700/80 rounded-xl px-4 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/30 transition-all duration-150"
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password Input with show/hide toggle */}
              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-[#111C44]/90 border border-slate-700/80 rounded-xl pl-4 pr-12 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/30 transition-all duration-150"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 rounded-lg transition-colors focus:outline-none cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Forgot Password Link */}
              {!isSignUp && (
                <div className="flex justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={(e) => e.preventDefault()}
                    className="text-xs text-slate-400 hover:text-indigo-400 transition-colors focus:outline-none cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}

              {/* Submit Button */}
              <button
                id="login-submit-button"
                type="submit"
                disabled={!isFormValid}
                className={`w-full py-3.5 px-6 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all duration-200 shadow-lg ${
                  isFormValid
                    ? 'bg-[#4F46E5] hover:bg-[#4338CA] active:scale-[0.99] shadow-indigo-600/30 cursor-pointer'
                    : 'bg-indigo-900/50 text-slate-400 border border-indigo-800/40 cursor-not-allowed shadow-none'
                }`}
              >
                <span>{isSignUp ? 'Sign up' : 'Login'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Bottom Row: Working Toggle between Login and Sign up */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-800/80 text-xs">
            <span className="text-slate-400">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            </span>
            <button
              type="button"
              id="signup-toggle-button"
              onClick={handleToggleSignUp}
              className="px-4 py-2 rounded-xl bg-[#111C44] border border-slate-700/80 text-slate-200 font-semibold hover:border-indigo-500 hover:text-white transition-all duration-150 cursor-pointer"
            >
              {isSignUp ? 'Log in' : 'Sign up'}
            </button>
          </div>
        </div>

        {/* ================= RIGHT HALF: INDIGO/PURPLE GRADIENT CARD ================= */}
        <div className="w-full md:w-[54%] lg:w-[58%] m-0 md:m-3 rounded-2xl md:rounded-[26px] bg-gradient-to-br from-[#6366F1] via-[#4F46E5] to-[#3730A3] relative overflow-hidden flex flex-col justify-between p-8 sm:p-12 lg:p-14 text-white shadow-inner">
          
          {/* Background Decorative Blobs */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-2xl transform rotate-12" />
            <svg
              className="absolute inset-0 w-full h-full opacity-20"
              viewBox="0 0 600 700"
              fill="none"
              preserveAspectRatio="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M-50 150 Q150 80 320 220 T650 180 L650 750 L-50 750 Z"
                fill="white"
                fillOpacity="0.12"
              />
              <path
                d="M-50 350 Q200 240 380 420 T700 380 L700 750 L-50 750 Z"
                fill="white"
                fillOpacity="0.08"
              />
            </svg>
            <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-indigo-900/40 blur-3xl" />
          </div>

          {/* Top Row: Portal Switch Control (Teacher Studio badge removed per request) */}
          <div className="relative z-10 flex items-center justify-between gap-4">
            {/* Pill-shaped Role Switcher */}
            <div
              id="portal-switch-container"
              className="p-1.5 rounded-full bg-black/25 backdrop-blur-md border border-white/20 inline-flex items-center shadow-lg"
              role="tablist"
              aria-label="Select Portal"
            >
              <button
                id="portal-switch-teacher"
                type="button"
                role="tab"
                aria-selected={activePortal === 'teacher'}
                onClick={() => setActivePortal('teacher')}
                className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                  activePortal === 'teacher'
                    ? 'bg-white text-slate-900 shadow-md scale-100'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <School className="w-3.5 h-3.5" />
                <span>Teacher</span>
              </button>

              <button
                id="portal-switch-student"
                type="button"
                role="tab"
                aria-selected={activePortal === 'student'}
                onClick={() => setActivePortal('student')}
                className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                  activePortal === 'student'
                    ? 'bg-white text-slate-900 shadow-md scale-100'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Student</span>
              </button>
            </div>
          </div>

          {/* Dynamic Headline Area */}
          <div className="relative z-10 my-6">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.12]">
              {activePortal === 'teacher' ? (
                <>
                  Welcome to <br />
                  <span className="text-white">Teacher Studio</span>
                </>
              ) : (
                <>
                  Welcome to <br />
                  <span className="text-white">Student Portal</span>
                </>
              )}
            </h2>
            <p className="text-sm lg:text-base text-indigo-100/85 mt-2.5 font-normal">
              {isSignUp ? 'Create your account to get started' : 'Login to access your account'}
            </p>
          </div>

          {/* Dynamic Illustration Area */}
          <div className="relative z-10 flex-1 flex items-center justify-center my-2 max-h-[420px]">
            {activePortal === 'teacher' ? (
              <div
                key="teacher-ill"
                className="w-full max-w-[420px] transition-all duration-300 transform scale-100"
              >
                <TeacherIllustration className="w-full h-auto drop-shadow-2xl" />
              </div>
            ) : (
              <div
                key="student-ill"
                className="w-full max-w-[420px] transition-all duration-300 transform scale-100"
              >
                <StudentIllustration className="w-full h-auto drop-shadow-2xl" />
              </div>
            )}
          </div>

          {/* Bottom subtext footer removed per annotated markings */}
        </div>

      </div>
    </div>
  );
};

export default LoginPage;
