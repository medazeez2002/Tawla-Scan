import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import multer from 'multer';

dotenv.config();

const app = express();
app.set('trust proxy', 1);

const uploadsRoot = path.join(process.cwd(), 'uploads');
const menuImagesDir = path.join(uploadsRoot, 'menu-images');
const offerCarouselDir = path.join(uploadsRoot, 'offer-carousel');

fs.mkdirSync(menuImagesDir, { recursive: true });
fs.mkdirSync(offerCarouselDir, { recursive: true });

const menuImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, menuImagesDir),
    filename: (_req, file, cb) => {
      const originalExt = path.extname(file.originalname).toLowerCase();
      const ext = originalExt === '.jpeg' || originalExt === '.jpg' || originalExt === '.png'
        ? originalExt
        : file.mimetype === 'image/png'
          ? '.png'
          : '.jpg';
      cb(null, `menu-image-${Date.now()}-${Math.floor(Math.random() * 100000)}${ext}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const mimeType = String(file.mimetype || '').toLowerCase();
    const originalName = String(file.originalname || '');
    const allowedByMime = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/pjpeg', 'image/x-png']);
    const allowedByExt = /\.(jpe?g|png)$/i.test(originalName);

    if (!allowedByMime.has(mimeType) && !allowedByExt) {
      cb(new Error('Only JPEG and PNG files are allowed'));
      return;
    }
    cb(null, true);
  },
});

const offerCarouselUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, offerCarouselDir),
    filename: (_req, file, cb) => {
      const originalExt = path.extname(file.originalname).toLowerCase();
      const ext = originalExt === '.jpeg' || originalExt === '.jpg' || originalExt === '.png'
        ? originalExt
        : file.mimetype === 'image/png'
          ? '.png'
          : '.jpg';
      cb(null, `offer-carousel-${Date.now()}-${Math.floor(Math.random() * 100000)}${ext}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const mimeType = String(file.mimetype || '').toLowerCase();
    const originalName = String(file.originalname || '');
    const allowedByMime = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/pjpeg', 'image/x-png']);
    const allowedByExt = /\.(jpe?g|png)$/i.test(originalName);

    if (!allowedByMime.has(mimeType) && !allowedByExt) {
      cb(new Error('Only JPEG and PNG files are allowed for carousel'));
      return;
    }
    cb(null, true);
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsRoot));

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Tawla Scan API server is running.',
    frontend: 'http://localhost:5173',
    health: '/api/health',
  });
});

// Create connection pool
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 3306);
console.log(`[DB] Connecting to ${DB_HOST}:${DB_PORT} / ${process.env.DB_NAME || 'tawla_scan'} as ${process.env.DB_USER || 'root'}`);

const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tawla_scan',
  ssl: DB_HOST === 'localhost' ? undefined : { rejectUnauthorized: false },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

let superAdminPass = process.env.SUPER_ADMIN_PASS || 'j12345678A';
let adminPass = process.env.ADMIN_PASS || 'admin1234';
const VALID_ORDER_STATUSES = new Set(['pending', 'preparing', 'ready', 'completed']);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const KONNECT_API_BASE_URL = (process.env.KONNECT_API_BASE_URL || 'https://api.sandbox.konnect.network/api/v2').replace(/\/+$/, '');
const KONNECT_API_KEY = process.env.KONNECT_API_KEY || '';
const KONNECT_RECEIVER_WALLET_ID = process.env.KONNECT_RECEIVER_WALLET_ID || '';
const KONNECT_CURRENCY = process.env.KONNECT_CURRENCY || 'TND';
const KONNECT_PAYMENT_LIFESPAN = Number(process.env.KONNECT_PAYMENT_LIFESPAN || 30);

const DEFAULT_APP_SETTINGS = Object.freeze({
  businessName: 'The Local Cafe',
  currencyCode: 'TND',
  taxRate: '0',
  serviceCharge: '0',
  defaultLanguage: 'en',
  enableOrderNotifications: 'true',
});

const ALLOWED_APP_SETTING_KEYS = new Set(Object.keys(DEFAULT_APP_SETTINGS));

const POSITIVE_PAYMENT_STATUSES = ['success', 'successful', 'succeeded', 'completed', 'paid', 'accepted'];
const NEGATIVE_PAYMENT_STATUSES = ['fail', 'failed', 'error', 'cancel', 'canceled', 'cancelled', 'rejected', 'expired', 'unpaid'];

function hasValidSuperAdminPass(req) {
  return String(req.body?.superAdminPass ?? '') === superAdminPass;
}

function hasValidAdminPass(req) {
  return String(req.body?.adminPass ?? '') === adminPass;
}

function hasValidOrderEditPass(req) {
  const pass = String(req.body?.adminPass ?? '');
  return pass === adminPass || pass === superAdminPass;
}

function normalizeAppSettingValue(key, value) {
  if (key === 'enableOrderNotifications') {
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    return String(value).trim().toLowerCase() === 'true' ? 'true' : 'false';
  }

  if (key === 'defaultLanguage') {
    return String(value).trim().toLowerCase() === 'fr' ? 'fr' : 'en';
  }

  if (key === 'taxRate' || key === 'serviceCharge') {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return '0';
    }
    return String(Math.max(0, numericValue));
  }

  return String(value ?? '').trim();
}

function mapSettingsRowsToPayload(rows) {
  const mapped = { ...DEFAULT_APP_SETTINGS };

  for (const row of rows) {
    const key = String(row.setting_key || '').replace(/^app\./, '');
    if (!ALLOWED_APP_SETTING_KEYS.has(key)) {
      continue;
    }
    mapped[key] = String(row.setting_value ?? DEFAULT_APP_SETTINGS[key]);
  }

  return {
    businessName: mapped.businessName,
    currencyCode: mapped.currencyCode,
    taxRate: Number(mapped.taxRate) || 0,
    serviceCharge: Number(mapped.serviceCharge) || 0,
    defaultLanguage: mapped.defaultLanguage === 'fr' ? 'fr' : 'en',
    enableOrderNotifications: mapped.enableOrderNotifications === 'true',
  };
}

function buildMenuItemSnapshot(row) {
  return {
    name: String(row?.name ?? ''),
    description: String(row?.description ?? ''),
    price: Number(row?.price ?? 0),
    category: String(row?.category ?? ''),
    image: String(row?.image_url ?? ''),
    available: Boolean(row?.available),
    isNew: Boolean(row?.is_new),
  };
}

function getChangedMenuFields(beforeSnapshot, afterSnapshot) {
  const trackedFields = ['name', 'description', 'price', 'category', 'image', 'available', 'isNew'];
  const changedFields = [];

  for (const field of trackedFields) {
    if (beforeSnapshot[field] !== afterSnapshot[field]) {
      changedFields.push(field);
    }
  }

  return changedFields;
}

function pickValuesForFields(snapshot, fields) {
  const output = {};
  for (const field of fields) {
    output[field] = snapshot[field];
  }
  return output;
}

