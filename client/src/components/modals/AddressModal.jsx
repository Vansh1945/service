import { useState, useEffect } from 'react';
import { MapPin, X } from 'lucide-react';
import AddressSelector from '../AddressSelector';
import Processing from '../ui-skeletons/Processing';
import * as CustomerService from '../../services/CustomerService';
import { toast } from '../ui/Toast';


const AddressModal = ({
  isOpen,
  onClose,
  onAddressSaved,
  initialAddress = null,
  title = null,
  showDefaultCheckbox = true
}) => {
  const [addressForm, setAddressForm] = useState({
    label: 'Home',
    houseNumber: '',
    road: '',
    landmark: '',
    area: '',
    city: '',
    state: '',
    pincode: '',
    postalCode: '',
    formattedAddress: '',
    lat: null,
    lng: null,
    isDefault: false
  });
  const [formErrors, setFormErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialAddress) {
      setAddressForm({
        _id: initialAddress._id || undefined,
        label: initialAddress.label || 'Home',
        houseNumber: initialAddress.houseNumber || '',
        road: initialAddress.road || initialAddress.street || '',
        street: initialAddress.street || initialAddress.road || '',
        landmark: initialAddress.landmark || '',
        area: initialAddress.area || '',
        city: initialAddress.city || '',
        state: initialAddress.state || '',
        pincode: initialAddress.pincode || initialAddress.postalCode || '',
        postalCode: initialAddress.postalCode || initialAddress.pincode || '',
        formattedAddress: initialAddress.formattedAddress || '',
        lat: initialAddress.lat || null,
        lng: initialAddress.lng || null,
        isDefault: !!initialAddress.isDefault
      });
    } else {
      setAddressForm({
        label: 'Home',
        houseNumber: '',
        road: '',
        landmark: '',
        area: '',
        city: '',
        state: '',
        pincode: '',
        postalCode: '',
        formattedAddress: '',
        lat: null,
        lng: null,
        isDefault: false
      });
    }
    setFormErrors({});
  }, [initialAddress, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const errs = {};
    const code = (addressForm.pincode || addressForm.postalCode || '').trim();
    if (!code) errs['address.pincode'] = 'Pincode is required';
    else if (!/^\d{6}$/.test(code)) errs['address.pincode'] = 'Enter valid 6-digit PIN code';

    if (!addressForm.houseNumber?.trim()) errs['address.houseNumber'] = 'House/Flat No. required';
    if (!addressForm.road?.trim() && !addressForm.street?.trim()) errs['address.road'] = 'Road/Street required';
    if (!addressForm.city?.trim()) errs['address.city'] = 'City required';
    if (!addressForm.state?.trim()) errs['address.state'] = 'State required';

    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error('Please fill all mandatory address fields (House No, Road/Street, City, State, Pincode)');
      return;
    }

    try {
      setLoading(true);
      let res;
      if (addressForm._id) {
        res = await CustomerService.updateSavedAddress(addressForm._id, addressForm);
      } else {
        res = await CustomerService.createSavedAddress(addressForm);
      }

      if (res.data?.success) {
        toast.success(addressForm._id ? 'Address updated successfully!' : 'Address saved successfully!');
        if (onAddressSaved) {
          const updatedList = res.data.savedAddresses || [];
          const newlyCreated = res.data.address || updatedList[updatedList.length - 1] || addressForm;
          onAddressSaved(newlyCreated, updatedList);
        }
        onClose();
      }
    } catch (err) {
      console.error('Error saving address:', err);
      toast.error(err.response?.data?.message || 'Failed to save address');
    } finally {
      setLoading(false);
    }
  };

  const modalTitle = title || (initialAddress?._id ? 'Edit Saved Address' : 'Add New Address');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[100] p-3 sm:p-4 pb-20 sm:pb-4 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-4 sm:p-5 shadow-2xl border border-gray-100 relative max-h-[85vh] sm:max-h-[90vh] flex flex-col my-auto text-left">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-secondary">{modalTitle}</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto py-2.5 space-y-2.5 flex-1 pr-1">
          <AddressSelector
            address={addressForm}
            onChange={(updated) => setAddressForm(prev => ({ ...prev, ...updated }))}
            errors={formErrors}
            compact={true}
            showLabel={true}
          />
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between pt-2 border-t border-gray-100 shrink-0 gap-2">
            {showDefaultCheckbox ? (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefaultAddressModal"
                  checked={addressForm.isDefault}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, isDefault: e.target.checked }))}
                  className="w-3.5 h-3.5 text-primary rounded border-gray-300 cursor-pointer"
                />
                <label htmlFor="isDefaultAddressModal" className="text-xs font-semibold text-secondary cursor-pointer">
                  Set as default
                </label>
              </div>
            ) : <div />}
            <div className="flex items-center gap-2 justify-end">
              <button type="button" onClick={onClose} className="px-3.5 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <Processing type="submit" loading={loading} loadingText="Saving..." className="px-4 py-1.5 bg-primary text-white rounded-lg text-xs font-bold shadow-sm">
                Save Address
              </Processing>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddressModal;
