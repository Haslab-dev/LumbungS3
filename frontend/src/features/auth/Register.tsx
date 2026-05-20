import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Lock, User, Eye, EyeOff, Loader2, AlertCircle, Mail, ArrowLeft } from 'lucide-react';
import api from '../../lib/api';

export function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await api.post('/auth/register', { username, email, password });
      // Redirect to login after successful registration
      window.location.href = '/?registered=true';
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(
        err.response?.data?.error || 
        'Could not register account. Please check your details.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-900 relative flex items-center justify-center p-6 overflow-hidden select-none">
      {/* Decorative Ambient Neon Background Glows */}
      <div className="absolute top-1/4 right-1/4 translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 left-1/4 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[8000ms]"></div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8 relative">
          <button 
            onClick={() => window.location.href = '/'}
            className="absolute left-0 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
            title="Back to Login"
          >
            <ArrowLeft size={20} />
          </button>
          <motion.div 
            initial={{ scale: 0.8, rotate: 10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.6, delay: 0.2, type: 'spring' }}
            className="w-16 h-16 bg-rose-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-rose-600/40 border border-rose-400/20 mb-4"
          >
            <Database className="text-white" size={32} />
          </motion.div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">LumbungS3</h1>
          <p className="text-sm text-slate-400 mt-1 uppercase tracking-widest font-bold text-rose-400">
            Node Registration
          </p>
        </div>

        {/* Glassmorphic Register Card */}
        <div className="glass-card rounded-3xl p-8 border border-white/5 relative overflow-hidden backdrop-blur-2xl shadow-2xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-purple-500 to-indigo-500"></div>

          <h2 className="text-xl font-semibold text-white mb-6">Create Account</h2>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex gap-3 items-start overflow-hidden"
                >
                  <AlertCircle className="text-rose-400 shrink-0 mt-0.5" size={18} />
                  <span className="text-xs text-rose-300 font-medium leading-relaxed">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Username Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 ml-1">Username</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-rose-400 transition-colors">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  placeholder="johndoe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl pl-11 pr-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all placeholder:text-slate-600 text-sm"
                  required
                />
              </div>
            </div>

            {/* Email Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 ml-1">Email Address</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-rose-400 transition-colors">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl pl-11 pr-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all placeholder:text-slate-600 text-sm"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 ml-1">Password</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-rose-400 transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl pl-11 pr-12 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all placeholder:text-slate-600 text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 ml-1">Confirm Password</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-rose-400 transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl pl-11 pr-12 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all placeholder:text-slate-600 text-sm"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-600/50 text-white rounded-xl font-medium transition-all duration-200 shadow-lg shadow-rose-500/25 active:scale-95 flex items-center justify-center gap-2 mt-8 cursor-pointer border border-rose-400/10"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Processing...
                </>
              ) : (
                'Register Node Account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <a href="/" className="text-xs text-rose-400 hover:text-rose-300 transition-colors font-medium">
              Already have credentials? Sign in
            </a>
          </div>
        </div>

        <p className="text-center text-[10px] text-slate-600 mt-6 tracking-wide leading-relaxed">
          Access is restricted and provisioned securely.
        </p>
      </motion.div>
    </div>
  );
}