async function writeMenuAuditLog(connection, payload) {
  const {
    eventType,
    menuItemId,
    menuItemName,
    changedFields = [],
    previousValues = null,
    newValues = null,
  } = payload;

  await connection.query(
    `INSERT INTO menu_audit_logs (
      event_type,
      menu_item_id,
      menu_item_name,
      changed_fields,
      previous_values,
      new_values
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      eventType,
      menuItemId,
      menuItemName,
      JSON.stringify(changedFields),
      previousValues ? JSON.stringify(previousValues) : null,
      newValues ? JSON.stringify(newValues) : null,
    ]
  );
}

function isAllowedMenuImageUrl(imageUrl) {
  if (typeof imageUrl !== 'string') return false;
  const trimmed = imageUrl.trim();
  if (!trimmed) return false;
  const cleanPath = trimmed.split('#')[0].split('?')[0];
  return /\.(jpe?g|png)$/i.test(cleanPath);
}

function hasKonnectConfiguration() {
  return Boolean(KONNECT_API_KEY && KONNECT_RECEIVER_WALLET_ID);
}

function getFrontendBaseUrl(req) {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
  if (origin && /^https?:\/\//i.test(origin)) {
    return origin.replace(/\/+$/, '');
  }
  return FRONTEND_URL.replace(/\/+$/, '');
}

function getRequestBaseUrl(req) {
  const configuredPublicUrl = String(process.env.BACKEND_PUBLIC_URL || '').trim();
  if (configuredPublicUrl && /^https?:\/\//i.test(configuredPublicUrl)) {
    return configuredPublicUrl.replace(/\/+$/, '');
  }

  const forwardedProtoHeader = req.headers['x-forwarded-proto'];
  const forwardedProto = Array.isArray(forwardedProtoHeader)
    ? forwardedProtoHeader[0]
    : String(forwardedProtoHeader || '').split(',')[0].trim();
  const protocol = forwardedProto || req.protocol || 'https';

  return `${protocol}://${req.get('host')}`;
}

function normalizePublicAssetUrl(imageUrl, req) {
  const raw = String(imageUrl ?? '').trim();
  if (!raw) return '';

  if (raw.startsWith('data:')) {
    return raw;
  }

  const baseUrl = getRequestBaseUrl(req);

  if (raw.startsWith('/uploads/')) {
    return `${baseUrl}${raw}`;
  }

  if (raw.startsWith('uploads/')) {
    return `${baseUrl}/${raw}`;
  }

  try {
    const parsed = new URL(raw);
    const isLocalHost = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i.test(parsed.hostname);
    if (isLocalHost && parsed.pathname.startsWith('/uploads/')) {
      return `${baseUrl}${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // Keep original value for non-URL strings.
  }

  return raw;
}

function normalizePaymentStatus(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return '';
  return normalized;
}

function parseKonnectResponseBody(text) {
  if (!text || !text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function extractKonnectPaymentRef(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const candidates = [
    payload.paymentRef,
    payload.payment_ref,
    payload.paymentId,
    payload.payment_id,
    payload.id,
    payload.reference,
    payload.ref,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return '';
}

function extractKonnectPayUrl(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const candidates = [
    payload.payUrl,
    payload.pay_url,
    payload.paymentUrl,
    payload.payment_url,
    payload.url,
    payload.link,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return '';
}

function isKonnectPaymentSuccessful(payload) {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const statusCandidates = [
    payload.status,
    payload.paymentStatus,
    payload.payment_status,
    payload.transactionStatus,
    payload.transaction_status,
    payload.currentStatus,
    payload.current_status,
    payload?.payment?.status,
    payload?.transaction?.status,
    payload?.data?.status,
  ];

  if (Array.isArray(payload.transactions)) {
    statusCandidates.push(...payload.transactions.map((transaction) => transaction?.status));
  }

  const normalized = statusCandidates
    .map(normalizePaymentStatus)
    .filter(Boolean);

  if (!normalized.length) {
    return false;
  }

  const hasNegativeStatus = normalized.some((status) => NEGATIVE_PAYMENT_STATUSES.some((value) => status.includes(value)));
  if (hasNegativeStatus) {
    return false;
  }

  return normalized.some((status) => POSITIVE_PAYMENT_STATUSES.some((value) => status.includes(value)));
}

async function ensureSchema() {
  const connection = await pool.getConnection();
  try {
    await connection.query(
      `CREATE TABLE IF NOT EXISTS cafe_tables (
        id VARCHAR(50) PRIMARY KEY,
        table_number INT NOT NULL UNIQUE,
        qr_token VARCHAR(100) NOT NULL UNIQUE,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_table_number (table_number)
      )`
    );

    const [tableNumberColumn] = await connection.query("SHOW COLUMNS FROM orders LIKE 'table_number'");
    if (!Array.isArray(tableNumberColumn) || tableNumberColumn.length === 0) {
      await connection.query('ALTER TABLE orders ADD COLUMN table_number INT NULL AFTER status');
      await connection.query('CREATE INDEX idx_table_number ON orders(table_number)');
    }

    const [menuIsBestSellerColumn] = await connection.query("SHOW COLUMNS FROM menu_items LIKE 'is_best_seller'");
    if (!Array.isArray(menuIsBestSellerColumn) || menuIsBestSellerColumn.length === 0) {
      await connection.query('ALTER TABLE menu_items ADD COLUMN is_best_seller BOOLEAN DEFAULT false AFTER image_url');
    }

    const [menuIsNewColumn] = await connection.query("SHOW COLUMNS FROM menu_items LIKE 'is_new'");
    if (!Array.isArray(menuIsNewColumn) || menuIsNewColumn.length === 0) {
      await connection.query('ALTER TABLE menu_items ADD COLUMN is_new BOOLEAN DEFAULT false AFTER is_best_seller');
    }

    await connection.query(
      `CREATE TABLE IF NOT EXISTS offers (
        id VARCHAR(50) PRIMARY KEY,
        type VARCHAR(20) NOT NULL DEFAULT 'percentage',
        value DECIMAL(10, 2) NOT NULL DEFAULT 0,
        description VARCHAR(255) NOT NULL,
        image_url VARCHAR(500) NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`
    );

    const [offerTypeColumn] = await connection.query("SHOW COLUMNS FROM offers LIKE 'type'");
    if (!Array.isArray(offerTypeColumn) || offerTypeColumn.length === 0) {
      await connection.query("ALTER TABLE offers ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'percentage' AFTER id");
    }

    const [offerValueColumn] = await connection.query("SHOW COLUMNS FROM offers LIKE 'value'");
    if (!Array.isArray(offerValueColumn) || offerValueColumn.length === 0) {
      await connection.query('ALTER TABLE offers ADD COLUMN value DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER type');
    }

    const [offerImageColumn] = await connection.query("SHOW COLUMNS FROM offers LIKE 'image_url'");
    if (!Array.isArray(offerImageColumn) || offerImageColumn.length === 0) {
      await connection.query('ALTER TABLE offers ADD COLUMN image_url VARCHAR(500) NULL AFTER description');
    }

    const [offerDiscountPercentageColumn] = await connection.query("SHOW COLUMNS FROM offers LIKE 'discount_percentage'");
    const [offerDiscountAmountColumn] = await connection.query("SHOW COLUMNS FROM offers LIKE 'discount_amount'");
    if (Array.isArray(offerDiscountPercentageColumn) && offerDiscountPercentageColumn.length > 0) {
      await connection.query(
        `UPDATE offers
         SET type = 'percentage', value = COALESCE(discount_percentage, value)
         WHERE discount_percentage IS NOT NULL`
      );
    }
    if (Array.isArray(offerDiscountAmountColumn) && offerDiscountAmountColumn.length > 0) {
      await connection.query(
        `UPDATE offers
         SET type = 'fixed', value = COALESCE(discount_amount, value)
         WHERE discount_amount IS NOT NULL`
      );
    }

    await connection.query(
      `CREATE TABLE IF NOT EXISTS offer_items (
        id VARCHAR(50) PRIMARY KEY,
        offer_id VARCHAR(50) NOT NULL,
        menu_item_id VARCHAR(50) NOT NULL,
        FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE,
        FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
        INDEX idx_offer_id (offer_id),
        INDEX idx_offer_menu_item (menu_item_id)
      )`
    );

    const [offerItemsIdColumn] = await connection.query("SHOW COLUMNS FROM offer_items LIKE 'id'");
    if (!Array.isArray(offerItemsIdColumn) || offerItemsIdColumn.length === 0) {
      await connection.query('ALTER TABLE offer_items ADD COLUMN id VARCHAR(50) NULL FIRST');
      await connection.query("UPDATE offer_items SET id = CONCAT('offer-item-', REPLACE(UUID(), '-', '')) WHERE id IS NULL OR id = ''");
    }

    const [offerItemsUniqueIndex] = await connection.query("SHOW INDEX FROM offer_items WHERE Key_name = 'uq_offer_item_pair'");
    if (!Array.isArray(offerItemsUniqueIndex) || offerItemsUniqueIndex.length === 0) {
      await connection.query('ALTER TABLE offer_items ADD UNIQUE INDEX uq_offer_item_pair (offer_id, menu_item_id)');
    }

    await connection.query(
      `CREATE TABLE IF NOT EXISTS bundles (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        original_price DECIMAL(10, 2) NOT NULL,
        image_url VARCHAR(500) NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`
    );

    await connection.query(
      `CREATE TABLE IF NOT EXISTS bundle_items (
        id VARCHAR(50) PRIMARY KEY,
        bundle_id VARCHAR(50) NOT NULL,
        menu_item_id VARCHAR(50) NOT NULL,
        FOREIGN KEY (bundle_id) REFERENCES bundles(id) ON DELETE CASCADE,
        FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
        INDEX idx_bundle_id (bundle_id),
        INDEX idx_bundle_menu_item (menu_item_id)
      )`
    );

    const [bundleItemsUniqueIndex] = await connection.query("SHOW INDEX FROM bundle_items WHERE Key_name = 'uq_bundle_item_pair'");
    if (!Array.isArray(bundleItemsUniqueIndex) || bundleItemsUniqueIndex.length === 0) {
      await connection.query('ALTER TABLE bundle_items ADD UNIQUE INDEX uq_bundle_item_pair (bundle_id, menu_item_id)');
    }

    const [paymentMethodColumn] = await connection.query("SHOW COLUMNS FROM orders LIKE 'payment_method'");
    if (!Array.isArray(paymentMethodColumn) || paymentMethodColumn.length === 0) {
      await connection.query('ALTER TABLE orders ADD COLUMN payment_method VARCHAR(50) NULL AFTER table_number');
    }

    const [paymentProviderColumn] = await connection.query("SHOW COLUMNS FROM orders LIKE 'payment_provider'");
    if (!Array.isArray(paymentProviderColumn) || paymentProviderColumn.length === 0) {
      await connection.query('ALTER TABLE orders ADD COLUMN payment_provider VARCHAR(50) NULL AFTER payment_method');
    }

    const [paymentReferenceColumn] = await connection.query("SHOW COLUMNS FROM orders LIKE 'payment_reference'");
    if (!Array.isArray(paymentReferenceColumn) || paymentReferenceColumn.length === 0) {
      await connection.query('ALTER TABLE orders ADD COLUMN payment_reference VARCHAR(120) NULL AFTER payment_provider');
      await connection.query('CREATE INDEX idx_payment_reference ON orders(payment_reference)');
    }

    const [paymentStatusColumn] = await connection.query("SHOW COLUMNS FROM orders LIKE 'payment_status'");
    if (!Array.isArray(paymentStatusColumn) || paymentStatusColumn.length === 0) {
      await connection.query('ALTER TABLE orders ADD COLUMN payment_status VARCHAR(50) NULL AFTER payment_reference');
    }

    await connection.query(
      `CREATE TABLE IF NOT EXISTS app_settings (
        setting_key VARCHAR(100) PRIMARY KEY,
        setting_value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`
    );

    await connection.query(
      `CREATE TABLE IF NOT EXISTS menu_audit_logs (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        event_type VARCHAR(40) NOT NULL,
        menu_item_id VARCHAR(50) NOT NULL,
        menu_item_name VARCHAR(255) NOT NULL,
        changed_fields TEXT,
        previous_values TEXT,
        new_values TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_menu_audit_created_at (created_at),
        INDEX idx_menu_audit_item_id (menu_item_id)
      )`
    );
  } finally {
    connection.release();
  }
}

async function loadRuntimeSettings() {
  const connection = await pool.getConnection();
  try {
    // Load super admin pass
    const [superRows] = await connection.query(
      `SELECT setting_value FROM app_settings WHERE setting_key = 'security.super_admin_pass' LIMIT 1`
    );
    if (Array.isArray(superRows) && superRows.length > 0) {
      const savedPass = String(superRows[0].setting_value ?? '').trim();
      if (savedPass) superAdminPass = savedPass;
    } else {
      await connection.query(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES ('security.super_admin_pass', ?) ON DUPLICATE KEY UPDATE setting_value = setting_value`,
        [superAdminPass]
      );
    }

    // Load admin (dashboard access) pass
    const [adminRows] = await connection.query(
      `SELECT setting_value FROM app_settings WHERE setting_key = 'security.admin_pass' LIMIT 1`
    );
    if (Array.isArray(adminRows) && adminRows.length > 0) {
      const savedAdminPass = String(adminRows[0].setting_value ?? '').trim();
      if (savedAdminPass) adminPass = savedAdminPass;
    } else {
      await connection.query(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES ('security.admin_pass', ?) ON DUPLICATE KEY UPDATE setting_value = setting_value`,
        [adminPass]
      );
    }
  } finally {
    connection.release();
  }
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.post('/api/uploads/menu-image', (req, res) => {
  menuImageUpload.single('image')(req, res, (error) => {
    if (error) {
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Image file is too large. Max size is 10MB.' });
      }
      return res.status(400).json({ error: error.message || 'Failed to upload image' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    const url = `${getRequestBaseUrl(req)}/uploads/menu-images/${req.file.filename}`;
    return res.status(201).json({ url });
  });
});

app.post('/api/uploads/offer-carousel', (req, res) => {
  offerCarouselUpload.single('image')(req, res, (error) => {
    if (error) {
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Image file is too large. Max size is 10MB.' });
      }
      return res.status(400).json({ error: error.message || 'Failed to upload offer carousel image' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Carousel image file is required' });
    }

    const url = `${getRequestBaseUrl(req)}/uploads/offer-carousel/${req.file.filename}`;
    return res.status(201).json({ url });
  });
});

app.post('/api/payments/konnect/initiate', async (req, res) => {
  if (!hasKonnectConfiguration()) {
    return res.status(500).json({
      error: 'Konnect is not configured. Set KONNECT_API_KEY and KONNECT_RECEIVER_WALLET_ID.',
    });
  }

  try {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    const frontendBaseUrl = getFrontendBaseUrl(req);
    const generatedOrderId =
      typeof req.body?.orderId === 'string' && req.body.orderId.trim()
        ? req.body.orderId.trim()
        : `konnect-order-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const description =
      typeof req.body?.description === 'string' && req.body.description.trim()
        ? req.body.description.trim().slice(0, 255)
        : `Tawla Scan order ${generatedOrderId}`;

    const webhookUrl =
      typeof process.env.KONNECT_WEBHOOK_URL === 'string' && process.env.KONNECT_WEBHOOK_URL.trim()
        ? process.env.KONNECT_WEBHOOK_URL.trim()
        : `${req.protocol}://${req.get('host')}/api/payments/konnect/webhook`;

    const payload = {
      receiverWalletId: KONNECT_RECEIVER_WALLET_ID,
      token: KONNECT_CURRENCY,
      amount: Number(amount.toFixed(3)),
      type: 'immediate',
      orderId: generatedOrderId,
      description,
      checkoutForm: true,
      acceptedPaymentMethods: ['wallet', 'bank_card', 'e-DINAR'],
      lifespan: Number.isFinite(KONNECT_PAYMENT_LIFESPAN) ? KONNECT_PAYMENT_LIFESPAN : 30,
      webhook: webhookUrl,
      successUrl: `${frontendBaseUrl}/checkout?konnect=success`,
      failUrl: `${frontendBaseUrl}/checkout?konnect=failed`,
    };

    const response = await fetch(`${KONNECT_API_BASE_URL}/payments/init-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': KONNECT_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const bodyText = await response.text();
    const responsePayload = parseKonnectResponseBody(bodyText);

    if (!response.ok) {
      const providerError =
        (typeof responsePayload?.error === 'string' && responsePayload.error) ||
        (typeof responsePayload?.message === 'string' && responsePayload.message) ||
        `Konnect init request failed with status ${response.status}`;
      return res.status(response.status).json({ error: providerError, details: responsePayload });
    }

    const payUrl = extractKonnectPayUrl(responsePayload);
    const paymentRef = extractKonnectPaymentRef(responsePayload);

    if (!payUrl || !paymentRef) {
      return res.status(502).json({ error: 'Konnect response did not include payUrl/paymentRef', details: responsePayload });
    }

    return res.status(201).json({
      payUrl,
      paymentRef,
      paymentId: responsePayload.paymentId || responsePayload.id || paymentRef,
      orderId: generatedOrderId,
    });
  } catch (error) {
    console.error('Error initiating Konnect payment:', error);
    return res.status(500).json({ error: 'Failed to initiate Konnect payment' });
  }
});

app.get('/api/payments/konnect/:paymentRef', async (req, res) => {
  if (!hasKonnectConfiguration()) {
    return res.status(500).json({
      error: 'Konnect is not configured. Set KONNECT_API_KEY and KONNECT_RECEIVER_WALLET_ID.',
    });
  }

  try {
    const paymentRef = String(req.params?.paymentRef ?? '').trim();
    if (!paymentRef) {
      return res.status(400).json({ error: 'paymentRef is required' });
    }

    const response = await fetch(`${KONNECT_API_BASE_URL}/payments/${encodeURIComponent(paymentRef)}`, {
      method: 'GET',
      headers: {
        'x-api-key': KONNECT_API_KEY,
      },
    });

    const bodyText = await response.text();
    const payload = parseKonnectResponseBody(bodyText);

    if (!response.ok) {
      const providerError =
        (typeof payload?.error === 'string' && payload.error) ||
        (typeof payload?.message === 'string' && payload.message) ||
        `Konnect payment details request failed with status ${response.status}`;
      return res.status(response.status).json({ error: providerError, details: payload });
    }

    return res.json({
      paymentRef,
      status: payload.status || payload.paymentStatus || payload.payment_status || '',
      isPaid: isKonnectPaymentSuccessful(payload),
      details: payload,
    });
  } catch (error) {
    console.error('Error checking Konnect payment:', error);
    return res.status(500).json({ error: 'Failed to check Konnect payment' });
  }
});

app.get('/api/payments/konnect/webhook', (req, res) => {
  const paymentRef = String(req.query?.payment_ref ?? '').trim();
  if (!paymentRef) {
    return res.status(400).json({ error: 'payment_ref is required' });
  }

  // Konnect triggers webhook as GET with payment_ref; details can be fetched via /api/payments/konnect/:paymentRef.
  return res.json({ received: true, paymentRef });
});

// ===== MENU ITEMS =====
app.get('/api/menu-items', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT m.id,
              m.name,
              m.description,
              m.price,
              m.category,
              COALESCE(m.image_url, '') AS image,
              m.available,
              CASE
                WHEN COALESCE(best_seller_source.max_quantity, 0) > 0
                  AND COALESCE(item_sales.total_quantity, 0) = COALESCE(best_seller_source.max_quantity, 0)
                THEN 1
                ELSE 0
              END AS is_best_seller,
              COALESCE(m.is_new, 0) AS is_new
       FROM menu_items m
       LEFT JOIN (
         SELECT oi.menu_item_id, SUM(oi.quantity) AS total_quantity
         FROM order_items oi
         INNER JOIN orders o ON o.id = oi.order_id
         WHERE o.status = 'completed'
         GROUP BY oi.menu_item_id
       ) item_sales ON item_sales.menu_item_id = m.id
       CROSS JOIN (
         SELECT COALESCE(MAX(item_totals.total_quantity), 0) AS max_quantity
         FROM (
           SELECT SUM(oi.quantity) AS total_quantity
           FROM order_items oi
           INNER JOIN orders o ON o.id = oi.order_id
           WHERE o.status = 'completed'
           GROUP BY oi.menu_item_id
         ) item_totals
       ) best_seller_source
       WHERE m.available = true
       ORDER BY is_best_seller DESC, is_new DESC, m.category, m.name`
    );
    connection.release();

    const normalizedRows = Array.isArray(rows)
      ? rows.map((row) => ({
          ...row,
          image: normalizePublicAssetUrl(row.image, req),
        }))
      : [];

    res.json(normalizedRows);
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ error: 'Failed to fetch menu items' });
  }
});

app.get('/api/menu-items/audit-logs', async (req, res) => {
  let connection;
  try {
    const requestedLimit = Number(req.query?.limit);
    const limit = Number.isInteger(requestedLimit) ? Math.max(1, Math.min(200, requestedLimit)) : 40;

    connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT id,
              event_type AS eventType,
              menu_item_id AS menuItemId,
              menu_item_name AS menuItemName,
              changed_fields AS changedFields,
              previous_values AS previousValues,
              new_values AS newValues,
              created_at AS createdAt
       FROM menu_audit_logs
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit]
    );

    return res.json(rows);
  } catch (error) {
    console.error('Error fetching menu audit logs:', error);
    return res.status(500).json({ error: 'Failed to fetch menu audit logs' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

app.post('/api/menu-items', async (req, res) => {
  let connection;
  try {
    const { id, name, description, price, category, image, isNew } = req.body;
    if (!name || !description || price === undefined || !category) {
      return res.status(400).json({ error: 'Missing required menu item fields' });
    }

    const normalizedImage = typeof image === 'string' ? image.trim() : '';
    if (normalizedImage && !isAllowedMenuImageUrl(normalizedImage)) {
      return res.status(400).json({ error: 'Image URL must end with .jpg, .jpeg, or .png' });
    }

    const menuItemId =
      typeof id === 'string' && id.trim()
        ? id.trim()
        : `item-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO menu_items (id, name, description, price, category, image_url, available, is_best_seller, is_new)
       VALUES (?, ?, ?, ?, ?, ?, true, 0, ?)`,
      [menuItemId, name, description, Number(price), category, normalizedImage || null, isNew ? 1 : 0]
    );

    const createdSnapshot = {
      name: String(name),
      description: String(description),
      price: Number(price),
      category: String(category),
      image: normalizedImage || '',
      available: true,
      isNew: Boolean(isNew),
    };

    await writeMenuAuditLog(connection, {
      eventType: 'item_added',
      menuItemId,
      menuItemName: String(name),
      changedFields: ['name', 'description', 'price', 'category', 'image', 'available', 'isNew'],
      previousValues: null,
      newValues: createdSnapshot,
    });

    return res.status(201).json({
      id: menuItemId,
      name,
      description,
      price: Number(price),
      category,
      image: normalizedImage || '',
      available: true,
      isBestSeller: false,
      isNew: !!isNew,
    });
  } catch (error) {
    console.error('Error creating menu item:', error);
    return res.status(500).json({ error: 'Failed to create menu item' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

app.put('/api/menu-items/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { name, description, price, category, image, available, isNew } = req.body;
    const hasImageField = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'image');
    const hasIsNew = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'isNew');
    let normalizedImage = '';

    if (hasImageField) {
      normalizedImage = typeof image === 'string' ? image.trim() : '';
      if (!normalizedImage || !isAllowedMenuImageUrl(normalizedImage)) {
        return res.status(400).json({ error: 'Image URL must end with .jpg, .jpeg, or .png' });
      }
    }

    connection = await pool.getConnection();

    const [beforeRows] = await connection.query(
      `SELECT id, name, description, price, category, image_url, available, is_new
       FROM menu_items
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (!Array.isArray(beforeRows) || beforeRows.length === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    const beforeSnapshot = buildMenuItemSnapshot(beforeRows[0]);

    const [result] = await connection.query(
      `UPDATE menu_items
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           price = COALESCE(?, price),
           category = COALESCE(?, category),
           image_url = COALESCE(?, image_url),
           available = COALESCE(?, available),
           is_new = COALESCE(?, is_new)
       WHERE id = ?`,
      [
        name ?? null,
        description ?? null,
        price !== undefined ? Number(price) : null,
        category ?? null,
        hasImageField ? normalizedImage : null,
        available ?? null,
        hasIsNew ? (isNew ? 1 : 0) : null,
        id,
      ]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    const [afterRows] = await connection.query(
      `SELECT id, name, description, price, category, image_url, available, is_new
       FROM menu_items
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (Array.isArray(afterRows) && afterRows.length > 0) {
      const afterSnapshot = buildMenuItemSnapshot(afterRows[0]);
      const changedFields = getChangedMenuFields(beforeSnapshot, afterSnapshot);

      if (changedFields.length > 0) {
        await writeMenuAuditLog(connection, {
          eventType: changedFields.includes('price') ? 'price_changed' : 'item_updated',
          menuItemId: id,
          menuItemName: afterSnapshot.name || beforeSnapshot.name,
          changedFields,
          previousValues: pickValuesForFields(beforeSnapshot, changedFields),
          newValues: pickValuesForFields(afterSnapshot, changedFields),
        });
      }
    }

    return res.json({ success: true, id });
  } catch (error) {
    console.error('Error updating menu item:', error);
    return res.status(500).json({ error: 'Failed to update menu item' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

app.delete('/api/menu-items/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();

    const [beforeRows] = await connection.query(
      `SELECT id, name, description, price, category, image_url, available, is_new
       FROM menu_items
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (!Array.isArray(beforeRows) || beforeRows.length === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    const beforeSnapshot = buildMenuItemSnapshot(beforeRows[0]);

    const [result] = await connection.query(
      'UPDATE menu_items SET available = false WHERE id = ?',
      [id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    await writeMenuAuditLog(connection, {
      eventType: 'item_deleted',
      menuItemId: id,
      menuItemName: beforeSnapshot.name,
      changedFields: ['available'],
      previousValues: { available: beforeSnapshot.available },
      newValues: { available: false },
    });

    return res.json({ success: true, id });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    return res.status(500).json({ error: 'Failed to delete menu item' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// ===== OFFERS =====
app.get('/api/offers', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT o.*, GROUP_CONCAT(oi.menu_item_id) as item_ids
       FROM offers o
       LEFT JOIN offer_items oi ON o.id = oi.offer_id
       GROUP BY o.id
       ORDER BY o.created_at DESC`
    );
    connection.release();
    res.json(rows.map(offer => ({
      id: offer.id,
      type: offer.type,
      value: Number(offer.value),
      itemIds: offer.item_ids ? offer.item_ids.split(',').filter(Boolean) : [],
      description: offer.description,
      image: normalizePublicAssetUrl(offer.image_url, req),
      active: Boolean(offer.active),
    })));
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

app.post('/api/offers', async (req, res) => {
  try {
    const { type, value, itemIds, description, image, active } = req.body;
    if (!type || !value || !description || !image) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const connection = await pool.getConnection();
    const offerId = `offer-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    await connection.query(
      `INSERT INTO offers (id, type, value, description, image_url, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [offerId, type, value, description, image, active ? 1 : 0]
    );
    if (Array.isArray(itemIds) && itemIds.length > 0) {
      for (const itemId of itemIds) {
        await connection.query(
          `INSERT IGNORE INTO offer_items (id, offer_id, menu_item_id) VALUES (?, ?, ?)`,
          [`offer-item-${Date.now()}-${Math.floor(Math.random() * 100000)}`, offerId, itemId]
        );
      }
    }
    connection.release();
    res.status(201).json({ id: offerId });
  } catch (error) {
    console.error('Error creating offer:', error);
    res.status(500).json({ error: 'Failed to create offer' });
  }
});

app.put('/api/offers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, value, itemIds, description, image, active } = req.body;
    const connection = await pool.getConnection();
    await connection.query(
      `UPDATE offers SET type = ?, value = ?, description = ?, image_url = ?, active = ? WHERE id = ?`,
      [type, value, description, image, active ? 1 : 0, id]
    );
    await connection.query(`DELETE FROM offer_items WHERE offer_id = ?`, [id]);
    if (Array.isArray(itemIds) && itemIds.length > 0) {
      for (const itemId of itemIds) {
        await connection.query(
          `INSERT IGNORE INTO offer_items (id, offer_id, menu_item_id) VALUES (?, ?, ?)`,
          [`offer-item-${Date.now()}-${Math.floor(Math.random() * 100000)}`, id, itemId]
        );
      }
    }
    connection.release();
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating offer:', error);
    res.status(500).json({ error: 'Failed to update offer' });
  }
});

app.delete('/api/offers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    await connection.query(`DELETE FROM offer_items WHERE offer_id = ?`, [id]);
    await connection.query(`DELETE FROM offers WHERE id = ?`, [id]);
    connection.release();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting offer:', error);
    res.status(500).json({ error: 'Failed to delete offer' });
  }
});

// ===== BUNDLES =====
app.get('/api/bundles', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT b.*, GROUP_CONCAT(bi.menu_item_id) AS item_ids
       FROM bundles b
       LEFT JOIN bundle_items bi ON b.id = bi.bundle_id
       WHERE b.active = true
       GROUP BY b.id
       ORDER BY b.created_at DESC`
    );
    connection.release();

    return res.json(rows.map((bundle) => ({
      id: bundle.id,
      name: bundle.name,
      description: bundle.description,
      price: Number(bundle.price),
      originalPrice: Number(bundle.original_price),
      items: bundle.item_ids ? String(bundle.item_ids).split(',').filter(Boolean) : [],
      image: normalizePublicAssetUrl(bundle.image_url, req),
      active: Boolean(bundle.active),
    })));
  } catch (error) {
    console.error('Error fetching bundles:', error);
    return res.status(500).json({ error: 'Failed to fetch bundles' });
  }
});

app.post('/api/bundles', async (req, res) => {
  try {
    const { name, description, price, originalPrice, items, image, active } = req.body;

    if (!name || !description || price === undefined || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Missing required bundle fields' });
    }

    const bundleId = `bundle-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const connection = await pool.getConnection();

    await connection.query(
      `INSERT INTO bundles (id, name, description, price, original_price, image_url, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        bundleId,
        String(name).trim(),
        String(description).trim(),
        Number(price),
        Number(originalPrice ?? price),
        typeof image === 'string' ? image.trim() : '',
        active === undefined ? 1 : (active ? 1 : 0),
      ]
    );

    for (const itemId of items) {
      await connection.query(
        `INSERT IGNORE INTO bundle_items (id, bundle_id, menu_item_id) VALUES (?, ?, ?)`,
        [`bundle-item-${Date.now()}-${Math.floor(Math.random() * 100000)}`, bundleId, String(itemId)]
      );
    }

    connection.release();
    return res.status(201).json({ id: bundleId });
  } catch (error) {
    console.error('Error creating bundle:', error);
    return res.status(500).json({ error: 'Failed to create bundle' });
  }
});

app.put('/api/bundles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, originalPrice, items, image, active } = req.body;
    const connection = await pool.getConnection();

    await connection.query(
      `UPDATE bundles
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           price = COALESCE(?, price),
           original_price = COALESCE(?, original_price),
           image_url = COALESCE(?, image_url),
           active = COALESCE(?, active)
       WHERE id = ?`,
      [
        name ?? null,
        description ?? null,
        price !== undefined ? Number(price) : null,
        originalPrice !== undefined ? Number(originalPrice) : null,
        image !== undefined ? String(image).trim() : null,
        active !== undefined ? (active ? 1 : 0) : null,
        id,
      ]
    );

    if (Array.isArray(items)) {
      await connection.query('DELETE FROM bundle_items WHERE bundle_id = ?', [id]);
      for (const itemId of items) {
        await connection.query(
          `INSERT IGNORE INTO bundle_items (id, bundle_id, menu_item_id) VALUES (?, ?, ?)`,
          [`bundle-item-${Date.now()}-${Math.floor(Math.random() * 100000)}`, id, String(itemId)]
        );
      }
    }

    connection.release();
    return res.json({ success: true, id });
  } catch (error) {
    console.error('Error updating bundle:', error);
    return res.status(500).json({ error: 'Failed to update bundle' });
  }
});

app.delete('/api/bundles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    await connection.query('DELETE FROM bundle_items WHERE bundle_id = ?', [id]);
    const [result] = await connection.query('UPDATE bundles SET active = false WHERE id = ?', [id]);
    connection.release();

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    return res.json({ success: true, id });
  } catch (error) {
    console.error('Error deleting bundle:', error);
    return res.status(500).json({ error: 'Failed to delete bundle' });
  }
});

// ===== APP SETTINGS =====
app.post('/api/settings/app/read', async (req, res) => {
  if (!hasValidSuperAdminPass(req)) {
    return res.status(401).json({ error: 'Invalid super admin pass' });
  }

  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT setting_key, setting_value
       FROM app_settings
       WHERE setting_key LIKE 'app.%'`
    );
    connection.release();

    return res.json({ settings: mapSettingsRowsToPayload(Array.isArray(rows) ? rows : []) });
  } catch (error) {
    console.error('Error reading app settings:', error);
    return res.status(500).json({ error: 'Failed to read app settings' });
  }
});

app.patch('/api/settings/app', async (req, res) => {
  if (!hasValidSuperAdminPass(req)) {
    return res.status(401).json({ error: 'Invalid super admin pass' });
  }

  try {
    const payload = req.body?.settings;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'settings object is required' });
    }

    const updates = Object.entries(payload)
      .filter(([key]) => ALLOWED_APP_SETTING_KEYS.has(key))
      .map(([key, value]) => [key, normalizeAppSettingValue(key, value)]);

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid settings were provided' });
    }

    const connection = await pool.getConnection();
    for (const [key, value] of updates) {
      await connection.query(
        `INSERT INTO app_settings (setting_key, setting_value)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [`app.${key}`, value]
      );
    }

    const [rows] = await connection.query(
      `SELECT setting_key, setting_value
       FROM app_settings
       WHERE setting_key LIKE 'app.%'`
    );
    connection.release();

    return res.json({ success: true, settings: mapSettingsRowsToPayload(Array.isArray(rows) ? rows : []) });
  } catch (error) {
    console.error('Error updating app settings:', error);
    return res.status(500).json({ error: 'Failed to update app settings' });
  }
});

// Change super admin password (used for privileged API operations)
app.patch('/api/settings/super-admin-password', async (req, res) => {
  try {
    const currentPass = String(req.body?.currentPass ?? '');
    const newPass = String(req.body?.newPass ?? '');

    if (currentPass !== superAdminPass) {
      return res.status(401).json({ error: 'Current super admin password is incorrect' });
    }

    if (!newPass.trim() || newPass.trim().length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const updatedPass = newPass.trim();
    const connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO app_settings (setting_key, setting_value) VALUES ('security.super_admin_pass', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [updatedPass]
    );
    connection.release();

    superAdminPass = updatedPass;
    return res.json({ success: true });
  } catch (error) {
    console.error('Error updating super admin password:', error);
    return res.status(500).json({ error: 'Failed to update super admin password' });
  }
});

// Change admin password (used for dashboard login)
app.patch('/api/settings/admin-password', async (req, res) => {
  try {
    const currentPass = String(req.body?.currentPass ?? '');
    const newPass = String(req.body?.newPass ?? '');

    if (currentPass !== adminPass) {
      return res.status(401).json({ error: 'Current admin password is incorrect' });
    }

    if (!newPass.trim() || newPass.trim().length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const updatedPass = newPass.trim();
    const connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO app_settings (setting_key, setting_value) VALUES ('security.admin_pass', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [updatedPass]
    );
    connection.release();

    adminPass = updatedPass;
    return res.json({ success: true });
  } catch (error) {
    console.error('Error updating admin password:', error);
    return res.status(500).json({ error: 'Failed to update admin password' });
  }
});

// Verify admin (dashboard) password
app.post('/api/auth/admin-login', (req, res) => {
  const pass = String(req.body?.adminPass ?? '');
  if (pass === adminPass || pass === superAdminPass) {
    return res.json({ success: true });
  }
  return res.status(401).json({ error: 'Incorrect admin password' });
});

// Reset admin password using super admin pass (useful from login screen)
app.post('/api/auth/reset/admin-password', async (req, res) => {
  let connection;
  try {
    const providedSuperAdminPass = String(req.body?.superAdminPass ?? '');
    const newAdminPass = String(req.body?.newAdminPass ?? '');

    if (providedSuperAdminPass !== superAdminPass) {
      return res.status(401).json({ error: 'Super admin password is incorrect' });
    }

    if (!newAdminPass.trim() || newAdminPass.trim().length < 6) {
      return res.status(400).json({ error: 'New admin password must be at least 6 characters' });
    }

    const updatedPass = newAdminPass.trim();
    connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO app_settings (setting_key, setting_value)
       VALUES ('security.admin_pass', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [updatedPass]
    );

    adminPass = updatedPass;
    return res.json({ success: true });
  } catch (error) {
    console.error('Error resetting admin password:', error);
    return res.status(500).json({ error: 'Failed to reset admin password' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Public settings — no auth required
app.get('/api/settings/public', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT setting_key, setting_value
       FROM app_settings
       WHERE setting_key IN ('app.businessName', 'app.taxRate', 'app.serviceCharge', 'app.currencyCode')`
    );
    connection.release();
    const payload = mapSettingsRowsToPayload(Array.isArray(rows) ? rows : []);
    return res.json({
      businessName: String(payload.businessName || 'The Local Cafe').trim() || 'The Local Cafe',
      taxRate: Number(payload.taxRate) || 0,
      serviceCharge: Number(payload.serviceCharge) || 0,
      currencyCode: String(payload.currencyCode || 'TND').trim().toUpperCase() || 'TND',
    });
  } catch (error) {
    console.error('Error reading public settings:', error);
    return res.json({ businessName: 'The Local Cafe', taxRate: 0, serviceCharge: 0, currencyCode: 'TND' });
  }
});

// ===== TABLES =====
app.get('/api/tables', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT id,
              table_number AS tableNumber,
              qr_token AS qrToken,
              active
       FROM cafe_tables
       WHERE active = true
       ORDER BY table_number`
    );
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

app.post('/api/tables', async (req, res) => {
  if (!hasValidSuperAdminPass(req)) {
    return res.status(401).json({ error: 'Invalid super admin pass' });
  }

  const tableNumber = Number(req.body?.tableNumber);
  const providedQrToken = typeof req.body?.qrToken === 'string' ? req.body.qrToken.trim() : '';
  if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 500) {
    return res.status(400).json({ error: 'tableNumber must be a positive integer between 1 and 500' });
  }

  const qrToken = providedQrToken || `table-${tableNumber}`;
  const tableId = `table-${tableNumber}`;

  const connection = await pool.getConnection();
  try {
    await connection.query(
      `INSERT INTO cafe_tables (id, table_number, qr_token, active)
       VALUES (?, ?, ?, true)
       ON DUPLICATE KEY UPDATE
         table_number = VALUES(table_number),
         qr_token = VALUES(qr_token),
         active = true`,
      [tableId, tableNumber, qrToken]
    );

    const [rows] = await connection.query(
      `SELECT id,
              table_number AS tableNumber,
              qr_token AS qrToken,
              active
       FROM cafe_tables
       WHERE id = ?
       LIMIT 1`,
      [tableId]
    );

    connection.release();
    return res.status(201).json(rows[0]);
  } catch (error) {
    connection.release();
    if (error && error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Table number or QR token already exists' });
    }
    console.error('Error creating table:', error);
    return res.status(500).json({ error: 'Failed to create table' });
  }
});

app.patch('/api/tables/:id/qr', async (req, res) => {
  if (!hasValidSuperAdminPass(req)) {
    return res.status(401).json({ error: 'Invalid super admin pass' });
  }

  const { id } = req.params;
  const qrToken = typeof req.body?.qrToken === 'string' ? req.body.qrToken.trim() : '';
  if (!qrToken) {
    return res.status(400).json({ error: 'qrToken is required' });
  }

  const connection = await pool.getConnection();
  try {
    const [result] = await connection.query(
      'UPDATE cafe_tables SET qr_token = ? WHERE id = ? AND active = true',
      [qrToken, id]
    );

    if (!result.affectedRows) {
      connection.release();
      return res.status(404).json({ error: 'Table not found' });
    }

    const [rows] = await connection.query(
      `SELECT id,
              table_number AS tableNumber,
              qr_token AS qrToken,
              active
       FROM cafe_tables
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    connection.release();
    return res.json(rows[0]);
  } catch (error) {
    connection.release();
    if (error && error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'QR token already assigned to another table' });
    }
    console.error('Error updating QR token:', error);
    return res.status(500).json({ error: 'Failed to update QR token' });
  }
});

