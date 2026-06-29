import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  Award, 
  Clock, 
  Trash2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { db } from './lib/db';
import type { StopwatchSession, WorkDay } from './lib/db';
import { Button } from './components/ui/button';
import { Card, CardContent } from './components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from './components/ui/dialog';

// Rate constant: 1000 Kč per hour
const HOURLY_RATE = 1000;
const MS_PER_HOUR = 3600000;
const RATE_PER_MS = HOURLY_RATE / MS_PER_HOUR;

export default function App() {
  // Load initial session and history
  const [session, setSession] = useState<StopwatchSession>(() => db.getStopwatchSession());
  const [history, setHistory] = useState<WorkDay[]>(() => db.getWorkDays());
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  
  const animationRef = useRef<number | null>(null);

  // Synchronize elapsed time on session change
  useEffect(() => {
    if (session.status === 'running' && session.startTime) {
      const updateTimer = () => {
        const now = Date.now();
        const elapsed = session.accumulatedTime + (now - session.startTime!);
        setElapsedTime(elapsed);
        animationRef.current = requestAnimationFrame(updateTimer);
      };
      animationRef.current = requestAnimationFrame(updateTimer);
      return () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
      };
    } else {
      setElapsedTime(session.accumulatedTime);
    }
  }, [session]);

  // Format elapsed ms into HH:MM:SS.hh (Hours : Minutes : Seconds . Hundredths)
  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const hundredths = Math.floor((ms % 1000) / 10);

    const pad = (num: number) => String(num).padStart(2, '0');

    return {
      hours: pad(hours),
      minutes: pad(minutes),
      seconds: pad(seconds),
      hundredths: pad(hundredths)
    };
  };

  const formattedTime = formatTime(elapsedTime);

  // Calculate current session earnings
  const currentEarnings = useMemo(() => {
    return elapsedTime * RATE_PER_MS;
  }, [elapsedTime]);

  // Calculate total earnings (history + current session)
  const totalCompletedEarnings = useMemo(() => {
    return history.reduce((sum, day) => sum + day.earned, 0);
  }, [history]);

  const totalEarningsAllTime = totalCompletedEarnings + currentEarnings;

  // Leaderboard data (sorted by earned descending)
  const leaderboard = useMemo(() => {
    return [...history].sort((a, b) => b.earned - a.earned);
  }, [history]);

  // Action: Start or Resume Stopwatch
  const handleStartResume = () => {
    const now = Date.now();
    const todayStr = new Date().toISOString().split('T')[0];
    
    const updatedSession: StopwatchSession = {
      status: 'running',
      startTime: now,
      accumulatedTime: session.accumulatedTime,
      dateStarted: session.dateStarted || todayStr,
    };

    setSession(updatedSession);
    db.saveStopwatchSession(updatedSession);
  };

  // Action: Pause Stopwatch
  const handlePause = () => {
    if (session.status !== 'running' || !session.startTime) return;
    
    const now = Date.now();
    const additionalTime = now - session.startTime;
    const updatedSession: StopwatchSession = {
      status: 'paused',
      startTime: null,
      accumulatedTime: session.accumulatedTime + additionalTime,
      dateStarted: session.dateStarted,
    };

    setSession(updatedSession);
    db.saveStopwatchSession(updatedSession);
  };

  // Action: End Day (Save to DB, reset stopwatch)
  const handleEndDay = () => {
    if (elapsedTime <= 0) return;

    const hoursWorked = elapsedTime / MS_PER_HOUR;
    const earnedAmount = Math.round(currentEarnings); // round to full Crowns for clean history
    const dateToSave = session.dateStarted || new Date().toISOString().split('T')[0];

    db.saveWorkDay({
      date: dateToSave,
      hours: parseFloat(hoursWorked.toFixed(2)),
      earned: earnedAmount,
    });

    // Reset session in state & DB
    db.clearStopwatchSession();
    setSession(db.getStopwatchSession());
    setElapsedTime(0);
    setHistory(db.getWorkDays());
    setIsConfirmOpen(false);

    // Trigger Luxury completion celebration
    triggerLuxuryConfetti();
  };

  // Trigger Confetti
  const triggerLuxuryConfetti = () => {
    const duration = 2.5 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      // Elegant minimal monochrome confetti (white, silver, gold-ish luxury sparkles)
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.8 },
        colors: ['#ffffff', '#a1a1aa', '#d4d4d8', '#c5a880']
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.8 },
        colors: ['#ffffff', '#a1a1aa', '#d4d4d8', '#c5a880']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  };

  // Action: Clear All Leaderboard History
  const handleClearHistory = () => {
    localStorage.removeItem('digintu_work_days_history');
    setHistory([]);
    setIsResetConfirmOpen(false);
  };

  // Format date for display
  const formatDateDisplay = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      // Check if it's today
      const today = new Date().toISOString().split('T')[0];
      if (dateStr === today) return 'Dnes (Today)';
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      if (dateStr === yesterdayStr) return 'Včera (Yesterday)';

      return date.toLocaleDateString('cs-CZ', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'CZK',
      maximumFractionDigits: 2,
      minimumFractionDigits: 2
    }).format(amount).replace('CZK', 'Kč');
  };

  const formatCurrencyInteger = (amount: number) => {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'decimal',
      maximumFractionDigits: 0
    }).format(amount) + ' Kč';
  };

  return (
    <div className="relative min-h-screen bg-[#030303] text-zinc-100 flex flex-col justify-between selection:bg-zinc-800 selection:text-white font-sans antialiased overflow-hidden">
      {/* Luxury Background elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(25,25,25,0.4)_0%,rgba(0,0,0,0.85)_100%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
      
      {/* HEADER SECTION (Persistent Stats on Top) */}
      <header className="relative z-10 border-b border-zinc-900 bg-black/60 backdrop-blur-md px-6 py-4 sm:px-12 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="size-2 rounded-full bg-zinc-100 animate-pulse" />
          <span className="font-mono text-xs tracking-[0.25em] text-zinc-400 uppercase">Chronos.Earn</span>
        </div>
        
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-mono">Total Earnings</span>
          <span className="text-lg sm:text-2xl font-semibold tracking-tight text-white font-mono transition-all duration-300">
            {formatCurrency(totalEarningsAllTime)}
          </span>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-4 py-8 md:py-16 flex flex-col items-center gap-12 md:gap-16 justify-center">
        
        {/* CHRONOMETER / STOPWATCH FACE */}
        <div className="flex flex-col items-center gap-8 w-full max-w-md">
          <div className="relative w-72 h-72 sm:w-80 sm:h-80 rounded-full flex items-center justify-center border border-zinc-800 bg-[#060606] shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            
            {/* Rotating border when active */}
            <div className={`absolute inset-1 rounded-full border border-dashed border-zinc-700/50 pointer-events-none ${session.status === 'running' ? 'animate-[spin_40s_linear_infinite]' : ''}`} />
            
            {/* Thin active glow ring */}
            <svg className="absolute inset-0 size-full -rotate-90 pointer-events-none">
              <circle
                cx="50%"
                cy="50%"
                r="48%"
                className={`stroke-zinc-800 fill-none stroke-[1px]`}
              />
              <circle
                cx="50%"
                cy="50%"
                r="48%"
                className={`stroke-white fill-none stroke-[2px] transition-all duration-300 ${session.status === 'running' ? 'opacity-100 animate-[pulse_2s_ease-in-out_infinite]' : 'opacity-0'}`}
                strokeDasharray="40 180 80 40"
              />
            </svg>

            {/* Inner Details */}
            <div className="flex flex-col items-center text-center z-10 px-6">
              {/* Rate tag */}
              <div className="mb-2 px-2.5 py-0.5 rounded-full border border-zinc-800 bg-zinc-900/50 text-[10px] tracking-widest uppercase font-mono text-zinc-500">
                {HOURLY_RATE} Kč / Hod
              </div>

              {/* Real-time Earnings display */}
              <div className="text-3xl sm:text-4xl font-light font-mono text-white tracking-tight leading-none mb-1">
                {formatCurrency(currentEarnings)}
              </div>

              {/* Small status line */}
              <div className="h-4 flex items-center justify-center gap-1.5 mb-5">
                {session.status === 'running' && (
                  <>
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-[10px] tracking-wider uppercase font-mono text-emerald-500/80">Active</span>
                  </>
                )}
                {session.status === 'paused' && (
                  <>
                    <span className="size-1.5 rounded-full bg-amber-500" />
                    <span className="text-[10px] tracking-wider uppercase font-mono text-amber-500/80">Paused</span>
                  </>
                )}
                {session.status === 'idle' && (
                  <span className="text-[10px] tracking-wider uppercase font-mono text-zinc-600">Standby</span>
                )}
              </div>

              {/* Stopwatch numbers */}
              <div className="flex items-baseline font-mono text-xl text-zinc-400 select-none">
                <span>{formattedTime.hours}</span>
                <span className="mx-1 text-zinc-600 animate-pulse">:</span>
                <span>{formattedTime.minutes}</span>
                <span className="mx-1 text-zinc-600 animate-pulse">:</span>
                <span>{formattedTime.seconds}</span>
                <span className="ml-1 text-sm text-zinc-600">.{formattedTime.hundredths}</span>
              </div>
            </div>
            
            {/* Subtle markings on the clock */}
            <div className="absolute top-3 font-mono text-[9px] text-zinc-700 tracking-wider">60</div>
            <div className="absolute bottom-3 font-mono text-[9px] text-zinc-700 tracking-wider">30</div>
            <div className="absolute left-3 font-mono text-[9px] text-zinc-700 tracking-wider">45</div>
            <div className="absolute right-3 font-mono text-[9px] text-zinc-700 tracking-wider">15</div>
          </div>

          {/* CONTROLS */}
          <div className="flex gap-3 w-full justify-center">
            {session.status !== 'running' ? (
              <Button 
                onClick={handleStartResume}
                className="flex-1 bg-white text-black hover:bg-zinc-200 transition-all font-medium py-6 px-6 text-sm tracking-wider uppercase rounded-xl border border-white hover:shadow-[0_0_20px_rgba(255,255,255,0.15)] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="size-4 fill-current" />
                {session.status === 'paused' ? 'Resume' : 'Start Cycle'}
              </Button>
            ) : (
              <Button 
                onClick={handlePause}
                variant="outline"
                className="flex-1 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-900/50 transition-all py-6 px-6 text-sm tracking-wider uppercase rounded-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                <Pause className="size-4 fill-current" />
                Pause
              </Button>
            )}

            {/* End Day triggers confirmation modal */}
            <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
              <DialogTrigger asChild>
                <Button 
                  disabled={elapsedTime <= 0}
                  variant="outline"
                  className="flex-1 border-zinc-900 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 hover:bg-zinc-950 transition-all py-6 px-6 text-sm tracking-wider uppercase rounded-xl disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Square className="size-4" />
                  End Day
                </Button>
              </DialogTrigger>
              <DialogContent className="border border-zinc-900 bg-[#060606] text-zinc-100 max-w-sm rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.9)] p-6">
                <DialogHeader className="gap-2">
                  <DialogTitle className="font-light text-xl tracking-tight text-white flex items-center gap-2">
                    <Clock className="size-5 text-zinc-400" />
                    Complete Work Cycle
                  </DialogTitle>
                  <DialogDescription className="text-zinc-400 leading-relaxed text-sm pt-2">
                    Are you sure you want to end your current working cycle for today? This will log your progress and reset the timer.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="py-4 border-y border-zinc-900/60 my-2 flex flex-col gap-3 font-mono text-xs">
                  <div className="flex justify-between items-center text-zinc-500">
                    <span>HOURS WORKED:</span>
                    <span className="text-zinc-300">{formattedTime.hours}h {formattedTime.minutes}m {formattedTime.seconds}s</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-500">
                    <span>RATE PER HOUR:</span>
                    <span className="text-zinc-300">1 000 Kč</span>
                  </div>
                  <div className="flex justify-between items-center font-semibold text-sm">
                    <span className="text-zinc-400 font-sans">TODAY'S EARNINGS:</span>
                    <span className="text-white text-base">{formatCurrency(currentEarnings)}</span>
                  </div>
                </div>

                <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
                  <DialogClose asChild>
                    <Button variant="outline" className="w-full sm:w-auto border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-xl cursor-pointer">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button 
                    onClick={handleEndDay} 
                    className="w-full sm:w-auto bg-white text-black hover:bg-zinc-200 rounded-xl cursor-pointer"
                  >
                    Confirm & End
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* LEADERBOARD & HISTORY */}
        <section className="w-full max-w-2xl flex flex-col gap-6">
          <div className="flex justify-between items-end border-b border-zinc-900 pb-3">
            <div className="flex items-center gap-2">
              <Award className="size-5 text-zinc-400" />
              <h2 className="text-lg tracking-wider uppercase font-mono text-zinc-300 margin-0">Leaderboard</h2>
            </div>
            
            {history.length > 0 && (
              <Dialog open={isResetConfirmOpen} onOpenChange={setIsResetConfirmOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="xs" className="text-zinc-600 hover:text-red-400 hover:bg-zinc-950 transition-colors flex items-center gap-1.5 cursor-pointer">
                    <Trash2 className="size-3" />
                    Reset Data
                  </Button>
                </DialogTrigger>
                <DialogContent className="border border-zinc-900 bg-[#060606] text-zinc-100 max-w-xs rounded-xl p-5 shadow-2xl">
                  <DialogHeader>
                    <DialogTitle className="font-medium text-base text-white">Reset History</DialogTitle>
                    <DialogDescription className="text-zinc-400 text-xs mt-1">
                      This will permanently delete all logged work cycles and empty the leaderboard. This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="flex flex-col sm:flex-row gap-1.5 mt-4">
                    <DialogClose asChild>
                      <Button size="sm" variant="outline" className="border-zinc-800 text-zinc-400 hover:bg-zinc-900 rounded-lg cursor-pointer">Cancel</Button>
                    </DialogClose>
                    <Button size="sm" onClick={handleClearHistory} className="bg-red-950/20 text-red-500 hover:bg-red-900/30 rounded-lg border border-red-900/50 cursor-pointer">
                      Reset All
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <Card className="border border-zinc-900/60 bg-[#050505] overflow-hidden rounded-2xl">
            <CardContent className="p-0">
              {leaderboard.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <Clock className="size-8 text-zinc-700 mb-3 stroke-[1.25px]" />
                  <p className="text-zinc-500 text-sm font-light">No records found. Complete a working day to begin your leaderboard.</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-900/40">
                  {leaderboard.map((day, index) => {
                    const isGold = index === 0;
                    const isSilver = index === 1;
                    const isBronze = index === 2;
                    
                    return (
                      <div 
                        key={day.id} 
                        className={`flex items-center justify-between px-6 py-4 transition-all duration-300 hover:bg-zinc-900/20 group`}
                      >
                        <div className="flex items-center gap-4">
                          {/* Rank badge */}
                          <div className={`size-7 rounded-full flex items-center justify-center font-mono text-xs border ${
                            isGold ? 'bg-zinc-100 text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.2)]' :
                            isSilver ? 'bg-zinc-800 text-zinc-300 border-zinc-700' :
                            isBronze ? 'bg-zinc-900 text-zinc-400 border-zinc-800' :
                            'bg-transparent text-zinc-600 border-zinc-900'
                          }`}>
                            {index + 1}
                          </div>
                          
                          {/* Details */}
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-zinc-200 flex items-center gap-2">
                              {formatDateDisplay(day.date)}
                            </span>
                            <span className="text-[11px] font-mono text-zinc-500 uppercase flex items-center gap-1.5 mt-0.5">
                              <Clock className="size-3 text-zinc-600" />
                              {day.hours.toFixed(2)} hours worked
                            </span>
                          </div>
                        </div>

                        {/* Earnings display */}
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-base font-semibold text-zinc-200 group-hover:text-white transition-colors">
                            {formatCurrencyInteger(day.earned)}
                          </span>
                          
                          {/* Option to delete individual row on hover */}
                          <button 
                            onClick={() => { db.deleteWorkDay(day.id); setHistory(db.getWorkDays()); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-zinc-600 hover:text-red-400 cursor-pointer"
                            title="Delete entry"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-zinc-900/80 px-6 py-6 sm:px-12 flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left bg-black/45">
        <p className="text-[11px] font-mono text-zinc-600 tracking-wider">
          © {new Date().getFullYear()} CHRONOS. ALL RIGHTS RESERVED.
        </p>
        <p className="text-[10px] font-mono text-zinc-600 tracking-wider flex items-center gap-2">
          <span>DESIGNED FOR WORK</span>
          <span className="text-zinc-800">•</span>
          <span>1000 KČ / HR STANDARD RATE</span>
        </p>
      </footer>
    </div>
  );
}
