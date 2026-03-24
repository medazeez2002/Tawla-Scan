import { useState } from 'react';
import { useMenu } from '../../context/MenuContext';
import { Bundle } from '../../context/MenuContext';
import { Plus, Edit, Trash2, Package } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { toast } from 'sonner';
import { api } from '../../../lib/api';

type UiLanguage = 'en' | 'fr';

interface BundlesManagementProps {
  language: UiLanguage;
}

export function BundlesManagement({ language }: BundlesManagementProps) {
  const tx = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const { bundles, menuItems, addBundle, updateBundle, deleteBundle } = useMenu();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);
  const [isUploadingBundleImage, setIsUploadingBundleImage] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    items: [] as string[],
    image: '',
  });

  const handleOpenDialog = (bundle?: Bundle) => {
    if (bundle) {
      setEditingBundle(bundle);
      setFormData({
        name: bundle.name,
        description: bundle.description,
        price: bundle.price.toString(),
        items: bundle.items,
        image: bundle.image,
      });
    } else {
      setEditingBundle(null);
      setFormData({
        name: '',
        description: '',
        price: '',
        items: [],
        image: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleBundleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const hasValidType = ['image/jpeg', 'image/jpg', 'image/png', 'image/pjpeg', 'image/x-png'].includes(file.type);
    const hasValidExt = /\.(jpe?g|png)$/i.test(file.name);
    if (!hasValidType && !hasValidExt) {
      toast.error(tx('Only JPEG/PNG files are allowed.', 'Seuls les fichiers JPEG/PNG sont autorises.'));
      event.target.value = '';
      return;
    }

    setIsUploadingBundleImage(true);
    try {
      const uploadedImageUrl = await api.uploadMenuImage(file);
      setFormData((previous) => ({
        ...previous,
        image: uploadedImageUrl,
      }));
      toast.success(tx('Bundle image uploaded successfully.', 'Image du pack telechargee avec succes.'));
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : tx('Failed to upload bundle image.', 'Echec du telechargement de l\'image du pack.');
      toast.error(message);
    } finally {
      setIsUploadingBundleImage(false);
      event.target.value = '';
    }
  };

  const toggleItem = (itemId: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.includes(itemId)
        ? prev.items.filter(id => id !== itemId)
        : [...prev.items, itemId],
    }));
  };

  const calculateOriginalPrice = () => {
    return formData.items.reduce((total, itemId) => {
      const item = menuItems.find(i => i.id === itemId);
      return total + (item?.price || 0);
    }, 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const originalPrice = calculateOriginalPrice();
    const bundleData = {
      name: formData.name,
      description: formData.description,
      price: parseFloat(formData.price),
      originalPrice,
      items: formData.items,
      image: formData.image || menuItems.find(i => formData.items.includes(i.id))?.image || '',
    };

    if (editingBundle) {
      updateBundle(editingBundle.id, bundleData);
    } else {
      addBundle(bundleData);
    }

    setIsDialogOpen(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl text-zinc-900">{tx('Bundles & Combos', 'Packs & Combos')}</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => handleOpenDialog()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              {tx('Create Bundle', 'Creer Pack')}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white border-zinc-200 max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-zinc-900">
                {editingBundle ? tx('Edit Bundle', 'Modifier Pack') : tx('Create Bundle', 'Creer Pack')}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="bundleName" className="text-zinc-700">{tx('Bundle Name', 'Nom du Pack')}</Label>
                <Input
                  id="bundleName"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-white border-zinc-300 text-zinc-900"
                  placeholder={tx('e.g., Breakfast Combo', 'ex: Combo Petit Dejeuner')}
                  required
                />
              </div>
              <div>
                <Label htmlFor="bundleDescription" className="text-zinc-700">{tx('Description', 'Description')}</Label>
                <Textarea
                  id="bundleDescription"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-white border-zinc-300 text-zinc-900"
                  required
                />
              </div>

              <div>
                <Label htmlFor="bundleImage" className="text-zinc-700">{tx('Bundle Image URL', 'URL Image du Pack')}</Label>
                <Input
                  id="bundleImage"
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  className="bg-white border-zinc-300 text-zinc-900"
                  placeholder="https://example.com/bundle-image.png"
                />
                <div className="mt-3">
                  <Label htmlFor="bundleImageFile" className="text-zinc-700">{tx('Or upload image', 'Ou televerser une image')}</Label>
                  <Input
                    id="bundleImageFile"
                    type="file"
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    onChange={(event) => void handleBundleImageFileChange(event)}
                    className="mt-1 bg-white border-zinc-300 text-zinc-900"
                    disabled={isUploadingBundleImage}
                  />
                  <p className="mt-1 text-xs text-zinc-500">
                    {isUploadingBundleImage
                      ? tx('Uploading bundle image...', 'Telechargement de l\'image du pack...')
                      : tx('Allowed formats: .jpg, .jpeg, .png', 'Formats autorises : .jpg, .jpeg, .png')}
                  </p>
                </div>
                {formData.image && (
                  <div className="mt-3">
                    <p className="mb-2 text-xs text-zinc-500">{tx('Preview', 'Apercu')}</p>
                    <img
                      src={formData.image}
                      alt={tx('Bundle preview', 'Apercu du pack')}
                      className="h-28 w-full rounded-lg border border-zinc-200 object-cover"
                    />
                  </div>
                )}
              </div>

              <div>
                <Label className="text-zinc-700 mb-3 block">{tx('Select Items', 'Selectionner Articles')}</Label>
                <div className="space-y-2 max-h-60 overflow-y-auto border border-zinc-200 rounded-lg p-4">
                  {menuItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`item-${item.id}`}
                        checked={formData.items.includes(item.id)}
                        onCheckedChange={() => toggleItem(item.id)}
                      />
                      <label
                        htmlFor={`item-${item.id}`}
                        className="flex-1 text-sm text-zinc-700 cursor-pointer"
                      >
                        {item.name} - {item.price.toFixed(2)} TND
                      </label>
                    </div>
                  ))}
                </div>
                {formData.items.length > 0 && (
                  <p className="text-sm text-zinc-500 mt-2">
                    {tx('Original price', 'Prix original')} : {calculateOriginalPrice().toFixed(2)} TND
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="bundlePrice" className="text-zinc-700">{tx('Bundle Price (TND)', 'Prix du Pack (TND)')}</Label>
                <Input
                  id="bundlePrice"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="bg-white border-zinc-300 text-zinc-900"
                  required
                />
                {formData.price && calculateOriginalPrice() > 0 && (
                  <p className="text-sm text-green-600 mt-1">
                    {tx('Save', 'Economisez')} {(calculateOriginalPrice() - parseFloat(formData.price)).toFixed(2)} TND (
                    {Math.round(((calculateOriginalPrice() - parseFloat(formData.price)) / calculateOriginalPrice()) * 100)}% {tx('off', 'de reduction')})
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="submit"
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                  disabled={formData.items.length === 0}
                >
                  {editingBundle ? tx('Update', 'Mettre a jour') : tx('Create', 'Creer')} {tx('Bundle', 'Pack')}
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

      {bundles.length === 0 ? (
        <div className="text-center py-16">
          <Package className="h-16 w-16 mx-auto mb-4 text-zinc-300" />
          <p className="text-zinc-500">{tx('No bundles created yet', 'Aucun pack cree')}</p>
          <p className="text-sm text-zinc-400 mt-2">
            {tx('Create combo deals to offer discounts on multiple items', 'Creez des offres combo pour proposer des reductions sur plusieurs articles')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bundles.map((bundle) => (
            <div
              key={bundle.id}
              className="bg-white rounded-lg p-6 border border-zinc-200"
            >
              {bundle.image && (
                <img
                  src={bundle.image}
                  alt={bundle.name}
                  className="mb-4 h-36 w-full rounded-lg object-cover"
                />
              )}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg text-zinc-900 mb-1">
                    {bundle.name}
                  </h3>
                  <p className="text-sm text-zinc-600">
                    {bundle.description}
                  </p>
                </div>
              </div>

              <div className="space-y-1 mb-4">
                <p className="text-sm text-zinc-600">{tx('Includes:', 'Inclut :')}</p>
                {bundle.items.map((itemId) => {
                  const item = menuItems.find(i => i.id === itemId);
                  return item ? (
                    <p key={itemId} className="text-sm text-zinc-700">
                      • {item.name}
                    </p>
                  ) : null;
                })}
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl text-amber-600">{bundle.price.toFixed(2)} TND</span>
                  <span className="text-sm text-zinc-500 line-through">
                    {bundle.originalPrice.toFixed(2)} TND
                  </span>
                </div>
                <p className="text-xs text-green-600">
                  {tx('Save', 'Economisez')} {(bundle.originalPrice - bundle.price).toFixed(2)} TND
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 border-zinc-300"
                  onClick={() => handleOpenDialog(bundle)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  {tx('Edit', 'Modifier')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                  onClick={() => deleteBundle(bundle.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
