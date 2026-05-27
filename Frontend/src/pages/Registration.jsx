import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore((state) => state.register);

  // Form Fields State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [avatar, setAvatar] = useState(null);

  // UI Status State
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setAvatar(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Validation check for the mandatory file input
    if (!avatar) {
      setError('Please upload an avatar image');
      setIsLoading(false);
      return;
    }

    try {
      // 1. Build multipart FormData to support file transmission
      const formData = new FormData();
      formData.append('email', email);
      formData.append('password', password);
      formData.append('fullName', fullName);
      formData.append('username', username);
      formData.append('phoneNumber', phoneNumber);
      formData.append('avatar', avatar); // The file object binary

      // 2. Dispatch to your Zustand store register action
      const result = await register(formData);
      setIsLoading(false);

      if (result.success) {
        // Automatically redirects to workspace dashboard on success
        navigate('/login');
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (err) {
      console.log(err);
      setIsLoading(false);
      setError('An unexpected error occurred during profile compilation');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-12 font-sans">
      <div className="w-full max-w-md rounded-xl bg-slate-800 p-8 shadow-lg border border-slate-700 text-center">
        <h2 className="text-3xl font-bold text-slate-100 mb-2">Create Account</h2>
        <p className="text-sm text-slate-400 mb-6">Join the real-time collaborative platform</p>

        {error && (
          <div className="mb-5 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-left text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="text-left space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-1.5 text-base text-slate-100 placeholder-slate-400 outline-none transition focus:border-blue-500 disabled:opacity-50"
              disabled={isLoading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="johndoe123"
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-1.5 text-base text-slate-100 placeholder-slate-400 outline-none transition focus:border-blue-500 disabled:opacity-50"
              disabled={isLoading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-1.5 text-base text-slate-100 placeholder-slate-400 outline-none transition focus:border-blue-500 disabled:opacity-50"
              disabled={isLoading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-1.5 text-base text-slate-100 placeholder-slate-400 outline-none transition focus:border-blue-500 disabled:opacity-50"
              disabled={isLoading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Phone Number</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="1234567890"
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-1.5 text-base text-slate-100 placeholder-slate-400 outline-none transition focus:border-blue-500 disabled:opacity-50"
              disabled={isLoading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Profile Avatar</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full text-sm text-slate-400 file:mr-4 file:py-1.5 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-600/20 file:text-blue-400 hover:file:bg-blue-600/30 file:cursor-pointer disabled:opacity-50"
              disabled={isLoading}
              required
            />
          </div>

          <button
            type="submit"
            className={`w-full rounded-md py-2.5 text-base font-bold text-white transition focus:outline-none mt-2 ${
              isLoading 
                ? 'bg-slate-600 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
            }`}
            disabled={isLoading}
          >
            {isLoading ? 'Processing Registration...' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-blue-400 hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}