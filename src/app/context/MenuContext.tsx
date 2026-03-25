import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { MenuItem } from './CartContext';
import { api } from '../../lib/api';

const DEFAULT_MENU_IMAGE = 'https://via.placeholder.com/800x600.png?text=Menu+Item';

function getMenuItemPriority(item: Pick<MenuItem, 'isBestSeller' | 'isNew'>) {
  return (item.isBestSeller ? 2 : 0) + (item.isNew ? 1 : 0);
}

function sortMenuItems(items: MenuItem[]) {
  return [...items].sort((left, right) => {
    const priorityDifference = getMenuItemPriority(right) - getMenuItemPriority(left);
    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    const categoryDifference = left.category.localeCompare(right.category);
    if (categoryDifference !== 0) {
      return categoryDifference;
    }

    return left.name.localeCompare(right.name);
  });
}

export interface Bundle {
  id: string;
  name: string;
  description: string;
  items: string[]; // Array of menu item IDs
  price: number;
  originalPrice: number;
  image: string;
}

export interface Offer {
  id: string;
  type: 'percentage' | 'fixed';
  value: number;
  itemIds: string[];
  description: string;
  image: string; // Carousel image URL
  active: boolean;
}

interface MenuContextType {
  menuItems: MenuItem[];
  bundles: Bundle[];
  offers: Offer[];
  addMenuItem: (item: Omit<MenuItem, 'id'>) => void;
  updateMenuItem: (id: string, item: Partial<MenuItem>) => void;
  deleteMenuItem: (id: string) => void;
  addBundle: (bundle: Omit<Bundle, 'id'>) => void;
  updateBundle: (id: string, bundle: Partial<Bundle>) => void;
  deleteBundle: (id: string) => void;
  addOffer: (offer: Omit<Offer, 'id'>) => void;
  updateOffer: (id: string, offer: Partial<Offer>) => void;
  deleteOffer: (id: string) => void;
  getItemPrice: (itemId: string) => number;
}

const MenuContext = createContext<MenuContextType | undefined>(undefined);

