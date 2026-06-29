export interface StopwatchSession {
  status: 'idle' | 'running' | 'paused';
  startTime: number | null; // Timestamp in ms
  accumulatedTime: number; // In ms
  dateStarted: string | null; // YYYY-MM-DD
}

export interface WorkDay {
  id: string;
  date: string; // YYYY-MM-DD
  hours: number;
  earned: number; // CZK
}

const SESSION_KEY = 'digintu_stopwatch_session';
const WORK_DAYS_KEY = 'digintu_work_days_history';

const DEFAULT_SESSION: StopwatchSession = {
  status: 'idle',
  startTime: null,
  accumulatedTime: 0,
  dateStarted: null,
};

export const db = {
  // --- Stopwatch Session Management ---
  getStopwatchSession(): StopwatchSession {
    try {
      const data = localStorage.getItem(SESSION_KEY);
      if (!data) return DEFAULT_SESSION;
      const parsed = JSON.parse(data) as StopwatchSession;
      
      // If the session was running when the browser was closed/refreshed,
      // it is still valid. The app will calculate elapsed time on load.
      return parsed;
    } catch (e) {
      console.error('Failed to load stopwatch session from DB', e);
      return DEFAULT_SESSION;
    }
  },

  saveStopwatchSession(session: StopwatchSession): void {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) {
      console.error('Failed to save stopwatch session to DB', e);
    }
  },

  clearStopwatchSession(): void {
    this.saveStopwatchSession(DEFAULT_SESSION);
  },

  // --- Completed Days Management ---
  getWorkDays(): WorkDay[] {
    try {
      const data = localStorage.getItem(WORK_DAYS_KEY);
      if (!data) return [];
      return JSON.parse(data) as WorkDay[];
    } catch (e) {
      console.error('Failed to load work days history from DB', e);
      return [];
    }
  },

  saveWorkDay(day: Omit<WorkDay, 'id'>): WorkDay {
    const newDay: WorkDay = {
      ...day,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    
    try {
      const days = this.getWorkDays();
      days.push(newDay);
      localStorage.setItem(WORK_DAYS_KEY, JSON.stringify(days));
    } catch (e) {
      console.error('Failed to save completed work day to DB', e);
    }
    
    return newDay;
  },

  deleteWorkDay(id: string): void {
    try {
      const days = this.getWorkDays().filter(d => d.id !== id);
      localStorage.setItem(WORK_DAYS_KEY, JSON.stringify(days));
    } catch (e) {
      console.error('Failed to delete work day from DB', e);
    }
  },

  getLeaderboard(): WorkDay[] {
    // Return days sorted by earnings (descending)
    return this.getWorkDays().sort((a, b) => b.earned - a.earned);
  },

  getTotalEarned(): number {
    const days = this.getWorkDays();
    return days.reduce((sum, day) => sum + day.earned, 0);
  }
};
