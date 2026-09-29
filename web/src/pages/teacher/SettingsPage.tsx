import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, CheckCircle2, RotateCcw } from 'lucide-react';
import { useRole } from '../../context/RoleContext';
import { Button } from '../../components/common/Button';

export const SettingsPage: React.FC = () => {
  const {
    role,
    teacherName,
    teacherEmail,
    studentName,
    setTeacherName,
    setTeacherEmail,
    setStudentName,
    avatarUrl,
    setAvatarUrl,
  } = useRole();

  const isTeacher = role === 'teacher';
  const initialFullName = isTeacher
    ? (teacherName || localStorage.getItem('lessonfoundry_teacher_name') || 'Hindhusharajaram')
    : (studentName || 'Alex Chen');

  const initialEmail = isTeacher
    ? (teacherEmail || localStorage.getItem('lessonfoundry_email') || 'hindhusha@lessonfoundry.edu')
    : 'alex.chen@student.lessonfoundry.edu';

  // Helper to split full name
  const splitName = (fullName: string): { first: string; last: string } => {
    if (!fullName) return { first: '', last: '' };
    const trimmed = fullName.trim();
    const firstSpaceIndex = trimmed.indexOf(' ');
    if (firstSpaceIndex === -1) {
      return { first: trimmed, last: '' };
    }
    return {
      first: trimmed.slice(0, firstSpaceIndex),
      last: trimmed.slice(firstSpaceIndex + 1),
    };
  };

  const initialSplit = splitName(initialFullName);
  const [firstName, setFirstName] = useState<string>(initialSplit.first);
  const [lastName, setLastName] = useState<string>(initialSplit.last);
  const [email, setEmail] = useState<string>(initialEmail);
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(avatarUrl);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if context changes externally
  useEffect(() => {
    const split = splitName(initialFullName);
    setFirstName(split.first);
    setLastName(split.last);
    setEmail(initialEmail);
    setCurrentAvatar(avatarUrl);
  }, [initialFullName, initialEmail, avatarUrl]);

  // Compute initials: e.g. "HI" for Hindhusharajaram
  const getInitials = (first: string, last: string): string => {
    const combined = [first.trim(), last.trim()].filter(Boolean).join(' ');
    if (!combined) return 'LF';
    const parts = combined.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return combined.slice(0, 2).toUpperCase();
  };

  const initials = getInitials(firstName, lastName);

  // Check if any edits were made
  const hasChanges =
    firstName !== initialSplit.first ||
    lastName !== initialSplit.last ||
    email !== initialEmail ||
    currentAvatar !== avatarUrl;

  // Handle image upload from computer
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 10MB)
    const maxSizeBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setFileError('File size exceeds 10MB limit. Please choose a smaller image.');
      return;
    }

    // Validate type
    if (!file.type.startsWith('image/')) {
      setFileError('Please select a valid image file (PNG, JPEG, GIF, or WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setCurrentAvatar(result);
        setSaveSuccess(false);
      }
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be re-selected if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = () => {
    setCurrentAvatar(null);
    setFileError(null);
    setSaveSuccess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = () => {
    const combinedName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ') || 'Teacher';
    const cleanEmail = email.trim();

    if (isTeacher) {
      setTeacherName(combinedName);
      setTeacherEmail(cleanEmail);
      localStorage.setItem('lessonfoundry_teacher_name', combinedName);
      localStorage.setItem('lessonfoundry_email', cleanEmail);
    } else {
      setStudentName(combinedName);
      localStorage.setItem('lessonfoundry_student_name', combinedName);
    }

    setAvatarUrl(currentAvatar);
    if (currentAvatar) {
      localStorage.setItem('lessonfoundry_avatar', currentAvatar);
    } else {
      localStorage.removeItem('lessonfoundry_avatar');
    }

    setSaveSuccess(true);
    setFileError(null);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 4000);
  };

  const handleReset = () => {
    const split = splitName(initialFullName);
    setFirstName(split.first);
    setLastName(split.last);
    setEmail(initialEmail);
    setCurrentAvatar(avatarUrl);
    setFileError(null);
    setSaveSuccess(false);
  };

  // Check OAuth provider
  const oauthProvider = localStorage.getItem('lessonfoundry_oauth_provider');
  const isGoogleAuth = oauthProvider === 'google';

  return (
    <div className="max-w-3xl mx-auto font-sans animate-in py-2">
      {/* 1. Page Header: "Account" (plain, bold, no icon) */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Account
        </h1>

        {saveSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold animate-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Profile saved successfully!</span>
          </div>
        )}
      </div>

      {/* Main Settings Card Matching Reference Layout */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-8 sm:p-10 shadow-xs space-y-8">
        {/* 2. Profile Picture Section */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            {/* Circular Avatar (Initials or Uploaded Photo) */}
            <div className="relative shrink-0">
              {currentAvatar ? (
                <img
                  src={currentAvatar}
                  alt="Profile Avatar"
                  className="w-18 h-18 rounded-full object-cover border-2 border-indigo-100 shadow-sm"
                />
              ) : (
                <div
                  className="w-18 h-18 rounded-full bg-[#4F46E5] text-white flex items-center justify-center font-bold text-2xl shadow-xs select-none"
                  aria-label="Profile Initials"
                >
                  {initials}
                </div>
              )}
            </div>

            {/* Profile Picture Actions matching reference */}
            <div className="space-y-2.5">
              <h2 className="text-sm font-semibold text-slate-900">Profile Picture</h2>

              <div className="flex items-center gap-3">
                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/gif, image/webp"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="profile-picture-input"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#4F46E5] hover:bg-[#4338CA] text-white shadow-xs transition-colors cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload Image</span>
                </button>

                <button
                  type="button"
                  onClick={handleRemoveImage}
                  disabled={!currentAvatar}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    currentAvatar
                      ? 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer'
                      : 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  Remove
                </button>
              </div>

              <p className="text-xs text-slate-400">
                We support PNGs, JPEGs and GIFs under 10MB
              </p>

              {fileError && (
                <p className="text-xs text-rose-600 font-medium animate-in">
                  {fileError}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Thin Divider */}
        <hr className="border-t border-slate-100" />

        {/* 3. First Name / Last Name Fields, Side by Side (Editable) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
          <div>
            <label
              htmlFor="first-name-input"
              className="block text-sm font-semibold text-slate-900 mb-2"
            >
              First Name
            </label>
            <input
              id="first-name-input"
              type="text"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                setSaveSuccess(false);
              }}
              placeholder="First name"
              className="w-full bg-[#FAFAFA] hover:bg-white focus:bg-white border border-slate-200 focus:border-[#4F46E5] rounded-xl px-4 py-2.5 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/15 transition-all shadow-2xs"
            />
          </div>

          <div>
            <label
              htmlFor="last-name-input"
              className="block text-sm font-semibold text-slate-900 mb-2"
            >
              Last Name
            </label>
            <input
              id="last-name-input"
              type="text"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                setSaveSuccess(false);
              }}
              placeholder="Last name"
              className="w-full bg-[#FAFAFA] hover:bg-white focus:bg-white border border-slate-200 focus:border-[#4F46E5] rounded-xl px-4 py-2.5 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/15 transition-all shadow-2xs"
            />
          </div>
        </div>

        {/* 4. Email Field (Editable) */}
        <div className="max-w-md">
          <label
            htmlFor="email-input"
            className="block text-sm font-semibold text-slate-900 mb-2"
          >
            Email
          </label>
          <input
            id="email-input"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setSaveSuccess(false);
            }}
            placeholder="name@lessonfoundry.edu"
            className="w-full bg-[#FAFAFA] hover:bg-white focus:bg-white border border-slate-200 focus:border-[#4F46E5] rounded-xl px-4 py-2.5 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/15 transition-all shadow-2xs"
          />
        </div>

        {/* 5. Password Section */}
        {!isGoogleAuth && (
          <>
            <hr className="border-t border-slate-100" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Password</h2>
              </div>

              <div className="shrink-0">
                <span className="inline-flex items-center px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 text-slate-500 border border-slate-200">
                  Managed via Identity Provider
                </span>
              </div>
            </div>
          </>
        )}

        {/* 6. Save Action Bar */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {saveSuccess ? (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                All changes have been saved to your profile
              </span>
            ) : hasChanges ? (
              <span className="text-xs font-medium text-amber-600">
                You have unsaved changes
              </span>
            ) : (
              <span className="text-xs text-slate-400">
                Your profile information is up to date
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {hasChanges && (
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}

            <Button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges}
              className="rounded-xl px-6 py-2.5 text-xs font-semibold shadow-xs"
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
