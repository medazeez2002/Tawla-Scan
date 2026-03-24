import React, { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { CartItem } from './CartContext';
import { api } from '../../lib/api';

export interface Order {
  id: string;
  orderNumber: number;
  tableNumber: number | null;
  items: Array<CartItem & { menuItemId?: string; orderItemId?: string }>;
  total: number;
  status: 'pending' | 'preparing' | 'ready' | 'completed';
  timestamp: Date;
  paymentMethod: string | null;
  paymentProvider: string | null;
}

interface OrderPaymentMeta {
  method?: string | null;
  provider?: string | null;
  reference?: string | null;
  status?: string | null;
}

interface AdminEditableOrderItem {
  menuItemId: string;
  quantity: number;
}

interface OrdersContextType {
  orders: Order[];
  addOrder: (
    items: CartItem[],
    total: number,
    tableNumber?: number | null,
    payment?: OrderPaymentMeta
  ) => Promise<number>;
  updateOrderStatus: (orderId: string, status: Order['status']) => Promise<void>;
  updateOrderWithAdmin: (
    orderId: string,
    updates: { status?: Order['status']; tableNumber?: number | null; items?: AdminEditableOrderItem[] },
    adminPass: string
  ) => Promise<void>;
  getOrdersByStatus: (status: Order['status']) => Order[];
  refreshOrders: () => Promise<void>;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

function mapApiOrder(raw: any): Order {
  const items = Array.isArray(raw.items) ? raw.items : [];
  return {
    id: String(raw.id),
    orderNumber: Number(raw.orderNumber ?? raw.order_number ?? 0),
    tableNumber:
      raw.tableNumber !== undefined && raw.tableNumber !== null
        ? Number(raw.tableNumber)
        : raw.table_number !== undefined && raw.table_number !== null
          ? Number(raw.table_number)
          : null,
    items: items.map((item: any) => {
      const menuItemId = String(item.menuItemId ?? item.id ?? '').trim();
      const orderItemId = String(item.orderItemId ?? '').trim();
      return {
      id: menuItemId || orderItemId,
      menuItemId: menuItemId || undefined,
      orderItemId: orderItemId || undefined,
      name: String(item.name ?? 'Item'),
      description: String(item.description ?? ''),
      price: Number(item.price ?? 0),
      category: (item.category ?? 'food') as CartItem['category'],
      image: String(item.image ?? ''),
      quantity: Number(item.quantity ?? 1),
    }}),
    total: Number(raw.total ?? 0),
    status: raw.status as Order['status'],
    timestamp: new Date(raw.timestamp),
    paymentMethod: raw.paymentMethod ?? raw.payment_method ?? null,
    paymentProvider: raw.paymentProvider ?? raw.payment_provider ?? null,
  };
}

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const knownOrderIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  const playNotification = () => {
    try {
      const audio = new Audio('/notification-new-order.mp3');
      audio.volume = 0.7;
      void audio.play();
    } catch {
      // Silently ignore if autoplay is blocked
    }
  };

  const playReadyNotification = () => {
    try {
      const audio = new Audio('/notification-order-ready.mp3');
      audio.volume = 0.75;
      void audio.play();
    } catch {
      // Silently ignore if autoplay is blocked
    }
  };

  const refreshOrders = async () => {
    try {
      const rows = await api.getOrders();
      const mapped = rows.map(mapApiOrder).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      if (isFirstLoad.current) {
        // Populate known IDs on first load without playing sound
        mapped.forEach((o) => knownOrderIds.current.add(o.id));
        isFirstLoad.current = false;
      } else {
        // Detect genuinely new orders
        const hasNew = mapped.some((o) => !knownOrderIds.current.has(o.id));
        if (hasNew) {
          playNotification();
          mapped.forEach((o) => knownOrderIds.current.add(o.id));
        }
      }

      setOrders(mapped);
    } catch (error) {
      console.error('Failed to refresh orders', error);
    }
  };

  useEffect(() => {
    void refreshOrders();

    // Polling gives near real-time sync between customer and restaurant views.
    const interval = setInterval(() => {
      void refreshOrders();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const addOrder = async (
    items: CartItem[],
    total: number,
    tableNumber?: number | null,
    payment?: OrderPaymentMeta
  ): Promise<number> => {
    const payloadItems = items.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      price: item.price,
    }));

    const created = await api.createOrder({
      items: payloadItems,
      total,
      status: 'pending',
      tableNumber: tableNumber ?? null,
      paymentMethod: payment?.method ?? null,
      paymentProvider: payment?.provider ?? null,
      paymentReference: payment?.reference ?? null,
      paymentStatus: payment?.status ?? null,
    });

    await refreshOrders();
    return Number(created.orderNumber);
  };

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    await api.updateOrderStatus(orderId, status);
    if (status === 'ready') {
      playReadyNotification();
    }
    await refreshOrders();
  };

  const updateOrderWithAdmin = async (
    orderId: string,
    updates: { status?: Order['status']; tableNumber?: number | null; items?: AdminEditableOrderItem[] },
    adminPass: string
  ) => {
    await api.updateOrderWithAdmin(orderId, {
      ...updates,
      adminPass,
    });
    await refreshOrders();
  };

  const getOrdersByStatus = (status: Order['status']) => {
    return orders.filter((order) => order.status === status);
  };

  const value = useMemo(
    () => ({
      orders,
      addOrder,
      updateOrderStatus,
      updateOrderWithAdmin,
      getOrdersByStatus,
      refreshOrders,
    }),
    [orders]
  );

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const context = useContext(OrdersContext);
  if (context === undefined) {
    throw new Error('useOrders must be used within an OrdersProvider');
  }
  return context;
}
