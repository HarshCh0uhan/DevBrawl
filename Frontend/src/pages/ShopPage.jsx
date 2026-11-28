import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/axios';
import { useAuthStore } from '../store/authStore';

export default function ShopPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busyItem, setBusyItem] = useState(null);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await api.get('/shop');
        setItems(res.data.data);
      } catch (err) {
        setLoadError(err.response?.data?.message || 'Could not load the shop.');
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, []);

  const handleBuy = async (itemId) => {
    try {
      setBusyItem(itemId);
      const res = await api.post(`/shop/buy/${itemId}`);
      setUser({
        ...useAuthStore.getState().user,
        brawlPoints: res.data.data.brawlPoints,
        ownedItems: res.data.data.ownedItems,
      });
      alert('Purchase Successful!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to buy');
    } finally {
      setBusyItem(null);
    }
  };

  const handleEquip = async (itemId) => {
    try {
      setBusyItem(itemId);
      const res = await api.post(`/shop/equip/${itemId}`);
      setUser({
        ...useAuthStore.getState().user,
        activeAvatar: res.data.data.activeAvatar,
      });
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to equip item');
    } finally {
      setBusyItem(null);
    }
  };

  const ownedItems = user?.ownedItems || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 font-mono">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-white uppercase">Brawl Shop</h1>
            <p className="text-amber-500 font-bold">
              Balance: {(user?.brawlPoints || 0).toLocaleString()} PTS
            </p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-slate-500 hover:text-white uppercase text-xs cursor-pointer"
          >
            ← Back
          </button>
        </div>

        {loading ? (
          <p className="text-center text-slate-500 text-sm">Loading shop items...</p>
        ) : loadError ? (
          <p className="text-center text-red-400 text-sm">{loadError}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item) => {
              const isOwned = ownedItems.includes(item.id);
              const isActive = user?.activeAvatar === item.id;
              return (
                <div
                  key={item.id}
                  className="bg-slate-900 border-2 border-slate-800 p-6 rounded-xl flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-4xl">{item.icon}</div>
                    <div>
                      <h3 className="font-bold text-white uppercase">{item.name}</h3>
                      <p className="text-xs text-slate-500">{item.description}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-amber-500 font-black mb-2">{item.cost.toLocaleString()} PTS</p>
                    {isOwned ? (
                      <button
                        onClick={() => handleEquip(item.id)}
                        disabled={isActive || busyItem === item.id}
                        className="px-4 py-2 rounded text-xs font-bold uppercase bg-slate-800 text-slate-200 disabled:text-slate-500"
                      >
                        {isActive ? 'Equipped' : busyItem === item.id ? 'Working...' : 'Equip'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBuy(item.id)}
                        disabled={busyItem === item.id}
                        className="px-4 py-2 rounded text-xs font-bold uppercase bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-60"
                      >
                        {busyItem === item.id ? 'Working...' : 'Buy'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
