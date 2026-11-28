import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/axios';
import { useAuthStore } from '../store/authStore';

const avatarIcons = {
  avatar_cyber_1: '🥷',
  avatar_cyber_2: '👾',
  avatar_gold: '🏆',
  avatar_dragon: '🐉',
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/auth/me');
        const user = res.data.data.user;
        setProfile(user);
        setUser(user);
      } catch (err) {
        setError(err.response?.data?.message || 'Could not load profile.');
      }
    };
    fetchProfile();
  }, [setUser]);

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        {error || 'Loading...'}
      </div>
    );
  }

  const ownedItems = profile.ownedItems || [];
  const activeAvatar = profile.activeAvatar || 'default';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 font-mono">
      <div className="max-w-2xl mx-auto space-y-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-slate-500 hover:text-white uppercase text-xs cursor-pointer"
        >
          ← Back
        </button>

        <div className="bg-slate-900 border-2 border-slate-800 rounded-xl p-8 text-center space-y-4">
          <div className="h-24 w-24 bg-slate-800 rounded-full mx-auto flex items-center justify-center text-4xl">
            {activeAvatar === 'default' ? '👤' : avatarIcons[activeAvatar] || '✨'}
          </div>
          <h1 className="text-3xl font-black text-white uppercase">{profile.username}</h1>
          <div className="flex justify-center gap-8">
            <div>
              <p className="text-xs text-slate-500 uppercase">Brawl Points</p>
              <p className="text-2xl font-black text-amber-500">
                {(profile.brawlPoints || 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase">Cosmetics Owned</p>
              <p className="text-2xl font-black text-indigo-400">{ownedItems.length}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-slate-500 uppercase">Owned Avatars</p>
            <div className="flex flex-wrap justify-center gap-2">
              {ownedItems.length ? ownedItems.map((itemId) => (
                <span
                  key={itemId}
                  className={`rounded border px-3 py-1 text-xs ${
                    itemId === activeAvatar
                      ? 'border-amber-500 text-amber-400'
                      : 'border-slate-700 text-slate-300'
                  }`}
                >
                  {avatarIcons[itemId] || '✨'} {itemId.replace('avatar_', '').replaceAll('_', ' ')}
                  {itemId === activeAvatar ? ' · EQUIPPED' : ''}
                </span>
              )) : (
                <span className="text-xs text-slate-600">No cosmetics purchased yet.</span>
              )}
            </div>
          </div>
          <button
            onClick={() => navigate('/shop')}
            className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded font-bold uppercase text-sm cursor-pointer"
          >
            Go to Shop
          </button>
        </div>
      </div>
    </div>
  );
}
