import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { api, AppSettingsPayload } from '../../../lib/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';

type UiLanguage = 'en' | 'fr';

interface AppSettingsPanelProps {
  language: UiLanguage;
  onBusinessNameChange?: (name: string) => void;
  onPricingSettingsChange?: (settings: { taxRate: number; serviceCharge: number; currencyCode: string }) => void;
  pricingSettings?: { taxRate: number; serviceCharge: number; currencyCode: string };
  foodCostRateInput: string;
  onFoodCostRateInputChange: (value: string) => void;
  numberOfWorkersInput: string;
  onNumberOfWorkersInputChange: (value: string) => void;
  wagePerShiftInput: string;
  onWagePerShiftInputChange: (value: string) => void;
  workingHoursStartInput: string;
  onWorkingHoursStartInputChange: (value: string) => void;
  workingHoursEndInput: string;
  onWorkingHoursEndInputChange: (value: string) => void;
}

const DEFAULT_SETTINGS: AppSettingsPayload = {
  businessName: 'The Local Cafe',
  currencyCode: 'TND',
  taxRate: 0,
  serviceCharge: 0,
  defaultLanguage: 'en',
  enableOrderNotifications: true,
};

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function AppSettingsPanel({
  language,
  onBusinessNameChange,
  onPricingSettingsChange,
  pricingSettings,
  foodCostRateInput,
  onFoodCostRateInputChange,
  numberOfWorkersInput,
  onNumberOfWorkersInputChange,
  wagePerShiftInput,
  onWagePerShiftInputChange,
  workingHoursStartInput,
  onWorkingHoursStartInputChange,
  workingHoursEndInput,
  onWorkingHoursEndInputChange,
}: AppSettingsPanelProps) {
  const tx = (en: string, fr: string) => (language === 'fr' ? fr : en);

  const [superAdminPass, setSuperAdminPass] = useState('');
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settings, setSettings] = useState<AppSettingsPayload>(DEFAULT_SETTINGS);

  const pushPricingPreview = (nextValues: {
    taxRate?: number;
    serviceCharge?: number;
    currencyCode?: string;
  }) => {
    onPricingSettingsChange?.({
      taxRate: Number(nextValues.taxRate ?? settings.taxRate) || 0,
      serviceCharge: Number(nextValues.serviceCharge ?? settings.serviceCharge) || 0,
      currencyCode: String(nextValues.currencyCode ?? settings.currencyCode ?? 'TND').trim().toUpperCase() || 'TND',
    });
  };

  useEffect(() => {
    if (!pricingSettings) {
      return;
    }

    setSettings((previous) => {
      const nextTaxRate = Number(pricingSettings.taxRate) || 0;
      const nextServiceCharge = Number(pricingSettings.serviceCharge) || 0;
      const nextCurrencyCode = String(pricingSettings.currencyCode || 'TND').trim().toUpperCase() || 'TND';

      if (
        Number(previous.taxRate) === nextTaxRate &&
        Number(previous.serviceCharge) === nextServiceCharge &&
        String(previous.currencyCode || 'TND').trim().toUpperCase() === nextCurrencyCode
      ) {
        return previous;
      }

      return {
        ...previous,
        taxRate: nextTaxRate,
        serviceCharge: nextServiceCharge,
        currencyCode: nextCurrencyCode,
      };
    });
  }, [pricingSettings]);

  useEffect(() => {
    let cancelled = false;

    const loadPublicDefaults = async () => {
      try {
        const publicSettings = await api.getPublicSettings();
        if (cancelled) {
          return;
        }

        setSettings((previous) => ({
          ...previous,
          businessName: publicSettings.businessName || previous.businessName,
          currencyCode: pricingSettings ? previous.currencyCode : (publicSettings.currencyCode || previous.currencyCode),
          taxRate: pricingSettings ? previous.taxRate : (Number(publicSettings.taxRate) || 0),
          serviceCharge: pricingSettings ? previous.serviceCharge : (Number(publicSettings.serviceCharge) || 0),
        }));
      } catch {
        // Keep defaults when public settings cannot be fetched.
      }
    };

    void loadPublicDefaults();

    return () => {
      cancelled = true;
    };
  }, [pricingSettings]);

  const handleLoadSettings = async () => {
    const pass = superAdminPass.trim();
    if (!pass) {
      toast.error(tx('Super admin password is required', 'Le mot de passe super admin est requis'));
      return;
    }

    setIsLoadingSettings(true);
    try {
      const response = await api.readAppSettings(pass);
      setSettings(response.settings);
      onPricingSettingsChange?.({
        taxRate: Number(response.settings.taxRate) || 0,
        serviceCharge: Number(response.settings.serviceCharge) || 0,
        currencyCode: String(response.settings.currencyCode || 'TND').trim().toUpperCase() || 'TND',
      });
      toast.success(tx('Settings loaded', 'Parametres charges'));
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : tx('Failed to load settings', 'Echec du chargement des parametres');
      toast.error(message);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handleSaveSettings = async () => {
    const pass = superAdminPass.trim();
    if (!pass) {
      toast.error(tx('Super admin password is required', 'Le mot de passe super admin est requis'));
      return;
    }

    const normalizedPayload: AppSettingsPayload = {
      businessName: settings.businessName.trim(),
      currencyCode: settings.currencyCode.trim().toUpperCase() || 'TND',
      taxRate: clampNumber(Number(settings.taxRate) || 0, 0, 100),
      serviceCharge: clampNumber(Number(settings.serviceCharge) || 0, 0, 100),
      defaultLanguage: settings.defaultLanguage === 'fr' ? 'fr' : 'en',
      enableOrderNotifications: !!settings.enableOrderNotifications,
    };

    setIsSavingSettings(true);
    try {
      const response = await api.updateAppSettings(pass, normalizedPayload);
      setSettings(response.settings);
      onBusinessNameChange?.(response.settings.businessName);
      onPricingSettingsChange?.({
        taxRate: Number(response.settings.taxRate) || 0,
        serviceCharge: Number(response.settings.serviceCharge) || 0,
        currencyCode: String(response.settings.currencyCode || 'TND').trim().toUpperCase() || 'TND',
      });
      toast.success(tx('Settings saved', 'Parametres enregistres'));
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : tx('Failed to save settings', 'Echec de la sauvegarde des parametres');
      toast.error(message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleResetForm = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  const [isExporting, setIsExporting] = useState<'csv' | 'xlsx' | null>(null);

  const fetchAllAuditLogs = async () => {
    const rows = await api.getMenuAuditLogs(200);
    return rows.map((log) => ({
      ID: log.id,
      Event: log.eventType,
      'Item ID': log.menuItemId,
      'Item Name': log.menuItemName,
      'Changed Fields': log.changedFields.join(', '),
      'Previous Values': log.previousValues ? JSON.stringify(log.previousValues) : '',
      'New Values': log.newValues ? JSON.stringify(log.newValues) : '',
      Timestamp: log.createdAt,
    }));
  };

  const handleExportCSV = async () => {
    setIsExporting('csv');
    try {
      const data = await fetchAllAuditLogs();
      if (data.length === 0) {
        toast.info(tx('No audit logs to export yet.', 'Aucun log a exporter pour le moment.'));
        return;
      }
      const headers = Object.keys(data[0]);
      const csvRows = [
        headers.join(','),
        ...data.map((row) =>
          headers
            .map((key) => {
              const value = String((row as Record<string, unknown>)[key] ?? '');
              const escaped = value.replace(/"/g, '""');
              return /[,"\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
            })
            .join(',')
        ),
      ].join('\r\n');

      const blob = new Blob(['\uFEFF' + csvRows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      toast.success(tx('CSV downloaded.', 'CSV telecharge.'));
    } catch (error) {
      toast.error(tx('Failed to export CSV.', 'Echec de l\'export CSV.'));
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting('xlsx');
    try {
      const data = await fetchAllAuditLogs();
      if (data.length === 0) {
        toast.info(tx('No audit logs to export yet.', 'Aucun log a exporter pour le moment.'));
        return;
      }
      const worksheet = XLSX.utils.json_to_sheet(data);
      const colWidths = Object.keys(data[0]).map((key) => ({
        wch: Math.max(key.length, ...data.map((row) => String((row as Record<string, unknown>)[key] ?? '').length), 10),
      }));
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Logs');
      XLSX.writeFile(workbook, `audit-logs-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(tx('Excel file downloaded.', 'Fichier Excel telecharge.'));
    } catch (error) {
      toast.error(tx('Failed to export Excel.', 'Echec de l\'export Excel.'));
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#ead6c2] bg-white p-5 shadow-sm">
        <h2 className="text-2xl text-[#5a3418]">{tx('App Settings', 'Parametres Application')}</h2>
        <p className="mt-1 text-sm text-[#9a7a5d]">
          {tx(
            'Manage global app behavior, taxes, and language defaults.',
            'Gerez le comportement global, les taxes et la langue par defaut.'
          )}
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <Label htmlFor="super-admin-pass" className="text-[#7a5539]">
              {tx('Super Admin Password', 'Mot de passe Super Admin')}
            </Label>
            <Input
              id="super-admin-pass"
              type="password"
              value={superAdminPass}
              onChange={(event) => setSuperAdminPass(event.target.value)}
              placeholder={tx('Enter super admin password', 'Entrez le mot de passe super admin')}
              className="mt-2 h-11 !border-[#d9c0a4] !bg-[#fffcf8] !text-[#5a3418]"
            />
          </div>
          <Button
            type="button"
            onClick={() => void handleLoadSettings()}
            disabled={isLoadingSettings}
            className="h-11 !bg-amber-600 !text-white hover:!bg-amber-700"
          >
            {isLoadingSettings ? tx('Loading...', 'Chargement...') : tx('Load Settings', 'Charger Parametres')}
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="business-name" className="text-[#7a5539]">
              {tx('Business Name', 'Nom du commerce')}
            </Label>
            <Input
              id="business-name"
              value={settings.businessName}
              onChange={(event) => {
                const nextBusinessName = event.target.value;
                setSettings((previous) => ({
                  ...previous,
                  businessName: nextBusinessName,
                }));
                onBusinessNameChange?.(nextBusinessName);
              }}
              className="mt-2 h-11 !border-[#d9c0a4] !bg-[#fffcf8] !text-[#5a3418]"
            />
          </div>

          <div>
            <Label htmlFor="currency-code" className="text-[#7a5539]">
              {tx('Currency Code', 'Code devise')}
            </Label>
            <Input
              id="currency-code"
              value={settings.currencyCode}
              onChange={(event) => {
                const nextCurrencyCode = event.target.value;
                setSettings((previous) => ({
                  ...previous,
                  currencyCode: nextCurrencyCode,
                }));
                pushPricingPreview({ currencyCode: nextCurrencyCode });
              }}
              placeholder="TND"
              className="mt-2 h-11 !border-[#d9c0a4] !bg-[#fffcf8] !text-[#5a3418]"
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 rounded-xl border border-[#f0dfcd] bg-[#fffaf4] p-4 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-sm font-medium text-[#7a5539]">{tx('Default Language', 'Langue par defaut')}</p>
            <div className="mt-2 inline-flex rounded-full border border-[#e2c29a] bg-[#fff9f2] p-1">
              <button
                type="button"
                onClick={() =>
                  setSettings((previous) => ({
                    ...previous,
                    defaultLanguage: 'en',
                  }))
                }
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  settings.defaultLanguage === 'en'
                    ? 'bg-[#f8bf60] text-[#2f1f14]'
                    : 'text-[#7a5539] hover:bg-[#f4e5d2]'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() =>
                  setSettings((previous) => ({
                    ...previous,
                    defaultLanguage: 'fr',
                  }))
                }
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  settings.defaultLanguage === 'fr'
                    ? 'bg-[#f8bf60] text-[#2f1f14]'
                    : 'text-[#7a5539] hover:bg-[#f4e5d2]'
                }`}
              >
                FR
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-[#ead6c2] bg-white px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[#7a5539]">
                {tx('Order Notifications', 'Notifications des commandes')}
              </p>
              <p className="text-xs text-[#9a7a5d]">
                {tx('Enable operational alerts for incoming orders.', 'Activer les alertes operationnelles pour les nouvelles commandes.')}
              </p>
            </div>
            <Switch
              checked={settings.enableOrderNotifications}
              onCheckedChange={(checked) =>
                setSettings((previous) => ({
                  ...previous,
                  enableOrderNotifications: !!checked,
                }))
              }
            />
          </div>
        </div>

      </div>

      <div className="rounded-xl border border-[#ead6c2] bg-white p-5 shadow-sm">
        <h3 className="text-lg text-[#5a3418]">{tx('Analytics Assumptions', 'Hypotheses Analytiques')}</h3>
        <p className="mt-1 text-sm text-[#9a7a5d]">
          {tx(
            'Configure food and labor assumptions used in Analytics calculations.',
            'Configurez les hypotheses alimentaires et main-d\'oeuvre utilisees dans les calculs analytiques.'
          )}
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="settings-tax-rate" className="text-[#7a5539]">
              {tx('Tax Rate (%)', 'Taux de taxe (%)')}
            </Label>
            <Input
              id="settings-tax-rate"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={settings.taxRate}
              onChange={(event) => {
                const nextTaxRate = Number(event.target.value);
                setSettings((previous) => ({
                  ...previous,
                  taxRate: nextTaxRate,
                }));
                pushPricingPreview({ taxRate: nextTaxRate });
              }}
              className="mt-2 h-11 !border-[#d9c0a4] !bg-[#fffcf8] !text-[#5a3418]"
            />
          </div>

          <div>
            <Label htmlFor="settings-service-charge" className="text-[#7a5539]">
              {tx('Service Charge (%)', 'Frais de service (%)')}
            </Label>
            <Input
              id="settings-service-charge"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={settings.serviceCharge}
              onChange={(event) => {
                const nextServiceCharge = Number(event.target.value);
                setSettings((previous) => ({
                  ...previous,
                  serviceCharge: nextServiceCharge,
                }));
                pushPricingPreview({ serviceCharge: nextServiceCharge });
              }}
              className="mt-2 h-11 !border-[#d9c0a4] !bg-[#fffcf8] !text-[#5a3418]"
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="settings-food-cost-rate" className="text-[#7a5539]">
              {tx('Food Cost % (Assumption)', 'Cout Alimentaire % (Hypothese)')}
            </Label>
            <Input
              id="settings-food-cost-rate"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={foodCostRateInput}
              onChange={(event) => onFoodCostRateInputChange(event.target.value)}
              className="mt-2 h-11 !border-[#d9c0a4] !bg-[#fffcf8] !text-[#5a3418]"
            />
          </div>

          <div>
            <Label htmlFor="settings-number-of-workers" className="text-[#7a5539]">
              {tx('Number of Workers', 'Nombre de Travailleurs')}
            </Label>
            <Input
              id="settings-number-of-workers"
              type="number"
              min={0}
              step={1}
              value={numberOfWorkersInput}
              onChange={(event) => onNumberOfWorkersInputChange(event.target.value)}
              className="mt-2 h-11 !border-[#d9c0a4] !bg-[#fffcf8] !text-[#5a3418]"
            />
          </div>

          <div>
            <Label htmlFor="settings-wage-per-shift" className="text-[#7a5539]">
              {tx('Wage per Day (TND)', 'Salaire par Jour (TND)')}
            </Label>
            <Input
              id="settings-wage-per-shift"
              type="number"
              min={0}
              step={0.5}
              value={wagePerShiftInput}
              onChange={(event) => onWagePerShiftInputChange(event.target.value)}
              className="mt-2 h-11 !border-[#d9c0a4] !bg-[#fffcf8] !text-[#5a3418]"
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="settings-working-hours-start" className="text-[#7a5539]">
              {tx('Working Hours Start', 'Debut des heures de travail')}
            </Label>
            <Input
              id="settings-working-hours-start"
              type="time"
              value={workingHoursStartInput}
              onChange={(event) => onWorkingHoursStartInputChange(event.target.value)}
              className="mt-2 h-11 !border-[#d9c0a4] !bg-[#fffcf8] !text-[#5a3418]"
            />
          </div>

          <div>
            <Label htmlFor="settings-working-hours-end" className="text-[#7a5539]">
              {tx('Working Hours End', 'Fin des heures de travail')}
            </Label>
            <Input
              id="settings-working-hours-end"
              type="time"
              value={workingHoursEndInput}
              onChange={(event) => onWorkingHoursEndInputChange(event.target.value)}
              className="mt-2 h-11 !border-[#d9c0a4] !bg-[#fffcf8] !text-[#5a3418]"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border border-[#ead6c2] bg-[#fffaf4] p-5 shadow-sm">
        <Button
          type="button"
          onClick={() => void handleSaveSettings()}
          disabled={isSavingSettings}
          className="h-11 !bg-amber-600 !text-white hover:!bg-amber-700"
        >
          {isSavingSettings ? tx('Saving...', 'Sauvegarde...') : tx('Save Settings', 'Enregistrer Parametres')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleResetForm}
          className="h-11 !border-[#d9c0a4] !bg-[#fffcf8] !text-[#5a3418] hover:!bg-[#f8ecd9]"
        >
          {tx('Reset Form', 'Reinitialiser le formulaire')}
        </Button>
      </div>

      <div className="rounded-xl border border-[#ead6c2] bg-white p-5 shadow-sm">
        <h3 className="text-lg text-[#5a3418]">{tx('Audit Log Export', 'Export du journal des modifications')}</h3>
        <p className="mt-1 text-sm text-[#9a7a5d]">
          {tx(
            'Download the full menu change history (price changes, additions, removals) as a file.',
            'Telechargez l\'historique complet des modifications du menu (changements de prix, ajouts, suppressions) sous forme de fichier.'
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => void handleExportCSV()}
            disabled={isExporting !== null}
            className="h-11 !bg-emerald-600 !text-white hover:!bg-emerald-700"
          >
            {isExporting === 'csv'
              ? tx('Exporting...', 'Export...')
              : tx('Download CSV', 'Telecharger CSV')}
          </Button>
          <Button
            type="button"
            onClick={() => void handleExportExcel()}
            disabled={isExporting !== null}
            className="h-11 !bg-blue-600 !text-white hover:!bg-blue-700"
          >
            {isExporting === 'xlsx'
              ? tx('Exporting...', 'Export...')
              : tx('Download Excel (.xlsx)', 'Telecharger Excel (.xlsx)')}
          </Button>
        </div>
      </div>
    </div>
  );
}
