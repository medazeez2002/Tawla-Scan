import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { MenuItem } from '../context/CartContext';
import { Button } from './ui/button';

interface MenuCardProps {
  item: MenuItem;
  onAddToCart: (item: MenuItem) => void;
}

export function MenuCard({ item, onAddToCart }: MenuCardProps) {
  const newArrivalTopClass = item.isBestSeller ? 'top-16' : 'top-5';
  const [isAdding, setIsAdding] = useState(false);
  const [effectKey, setEffectKey] = useState(0);
  const addTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (addTimerRef.current) {
        clearTimeout(addTimerRef.current);
      }
    };
  }, []);

  const handleAdd = () => {
    onAddToCart(item);

    if (addTimerRef.current) {
      clearTimeout(addTimerRef.current);
    }

    setEffectKey((previous) => previous + 1);
    setIsAdding(true);
    addTimerRef.current = setTimeout(() => {
      setIsAdding(false);
      addTimerRef.current = null;
    }, 760);
  };

  return (
    <div className={`group bg-white dark:bg-zinc-900 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-xl dark:hover:shadow-zinc-900/60 hover:-translate-y-1 hover:border-amber-300 dark:hover:border-amber-700/60 transition-all duration-300 ease-out cursor-pointer ${
      isAdding ? 'menu-card-add-pop' : ''
    }`}>
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={item.image}
          alt={item.name}
          className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out ${
            isAdding ? 'menu-card-image-pop' : ''
          }`}
        />
        {item.isBestSeller && (
          <span className="absolute -left-12 top-5 z-10 w-44 -rotate-45 bg-amber-500 py-1.5 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-lg">
            Best Seller
          </span>
        )}
        {item.isNew && (
          <span className={`absolute -left-12 ${newArrivalTopClass} z-10 w-44 -rotate-45 bg-emerald-500 py-1.5 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-lg`}>
            New Arrival
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-zinc-900 dark:text-zinc-100 mb-1">{item.name}</h3>
        <p className="text-sm text-zinc-400 dark:text-zinc-400 mb-3">{item.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-lg text-zinc-900 dark:text-zinc-100">{item.price.toFixed(2)} TND</span>
          <Button
            size="sm"
            onClick={handleAdd}
            className={`relative overflow-hidden bg-amber-600 text-white hover:bg-amber-700 ${
              isAdding ? 'menu-add-btn-pop' : ''
            }`}
          >
            <Plus className="relative z-10 mr-1 h-4 w-4" />
            <span className="relative z-10">Add</span>
            {isAdding && <span key={`ripple-${effectKey}`} className="menu-add-ripple" aria-hidden="true" />}
            {isAdding && <span key={`burst-${effectKey}`} className="menu-add-burst" aria-hidden="true">+1</span>}
          </Button>
        </div>
      </div>
    </div>
  );
}
