import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { OrdersView } from '../components/restaurant/OrdersView';
import { MenuManagement } from '../components/restaurant/MenuManagement';
import { BundlesManagement } from '../components/restaurant/BundlesManagement';
import { OffersManagement } from '../components/restaurant/OffersManagement';
import { TableManagement } from '../components/restaurant/TableManagement';
import { AppSettingsPanel } from '../components/restaurant/AppSettingsPanel';
import {
  Coffee,
  ChartNoAxesCombined,
  ClipboardList,
  Settings,
  QrCode,
  Mail,
  Menu as MenuIcon,
  X,
  SlidersHorizontal,
  Lock,
  LogOut,
  CircleDollarSign,
  ReceiptText,
  RotateCcw,
  ChefHat,
  Users,
  Gauge,
  Smile,
  Timer,
  WalletCards,
  TrendingUp,
} from 'lucide-react';
import { useOrders } from '../context/OrdersContext';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { api } from '../../lib/api';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

type DashboardSection = 'orders' | 'menu-settings' | 'table-management' | 'analytics' | 'app-settings';
type AnalyticsPreset = 'today' | '7d' | '30d' | 'month' | 'custom';
type UiLanguage = 'en' | 'fr';

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string, endOfDay: boolean) {
  if (!value) return null;
  const parsed = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function parseTimeToMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value).trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function isWithinWorkingHours(
  timestamp: Date,
  startMinutes: number,
  endMinutes: number
) {
  if (startMinutes === endMinutes) {
    return true;
  }

  const minutes = timestamp.getHours() * 60 + timestamp.getMinutes();

  if (startMinutes < endMinutes) {
    return minutes >= startMinutes && minutes <= endMinutes;
  }

  // Overnight window (for example 22:00 -> 02:00)
  return minutes >= startMinutes || minutes <= endMinutes;
}

function KpiName({ name, description }: { name: string; description: string }) {
  return (
    <p
      className="cursor-help text-base text-[#9a7a5d] decoration-dotted underline-offset-4 hover:underline"
      title={description}
    >
      {name}
    </p>
  );
}

