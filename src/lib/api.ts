// API service for MySQL backend communication
const configuredApiUrl = String(import.meta.env.VITE_API_URL ?? '').trim();
const isLocalHost =
  typeof window !== 'undefined' &&
  /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
const resolvedApiUrl = configuredApiUrl || (isLocalHost ? 'http://localhost:3002' : 'https://tawla-scan.onrender.com');
const API_URL = resolvedApiUrl
  .replace(/^http:\/\/localhost:3001\b/i, 'http://localhost:3002')
  .replace(/^https?:\/\/127\.0\.0\.1:3001\b/i, 'http://127.0.0.1:3002');

export interface ApiMenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'coffee' | 'tea' | 'food' | 'milkshake' | 'cocktail';
  image: string;
  available?: boolean;
  is_best_seller?: boolean;
  is_new?: boolean;
  isBestSeller?: boolean;
  isNew?: boolean;
}

export interface ApiMenuAuditLog {
  id: number;
  eventType: 'item_added' | 'item_updated' | 'price_changed' | 'item_deleted' | string;
  menuItemId: string;
  menuItemName: string;
  changedFields: string[];
  previousValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  createdAt: string;
}

export interface ApiOrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface ApiOrder {
  id: string;
  orderNumber: number;
  total: number;
  status: 'pending' | 'preparing' | 'ready' | 'completed';
  tableNumber?: number | null;
  paymentMethod?: string | null;
  paymentProvider?: string | null;
  paymentReference?: string | null;
  paymentStatus?: string | null;
  timestamp: string;
  items: ApiOrderItem[];
}

export interface KonnectInitPayload {
  amount: number;
  description?: string;
  orderId?: string;
  tableNumber?: number | null;
}

export interface KonnectInitResponse {
  payUrl: string;
  paymentRef: string;
  paymentId?: string;
  orderId: string;
}

export interface KonnectPaymentStatusResponse {
  paymentRef: string;
  status: string;
  isPaid: boolean;
  details: Record<string, unknown>;
}

export interface ApiCafeTable {
  id: string;
  tableNumber: number;
  qrToken: string;
  active: boolean;
}

export interface ApiBundle {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice: number;
  items: string[];
  image: string;
  active?: boolean;
}

export interface AppSettingsPayload {
  businessName: string;
  currencyCode: string;
  taxRate: number;
  serviceCharge: number;
  defaultLanguage: 'en' | 'fr';
  enableOrderNotifications: boolean;
}

