import { useEffect, useMemo, useState } from 'react';
import { useMenu } from '../../context/MenuContext';
import { MenuItem } from '../../context/CartContext';
import { Plus, Edit, Trash2, LayoutGrid, List } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
// Removed Cropper and Area import
import { toast } from 'sonner';
import { api, type ApiMenuAuditLog } from '../../../lib/api';

type UiLanguage = 'en' | 'fr';

interface MenuManagementProps {
  language: UiLanguage;
}

const DEFAULT_MENU_IMAGE = 'https://via.placeholder.com/800x600.png?text=Menu+Item';

function hasAllowedImageExtension(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return false;
  const cleanPath = trimmed.split('#')[0].split('?')[0];
  return /\.(jpe?g|png)$/i.test(cleanPath);
}

function hasAllowedImageFile(file: File) {
  if (['image/jpeg', 'image/jpg', 'image/png', 'image/pjpeg', 'image/x-png'].includes(file.type)) {
    return true;
  }
  return /\.(jpe?g|png)$/i.test(file.name);
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read image'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
}

async function cropAndResizeImageToBlob(
  imageSource: string,
  croppedAreaPixels: Area,
  targetWidth: number
): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = imageSource;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Failed to load image for crop'));
  });

  const safeTargetWidth = Math.max(240, Math.round(targetWidth));
  const targetHeight = Math.max(
    180,
    Math.round((safeTargetWidth * croppedAreaPixels.height) / Math.max(1, croppedAreaPixels.width))
  );

  const canvas = document.createElement('canvas');
  canvas.width = safeTargetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to create image canvas');
  }

  context.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    safeTargetWidth,
    targetHeight
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), 'image/jpeg', 0.92);
  });

  if (!blob) {
    throw new Error('Failed to process cropped image');
  }

  return blob;
}

