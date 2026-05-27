import  { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // UI Status State
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!email || !password) {
      setError('Please fill in all fields');
      setIsLoading(false);
      return;
    }

    const result = await login(email, password);
    setIsLoading(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error || 'Something went wrong');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-12 font-sans">
      <div className="w-full max-w-md rounded-xl bg-slate-800 p-8 shadow-lg border border-slate-700 text-center">
        <h2 className="text-3xl font-bold text-slate-100 mb-2">Welcome Back</h2>
        <p className="text-sm text-slate-400 mb-6">Log in to join your collaborative coding room</p>

        {error && (
          <div className="mb-5 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-left text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="text-left">
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-base text-slate-100 placeholder-slate-400 outline-none transition focus:border-blue-500 disabled:opacity-50"
              disabled={isLoading}
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-base text-slate-100 placeholder-slate-400 outline-none transition focus:border-blue-500 disabled:opacity-50"
              disabled={isLoading}
              required
            />
          </div>

          <button
            type="submit"
            className={`w-full rounded-md py-2.5 text-base font-bold text-white transition focus:outline-none ${
              isLoading 
                ? 'bg-slate-600 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
            }`}
            disabled={isLoading}
          >
            {isLoading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-400">
          Don't have an account?{' '}
          <Link to="/register" className="font-medium text-blue-400 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}