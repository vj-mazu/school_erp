import { create } from 'zustand';

export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: string;
  profilePhotoUrl?: string;
}

export interface School {
  id: string;
  name: string;
  diseCode: string;
  state: string;
  city: string;
  board: string;
}

export interface AcademicYear {
  id: string;
  name: string;
  isCurrent: boolean;
}

interface Toast {
  message: string;
  type: 'success' | 'error' | 'info';
  visible: boolean;
}

interface AppState {
  token: string | null;
  user: User | null;
  school: School | null;
  academicYears: AcademicYear[];
  activeYear: AcademicYear | null;
  currentView: string;
  toast: Toast;
  
  // Actions
  setAuth: (token: string, user: User, school: School, activeYear: AcademicYear) => void;
  setAcademicYears: (years: AcademicYear[]) => void;
  switchAcademicYear: (year: AcademicYear) => void;
  setView: (view: string) => void;
  logout: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
}

// Safe LocalStorage Parser to prevent runtime crashes from corrupt values
const safeParse = (key: string, fallback: any) => {
  try {
    const item = localStorage.getItem(key);
    if (!item || item === 'undefined' || item === 'null') {
      return fallback;
    }
    return JSON.parse(item);
  } catch (error) {
    console.error(`Failed to parse localStorage key "${key}":`, error);
    return fallback;
  }
};

export const useAppStore = create<AppState>((set, get) => ({
  token: localStorage.getItem('token'),
  user: safeParse('user', null),
  school: safeParse('school', null),
  academicYears: safeParse('academicYears', []),
  activeYear: safeParse('activeYear', null),
  currentView: 'dashboard',
  toast: { message: '', type: 'success', visible: false },

  setAuth: (token, user, school, activeYear) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('school', JSON.stringify(school));
    localStorage.setItem('activeYear', JSON.stringify(activeYear));
    set({ token, user, school, activeYear });
  },

  setAcademicYears: (years) => {
    localStorage.setItem('academicYears', JSON.stringify(years));
    set({ academicYears: years });
  },

  switchAcademicYear: (year) => {
    localStorage.setItem('activeYear', JSON.stringify(year));
    set({ activeYear: year });
    get().showToast(`Switched Context to Academic Year: ${year.name}`, 'info');
  },

  setView: (view) => set({ currentView: view }),

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('school');
    localStorage.removeItem('activeYear');
    localStorage.removeItem('academicYears');
    set({ token: null, user: null, school: null, activeYear: null, academicYears: [], currentView: 'dashboard' });
  },

  showToast: (message, type = 'success') => {
    set({ toast: { message, type, visible: true } });
    setTimeout(() => {
      get().hideToast();
    }, 4000);
  },

  hideToast: () => set((state) => ({ toast: { ...state.toast, visible: false } }))
}));