app.delete('/api/tables/:id', async (req, res) => {
  if (!hasValidSuperAdminPass(req)) {
    return res.status(401).json({ error: 'Invalid super admin pass' });
  }

  const { id } = req.params;
  const connection = await pool.getConnection();
  try {
    const [result] = await connection.query(
      'UPDATE cafe_tables SET active = false WHERE id = ? AND active = true',
      [id]
    );
    connection.release();

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Table not found' });
    }

    return res.json({ success: true, id });
  } catch (error) {
    connection.release();
    console.error('Error deleting table:', error);
    return res.status(500).json({ error: 'Failed to delete table' });
  }
});

app.post('/api/tables/generate', async (req, res) => {
  if (!hasValidSuperAdminPass(req)) {
    return res.status(401).json({ error: 'Invalid super admin pass' });
  }

  const count = Number(req.body?.count);
  if (!Number.isInteger(count) || count < 1 || count > 200) {
    return res.status(400).json({ error: 'count must be an integer between 1 and 200' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (let tableNumber = 1; tableNumber <= count; tableNumber += 1) {
      const id = `table-${tableNumber}`;
      const qrToken = `table-${tableNumber}`;
      await connection.query(
        `INSERT INTO cafe_tables (id, table_number, qr_token, active)
         VALUES (?, ?, ?, true)
         ON DUPLICATE KEY UPDATE
           qr_token = VALUES(qr_token),
           active = true`,
        [id, tableNumber, qrToken]
      );
    }

    // Deactivate extra tables if count is reduced.
    await connection.query('UPDATE cafe_tables SET active = (table_number <= ?)', [count]);

    const [rows] = await connection.query(
      `SELECT id,
              table_number AS tableNumber,
              qr_token AS qrToken,
              active
       FROM cafe_tables
       WHERE active = true
       ORDER BY table_number`
    );

    await connection.commit();
    connection.release();

    return res.json({
      count: rows.length,
      tables: rows,
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Error generating tables:', error);
    return res.status(500).json({ error: 'Failed to generate tables' });
  }
});

// ===== ORDERS =====
app.get('/api/orders', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT o.*, 
              GROUP_CONCAT(JSON_OBJECT('id', oi.id, 'orderItemId', oi.id, 'menuItemId', oi.menu_item_id, 'quantity', oi.quantity, 'price', oi.price, 'name', m.name)) as items_json
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN menu_items m ON oi.menu_item_id = m.id
       GROUP BY o.id
       ORDER BY o.timestamp DESC`
    );
    connection.release();
    
    // Parse items JSON
    const ordersWithItems = rows.map(order => ({
      ...order,
      items: order.items_json ? JSON.parse(`[${order.items_json}]`) : [],
    }));
    
    res.json(ordersWithItems);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.get('/api/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT o.*, 
              GROUP_CONCAT(JSON_OBJECT('id', oi.id, 'orderItemId', oi.id, 'menuItemId', oi.menu_item_id, 'quantity', oi.quantity, 'price', oi.price, 'name', m.name)) as items_json
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN menu_items m ON oi.menu_item_id = m.id
       WHERE o.id = ?
       GROUP BY o.id`,
      [orderId]
    );
    connection.release();
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const order = {
      ...rows[0],
      items: rows[0].items_json ? JSON.parse(`[${rows[0].items_json}]`) : [],
    };
    
    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const {
      id,
      items,
      total,
      status,
      tableNumber,
      paymentMethod,
      paymentProvider,
      paymentReference,
      paymentStatus,
    } = req.body;
    if (!Array.isArray(items) || items.length === 0 || total === undefined) {
      return res.status(400).json({ error: 'Invalid order payload' });
    }

    const normalizedTableNumber =
      tableNumber === undefined || tableNumber === null || tableNumber === ''
        ? null
        : Number(tableNumber);

    if (
      normalizedTableNumber !== null &&
      (!Number.isInteger(normalizedTableNumber) || normalizedTableNumber < 1)
    ) {
      return res.status(400).json({ error: 'tableNumber must be a positive integer when provided' });
    }

    const orderId =
      typeof id === 'string' && id.trim()
        ? id.trim()
        : `order-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const normalizedPaymentMethod =
      typeof paymentMethod === 'string' && paymentMethod.trim() ? paymentMethod.trim().slice(0, 50) : null;
    const normalizedPaymentProvider =
      typeof paymentProvider === 'string' && paymentProvider.trim() ? paymentProvider.trim().slice(0, 50) : null;
    const normalizedPaymentReference =
      typeof paymentReference === 'string' && paymentReference.trim() ? paymentReference.trim().slice(0, 120) : null;
    const normalizedPaymentStatus =
      typeof paymentStatus === 'string' && paymentStatus.trim() ? paymentStatus.trim().slice(0, 50) : null;

    const createHttpError = (statusCode, message) => {
      const error = new Error(message);
      error.statusCode = statusCode;
      return error;
    };

    const connection = await pool.getConnection();
    
    // Start transaction
    await connection.beginTransaction();
    
    try {
      if (normalizedTableNumber !== null) {
        const [tableRows] = await connection.query(
          'SELECT id FROM cafe_tables WHERE table_number = ? AND active = true LIMIT 1',
          [normalizedTableNumber]
        );
        if (!Array.isArray(tableRows) || tableRows.length === 0) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ error: 'Unknown or inactive table number' });
        }
      }

      // Insert order
      await connection.query(
        `INSERT INTO orders (
           id,
           total,
           status,
           table_number,
           payment_method,
           payment_provider,
           payment_reference,
           payment_status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          Number(total),
          status || 'pending',
          normalizedTableNumber,
          normalizedPaymentMethod,
          normalizedPaymentProvider,
          normalizedPaymentReference,
          normalizedPaymentStatus,
        ]
      );

      const [orderRows] = await connection.query(
        'SELECT order_number AS orderNumber FROM orders WHERE id = ?',
        [orderId]
      );
      const orderNumber = orderRows?.[0]?.orderNumber ?? null;
      
      // Insert order items
      for (const item of items) {
        const menuItemId = String(item?.id ?? '').trim();
        const itemName = String(item?.name ?? 'Item').trim() || 'Item';
        const itemQuantity = Number(item?.quantity);
        const itemPrice = Number(item?.price);
        const rawCategory = String(item?.category ?? '').trim().toLowerCase();
        const itemCategory = ['coffee', 'tea', 'food', 'milkshake', 'cocktail'].includes(rawCategory)
          ? rawCategory
          : 'food';

        if (!menuItemId) {
          throw createHttpError(400, 'Order item is missing id');
        }

        if (!Number.isFinite(itemQuantity) || itemQuantity <= 0) {
          throw createHttpError(400, `Invalid quantity for item ${itemName}`);
        }

        if (!Number.isFinite(itemPrice) || itemPrice < 0) {
          throw createHttpError(400, `Invalid price for item ${itemName}`);
        }

        const [menuRows] = await connection.query(
          'SELECT id FROM menu_items WHERE id = ? LIMIT 1',
          [menuItemId]
        );

        // Keep order insertion robust when client-side fallback items are used.
        if (!Array.isArray(menuRows) || menuRows.length === 0) {
          await connection.query(
            `INSERT INTO menu_items (id, name, description, price, category, image_url, available)
             VALUES (?, ?, '', ?, ?, NULL, false)
             ON DUPLICATE KEY UPDATE
               name = VALUES(name),
               price = VALUES(price),
               category = VALUES(category)`,
            [menuItemId, itemName, itemPrice, itemCategory]
          );
        }

        await connection.query(
          'INSERT INTO order_items (id, order_id, menu_item_id, quantity, price) VALUES (?, ?, ?, ?, ?)',
          [
            `order-item-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            orderId,
            menuItemId,
            itemQuantity,
            itemPrice,
          ]
        );
      }
      
      await connection.commit();
      connection.release();
      
      res.status(201).json({
        id: orderId,
        orderNumber,
        items,
        total: Number(total),
        status: status || 'pending',
        tableNumber: normalizedTableNumber,
        paymentMethod: normalizedPaymentMethod,
        paymentProvider: normalizedPaymentProvider,
        paymentReference: normalizedPaymentReference,
        paymentStatus: normalizedPaymentStatus,
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(error?.statusCode || 500).json({ error: error?.message || 'Failed to create order' });
  }
});

app.patch('/api/orders/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!VALID_ORDER_STATUSES.has(String(status))) {
      return res.status(400).json({ error: 'Invalid order status' });
    }
    
    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE orders SET status = ? WHERE id = ?',
      [status, orderId]
    );
    connection.release();
    
    res.json({ id: orderId, status });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

app.patch('/api/orders/:orderId', async (req, res) => {
  if (!hasValidOrderEditPass(req)) {
    return res.status(401).json({ error: 'Invalid admin code' });
  }

  try {
    const { orderId } = req.params;
    const rawStatus = req.body?.status;
    const hasStatus = rawStatus !== undefined;
    const hasTableNumber = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'tableNumber');
    const hasItems = Array.isArray(req.body?.items);

    if (!hasStatus && !hasTableNumber && !hasItems) {
      return res.status(400).json({ error: 'Provide at least one field: status, tableNumber, or items' });
    }

    let normalizedStatus = null;
    if (hasStatus) {
      const statusValue = String(rawStatus);
      if (!VALID_ORDER_STATUSES.has(statusValue)) {
        return res.status(400).json({ error: 'Invalid order status' });
      }
      normalizedStatus = statusValue;
    }

    let normalizedTableNumber = null;
    if (hasTableNumber) {
      const rawTableNumber = req.body.tableNumber;
      normalizedTableNumber =
        rawTableNumber === null || rawTableNumber === '' || rawTableNumber === undefined
          ? null
          : Number(rawTableNumber);

      if (
        normalizedTableNumber !== null &&
        (!Number.isInteger(normalizedTableNumber) || normalizedTableNumber < 1)
      ) {
        return res.status(400).json({ error: 'tableNumber must be a positive integer or null' });
      }
    }

    let normalizedItems = null;
    if (hasItems) {
      normalizedItems = req.body.items.map((item) => ({
        menuItemId: String(item?.menuItemId ?? item?.id ?? '').trim(),
        quantity: Number(item?.quantity),
      }));

      if (normalizedItems.length === 0) {
        return res.status(400).json({ error: 'Order must contain at least one item' });
      }

      const hasInvalidItem = normalizedItems.some(
        (item) => !item.menuItemId || !Number.isInteger(item.quantity) || item.quantity < 1
      );
      if (hasInvalidItem) {
        return res.status(400).json({ error: 'Each order item must include a valid menuItemId and positive integer quantity' });
      }
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      if (hasTableNumber && normalizedTableNumber !== null) {
        const [tableRows] = await connection.query(
          'SELECT id FROM cafe_tables WHERE table_number = ? AND active = true LIMIT 1',
          [normalizedTableNumber]
        );
        if (!Array.isArray(tableRows) || tableRows.length === 0) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ error: 'Unknown or inactive table number' });
        }
      }

      const [existingOrderRows] = await connection.query(
        `SELECT id
         FROM orders
         WHERE id = ?
         LIMIT 1`,
        [orderId]
      );

      if (!Array.isArray(existingOrderRows) || existingOrderRows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ error: 'Order not found' });
      }

      const setClauses = [];
      const values = [];

      if (hasItems && normalizedItems) {
        const [existingOrderItemsRows] = await connection.query(
          `SELECT menu_item_id AS menuItemId, price
           FROM order_items
           WHERE order_id = ?`,
          [orderId]
        );

        const existingPriceByMenuItemId = new Map(
          (Array.isArray(existingOrderItemsRows) ? existingOrderItemsRows : []).map((row) => [
            String(row.menuItemId),
            Number(row.price) || 0,
          ])
        );

        const requestedMenuItemIds = [...new Set(normalizedItems.map((item) => item.menuItemId))];
        const placeholders = requestedMenuItemIds.map(() => '?').join(', ');
        const [menuRows] = await connection.query(
          `SELECT id, name, price
           FROM menu_items
           WHERE id IN (${placeholders})`,
          requestedMenuItemIds
        );
        const [bundleRows] = await connection.query(
          `SELECT id, name, price
           FROM bundles
           WHERE id IN (${placeholders}) AND active = true`,
          requestedMenuItemIds
        );

        const priceableItemById = new Map(
          (Array.isArray(menuRows) ? menuRows : []).map((row) => [String(row.id), row])
        );
        for (const row of Array.isArray(bundleRows) ? bundleRows : []) {
          priceableItemById.set(String(row.id), row);
        }

        const missingMenuItemId = requestedMenuItemIds.find((itemId) => !priceableItemById.has(itemId));
        if (missingMenuItemId) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ error: `Unknown order item: ${missingMenuItemId}` });
        }

        await connection.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);

        let recalculatedTotal = 0;
        for (const item of normalizedItems) {
          const priceableRow = priceableItemById.get(item.menuItemId);
          const preservedPrice = existingPriceByMenuItemId.get(item.menuItemId);
          const unitPrice = Number.isFinite(preservedPrice) ? preservedPrice : Number(priceableRow.price) || 0;
          recalculatedTotal += unitPrice * item.quantity;

          await connection.query(
            'INSERT INTO order_items (id, order_id, menu_item_id, quantity, price) VALUES (?, ?, ?, ?, ?)',
            [
              `order-item-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
              orderId,
              item.menuItemId,
              item.quantity,
              unitPrice,
            ]
          );
        }

        setClauses.push('total = ?');
        values.push(Number(recalculatedTotal.toFixed(2)));
      }

      if (hasStatus) {
        setClauses.push('status = ?');
        values.push(normalizedStatus);
      }

      if (hasTableNumber) {
        setClauses.push('table_number = ?');
        values.push(normalizedTableNumber);
      }

      values.push(orderId);

      const [result] = await connection.query(
        `UPDATE orders SET ${setClauses.join(', ')} WHERE id = ?`,
        values
      );

      if (!result.affectedRows) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ error: 'Order not found' });
      }

      const [rows] = await connection.query(
        `SELECT id,
                order_number AS orderNumber,
                total,
                status,
                table_number AS tableNumber,
                timestamp
         FROM orders
         WHERE id = ?
         LIMIT 1`,
        [orderId]
      );

      await connection.commit();
      connection.release();
      return res.json(rows[0]);
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Error editing order with admin:', error);
    return res.status(500).json({ error: 'Failed to edit order' });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;

async function startServer() {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 MySQL Database: ${process.env.DB_NAME || 'tawla_scan'}`);
  });

  try {
    await ensureSchema();
    await loadRuntimeSettings();
    console.log('[DB] Schema and settings initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize database schema:', error);
    console.error('[DB] Server will keep running but DB-dependent routes may fail until DB is reachable.');
  }
}

void startServer();
