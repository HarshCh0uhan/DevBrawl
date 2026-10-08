import { useState } from 'react';

const DEFAULT_AVATARS = [
  // Emoji-style avatars (using SVG for crisp rendering)
  { id: 'emoji-1', type: 'emoji', label: '😎', bg: 'from-blue-500 to-blue-600' },
  { id: 'emoji-2', type: 'emoji', label: '🚀', bg: 'from-purple-500 to-purple-600' },
  { id: 'emoji-3', type: 'emoji', label: '💻', bg: 'from-green-500 to-green-600' },
  { id: 'emoji-4', type: 'emoji', label: '🎮', bg: 'from-orange-500 to-orange-600' },
  { id: 'emoji-5', type: 'emoji', label: '🧠', bg: 'from-pink-500 to-pink-600' },
  { id: 'emoji-6', type: 'emoji', label: '⚡', bg: 'from-yellow-400 to-yellow-500' },
  { id: 'emoji-7', type: 'emoji', label: '🔥', bg: 'from-red-500 to-red-600' },
  { id: 'emoji-8', type: 'emoji', label: '🌟', bg: 'from-indigo-500 to-indigo-600' },
  { id: 'emoji-9', type: 'emoji', label: '🎯', bg: 'from-teal-500 to-teal-600' },
  { id: 'emoji-10', type: 'emoji', label: '💡', bg: 'from-amber-500 to-amber-600' },
  { id: 'emoji-11', type: 'emoji', label: '🦸', bg: 'from-violet-500 to-violet-600' },
  { id: 'emoji-12', type: 'emoji', label: '🤖', bg: 'from-slate-500 to-slate-600' },
  // Generated gradient initials (will be personalized with username)
  { id: 'initials', type: 'initials', label: 'Initials', bg: 'from-cyan-500 to-blue-600' },
];

export default function AvatarSelector({ 
  selectedAvatar, 
  onSelect, 
  username = '',
  className = '' 
}) {
  const [hoveredId, setHoveredId] = useState(null);

  const getAvatarContent = (avatar, index) => {
    if (avatar.type === 'emoji') {
      return <span className="text-4xl select-none">{avatar.label}</span>;
    }
    // Initials type - generate from username
    const initials = username
      ? username.slice(0, 2).toUpperCase()
      : '??';
    return (
      <span className="text-2xl font-black select-none tracking-wider">
        {initials}
      </span>
    );
  };

  const getAvatarBg = (avatar, index) => {
    if (avatar.type === 'initials') {
      // Generate consistent gradient based on username
      const hash = username.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
      const gradients = [
        'from-cyan-500 to-blue-600',
        'from-purple-500 to-pink-600',
        'from-green-500 to-teal-600',
        'from-orange-500 to-red-600',
        'from-indigo-500 to-purple-600',
        'from-pink-500 to-rose-600',
        'from-emerald-500 to-cyan-600',
        'from-violet-500 to-fuchsia-600',
      ];
      return gradients[hash % gradients.length];
    }
    return avatar.bg;
  };

  return (
    <div className={`grid grid-cols-6 gap-3 ${className}`} role="radiogroup" aria-label="Choose avatar">
      {DEFAULT_AVATARS.map((avatar, index) => {
        const isSelected = selectedAvatar === avatar.id;
        const isHovered = hoveredId === avatar.id;
        
        return (
          <button
            key={avatar.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={avatar.label}
            onClick={() => onSelect(avatar.id)}
            onMouseEnter={() => setHoveredId(avatar.id)}
            onMouseLeave={() => setHoveredId(null)}
            className={`relative aspect-square rounded-2xl border-4 transition-all duration-200 
              ${isSelected 
                ? 'border-blue-400 ring-2 ring-blue-400/50 scale-105 shadow-lg shadow-blue-500/25' 
                : 'border-slate-700 hover:border-slate-500'
              }
              ${isHovered && !isSelected ? 'scale-110 border-slate-400' : ''}
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
              cursor-pointer overflow-hidden group
            `}
            style={{
              background: `linear-gradient(135deg, ${getAvatarBg(avatar, index).replace(' from-', '').replace(' to-', ', ')})`,
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center z-10">
              {getAvatarContent(avatar, index)}
            </div>
            
            {/* Selection indicator */}
            {isSelected && (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
            
            {/* Hover glow effect */}
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200`} 
              style={{ background: `linear-gradient(135deg, ${getAvatarBg(avatar, index).replace(' from-', '').replace(' to-', ', ')})` }} />
          </button>
        );
      })}
    </div>
  );
}