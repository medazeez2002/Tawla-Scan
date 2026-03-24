import { useNavigate, useLocation } from 'react-router';
import { CheckCircle, Printer } from 'lucide-react';
import { Button } from '../components/ui/button';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';

interface ReceiptItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

interface ConfirmationState {
  orderNumber?: number;
  tableNumber?: number | null;
  items?: ReceiptItem[];
  subtotal?: number;
  total?: number;
  promoDiscount?: number;
  paymentMethod?: string;
  paymentProvider?: string;
  timestamp?: string;
}

export function OrderConfirmationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [businessName, setBusinessName] = useState('The Local Cafe');
  const [taxRate, setTaxRate] = useState(0);
  const [currencyCode, setCurrencyCode] = useState('TND');
  const state = (location.state ?? {}) as ConfirmationState;
  const orderNumber = state.orderNumber || Math.floor(Math.random() * 9000) + 1000;
  const tableNumber = state.tableNumber ?? null;
  const receiptItems = Array.isArray(state.items) ? state.items : [];
  const computedSubtotal = Number(
    receiptItems.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0).toFixed(2)
  );
  const subtotal = Number((state.subtotal ?? computedSubtotal).toFixed(2));
  const promoDiscount = Number((state.promoDiscount ?? 0).toFixed(2));
  const total = Number((state.total ?? Math.max(0, subtotal - promoDiscount)).toFixed(2));
  const paidAt = state.timestamp ? new Date(state.timestamp) : new Date();

  const paymentLabel =
    state.paymentMethod === 'cash'
      ? 'Cash'
      : state.paymentMethod && state.paymentProvider
        ? `${state.paymentMethod} (${state.paymentProvider})`
        : state.paymentMethod || 'N/A';

  const tvaAmount = useMemo(() => {
    if (taxRate <= 0 || total <= 0) return 0;
    return Number(((total * taxRate) / (100 + taxRate)).toFixed(2));
  }, [taxRate, total]);

  const handlePrintReceipt = () => {
    const receiptWindow = window.open('', '_blank', 'width=420,height=760');
    if (!receiptWindow) {
      window.print();
      return;
    }

    const lineItemsHtml =
      receiptItems.length > 0
        ? receiptItems
            .map(
              (item) => `
              <tr>
                <td>${item.quantity}x ${item.name}</td>
                <td style="text-align:right">${(Number(item.price) * Number(item.quantity)).toFixed(2)} TND</td>
              </tr>`
            )
            .join('')
        : '<tr><td colspan="2">No item details available</td></tr>';

    receiptWindow.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Receipt #${orderNumber}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 16px; color: #2f1f14; }
      h2 { margin: 0 0 4px; }
      .meta { font-size: 12px; color: #6b5a49; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      td { padding: 6px 0; border-bottom: 1px dashed #d4c0a8; font-size: 13px; }
      .totals { margin-top: 10px; font-size: 13px; }
      .totals div { display: flex; justify-content: space-between; margin: 4px 0; }
      .grand { font-weight: bold; font-size: 16px; }
    </style>
  </head>
  <body>
    <h2>${businessName} - Receipt</h2>
    <div class="meta">Order #${orderNumber}${tableNumber ? ` | Table ${tableNumber}` : ''}<br/>${paidAt.toLocaleString()}</div>
    <table>${lineItemsHtml}</table>
    <div class="totals">
      <div><span>Subtotal</span><span>${subtotal.toFixed(2)} ${currencyCode}</span></div>
      ${promoDiscount > 0 ? `<div><span>Discount</span><span>- ${promoDiscount.toFixed(2)} ${currencyCode}</span></div>` : ''}
      ${taxRate > 0 ? `<div><span>TVA (${taxRate.toFixed(2)}%)</span><span>${tvaAmount.toFixed(2)} ${currencyCode}</span></div>` : ''}
      <div><span>Payment</span><span>${paymentLabel}</span></div>
      <div class="grand"><span>Total</span><span>${total.toFixed(2)} ${currencyCode}</span></div>
    </div>
  </body>
</html>`);
    receiptWindow.document.close();
    receiptWindow.focus();
    receiptWindow.print();
    receiptWindow.close();
  };

  useEffect(() => {
    // Confetti or celebration effect could go here
    let cancelled = false;
    api.getPublicSettings().then((settings) => {
      if (cancelled) return;
      const nextName = String(settings.businessName ?? '').trim();
      if (nextName) setBusinessName(nextName);
      setTaxRate(Number(settings.taxRate ?? 0) || 0);
      const nextCurrency = String(settings.currencyCode ?? 'TND').trim().toUpperCase();
      if (nextCurrency) setCurrencyCode(nextCurrency);
    }).catch(() => {
      // Keep defaults when public settings fetch fails.
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#fffcf8] dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-end mb-4">
          <ThemeToggle />
        </div>
        <div className="bg-white rounded-lg p-8 border border-[#ead6c2] dark:bg-zinc-900 dark:border-zinc-800">
          <div className="bg-green-500/10 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          
          <h1 className="text-3xl text-[#5a3418] dark:text-zinc-100 mb-2">Order Confirmed!</h1>
          <p className="text-[#9a7a5d] dark:text-zinc-400 mb-6">Thank you for your order</p>
          
          <div className="bg-[#fffcf8] rounded-lg p-6 border border-[#ead6c2] dark:bg-zinc-950 dark:border-zinc-800 mb-6">
            <p className="text-sm text-[#9a7a5d] dark:text-zinc-400 mb-2">Order Number</p>
            <p className="text-3xl text-amber-600">#{orderNumber}</p>
            {tableNumber && (
              <p className="mt-1 text-sm text-[#7a5539] dark:text-zinc-300">Table #{tableNumber}</p>
            )}
          </div>

          <div className="mb-6 rounded-lg border border-[#ead6c2] bg-[#fffcf8] p-4 text-left dark:border-zinc-800 dark:bg-zinc-950">
            <p className="mb-2 text-sm font-semibold text-[#5a3418] dark:text-zinc-100">{businessName} Receipt</p>
            <div className="space-y-2 text-sm text-[#7a5539] dark:text-zinc-300">
              {receiptItems.length > 0 ? (
                receiptItems.map((item) => (
                  <div key={`${item.id}-${item.name}`} className="flex justify-between gap-3">
                    <span>{item.quantity}x {item.name}</span>
                    <span>{(item.price * item.quantity).toFixed(2)} TND</span>
                  </div>
                ))
              ) : (
                <p>No item details available</p>
              )}
            </div>
            <div className="mt-3 border-t border-[#ead6c2] pt-3 text-sm dark:border-zinc-800">
              <div className="flex justify-between text-[#7a5539] dark:text-zinc-300">
                <span>Subtotal</span>
                <span>{subtotal.toFixed(2)} {currencyCode}</span>
              </div>
              {promoDiscount > 0 && (
                <div className="mt-1 flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>Discount</span>
                  <span>-{promoDiscount.toFixed(2)} {currencyCode}</span>
                </div>
              )}
              {taxRate > 0 && (
                <div className="mt-1 flex justify-between text-[#7a5539] dark:text-zinc-300">
                  <span>TVA ({taxRate.toFixed(2)}%)</span>
                  <span>{tvaAmount.toFixed(2)} {currencyCode}</span>
                </div>
              )}
              <div className="mt-1 flex justify-between text-[#7a5539] dark:text-zinc-300">
                <span>Payment</span>
                <span className="capitalize">{paymentLabel}</span>
              </div>
              <div className="mt-2 flex justify-between text-base font-semibold text-[#2f1f14] dark:text-zinc-100">
                <span>Total</span>
                <span>{total.toFixed(2)} {currencyCode}</span>
              </div>
            </div>
          </div>

          <p className="text-[#7a5539] dark:text-zinc-300 mb-8">
            Your order will be ready in approximately 10-15 minutes. 
            We'll call your number when it's ready for collection.
          </p>

          <Button
            onClick={handlePrintReceipt}
            variant="outline"
            className="mb-3 w-full border-[#d9c0a4] text-[#7a5539] hover:bg-[#f8ecd9] dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
            size="lg"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print Receipt
          </Button>

          <Button
            onClick={() => navigate(tableNumber ? `/?table=${tableNumber}` : '/')}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            size="lg"
          >
            Return to Menu
          </Button>
        </div>
      </div>
    </div>
  );
}