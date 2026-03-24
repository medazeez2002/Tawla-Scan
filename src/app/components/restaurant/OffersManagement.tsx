import { useEffect, useState } from 'react';
import { useMenu } from '../../context/MenuContext';
import { Offer } from '../../context/MenuContext';
import { Plus, Edit, Trash2, Tag, ToggleLeft, ToggleRight, Upload } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { api } from '../../../lib/api';
import { toast } from 'sonner';
import {
  normalizePromoCode,
  readPromoCodesFromStorage,
  type PromoCode,
  writePromoCodesToStorage,
} from '../../../lib/promoCodes';

type UiLanguage = 'en' | 'fr';

interface OffersManagementProps {
  language: UiLanguage;
}

export function OffersManagement({ language }: OffersManagementProps) {
  const tx = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const { offers, menuItems, addOffer, updateOffer, deleteOffer } = useMenu();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoValueInput, setPromoValueInput] = useState('');
  const [promoType, setPromoType] = useState<'percentage' | 'fixed'>('percentage');
  const [formData, setFormData] = useState({
    type: 'percentage' as 'percentage' | 'fixed',
    value: '',
    itemIds: [] as string[],
    description: '',
    image: '',
    active: true,
  });

  const handleOpenDialog = (offer?: Offer) => {
    if (offer) {
      setEditingOffer(offer);
      setFormData({
        type: offer.type,
        value: offer.value.toString(),
        itemIds: offer.itemIds,
        description: offer.description,
        image: offer.image,
        active: offer.active,
      });
    } else {
      setEditingOffer(null);
      setFormData({
        type: 'percentage',
        value: '',
        itemIds: [],
        description: '',
        image: '',
        active: true,
      });
    }
    setIsDialogOpen(true);
  };

  const toggleItem = (itemId: string) => {
    setFormData(prev => ({
      ...prev,
      itemIds: prev.itemIds.includes(itemId)
        ? prev.itemIds.filter(id => id !== itemId)
        : [...prev.itemIds, itemId],
    }));
  };

  const handleImageUpload = async (file: File) => {
    setIsUploadingImage(true);
    try {
      const url = await api.uploadOfferCarouselImage(file);
      setFormData(prev => ({ ...prev, image: url }));
      toast.success('Carousel image uploaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.image.trim()) {
      toast.error('Please upload a carousel image');
      return;
    }
    const offerData = {
      type: formData.type,
      value: parseFloat(formData.value),
      itemIds: formData.itemIds,
      description: formData.description,
      image: formData.image,
      active: formData.active,
    };

    if (editingOffer) {
      updateOffer(editingOffer.id, offerData);
    } else {
      addOffer(offerData);
    }

    setIsDialogOpen(false);
  };

  const toggleOfferStatus = (offerId: string, currentStatus: boolean) => {
    updateOffer(offerId, { active: !currentStatus });
  };

  useEffect(() => {
    setPromoCodes(readPromoCodesFromStorage());
  }, []);

  const handleAddPromoCode = (event: React.FormEvent) => {
    event.preventDefault();

    const normalizedCode = normalizePromoCode(promoCodeInput);
    const numericValue = Number(promoValueInput);

    if (!normalizedCode) {
      toast.error(tx('Promo code is required.', 'Le code promo est obligatoire.'));
      return;
    }

    if (promoCodes.some((promo) => promo.code === normalizedCode)) {
      toast.error(tx('Promo code already exists.', 'Ce code promo existe deja.'));
      return;
    }

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      toast.error(tx('Promo value must be greater than 0.', 'La valeur promo doit etre superieure a 0.'));
      return;
    }

    if (promoType === 'percentage' && numericValue > 100) {
      toast.error(tx('Percentage promo cannot exceed 100.', 'Le pourcentage promo ne peut pas depasser 100.'));
      return;
    }

    const nextPromoCodes: PromoCode[] = [
      {
        id: `promo-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        code: normalizedCode,
        type: promoType,
        value: Number(numericValue.toFixed(2)),
        active: true,
        createdAt: new Date().toISOString(),
      },
      ...promoCodes,
    ];

    setPromoCodes(nextPromoCodes);
    writePromoCodesToStorage(nextPromoCodes);
    setPromoCodeInput('');
    setPromoValueInput('');
    setPromoType('percentage');
    toast.success(tx('Promo code added.', 'Code promo ajoute.'));
  };

  const handleTogglePromoCode = (promoId: string) => {
    const nextPromoCodes = promoCodes.map((promo) => {
      if (promo.id !== promoId) return promo;
      return { ...promo, active: !promo.active };
    });
    setPromoCodes(nextPromoCodes);
    writePromoCodesToStorage(nextPromoCodes);
  };

  const handleDeletePromoCode = (promoId: string) => {
    const nextPromoCodes = promoCodes.filter((promo) => promo.id !== promoId);
    setPromoCodes(nextPromoCodes);
    writePromoCodesToStorage(nextPromoCodes);
    toast.success(tx('Promo code removed.', 'Code promo supprime.'));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl text-zinc-900">{tx('Offers & Discounts', 'Offres & Reductions')}</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => handleOpenDialog()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              {tx('Create Offer', 'Creer Offre')}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white border-zinc-200 max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-zinc-900">
                {editingOffer ? tx('Edit Offer', 'Modifier Offre') : tx('Create Offer', 'Creer Offre')}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="offerCarouselImage" className="text-zinc-700">{tx('Carousel Image (Landscape)', 'Image Caroussel (Paysage)')}</Label>
                <div className="mt-2 space-y-2">
                  {formData.image && (
                    <div className="relative w-full h-32 bg-zinc-100 rounded-lg overflow-hidden">
                      <img src={formData.image} alt="carousel" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <Input
                    id="offerCarouselImage"
                    type="file"
                    accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        void handleImageUpload(e.target.files[0]);
                      }
                    }}
                    disabled={isUploadingImage}
                    className="bg-white border-zinc-300 text-zinc-900"
                  />
                  <p className="text-xs text-zinc-500">{tx('Recommended: 1200x400px landscape image for best carousel display', 'Recommande: Image paysage 1200x400px pour meilleur affichage')}</p>
                </div>
              </div>

              <div>
                <Label htmlFor="offerDescription" className="text-zinc-700">{tx('Offer Description', 'Description Offre')}</Label>
                <Textarea
                  id="offerDescription"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-white border-zinc-300 text-zinc-900"
                  placeholder={tx('e.g., Morning Coffee Special', 'ex: Offre Cafe du Matin')}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="offerType" className="text-zinc-700">{tx('Discount Type', 'Type de Reduction')}</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: 'percentage' | 'fixed') =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger className="bg-white border-zinc-300 text-zinc-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-zinc-200">
                      <SelectItem value="percentage">{tx('Percentage (%)', 'Pourcentage (%)')}</SelectItem>
                      <SelectItem value="fixed">{tx('Fixed Amount (TND)', 'Montant Fixe (TND)')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="offerValue" className="text-zinc-700">
                    {tx('Value', 'Valeur')} {formData.type === 'percentage' ? '(%)' : '(TND)'}
                  </Label>
                  <Input
                    id="offerValue"
                    type="number"
                    step="0.01"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    className="bg-white border-zinc-300 text-zinc-900"
                    required
                  />
                </div>
              </div>

              <div>
                <Label className="text-zinc-700 mb-3 block">{tx('Apply to Items', 'Appliquer aux Articles')}</Label>
                <div className="space-y-2 max-h-60 overflow-y-auto border border-zinc-200 rounded-lg p-4">
                  {menuItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`offer-item-${item.id}`}
                        checked={formData.itemIds.includes(item.id)}
                        onCheckedChange={() => toggleItem(item.id)}
                      />
                      <label
                        htmlFor={`offer-item-${item.id}`}
                        className="flex-1 text-sm text-zinc-700 cursor-pointer"
                      >
                        {item.name} - {item.price.toFixed(2)} TND
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="offerActive"
                  checked={formData.active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, active: checked as boolean })
                  }
                />
                <Label htmlFor="offerActive" className="text-zinc-700 cursor-pointer">
                  {tx('Active (visible to customers)', 'Actif (visible aux clients)')}
                </Label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="submit"
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                  disabled={formData.itemIds.length === 0}
                >
                  {editingOffer ? tx('Update', 'Mettre a jour') : tx('Create', 'Creer')} {tx('Offer', 'Offre')}
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

      {offers.length === 0 ? (
        <div className="text-center py-16">
          <Tag className="h-16 w-16 mx-auto mb-4 text-zinc-300" />
          <p className="text-zinc-500">{tx('No offers created yet', 'Aucune offre creee')}</p>
          <p className="text-sm text-zinc-400 mt-2">
            {tx('Create special offers and discounts to attract customers', 'Creez des offres speciales et reductions pour attirer les clients')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className="bg-white rounded-lg p-6 border border-zinc-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={offer.active ? 'bg-green-500 text-white border-0' : 'bg-zinc-400 text-white border-0'}>
                      {offer.active ? tx('Active', 'Actif') : tx('Inactive', 'Inactif')}
                    </Badge>
                    <Badge variant="outline" className="border-amber-300 text-amber-700">
                      {offer.type === 'percentage' ? `${offer.value}% ${tx('OFF', 'DE REDUCTION')}` : `${offer.value} TND ${tx('OFF', 'DE REDUCTION')}`}
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-700">
                    {offer.description}
                  </p>
                </div>
              </div>

              <div className="space-y-1 mb-4">
                <p className="text-sm text-zinc-600">{tx('Applies to:', 'S\'applique a :')}</p>
                {offer.itemIds.map((itemId) => {
                  const item = menuItems.find(i => i.id === itemId);
                  return item ? (
                    <p key={itemId} className="text-sm text-zinc-700">
                      • {item.name}
                    </p>
                  ) : null;
                })}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 border-zinc-300"
                  onClick={() => handleOpenDialog(offer)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  {tx('Edit', 'Modifier')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-300"
                  onClick={() => toggleOfferStatus(offer.id, offer.active)}
                >
                  {offer.active ? (
                    <ToggleRight className="h-4 w-4" />
                  ) : (
                    <ToggleLeft className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                  onClick={() => deleteOffer(offer.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 rounded-xl border border-[#ead6c2] bg-[#fffcf8] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-lg text-[#5a3418]">{tx('Promo Codes', 'Codes Promo')}</h3>
          <span className="text-xs text-[#9a7a5d]">{tx('Used at checkout', 'Utilises au paiement')}</span>
        </div>

        <form onSubmit={handleAddPromoCode} className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label htmlFor="promoCodeInput" className="text-[#7a5539]">{tx('Promo Code', 'Code Promo')}</Label>
            <Input
              id="promoCodeInput"
              value={promoCodeInput}
              onChange={(event) => setPromoCodeInput(event.target.value.toUpperCase())}
              className="mt-1 border-[#d9c0a4] bg-white text-[#5a3418]"
              placeholder={tx('e.g. WELCOME10', 'ex: WELCOME10')}
            />
          </div>
          <div>
            <Label htmlFor="promoType" className="text-[#7a5539]">{tx('Type', 'Type')}</Label>
            <Select
              value={promoType}
              onValueChange={(value: 'percentage' | 'fixed') => setPromoType(value)}
            >
              <SelectTrigger id="promoType" className="mt-1 border-[#d9c0a4] bg-white text-[#5a3418]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-zinc-200">
                <SelectItem value="percentage">{tx('Percentage (%)', 'Pourcentage (%)')}</SelectItem>
                <SelectItem value="fixed">{tx('Fixed (TND)', 'Fixe (TND)')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="promoValue" className="text-[#7a5539]">{tx('Value', 'Valeur')}</Label>
            <div className="mt-1 flex gap-2">
              <Input
                id="promoValue"
                type="number"
                min={0}
                step="0.01"
                value={promoValueInput}
                onChange={(event) => setPromoValueInput(event.target.value)}
                className="border-[#d9c0a4] bg-white text-[#5a3418]"
                placeholder={promoType === 'percentage' ? '10' : '5.00'}
              />
              <Button type="submit" className="bg-amber-600 text-white hover:bg-amber-700">
                {tx('Add', 'Ajouter')}
              </Button>
            </div>
          </div>
        </form>

        {promoCodes.length === 0 ? (
          <p className="mt-3 text-sm text-[#9a7a5d]">
            {tx('No promo codes created yet.', 'Aucun code promo cree pour le moment.')}
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {promoCodes.map((promo) => (
              <div key={promo.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-[#ead6c2] bg-white px-3 py-2">
                <span className="rounded-full bg-[#f8bf60] px-2 py-0.5 text-xs font-semibold text-[#2f1f14]">
                  {promo.code}
                </span>
                <span className="text-sm text-[#7a5539]">
                  {promo.type === 'percentage' ? `${promo.value}%` : `${promo.value.toFixed(2)} TND`}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    promo.active ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  {promo.active ? tx('Active', 'Actif') : tx('Inactive', 'Inactif')}
                </span>
                <div className="ml-auto flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-[#d9c0a4] text-[#7a5539]"
                    onClick={() => handleTogglePromoCode(promo.id)}
                  >
                    {promo.active ? tx('Disable', 'Desactiver') : tx('Enable', 'Activer')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-red-300 text-red-600 hover:bg-red-50"
                    onClick={() => handleDeletePromoCode(promo.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
