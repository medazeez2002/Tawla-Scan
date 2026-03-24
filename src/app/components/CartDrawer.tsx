import { ShoppingCart, Minus, Plus, Trash2, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { Button } from './ui/button';
import { useLocation, useNavigate } from 'react-router';
import { useState } from 'react';

export function CartDrawer() {
  const { cart, updateQuantity, removeFromCart, getTotalItems, getTotalPrice } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const totalItems = getTotalItems();
  const totalPrice = getTotalPrice();

  const handleCheckout = () => {
    setIsOpen(false);
    const params = new URLSearchParams(location.search);
    const tableParam = params.get('table');
    if (tableParam) {
      navigate(`/checkout?table=${encodeURIComponent(tableParam)}`);
      return;
    }
    navigate('/checkout');
  };

  return (
    <>
      {/* Cart Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-amber-600 hover:bg-amber-700 text-white rounded-full p-4 shadow-lg transition-all z-40"
      >
        <ShoppingCart className="h-6 w-6" />
        {totalItems > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center">
            {totalItems}
          </span>
        )}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md border-l border-[#ead6c2] bg-[#fffcf8] dark:border-zinc-700 dark:bg-zinc-900 z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#ead6c2] dark:border-zinc-700 p-6">
            <h2 className="text-xl text-[#5a3418] dark:text-zinc-100">Your Order</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[#9a7a5d] hover:text-[#5a3418] dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-6">
            {cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-[#9a7a5d] dark:text-zinc-400">
                <ShoppingCart className="h-16 w-16 mb-4 opacity-50" />
                <p>Your cart is empty</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-[#ead6c2] bg-white dark:border-zinc-700 dark:bg-zinc-800 p-4"
                  >
                    <div className="flex gap-4">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-20 h-20 object-cover rounded"
                      />
                      <div className="flex-1">
                        <h3 className="mb-1 text-[#5a3418] dark:text-zinc-100">{item.name}</h3>
                        <p className="mb-2 text-sm text-[#9a7a5d] dark:text-zinc-400">
                          {item.price.toFixed(2)} TND each
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="rounded border border-[#d9c0a4] bg-[#fffcf8] p-1 hover:bg-[#f8ecd9] dark:border-zinc-600 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                          >
                            <Minus className="h-4 w-4 text-[#5a3418] dark:text-zinc-100" />
                          </button>
                          <span className="w-8 text-center text-[#5a3418] dark:text-zinc-100">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="rounded border border-[#d9c0a4] bg-[#fffcf8] p-1 hover:bg-[#f8ecd9] dark:border-zinc-600 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                          >
                            <Plus className="h-4 w-4 text-[#5a3418] dark:text-zinc-100" />
                          </button>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="ml-auto text-red-500 hover:text-red-400 p-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="text-[#5a3418] dark:text-zinc-100">
                        {(item.price * item.quantity).toFixed(2)} TND
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {cart.length > 0 && (
            <div className="border-t border-[#ead6c2] bg-[#fffcf8] dark:border-zinc-700 dark:bg-zinc-900 p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg text-[#5a3418] dark:text-zinc-100">Total</span>
                <span className="text-2xl text-[#5a3418] dark:text-zinc-100">
                  {totalPrice.toFixed(2)} TND
                </span>
              </div>
              <Button
                onClick={handleCheckout}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                size="lg"
              >
                Proceed to Checkout
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
