/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import { 
  LayoutDashboard, 
  BarChart3, 
  Router, 
  Calendar, 
  Settings, 
  User, 
  Bell, 
  Fan, 
  Droplets, 
  Thermometer, 
  Zap,
  Activity,
  ShieldCheck,
  Wifi,
  Bluetooth,
  BluetoothOff,
  LogIn,
  LogOut,
  AlertCircle,
  CheckCircle2,
  Mail,
  Lock,
  X
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { 
  doc, 
  onSnapshot, 
  setDoc, 
  serverTimestamp,
  getDocFromServer
} from "firebase/firestore";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { auth, db } from "./firebase";

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: any[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // We'll show a toast instead of throwing to keep the app running
  return errInfo;
}

// --- Components ---

const AuthModal = ({ isOpen, onClose, onGoogleLogin, onEmailLogin, onEmailSignup }: any) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        await onEmailLogin(email, password);
      } else {
        await onEmailSignup(email, password, name);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-surface-container rounded-[2.5rem] p-10 w-full max-w-md border border-white/5 shadow-2xl relative"
      >
        <button onClick={onClose} className="absolute top-8 right-8 text-on-surface-variant hover:text-on-surface">
          <X className="w-6 h-6" />
        </button>

        <h3 className="text-3xl font-headline font-black mb-2 uppercase tracking-tight">
          {isLogin ? "Welcome Back" : "Create Account"}
        </h3>
        <p className="text-on-surface-variant text-sm mb-8">
          {isLogin ? "Access your system intelligence dashboard." : "Join the AquaControl Pro network."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
              <input 
                type="text" 
                placeholder="Full Name" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-surface-container-low border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm font-headline outline-none focus:border-primary/50 transition-all"
              />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
            <input 
              type="email" 
              placeholder="Email Address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-surface-container-low border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm font-headline outline-none focus:border-primary/50 transition-all"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-surface-container-low border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm font-headline outline-none focus:border-primary/50 transition-all"
            />
          </div>

          {error && <div className="text-error text-xs font-bold uppercase tracking-widest">{error}</div>}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-primary text-on-primary-container py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-sm shadow-[0_0_20px_rgba(0,227,253,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? "Processing..." : isLogin ? "Sign In" : "Register"}
          </button>
        </form>

        <div className="mt-8 flex items-center gap-4">
          <div className="h-px flex-1 bg-white/5" />
          <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Or Continue With</span>
          <div className="h-px flex-1 bg-white/5" />
        </div>

        <button 
          onClick={onGoogleLogin}
          className="w-full mt-6 bg-surface-container-high hover:bg-surface-container-highest py-4 rounded-2xl flex items-center justify-center gap-3 transition-all border border-white/5"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
          <span className="text-xs font-bold uppercase tracking-widest">Google Account</span>
        </button>

        <div className="mt-8 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest hover:text-primary transition-colors"
          >
            {isLogin ? "Don't have an account? Register" : "Already have an account? Sign In"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const Sidebar = ({ 
  user, 
  onLogin, 
  onLogout, 
  activeTab, 
  setActiveTab 
}: { 
  user: FirebaseUser | null, 
  onLogin: () => void, 
  onLogout: () => void,
  activeTab: string,
  setActiveTab: (tab: string) => void
}) => {
  const navItems = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Analytics", icon: BarChart3 },
    { name: "Connectivity", icon: Router },
    { name: "Schedule", icon: Calendar },
    { name: "Settings", icon: Settings },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="h-screen w-64 fixed left-0 top-0 hidden lg:flex flex-col bg-[#0a0f13] border-r border-white/5 z-50">
        <div className="px-8 py-10 flex flex-col gap-1">
          <h1 className="text-xl font-black text-primary font-headline tracking-tighter uppercase">
            System Intelligence
          </h1>
          <span className="font-headline text-xs uppercase tracking-[0.2em] text-on-surface-variant">
            Active | 22°C
          </span>
        </div>

        <nav className="flex-1 mt-4">
          {navItems.map((item) => (
            <button
              key={item.name}
              onClick={() => setActiveTab(item.name)}
              className={`w-full flex items-center px-8 py-4 transition-all font-headline text-xs uppercase tracking-widest relative group ${
                activeTab === item.name 
                  ? "text-primary" 
                  : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"
              }`}
            >
              {activeTab === item.name && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute right-0 top-0 bottom-0 w-1 bg-primary shadow-[0_0_15px_rgba(129,236,255,0.5)]"
                />
              )}
              <item.icon className={`mr-4 w-5 h-5 ${activeTab === item.name ? "text-primary" : "text-on-surface-variant group-hover:text-on-surface"}`} />
              {item.name}
            </button>
          ))}
        </nav>

        <div className="p-6 mb-4 flex flex-col gap-3">
          {user ? (
            <div className="bg-surface-container-high rounded-2xl p-4 flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-primary/20">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || ""} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary">
                      <User className="w-5 h-5" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Technician</div>
                  <div className="text-sm font-bold font-headline truncate max-w-[100px]">{user.displayName || "Admin User"}</div>
                </div>
              </div>
              <button onClick={onLogout} className="text-on-surface-variant hover:text-error transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button 
              onClick={onLogin}
              className="w-full bg-surface-container-high hover:bg-surface-container-highest rounded-2xl p-4 flex items-center gap-3 transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <LogIn className="w-5 h-5" />
              </div>
              <div className="text-sm font-bold font-headline uppercase tracking-widest">Login</div>
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0a0f13]/80 backdrop-blur-xl border-t border-white/5 z-50 flex items-center justify-around px-4 py-3">
        {navItems.map((item) => (
          <button
            key={item.name}
            onClick={() => setActiveTab(item.name)}
            className={`flex flex-col items-center gap-1 transition-all ${
              activeTab === item.name ? "text-primary" : "text-on-surface-variant"
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[8px] font-black uppercase tracking-widest">{item.name}</span>
            {activeTab === item.name && (
              <motion.div 
                layoutId="activeTabMobile"
                className="w-1 h-1 bg-primary rounded-full shadow-[0_0_10px_#81ecff]"
              />
            )}
          </button>
        ))}
      </nav>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#0a0f13]/80 backdrop-blur-xl border-b border-white/5 z-50 flex items-center justify-between px-6">
        <h1 className="text-sm font-black text-primary font-headline tracking-tighter uppercase">
          AquaControl Pro
        </h1>
        <div className="flex items-center gap-4">
          {user ? (
            <button onClick={onLogout} className="w-8 h-8 rounded-full overflow-hidden border border-primary/20">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-full h-full p-1.5 text-primary" />
              )}
            </button>
          ) : (
            <button onClick={onLogin} className="text-primary">
              <LogIn className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>
    </>
  );
};

const TemperatureGauge = ({ value }: { value: number }) => {
  const percentage = Math.min(Math.max((value - 16) / (32 - 16) * 100, 0), 100);

  return (
    <section className="col-span-1 md:col-span-2 bg-surface-container rounded-[2.5rem] p-10 flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none bg-[radial-gradient(circle_at_50%_50%,#81ecff_0%,transparent_70%)]" />
      
      <div className="relative z-10 text-center mb-10">
        <span className="text-on-surface-variant uppercase tracking-[0.4em] text-[10px] font-bold">Ambient Temperature</span>
      </div>

      <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-[14px] border-surface-variant" />
        
        <svg className="absolute inset-0 w-full h-full -rotate-90">
          <motion.circle
            cx="50%"
            cy="50%"
            r="46%"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="14"
            strokeDasharray={`${percentage}% 100%`}
            strokeLinecap="round"
            className="glow-primary"
            initial={{ strokeDasharray: "0% 100%" }}
            animate={{ strokeDasharray: `${percentage}% 100%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6e9bff" />
              <stop offset="100%" stopColor="#81ecff" />
            </linearGradient>
          </defs>
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <motion.span 
            key={value}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-7xl md:text-8xl font-black font-headline tracking-tighter text-on-surface"
          >
            {value.toFixed(1)}
          </motion.span>
          <span className="text-xl font-light text-primary/80 mt-[-0.5rem]">°Celsius</span>
        </div>

        <motion.div 
          className="absolute top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-primary rounded-full shadow-[0_0_20px_#81ecff]"
          animate={{ rotate: (percentage * 3.6) - 90 }}
          style={{ transformOrigin: "center 140px" }}
        />
      </div>

      <div className="mt-12 flex gap-16 text-center">
        <div>
          <span className="block text-on-surface-variant text-[10px] uppercase tracking-[0.2em] font-bold mb-2">Target</span>
          <span className="text-2xl font-headline font-bold text-on-surface">22.0°C</span>
        </div>
        <div className="w-px h-10 bg-white/5" />
        <div>
          <span className="block text-on-surface-variant text-[10px] uppercase tracking-[0.2em] font-bold mb-2">Deviation</span>
          <span className="text-2xl font-headline font-bold text-error">{(value - 22).toFixed(1)}°C</span>
        </div>
      </div>

      <div className="mt-12 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface">Adjustment Range</span>
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">16°C — 32°C</span>
        </div>
        <div className="h-1.5 w-full bg-surface-variant rounded-full relative">
          <div className="absolute h-full bg-gradient-to-r from-secondary to-primary rounded-full" style={{ width: `${percentage}%` }} />
          <div className="absolute top-1/2 left-[45%] -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-on-surface border-4 border-primary-container rounded-full shadow-lg" />
        </div>
      </div>
    </section>
  );
};

const StatCard = ({ icon: Icon, label, value, trend, trendColor, progress }: any) => {
  return (
    <div className="bg-surface-container-low rounded-[2rem] p-5 lg:p-7 flex items-center justify-between group hover:bg-surface-container-high transition-all duration-500">
      <div className="flex items-center gap-3 lg:gap-5">
        <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-surface-variant flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-500">
          <Icon className="w-6 h-6 lg:w-7 lg:h-7" />
        </div>
        <div>
          <span className="text-on-surface-variant text-[9px] lg:text-[10px] uppercase tracking-[0.2em] font-bold">{label}</span>
          <div className="text-xl lg:text-2xl font-headline font-bold mt-0.5">{value}</div>
        </div>
      </div>
      {trend ? (
        <div className={`text-[10px] font-bold tracking-widest uppercase ${trendColor}`}>{trend}</div>
      ) : (
        <div className="h-1.5 w-20 bg-surface-variant rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full bg-primary" 
          />
        </div>
      )}
    </div>
  );
};

const FanDynamics = ({ speed, setSpeed, turbo, setTurbo }: any) => {
  const speeds = ["Off", "Low", "Med", "High"];

  return (
    <section className="bg-surface-container-high rounded-[2.5rem] p-6 lg:p-8">
      <h3 className="text-sm font-headline font-bold mb-6 lg:mb-8 flex items-center gap-3 uppercase tracking-[0.2em]">
        <Fan className={`w-5 h-5 text-primary ${speed !== "Off" ? "animate-spin-slow" : ""}`} />
        Fan Dynamics
      </h3>
      
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <span className="text-on-surface-variant text-xs font-medium">Active Speed</span>
          <span className="text-primary font-bold font-headline">{speed === "Off" ? "0" : speed === "Low" ? "300" : speed === "Med" ? "750" : "1200"} RPM</span>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {speeds.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`py-3.5 rounded-2xl transition-all text-xs font-bold uppercase tracking-widest ${
                speed === s 
                  ? "bg-primary-container text-on-primary-container shadow-[0_0_20px_rgba(0,227,253,0.2)]" 
                  : "bg-surface-variant text-on-surface-variant hover:bg-surface-container-highest"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="bg-surface-container-lowest/40 rounded-3xl p-6 border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-widest">Turbo Boost</span>
            <button 
              onClick={() => setTurbo(!turbo)}
              className={`w-11 h-6 rounded-full relative transition-colors ${turbo ? "bg-primary" : "bg-surface-variant"}`}
            >
              <motion.div 
                animate={{ x: turbo ? 20 : 4 }}
                className={`absolute top-1 w-4 h-4 rounded-full ${turbo ? "bg-on-primary-container" : "bg-on-surface-variant/40"}`} 
              />
            </button>
          </div>
          <p className="text-[11px] text-on-surface-variant leading-relaxed font-medium">
            Enable Turbo Boost for rapid cooling when temperature exceeds 5°C of target.
          </p>
        </div>
      </div>
    </section>
  );
};

const SystemHealth = () => {
  const healthItems = [
    { label: "Filter Integrity", sub: "Last replaced 12 days ago", color: "bg-tertiary-fixed", icon: ShieldCheck },
    { label: "Pressure Balance", sub: "1.2 Bar - Optimal range", color: "bg-secondary", icon: Activity },
    { label: "Connectivity", sub: "Latency 24ms | 5G Network", color: "bg-on-surface-variant/30", icon: Wifi },
  ];

  return (
    <section className="bg-surface-container rounded-[2.5rem] p-6 lg:p-8 flex-1 flex flex-col">
      <h3 className="text-sm font-headline font-bold mb-6 lg:mb-8 uppercase tracking-[0.2em]">System Health</h3>
      
      <div className="space-y-7 flex-1">
        {healthItems.map((item) => (
          <div key={item.label} className="flex items-center gap-5">
            <div className={`w-1.5 h-10 rounded-full ${item.color}`} />
            <div>
              <div className="text-sm font-bold font-headline">{item.label}</div>
              <div className="text-[11px] text-on-surface-variant font-medium mt-0.5">{item.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 group cursor-pointer">
        <div className="w-full h-36 rounded-3xl overflow-hidden relative">
          <img 
            alt="Technical Blueprint" 
            className="w-full h-full object-cover grayscale opacity-30 group-hover:grayscale-0 group-hover:opacity-80 transition-all duration-700 scale-110 group-hover:scale-100" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCjaG0rJ74zzMapzPvDRRRHJ19dUuZir21mVvOnZnq4W2_9j2cXd4082rnHATf0tL6GSQFHoayDIeGBS3Jxn7Yh0ne9V9j3Zp93R4KSE5CW3HodYt4orEwcrspCkhZzhYM1BOYPzsfUr1qnY9JEhICE5kKLmPBerCW1eIDlu3027S59PIUOgeAHBH6OBZRh7CcES3Ap0C9p877umzmI7AAG-3Zf1ZSv_1GBMLONj_Gk8jGEKv2glbYx4U6InmicqV7dTuWLRivfRAux"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-container via-transparent to-transparent opacity-60" />
        </div>
        <div className="mt-3 text-center">
          <span className="text-[9px] uppercase tracking-[0.3em] font-black text-on-surface-variant group-hover:text-primary transition-colors">Expand System Schematic</span>
        </div>
      </div>
    </section>
  );
};

const AnalyticsView = ({ telemetry }: any) => {
  const data = [
    { time: '00:00', temp: 21.5, humidity: 65 },
    { time: '04:00', temp: 20.8, humidity: 68 },
    { time: '08:00', temp: 22.4, humidity: 60 },
    { time: '12:00', temp: 25.1, humidity: 55 },
    { time: '16:00', temp: 27.5, humidity: 52 },
    { time: '20:00', temp: 24.2, humidity: 58 },
    { time: '23:59', temp: 22.1, humidity: 63 },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-surface-container rounded-[2.5rem] p-8">
          <h3 className="text-sm font-headline font-bold mb-8 uppercase tracking-[0.2em]">Temperature History (24h)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#81ecff" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#81ecff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="time" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1f23', border: 'none', borderRadius: '12px', fontSize: '12px' }}
                  itemStyle={{ color: '#81ecff' }}
                />
                <Area type="monotone" dataKey="temp" stroke="#81ecff" fillOpacity={1} fill="url(#colorTemp)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-surface-container rounded-[2.5rem] p-8">
          <h3 className="text-sm font-headline font-bold mb-8 uppercase tracking-[0.2em]">Humidity Trends</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="time" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1f23', border: 'none', borderRadius: '12px', fontSize: '12px' }}
                  itemStyle={{ color: '#6e9bff' }}
                />
                <Line type="monotone" dataKey="humidity" stroke="#6e9bff" strokeWidth={3} dot={{ r: 4, fill: '#6e9bff' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-surface-container-low rounded-3xl p-6 border border-white/5">
          <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Peak Temperature</span>
          <div className="text-3xl font-headline font-black text-primary mt-2">28.4°C</div>
          <div className="text-[10px] text-on-surface-variant mt-1">Recorded at 14:32</div>
        </div>
        <div className="bg-surface-container-low rounded-3xl p-6 border border-white/5">
          <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Avg. Efficiency</span>
          <div className="text-3xl font-headline font-black text-secondary mt-2">94.2%</div>
          <div className="text-[10px] text-on-surface-variant mt-1">+1.2% from last week</div>
        </div>
        <div className="bg-surface-container-low rounded-3xl p-6 border border-white/5">
          <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Power Consumption</span>
          <div className="text-3xl font-headline font-black text-tertiary-fixed mt-2">12.8 kWh</div>
          <div className="text-[10px] text-on-surface-variant mt-1">Daily average</div>
        </div>
      </div>
    </div>
  );
};

const ConnectivityView = ({ btStatus, btDevice, connectBluetooth, disconnectBluetooth, user }: any) => {
  return (
    <div className="space-y-8">
      <section className="bg-surface-container rounded-[2.5rem] p-8">
        <h3 className="text-sm font-headline font-bold mb-8 uppercase tracking-[0.2em]">Network & Protocols</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-surface-container-low rounded-3xl p-8 border border-white/5">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${user ? "bg-tertiary-fixed/20 text-tertiary-fixed" : "bg-surface-variant text-on-surface-variant"}`}>
                  <Wifi className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-headline font-bold">Cloud Synchronization</div>
                  <div className="text-xs text-on-surface-variant">{user ? "Connected to Firebase" : "Offline / Not Logged In"}</div>
                </div>
              </div>
              <div className={`w-3 h-3 rounded-full ${user ? "bg-tertiary-fixed shadow-[0_0_10px_#5cfd80]" : "bg-on-surface-variant/30"}`} />
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed mb-6">
              Real-time data streaming via Google Cloud Firestore. Enables remote control from anywhere in the world.
            </p>
            <div className="text-[10px] font-bold uppercase tracking-widest text-primary">Latency: 24ms</div>
          </div>

          <div className="bg-surface-container-low rounded-3xl p-8 border border-white/5">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${btStatus === "connected" ? "bg-secondary/20 text-secondary" : "bg-surface-variant text-on-surface-variant"}`}>
                  <Bluetooth className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-headline font-bold">Direct BLE Link</div>
                  <div className="text-xs text-on-surface-variant">{btStatus === "connected" ? `Connected to ${btDevice?.name || "ESP32"}` : "Disconnected"}</div>
                </div>
              </div>
              <div className={`w-3 h-3 rounded-full ${btStatus === "connected" ? "bg-secondary shadow-[0_0_10px_#6e9bff]" : "bg-on-surface-variant/30"}`} />
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed mb-6">
              Low-latency direct communication for offline environments. Uses Web Bluetooth API for peer-to-peer control.
            </p>
            <button 
              onClick={btStatus === "connected" ? disconnectBluetooth : connectBluetooth}
              className="px-6 py-2.5 rounded-xl bg-surface-variant hover:bg-surface-container-highest transition-all text-[10px] font-black uppercase tracking-widest"
            >
              {btStatus === "connected" ? "Terminate Link" : "Initiate Pairing"}
            </button>
          </div>
        </div>
      </section>

      <section className="bg-surface-container rounded-[2.5rem] p-8">
        <h3 className="text-sm font-headline font-bold mb-8 uppercase tracking-[0.2em]">Device Information</h3>
        <div className="space-y-4">
          {[
            { label: "Hardware Version", value: "ESP32-WROOM-32D v1.4" },
            { label: "Firmware Version", value: "AquaControl-OS v2.1.0-stable" },
            { label: "MAC Address", value: "24:6F:28:AE:D3:4C" },
            { label: "Signal Strength (RSSI)", value: "-64 dBm" },
          ].map((item) => (
            <div key={item.label} className="flex justify-between items-center py-3 border-b border-white/5">
              <span className="text-xs text-on-surface-variant font-medium">{item.label}</span>
              <span className="text-xs font-bold font-headline">{item.value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const ScheduleView = () => {
  const schedules = [
    { time: "08:00", task: "Morning Pre-cooling", status: "Completed", icon: Thermometer },
    { time: "12:30", task: "Peak Efficiency Mode", status: "Active", icon: Zap },
    { time: "18:00", task: "Filter Self-Clean", status: "Pending", icon: ShieldCheck },
    { time: "22:00", task: "Night Economy Mode", status: "Scheduled", icon: Calendar },
  ];

  return (
    <div className="space-y-8">
      <section className="bg-surface-container rounded-[2.5rem] p-8">
        <div className="flex justify-between items-center mb-10">
          <h3 className="text-sm font-headline font-bold uppercase tracking-[0.2em]">Automation Schedule</h3>
          <button className="px-6 py-2.5 rounded-xl bg-primary text-on-primary-container text-[10px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(0,227,253,0.3)]">
            Add New Task
          </button>
        </div>

        <div className="space-y-4">
          {schedules.map((item) => (
            <div key={item.task} className="bg-surface-container-low rounded-3xl p-6 flex items-center justify-between border border-white/5 group hover:bg-surface-container-high transition-all">
              <div className="flex items-center gap-6">
                <div className="text-xl font-headline font-black text-on-surface-variant w-16">{item.time}</div>
                <div className="w-12 h-12 rounded-2xl bg-surface-variant flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <item.icon className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-headline font-bold">{item.task}</div>
                  <div className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Daily Routine</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                  item.status === "Active" ? "bg-secondary/20 text-secondary" : 
                  item.status === "Completed" ? "bg-tertiary-fixed/20 text-tertiary-fixed" : 
                  "bg-surface-variant text-on-surface-variant"
                }`}>
                  {item.status}
                </span>
                <button className="text-on-surface-variant hover:text-on-surface">
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="bg-surface-container rounded-[2.5rem] p-8">
        <h3 className="text-sm font-headline font-bold mb-6 uppercase tracking-[0.2em]">Calendar Overview</h3>
        <div className="grid grid-cols-7 gap-4">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
            <div key={i} className="text-center">
              <div className="text-[10px] font-black text-on-surface-variant mb-4">{day}</div>
              <div className={`aspect-square rounded-xl flex items-center justify-center text-xs font-bold ${i === 3 ? "bg-primary text-on-primary-container" : "bg-surface-variant text-on-surface-variant"}`}>
                {12 + i}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SettingsView = ({ user, onLogout }: any) => {
  return (
    <div className="space-y-8">
      <section className="bg-surface-container rounded-[2.5rem] p-8">
        <h3 className="text-sm font-headline font-bold mb-8 uppercase tracking-[0.2em]">Profile & Security</h3>
        
        <div className="flex items-center gap-8 mb-10">
          <div className="w-24 h-24 rounded-[2rem] overflow-hidden border-2 border-primary/20">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary">
                <User className="w-10 h-10" />
              </div>
            )}
          </div>
          <div>
            <div className="text-2xl font-headline font-black">{user?.displayName || "Administrator"}</div>
            <div className="text-on-surface-variant text-sm">{user?.email || "admin@aquacontrol.pro"}</div>
            <div className="flex gap-4 mt-4">
              <button className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Edit Profile</button>
              <button onClick={onLogout} className="text-[10px] font-black uppercase tracking-widest text-error hover:underline">Sign Out</button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl border border-white/5">
            <div className="flex items-center gap-4">
              <Bell className="w-5 h-5 text-primary" />
              <div>
                <div className="text-sm font-bold font-headline">Push Notifications</div>
                <div className="text-[10px] text-on-surface-variant">Alerts for critical temp deviations</div>
              </div>
            </div>
            <div className="w-10 h-5 bg-primary rounded-full relative">
              <div className="absolute right-1 top-1 w-3 h-3 bg-on-primary-container rounded-full" />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl border border-white/5">
            <div className="flex items-center gap-4">
              <ShieldCheck className="w-5 h-5 text-secondary" />
              <div>
                <div className="text-sm font-bold font-headline">Two-Factor Auth</div>
                <div className="text-[10px] text-on-surface-variant">Enhanced security for device control</div>
              </div>
            </div>
            <div className="w-10 h-5 bg-surface-variant rounded-full relative">
              <div className="absolute left-1 top-1 w-3 h-3 bg-on-surface-variant/40 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface-container rounded-[2.5rem] p-8">
        <h3 className="text-sm font-headline font-bold mb-8 uppercase tracking-[0.2em]">System Preferences</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 block">Temperature Unit</label>
            <select className="w-full bg-surface-container-low border border-white/5 rounded-xl px-4 py-3 text-sm font-headline outline-none focus:border-primary/50">
              <option>Celsius (°C)</option>
              <option>Fahrenheit (°F)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 block">Data Refresh Rate</label>
            <select className="w-full bg-surface-container-low border border-white/5 rounded-xl px-4 py-3 text-sm font-headline outline-none focus:border-primary/50">
              <option>Real-time (1s)</option>
              <option>Balanced (5s)</option>
              <option>Economy (30s)</option>
            </select>
          </div>
        </div>
      </section>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [telemetry, setTelemetry] = useState({ currentTemp: 27.5, humidity: 62, waterLevel: 85 });
  const [settings, setSettings] = useState({ targetTemp: 22, fanSpeed: "Med", turboBoost: false });
  const [btStatus, setBtStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [btDevice, setBtDevice] = useState<BluetoothDevice | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Firebase Auth ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setIsAuthModalOpen(false);
    } catch (err) {
      console.error("Google login failed", err);
    }
  };

  const handleEmailLogin = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const handleEmailSignup = async (email: string, pass: string, name: string) => {
    const res = await createUserWithEmailAndPassword(auth, email, pass);
    if (res.user) {
      await updateProfile(res.user, { displayName: name });
    }
  };

  const handleLogout = () => signOut(auth);

  // --- Firestore Real-time Sync ---
  useEffect(() => {
    if (!isAuthReady || !user) return;

    const deviceId = "AQ-7729-F"; // Static for demo
    
    // Test connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'devices', deviceId));
      } catch (err) {
        if (err instanceof Error && err.message.includes('the client is offline')) {
          console.error("Firebase offline or config error");
        }
      }
    };
    testConnection();

    // Listen to Telemetry
    const unsubTelemetry = onSnapshot(doc(db, "devices", deviceId, "telemetry", "latest"), (snap) => {
      if (snap.exists()) {
        setTelemetry(snap.data() as any);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `devices/${deviceId}/telemetry/latest`));

    // Listen to Settings
    const unsubSettings = onSnapshot(doc(db, "devices", deviceId, "settings", "current"), (snap) => {
      if (snap.exists()) {
        setSettings(snap.data() as any);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `devices/${deviceId}/settings/current`));

    return () => {
      unsubTelemetry();
      unsubSettings();
    };
  }, [isAuthReady, user]);

  const updateSettings = async (newSettings: Partial<typeof settings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);

    // If Bluetooth connected, send via BT
    if (btStatus === "connected") {
      // Logic to send via BT characteristic
      console.log("Sending settings via Bluetooth:", updated);
    }

    // If Online, sync to Firestore
    if (user) {
      const deviceId = "AQ-7729-F";
      try {
        await setDoc(doc(db, "devices", deviceId, "settings", "current"), {
          ...updated,
          lastUpdated: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `devices/${deviceId}/settings/current`);
      }
    }
  };

  // --- Bluetooth Logic ---
  const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
  const SETTINGS_CHAR_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

  const connectBluetooth = async () => {
    if (!navigator.bluetooth) {
      setError("Web Bluetooth is not supported in this browser.");
      return;
    }

    setBtStatus("connecting");
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'ESP32-AquaControl' }],
        optionalServices: [SERVICE_UUID]
      });

      setBtDevice(device);
      
      device.addEventListener('gattserverdisconnected', () => {
        setBtStatus("disconnected");
        setBtDevice(null);
      });

      const server = await device.gatt?.connect();
      const service = await server?.getPrimaryService(SERVICE_UUID);
      const characteristic = await service?.getCharacteristic(SETTINGS_CHAR_UUID);
      
      console.log("Connected to ESP32 via Bluetooth");
      setBtStatus("connected");
      
    } catch (err) {
      console.error("Bluetooth connection failed", err);
      setBtStatus("disconnected");
      setError("Bluetooth connection failed. Make sure your ESP is in pairing mode.");
    }
  };

  const disconnectBluetooth = () => {
    btDevice?.gatt?.disconnect();
    setBtStatus("disconnected");
    setBtDevice(null);
  };

  return (
    <div className="min-h-screen bg-background text-on-surface selection:bg-primary/30">
      <Sidebar 
        user={user} 
        onLogin={() => setIsAuthModalOpen(true)} 
        onLogout={handleLogout} 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onGoogleLogin={handleGoogleLogin}
        onEmailLogin={handleEmailLogin}
        onEmailSignup={handleEmailSignup}
      />
      
      <main className="lg:ml-64 p-6 lg:p-10 pt-24 lg:pt-10 min-h-screen max-w-[1600px] mx-auto pb-24 lg:pb-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
          <div>
            <motion.h2 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-3xl lg:text-4xl font-black font-headline tracking-tighter text-on-surface"
            >
              {activeTab}
            </motion.h2>
            <p className="text-on-surface-variant text-xs lg:text-sm font-medium mt-1 tracking-wide">
              Device ID: <span className="text-on-surface">AQ-7729-F</span> | {activeTab === "Dashboard" ? "Laboratory Environment" : `System ${activeTab}`}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 lg:gap-5">
            {/* Bluetooth Status */}
            <button 
              onClick={btStatus === "connected" ? disconnectBluetooth : connectBluetooth}
              className={`px-4 lg:px-5 py-2 lg:py-2.5 rounded-full flex items-center gap-2 lg:gap-3 border transition-all ${
                btStatus === "connected" 
                  ? "bg-secondary/10 border-secondary/20 text-secondary" 
                  : "bg-surface-container border-white/5 text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {btStatus === "connecting" ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                  <Bluetooth className="w-3.5 h-3.5 lg:w-4 h-4" />
                </motion.div>
              ) : btStatus === "connected" ? (
                <Bluetooth className="w-3.5 h-3.5 lg:w-4 h-4" />
              ) : (
                <BluetoothOff className="w-3.5 h-3.5 lg:w-4 h-4" />
              )}
              <span className="text-[9px] lg:text-[10px] font-black tracking-[0.2em] uppercase">
                {btStatus === "connected" ? "BT Connected" : btStatus === "connecting" ? "Pairing..." : "Offline Mode"}
              </span>
            </button>

            {/* Online Status */}
            <div className={`px-4 lg:px-5 py-2 lg:py-2.5 rounded-full flex items-center gap-2 lg:gap-3 border ${
              user 
                ? "bg-tertiary-container border-tertiary-fixed/10 text-tertiary-fixed" 
                : "bg-surface-container border-white/5 text-on-surface-variant"
            }`}>
              <span className={`w-1.5 lg:w-2 h-1.5 lg:h-2 rounded-full ${user ? "bg-tertiary-fixed shadow-[0_0_10px_#5cfd80]" : "bg-on-surface-variant/30"}`} />
              <span className="text-[9px] lg:text-[10px] font-black tracking-[0.2em] uppercase">{user ? "Cloud Sync Active" : "Cloud Offline"}</span>
            </div>
            
            <button className="w-10 lg:w-12 h-10 lg:h-12 flex items-center justify-center rounded-xl lg:rounded-2xl bg-surface-container hover:bg-surface-container-high transition-all hover:scale-105 active:scale-95">
              <Bell className="w-4 h-4 lg:w-5 h-5 text-on-surface-variant" />
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === "Dashboard" && (
              <div className="grid grid-cols-12 gap-8">
                <div className="col-span-12 lg:col-span-7 xl:col-span-8 flex flex-col gap-8">
                  <TemperatureGauge value={telemetry.currentTemp} />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <StatCard 
                      icon={Droplets} 
                      label="Humidity" 
                      value={`${telemetry.humidity}%`} 
                      trend="+2% Opt." 
                      trendColor="text-tertiary-fixed" 
                    />
                    <StatCard 
                      icon={Thermometer} 
                      label="Water Level" 
                      value={`${telemetry.waterLevel}%`} 
                      progress={telemetry.waterLevel} 
                    />
                  </div>

                  <section className="bg-surface-container rounded-[2.5rem] p-10 relative overflow-hidden min-h-[200px] flex flex-col justify-end group">
                    <div className="absolute inset-0 z-0">
                      <img 
                        alt="Data visualization background" 
                        className="w-full h-full object-cover opacity-20 group-hover:opacity-30 transition-opacity duration-1000" 
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuAII9Us318-Voo1HD7aREmvzgMuAOU31IhkSDi0qJmJLZSZHgSRrPCb9Iu1mAQ_edP-Q2re1zMT8yw10dYg1IbEcS9qvRXz0JVGnZ7ox2e7CTj_akTv6iNaeV_ex-QzKPb4wQ4yvSK_fgtuYEHgypmjDWsETeflnB-d8p0ZXkY90PcAz18wtbjnITYTguv_AhAksZLo0kkEkLwyvI4Y727NaGudCbGUkyeMfVkO-IEfzpnJD-6-5xx1Ol1G9X-HLwuK8gCzWjYxoE1f"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-surface-container via-surface-container/40 to-transparent" />
                    </div>
                    <div className="relative z-10">
                      <h4 className="text-2xl font-headline font-bold tracking-tight">Intelligence Update</h4>
                      <p className="text-sm text-on-surface-variant mt-2 max-w-lg leading-relaxed font-medium">
                        Smart learning has predicted a 3°C rise in external temp by 14:00. Pre-cooling scheduled for optimal efficiency.
                      </p>
                    </div>
                  </section>
                </div>

                <div className="col-span-12 lg:col-span-5 xl:col-span-4 flex flex-col gap-8">
                  <FanDynamics 
                    speed={settings.fanSpeed} 
                    setSpeed={(s: string) => updateSettings({ fanSpeed: s })}
                    turbo={settings.turboBoost}
                    setTurbo={(t: boolean) => updateSettings({ turboBoost: t })}
                  />
                  <SystemHealth />
                  
                  <button className="bg-gradient-to-br from-secondary to-primary rounded-[2.5rem] p-10 flex flex-col items-center justify-center gap-4 group transition-all hover:shadow-[0_20px_50px_rgba(0,227,253,0.2)] active:scale-[0.98] relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Zap className="w-10 h-10 text-on-primary-container group-hover:scale-110 transition-transform duration-500" />
                    <span className="text-on-primary-container font-black uppercase tracking-[0.3em] text-sm">Force Maintenance</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === "Analytics" && <AnalyticsView telemetry={telemetry} />}
            {activeTab === "Connectivity" && (
              <ConnectivityView 
                btStatus={btStatus} 
                btDevice={btDevice} 
                connectBluetooth={connectBluetooth} 
                disconnectBluetooth={disconnectBluetooth}
                user={user}
              />
            )}
            {activeTab === "Schedule" && <ScheduleView />}
            {activeTab === "Settings" && <SettingsView user={user} onLogout={handleLogout} />}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed bottom-10 right-10 z-[100] bg-error/10 border border-error/20 p-4 rounded-2xl flex items-center justify-between min-w-[300px] backdrop-blur-xl"
            >
              <div className="flex items-center gap-3 text-error">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm font-medium">{error}</span>
              </div>
              <button onClick={() => setError(null)} className="text-on-surface-variant hover:text-on-surface ml-4">
                <CheckCircle2 className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}} />
    </div>
  );
}