function AnalyticsStatCard({
  title,
  description,
  value,
  subtitle,
  progress,
  tone,
  icon: Icon,
  delayMs,
  className,
}: {
  title: string;
  description: string;
  value: string;
  subtitle?: string;
  progress: number;
  tone: 'amber' | 'orange' | 'green';
  icon: ComponentType<{ className?: string }>;
  delayMs: number;
  className?: string;
}) {
  const clampedProgress = clamp(progress, 0, 100);
  const toneStyles = {
    amber: {
      card: 'analytics-kpi-card--amber',
      badge: 'bg-[#fef3c7] text-[#b45309] border-[#f7c56d]',
      bar: 'bg-[#d97706]',
    },
    orange: {
      card: 'analytics-kpi-card--orange',
      badge: 'bg-[#ffedd5] text-[#c2410c] border-[#f7b183]',
      bar: 'bg-[#ea580c]',
    },
    green: {
      card: 'analytics-kpi-card--green',
      badge: 'bg-[#dcfce7] text-[#166534] border-[#8cd7a8]',
      bar: 'bg-[#16a34a]',
    },
  } as const;

  return (
    <div
      className={`analytics-kpi-card ${toneStyles[tone].card} rounded-2xl border border-[#ead6c2] bg-white p-4 shadow-sm ${className ?? ''}`}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <KpiName name={title} description={description} />
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${toneStyles[tone].badge}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-[2rem] leading-none text-[#5a3418]">{value}</p>
      {subtitle && <p className="mt-1 text-sm text-[#9a7a5d]">{subtitle}</p>}
      <div className="mt-3 h-2 rounded-full bg-[#f3e4d3]">
        <div className={`h-full rounded-full ${toneStyles[tone].bar}`} style={{ width: `${clampedProgress}%` }} />
      </div>
    </div>
  );
}

export function RestaurantDashboard() {
  // ── Auth & business name ──────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginPass, setLoginPass] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetSuperAdminPass, setResetSuperAdminPass] = useState('');
  const [resetNewAdminPass, setResetNewAdminPass] = useState('');
  const [resetConfirmAdminPass, setResetConfirmAdminPass] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState('');
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState('');
  const [businessName, setBusinessName] = useState('The Local Cafe');
  const [taxRatePercent, setTaxRatePercent] = useState(0);
  const [serviceChargePercent, setServiceChargePercent] = useState(0);
  const [currencyCode, setCurrencyCode] = useState('TND');

  const pricingSettings = useMemo(
    () => ({ taxRate: taxRatePercent, serviceCharge: serviceChargePercent, currencyCode }),
    [taxRatePercent, serviceChargePercent, currencyCode]
  );

  useEffect(() => {
    let cancelled = false;
    api.getPublicSettings().then((pub) => {
      if (!cancelled) {
        if (pub.businessName) {
          setBusinessName(pub.businessName);
        }
        setTaxRatePercent(Number(pub.taxRate) || 0);
        setServiceChargePercent(Number(pub.serviceCharge) || 0);
        setCurrencyCode(String(pub.currencyCode || 'TND').trim().toUpperCase() || 'TND');
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    document.title = `Main Dashboard - ${businessName}`;
  }, [businessName]);

  const handleLogin = async () => {
    const pass = loginPass.trim();
    if (!pass) { setLoginError('Password is required'); return; }
    setIsLoggingIn(true);
    setLoginError('');
    try {
      await api.adminLogin(pass);
      setIsAuthenticated(true);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Incorrect password');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setLoginPass('');
    setLoginError('');
    setShowResetPassword(false);
    setResetPasswordError('');
    setResetPasswordSuccess('');
    setResetSuperAdminPass('');
    setResetNewAdminPass('');
    setResetConfirmAdminPass('');
  };

  const handleResetAdminPassword = async () => {
    const providedSuperAdminPass = resetSuperAdminPass.trim();
    const nextAdminPass = resetNewAdminPass.trim();
    const confirmNextAdminPass = resetConfirmAdminPass.trim();

    if (!providedSuperAdminPass) {
      setResetPasswordError('Super admin password is required');
      setResetPasswordSuccess('');
      return;
    }

    if (nextAdminPass.length < 6) {
      setResetPasswordError('New admin password must be at least 6 characters');
      setResetPasswordSuccess('');
      return;
    }

    if (nextAdminPass !== confirmNextAdminPass) {
      setResetPasswordError('New password and confirmation do not match');
      setResetPasswordSuccess('');
      return;
    }

    setIsResettingPassword(true);
    setResetPasswordError('');
    setResetPasswordSuccess('');
    try {
      await api.resetAdminPassword(providedSuperAdminPass, nextAdminPass);
      setResetPasswordSuccess('Admin password reset successfully. Use the new password to sign in.');
      setResetSuperAdminPass('');
      setResetNewAdminPass('');
      setResetConfirmAdminPass('');
    } catch (error) {
      setResetPasswordError(error instanceof Error ? error.message : 'Failed to reset admin password');
    } finally {
      setIsResettingPassword(false);
    }
  };

  // ── Dashboard section state ───────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState<DashboardSection>('orders');
  const [language, setLanguage] = useState<UiLanguage>(() => {
    if (typeof window === 'undefined') {
      return 'en';
    }
    const saved = window.localStorage.getItem('dashboardLanguage');
    return saved === 'fr' ? 'fr' : 'en';
  });
  const { orders } = useOrders();
  const menuItemsRef = useRef<HTMLDivElement | null>(null);
  const bundlesRef = useRef<HTMLDivElement | null>(null);
  const offersRef = useRef<HTMLDivElement | null>(null);
  const [analyticsPreset, setAnalyticsPreset] = useState<AnalyticsPreset>('30d');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const base = new Date();
    base.setDate(base.getDate() - 29);
    return toInputDate(base);
  });
  const [customEndDate, setCustomEndDate] = useState(() => toInputDate(new Date()));
  const [foodCostRateInput, setFoodCostRateInput] = useState(() => localStorage.getItem('analytics_foodCostRate') ?? '32');
  const [numberOfWorkersInput, setNumberOfWorkersInput] = useState(() => localStorage.getItem('analytics_numberOfWorkers') ?? '3');
  const [wagePerShiftInput, setWagePerShiftInput] = useState(() => localStorage.getItem('analytics_wagePerDay') ?? '50');
  const [workingHoursStartInput, setWorkingHoursStartInput] = useState(() => localStorage.getItem('analytics_workingHoursStart') ?? '08:00');
  const [workingHoursEndInput, setWorkingHoursEndInput] = useState(() => localStorage.getItem('analytics_workingHoursEnd') ?? '23:00');
  const [activeTablesCount, setActiveTablesCount] = useState(0);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const tx = (en: string, fr: string) => (language === 'fr' ? fr : en);

  const handleSectionChange = (section: DashboardSection) => {
    setActiveSection(section);
    setIsMobileNavOpen(false);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('dashboardLanguage', language);
    }
  }, [language]);

  useEffect(() => { localStorage.setItem('analytics_foodCostRate', foodCostRateInput); }, [foodCostRateInput]);
  useEffect(() => { localStorage.setItem('analytics_numberOfWorkers', numberOfWorkersInput); }, [numberOfWorkersInput]);
  useEffect(() => { localStorage.setItem('analytics_wagePerDay', wagePerShiftInput); }, [wagePerShiftInput]);
  useEffect(() => { localStorage.setItem('analytics_workingHoursStart', workingHoursStartInput); }, [workingHoursStartInput]);
  useEffect(() => { localStorage.setItem('analytics_workingHoursEnd', workingHoursEndInput); }, [workingHoursEndInput]);

  const scrollToMenuSettingBlock = (block: 'menu-items' | 'bundles' | 'offers') => {
    const refs = {
      'menu-items': menuItemsRef,
      bundles: bundlesRef,
      offers: offersRef,
    } as const;

    refs[block].current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  useEffect(() => {
    let cancelled = false;

    const loadActiveTablesCount = async () => {
      try {
        const tables = await api.getTables();
        if (!cancelled) {
          setActiveTablesCount(tables.length);
        }
      } catch (error) {
        console.error('Failed to load tables for analytics', error);
      }
    };

    void loadActiveTablesCount();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedDateRange = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const start = new Date(end);

    if (analyticsPreset === '7d') {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }

    if (analyticsPreset === 'today') {
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }

    if (analyticsPreset === '30d') {
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }

    if (analyticsPreset === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }

    const customStart = parseDateInput(customStartDate, false);
    const customEnd = parseDateInput(customEndDate, true);

    if (!customStart || !customEnd) {
      const fallbackStart = new Date(end);
      fallbackStart.setDate(fallbackStart.getDate() - 29);
      fallbackStart.setHours(0, 0, 0, 0);
      return { start: fallbackStart, end };
    }

    if (customStart > customEnd) {
      return { start: customEnd, end: customStart };
    }

    return { start: customStart, end: customEnd };
  }, [analyticsPreset, customEndDate, customStartDate]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const timestamp = order.timestamp instanceof Date ? order.timestamp : new Date(order.timestamp);
      return timestamp >= selectedDateRange.start && timestamp <= selectedDateRange.end;
    });
  }, [orders, selectedDateRange]);

  const analytics = useMemo(() => {
    const parsedFoodRate = Number(foodCostRateInput);
    const parsedWorkers = Number(numberOfWorkersInput);
    const parsedWage = Number(wagePerShiftInput);
    const foodCostPercentage = clamp(Number.isFinite(parsedFoodRate) ? parsedFoodRate : 32, 0, 100);
    const workerCount = Number.isFinite(parsedWorkers) && parsedWorkers >= 0 ? parsedWorkers : 3;
    const wagePerDay = Number.isFinite(parsedWage) && parsedWage >= 0 ? parsedWage : 50;

    const rangeStartDay = new Date(selectedDateRange.start);
    rangeStartDay.setHours(0, 0, 0, 0);
    const rangeEndDay = new Date(selectedDateRange.end);
    rangeEndDay.setHours(0, 0, 0, 0);
    const selectedDaysCount = Math.max(
      1,
      Math.floor((rangeEndDay.getTime() - rangeStartDay.getTime()) / (1000 * 60 * 60 * 24)) + 1
    );

    const totalOrders = filteredOrders.length;
    const pending = filteredOrders.filter((o) => o.status === 'pending').length;
    const preparing = filteredOrders.filter((o) => o.status === 'preparing').length;
    const ready = filteredOrders.filter((o) => o.status === 'ready').length;
    const completed = filteredOrders.filter((o) => o.status === 'completed').length;
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.total, 0);
    const effectiveTaxRate = clamp(Number(taxRatePercent) || 0, 0, 100);
    const effectiveServiceRate = clamp(Number(serviceChargePercent) || 0, 0, 100);
    const combinedChargeRate = effectiveTaxRate + effectiveServiceRate;
    const revenueBeforeCharges = combinedChargeRate > 0
      ? totalRevenue / (1 + combinedChargeRate / 100)
      : totalRevenue;
    const taxAmount = (revenueBeforeCharges * effectiveTaxRate) / 100;
    const serviceChargeAmount = (revenueBeforeCharges * effectiveServiceRate) / 100;

    const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;
    const completionRate = totalOrders ? (completed / totalOrders) * 100 : 0;

    const ordersWithTables = filteredOrders.filter((order) => order.tableNumber !== null);
    const tablesUsed = new Set(ordersWithTables.map((order) => order.tableNumber));
    const tablePool = activeTablesCount > 0 ? activeTablesCount : Math.max(tablesUsed.size, 1);
    const tableTurnoverRate = ordersWithTables.length / tablePool;
    const tableUtilization = activeTablesCount > 0 ? (tablesUsed.size / activeTablesCount) * 100 : (tablesUsed.size > 0 ? 100 : 0);

    const hourlyOrders = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: 0,
      sales: 0,
    }));

    const itemStats = new Map<string, { name: string; quantity: number; revenue: number }>();
    const tableStats = new Map<number, { table: string; orders: number; revenue: number }>();
    let totalItemsSold = 0;

    for (const order of filteredOrders) {
      const timestamp = order.timestamp instanceof Date ? order.timestamp : new Date(order.timestamp);
      const hour = timestamp.getHours();
      hourlyOrders[hour].count += 1;
      hourlyOrders[hour].sales += order.total;

      if (order.tableNumber !== null) {
        const tableKey = order.tableNumber;
        const current = tableStats.get(tableKey) ?? {
          table: `#${tableKey}`,
          orders: 0,
          revenue: 0,
        };
        current.orders += 1;
        current.revenue += order.total;
        tableStats.set(tableKey, current);
      }

      for (const item of order.items) {
        const key = `${item.id}-${item.name}`;
        const current = itemStats.get(key) ?? {
          name: item.name,
          quantity: 0,
          revenue: 0,
        };
        const quantity = Number(item.quantity) || 0;
        const lineRevenue = quantity * (Number(item.price) || 0);
        current.quantity += quantity;
        current.revenue += lineRevenue;
        totalItemsSold += quantity;
        itemStats.set(key, current);
      }
    }

    const activeSalesHours = hourlyOrders.filter((entry) => entry.count > 0).length;
    const salesPerHour = activeSalesHours > 0 ? totalRevenue / activeSalesHours : 0;

    const avgItemsPerOrder = totalOrders ? totalItemsSold / totalOrders : 0;
    const orderPreparationTime = totalOrders
      ? Number((6 + avgItemsPerOrder * 2.2 + (pending * 3 + preparing * 1.5) / totalOrders).toFixed(1))
      : 0;

    const readyLikeRate = totalOrders ? ((ready + completed) / totalOrders) * 100 : 0;
    const prepScore = clamp(100 - Math.max(0, orderPreparationTime - 12) * 5, 0, 100);
    const customerSatisfactionScore = clamp(
      readyLikeRate * 0.55 + completionRate * 0.3 + prepScore * 0.15,
      0,
      100
    );

    const foodCostAmount = (revenueBeforeCharges * foodCostPercentage) / 100;
    const laborCostAmount = workerCount * wagePerDay * selectedDaysCount;
    const laborCostPercentage = revenueBeforeCharges > 0 ? (laborCostAmount / revenueBeforeCharges) * 100 : 0;
    const primeCost = foodCostAmount + laborCostAmount;
    const primeCostPercentage = revenueBeforeCharges > 0 ? (primeCost / revenueBeforeCharges) * 100 : 0;
    const grossMarginAmount = Math.max(0, revenueBeforeCharges - primeCost);
    const netRevenue = grossMarginAmount;

    const bestSellers = [...itemStats.values()]
      .sort((a, b) => {
        if (b.quantity !== a.quantity) {
          return b.quantity - a.quantity;
        }
        return b.revenue - a.revenue;
      })
      .slice(0, 5)
      .map((item) => ({
        ...item,
        revenue: Number(item.revenue.toFixed(2)),
      }));

    const topTables = [...tableStats.values()]
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 6)
      .map((table) => ({
        ...table,
        revenue: Number(table.revenue.toFixed(2)),
      }));

    const peakHour = hourlyOrders.reduce(
      (best, current) => (current.count > best.count ? current : best),
      { hour: 0, count: 0 }
    );

    const dailyMap = new Map<string, { orders: number; revenue: number }>();
    const cursor = new Date(selectedDateRange.start);

    while (cursor <= selectedDateRange.end) {
      const key = toInputDate(cursor);
      dailyMap.set(key, { orders: 0, revenue: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    for (const order of filteredOrders) {
      const timestamp = order.timestamp instanceof Date ? order.timestamp : new Date(order.timestamp);
      const key = toInputDate(timestamp);
      const current = dailyMap.get(key);
      if (!current) continue;
      current.orders += 1;
      current.revenue += order.total;
    }

    const dailyTrend = [...dailyMap.entries()].map(([date, values]) => ({
      date,
      label: `${date.slice(5, 7)}/${date.slice(8, 10)}`,
      orders: values.orders,
      revenue: Number(values.revenue.toFixed(2)),
    }));

    const hourlySales = hourlyOrders.map((entry) => ({
      label: `${String(entry.hour).padStart(2, '0')}:00`,
      orders: entry.count,
      sales: Number(entry.sales.toFixed(2)),
    }));

    const costBreakdown = [
      { name: tx('Tax', 'Taxe'), value: Number(taxAmount.toFixed(2)), color: '#fbbf24' },
      { name: tx('Service Charge', 'Frais de service'), value: Number(serviceChargeAmount.toFixed(2)), color: '#fb923c' },
      { name: tx('Food Cost', 'Cout Alimentaire'), value: Number(foodCostAmount.toFixed(2)), color: '#f59e0b' },
      { name: tx('Labor Cost', 'Cout Main-d\'oeuvre'), value: Number(laborCostAmount.toFixed(2)), color: '#f97316' },
      { name: tx('Gross Margin', 'Marge Brute'), value: Number(grossMarginAmount.toFixed(2)), color: '#15803d' },
    ].filter((segment) => segment.value > 0);

    const statusBreakdown = [
      { name: tx('Pending', 'En attente'), value: pending, color: '#f59e0b' },
      { name: tx('Preparing', 'En preparation'), value: preparing, color: '#f97316' },
      { name: tx('Ready', 'Pret'), value: ready, color: '#16a34a' },
      { name: tx('Completed', 'Termine'), value: completed, color: '#15803d' },
    ].filter((status) => status.value > 0);

    const revenueProgress = clamp((totalRevenue / 2000) * 100, 0, 100);
    const netRevenueProgress = clamp((netRevenue / 2000) * 100, 0, 100);
    const averageOrderProgress = clamp((avgOrderValue / 20) * 100, 0, 100);
    const turnoverProgress = clamp((tableTurnoverRate / 4) * 100, 0, 100);
    const salesPerHourProgress = clamp((salesPerHour / 150) * 100, 0, 100);
    const prepTimeProgress = clamp(((20 - orderPreparationTime) / 20) * 100, 0, 100);

    return {
      totalOrders,
      pending,
      preparing,
      ready,
      completed,
      totalRevenue,
      revenueBeforeCharges,
      taxAmount,
      serviceChargeAmount,
      effectiveTaxRate,
      effectiveServiceRate,
      selectedDaysCount,
      netRevenue,
      avgOrderValue,
      completionRate,
      tableTurnoverRate,
      tableUtilization,
      peakHour,
      foodCostPercentage,
      laborCostPercentage,
      foodCostAmount,
      laborCostAmount,
      primeCost,
      primeCostPercentage,
      salesPerHour,
      orderPreparationTime,
      customerSatisfactionScore,
      bestSellers,
      topTables,
      dailyTrend,
      hourlySales,
      costBreakdown,
      statusBreakdown,
      revenueProgress,
      netRevenueProgress,
      averageOrderProgress,
      turnoverProgress,
      salesPerHourProgress,
      prepTimeProgress,
    };
  }, [
    activeTablesCount,
    filteredOrders,
    numberOfWorkersInput,
    wagePerShiftInput,
    taxRatePercent,
    serviceChargePercent,
    foodCostRateInput,
    language,
    selectedDateRange,
  ]);

  const dateLocale = language === 'fr' ? 'fr-FR' : 'en-US';
  const rangeLabel = `${selectedDateRange.start.toLocaleDateString(dateLocale)} - ${selectedDateRange.end.toLocaleDateString(dateLocale)}`;
  const analyticsChartCardClass = 'analytics-chart-card rounded-2xl border border-[#ead6c2] bg-gradient-to-br from-white to-[#fff9f1] p-4 shadow-sm';

  useEffect(() => {
    const root = document.documentElement;
    const hadDarkClass = root.classList.contains('dark');

    // Force restaurant dashboard to stay in light mode.
    root.classList.remove('dark');

    return () => {
      if (hadDarkClass) {
        root.classList.add('dark');
      }
    };
  }, []);

  // ── Login gate ────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#fffcf8] flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-[#ead6c2] bg-white p-8 shadow-lg">
          <div className="mb-6 flex flex-col items-center gap-3">
            <Coffee className="h-10 w-10 text-[#f59e0b]" />
            <div className="text-center">
              <h1 className="text-2xl text-[#5a3418]">{businessName}</h1>
              <p className="mt-1 text-sm text-[#9a7a5d] flex items-center justify-center gap-1">
                <Lock className="h-3 w-3" /> Admin Dashboard
              </p>
            </div>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); void handleLogin(); }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="login-pass" className="text-[#7a5539]">Admin Password</Label>
              <Input
                id="login-pass"
                type="password"
                value={loginPass}
                onChange={(e) => { setLoginPass(e.target.value); setLoginError(''); }}
                placeholder="Enter admin password"
                autoFocus
                className="mt-2 h-11 !border-[#d9c0a4] !bg-[#fffcf8] !text-[#5a3418]"
              />
            </div>
            {loginError && (
              <p className="text-sm text-red-500">{loginError}</p>
            )}
            <Button
              type="submit"
              disabled={isLoggingIn}
              className="w-full h-11 !bg-amber-600 !text-white hover:!bg-amber-700"
            >
              {isLoggingIn ? 'Logging in...' : 'Enter Dashboard'}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  const nextShowState = !showResetPassword;
                  setShowResetPassword(nextShowState);
                  setResetPasswordError('');
                  setResetPasswordSuccess('');
                }}
                className="text-sm text-[#9a7a5d] underline underline-offset-2 hover:text-[#7a5539]"
              >
                {showResetPassword ? 'Cancel password reset' : 'Forgot password? Reset it'}
              </button>
            </div>

            {showResetPassword && (
              <div className="rounded-xl border border-[#ead6c2] bg-[#fffcf8] p-4 space-y-3">
                <p className="text-sm text-[#7a5539]">
                  Reset admin password with the super admin password.
                </p>

                <div>
                  <Label htmlFor="reset-super-admin-pass" className="text-[#7a5539]">Super Admin Password</Label>
                  <Input
                    id="reset-super-admin-pass"
                    type="password"
                    value={resetSuperAdminPass}
                    onChange={(event) => {
                      setResetSuperAdminPass(event.target.value);
                      setResetPasswordError('');
                    }}
                    placeholder="Enter super admin password"
                    className="mt-2 h-11 !border-[#d9c0a4] !bg-white !text-[#5a3418]"
                  />
                </div>

                <div>
                  <Label htmlFor="reset-new-admin-pass" className="text-[#7a5539]">New Admin Password</Label>
                  <Input
                    id="reset-new-admin-pass"
                    type="password"
                    value={resetNewAdminPass}
                    onChange={(event) => {
                      setResetNewAdminPass(event.target.value);
                      setResetPasswordError('');
                    }}
                    placeholder="At least 6 characters"
                    className="mt-2 h-11 !border-[#d9c0a4] !bg-white !text-[#5a3418]"
                  />
                </div>

                <div>
                  <Label htmlFor="reset-confirm-admin-pass" className="text-[#7a5539]">Confirm New Password</Label>
                  <Input
                    id="reset-confirm-admin-pass"
                    type="password"
                    value={resetConfirmAdminPass}
                    onChange={(event) => {
                      setResetConfirmAdminPass(event.target.value);
                      setResetPasswordError('');
                    }}
                    placeholder="Re-enter new password"
                    className="mt-2 h-11 !border-[#d9c0a4] !bg-white !text-[#5a3418]"
                  />
                </div>

                {resetPasswordError && (
                  <p className="text-sm text-red-500">{resetPasswordError}</p>
                )}
                {resetPasswordSuccess && (
                  <p className="text-sm text-green-600">{resetPasswordSuccess}</p>
                )}

                <Button
                  type="button"
                  onClick={() => { void handleResetAdminPassword(); }}
                  disabled={isResettingPassword}
                  className="w-full h-11 !bg-[#8b5a2b] !text-white hover:!bg-[#74461e]"
                >
                  {isResettingPassword ? 'Resetting...' : 'Reset Admin Password'}
                </Button>
              </div>
            )}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white transition-colors md:flex">
      <aside className="hidden min-h-screen w-full flex-col bg-[#2f1f14] px-3 py-4 text-amber-100 md:sticky md:top-0 md:flex md:h-screen md:w-56 md:self-start md:overflow-y-auto md:px-3 md:py-5 lg:w-[17rem] lg:px-4 xl:w-80 xl:px-5 xl:py-6">
          <div className="mb-5 flex items-center gap-3 px-2">
            <Coffee className="h-6 w-6 text-[#f59e0b] lg:h-7 lg:w-7 xl:h-8 xl:w-8" />
            <div>
              <h1 className="text-sm font-semibold text-[#fff7ed] lg:text-base xl:text-lg">{businessName}</h1>
              <p className="text-xs text-[#f7d9b6] xl:text-sm">{tx('Main Dashboard', 'Tableau Principal')}</p>
            </div>
          </div>
          <p className="mb-3 px-2 text-xs uppercase tracking-[0.2em] text-[#f7d9b6] xl:text-sm">{tx('Navigation', 'Navigation')}</p>
          <nav className="flex flex-col gap-2">
            <button
              onClick={() => handleSectionChange('orders')}
              className={`dashboard-nav-item flex min-h-12 min-w-[148px] select-none items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-3 py-3 text-sm font-medium transition-all touch-manipulation active:scale-[0.98] md:w-full md:justify-start lg:px-4 xl:min-h-14 xl:gap-3 xl:px-5 xl:py-4 xl:text-base ${
                activeSection === 'orders'
                  ? 'bg-[#f8bf60] text-[#2f1f14]'
                  : 'bg-[#6a4730] text-[#fff7ed] hover:bg-[#7a5539]'
              }`}
            >
              <ClipboardList className="h-5 w-5 xl:h-6 xl:w-6" />
              {tx('Orders', 'Commandes')}
            </button>
            <button
              onClick={() => handleSectionChange('analytics')}
              className={`dashboard-nav-item flex min-h-12 min-w-[148px] select-none items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-3 py-3 text-sm font-medium transition-all touch-manipulation active:scale-[0.98] md:w-full md:justify-start lg:px-4 xl:min-h-14 xl:gap-3 xl:px-5 xl:py-4 xl:text-base ${
                activeSection === 'analytics'
                  ? 'bg-[#f8bf60] text-[#2f1f14]'
                  : 'bg-[#6a4730] text-[#fff7ed] hover:bg-[#7a5539]'
              }`}
            >
              <ChartNoAxesCombined className="h-5 w-5 xl:h-6 xl:w-6" />
              {tx('Analytics', 'Analytique')}
            </button>
            <button
              onClick={() => handleSectionChange('menu-settings')}
              className={`dashboard-nav-item flex min-h-12 min-w-[148px] select-none items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-3 py-3 text-sm font-medium transition-all touch-manipulation active:scale-[0.98] md:w-full md:justify-start lg:px-4 xl:min-h-14 xl:gap-3 xl:px-5 xl:py-4 xl:text-base ${
                activeSection === 'menu-settings'
                  ? 'bg-[#f8bf60] text-[#2f1f14]'
                  : 'bg-[#6a4730] text-[#fff7ed] hover:bg-[#7a5539]'
              }`}
            >
              <Settings className="h-5 w-5 xl:h-6 xl:w-6" />
              {tx('Menu Items', 'Parametres Menu')}
            </button>
            <button
              onClick={() => handleSectionChange('table-management')}
              className={`dashboard-nav-item flex min-h-12 min-w-[148px] select-none items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-3 py-3 text-sm font-medium transition-all touch-manipulation active:scale-[0.98] md:w-full md:justify-start lg:px-4 xl:min-h-14 xl:gap-3 xl:px-5 xl:py-4 xl:text-base ${
                activeSection === 'table-management'
                  ? 'bg-[#f8bf60] text-[#2f1f14]'
                  : 'bg-[#6a4730] text-[#fff7ed] hover:bg-[#7a5539]'
              }`}
            >
              <QrCode className="h-5 w-5 xl:h-6 xl:w-6" />
              {tx('Table Managment', 'Gestion Tables')}
            </button>
            <button
              onClick={() => handleSectionChange('app-settings')}
              className={`dashboard-nav-item flex min-h-12 min-w-[148px] select-none items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-3 py-3 text-sm font-medium transition-all touch-manipulation active:scale-[0.98] md:w-full md:justify-start lg:px-4 xl:min-h-14 xl:gap-3 xl:px-5 xl:py-4 xl:text-base ${
                activeSection === 'app-settings'
                  ? 'bg-[#f8bf60] text-[#2f1f14]'
                  : 'bg-[#6a4730] text-[#fff7ed] hover:bg-[#7a5539]'
              }`}
            >
              <SlidersHorizontal className="h-5 w-5 xl:h-6 xl:w-6" />
              {tx('Settings', 'Parametres')}
            </button>
          </nav>

          {/* Contact Us */}
          <div className="mt-auto pt-6">
            <div className="border-t border-[#4a3020] pt-4">
              <button
                type="button"
                onClick={handleLogout}
                className="group mb-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#a85f48] bg-gradient-to-r from-[#7a3f2e] to-[#8e4d36] px-4 py-3 text-sm font-semibold text-[#fff3ea] shadow-[0_6px_18px_rgba(40,18,10,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:from-[#8a4a35] hover:to-[#9f5a3f] hover:shadow-[0_10px_20px_rgba(40,18,10,0.42)]"
              >
                <LogOut className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                {tx('Logout', 'Deconnexion')}
              </button>
              <div className="my-2 border-t border-[#7a5539]" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setIsContactOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#6a4730] px-4 py-3 text-sm font-medium text-[#fff7ed] transition-colors hover:bg-[#7a5539]"
              >
                <Mail className="h-4 w-4" />
                {tx('Contact Us', 'Nous Contacter')}
              </button>
              <p className="mt-3 text-center text-xs leading-tight text-[#9a7a5d] xl:text-sm">
                {tx('Powered By', 'Propulse par')} <span className="font-semibold text-[#f7d9b6]">Tawla Scan</span>
                <br />
                <span className="text-xs text-[#6a4730]">&copy; 2026</span>
              </p>
            </div>
          </div>
      </aside>

      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label={tx('Close navigation menu', 'Fermer le menu de navigation')}
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsMobileNavOpen(false)}
          />
          <aside className="relative mr-auto flex h-full w-[86%] max-w-xs flex-col bg-[#2f1f14] px-4 py-4 text-amber-100 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coffee className="h-5 w-5 text-[#f59e0b]" />
                <h2 className="text-sm font-semibold text-[#fff7ed]">{businessName}</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                className="rounded-full p-1 text-[#f7d9b6] hover:bg-[#6a4730]"
                aria-label={tx('Close', 'Fermer')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[#f7d9b6]">{tx('Navigation', 'Navigation')}</p>
            <nav className="space-y-2">
              <button
                onClick={() => handleSectionChange('orders')}
                className={`dashboard-nav-item flex min-h-12 w-full select-none items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition-all touch-manipulation active:scale-[0.98] ${
                  activeSection === 'orders'
                    ? 'bg-[#f8bf60] text-[#2f1f14]'
                    : 'bg-[#6a4730] text-[#fff7ed] hover:bg-[#7a5539]'
                }`}
              >
                <ClipboardList className="h-5 w-5" />
                {tx('Orders', 'Commandes')}
              </button>
              <button
                onClick={() => handleSectionChange('analytics')}
                className={`dashboard-nav-item flex min-h-12 w-full select-none items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition-all touch-manipulation active:scale-[0.98] ${
                  activeSection === 'analytics'
                    ? 'bg-[#f8bf60] text-[#2f1f14]'
                    : 'bg-[#6a4730] text-[#fff7ed] hover:bg-[#7a5539]'
                }`}
              >
                <ChartNoAxesCombined className="h-5 w-5" />
                {tx('Analytics', 'Analytique')}
              </button>
              <button
                onClick={() => handleSectionChange('menu-settings')}
                className={`dashboard-nav-item flex min-h-12 w-full select-none items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition-all touch-manipulation active:scale-[0.98] ${
                  activeSection === 'menu-settings'
                    ? 'bg-[#f8bf60] text-[#2f1f14]'
                    : 'bg-[#6a4730] text-[#fff7ed] hover:bg-[#7a5539]'
                }`}
              >
                <Settings className="h-5 w-5" />
                {tx('Menu Items', 'Parametres Menu')}
              </button>
              <button
                onClick={() => handleSectionChange('table-management')}
                className={`dashboard-nav-item flex min-h-12 w-full select-none items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition-all touch-manipulation active:scale-[0.98] ${
                  activeSection === 'table-management'
                    ? 'bg-[#f8bf60] text-[#2f1f14]'
                    : 'bg-[#6a4730] text-[#fff7ed] hover:bg-[#7a5539]'
                }`}
              >
                <QrCode className="h-5 w-5" />
                {tx('Table Managment', 'Gestion Tables')}
              </button>
              <button
                onClick={() => handleSectionChange('app-settings')}
                className={`dashboard-nav-item flex min-h-12 w-full select-none items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition-all touch-manipulation active:scale-[0.98] ${
                  activeSection === 'app-settings'
                    ? 'bg-[#f8bf60] text-[#2f1f14]'
                    : 'bg-[#6a4730] text-[#fff7ed] hover:bg-[#7a5539]'
                }`}
              >
                <SlidersHorizontal className="h-5 w-5" />
                {tx('Settings', 'Parametres')}
              </button>
            </nav>

            <div className="mt-auto pt-6">
              <div className="border-t border-[#4a3020] pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileNavOpen(false);
                    handleLogout();
                  }}
                  className="group mb-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#a85f48] bg-gradient-to-r from-[#7a3f2e] to-[#8e4d36] px-4 py-3 text-sm font-semibold text-[#fff3ea] shadow-[0_6px_18px_rgba(40,18,10,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:from-[#8a4a35] hover:to-[#9f5a3f] hover:shadow-[0_10px_20px_rgba(40,18,10,0.42)]"
                >
                  <LogOut className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  {tx('Logout', 'Deconnexion')}
                </button>
                <div className="my-2 border-t border-[#7a5539]" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileNavOpen(false);
                    setIsContactOpen(true);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#6a4730] px-4 py-3 text-sm font-medium text-[#fff7ed] transition-colors hover:bg-[#7a5539]"
                >
                  <Mail className="h-4 w-4" />
                  {tx('Contact Us', 'Nous Contacter')}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Contact Us Dialog */}
      {isContactOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setIsContactOpen(false); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#ead6c2] px-6 py-4">
              <h2 className="text-xl text-[#5a3418]">{tx('Contact Us', 'Nous Contacter')}</h2>
              <button
                type="button"
                onClick={() => setIsContactOpen(false)}
                className="rounded-full p-1 text-[#9a7a5d] hover:bg-[#f4e5d2] hover:text-[#5a3418]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-8 text-center text-base text-[#9a7a5d]">
              {tx('Contact information coming soon.', 'Informations de contact bientot disponibles.')}
            </div>
          </div>
        </div>
      )}

      <section className="flex-1">
          <header className="border-b border-[#4a3020] bg-[#2f1f14] px-4 py-4 md:border-[#ead6c2] md:bg-[#fffcf8] md:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 md:hidden">
                <Coffee className="h-5 w-5 text-[#f59e0b]" />
                <div>
                  <h2 className="text-sm font-semibold text-[#fff7ed]">{tx('Main Dashboard', 'Tableau Principal')}</h2>
                  <p className="text-xs text-[#f7d9b6]">{businessName}</p>
                </div>
              </div>

              <div className="hidden md:block">
                <h2 className="text-lg text-[#5a3418] sm:text-xl md:text-2xl">
                  {tx('Main Dashboard', 'Tableau Principal')}
                </h2>
                <p className="text-sm text-[#9a7a5d]">{businessName}</p>
              </div>

              <button
                type="button"
                onClick={() => setIsMobileNavOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#7a5539] bg-[#6a4730] text-[#fff7ed] transition-colors hover:bg-[#7a5539] md:hidden"
                aria-label={tx('Open navigation menu', 'Ouvrir le menu de navigation')}
              >
                <MenuIcon className="h-5 w-5" />
              </button>

              <div className="hidden h-10 rounded-full border border-[#e2c29a] bg-[#fff9f2] p-1 md:inline-flex">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`rounded-full px-3 text-sm transition-colors ${
                    language === 'en'
                      ? 'bg-[#f8bf60] text-[#2f1f14]'
                      : 'text-[#7a5539] hover:bg-[#f4e5d2]'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('fr')}
                  className={`rounded-full px-3 text-sm transition-colors ${
                    language === 'fr'
                      ? 'bg-[#f8bf60] text-[#2f1f14]'
                      : 'text-[#7a5539] hover:bg-[#f4e5d2]'
                  }`}
                >
                  FR
                </button>
              </div>
            </div>
          </header>

          <div className="px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8">
          {activeSection === 'orders' && <OrdersView language={language} />}

          {activeSection === 'menu-settings' && (
            <div className="space-y-10">
              <div>
                <p className="mb-3 text-sm uppercase tracking-[0.2em] text-[#9a7a5d]">{tx('Shortcuts', 'Raccourcis')}</p>
                <div className="flex gap-2 overflow-x-auto">
                  <button
                    onClick={() => scrollToMenuSettingBlock('menu-items')}
                    className="min-h-11 whitespace-nowrap rounded-full bg-[#f8bf60] px-4 py-2 text-base font-medium text-[#2f1f14] hover:bg-[#f2b24a]"
                  >
                    {tx('Menu Items', 'Articles Menu')}
                  </button>
                  <button
                    onClick={() => scrollToMenuSettingBlock('bundles')}
                    className="min-h-11 whitespace-nowrap rounded-full bg-[#f9f1e6] px-4 py-2 text-base font-medium text-[#5a3418] hover:bg-[#f2e6d7]"
                  >
                    {tx('Bundles', 'Packs')}
                  </button>
                  <button
                    onClick={() => scrollToMenuSettingBlock('offers')}
                    className="min-h-11 whitespace-nowrap rounded-full bg-[#f9f1e6] px-4 py-2 text-base font-medium text-[#5a3418] hover:bg-[#f2e6d7]"
                  >
                    {tx('Offers', 'Offres')}
                  </button>
                </div>
              </div>

              <div ref={menuItemsRef}>
                <div className="mb-4 h-px w-full bg-[#ead6c2]" aria-hidden="true" />
                <MenuManagement language={language} />
              </div>
              <div ref={bundlesRef}>
                <div className="mb-4 h-px w-full bg-[#ead6c2]" aria-hidden="true" />
                <BundlesManagement language={language} />
              </div>
              <div ref={offersRef}>
                <div className="mb-4 h-px w-full bg-[#ead6c2]" aria-hidden="true" />
                <OffersManagement language={language} />
              </div>
            </div>
          )}

          {activeSection === 'table-management' && <TableManagement language={language} />}

          {activeSection === 'app-settings' && (
            <AppSettingsPanel
              language={language}
              onBusinessNameChange={setBusinessName}
              onPricingSettingsChange={(settings) => {
                setTaxRatePercent(Number(settings.taxRate) || 0);
                setServiceChargePercent(Number(settings.serviceCharge) || 0);
                setCurrencyCode(String(settings.currencyCode || 'TND').trim().toUpperCase() || 'TND');
              }}
              pricingSettings={pricingSettings}
              foodCostRateInput={foodCostRateInput}
              onFoodCostRateInputChange={setFoodCostRateInput}
              numberOfWorkersInput={numberOfWorkersInput}
              onNumberOfWorkersInputChange={setNumberOfWorkersInput}
              wagePerShiftInput={wagePerShiftInput}
              onWagePerShiftInputChange={setWagePerShiftInput}
              workingHoursStartInput={workingHoursStartInput}
              onWorkingHoursStartInputChange={setWorkingHoursStartInput}
              workingHoursEndInput={workingHoursEndInput}
              onWorkingHoursEndInputChange={setWorkingHoursEndInput}
            />
          )}

          {activeSection === 'analytics' && (
            <div className="relative space-y-6 overflow-hidden rounded-3xl bg-gradient-to-b from-[#fffaf4] via-[#fffdf9] to-[#fff8ef] p-2 sm:p-3 md:p-4">
              <div className="analytics-float-orb pointer-events-none absolute -right-16 top-10 h-40 w-40 rounded-full bg-[#f8bf60]/20" />
              <div className="analytics-float-orb pointer-events-none absolute -left-12 bottom-24 h-32 w-32 rounded-full bg-[#f59e0b]/15" style={{ animationDelay: '1.4s' }} />
              <div className="rounded-2xl border border-[#ead6c2] bg-white/90 p-5 shadow-sm backdrop-blur-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg sm:text-xl md:text-2xl text-[#5a3418]">{tx('Analytics Dashboard', 'Tableau Analytique')}</h2>
                    <p className="mt-1 text-base text-[#9a7a5d]">{tx('Range', 'Periode')} : {rangeLabel}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAnalyticsPreset('today')}
                      className={`h-9 rounded-full px-3 text-sm transition-colors md:h-10 md:px-4 md:text-base ${
                        analyticsPreset === 'today'
                          ? 'bg-[#f8bf60] text-[#2f1f14]'
                          : 'bg-[#f9f1e6] text-[#7a5539] hover:bg-[#f2e6d7]'
                      }`}
                    >
                      {tx('Today', 'Aujourd\'hui')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnalyticsPreset('7d')}
                      className={`h-9 rounded-full px-3 text-sm transition-colors md:h-10 md:px-4 md:text-base ${
                        analyticsPreset === '7d'
                          ? 'bg-[#f8bf60] text-[#2f1f14]'
                          : 'bg-[#f9f1e6] text-[#7a5539] hover:bg-[#f2e6d7]'
                      }`}
                    >
                      {tx('Last 7d', '7 derniers j')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnalyticsPreset('30d')}
                      className={`h-9 rounded-full px-3 text-sm transition-colors md:h-10 md:px-4 md:text-base ${
                        analyticsPreset === '30d'
                          ? 'bg-[#f8bf60] text-[#2f1f14]'
                          : 'bg-[#f9f1e6] text-[#7a5539] hover:bg-[#f2e6d7]'
                      }`}
                    >
                      {tx('Last 30d', '30 derniers j')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnalyticsPreset('month')}
                      className={`h-9 rounded-full px-3 text-sm transition-colors md:h-10 md:px-4 md:text-base ${
                        analyticsPreset === 'month'
                          ? 'bg-[#f8bf60] text-[#2f1f14]'
                          : 'bg-[#f9f1e6] text-[#7a5539] hover:bg-[#f2e6d7]'
                      }`}
                    >
                      {tx('This Month', 'Ce mois')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnalyticsPreset('custom')}
                      className={`h-9 rounded-full px-3 text-sm transition-colors md:h-10 md:px-4 md:text-base ${
                        analyticsPreset === 'custom'
                          ? 'bg-[#f8bf60] text-[#2f1f14]'
                          : 'bg-[#f9f1e6] text-[#7a5539] hover:bg-[#f2e6d7]'
                      }`}
                    >
                      {tx('Custom', 'Personnalise')}
                    </button>
                  </div>
                </div>

                {analyticsPreset === 'custom' && (
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr]">
                    <div>
                      <p className="mb-1 text-sm uppercase tracking-[0.16em] text-[#9a7a5d]">{tx('From', 'De')}</p>
                      <Input
                        type="date"
                        value={customStartDate}
                        onChange={(event) => setCustomStartDate(event.target.value)}
                        className="h-11 !border-[#d9c0a4] !bg-[#fffcf8] !text-[#5a3418]"
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-sm uppercase tracking-[0.16em] text-[#9a7a5d]">{tx('To', 'A')}</p>
                      <Input
                        type="date"
                        value={customEndDate}
                        onChange={(event) => setCustomEndDate(event.target.value)}
                        className="h-11 !border-[#d9c0a4] !bg-[#fffcf8] !text-[#5a3418]"
                      />
                    </div>
                  </div>
                )}

              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
                <AnalyticsStatCard
                  title={tx('Total Revenue', 'Revenu Total')}
                  description={tx(
                    'Total sales value in the selected period including taxes and service charges.',
                    'Valeur totale des ventes sur la periode selectionnee, incluant taxes et frais de service.'
                  )}
                  value={`${analytics.totalRevenue.toFixed(2)} ${currencyCode}`}
                  subtitle={`${tx('Before charges', 'Hors charges')}: ${analytics.revenueBeforeCharges.toFixed(2)} ${currencyCode}`}
                  progress={analytics.revenueProgress}
                  tone="amber"
                  icon={CircleDollarSign}
                  delayMs={40}
                  className="xl:col-span-3"
                />
                <AnalyticsStatCard
                  title={tx('Net Revenue', 'Revenu Net')}
                  description={tx(
                    'Estimated net revenue after tax, service charge, food cost, and labor cost.',
                    'Revenu net estime apres taxe, frais de service, cout alimentaire et main-d\'oeuvre.'
                  )}
                  value={`${analytics.netRevenue.toFixed(2)} ${currencyCode}`}
                  subtitle={`${analytics.effectiveTaxRate.toFixed(1)}% ${tx('tax', 'taxe')} • ${analytics.effectiveServiceRate.toFixed(1)}% ${tx('service', 'service')}`}
                  progress={analytics.netRevenueProgress}
                  tone="green"
                  icon={TrendingUp}
                  delayMs={60}
                  className="xl:col-span-3"
                />
                <AnalyticsStatCard
                  title={tx('Average Order Value', 'Valeur Moyenne de Commande')}
                  description={tx(
                    'Average amount spent per order in the selected period.',
                    'Montant moyen depense par commande sur la periode selectionnee.'
                  )}
                  value={`${analytics.avgOrderValue.toFixed(2)} ${currencyCode}`}
                  progress={analytics.averageOrderProgress}
                  tone="amber"
                  icon={ReceiptText}
                  delayMs={80}
                  className="xl:col-span-3"
                />
                <AnalyticsStatCard
                  title={tx('Table Turnover Rate', 'Taux de Rotation des Tables')}
                  description={tx(
                    'How many orders each table handles on average during the selected period.',
                    'Nombre moyen de commandes traitees par table pendant la periode selectionnee.'
                  )}
                  value={analytics.tableTurnoverRate.toFixed(2)}
                  subtitle={tx('orders per table', 'commandes par table')}
                  progress={analytics.turnoverProgress}
                  tone="green"
                  icon={RotateCcw}
                  delayMs={120}
                  className="xl:col-span-3"
                />
                <AnalyticsStatCard
                  title={tx('Food Cost Percentage', 'Pourcentage Cout Alimentaire')}
                  description={tx(
                    'Estimated share of revenue spent on ingredients, based on your configured food cost assumption.',
                    'Part estimee du revenu depensee en ingredients, selon votre hypothese de cout alimentaire.'
                  )}
                  value={`${analytics.foodCostPercentage.toFixed(1)}%`}
                  subtitle={`${analytics.foodCostAmount.toFixed(2)} ${currencyCode}`}
                  progress={analytics.foodCostPercentage}
                  tone="orange"
                  icon={ChefHat}
                  delayMs={160}
                  className="xl:col-span-3"
                />
                <AnalyticsStatCard
                  title={tx('Labor Cost', 'Cout Main-d\'oeuvre')}
                  description={tx(
                    'Total labor cost calculated as number of workers multiplied by wage per day and selected number of days.',
                    'Cout total de la main-d\'oeuvre calcule en multipliant le nombre de travailleurs par le salaire journalier et le nombre de jours selectionnes.'
                  )}
                  value={`${analytics.laborCostAmount.toFixed(2)} ${currencyCode}`}
                  subtitle={`${analytics.selectedDaysCount} ${tx('days', 'jours')} • ${analytics.laborCostPercentage.toFixed(1)}% ${tx('of revenue', 'du revenu')}`}
                  progress={analytics.laborCostPercentage}
                  tone="orange"
                  icon={Users}
                  delayMs={200}
                  className="xl:col-span-3"
                />
                <AnalyticsStatCard
                  title={tx('Prime Cost', 'Cout Principal')}
                  description={tx(
                    'Combined cost of food and labor. Lower prime cost percentage means stronger profitability.',
                    'Somme des couts alimentaires et de main-d\'oeuvre. Un pourcentage plus bas indique une meilleure rentabilite.'
                  )}
                  value={`${analytics.primeCost.toFixed(2)} ${currencyCode}`}
                  subtitle={`${analytics.primeCostPercentage.toFixed(1)}% ${tx('of revenue', 'du revenu')}`}
                  progress={Math.min(100, analytics.primeCostPercentage)}
                  tone="orange"
                  icon={WalletCards}
                  delayMs={240}
                  className="xl:col-span-3"
                />
                <AnalyticsStatCard
                  title={tx('Sales per Hour', 'Ventes par Heure')}
                  description={tx(
                    'Average revenue generated per active selling hour in the selected period.',
                    'Revenu moyen genere par heure de vente active sur la periode selectionnee.'
                  )}
                  value={`${analytics.salesPerHour.toFixed(2)} ${currencyCode}`}
                  progress={analytics.salesPerHourProgress}
                  tone="green"
                  icon={Gauge}
                  delayMs={280}
                  className="xl:col-span-3"
                />
                <AnalyticsStatCard
                  title={tx('Order Preparation Time', 'Temps de Preparation')}
                  description={tx(
                    'Estimated average minutes needed to prepare an order based on volume, item mix, and queue pressure.',
                    'Estimation du temps moyen en minutes pour preparer une commande selon le volume, le mix produits et la charge.'
                  )}
                  value={`${analytics.orderPreparationTime.toFixed(1)} min`}
                  progress={analytics.prepTimeProgress}
                  tone="amber"
                  icon={Timer}
                  delayMs={320}
                  className="xl:col-span-6"
                />
                <AnalyticsStatCard
                  title={tx('Customer Satisfaction Score', 'Score Satisfaction Client')}
                  description={tx(
                    'Estimated satisfaction score derived from completion rate, ready/completed share, and prep-time performance.',
                    'Score de satisfaction estime base sur le taux de completion, la part des commandes pretes/terminees et le temps de preparation.'
                  )}
                  value={`${analytics.customerSatisfactionScore.toFixed(1)}%`}
                  progress={analytics.customerSatisfactionScore}
                  tone="green"
                  icon={Smile}
                  delayMs={360}
                  className="xl:col-span-6"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className={analyticsChartCardClass}>
                  <h3 className="mb-3 text-base md:text-xl text-[#5a3418]">{tx('Revenue Trend', 'Tendance des Revenus')}</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.dailyTrend}>
                        <defs>
                          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f8bf60" stopOpacity={0.65} />
                            <stop offset="95%" stopColor="#f8bf60" stopOpacity={0.08} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#f0dfcd" strokeDasharray="4 4" />
                        <XAxis dataKey="label" stroke="#9a7a5d" tickLine={false} axisLine={false} />
                        <YAxis stroke="#9a7a5d" tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            border: '1px solid #ead6c2',
                            backgroundColor: '#fffcf8',
                          }}
                          formatter={(value: number) => `${Number(value).toFixed(2)} TND`}
                          labelFormatter={(label: string) => `${tx('Date', 'Date')} : ${label}`}
                        />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="#d97706"
                          strokeWidth={2.5}
                          fill="url(#revenueFill)"
                          isAnimationActive
                          animationDuration={950}
                          animationEasing="ease-out"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className={analyticsChartCardClass}>
                  <h3 className="mb-3 text-base md:text-xl text-[#5a3418]">{tx('Sales per Hour', 'Ventes par Heure')}</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.hourlySales}>
                        <CartesianGrid stroke="#f0dfcd" strokeDasharray="4 4" />
                        <XAxis dataKey="label" stroke="#9a7a5d" tickLine={false} axisLine={false} />
                        <YAxis stroke="#9a7a5d" tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            border: '1px solid #ead6c2',
                            backgroundColor: '#fffcf8',
                          }}
                          formatter={(value: number, _name: string, item: any) =>
                            item?.dataKey === 'sales'
                              ? `${Number(value).toFixed(2)} TND`
                              : `${Number(value)} ${tx('order(s)', 'commande(s)')}`
                          }
                        />
                        <Legend />
                        <Bar dataKey="sales" name={tx('Sales (TND)', 'Ventes (TND)')} fill="#16a34a" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={900} />
                        <Bar dataKey="orders" name={tx('Orders', 'Commandes')} fill="#f8bf60" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={900} animationBegin={120} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className={analyticsChartCardClass}>
                  <h3 className="mb-3 text-base md:text-xl text-[#5a3418]">{tx('Best Sellers', 'Meilleures Ventes')}</h3>
                  {analytics.bestSellers.length > 0 ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.bestSellers} layout="vertical" margin={{ left: 10, right: 10 }}>
                          <CartesianGrid stroke="#f0dfcd" strokeDasharray="4 4" />
                          <XAxis type="number" stroke="#9a7a5d" tickLine={false} axisLine={false} />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={120}
                            stroke="#9a7a5d"
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: 12,
                              border: '1px solid #ead6c2',
                              backgroundColor: '#fffcf8',
                            }}
                            formatter={(value: number, key) =>
                              key === 'revenue'
                                ? `${Number(value).toFixed(2)} TND`
                                : `${Number(value)} ${tx('sold', 'vendus')}`
                            }
                          />
                          <Legend />
                          <Bar dataKey="quantity" name={tx('Sold Qty', 'Qte Vendue')} fill="#f59e0b" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={900} />
                          <Bar dataKey="revenue" name={tx('Revenue (TND)', 'Revenu (TND)')} fill="#d97706" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={900} animationBegin={120} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-base text-[#9a7a5d]">{tx('No sales data in the selected date range.', 'Aucune donnee de vente sur la periode selectionnee.')}</p>
                  )}
                </div>

                <div className={analyticsChartCardClass}>
                  <h3 className="mb-3 text-base md:text-xl text-[#5a3418]">{tx('Order Status Mix', 'Repartition des Statuts')}</h3>
                  {analytics.statusBreakdown.length > 0 ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analytics.statusBreakdown}
                            cx="50%"
                            cy="50%"
                            outerRadius={95}
                            dataKey="value"
                            nameKey="name"
                            label
                            isAnimationActive
                            animationDuration={920}
                          >
                            {analytics.statusBreakdown.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              borderRadius: 12,
                              border: '1px solid #ead6c2',
                              backgroundColor: '#fffcf8',
                            }}
                            formatter={(value: number) => `${Number(value)} ${tx('order(s)', 'commande(s)')}`}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-base text-[#9a7a5d]">{tx('No orders in the selected date range.', 'Aucune commande sur la periode selectionnee.')}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className={analyticsChartCardClass}>
                  <h3 className="mb-3 text-base md:text-xl text-[#5a3418]">{tx('Table Performance', 'Performance des Tables')}</h3>
                  {analytics.topTables.length > 0 ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={analytics.topTables}>
                          <CartesianGrid stroke="#f0dfcd" strokeDasharray="4 4" />
                          <XAxis dataKey="table" stroke="#9a7a5d" tickLine={false} axisLine={false} />
                          <YAxis
                            yAxisId="orders"
                            orientation="left"
                            stroke="#9a7a5d"
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                          />
                          <YAxis
                            yAxisId="revenue"
                            orientation="right"
                            stroke="#c2410c"
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value: number) => `${Number(value).toFixed(0)} TND`}
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: 12,
                              border: '1px solid #ead6c2',
                              backgroundColor: '#fffcf8',
                            }}
                            formatter={(value: number, name) =>
                              name === tx('Revenue', 'Revenu')
                                ? `${Number(value).toFixed(2)} TND`
                                : `${Number(value)} ${tx('order(s)', 'commande(s)')}`
                            }
                          />
                          <Legend />
                          <Bar
                            yAxisId="orders"
                            dataKey="orders"
                            name={tx('Orders', 'Commandes')}
                            fill="#f59e0b"
                            radius={[6, 6, 0, 0]}
                            barSize={26}
                            isAnimationActive
                            animationDuration={900}
                          />
                          <Line
                            yAxisId="revenue"
                            type="monotone"
                            dataKey="revenue"
                            name={tx('Revenue', 'Revenu')}
                            stroke="#c2410c"
                            strokeWidth={3}
                            dot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }}
                            activeDot={{ r: 6 }}
                            isAnimationActive
                            animationDuration={950}
                            animationBegin={120}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-base text-[#9a7a5d]">{tx('No table orders in the selected date range.', 'Aucune commande de table sur la periode selectionnee.')}</p>
                  )}
                </div>

                <div className={analyticsChartCardClass}>
                  <h3 className="mb-3 text-base md:text-xl text-[#5a3418]">{tx('Prime Cost Structure', 'Structure du Cout Principal')}</h3>
                  {analytics.costBreakdown.length > 0 ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analytics.costBreakdown}
                            cx="50%"
                            cy="50%"
                            outerRadius={95}
                            dataKey="value"
                            nameKey="name"
                            label
                            isAnimationActive
                            animationDuration={920}
                          >
                            {analytics.costBreakdown.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              borderRadius: 12,
                              border: '1px solid #ead6c2',
                              backgroundColor: '#fffcf8',
                            }}
                            formatter={(value: number) => `${Number(value).toFixed(2)} TND`}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-base text-[#9a7a5d]">{tx('No revenue data to display cost structure.', 'Aucune donnee de revenu pour afficher la structure des couts.')}</p>
                  )}
                </div>
              </div>
            </div>
          )}
          </div>
      </section>
    </div>
  );
}
