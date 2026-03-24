import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api, ApiCafeTable } from '../../../lib/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

function sortByTableNumber(tables: ApiCafeTable[]) {
  return [...tables].sort((a, b) => a.tableNumber - b.tableNumber);
}

type UiLanguage = 'en' | 'fr';

interface TableManagementProps {
  language: UiLanguage;
}

export function TableManagement({ language }: TableManagementProps) {
  const tx = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const [tables, setTables] = useState<ApiCafeTable[]>([]);
  const [tableCountInput, setTableCountInput] = useState('12');
  const [newTableNumberInput, setNewTableNumberInput] = useState('');
  const [newQrTokenInput, setNewQrTokenInput] = useState('');
  const [qrDrafts, setQrDrafts] = useState<Record<string, string>>({});
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const customerBaseUrl = useMemo(() => {
    if (typeof window === 'undefined') {
      return '';
    }
    return window.location.origin;
  }, []);

  const loadTables = async () => {
    setIsLoading(true);
    try {
      const rows = await api.getTables();
      const sorted = sortByTableNumber(rows);
      setTables(sorted);
      setQrDrafts(Object.fromEntries(sorted.map((table) => [table.id, table.qrToken])));
      if (sorted.length > 0) {
        setTableCountInput(String(sorted.length));
      }
    } catch (error) {
      console.error(error);
      toast.error(tx('Failed to load tables', 'Echec du chargement des tables'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadTables();
  }, []);

  const requestSuperAdminPass = (actionLabel: string): string | null => {
    const pass = window.prompt(tx(`Super Admin pass required to ${actionLabel}:`, `Mot de passe Super Admin requis pour ${actionLabel} :`));
    if (pass === null) {
      toast.error(tx('Action canceled', 'Action annulee'));
      return null;
    }
    if (!pass.trim()) {
      toast.error(tx('Pass is required', 'Mot de passe requis'));
      return null;
    }
    return pass;
  };

  const createCustomerUrl = (table: ApiCafeTable) => {
    const params = new URLSearchParams({
      table: String(table.tableNumber),
      qr: table.qrToken,
    });
    return `${customerBaseUrl}/?${params.toString()}`;
  };

  const createQrImageUrl = (table: ApiCafeTable) => {
    const customerUrl = createCustomerUrl(table);
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(customerUrl)}`;
  };

  const handleGenerateTables = async () => {
    const count = Number(tableCountInput);
    if (!Number.isInteger(count) || count < 1 || count > 200) {
      toast.error(tx('Please enter a table count between 1 and 200', 'Veuillez saisir un nombre de tables entre 1 et 200'));
      return;
    }

    const superAdminPass = requestSuperAdminPass(tx('change table count', 'modifier le nombre de tables'));
    if (!superAdminPass) {
      return;
    }

    setIsSaving(true);
    try {
      const result = await api.generateTablesWithPass(count, superAdminPass);
      setTables(sortByTableNumber(result.tables));
      setQrDrafts(Object.fromEntries(result.tables.map((table) => [table.id, table.qrToken])));
      toast.success(tx(`Table management updated: ${result.count} active table(s)`, `Gestion des tables mise a jour : ${result.count} table(s) active(s)`));
    } catch (error) {
      console.error(error);
      toast.error(tx('Failed to update table count (wrong pass or server error)', 'Echec de mise a jour du nombre de tables (mot de passe invalide ou erreur serveur)'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTable = async () => {
    const tableNumber = Number(newTableNumberInput);
    if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 500) {
      toast.error(tx('Table number must be between 1 and 500', 'Le numero de table doit etre entre 1 et 500'));
      return;
    }

    const superAdminPass = requestSuperAdminPass(tx('add a table', 'ajouter une table'));
    if (!superAdminPass) {
      return;
    }

    setIsSaving(true);
    try {
      await api.createTable({
        tableNumber,
        qrToken: newQrTokenInput.trim() || undefined,
        superAdminPass,
      });
      setNewTableNumberInput('');
      setNewQrTokenInput('');
      await loadTables();
      toast.success(tx(`Table ${tableNumber} added/updated`, `Table ${tableNumber} ajoutee/mise a jour`));
    } catch (error) {
      console.error(error);
      toast.error(tx('Failed to add table (wrong pass or duplicate table/QR)', 'Echec ajout table (mot de passe invalide ou table/QR duplique)'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateQr = async (table: ApiCafeTable) => {
    const nextQrToken = (qrDrafts[table.id] ?? '').trim();
    if (!nextQrToken) {
      toast.error(tx('QR token cannot be empty', 'Le token QR ne peut pas etre vide'));
      return;
    }

    const superAdminPass = requestSuperAdminPass(tx(`change QR code for table ${table.tableNumber}`, `modifier le code QR pour la table ${table.tableNumber}`));
    if (!superAdminPass) {
      return;
    }

    setIsSaving(true);
    try {
      await api.updateTableQr(table.id, nextQrToken, superAdminPass);
      await loadTables();
      toast.success(tx(`QR code updated for table ${table.tableNumber}`, `Code QR mis a jour pour la table ${table.tableNumber}`));
    } catch (error) {
      console.error(error);
      toast.error(tx('Failed to update QR code (wrong pass or duplicate QR token)', 'Echec mise a jour QR (mot de passe invalide ou token QR duplique)'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTable = async (table: ApiCafeTable) => {
    const confirmed = window.confirm(tx(`Delete table ${table.tableNumber}?`, `Supprimer la table ${table.tableNumber} ?`));
    if (!confirmed) {
      return;
    }

    const superAdminPass = requestSuperAdminPass(tx(`delete table ${table.tableNumber}`, `supprimer la table ${table.tableNumber}`));
    if (!superAdminPass) {
      return;
    }

    setIsSaving(true);
    try {
      await api.deleteTable(table.id, superAdminPass);
      await loadTables();
      toast.success(tx(`Table ${table.tableNumber} deleted`, `Table ${table.tableNumber} supprimee`));
    } catch (error) {
      console.error(error);
      toast.error(tx('Failed to delete table (wrong pass or server error)', 'Echec suppression table (mot de passe invalide ou erreur serveur)'));
    } finally {
      setIsSaving(false);
    }
  };

  const copyTableLink = async (table: ApiCafeTable) => {
    const url = createCustomerUrl(table);
    try {
      await navigator.clipboard.writeText(url);
      toast.success(tx(`Copied QR link for table ${table.tableNumber}`, `Lien QR copie pour la table ${table.tableNumber}`));
    } catch (error) {
      console.error(error);
      toast.error(tx('Could not copy link', 'Impossible de copier le lien'));
    }
  };

  const downloadQrImage = async (table: ApiCafeTable) => {
    try {
      const qrUrl = createQrImageUrl(table);
      const response = await fetch(qrUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch QR image');
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `table-${table.tableNumber}-qr.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);

      toast.success(tx(`QR image downloaded for table ${table.tableNumber}`, `Image QR telechargee pour la table ${table.tableNumber}`));
    } catch (error) {
      console.error(error);
      toast.error(tx('Failed to download QR image', 'Echec telechargement image QR'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#ead6c2] bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl text-[#5a3418]">{tx('Table Management', 'Gestion des Tables')}</h2>
            <p className="mt-1 text-sm text-[#9a7a5d]">
              {tx('Configure how many tables exist and generate a QR link for each table.', 'Configurez le nombre de tables et generez un lien QR pour chaque table.')}
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setIsManageOpen((prev) => !prev)}
            className="h-11 !bg-amber-600 !text-white hover:!bg-amber-700"
          >
            {isManageOpen ? tx('Close Manage', 'Fermer Gestion') : tx('Manage', 'Gerer')}
          </Button>
        </div>

        {isManageOpen && (
          <>
            <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
              <div>
                <Label htmlFor="table-count" className="text-[#7a5539]">{tx('Number of Tables', 'Nombre de Tables')}</Label>
                <Input
                  id="table-count"
                  type="number"
                  min={1}
                  max={200}
                  value={tableCountInput}
                  onChange={(e) => setTableCountInput(e.target.value)}
                  className="mt-2 h-11 !border-[#d9c0a4] !bg-[#fffcf8] !text-[#5a3418]"
                />
              </div>
              <Button
                type="button"
                onClick={handleGenerateTables}
                disabled={isSaving}
                className="h-11 !bg-amber-600 !text-white hover:!bg-amber-700"
              >
                {isSaving ? tx('Updating...', 'Mise a jour...') : tx('Apply Count', 'Appliquer Nombre')}
              </Button>
              <Button
                type="button"
                onClick={() => void loadTables()}
                variant="outline"
                disabled={isLoading}
                className="h-11 !border-[#d9c0a4] !bg-[#fffcf8] !text-[#5a3418] hover:!bg-[#f8ecd9]"
              >
                {isLoading ? tx('Refreshing...', 'Actualisation...') : tx('Refresh', 'Actualiser')}
              </Button>
            </div>

            <div className="mt-6 border-t border-[#f0dfcd] pt-5">
              <p className="mb-3 text-sm text-[#9a7a5d]">{tx('Add Single Table', 'Ajouter Une Table')}</p>
              <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-end">
                <div>
                  <Label htmlFor="new-table-number" className="text-[#7a5539]">{tx('Table Number', 'Numero de Table')}</Label>
                  <Input
                    id="new-table-number"
                    type="number"
                    min={1}
                    max={500}
                    value={newTableNumberInput}
                    onChange={(e) => setNewTableNumberInput(e.target.value)}
                    className="mt-2 h-11 !border-[#d9c0a4] !bg-[#fffcf8] !text-[#5a3418]"
                  />
                </div>
                <div>
                  <Label htmlFor="new-table-qr" className="text-[#7a5539]">{tx('QR Token (optional)', 'Token QR (optionnel)')}</Label>
                  <Input
                    id="new-table-qr"
                    value={newQrTokenInput}
                    onChange={(e) => setNewQrTokenInput(e.target.value)}
                    placeholder="table-25"
                    className="mt-2 h-11 !border-[#d9c0a4] !bg-[#fffcf8] !text-[#5a3418] placeholder:!text-[#9a7a5d]"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleAddTable}
                  disabled={isSaving}
                  className="h-11 !bg-amber-600 !text-white hover:!bg-amber-700"
                >
                  {tx('Add Table', 'Ajouter Table')}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="rounded-xl border border-[#ead6c2] bg-white p-4 shadow-sm">
        <p className="text-sm text-[#9a7a5d]">
          {tx('Active Tables', 'Tables Actives')} : <span className="text-lg text-[#5a3418]">{tables.length}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tables.map((table) => {
          const customerUrl = createCustomerUrl(table);
          return (
            <div key={table.id} className="rounded-xl border border-[#ead6c2] bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg text-[#5a3418]">{tx('Table', 'Table')} {table.tableNumber}</h3>
                <span className="rounded-full bg-[#fff4e6] px-3 py-1 text-xs text-[#7a5539]">{tx('QR Ready', 'QR Pret')}</span>
              </div>

              <img
                src={createQrImageUrl(table)}
                alt={`QR code for table ${table.tableNumber}`}
                className="mx-auto mb-3 h-40 w-40 rounded-lg border border-[#f0dfcd]"
              />

              <p className="mb-3 break-all text-xs text-[#9a7a5d]">{customerUrl}</p>

              <Label htmlFor={`qr-token-${table.id}`} className="mb-1 block text-xs text-[#7a5539]">
                {tx('QR Token', 'Token QR')}
              </Label>
              <Input
                id={`qr-token-${table.id}`}
                value={qrDrafts[table.id] ?? table.qrToken}
                onChange={(e) =>
                  setQrDrafts((prev) => ({
                    ...prev,
                    [table.id]: e.target.value,
                  }))
                }
                className="mb-3 h-10 !border-[#d9c0a4] !bg-[#fffcf8] !text-[#5a3418]"
              />

              <div className="mb-2 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  onClick={() => void copyTableLink(table)}
                  variant="outline"
                  className="w-full !border-[#d9c0a4] !bg-[#fffcf8] !text-[#5a3418] hover:!bg-[#f8ecd9]"
                >
                  {tx('Copy Link', 'Copier Lien')}
                </Button>
                <Button
                  type="button"
                  onClick={() => void downloadQrImage(table)}
                  variant="outline"
                  className="w-full !border-[#d9c0a4] !bg-[#fffcf8] !text-[#5a3418] hover:!bg-[#f8ecd9]"
                >
                  {tx('Download QR', 'Telecharger QR')}
                </Button>
                <Button
                  asChild
                  className="col-span-2 w-full !bg-amber-600 !text-white hover:!bg-amber-700"
                >
                  <a href={customerUrl} target="_blank" rel="noreferrer">
                    {tx('Open', 'Ouvrir')}
                  </a>
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => void handleUpdateQr(table)}
                  variant="outline"
                  className="flex-1 !border-[#d9c0a4] !bg-[#fffcf8] !text-[#5a3418] hover:!bg-[#f8ecd9]"
                >
                  {tx('Change QR', 'Changer QR')}
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleDeleteTable(table)}
                  variant="outline"
                  className="flex-1 !border-[#f1b8b8] !bg-[#fffcf8] !text-[#b42323] hover:!bg-[#fff4f4]"
                >
                  {tx('Delete', 'Supprimer')}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {tables.length === 0 && !isLoading && (
        <p className="text-sm text-zinc-500">{tx('No active tables. Set a count above to generate table QR links.', 'Aucune table active. Definissez un nombre ci-dessus pour generer les liens QR.')}</p>
      )}
    </div>
  );
}
