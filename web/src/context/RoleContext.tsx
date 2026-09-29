import React, { createContext, useContext, useState, useEffect } from 'react';
import { Role } from '../types';

interface RoleContextType {
  role: Role;
  setRole: (role: Role) => void;
  studentId: string;
  setStudentId: (id: string) => void;
  studentName: string;
  setStudentName: (name: string) => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<Role>(() => {
    return (localStorage.getItem('lessonfoundry_role') as Role) || 'teacher';
  });

  const [studentId, setStudentIdState] = useState<string>(() => {
    return localStorage.getItem('lessonfoundry_student_id') || '1';
  });

  const [studentName, setStudentName] = useState<string>('Alex Chen');

  useEffect(() => {
    localStorage.setItem('lessonfoundry_role', role);
  }, [role]);

  useEffect(() => {
    localStorage.setItem('lessonfoundry_student_id', studentId);
  }, [studentId]);

  const setRole = (newRole: Role) => {
    setRoleState(newRole);
    localStorage.setItem('lessonfoundry_role', newRole);
  };

  const setStudentId = (newId: string) => {
    setStudentIdState(newId);
    localStorage.setItem('lessonfoundry_student_id', newId);
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
