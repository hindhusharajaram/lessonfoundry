import React, { createContext, useContext, useState, useEffect } from 'react';
import { Role } from '../types';

interface RoleContextType {
  role: Role | null;
  setRole: (role: Role | null) => void;
  studentId: string;
  setStudentId: (id: string) => void;
  studentName: string;
  setStudentName: (name: string) => void;
  teacherName: string;
  setTeacherName: (name: string) => void;
  teacherEmail: string;
  setTeacherEmail: (email: string) => void;
  avatarUrl: string | null;
  setAvatarUrl: (url: string | null) => void;
  logout: () => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<Role | null>(() => {
    return (localStorage.getItem('lessonfoundry_role') as Role) || null;
  });

  const [studentId, setStudentIdState] = useState<string>(() => {
    return localStorage.getItem('lessonfoundry_student_id') || '1';
  });

  const [studentName, setStudentName] = useState<string>(() => {
    return localStorage.getItem('lessonfoundry_student_name') || 'Alex Chen';
  });

  const [teacherName, setTeacherNameState] = useState<string>(() => {
    return localStorage.getItem('lessonfoundry_teacher_name') || 'Hindhusha Rajaram';
  });

  const [teacherEmail, setTeacherEmailState] = useState<string>(() => {
    return localStorage.getItem('lessonfoundry_email') || 'hindhusha@lessonfoundry.edu';
  });

  const [avatarUrl, setAvatarUrlState] = useState<string | null>(() => {
    return localStorage.getItem('lessonfoundry_avatar') || null;
  });

  useEffect(() => {
    if (role) {
      localStorage.setItem('lessonfoundry_role', role);
    } else {
      localStorage.removeItem('lessonfoundry_role');
    }
  }, [role]);

  useEffect(() => {
    localStorage.setItem('lessonfoundry_student_id', studentId);
  }, [studentId]);

  useEffect(() => {
    localStorage.setItem('lessonfoundry_teacher_name', teacherName);
  }, [teacherName]);

  useEffect(() => {
    localStorage.setItem('lessonfoundry_email', teacherEmail);
  }, [teacherEmail]);

  const setRole = (newRole: Role | null) => {
    setRoleState(newRole);
    if (newRole) {
      localStorage.setItem('lessonfoundry_role', newRole);
    } else {
      localStorage.removeItem('lessonfoundry_role');
    }
  };

  const setStudentId = (newId: string) => {
    setStudentIdState(newId);
    localStorage.setItem('lessonfoundry_student_id', newId);
  };

  const setTeacherName = (name: string) => {
    setTeacherNameState(name);
    localStorage.setItem('lessonfoundry_teacher_name', name);
  };

  const setTeacherEmail = (email: string) => {
    setTeacherEmailState(email);
    localStorage.setItem('lessonfoundry_email', email);
  };

  const setAvatarUrl = (url: string | null) => {
    setAvatarUrlState(url);
    if (url) {
      localStorage.setItem('lessonfoundry_avatar', url);
    } else {
      localStorage.removeItem('lessonfoundry_avatar');
    }
  };

  const logout = () => {
    localStorage.removeItem('lessonfoundry_token');
    localStorage.removeItem('lessonfoundry_role');
    localStorage.removeItem('lessonfoundry_teacher_name');
    localStorage.removeItem('lessonfoundry_student_id');
    localStorage.removeItem('lessonfoundry_email');
    localStorage.removeItem('lessonfoundry_username');
    localStorage.removeItem('lessonfoundry_student_name');
    localStorage.removeItem('lessonfoundry_avatar');
    setRoleState(null);
    setAvatarUrlState(null);
  };

  return (
    <RoleContext.Provider
      value={{
        role,
        setRole,
        studentId,
        setStudentId,
        studentName,
        setStudentName,
        teacherName,
        setTeacherName,
        teacherEmail,
        setTeacherEmail,
        avatarUrl,
        setAvatarUrl,
        logout,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = (): RoleContextType => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
};