export const api = {
  // Menu items
  async getMenuItems(): Promise<ApiMenuItem[]> {
    const response = await fetch(`${API_URL}/api/menu-items`);
    if (!response.ok) throw new Error('Failed to fetch menu items');
    return response.json();
  },

  async getMenuAuditLogs(limit = 40): Promise<ApiMenuAuditLog[]> {
    const safeLimit = Number.isInteger(limit) ? Math.max(1, Math.min(200, limit)) : 40;
    const response = await fetch(`${API_URL}/api/menu-items/audit-logs?limit=${safeLimit}`);
    if (!response.ok) throw new Error('Failed to fetch menu audit logs');

    const rows = await response.json();
    if (!Array.isArray(rows)) {
      return [];
    }

    return rows.map((row) => {
      const parseJson = (value: unknown) => {
        if (typeof value !== 'string' || !value.trim()) {
          return null;
        }
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      };

      const changedFields = parseJson(row.changedFields);
      const previousValues = parseJson(row.previousValues);
      const newValues = parseJson(row.newValues);

      return {
        id: Number(row.id) || 0,
        eventType: String(row.eventType || 'item_updated'),
        menuItemId: String(row.menuItemId || ''),
        menuItemName: String(row.menuItemName || ''),
        changedFields: Array.isArray(changedFields)
          ? changedFields.map((field) => String(field))
          : [],
        previousValues: previousValues && typeof previousValues === 'object'
          ? previousValues as Record<string, unknown>
          : null,
        newValues: newValues && typeof newValues === 'object'
          ? newValues as Record<string, unknown>
          : null,
        createdAt: String(row.createdAt || ''),
      };
    });
  },

  async createMenuItem(item: Omit<ApiMenuItem, 'id'> & { id?: string }) {
    const response = await fetch(`${API_URL}/api/menu-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (!response.ok) throw new Error('Failed to create menu item');
    return response.json();
  },

  async updateMenuItem(id: string, updates: Partial<ApiMenuItem>) {
    const response = await fetch(`${API_URL}/api/menu-items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update menu item');
    return response.json();
  },

  async deleteMenuItem(id: string) {
    const response = await fetch(`${API_URL}/api/menu-items/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete menu item');
    return response.json();
  },

  async uploadMenuImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`${API_URL}/api/uploads/menu-image`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = 'Failed to upload image';
      try {
        const payload = await response.json();
        if (payload && typeof payload.error === 'string' && payload.error.trim()) {
          errorMessage = payload.error;
        }
      } catch {
        // Keep fallback error message.
      }
      throw new Error(errorMessage);
    }

    const payload = await response.json();
    if (!payload || typeof payload.url !== 'string' || !payload.url.trim()) {
      throw new Error('Upload did not return a valid image URL');
    }

    return payload.url;
  },

  async uploadOfferCarouselImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`${API_URL}/api/uploads/offer-carousel`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = 'Failed to upload offer image';
      try {
        const payload = await response.json();
        if (payload && typeof payload.error === 'string' && payload.error.trim()) {
          errorMessage = payload.error;
        }
      } catch {
        // Keep fallback error message.
      }
      throw new Error(errorMessage);
    }

    const payload = await response.json();
    if (!payload || typeof payload.url !== 'string' || !payload.url.trim()) {
      throw new Error('Upload did not return a valid image URL');
    }

    return payload.url;
  },
  async uploadProfilePic(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);

    const url = `${API_URL}/api/uploads/profile-pic`;
    console.log('Uploading to:', url);
    console.log('File:', {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    const rawText = await response.text();
    console.log('Upload status:', response.status);
    console.log('Upload raw response:', rawText);

    if (!response.ok) {
      let errorMessage = 'Failed to upload profile picture';

      try {
        const payload = JSON.parse(rawText);
        if (payload && typeof payload.error === 'string' && payload.error.trim()) {
          errorMessage = payload.error;
        } else if (payload && typeof payload.message === 'string' && payload.message.trim()) {
          errorMessage = payload.message;
        }
      } catch {
        if (rawText.trim()) {
          errorMessage = rawText;
        }
      }

      throw new Error(errorMessage);
    }

    let payload: any;
    try {
      payload = JSON.parse(rawText);
    } catch {
      throw new Error('Server did not return valid JSON');
    }

    if (!payload || typeof payload.url !== 'string' || !payload.url.trim()) {
      throw new Error('Upload did not return a valid image URL');
    }

    return payload.url;
  },
  // Offers
  async getOffers() {
    const response = await fetch(`${API_URL}/api/offers`);
    if (!response.ok) throw new Error('Failed to fetch offers');
    return response.json();
  },

  async createOffer(offer: any) {
    const response = await fetch(`${API_URL}/api/offers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(offer),
    });
    if (!response.ok) throw new Error('Failed to create offer');
    return response.json();
  },

  async updateOffer(id: string, offer: any) {
    const response = await fetch(`${API_URL}/api/offers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(offer),
    });
    if (!response.ok) throw new Error('Failed to update offer');
    return response.json();
  },

  async deleteOffer(id: string) {
    const response = await fetch(`${API_URL}/api/offers/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete offer');
    return response.json();
  },

  // Bundles & Combos
  async getBundles(): Promise<ApiBundle[]> {
    const response = await fetch(`${API_URL}/api/bundles`);
    if (!response.ok) throw new Error('Failed to fetch bundles');
    return response.json();
  },

  async createBundle(bundle: Omit<ApiBundle, 'id'> & { id?: string }) {
    const response = await fetch(`${API_URL}/api/bundles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bundle),
    });
    if (!response.ok) throw new Error('Failed to create bundle');
    return response.json();
  },

  async updateBundle(id: string, bundle: Partial<ApiBundle>) {
    const response = await fetch(`${API_URL}/api/bundles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bundle),
    });
    if (!response.ok) throw new Error('Failed to update bundle');
    return response.json();
  },

  async deleteBundle(id: string) {
    const response = await fetch(`${API_URL}/api/bundles/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete bundle');
    return response.json();
  },

  async readAppSettings(superAdminPass: string): Promise<{ settings: AppSettingsPayload }> {
    const response = await fetch(`${API_URL}/api/settings/app/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ superAdminPass }),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to read app settings';
      try {
        const payload = await response.json();
        if (payload?.error) {
          errorMessage = String(payload.error);
        }
      } catch {
        // Keep fallback error message.
      }
      throw new Error(errorMessage);
    }

    return response.json();
  },

  async updateAppSettings(
    superAdminPass: string,
    settings: Partial<AppSettingsPayload>
  ): Promise<{ success: boolean; settings: AppSettingsPayload }> {
    const response = await fetch(`${API_URL}/api/settings/app`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ superAdminPass, settings }),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to update app settings';
      try {
        const payload = await response.json();
        if (payload?.error) {
          errorMessage = String(payload.error);
        }
      } catch {
        // Keep fallback error message.
      }
      throw new Error(errorMessage);
    }

    return response.json();
  },

  // Change dashboard access password (admin login)
  async changeAdminPassword(currentPass: string, newPass: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_URL}/api/settings/admin-password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPass, newPass }),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to update admin password';
      try {
        const payload = await response.json();
        if (payload?.error) {
          errorMessage = String(payload.error);
        }
      } catch {
        // Keep fallback error message.
      }
      throw new Error(errorMessage);
    }

    return response.json();
  },

  // Change super admin password (used for privileged API operations)
  async changeSuperAdminPassword(currentPass: string, newPass: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_URL}/api/settings/super-admin-password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPass, newPass }),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to update super admin password';
      try {
        const payload = await response.json();
        if (payload?.error) {
          errorMessage = String(payload.error);
        }
      } catch {
        // Keep fallback error message.
      }
      throw new Error(errorMessage);
    }

    return response.json();
  },

  // Verify dashboard admin login
  async adminLogin(pass: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_URL}/api/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminPass: pass }),
    });

    if (!response.ok) {
      let errorMessage = 'Incorrect admin password';
      try {
        const payload = await response.json();
        if (payload?.error) errorMessage = String(payload.error);
      } catch {
        // Keep fallback error message.
      }
      throw new Error(errorMessage);
    }

    return response.json();
  },

  // Reset dashboard admin password using super admin password
  async resetAdminPassword(
    superAdminPass: string,
    newAdminPass: string
  ): Promise<{ success: boolean }> {
    const response = await fetch(`${API_URL}/api/auth/reset/admin-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ superAdminPass, newAdminPass }),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to reset admin password';
      try {
        const payload = await response.json();
        if (payload?.error) errorMessage = String(payload.error);
      } catch {
        // Keep fallback error message.
      }
      throw new Error(errorMessage);
    }

    return response.json();
  },

  // Public settings (no auth required)
  async getPublicSettings(): Promise<{ businessName: string; taxRate: number; serviceCharge: number; currencyCode: string }> {
    const response = await fetch(`${API_URL}/api/settings/public`);
    if (!response.ok) return { businessName: 'The Local Cafe', taxRate: 0, serviceCharge: 0, currencyCode: 'TND' };
    try {
      const payload = await response.json();
      return {
        businessName: String(payload?.businessName ?? 'The Local Cafe'),
        taxRate: Number(payload?.taxRate ?? 0) || 0,
        serviceCharge: Number(payload?.serviceCharge ?? 0) || 0,
        currencyCode: String(payload?.currencyCode ?? 'TND').trim().toUpperCase() || 'TND',
      };
    } catch {
      return { businessName: 'The Local Cafe', taxRate: 0, serviceCharge: 0, currencyCode: 'TND' };
    }
  },

  // Tables
  async getTables(): Promise<ApiCafeTable[]> {
    const response = await fetch(`${API_URL}/api/tables`);
    if (!response.ok) throw new Error('Failed to fetch tables');
    return response.json();
  },

  async generateTables(count: number): Promise<{ count: number; tables: ApiCafeTable[] }> {
    const response = await fetch(`${API_URL}/api/tables/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count }),
    });
    if (!response.ok) throw new Error('Failed to generate tables');
    return response.json();
  },

  async generateTablesWithPass(
    count: number,
    superAdminPass: string
  ): Promise<{ count: number; tables: ApiCafeTable[] }> {
    const response = await fetch(`${API_URL}/api/tables/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count, superAdminPass }),
    });
    if (!response.ok) throw new Error('Failed to generate tables');
    return response.json();
  },

  async createTable(payload: {
    tableNumber: number;
    qrToken?: string;
    superAdminPass: string;
  }): Promise<ApiCafeTable> {
    const response = await fetch(`${API_URL}/api/tables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Failed to create table');
    return response.json();
  },

  async updateTableQr(
    tableId: string,
    qrToken: string,
    superAdminPass: string
  ): Promise<ApiCafeTable> {
    const response = await fetch(`${API_URL}/api/tables/${tableId}/qr`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrToken, superAdminPass }),
    });
    if (!response.ok) throw new Error('Failed to update table QR');
    return response.json();
  },

  async deleteTable(tableId: string, superAdminPass: string) {
    const response = await fetch(`${API_URL}/api/tables/${tableId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ superAdminPass }),
    });
    if (!response.ok) throw new Error('Failed to delete table');
    return response.json();
  },

  // Orders
  async getOrders(): Promise<ApiOrder[]> {
    const response = await fetch(`${API_URL}/api/orders`);
    if (!response.ok) throw new Error('Failed to fetch orders');
    return response.json();
  },

  async getOrder(orderId: string) {
    const response = await fetch(`${API_URL}/api/orders/${orderId}`);
    if (!response.ok) throw new Error('Failed to fetch order');
    return response.json();
  },

  async createOrder(order: {
    id?: string;
    items: ApiOrderItem[];
    total: number;
    status?: ApiOrder['status'];
    tableNumber?: number | null;
    paymentMethod?: string | null;
    paymentProvider?: string | null;
    paymentReference?: string | null;
    paymentStatus?: string | null;
  }) {
    const response = await fetch(`${API_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to create order';
      try {
        const payload = await response.json();
        if (payload && typeof payload.error === 'string' && payload.error.trim()) {
          errorMessage = payload.error;
        }
      } catch {
        // Keep default error message when response body is not JSON.
      }
      throw new Error(errorMessage);
    }

    return response.json();
  },

  async updateOrderStatus(orderId: string, status: string) {
    const response = await fetch(`${API_URL}/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) throw new Error('Failed to update order status');
    return response.json();
  },

  async initiateKonnectPayment(payload: KonnectInitPayload): Promise<KonnectInitResponse> {
    const response = await fetch(`${API_URL}/api/payments/konnect/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to initiate Konnect payment';
      try {
        const result = await response.json();
        if (result?.error) {
          errorMessage = String(result.error);
        }
      } catch {
        // Keep fallback error message.
      }
      throw new Error(errorMessage);
    }

    return response.json();
  },

  async getKonnectPayment(paymentRef: string): Promise<KonnectPaymentStatusResponse> {
    const response = await fetch(`${API_URL}/api/payments/konnect/${encodeURIComponent(paymentRef)}`);

    if (!response.ok) {
      let errorMessage = 'Failed to check Konnect payment';
      try {
        const result = await response.json();
        if (result?.error) {
          errorMessage = String(result.error);
        }
      } catch {
        // Keep fallback error message.
      }
      throw new Error(errorMessage);
    }

    return response.json();
  },

  async updateOrderWithAdmin(
    orderId: string,
    payload: {
      status?: ApiOrder['status'];
      tableNumber?: number | null;
      items?: Array<{
        menuItemId: string;
        quantity: number;
      }>;
      adminPass: string;
    }
  ) {
    const response = await fetch(`${API_URL}/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to update order';
      try {
        const result = await response.json();
        if (result?.error) {
          errorMessage = String(result.error);
        }
      } catch {
        // Keep fallback error message.
      }
      throw new Error(errorMessage);
    }

    return response.json();
  },
};