export function MenuManagement({ language }: MenuManagementProps) {
  const tx = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const { menuItems, addMenuItem, updateMenuItem, deleteMenuItem } = useMenu();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [imageInputMode, setImageInputMode] = useState<'url' | 'upload'>('url');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isPreparingCrop, setIsPreparingCrop] = useState(false);
  const [selectedUploadDataUrl, setSelectedUploadDataUrl] = useState('');
  // Removed crop, zoom, resizeWidth, croppedAreaPixels; images will be uploaded as-is
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: 'coffee' as 'coffee' | 'tea' | 'food' | 'milkshake' | 'cocktail',
    image: '',
    isNew: false,
  });
  const [auditLogs, setAuditLogs] = useState<ApiMenuAuditLog[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState(false);

  const handleOpenDialog = (item?: MenuItem) => {
    setImageInputMode('url');
    setIsUploadingImage(false);
    setSelectedUploadDataUrl('');
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        description: item.description,
        price: item.price.toString(),
        category: item.category,
        image: item.image,
        isNew: !!item.isNew,
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        description: '',
        price: '',
        category: 'coffee',
        image: '',
        isNew: false,
      });
    }
    setIsDialogOpen(true);
  };

  const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!hasAllowedImageFile(file)) {
      toast.error(tx('Only JPEG/PNG files are allowed.', 'Seuls les fichiers JPEG/PNG sont autorises.'));
      event.target.value = '';
      return;
    }
    setIsUploadingImage(true);
    try {
      const uploadedImageUrl = await api.uploadMenuImage(file);
      setFormData((previous) => ({ ...previous, image: uploadedImageUrl }));
      toast.success(tx('Image uploaded successfully.', 'Image telechargee avec succes.'));
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : tx('Failed to upload image.', 'Echec du telechargement de l\'image.');
      toast.error(message);
    } finally {
      setIsUploadingImage(false);
      event.target.value = '';
    }
  };

  const handleUploadCroppedImage = async () => {
    if (!selectedUploadDataUrl || !croppedAreaPixels) {
      toast.error(tx('Select and crop an image first.', 'Selectionnez et recadrez une image d\'abord.'));
      return;
    }

    setIsUploadingImage(true);
    try {
      const blob = await cropAndResizeImageToBlob(selectedUploadDataUrl, croppedAreaPixels, resizeWidth);
      const uploadFile = new File([blob], `menu-image-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const uploadedImageUrl = await api.uploadMenuImage(uploadFile);
      setFormData((previous) => ({
        ...previous,
        image: uploadedImageUrl,
      }));
      setSelectedUploadDataUrl('');
      setCroppedAreaPixels(null);
      toast.success(tx('Image uploaded successfully.', 'Image telechargee avec succes.'));
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : tx('Failed to upload image.', 'Echec du telechargement de l\'image.');
      toast.error(message);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (imageInputMode === 'upload' && selectedUploadDataUrl) {
      toast.error(tx('Please upload the cropped image first.', 'Veuillez televerser l\'image recadree d\'abord.'));
      return;
    }

    const normalizedImage = (formData.image || DEFAULT_MENU_IMAGE).trim();
    if (!hasAllowedImageExtension(normalizedImage)) {
      toast.error(tx('Image must be a JPEG or PNG URL.', 'L\'image doit etre une URL JPEG ou PNG.'));
      return;
    }

    const itemData = {
      name: formData.name,
      description: formData.description,
      price: parseFloat(formData.price),
      category: formData.category,
      image: normalizedImage,
      isNew: formData.isNew,
    };

    if (editingItem) {
      updateMenuItem(editingItem.id, itemData);
    } else {
      addMenuItem(itemData);
    }

    setIsDialogOpen(false);
    window.setTimeout(() => {
      void loadAuditLogs();
    }, 500);
  };

  const handleDeleteMenuItem = (id: string) => {
    deleteMenuItem(id);
    window.setTimeout(() => {
      void loadAuditLogs();
    }, 500);
  };

  const filteredMenuItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return menuItems;

    return menuItems.filter((item) => {
      return (
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
      );
    });
  }, [menuItems, searchQuery]);

  const applySearch = () => {
    setSearchQuery(searchInput);
  };

  const categoryLabel = (category: MenuItem['category']) => {
    switch (category) {
      case 'coffee':
        return tx('Coffee', 'Cafe');
      case 'tea':
        return tx('Tea', 'The');
      case 'milkshake':
        return tx('Milkshake', 'Milkshake');
      case 'cocktail':
        return tx('Cocktail', 'Cocktail');
      case 'food':
        return tx('Food', 'Nourriture');
      default:
        return category;
    }
  };

  const auditEventLabel = (eventType: string) => {
    switch (eventType) {
      case 'item_added':
        return tx('Item added', 'Article ajoute');
      case 'price_changed':
        return tx('Price changed', 'Prix modifie');
      case 'item_deleted':
        return tx('Item removed', 'Article retire');
      case 'item_updated':
        return tx('Item updated', 'Article modifie');
      default:
        return tx('Item changed', 'Article modifie');
    }
  };

  const auditEventStyle = (eventType: string) => {
    if (eventType === 'item_added') return 'bg-emerald-100 text-emerald-700';
    if (eventType === 'price_changed') return 'bg-amber-100 text-amber-800';
    if (eventType === 'item_deleted') return 'bg-rose-100 text-rose-700';
    return 'bg-zinc-100 text-zinc-700';
  };

  const formatAuditSummary = (log: ApiMenuAuditLog) => {
    const previousPrice = Number(log.previousValues?.price);
    const nextPrice = Number(log.newValues?.price);

    if (log.eventType === 'price_changed' && Number.isFinite(previousPrice) && Number.isFinite(nextPrice)) {
      return tx(
        `Price: ${previousPrice.toFixed(2)} TND -> ${nextPrice.toFixed(2)} TND`,
        `Prix : ${previousPrice.toFixed(2)} TND -> ${nextPrice.toFixed(2)} TND`
      );
    }

    if (log.changedFields.length === 0) {
      return tx('No field details available.', 'Aucun detail disponible.');
    }

    return tx('Changed fields', 'Champs modifies') + `: ${log.changedFields.join(', ')}`;
  };

  const formatAuditDate = (rawDate: string) => {
    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) {
      return rawDate;
    }

    return parsed.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl text-zinc-900">{tx('Menu Items', 'Articles Menu')}</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => handleOpenDialog()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              {tx('Add Item', 'Ajouter Article')}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white border-zinc-200">
            <DialogHeader>
              <DialogTitle className="text-zinc-900">
                {editingItem ? tx('Edit Menu Item', 'Modifier Article') : tx('Add Menu Item', 'Ajouter Article')}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-zinc-700">{tx('Name', 'Nom')}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-white border-zinc-300 text-zinc-900"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description" className="text-zinc-700">{tx('Description', 'Description')}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-white border-zinc-300 text-zinc-900"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price" className="text-zinc-700">{tx('Price (TND)', 'Prix (TND)')}</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="bg-white border-zinc-300 text-zinc-900"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="category" className="text-zinc-700">{tx('Category', 'Categorie')}</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value: 'coffee' | 'tea' | 'food' | 'milkshake' | 'cocktail') =>
                      setFormData({ ...formData, category: value })
                    }
                  >
                    <SelectTrigger className="bg-white border-zinc-300 text-zinc-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-zinc-200">
                      <SelectItem value="coffee">{tx('Coffee', 'Cafe')}</SelectItem>
                      <SelectItem value="cold-coffee-frappe">{tx('Cold Coffee & Frappe', 'Cafe Frappe')}</SelectItem>
                      <SelectItem value="chocolate-drinks">{tx('Chocolate Drinks', 'Boissons Chocolat')}</SelectItem>
                      <SelectItem value="fresh-drinks">{tx('Fresh Drinks', 'Boissons Fraiches')}</SelectItem>
                      <SelectItem value="soft-drinks">{tx('Soft Drinks', 'Boissons Gazeuses')}</SelectItem>
                      <SelectItem value="cakes">{tx('Cakes', 'Gateaux')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="image" className="text-zinc-700">{tx('Image URL', 'URL Image')}</Label>
                <div className="mt-2 inline-flex rounded-full border border-[#e2c29a] bg-[#fff9f2] p-1">
                  <button
                    type="button"
                    onClick={() => setImageInputMode('url')}
                    className={`rounded-full px-3 py-1 text-xs transition-colors ${
                      imageInputMode === 'url'
                        ? 'bg-[#f8bf60] text-[#2f1f14]'
                        : 'text-[#7a5539] hover:bg-[#f4e5d2]'
                    }`}
                  >
                    {tx('By URL', 'Par URL')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageInputMode('upload')}
                    className={`rounded-full px-3 py-1 text-xs transition-colors ${
                      imageInputMode === 'upload'
                        ? 'bg-[#f8bf60] text-[#2f1f14]'
                        : 'text-[#7a5539] hover:bg-[#f4e5d2]'
                    }`}
                  >
                    {tx('Browse & Upload', 'Parcourir & Televerser')}
                  </button>
                </div>

                {imageInputMode === 'url' ? (
                  <Input
                    id="image"
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                    className="mt-2 bg-white border-zinc-300 text-zinc-900"
                    placeholder="https://example.com/image.png"
                  />
                ) : (
                  <div className="mt-2 space-y-3">
                    <Input
                      id="image-file"
                      type="file"
                      accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                      onChange={(event) => void handleImageFileChange(event)}
                      className="bg-white border-zinc-300 text-zinc-900"
                    />

                    {/* Removed cropper, zoom, resize, and upload cropped image UI; images will be uploaded as-is */}

                    <p className="text-xs text-zinc-500">
                      {isPreparingCrop
                        ? tx('Preparing image...', 'Preparation de l\'image...')
                        : tx('Choose JPEG/PNG, then crop and resize before upload.', 'Choisissez JPEG/PNG, puis recadrez et redimensionnez avant televersement.')}
                    </p>
                  </div>
                )}

                {formData.image && (
                  <p className="mt-2 text-xs text-zinc-500 break-all">
                    {tx('Selected image:', 'Image selectionnee:')} {formData.image}
                  </p>
                )}

                <p className="mt-1 text-xs text-zinc-500">{tx('Allowed formats: .jpg, .jpeg, .png', 'Formats autorises : .jpg, .jpeg, .png')}</p>
              </div>
              <div className="space-y-2 pt-1">
                <p className="text-xs text-zinc-500">
                  {tx('Best Seller is assigned automatically from sales KPIs.', 'Le badge meilleure vente est calcule automatiquement a partir des KPI de vente.')}
                </p>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.isNew}
                    onChange={(e) => setFormData({ ...formData, isNew: e.target.checked })}
                    className="h-4 w-4 accent-emerald-500 rounded"
                  />
                  <span className="text-sm font-medium text-zinc-700 flex items-center gap-1">
                    <span className="inline-block bg-emerald-500 text-white text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full">New</span>
                  </span>
                </label>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  type="submit"
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                  disabled={isUploadingImage || isPreparingCrop}
                >
                  {editingItem ? tx('Update', 'Mettre a jour') : tx('Add', 'Ajouter')} {tx('Item', 'Article')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="border-zinc-300"
                >
                  {tx('Cancel', 'Annuler')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex h-11 w-full max-w-xl items-center gap-2">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applySearch();
              }
            }}
            placeholder={tx('Search menu items...', 'Rechercher des articles...')}
            className="h-11 rounded-2xl border-2 border-[#e2c29a] bg-white px-4 text-base text-[#5a3418] shadow-sm placeholder:text-[#9a7a5d] focus-visible:ring-2 focus-visible:ring-[#f3c98b]"
          />
          <Button
            type="button"
            onClick={applySearch}
            className="h-11 rounded-2xl bg-[#f8bf60] px-5 text-[#2f1f14] hover:bg-[#f2b24a]"
          >
            {tx('Search', 'Rechercher')}
          </Button>
        </div>

        <div className="inline-flex h-11 rounded-full border border-[#e2c29a] bg-[#fff9f2] p-1">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`flex h-full items-center gap-2 rounded-full px-4 text-sm transition-colors ${
              viewMode === 'cards'
                ? 'bg-[#f8bf60] text-[#2f1f14]'
                : 'text-[#7a5539] hover:bg-[#f4e5d2]'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            {tx('Cards', 'Cartes')}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex h-full items-center gap-2 rounded-full px-4 text-sm transition-colors ${
              viewMode === 'list'
                ? 'bg-[#f8bf60] text-[#2f1f14]'
                : 'text-[#7a5539] hover:bg-[#f4e5d2]'
            }`}
          >
            <List className="h-4 w-4" />
            {tx('List', 'Liste')}
          </button>
        </div>
      </div>

      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {filteredMenuItems.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-lg border border-zinc-200 bg-white"
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={item.image}
                  alt={item.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-4">
                <h3 className="mb-1 text-zinc-900">{item.name}</h3>
                <p className="mb-2 text-sm text-zinc-600">
                  {item.description}
                </p>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-lg text-zinc-900">
                    {item.price.toFixed(2)} TND
                  </span>
                  <span className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-500">
                    {categoryLabel(item.category)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-zinc-300"
                    onClick={() => handleOpenDialog(item)}
                  >
                    <Edit className="mr-1 h-4 w-4" />
                    {tx('Edit', 'Modifier')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-300 text-red-600 hover:bg-red-50"
                    onClick={() => handleDeleteMenuItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-left">
            <thead className="border-b border-zinc-200 bg-[#fffbf6]">
              <tr>
                <th className="px-4 py-3 text-sm text-[#7a5539]">{tx('Name', 'Nom')}</th>
                <th className="px-4 py-3 text-sm text-[#7a5539]">{tx('Description', 'Description')}</th>
                <th className="px-4 py-3 text-sm text-[#7a5539]">{tx('Category', 'Categorie')}</th>
                <th className="px-4 py-3 text-sm text-[#7a5539]">{tx('Price', 'Prix')}</th>
                <th className="px-4 py-3 text-sm text-[#7a5539]">{tx('Actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredMenuItems.map((item) => (
                <tr key={item.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3 text-sm text-zinc-900">{item.name}</td>
                  <td className="px-4 py-3 text-sm text-zinc-600">{item.description}</td>
                  <td className="px-4 py-3 text-sm text-zinc-700">{categoryLabel(item.category)}</td>
                  <td className="px-4 py-3 text-sm text-zinc-900">{item.price.toFixed(2)} TND</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-zinc-300"
                        onClick={() => handleOpenDialog(item)}
                      >
                        <Edit className="mr-1 h-4 w-4" />
                        {tx('Edit', 'Modifier')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-red-300 text-red-600 hover:bg-red-50"
                        onClick={() => handleDeleteMenuItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filteredMenuItems.length === 0 && (
        <p className="mt-4 text-sm text-zinc-500">{tx('No menu items match your search.', 'Aucun article ne correspond a votre recherche.')}</p>
      )}

      <div className="mt-6 rounded-xl border border-[#ead6c2] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-lg text-[#5a3418]">{tx('Menu Change History', 'Historique des changements menu')}</h3>
          <Button
            type="button"
            variant="outline"
            className="h-9 border-[#d9c0a4] bg-[#fffcf8] text-[#5a3418] hover:bg-[#f8ecd9]"
            onClick={() => void loadAuditLogs()}
            disabled={isAuditLoading}
          >
            {isAuditLoading ? tx('Refreshing...', 'Actualisation...') : tx('Refresh', 'Actualiser')}
          </Button>
        </div>

        {auditLogs.length === 0 ? (
          <p className="text-sm text-[#9a7a5d]">
            {tx('No menu changes recorded yet.', 'Aucun changement de menu enregistre pour le moment.')}
          </p>
        ) : (
          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-lg border border-zinc-200 bg-[#fffcf8] px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${auditEventStyle(log.eventType)}`}>
                    {auditEventLabel(log.eventType)}
                  </span>
                  <p className="text-sm text-zinc-800">{log.menuItemName || log.menuItemId}</p>
                  <span className="ml-auto text-xs text-zinc-500">{formatAuditDate(log.createdAt)}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-600">{formatAuditSummary(log)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
