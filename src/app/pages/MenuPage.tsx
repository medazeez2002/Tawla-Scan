import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { Coffee, Leaf, IceCream, Martini, Utensils, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useMenu, Offer } from '../context/MenuContext';
import { MenuCard } from '../components/MenuCard';
import { CartDrawer } from '../components/CartDrawer';
import { Button } from '../components/ui/button';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '../components/ui/alert-dialog';

export function MenuPage() {
  const [searchParams] = useSearchParams();
  const [businessName, setBusinessName] = useState('The Local Cafe');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'coffee' | 'tea' | 'milkshake' | 'cocktail' | 'food'>('all');
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [currentOfferIndex, setCurrentOfferIndex] = useState(0);
  const [offerImageIndex, setOfferImageIndex] = useState(0);
  const heroTouchStartXRef = useRef<number | null>(null);
  const offerTouchStartXRef = useRef<number | null>(null);
  const { addToCart } = useCart();
  const { menuItems, bundles, offers, getItemPrice } = useMenu();
  const activeOffers = useMemo(() => offers.filter((offer) => offer.active), [offers]);
  const currentOffer = activeOffers[currentOfferIndex] ?? null;

  const offerShowcaseImages = useMemo(() => {
    if (!selectedOffer) {
      return [] as string[];
    }

    const itemImages = selectedOffer.itemIds
      .map((id) => menuItems.find((item) => item.id === id)?.image)
      .filter((image): image is string => Boolean(image && image.trim()));

    const unique = new Set<string>();
    const ordered = [selectedOffer.image, ...itemImages]
      .filter((image): image is string => Boolean(image && image.trim()));

    for (const image of ordered) {
      unique.add(image);
    }

    return [...unique];
  }, [menuItems, selectedOffer]);

  useEffect(() => {
    let cancelled = false;

    api.getPublicSettings().then((settings) => {
      const nextName = String(settings.businessName ?? '').trim();
      if (!cancelled && nextName) {
        setBusinessName(nextName);
      }
    }).catch(() => {
      // Keep fallback business name when public settings cannot be loaded.
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setOfferImageIndex(0);
  }, [selectedOffer?.id]);

  const goToOfferIndex = (index: number) => {
    if (activeOffers.length === 0) {
      return;
    }

    const normalizedIndex = (index + activeOffers.length) % activeOffers.length;
    setCurrentOfferIndex(normalizedIndex);
  };

  useEffect(() => {
    if (activeOffers.length <= 1) {
      return;
    }

    const timer = setInterval(() => {
      setCurrentOfferIndex((previous) => (previous + 1) % activeOffers.length);
    }, 4800);

    return () => {
      clearInterval(timer);
    };
  }, [activeOffers.length]);

  useEffect(() => {
    setCurrentOfferIndex((previous) => {
      if (activeOffers.length === 0) {
        return 0;
      }
      return Math.min(previous, activeOffers.length - 1);
    });
  }, [activeOffers.length]);

  const goToPreviousOffer = () => goToOfferIndex(currentOfferIndex - 1);

  const goToNextOffer = () => goToOfferIndex(currentOfferIndex + 1);

  const filteredItems = selectedCategory === 'all'
    ? menuItems
    : menuItems.filter(item => item.category === selectedCategory);

  const bundleCards = selectedCategory === 'all'
    ? bundles.map((bundle) => {
      const firstItemImage = menuItems.find((menuItem) => bundle.items.includes(menuItem.id))?.image;
      const includesText = bundle.items
        .map((itemId) => menuItems.find((menuItem) => menuItem.id === itemId)?.name)
        .filter(Boolean)
        .join(', ');

      return {
        id: bundle.id,
        name: bundle.name,
        description: bundle.description || (includesText ? `Includes: ${includesText}` : 'Combo bundle'),
        price: bundle.price,
        category: 'food' as const,
        image: bundle.image || firstItemImage || 'https://via.placeholder.com/800x600.png?text=Bundle',
      };
    })
    : [];

  const featuredItems = filteredItems.filter((item) => item.isBestSeller || item.isNew);
  const regularItems = filteredItems.filter((item) => !item.isBestSeller && !item.isNew);
  const displayItems = selectedCategory === 'all'
    ? [...featuredItems, ...bundleCards, ...regularItems]
    : filteredItems;

  const rawTableParam = searchParams.get('table');
  const parsedTableNumber = rawTableParam ? Number(rawTableParam) : NaN;
  const tableNumber = Number.isInteger(parsedTableNumber) && parsedTableNumber > 0 ? parsedTableNumber : null;

  useEffect(() => {
    const title = tableNumber
      ? `${businessName} - Table #${tableNumber}`
      : `${businessName} - Menu`;
    document.title = title;
  }, [businessName, tableNumber]);

  const handleAddToCart = (item: any) => {
    addToCart(item);
    const isBundle = String(item.id).startsWith('bundle-');
    toast.success(isBundle ? `${item.name} combo added to cart` : `${item.name} added to cart`);
  };

  const handleAddOffer = (offer: Offer) => {
    offer.itemIds.forEach(id => {
      const item = menuItems.find(i => i.id === id);
      if (item) {
        const discountedPrice = getItemPrice(id);
        addToCart(item, discountedPrice);
      }
    });
    toast.success(`Offer applied: ${offer.description}`);
    setSelectedOffer(null);
  };

  const goToPreviousOfferImage = () => {
    const imageCount = offerShowcaseImages.length;
    if (imageCount <= 1) {
      return;
    }
    setOfferImageIndex((previous) => (previous - 1 + imageCount) % imageCount);
  };

  const goToNextOfferImage = () => {
    const imageCount = offerShowcaseImages.length;
    if (imageCount <= 1) {
      return;
    }
    setOfferImageIndex((previous) => (previous + 1) % imageCount);
  };

  const handleOfferCarouselTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    offerTouchStartXRef.current = event.changedTouches[0].screenX;
  };

  const handleOfferCarouselTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (offerTouchStartXRef.current === null) {
      return;
    }

    const touchEndX = event.changedTouches[0].screenX;
    const distance = offerTouchStartXRef.current - touchEndX;
    offerTouchStartXRef.current = null;

    if (Math.abs(distance) < 40) {
      return;
    }

    if (distance > 0) {
      goToNextOfferImage();
      return;
    }

    goToPreviousOfferImage();
  };

  const buildOfferDetailText = (offer: Offer) => {
    const itemNames = offer.itemIds
      .map((id) => menuItems.find((item) => item.id === id)?.name)
      .filter(Boolean)
      .join(', ');

    if (offer.type === 'percentage') {
      return `${offer.value}% off ${itemNames}`;
    }

    return `${offer.value.toFixed(2)} TND off ${itemNames}`;
  };

  const currentOfferItemNames = useMemo(() => {
    if (!currentOffer) {
      return [] as string[];
    }

    return currentOffer.itemIds
      .map((id) => menuItems.find((item) => item.id === id)?.name)
      .filter((name): name is string => Boolean(name && name.trim()));
  }, [currentOffer, menuItems]);

  const handleHeroTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    heroTouchStartXRef.current = event.changedTouches[0].screenX;
  };

  const handleHeroTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (heroTouchStartXRef.current === null) {
      return;
    }

    const touchEndX = event.changedTouches[0].screenX;
    const distance = heroTouchStartXRef.current - touchEndX;
    heroTouchStartXRef.current = null;

    if (Math.abs(distance) < 36) {
      return;
    }

    if (distance > 0) {
      goToNextOffer();
      return;
    }

    goToPreviousOffer();
  };

  const categoryButtonBase = 'h-8 whitespace-nowrap rounded-md border px-3 text-sm';
  const categoryButtonActive = 'border-transparent bg-amber-600 text-white hover:bg-amber-700';
  const categoryButtonInactive = 'border-[#d9c0a4] bg-[#fffcf8] text-[#7a5539] hover:bg-[#f8ecd9] dark:border-[#303746] dark:bg-[#171b24] dark:text-[#c4cbd8] dark:hover:bg-[#222838] dark:hover:text-[#f3f4f6]';

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-30">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Coffee className="h-8 w-8 text-amber-600" />
              <div>
                <h1 className="text-2xl text-zinc-900 dark:text-zinc-100">{businessName}</h1>
                {tableNumber && (
                  <p className="text-sm text-[#7a5539] dark:text-zinc-300">Table #{tableNumber}</p>
                )}
              </div>
            </div>
            <ThemeToggle />
          </div>
          
          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('all')}
              className={`${categoryButtonBase} ${selectedCategory === 'all' ? categoryButtonActive : categoryButtonInactive}`}
            >
              All
            </Button>
            <Button
              variant={selectedCategory === 'coffee' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('coffee')}
              className={`${categoryButtonBase} ${selectedCategory === 'coffee' ? categoryButtonActive : categoryButtonInactive}`}
            >
              <Coffee className="mr-2 h-3.5 w-3.5" />
              Coffee
            </Button>
            <Button
              variant={selectedCategory === 'tea' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('tea')}
              className={`${categoryButtonBase} ${selectedCategory === 'tea' ? categoryButtonActive : categoryButtonInactive}`}
            >
              <Leaf className="mr-2 h-3.5 w-3.5" />
              Tea
            </Button>
            <Button
              variant={selectedCategory === 'milkshake' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('milkshake')}
              className={`${categoryButtonBase} ${selectedCategory === 'milkshake' ? categoryButtonActive : categoryButtonInactive}`}
            >
              <IceCream className="mr-2 h-3.5 w-3.5" />
              Milkshakes
            </Button>
            <Button
              variant={selectedCategory === 'cocktail' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('cocktail')}
              className={`${categoryButtonBase} ${selectedCategory === 'cocktail' ? categoryButtonActive : categoryButtonInactive}`}
            >
              <Martini className="mr-2 h-3.5 w-3.5" />
              Cocktails
            </Button>
            <Button
              variant={selectedCategory === 'food' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('food')}
              className={`${categoryButtonBase} ${selectedCategory === 'food' ? categoryButtonActive : categoryButtonInactive}`}
            >
              <Utensils className="mr-2 h-3.5 w-3.5" />
              Food
            </Button>
          </div>
        </div>
      </header>

      {/* Offers Carousel */}
      <div className="container mx-auto px-4">
        {tableNumber && (
          <div className="mt-4 rounded-lg border border-[#f0dfcd] bg-[#fff7ed] px-4 py-3 text-[#7a5539]">
            {businessName} - Table <span className="font-semibold">#{tableNumber}</span>
          </div>
        )}
        <div className="mb-6 mt-4">
          {activeOffers.length > 0 ? (
            <div className="relative overflow-hidden rounded-[28px] border border-[#edd8bb] bg-[linear-gradient(135deg,#fff6e8_0%,#fff9f1_46%,#fde8bd_100%)] p-3 shadow-[0_18px_50px_rgba(168,85,10,0.14)] dark:border-amber-900/50 dark:bg-[linear-gradient(135deg,#22150b_0%,#2b180c_48%,#4a2a11_100%)]">
              {currentOffer && (
                <div
                  className="grid items-stretch gap-3 md:grid-cols-[1.1fr_0.9fr]"
                  onTouchStart={handleHeroTouchStart}
                  onTouchEnd={handleHeroTouchEnd}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedOffer(currentOffer)}
                    className="group relative overflow-hidden rounded-[24px] bg-[#2f1f14] text-left text-white shadow-[0_18px_40px_rgba(47,31,20,0.28)] transition-transform duration-300 hover:scale-[1.01]"
                  >
                    {currentOffer.image && (
                      <img
                        src={currentOffer.image}
                        alt={currentOffer.description}
                        className="absolute inset-0 h-full w-full object-cover opacity-45 transition-transform duration-500 group-hover:scale-105"
                      />
                    )}
                    <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(47,31,20,0.92)_0%,rgba(47,31,20,0.68)_48%,rgba(47,31,20,0.28)_100%)]" />
                    <div className="relative flex min-h-[280px] flex-col justify-between p-5 sm:min-h-[320px] sm:p-6 md:min-h-[360px]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="rounded-full bg-white/14 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-100 backdrop-blur-sm sm:text-xs">
                          Limited Offer
                        </div>
                        <div className="rounded-full bg-amber-400 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[#2f1f14] shadow-[0_8px_18px_rgba(251,191,36,0.35)] sm:text-sm">
                          {currentOffer.type === 'percentage' ? `${currentOffer.value}% OFF` : `${currentOffer.value.toFixed(2)} TND OFF`}
                        </div>
                      </div>

                      <div className="max-w-xl space-y-3">
                        <h2 className="text-2xl font-black leading-tight text-white sm:text-3xl md:text-4xl">
                          {buildOfferDetailText(currentOffer)}
                        </h2>
                        <p className="max-w-lg text-sm leading-relaxed text-amber-50/90 sm:text-base">
                          {currentOffer.description}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-3">
                        {currentOfferItemNames.slice(0, 4).map((name) => (
                          <span
                            key={name}
                            className="rounded-full border border-white/16 bg-white/10 px-3 py-1 text-xs font-medium text-white/92 backdrop-blur-sm sm:text-sm"
                          >
                            {name}
                          </span>
                        ))}
                        {currentOfferItemNames.length > 4 && (
                          <span className="rounded-full border border-white/16 bg-white/10 px-3 py-1 text-xs font-medium text-white/92 backdrop-blur-sm sm:text-sm">
                            +{currentOfferItemNames.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  <div className="flex flex-col justify-between gap-3 rounded-[24px] border border-[#ecd4b6] bg-white/85 p-4 backdrop-blur-sm dark:border-amber-900/40 dark:bg-[#1a120d]/85">
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#b16b19] dark:text-amber-300">
                        Offer Lineup
                      </p>
                      <div className="space-y-2">
                        {activeOffers.map((offer, index) => {
                          const isActive = index === currentOfferIndex;
                          return (
                            <button
                              key={offer.id}
                              type="button"
                              onClick={() => goToOfferIndex(index)}
                              className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all ${
                                isActive
                                  ? 'border-transparent bg-[#2f1f14] text-white shadow-[0_12px_28px_rgba(47,31,20,0.24)]'
                                  : 'border-[#ead5bc] bg-[#fff7eb] text-[#6f4c2d] hover:border-[#d6b48a] hover:bg-[#fff1dc] dark:border-amber-900/40 dark:bg-[#23160d] dark:text-[#ecd8c0] dark:hover:bg-[#2d1b10]'
                              }`}
                            >
                              <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${isActive ? 'bg-amber-300' : 'bg-amber-500/60'}`} />
                              <span className="line-clamp-2 text-sm font-semibold leading-snug">
                                {buildOfferDetailText(offer)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#fff4df] px-3 py-3 dark:bg-[#25160b]">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b16b19] dark:text-amber-300">
                          Browse Offers
                        </p>
                        <p className="mt-1 text-sm text-[#7a5539] dark:text-[#d8c0a6]">
                          Swipe on phone or use the controls.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={goToPreviousOffer}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#7a4b19] shadow-sm transition hover:bg-[#fff8ef] dark:bg-[#312014] dark:text-amber-200 dark:hover:bg-[#3a2516]"
                          aria-label="Previous offer"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={goToNextOffer}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#f3a318] text-[#2f1f14] shadow-[0_12px_20px_rgba(243,163,24,0.28)] transition hover:bg-[#e59b16]"
                          aria-label="Next offer"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeOffers.length > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  {activeOffers.map((offer, index) => (
                    <button
                      key={offer.id}
                      type="button"
                      onClick={() => goToOfferIndex(index)}
                      className={`rounded-full transition-all ${index === currentOfferIndex ? 'h-2.5 w-10 bg-[#d98911]' : 'h-2.5 w-2.5 bg-[#dfb06c]'}`}
                      aria-label={`Go to offer ${index + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              No active offers right now
            </div>
          )}
        </div>
      </div>

      {/* Offer details dialog */}
      {selectedOffer && (
        <AlertDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setSelectedOffer(null);
          }}
        >
          <AlertDialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle>Offer details</AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription>
              <div className="flex flex-col gap-3">
                <div
                  className="relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100"
                  onTouchStart={handleOfferCarouselTouchStart}
                  onTouchEnd={handleOfferCarouselTouchEnd}
                >
                  <img
                    src={offerShowcaseImages[offerImageIndex] || selectedOffer.image}
                    alt={selectedOffer.description}
                    className="h-56 w-full object-cover sm:h-72 md:h-96 lg:h-[460px]"
                  />

                  {offerShowcaseImages.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={goToPreviousOfferImage}
                        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 text-zinc-700 shadow hover:bg-white"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={goToNextOfferImage}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 text-zinc-700 shadow hover:bg-white"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/35 px-2 py-1">
                        {offerShowcaseImages.map((image, index) => (
                          <button
                            key={`${image}-${index}`}
                            type="button"
                            onClick={() => setOfferImageIndex(index)}
                            className={`h-1.5 w-1.5 rounded-full ${index === offerImageIndex ? 'bg-white' : 'bg-white/50'}`}
                            aria-label={`Show image ${index + 1}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  {buildOfferDetailText(selectedOffer)}
                </p>
                <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300 break-words whitespace-normal">
                  {selectedOffer.description}
                </p>
                <div className="space-y-1">
                  {selectedOffer.itemIds.map((id) => {
                    const menuItem = menuItems.find((i) => i.id === id);
                    if (!menuItem) return null;
                    const discounted = getItemPrice(id);
                    return (
                      <div key={id} className="flex items-center justify-between text-sm">
                        <span className="text-zinc-700 dark:text-zinc-300">{menuItem.name}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-zinc-400 line-through">{menuItem.price.toFixed(2)} TND</span>
                          <span className="font-semibold text-emerald-600">{discounted.toFixed(2)} TND</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleAddOffer(selectedOffer)}>
                Add to cart
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Menu Items */}
      <main className="container mx-auto px-4 py-8 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {displayItems.map((item) => (
            <MenuCard
              key={item.id}
              item={item}
              onAddToCart={handleAddToCart}
            />
          ))}
        </div>
      </main>

      {/* Cart Drawer */}
      <CartDrawer />
    </div>
  );
}