import React, { createContext, useContext, useState, useEffect } from 'react';

interface AccessibilityContextType {
  dyslexiaMode: boolean;
  setDyslexiaMode: (v: boolean) => void;
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
  textSize: 'normal' | 'lg' | 'xl';
  setTextSize: (s: 'normal' | 'lg' | 'xl') => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dyslexiaMode, setDyslexiaMode] = useState<boolean>(() => {
    return localStorage.getItem('lf_dyslexia') === 'true';
  });

  const [highContrast, setHighContrast] = useState<boolean>(() => {
    return localStorage.getItem('lf_contrast') === 'true';
  });

  const [textSize, setTextSize] = useState<'normal' | 'lg' | 'xl'>(() => {
    return (localStorage.getItem('lf_textsize') as any) || 'normal';
  });

  useEffect(() => {
    localStorage.setItem('lf_dyslexia', String(dyslexiaMode));
    if (dyslexiaMode) {
      document.body.classList.add('dyslexia-mode');
    } else {
      document.body.classList.remove('dyslexia-mode');
    }
  }, [dyslexiaMode]);

  useEffect(() => {
    localStorage.setItem('lf_contrast', String(highContrast));
    if (highContrast) {
      document.body.classList.add('contrast-high');
    } else {
      document.body.classList.remove('contrast-high');
    }
  }, [highContrast]);

  useEffect(() => {
    localStorage.setItem('lf_textsize', textSize);
    document.body.classList.remove('text-size-lg', 'text-size-xl');
    if (textSize === 'lg') document.body.classList.add('text-size-lg');
    if (textSize === 'xl') document.body.classList.add('text-size-xl');
  }, [textSize]);

  return (
    <AccessibilityContext.Provider
      value={{
        dyslexiaMode,
        setDyslexiaMode,
        highContrast,
        setHighContrast,
        textSize,
        setTextSize,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = (): AccessibilityContextType => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider');
  }
  return context;
};
