import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, Banknote, Check, Smartphone, Wallet } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useOrders } from '../context/OrdersContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { calculatePromoDiscount, getActivePromoCodeByInput, type PromoCode } from '../../lib/promoCodes';
import d17Logo from '../../../D17.png';
import applePayLogo from '../../../Apple Pay.png';
import konnectLogo from '../../../konnect.png';

const KONNECT_PENDING_KEY = 'tawla-konnect-pending-checkout';

interface PendingKonnectCheckout {
  paymentRef: string;
  paymentId?: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  tableNumber: number | null;
  createdAt: number;
}

function readPendingKonnectCheckout(): PendingKonnectCheckout | null {
  try {
    const raw = sessionStorage.getItem(KONNECT_PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingKonnectCheckout;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.items)) return null;
    if (!Number.isFinite(Number(parsed.total))) return null;
    if (typeof parsed.paymentRef !== 'string' || !parsed.paymentRef.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { cart, getTotalPrice, clearCart } = useCart();
  const { addOrder } = useOrders();
  const [paymentMethod, setPaymentMethod] = useState<'visa' | 'd17' | 'apple-pay' | 'konnect' | 'cash'>('konnect');
  const [isProcessing, setIsProcessing] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromoCode, setAppliedPromoCode] = useState<PromoCode | null>(null);

  const rawTableParam = searchParams.get('table');
  const parsedTableNumber = rawTableParam ? Number(rawTableParam) : NaN;
  const tableNumber = Number.isInteger(parsedTableNumber) && parsedTableNumber > 0 ? parsedTableNumber : null;
  const konnectResult = searchParams.get('konnect');
  const checkoutPath = tableNumber ? `/checkout?table=${tableNumber}` : '/checkout';

  const totalPrice = getTotalPrice();
  const promoDiscount = useMemo(
    () => (appliedPromoCode ? calculatePromoDiscount(totalPrice, appliedPromoCode) : 0),
    [appliedPromoCode, totalPrice]
  );
  const payableTotal = useMemo(
    () => Number(Math.max(0, totalPrice - promoDiscount).toFixed(2)),
    [promoDiscount, totalPrice]
  );

  const appliedPromoLabel = useMemo(() => {
    if (!appliedPromoCode) return '';
    if (appliedPromoCode.type === 'percentage') {
      return `${appliedPromoCode.value}% off`;
    }
    return `${appliedPromoCode.value.toFixed(2)} TND off`;
  }, [appliedPromoCode]);

  useEffect(() => {
    if (konnectResult !== 'success' && konnectResult !== 'failed') {
      return;
    }

    if (konnectResult === 'failed') {
      sessionStorage.removeItem(KONNECT_PENDING_KEY);
      toast.error('Konnect payment was canceled or failed.');
      navigate(checkoutPath, { replace: true });
      return;
    }

    let isCancelled = false;

    const finalizeKonnectPayment = async () => {
      setIsProcessing(true);
      try {
        const pending = readPendingKonnectCheckout();
        if (!pending) {
          throw new Error('No pending Konnect payment was found. Please try again.');
        }

        const paymentRef = pending.paymentRef || pending.paymentId;
        if (!paymentRef) {
          throw new Error('Missing Konnect payment reference.');
        }

        const paymentStatus = await api.getKonnectPayment(paymentRef);
        if (!paymentStatus.isPaid) {
          throw new Error('Konnect payment is not confirmed yet.');
        }

        const orderNumber = await addOrder(
          pending.items,
          Number(pending.total),
          pending.tableNumber,
          {
            method: 'konnect',
            provider: 'konnect',
            reference: paymentRef,
            status: paymentStatus.status || 'paid',
          }
        );

        try {
          const audio = new Audio('/notification-order-confirmed.mp3');
          audio.volume = 0.8;
          void audio.play();
        } catch {
          // Ignore autoplay block.
        }

        sessionStorage.removeItem(KONNECT_PENDING_KEY);
        clearCart();

        if (!isCancelled) {
          navigate('/confirmation', {
            state: {
              orderNumber,
              tableNumber: pending.tableNumber,
              items: pending.items,
              subtotal: Number(pending.total),
              total: Number(pending.total),
              promoDiscount: 0,
              paymentMethod: 'konnect',
              paymentProvider: 'konnect',
              timestamp: new Date().toISOString(),
            },
            replace: true,
          });
        }
      } catch (error) {
        const message = error instanceof Error && error.message.trim()
          ? error.message
          : 'Unable to confirm Konnect payment.';
        toast.error(message);
        if (!isCancelled) {
          navigate(checkoutPath, { replace: true });
        }
      } finally {
        if (!isCancelled) {
          setIsProcessing(false);
        }
      }
    };

    void finalizeKonnectPayment();

    return () => {
      isCancelled = true;
    };
  }, [addOrder, checkoutPath, clearCart, konnectResult, navigate]);

  const handleOfflinePayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsProcessing(true);

    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Persist order to MySQL via backend API.
      const orderNumber = await addOrder(cart, payableTotal, tableNumber, {
        method: paymentMethod,
        provider: 'local-simulated',
        status: 'completed',
      });
      try {
        const audio = new Audio('/notification-order-confirmed.mp3');
        audio.volume = 0.8;
        void audio.play();
      } catch { /* ignore autoplay block */ }
      clearCart();
      navigate('/confirmation', {
        state: {
          orderNumber,
          tableNumber,
          items: cart.map((item) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
          })),
          subtotal: Number(totalPrice.toFixed(2)),
          total: Number(payableTotal.toFixed(2)),
          promoDiscount: Number(promoDiscount.toFixed(2)),
          paymentMethod,
          paymentProvider: paymentMethod === 'cash' ? 'cash' : 'local-simulated',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error(error);
      const message = error instanceof Error && error.message.trim()
        ? error.message
        : 'Unable to place order. Please try again.';
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKonnectPayment = async () => {
    setIsProcessing(true);

    try {
      const description = tableNumber
        ? `Table #${tableNumber} order`
        : 'Tawla Scan order';

      const initialized = await api.initiateKonnectPayment({
        amount: payableTotal,
        description,
        tableNumber,
      });

      const pendingCheckout: PendingKonnectCheckout = {
        paymentRef: initialized.paymentRef,
        paymentId: initialized.paymentId,
        items: cart.map((item) => ({ ...item })),
        total: payableTotal,
        tableNumber,
        createdAt: Date.now(),
      };

      sessionStorage.setItem(KONNECT_PENDING_KEY, JSON.stringify(pendingCheckout));
      window.location.assign(initialized.payUrl);
    } catch (error) {
      const message = error instanceof Error && error.message.trim()
        ? error.message
        : 'Unable to initiate Konnect payment.';
      toast.error(message);
      setIsProcessing(false);
    }
  };

  const handleApplyPromoCode = (event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }

    const matchedPromo = getActivePromoCodeByInput(promoCodeInput);
    if (!matchedPromo) {
      toast.error('Invalid or inactive promo code.');
      return;
    }

    const computedDiscount = calculatePromoDiscount(totalPrice, matchedPromo);
    if (computedDiscount <= 0) {
      toast.error('This promo code does not apply to your current total.');
      return;
    }

    setAppliedPromoCode(matchedPromo);
    setPromoCodeInput(matchedPromo.code);
    toast.success(`Promo code ${matchedPromo.code} applied.`);
  };

  const handleClearPromoCode = () => {
    setAppliedPromoCode(null);
    setPromoCodeInput('');
  };

  if (cart.length === 0 && konnectResult !== 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fffcf8] dark:bg-zinc-950">
        <div className="text-center">
          <p className="mb-4 text-[#9a7a5d] dark:text-zinc-400">Your cart is empty</p>
          <Button
            onClick={() => navigate(tableNumber ? `/?table=${tableNumber}` : '/')}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            Back to Menu
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fffcf8] dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-[#ead6c2] bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(tableNumber ? `/?table=${tableNumber}` : '/')}
              className="flex items-center gap-2 text-[#9a7a5d] hover:text-[#5a3418] dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <ArrowLeft className="h-5 w-5" />
              Back to Menu
            </button>
            <ThemeToggle />
          </div>
          <h1 className="mt-4 text-2xl text-[#5a3418] dark:text-zinc-100">Checkout</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Order Summary */}
        <div className="mb-6 rounded-xl border border-[#ead6c2] bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-xl text-[#5a3418] dark:text-zinc-100">Order Summary</h2>
          <div className="space-y-3">
            {tableNumber && (
              <div className="flex justify-between text-[#7a5539] dark:text-zinc-300">
                <span>Table</span>
                <span>#{tableNumber}</span>
              </div>
            )}
            {cart.map((item) => (
              <div key={item.id} className="flex justify-between text-[#7a5539] dark:text-zinc-300">
                <span>
                  {item.quantity}x {item.name}
                </span>
                <span>{(item.price * item.quantity).toFixed(2)} TND</span>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2 border-t border-[#ead6c2] pt-4 dark:border-zinc-700">
            <div className="flex justify-between text-[#7a5539] dark:text-zinc-300">
              <span>Subtotal</span>
              <span>{totalPrice.toFixed(2)} TND</span>
            </div>
            {promoDiscount > 0 && (
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                <span>Promo ({appliedPromoCode?.code})</span>
                <span>-{promoDiscount.toFixed(2)} TND</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-lg text-[#5a3418] dark:text-zinc-100">Total</span>
              <span className="text-2xl text-[#5a3418] dark:text-zinc-100">{payableTotal.toFixed(2)} TND</span>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-[#ead6c2] bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-xl text-[#5a3418] dark:text-zinc-100">Promo Code</h2>
          <form onSubmit={handleApplyPromoCode} className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={promoCodeInput}
              onChange={(event) => setPromoCodeInput(event.target.value.toUpperCase())}
              placeholder="Enter promo code"
              className="!border-[#d9c0a4] !bg-[#fffcf8] !text-[#5a3418] placeholder:!text-[#9a7a5d] dark:!border-zinc-600 dark:!bg-zinc-800 dark:!text-zinc-100 dark:placeholder:!text-zinc-500"
            />
            <Button type="submit" className="bg-amber-600 text-white hover:bg-amber-700">
              Apply
            </Button>
            {appliedPromoCode && (
              <Button
                type="button"
                variant="outline"
                onClick={handleClearPromoCode}
                className="border-[#d9c0a4] text-[#7a5539] hover:bg-[#f8ecd9] dark:border-zinc-700 dark:text-zinc-200"
              >
                Remove
              </Button>
            )}
          </form>
          {appliedPromoCode && (
            <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
              Applied: <span className="font-semibold">{appliedPromoCode.code}</span> ({appliedPromoLabel})
            </p>
          )}
        </div>

        {/* Payment Method Selection */}
        <div className="mb-6 rounded-xl border border-[#ead6c2] bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-xl text-[#5a3418] dark:text-zinc-100">Payment Method</h2>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            <button
              type="button"
              onClick={() => setPaymentMethod('visa')}
              className={`relative rounded-lg border-2 p-3 transition-colors ${
                paymentMethod === 'visa'
                  ? 'border-amber-600 bg-amber-600/10'
                  : 'border-[#d9c0a4] bg-[#fffcf8] hover:bg-[#f8ecd9] dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700'
              }`}
            >
              <span className={`absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded border ${
                paymentMethod === 'visa'
                  ? 'border-amber-600 bg-amber-600 text-white'
                  : 'border-zinc-300 bg-white text-transparent dark:border-zinc-600 dark:bg-zinc-900'
              }`}>
                <Check className="h-3.5 w-3.5" />
              </span>
              <div className="mb-2 mx-auto flex h-12 w-12 items-center justify-center rounded bg-white dark:bg-zinc-900">
                <span className="text-lg font-black tracking-wider">
                  <span className="text-[#1a1f71]">VI</span>
                  <span className="text-[#f7b600]">SA</span>
                </span>
              </div>
              <p className="text-center text-sm text-[#5a3418] dark:text-zinc-100">Visa Card</p>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod('d17')}
              className={`relative rounded-lg border-2 p-3 transition-colors ${
                paymentMethod === 'd17'
                  ? 'border-amber-600 bg-amber-600/10'
                  : 'border-[#d9c0a4] bg-[#fffcf8] hover:bg-[#f8ecd9] dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700'
              }`}
            >
              <span className={`absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded border ${
                paymentMethod === 'd17'
                  ? 'border-amber-600 bg-amber-600 text-white'
                  : 'border-zinc-300 bg-white text-transparent dark:border-zinc-600 dark:bg-zinc-900'
              }`}>
                <Check className="h-3.5 w-3.5" />
              </span>
              <div className="mb-2 mx-auto flex h-12 w-12 items-center justify-center rounded bg-white dark:bg-zinc-900">
                <img src={d17Logo} alt="D17" className="h-full w-full object-cover rounded" />
              </div>
              <p className="text-center text-sm text-[#5a3418] dark:text-zinc-100">D17</p>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod('apple-pay')}
              className={`relative rounded-lg border-2 p-3 transition-colors ${
                paymentMethod === 'apple-pay'
                  ? 'border-amber-600 bg-amber-600/10'
                  : 'border-[#d9c0a4] bg-[#fffcf8] hover:bg-[#f8ecd9] dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700'
              }`}
            >
              <span className={`absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded border ${
                paymentMethod === 'apple-pay'
                  ? 'border-amber-600 bg-amber-600 text-white'
                  : 'border-zinc-300 bg-white text-transparent dark:border-zinc-600 dark:bg-zinc-900'
              }`}>
                <Check className="h-3.5 w-3.5" />
              </span>
              <div className="mb-2 mx-auto flex h-12 w-12 items-center justify-center rounded overflow-hidden bg-black">
                <img src={applePayLogo} alt="Apple Pay" className="h-full w-full object-cover" />
              </div>
              <p className="text-center text-sm text-[#5a3418] dark:text-zinc-100">Apple Pay</p>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod('konnect')}
              className={`relative rounded-lg border-2 p-3 transition-colors ${
                paymentMethod === 'konnect'
                  ? 'border-amber-600 bg-amber-600/10'
                  : 'border-[#d9c0a4] bg-[#fffcf8] hover:bg-[#f8ecd9] dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700'
              }`}
            >
              <span className={`absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded border ${
                paymentMethod === 'konnect'
                  ? 'border-amber-600 bg-amber-600 text-white'
                  : 'border-zinc-300 bg-white text-transparent dark:border-zinc-600 dark:bg-zinc-900'
              }`}>
                <Check className="h-3.5 w-3.5" />
              </span>
              <div className="mb-2 mx-auto flex h-12 w-12 items-center justify-center rounded overflow-hidden bg-white dark:bg-zinc-900">
                <img src={konnectLogo} alt="Konnect" className="h-full w-full object-cover" />
              </div>
              <p className="text-center text-sm text-[#5a3418] dark:text-zinc-100">Konnect</p>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod('cash')}
              className={`relative rounded-lg border-2 p-3 transition-colors ${
                paymentMethod === 'cash'
                  ? 'border-amber-600 bg-amber-600/10'
                  : 'border-[#d9c0a4] bg-[#fffcf8] hover:bg-[#f8ecd9] dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700'
              }`}
            >
              <span className={`absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded border ${
                paymentMethod === 'cash'
                  ? 'border-amber-600 bg-amber-600 text-white'
                  : 'border-zinc-300 bg-white text-transparent dark:border-zinc-600 dark:bg-zinc-900'
              }`}>
                <Check className="h-3.5 w-3.5" />
              </span>
              <div className="mb-2 mx-auto flex h-12 w-12 items-center justify-center rounded bg-white dark:bg-zinc-900">
                <Banknote className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-center text-sm text-[#5a3418] dark:text-zinc-100">Cash</p>
            </button>
          </div>

          {/* Visa Payment Form */}
          {paymentMethod === 'visa' && (
            <form onSubmit={handleOfflinePayment} className="space-y-4">
              <div>
                <Label htmlFor="cardNumber" className="text-[#7a5539] dark:text-zinc-300">Card Number</Label>
                <Input
                  id="cardNumber"
                  type="text"
                  placeholder="1234 5678 9012 3456"
                  className="!border-[#d9c0a4] !bg-[#fffcf8] !text-[#5a3418] placeholder:!text-[#9a7a5d] dark:!border-zinc-600 dark:!bg-zinc-800 dark:!text-zinc-100 dark:placeholder:!text-zinc-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="expiry" className="text-[#7a5539] dark:text-zinc-300">Expiry Date</Label>
                  <Input
                    id="expiry"
                    type="text"
                    placeholder="MM/YY"
                    className="!border-[#d9c0a4] !bg-[#fffcf8] !text-[#5a3418] placeholder:!text-[#9a7a5d] dark:!border-zinc-600 dark:!bg-zinc-800 dark:!text-zinc-100 dark:placeholder:!text-zinc-500"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="cvv" className="text-[#7a5539] dark:text-zinc-300">CVV</Label>
                  <Input
                    id="cvv"
                    type="text"
                    placeholder="123"
                    className="!border-[#d9c0a4] !bg-[#fffcf8] !text-[#5a3418] placeholder:!text-[#9a7a5d] dark:!border-zinc-600 dark:!bg-zinc-800 dark:!text-zinc-100 dark:placeholder:!text-zinc-500"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="name" className="text-[#7a5539] dark:text-zinc-300">Name on Card</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Smith"
                  className="!border-[#d9c0a4] !bg-[#fffcf8] !text-[#5a3418] placeholder:!text-[#9a7a5d] dark:!border-zinc-600 dark:!bg-zinc-800 dark:!text-zinc-100 dark:placeholder:!text-zinc-500"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                size="lg"
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : `Pay ${payableTotal.toFixed(2)} TND`}
              </Button>
            </form>
          )}

          {/* D17 Payment */}
          {paymentMethod === 'd17' && (
            <div className="text-center py-8">
              <Smartphone className="h-24 w-24 mx-auto mb-4 text-amber-600" />
              <p className="mb-6 text-[#7a5539] dark:text-zinc-400">
                Open your D17 app and confirm the payment on your phone.
              </p>
              <Button
                onClick={handleOfflinePayment}
                className="bg-amber-600 hover:bg-amber-700 text-white"
                size="lg"
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : 'Simulate D17 Payment'}
              </Button>
            </div>
          )}

          {paymentMethod === 'apple-pay' && (
            <div className="py-6 text-center">
              <Smartphone className="mx-auto mb-4 h-20 w-20 text-zinc-900 dark:text-zinc-100" />
              <p className="mx-auto mb-6 max-w-md text-[#7a5539] dark:text-zinc-300">
                Confirm payment with Apple Pay on your device.
              </p>
              <Button
                onClick={handleOfflinePayment}
                className="bg-black text-white hover:bg-zinc-800"
                size="lg"
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : `Pay ${payableTotal.toFixed(2)} TND with Apple Pay`}
              </Button>
            </div>
          )}

          {paymentMethod === 'cash' && (
            <div className="py-6 text-center">
              <Banknote className="mx-auto mb-4 h-20 w-20 text-emerald-600" />
              <p className="mx-auto mb-6 max-w-md text-[#7a5539] dark:text-zinc-300">
                Pay in cash at the counter. Your order will be submitted immediately.
              </p>
              <Button
                onClick={handleOfflinePayment}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                size="lg"
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : `Confirm Cash Payment (${payableTotal.toFixed(2)} TND)`}
              </Button>
            </div>
          )}

          {paymentMethod === 'konnect' && (
            <div className="py-6 text-center">
              <Wallet className="mx-auto mb-4 h-20 w-20 text-amber-600" />
              <p className="mx-auto mb-2 max-w-md text-[#7a5539] dark:text-zinc-300">
                You will be redirected to Konnect secure checkout to complete your payment.
              </p>
              <p className="mx-auto mb-6 max-w-md text-sm text-[#9a7a5d] dark:text-zinc-400">
                After successful payment, you will return automatically and your order will be placed.
              </p>
              <Button
                onClick={handleKonnectPayment}
                className="bg-amber-600 hover:bg-amber-700 text-white"
                size="lg"
                disabled={isProcessing}
              >
                {isProcessing ? 'Redirecting...' : `Pay ${payableTotal.toFixed(2)} TND with Konnect`}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}