export function MenuProvider({ children }: { children: ReactNode }) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);

  const refreshMenuItems = async () => {
    try {
      const rows = await api.getMenuItems();
      const mapped: MenuItem[] = rows.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: Number(item.price),
        category: item.category,
        image: item.image || DEFAULT_MENU_IMAGE,
        isBestSeller: !!item.is_best_seller,
        isNew: !!item.is_new,
      }));

      setMenuItems(sortMenuItems(mapped));
    } catch (error) {
      // Keep local fallback data if API is temporarily unavailable.
      console.error('Failed to refresh menu items', error);
    }
  };

  const refreshBundles = async () => {
    try {
      const rows = await api.getBundles();
      const mapped: Bundle[] = rows.map((bundle) => ({
        id: bundle.id,
        name: bundle.name,
        description: bundle.description,
        items: Array.isArray(bundle.items) ? bundle.items : [],
        price: Number(bundle.price),
        originalPrice: Number(bundle.originalPrice ?? bundle.price),
        image: bundle.image || DEFAULT_MENU_IMAGE,
      }));
      setBundles(mapped);
    } catch (error) {
      console.error('Failed to refresh bundles', error);
    }
  };

  const refreshOffers = async () => {
    try {
      const rows = await api.getOffers();
      const mapped: Offer[] = rows.map((offer: any) => ({
        id: String(offer.id),
        type: offer.type === 'fixed' ? 'fixed' : 'percentage',
        value: Number(offer.value ?? 0),
        itemIds: Array.isArray(offer.itemIds) ? offer.itemIds : [],
        description: String(offer.description ?? ''),
        image: String(offer.image ?? 'https://via.placeholder.com/1200x400.png?text=Offer'),
        active: Boolean(offer.active),
      }));
      setOffers(mapped);
    } catch (error) {
      console.error('Failed to refresh offers', error);
    }
  };

  useEffect(() => {
    void refreshMenuItems();
    void refreshBundles();
    void refreshOffers();

    // Polling keeps menu changes visible quickly across customer/admin views.
    const interval = setInterval(() => {
      void refreshMenuItems();
      void refreshBundles();
      void refreshOffers();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const addMenuItem = (item: Omit<MenuItem, 'id'>) => {
    const newItem: MenuItem = {
      ...item,
      id: `item-${Date.now()}`,
    };
    void (async () => {
      try {
        await api.createMenuItem(newItem);
        await refreshMenuItems();
      } catch (error) {
        console.error('Failed to add menu item', error);
      }
    })();
  };

  const updateMenuItem = (id: string, item: Partial<MenuItem>) => {
    setMenuItems(prev =>
      sortMenuItems(
        prev.map(menuItem =>
          menuItem.id === id ? { ...menuItem, ...item } : menuItem
        )
      )
    );

    void (async () => {
      try {
        await api.updateMenuItem(id, item);
        await refreshMenuItems();
      } catch (error) {
        console.error('Failed to update menu item', error);
      }
    })();
  };

  const deleteMenuItem = (id: string) => {
    setMenuItems(prev => prev.filter(item => item.id !== id));

    void (async () => {
      try {
        await api.deleteMenuItem(id);
        await refreshMenuItems();
      } catch (error) {
        console.error('Failed to delete menu item', error);
      }
    })();
  };

  const addBundle = (bundle: Omit<Bundle, 'id'>) => {
    const newBundle: Bundle = {
      ...bundle,
      id: `bundle-${Date.now()}`,
    };
    setBundles(prev => [...prev, newBundle]);

    void (async () => {
      try {
        await api.createBundle(newBundle);
        await refreshBundles();
      } catch (error) {
        console.error('Failed to add bundle', error);
      }
    })();
  };

  const updateBundle = (id: string, bundle: Partial<Bundle>) => {
    setBundles(prev =>
      prev.map(b =>
        b.id === id ? { ...b, ...bundle } : b
      )
    );

    void (async () => {
      try {
        await api.updateBundle(id, bundle);
        await refreshBundles();
      } catch (error) {
        console.error('Failed to update bundle', error);
      }
    })();
  };

  const deleteBundle = (id: string) => {
    setBundles(prev => prev.filter(b => b.id !== id));

    void (async () => {
      try {
        await api.deleteBundle(id);
        await refreshBundles();
      } catch (error) {
        console.error('Failed to delete bundle', error);
      }
    })();
  };

  const addOffer = (offer: Omit<Offer, 'id'>) => {
    const newOffer: Offer = {
      ...offer,
      id: `offer-${Date.now()}`,
      image: offer.image || 'https://via.placeholder.com/1200x400.png?text=Offer',
    };
    setOffers(prev => [...prev, newOffer]);

    void (async () => {
      try {
        await api.createOffer(newOffer);
        await refreshOffers();
      } catch (error) {
        console.error('Failed to add offer', error);
      }
    })();
  };

  const updateOffer = (id: string, offer: Partial<Offer>) => {
    setOffers(prev =>
      prev.map(o =>
        o.id === id ? { ...o, ...offer, image: offer.image || o.image || 'https://via.placeholder.com/1200x400.png?text=Offer' } : o
      )
    );

    void (async () => {
      try {
        await api.updateOffer(id, offer);
        await refreshOffers();
      } catch (error) {
        console.error('Failed to update offer', error);
      }
    })();
  };

  const deleteOffer = (id: string) => {
    setOffers(prev => prev.filter(o => o.id !== id));

    void (async () => {
      try {
        await api.deleteOffer(id);
        await refreshOffers();
      } catch (error) {
        console.error('Failed to delete offer', error);
      }
    })();
  };

  const getItemPrice = (itemId: string): number => {
    const item = menuItems.find(i => i.id === itemId);
    if (!item) return 0;

    const activeOffer = offers.find(
      o => o.active && o.itemIds.includes(itemId)
    );

    if (activeOffer) {
      if (activeOffer.type === 'percentage') {
        return item.price * (1 - activeOffer.value / 100);
      } else {
        return Math.max(0, item.price - activeOffer.value);
      }
    }

    return item.price;
  };

  return (
    <MenuContext.Provider
      value={{
        menuItems,
        bundles,
        offers,
        addMenuItem,
        updateMenuItem,
        deleteMenuItem,
        addBundle,
        updateBundle,
        deleteBundle,
        addOffer,
        updateOffer,
        deleteOffer,
        getItemPrice,
      }}
    >
      {children}
    </MenuContext.Provider>
  );
}

export function useMenu() {
  const context = useContext(MenuContext);
  if (context === undefined) {
    throw new Error('useMenu must be used within a MenuProvider');
  }
  return context;
}
