import { useEffect, useMemo, useRef, useState } from 'react';
import { useOrders, Order } from '../../context/OrdersContext';
import {
  Clock,
  CheckCircle,
  ChefHat,
  Package,
  UtensilsCrossed,
  Download,
  FileSpreadsheet,
  Printer,
  Pencil,
  X,
  CreditCard,
  Banknote,
} from 'lucide-react';
import { Button } from '../ui/button';
import { formatDistanceToNow } from 'date-fns';
import { enUS, fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { api } from '../../../lib/api';

type UiLanguage = 'en' | 'fr';

interface OrdersViewProps {
  language: UiLanguage;
}

interface ExportRow {
  orderNumber: number;
  orderId: string;
  table: string;
  status: string;
  timestamp: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  orderTotal: number;
}

interface EditableOrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
}

interface MenuOption {
  id: string;
  name: string;
  price: number;
}

function parseDateInput(value: string, endOfDay: boolean): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function escapeCsvValue(value: string | number): string {
  const text = String(value ?? '');
  if (text.includes('"') || text.includes(',') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildExportFilename(prefix: string, startDate: string, endDate: string, ext: 'csv' | 'xls') {
  const from = startDate || 'all';
  const to = endDate || 'all';
  return `${prefix}-${from}-to-${to}.${ext}`;
}

function downloadBlob(content: BlobPart, mimeType: string, filename: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function OrdersView({ language }: OrdersViewProps) {
  const tx = (en: string, frText: string) => (language === 'fr' ? frText : en);
  const { orders, updateOrderStatus, updateOrderWithAdmin } = useOrders();
  const [businessName, setBusinessName] = useState('The Local Cafe');
  const [taxRate, setTaxRate] = useState(0);
  const [currencyCode, setCurrencyCode] = useState('TND');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editStatus, setEditStatus] = useState<Order['status']>('pending');
  const [editTableNumber, setEditTableNumber] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [editItems, setEditItems] = useState<EditableOrderItem[]>([]);
  const [menuOptions, setMenuOptions] = useState<MenuOption[]>([]);
  const [selectedMenuItemIdToAdd, setSelectedMenuItemIdToAdd] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [recentlyChangedOrderIds, setRecentlyChangedOrderIds] = useState<Set<string>>(() => new Set());
  const previousOrderStatusesRef = useRef<Map<string, Order['status']>>(new Map());
  const statusAnimationTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const changedIds: string[] = [];
    const knownOrderIds = new Set<string>();

    for (const order of orders) {
      knownOrderIds.add(order.id);
      const previousStatus = previousOrderStatusesRef.current.get(order.id);
      if (previousStatus && previousStatus !== order.status) {
        changedIds.push(order.id);
      }
      previousOrderStatusesRef.current.set(order.id, order.status);
    }

    for (const trackedOrderId of [...previousOrderStatusesRef.current.keys()]) {
      if (!knownOrderIds.has(trackedOrderId)) {
        previousOrderStatusesRef.current.delete(trackedOrderId);
      }
    }

    if (changedIds.length === 0) {
      return;
    }

    setRecentlyChangedOrderIds((previous) => {
      const next = new Set(previous);
      for (const id of changedIds) {
        next.add(id);
      }
      return next;
    });

    for (const id of changedIds) {
      const existingTimer = statusAnimationTimersRef.current.get(id);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        setRecentlyChangedOrderIds((previous) => {
          if (!previous.has(id)) {
            return previous;
          }
          const next = new Set(previous);
          next.delete(id);
          return next;
        });
        statusAnimationTimersRef.current.delete(id);
      }, 1100);

      statusAnimationTimersRef.current.set(id, timer);
    }
  }, [orders]);

  useEffect(() => {
    return () => {
      for (const timer of statusAnimationTimersRef.current.values()) {
        clearTimeout(timer);
      }
      statusAnimationTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
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

  useEffect(() => {
    let cancelled = false;

    api.getMenuItems()
      .then((items) => {
        if (cancelled) return;
        setMenuOptions(
          items.map((item) => ({
            id: String(item.id),
            name: String(item.name),
            price: Number(item.price) || 0,
          }))
        );
      })
      .catch(() => {
        // Keep edit modal functional even if menu items fail to load.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const statusLabel = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return tx('pending', 'en attente');
      case 'preparing':
        return tx('preparing', 'en preparation');
      case 'ready':
        return tx('ready', 'pret');
      case 'completed':
        return tx('completed', 'termine');
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return {
          bar: 'bg-amber-400',
          badge: 'bg-amber-100 text-amber-800 border-amber-200',
          btn: 'bg-amber-500 hover:bg-amber-600',
        };
      case 'preparing':
        return {
          bar: 'bg-blue-400',
          badge: 'bg-blue-100 text-blue-800 border-blue-200',
          btn: 'bg-blue-500 hover:bg-blue-600',
        };
      case 'ready':
        return {
          bar: 'bg-green-400',
          badge: 'bg-green-100 text-green-800 border-green-200',
          btn: 'bg-green-600 hover:bg-green-700',
        };
      case 'completed':
        return {
          bar: 'bg-zinc-300',
          badge: 'bg-zinc-100 text-zinc-600 border-zinc-200',
          btn: '',
        };
    }
  };

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-3.5 w-3.5" />;
      case 'preparing':
        return <ChefHat className="h-3.5 w-3.5" />;
      case 'ready':
        return <Package className="h-3.5 w-3.5" />;
      case 'completed':
        return <CheckCircle className="h-3.5 w-3.5" />;
    }
  };

  const handleStatusChange = async (orderId: string, currentStatus: Order['status']) => {
    const statusFlow: Order['status'][] = ['pending', 'preparing', 'ready', 'completed'];
    const currentIndex = statusFlow.indexOf(currentStatus);
    if (currentIndex < statusFlow.length - 1) {
      await updateOrderStatus(orderId, statusFlow[currentIndex + 1]);
    }
  };

  const startFilter = useMemo(() => parseDateInput(startDate, false), [startDate]);
  const endFilter = useMemo(() => parseDateInput(endDate, true), [endDate]);

  const activeOrders = orders.filter((o) => o.status !== 'completed');
  const completedOrders = orders.filter((o) => o.status === 'completed');

  const filteredCompletedOrders = useMemo(() => {
    return completedOrders.filter((order) => {
      const timestamp = order.timestamp instanceof Date ? order.timestamp : new Date(order.timestamp);
      if (startFilter && timestamp < startFilter) return false;
      if (endFilter && timestamp > endFilter) return false;
      return true;
    });
  }, [completedOrders, startFilter, endFilter]);

  const relativeTimeLocale = language === 'fr' ? fr : enUS;

  const exportRows = useMemo<ExportRow[]>(() => {
    const rows: ExportRow[] = [];
    for (const order of filteredCompletedOrders) {
      const timestamp = order.timestamp instanceof Date ? order.timestamp : new Date(order.timestamp);
      const localizedTimestamp = timestamp.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US');
      const tableLabel = order.tableNumber
        ? `${tx('Table', 'Table')} ${order.tableNumber}`
        : tx('No Table', 'Sans Table');

      if (order.items.length === 0) {
        rows.push({
          orderNumber: order.orderNumber,
          orderId: order.id,
          table: tableLabel,
          status: statusLabel(order.status),
          timestamp: localizedTimestamp,
          itemName: '',
          quantity: 0,
          unitPrice: 0,
          lineTotal: 0,
          orderTotal: Number(order.total.toFixed(2)),
        });
        continue;
      }

      for (const item of order.items) {
        const lineTotal = Number((item.price * item.quantity).toFixed(2));
        rows.push({
          orderNumber: order.orderNumber,
          orderId: order.id,
          table: tableLabel,
          status: statusLabel(order.status),
          timestamp: localizedTimestamp,
          itemName: item.name,
          quantity: item.quantity,
          unitPrice: Number(item.price.toFixed(2)),
          lineTotal,
          orderTotal: Number(order.total.toFixed(2)),
        });
      }
    }
    return rows;
  }, [filteredCompletedOrders, language]);

  const exportAsCsv = () => {
    if (exportRows.length === 0) {
      toast.error(tx('No completed orders found in selected dates.', 'Aucune commande terminee trouvee pour les dates selectionnees.'));
      return;
    }

    const headers = [
      tx('Order Number', 'Numero Commande'),
      'Order ID',
      tx('Table', 'Table'),
      tx('Status', 'Statut'),
      tx('Timestamp', 'Horodatage'),
      tx('Item', 'Article'),
      tx('Qty', 'Qte'),
      tx('Unit Price', 'Prix Unitaire'),
      tx('Line Total', 'Total Ligne'),
      tx('Order Total', 'Total Commande'),
    ];

    const lines = [headers.map(escapeCsvValue).join(',')];
    for (const row of exportRows) {
      lines.push(
        [
          row.orderNumber,
          row.orderId,
          row.table,
          row.status,
          row.timestamp,
          row.itemName,
          row.quantity,
          row.unitPrice.toFixed(2),
          row.lineTotal.toFixed(2),
          row.orderTotal.toFixed(2),
        ]
          .map(escapeCsvValue)
          .join(',')
      );
    }

    const filename = buildExportFilename('completed-orders', startDate, endDate, 'csv');
    downloadBlob(lines.join('\n'), 'text/csv;charset=utf-8;', filename);
    toast.success(tx('CSV exported.', 'CSV exporte.'));
  };

  const exportAsExcel = () => {
    if (exportRows.length === 0) {
      toast.error(tx('No completed orders found in selected dates.', 'Aucune commande terminee trouvee pour les dates selectionnees.'));
      return;
    }

    const tableRows = exportRows
      .map(
        (row) =>
          `<tr>
            <td>${escapeHtml(row.orderNumber)}</td>
            <td>${escapeHtml(row.orderId)}</td>
            <td>${escapeHtml(row.table)}</td>
            <td>${escapeHtml(row.status)}</td>
            <td>${escapeHtml(row.timestamp)}</td>
            <td>${escapeHtml(row.itemName)}</td>
            <td>${escapeHtml(row.quantity)}</td>
            <td>${escapeHtml(row.unitPrice.toFixed(2))}</td>
            <td>${escapeHtml(row.lineTotal.toFixed(2))}</td>
            <td>${escapeHtml(row.orderTotal.toFixed(2))}</td>
          </tr>`
      )
      .join('');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
  th, td { border: 1px solid #d4c0a8; padding: 8px; text-align: left; font-size: 12px; }
  th { background: #f8bf60; color: #2f1f14; }
</style>
</head>
<body>
<table>
  <thead>
    <tr>
      <th>${escapeHtml(tx('Order Number', 'Numero Commande'))}</th>
      <th>Order ID</th>
      <th>${escapeHtml(tx('Table', 'Table'))}</th>
      <th>${escapeHtml(tx('Status', 'Statut'))}</th>
      <th>${escapeHtml(tx('Timestamp', 'Horodatage'))}</th>
      <th>${escapeHtml(tx('Item', 'Article'))}</th>
      <th>${escapeHtml(tx('Qty', 'Qte'))}</th>
      <th>${escapeHtml(tx('Unit Price', 'Prix Unitaire'))}</th>
      <th>${escapeHtml(tx('Line Total', 'Total Ligne'))}</th>
      <th>${escapeHtml(tx('Order Total', 'Total Commande'))}</th>
    </tr>
  </thead>
  <tbody>${tableRows}</tbody>
</table>
</body>
</html>`;

    const filename = buildExportFilename('completed-orders', startDate, endDate, 'xls');
    downloadBlob(html, 'application/vnd.ms-excel;charset=utf-8;', filename);
    toast.success(tx('Excel file exported.', 'Fichier Excel exporte.'));
  };

  const printReceipts = () => {
    if (filteredCompletedOrders.length === 0) {
      toast.error(tx('No completed orders found in selected dates.', 'Aucune commande terminee trouvee pour les dates selectionnees.'));
      return;
    }

    const receiptsHtml = filteredCompletedOrders
      .map((order) => {
        const timestamp = order.timestamp instanceof Date ? order.timestamp : new Date(order.timestamp);
        const localizedTimestamp = timestamp.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US');
        const tableLabel = order.tableNumber
          ? `${tx('Table', 'Table')} ${order.tableNumber}`
          : tx('No Table', 'Sans Table');
        const paymentLabel =
          order.paymentMethod === 'cash'
            ? tx('Cash', 'Especes')
            : order.paymentProvider ?? order.paymentMethod ?? 'N/A';
        const tvaAmount = taxRate > 0 && order.total > 0
          ? Number(((order.total * taxRate) / (100 + taxRate)).toFixed(2))
          : 0;

        const lineItems = order.items.length
          ? order.items
              .map(
                (item) => `
                  <tr>
                    <td>${escapeHtml(`${item.quantity}x ${item.name}`)}</td>
                    <td style="text-align:right">${escapeHtml((item.price * item.quantity).toFixed(2))} TND</td>
                  </tr>`
              )
              .join('')
          : `<tr><td colspan="2">${escapeHtml(tx('No items listed', 'Aucun article liste'))}</td></tr>`;

        return `
          <section class="receipt-card">
            <h2>${escapeHtml(businessName)}</h2>
            <p class="meta">#${escapeHtml(order.orderNumber)} · ${escapeHtml(tableLabel)}<br/>${escapeHtml(localizedTimestamp)}</p>
            <table>${lineItems}</table>
            <div class="totals">
              ${taxRate > 0 ? `<div><span>${escapeHtml(tx('TVA', 'TVA'))} (${escapeHtml(taxRate.toFixed(2))}%)</span><span>${escapeHtml(tvaAmount.toFixed(2))} ${escapeHtml(currencyCode)}</span></div>` : ''}
              <div><span>${escapeHtml(tx('Payment', 'Paiement'))}</span><span>${escapeHtml(paymentLabel)}</span></div>
              <div class="total"><span>${escapeHtml(tx('Total', 'Total'))}</span><span>${escapeHtml(order.total.toFixed(2))} ${escapeHtml(currencyCode)}</span></div>
            </div>
          </section>
        `;
      })
      .join('');

    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (!printWindow) {
      toast.error(tx('Unable to open print window.', 'Impossible d\'ouvrir la fenetre d\'impression.'));
      return;
    }

    printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(tx('Receipts', 'Recus'))}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 16px; color: #2f1f14; }
    .receipt-card { border: 1px solid #d9c0a4; border-radius: 10px; padding: 14px; margin-bottom: 14px; break-inside: avoid; }
    .receipt-card h2 { margin: 0; font-size: 16px; }
    .meta { margin: 4px 0 10px; font-size: 12px; color: #6b5a49; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 5px 0; border-bottom: 1px dashed #e8d6c4; font-size: 13px; }
    .totals { margin-top: 10px; font-size: 13px; }
    .totals > div { display: flex; justify-content: space-between; margin-top: 4px; }
    .total { font-weight: bold; font-size: 15px; }
    @media print {
      body { margin: 8mm; }
      .receipt-card { page-break-inside: avoid; }
    }
  </style>
</head>
<body>${receiptsHtml}</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
    toast.success(tx('Receipts sent to printer.', 'Recus envoyes a l\'impression.'));
  };

  const openEditModal = (order: Order) => {
    setEditingOrder(order);
    setEditStatus(order.status);
    setEditTableNumber(order.tableNumber ? String(order.tableNumber) : '');
    setAdminCode('');
    setEditItems(
      order.items.map((item) => ({
        menuItemId: String(item.menuItemId ?? item.id ?? '').trim(),
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      }))
    );
    setSelectedMenuItemIdToAdd('');
  };

  const updateEditItemQuantity = (menuItemId: string, nextQuantityValue: string) => {
    const nextQuantity = Number(nextQuantityValue);
    setEditItems((previous) =>
      previous.map((item) =>
        item.menuItemId === menuItemId
          ? {
              ...item,
              quantity: Number.isFinite(nextQuantity) ? nextQuantity : 0,
            }
          : item
      )
    );
  };

  const removeEditItem = (menuItemId: string) => {
    setEditItems((previous) => previous.filter((item) => item.menuItemId !== menuItemId));
  };

  const addSelectedMenuItem = () => {
    const selectedItem = menuOptions.find((item) => item.id === selectedMenuItemIdToAdd);
    if (!selectedItem) {
      return;
    }

    setEditItems((previous) => {
      const existingItem = previous.find((item) => item.menuItemId === selectedItem.id);
      if (existingItem) {
        return previous.map((item) =>
          item.menuItemId === selectedItem.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...previous,
        {
          menuItemId: selectedItem.id,
          name: selectedItem.name,
          quantity: 1,
          price: selectedItem.price,
        },
      ];
    });
    setSelectedMenuItemIdToAdd('');
  };

  const handleSaveEdit = async () => {
    if (!editingOrder) return;

    const trimmedCode = adminCode.trim();
    if (!trimmedCode) {
      toast.error(tx('Admin code is required.', 'Le code admin est obligatoire.'));
      return;
    }

    const rawTable = editTableNumber.trim();
    const normalizedTableNumber = rawTable === '' ? null : Number(rawTable);

    if (
      rawTable !== '' &&
      (typeof normalizedTableNumber !== 'number' ||
        !Number.isFinite(normalizedTableNumber) ||
        !Number.isInteger(normalizedTableNumber) ||
        normalizedTableNumber < 1)
    ) {
      toast.error(tx('Table number must be a positive integer.', 'Le numero de table doit etre un entier positif.'));
      return;
    }

    if (editItems.length === 0) {
      toast.error(tx('Order must contain at least one item.', 'La commande doit contenir au moins un article.'));
      return;
    }

    const hasInvalidQuantity = editItems.some(
      (item) => !Number.isInteger(item.quantity) || item.quantity < 1
    );
    if (hasInvalidQuantity) {
      toast.error(tx('Each quantity must be a positive integer.', 'Chaque quantite doit etre un entier positif.'));
      return;
    }

    setIsSavingEdit(true);
    try {
      await updateOrderWithAdmin(
        editingOrder.id,
        {
          status: editStatus,
          tableNumber: normalizedTableNumber,
          items: editItems.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
          })),
        },
        trimmedCode
      );
      toast.success(tx('Order updated.', 'Commande mise a jour.'));
      setEditingOrder(null);
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : tx('Failed to update order.', 'Echec de la mise a jour de la commande.');
      toast.error(message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[#f9f1e6]">
          <Package className="h-10 w-10 text-[#c8975a]" />
        </div>
        <p className="text-lg font-medium text-[#5a3418]">{tx('No orders yet', 'Aucune commande pour le moment')}</p>
        <p className="mt-2 text-base text-[#9a7a5d]">
          {tx('New customer orders will appear automatically.', 'Les nouvelles commandes clients apparaitront automatiquement.')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {activeOrders.length > 0 && (
        <div>
          <h2 className="mb-5 text-xl font-semibold text-[#2f1f14]">
            {tx('Active Orders', 'Commandes Actives')}
            <span className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f8bf60] text-sm font-bold text-[#2f1f14]">
              {activeOrders.length}
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {activeOrders.map((order) => {
              const colors = getStatusColor(order.status);
              const hasStatusChanged = recentlyChangedOrderIds.has(order.id);
              return (
                <div
                  key={order.id}
                  className={`flex flex-col overflow-hidden rounded-2xl border border-[#ead6c2] bg-white shadow-sm transition-all duration-500 hover:shadow-md ${
                    hasStatusChanged
                      ? 'animate-order-status-card order-status-flash order-status-flash--active ring-2 ring-[#f8bf60] shadow-lg scale-[1.01]'
                      : ''
                  }`}
                >
                  <div className={`${colors.bar} px-4 py-3`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UtensilsCrossed className="h-5 w-5 text-white/90" />
                        <span className="text-lg font-bold text-white">
                          {order.tableNumber
                            ? `${tx('Table', 'Table')} ${order.tableNumber}`
                            : tx('No Table', 'Sans Table')}
                        </span>
                      </div>
                      <span className="rounded-full bg-white/25 px-2.5 py-0.5 text-sm font-semibold text-white">
                        #{order.orderNumber}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-sm font-medium transition-all duration-500 ${colors.badge} ${
                        hasStatusChanged ? 'animate-order-status-badge scale-105' : ''
                      }`}>
                        {getStatusIcon(order.status)}
                        {statusLabel(order.status)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-sm text-zinc-400">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDistanceToNow(order.timestamp, { addSuffix: true, locale: relativeTimeLocale })}
                        </span>
                        <button
                          type="button"
                          onClick={() => openEditModal(order)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#d9c0a4] text-[#7a5539] hover:bg-[#f9f1e6]"
                          title={tx('Edit order', 'Editer commande')}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mb-4 flex-1 space-y-2 rounded-xl bg-[#fdf8f3] p-3">
                      {order.items.map((item) => (
                        <div key={`${order.id}-${item.id}`} className="flex items-center justify-between text-sm">
                          <span className="text-[#3d2812]">
                            <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#f8bf60] text-xs font-bold text-[#2f1f14]">
                              {item.quantity}
                            </span>
                            {item.name}
                          </span>
                          <span className="font-medium text-[#5a3418]">{(item.price * item.quantity).toFixed(2)} TND</span>
                        </div>
                      ))}
                    </div>

                    <div className="mb-4 flex items-center justify-between rounded-xl border border-[#ead6c2] px-4 py-2.5">
                      <span className="text-base font-medium text-[#5a3418]">{tx('Total', 'Total')}</span>
                      <span className="text-lg font-bold text-[#2f1f14]">{order.total.toFixed(2)} TND</span>
                    </div>

                    {order.paymentMethod && (
                      <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#ead6c2] bg-[#fdf8f3] px-4 py-2">
                        {order.paymentMethod === 'cash' ? (
                          <Banknote className="h-4 w-4 text-[#7a5539]" />
                        ) : (
                          <CreditCard className="h-4 w-4 text-[#7a5539]" />
                        )}
                        <span className="text-sm font-medium capitalize text-[#5a3418]">
                          {order.paymentMethod === 'cash'
                            ? tx('Cash', 'Espèces')
                            : order.paymentProvider
                              ? `${order.paymentMethod} · ${order.paymentProvider}`
                              : order.paymentMethod}
                        </span>
                      </div>
                    )}

                    <div className="mt-auto">
                      <Button
                        onClick={() => handleStatusChange(order.id, order.status)}
                        className={`w-full text-white ${
                          order.status === 'ready' && order.paymentMethod === 'cash'
                            ? 'bg-amber-500 hover:bg-amber-600'
                            : colors.btn
                        }`}
                      >
                        {order.status === 'pending' && tx('Start Preparing', 'Commencer Preparation')}
                        {order.status === 'preparing' && tx('Mark as Ready', 'Marquer Pret')}
                        {order.status === 'ready' && order.paymentMethod !== 'cash' && tx('Complete Order', 'Terminer Commande')}
                        {order.status === 'ready' && order.paymentMethod === 'cash' && (
                          <span className="flex items-center justify-center gap-2">
                            <Banknote className="h-4 w-4" />
                            {tx('Collect Cash & Complete', 'Encaisser & Terminer')}
                          </span>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {completedOrders.length > 0 && (
        <div>
          <h2 className="mb-5 text-xl font-semibold text-zinc-400">
            {tx('Completed Orders', 'Commandes Terminees')}
            <span className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-sm font-bold text-zinc-500">
              {filteredCompletedOrders.length}
            </span>
          </h2>
          <p className="mb-2 text-xs text-[#9a7a5d]">
            {tx('Completed orders in selected range', 'Commandes terminees dans la plage selectionnee')}:{' '}
            <span className="font-semibold text-[#5a3418]">{filteredCompletedOrders.length}</span>
          </p>
          <div className="mb-4 rounded-2xl border border-[#ead6c2] bg-white p-3 shadow-sm">
            <div className="flex items-end justify-between gap-2 overflow-x-auto">
              <div className="flex flex-nowrap items-end gap-2">
                <label className="flex flex-col gap-0.5">
                  <span className="whitespace-nowrap text-sm font-medium text-[#5a3418]">{tx('From Date', 'Date Debut')}</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="h-8 rounded-lg border border-[#d9c0a4] bg-[#fffcf8] px-2.5 text-xs text-[#5a3418]"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="whitespace-nowrap text-sm font-medium text-[#5a3418]">{tx('To Date', 'Date Fin')}</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="h-8 rounded-lg border border-[#d9c0a4] bg-[#fffcf8] px-2.5 text-xs text-[#5a3418]"
                  />
                </label>
              </div>

              <div className="flex flex-nowrap gap-1.5">
                <Button type="button" onClick={exportAsCsv} className="h-8 bg-[#6a4730] px-3 text-xs text-white hover:bg-[#7a5539]">
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  {tx('Export CSV', 'Exporter CSV')}
                </Button>
                <Button type="button" onClick={exportAsExcel} className="h-8 bg-[#f8bf60] px-3 text-xs text-[#2f1f14] hover:bg-[#f2b24a]">
                  <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                  {tx('Export Excel', 'Exporter Excel')}
                </Button>
                <Button type="button" onClick={printReceipts} className="h-8 bg-[#8b5b35] px-3 text-xs text-white hover:bg-[#72482a]">
                  <Printer className="mr-1.5 h-3.5 w-3.5" />
                  {tx('Print Receipts', 'Imprimer Recus')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="h-8 border-[#d9c0a4] px-3 text-xs text-[#7a5539]"
                >
                  {tx('Clear Dates', 'Effacer Dates')}
                </Button>
              </div>
            </div>

          </div>

          {filteredCompletedOrders.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#ead6c2] bg-[#fffcf8] p-8 text-center">
              <p className="text-base text-[#7a5539]">
                {tx('No completed orders found for selected dates.', 'Aucune commande terminee trouvee pour les dates selectionnees.')}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {filteredCompletedOrders.map((order) => {
              const hasStatusChanged = recentlyChangedOrderIds.has(order.id);
              return (
              <div
                key={order.id}
                className={`flex overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 transition-all duration-500 ${
                  hasStatusChanged
                    ? 'animate-order-status-card order-status-flash order-status-flash--completed ring-2 ring-green-300 shadow-lg opacity-100 scale-[1.01]'
                    : 'opacity-70'
                }`}
              >
                <div className={`w-1.5 flex-shrink-0 ${hasStatusChanged ? 'bg-green-500' : 'bg-zinc-300'}`} />
                <div className="flex flex-1 items-center justify-between px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <UtensilsCrossed className="h-4 w-4 text-zinc-400" />
                      <span className="font-semibold text-zinc-600">
                        {order.tableNumber
                          ? `${tx('Table', 'Table')} ${order.tableNumber}`
                          : tx('No Table', 'Sans Table')}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-zinc-400">
                      #{order.orderNumber} · {formatDistanceToNow(order.timestamp, { addSuffix: true, locale: relativeTimeLocale })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-zinc-500">{order.total.toFixed(2)} TND</p>
                    {order.paymentMethod && (
                      <p className="mt-0.5 flex items-center justify-end gap-1 text-xs text-zinc-400">
                        {order.paymentMethod === 'cash' ? (
                          <Banknote className="h-3 w-3" />
                        ) : (
                          <CreditCard className="h-3 w-3" />
                        )}
                        <span className="capitalize">
                          {order.paymentMethod === 'cash'
                            ? tx('Cash', 'Espèces')
                            : order.paymentProvider ?? order.paymentMethod}
                        </span>
                      </p>
                    )}
                    <div className="mt-1 flex items-center justify-end gap-1">
                      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-500">
                        <CheckCircle className="h-3 w-3" />
                        {tx('done', 'termine')}
                      </span>
                      <button
                        type="button"
                        onClick={() => openEditModal(order)}
                        className="inline-flex items-center gap-1 rounded-full border border-zinc-300 px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100"
                      >
                        <Pencil className="h-3 w-3" />
                        {tx('Edit', 'Editer')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );})}
          </div>
        </div>
      )}

      {editingOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget && !isSavingEdit) {
              setEditingOrder(null);
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#ead6c2] px-5 py-4">
              <h3 className="text-lg font-semibold text-[#5a3418]">
                {tx('Edit Order', 'Editer Commande')} #{editingOrder.orderNumber}
              </h3>
              <button
                type="button"
                onClick={() => !isSavingEdit && setEditingOrder(null)}
                className="rounded-md p-1 text-[#9a7a5d] hover:bg-[#f9f1e6]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-[#5a3418]">{tx('Status', 'Statut')}</span>
                <select
                  value={editStatus}
                  onChange={(event) => setEditStatus(event.target.value as Order['status'])}
                  className="h-10 rounded-lg border border-[#d9c0a4] bg-[#fffcf8] px-3 text-sm text-[#5a3418]"
                >
                  <option value="pending">{tx('pending', 'en attente')}</option>
                  <option value="preparing">{tx('preparing', 'en preparation')}</option>
                  <option value="ready">{tx('ready', 'pret')}</option>
                  <option value="completed">{tx('completed', 'termine')}</option>
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-[#5a3418]">
                  {tx('Table Number (leave empty to clear)', 'Numero Table (laisser vide pour vider)')}
                </span>
                <input
                  type="number"
                  min={1}
                  value={editTableNumber}
                  onChange={(event) => setEditTableNumber(event.target.value)}
                  className="h-10 rounded-lg border border-[#d9c0a4] bg-[#fffcf8] px-3 text-sm text-[#5a3418]"
                  placeholder={tx('e.g. 3', 'ex: 3')}
                />
              </label>

              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-[#5a3418]">{tx('Order Items', 'Articles de la commande')}</span>
                  <p className="mt-1 text-xs text-[#9a7a5d]">
                    {tx('You can change items and quantities. Prices are read-only.', 'Vous pouvez modifier les articles et les quantites. Les prix sont en lecture seule.')}
                  </p>
                </div>

                <div className="space-y-2 rounded-xl border border-[#ead6c2] bg-[#fdf8f3] p-3">
                  {editItems.map((item) => (
                    <div key={item.menuItemId} className="rounded-lg border border-[#ead6c2] bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-[#5a3418]">{item.name}</p>
                          <p className="mt-1 text-xs text-[#9a7a5d]">
                            {tx('Unit Price', 'Prix unitaire')}: {item.price.toFixed(2)} {currencyCode}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeEditItem(item.menuItemId)}
                          className="rounded-md p-1 text-[#9a7a5d] hover:bg-[#f9f1e6] hover:text-[#5a3418]"
                          title={tx('Remove item', 'Supprimer article')}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <label className="flex flex-1 flex-col gap-1">
                          <span className="text-xs font-medium text-[#7a5539]">{tx('Quantity', 'Quantite')}</span>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={item.quantity}
                            onChange={(event) => updateEditItemQuantity(item.menuItemId, event.target.value)}
                            className="h-10 rounded-lg border border-[#d9c0a4] bg-[#fffcf8] px-3 text-sm text-[#5a3418]"
                          />
                        </label>
                        <div className="min-w-[96px] text-right">
                          <p className="text-xs font-medium text-[#7a5539]">{tx('Line Total', 'Total ligne')}</p>
                          <p className="mt-1 text-sm font-semibold text-[#5a3418]">
                            {(item.price * item.quantity).toFixed(2)} {currencyCode}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {editItems.length === 0 && (
                    <p className="text-sm text-[#9a7a5d]">
                      {tx('No items selected yet.', 'Aucun article selectionne pour le moment.')}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-dashed border-[#d9c0a4] bg-[#fffcf8] p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <label className="flex-1 flex-col gap-1">
                      <span className="text-sm font-medium text-[#5a3418]">{tx('Add Menu Item', 'Ajouter un article du menu')}</span>
                      <select
                        value={selectedMenuItemIdToAdd}
                        onChange={(event) => setSelectedMenuItemIdToAdd(event.target.value)}
                        className="mt-1 h-10 w-full rounded-lg border border-[#d9c0a4] bg-white px-3 text-sm text-[#5a3418]"
                      >
                        <option value="">{tx('Select an item', 'Selectionnez un article')}</option>
                        {menuOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} - {item.price.toFixed(2)} {currencyCode}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button
                      type="button"
                      onClick={addSelectedMenuItem}
                      disabled={!selectedMenuItemIdToAdd}
                      className="bg-[#f8bf60] text-[#2f1f14] hover:bg-[#f2b24a]"
                    >
                      {tx('Add Item', 'Ajouter')}
                    </Button>
                  </div>
                </div>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-[#5a3418]">{tx('Admin Code', 'Code Admin')}</span>
                <input
                  type="password"
                  value={adminCode}
                  onChange={(event) => setAdminCode(event.target.value)}
                  className="h-10 rounded-lg border border-[#d9c0a4] bg-[#fffcf8] px-3 text-sm text-[#5a3418]"
                  placeholder={tx('Required to save changes', 'Obligatoire pour enregistrer')}
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#ead6c2] px-5 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingOrder(null)}
                disabled={isSavingEdit}
                className="border-[#d9c0a4] text-[#7a5539]"
              >
                {tx('Cancel', 'Annuler')}
              </Button>
              <Button
                type="button"
                onClick={() => void handleSaveEdit()}
                disabled={isSavingEdit}
                className="bg-[#6a4730] text-white hover:bg-[#7a5539]"
              >
                {isSavingEdit ? tx('Saving...', 'Enregistrement...') : tx('Save Changes', 'Enregistrer')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
