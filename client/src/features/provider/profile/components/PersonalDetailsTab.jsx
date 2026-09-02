import React from 'react';
import { User, Phone, Mail, Calendar, MapPin, Zap, Edit3, Save } from 'lucide-react';
import Processing from '../../../../components/ui/Processing';
import AddressSelector from '../../../../components/AddressSelector';
import DatePicker from 'react-datepicker';
import useCategory from '../../../../hooks/useCategory';
import 'react-datepicker/dist/react-datepicker.css';

const PersonalDetailsTab = ({
  profileData,
  setProfileData,
  editMode,
  setEditMode,
  isSaving,
  handleChange,
  updateProfile,
  formatServices,
  allCategories
}) => {
  const { categories: fetchedCategories } = useCategory();
  const categoryList = (allCategories && allCategories.length > 0) ? allCategories : fetchedCategories;
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Basic Personal Details Card */}
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-6 text-left">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Personal Information</h3>
          <button
            onClick={() => setEditMode({ ...editMode, personal: !editMode.personal })}
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
          >
            <Edit3 className="w-3.5 h-3.5" />
            {editMode.personal ? 'Cancel' : 'Edit Personal Info'}
          </button>
        </div>

        {editMode.personal ? (
          <form onSubmit={(e) => { e.preventDefault(); updateProfile('personal'); }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-500 mb-1">Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={profileData.name || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-xs font-bold border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-500 mb-1">Phone Number</label>
                <input
                  type="text"
                  name="phone"
                  value={profileData.phone || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-xs font-bold border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-500 mb-1">Date of Birth</label>
                <DatePicker
                  selected={profileData.dateOfBirth ? new Date(profileData.dateOfBirth) : null}
                  onChange={(date) => {
                    const localDate = date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0] : '';
                    setProfileData(prev => ({ ...prev, dateOfBirth: localDate }));
                  }}
                  dateFormat="yyyy-MM-dd"
                  className="w-full px-3 py-2 text-xs font-bold border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
              </div>
            </div>
            <Processing
              type="submit"
              loading={isSaving}
              loadingText="Saving..."
              className="w-full py-2 bg-primary text-white rounded-xl text-xs font-bold"
            >
              Save Personal Info
            </Processing>
          </form>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold text-secondary">
            <div>
              <span className="text-neutral-400 block text-[10px]">Full Name</span>
              <span>{profileData.name || '—'}</span>
            </div>
            <div>
              <span className="text-neutral-400 block text-[10px]">Email Address</span>
              <span>{profileData.email || '—'}</span>
            </div>
            <div>
              <span className="text-neutral-400 block text-[10px]">Phone Number</span>
              <span>{profileData.phone || '—'}</span>
            </div>
            <div>
              <span className="text-neutral-400 block text-[10px]">Date of Birth</span>
              <span>{profileData.dateOfBirth || '—'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Professional Information Card */}
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-6 text-left">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Professional Information</h3>
          <button
            onClick={() => setEditMode({ ...editMode, professional: !editMode.professional })}
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
          >
            <Edit3 className="w-3.5 h-3.5" />
            {editMode.professional ? 'Cancel' : 'Edit Professional Info'}
          </button>
        </div>

        {editMode.professional ? (
          <form onSubmit={(e) => { e.preventDefault(); updateProfile('professional'); }} className="space-y-4">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-500 mb-1">Services Offered</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(categoryList || []).map((cat) => {
                    const id = cat.value || cat._id;
                    const name = cat.label || cat.name;
                    const isSelected = profileData.services?.some(s => (typeof s === 'object' ? s._id || s.value : s) === id);
                    return (
                      <label key={id} className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all flex items-center gap-2 ${isSelected ? 'bg-primary/10 border-primary text-primary' : 'bg-neutral-50 border-neutral-200 text-secondary'}`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setProfileData(prev => ({
                              ...prev,
                              services: checked
                                ? [...prev.services, id]
                                : prev.services.filter(s => (typeof s === 'object' ? s._id || s.value : s) !== id)
                            }));
                          }}
                          className="hidden"
                        />
                        <span>{name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1">Experience (Years)</label>
                  <input
                    type="number"
                    name="experience"
                    value={profileData.experience || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 text-xs font-bold border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1">Service Area</label>
                  <input
                    type="text"
                    name="serviceArea"
                    value={profileData.serviceArea || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 text-xs font-bold border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  />
                </div>
              </div>
            </div>
            <Processing
              type="submit"
              loading={isSaving}
              loadingText="Saving..."
              className="w-full py-2 bg-primary text-white rounded-xl text-xs font-bold"
            >
              Save Professional Info
            </Processing>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-xs font-bold text-secondary">
            <div className="col-span-2">
              <span className="text-neutral-400 block text-[10px]">Services</span>
              <span>{formatServices(profileData.services)}</span>
            </div>
            <div>
              <span className="text-neutral-400 block text-[10px]">Experience</span>
              <span>{profileData.experience ? `${profileData.experience} Years` : '—'}</span>
            </div>
            <div>
              <span className="text-neutral-400 block text-[10px]">Service Area</span>
              <span>{profileData.serviceArea || '—'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Saved Address Card */}
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-6 text-left">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Saved Address</h3>
          <button
            onClick={() => setEditMode({ ...editMode, address: !editMode.address })}
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
          >
            <Edit3 className="w-3.5 h-3.5" />
            {editMode.address ? 'Cancel' : 'Edit Address'}
          </button>
        </div>

        {editMode.address ? (
          <form onSubmit={(e) => { e.preventDefault(); updateProfile('address'); }} className="space-y-4">
            <div className="space-y-4">
              <div>
                <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-2">Current Address</h4>
                <AddressSelector
                  address={{
                    houseNumber: profileData.currentAddress?.houseNumber || '',
                    road: profileData.currentAddress?.road || '',
                    landmark: profileData.currentAddress?.landmark || '',
                    area: profileData.currentAddress?.area || '',
                    city: profileData.currentAddress?.villageCity || profileData.currentAddress?.city || '',
                    state: profileData.currentAddress?.state || '',
                    pincode: profileData.currentAddress?.pincode || profileData.currentAddress?.postalCode || '',
                    postalCode: profileData.currentAddress?.pincode || profileData.currentAddress?.postalCode || '',
                    street: profileData.currentAddress?.street || '',
                    formattedAddress: profileData.currentAddress?.formattedAddress || '',
                    isManuallyEdited: profileData.currentAddress?.isManuallyEdited || false,
                  }}
                  onChange={(updatedAddress) => {
                    setProfileData((prev) => {
                      const mapped = {
                        ...prev.currentAddress,
                        houseNumber: updatedAddress.houseNumber || '',
                        road: updatedAddress.road || '',
                        landmark: updatedAddress.landmark || '',
                        area: updatedAddress.area || '',
                        city: updatedAddress.city || '',
                        state: updatedAddress.state || '',
                        pincode: updatedAddress.pincode || updatedAddress.postalCode || '',
                        postalCode: updatedAddress.postalCode || updatedAddress.pincode || '',
                        street: updatedAddress.street || '',
                        villageCity: updatedAddress.city || '',
                        district: updatedAddress.area || '',
                        formattedAddress: updatedAddress.formattedAddress || '',
                        isManuallyEdited: updatedAddress.isManuallyEdited || false,
                        lat: updatedAddress.lat !== undefined ? updatedAddress.lat : prev.currentAddress?.lat,
                        lng: updatedAddress.lng !== undefined ? updatedAddress.lng : prev.currentAddress?.lng,
                        s2CellId: updatedAddress.s2CellId || prev.currentAddress?.s2CellId,
                        s2CellIdPrecise: updatedAddress.s2CellIdPrecise || prev.currentAddress?.s2CellIdPrecise,
                      };
                      const updated = {
                        ...prev,
                        currentAddress: mapped,
                        address: {
                          ...prev.address,
                          street: mapped.street,
                          city: mapped.villageCity,
                          state: mapped.state,
                          postalCode: mapped.pincode,
                          lat: mapped.lat,
                          lng: mapped.lng,
                          s2CellId: mapped.s2CellId,
                          s2CellIdPrecise: mapped.s2CellIdPrecise,
                        }
                      };
                      if (prev.addressSame) {
                        updated.permanentAddress = { ...mapped };
                      }
                      return updated;
                    });
                  }}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="profileAddressSame"
                  checked={profileData.addressSame}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setProfileData(prev => ({
                      ...prev,
                      addressSame: checked,
                      permanentAddress: checked ? { ...prev.currentAddress } : prev.permanentAddress
                    }));
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-primary"
                />
                <label htmlFor="profileAddressSame" className="text-xs font-bold text-secondary">Permanent Address same as Current</label>
              </div>

              {!profileData.addressSame && (
                <div>
                  <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-2">Permanent Address</h4>
                  <AddressSelector
                    address={{
                      houseNumber: profileData.permanentAddress?.houseNumber || '',
                      road: profileData.permanentAddress?.road || '',
                      landmark: profileData.permanentAddress?.landmark || '',
                      area: profileData.permanentAddress?.area || '',
                      city: profileData.permanentAddress?.villageCity || profileData.permanentAddress?.city || '',
                      state: profileData.permanentAddress?.state || '',
                      pincode: profileData.permanentAddress?.pincode || profileData.permanentAddress?.postalCode || '',
                      postalCode: profileData.permanentAddress?.pincode || profileData.permanentAddress?.postalCode || '',
                      street: profileData.permanentAddress?.street || '',
                      formattedAddress: profileData.permanentAddress?.formattedAddress || '',
                      isManuallyEdited: profileData.permanentAddress?.isManuallyEdited || false,
                    }}
                    onChange={(updatedAddress) => {
                      setProfileData((prev) => ({
                        ...prev,
                        permanentAddress: {
                          ...prev.permanentAddress,
                          houseNumber: updatedAddress.houseNumber || '',
                          road: updatedAddress.road || '',
                          landmark: updatedAddress.landmark || '',
                          area: updatedAddress.area || '',
                          city: updatedAddress.city || '',
                          state: updatedAddress.state || '',
                          pincode: updatedAddress.pincode || updatedAddress.postalCode || '',
                          postalCode: updatedAddress.postalCode || updatedAddress.pincode || '',
                          street: updatedAddress.street || '',
                          villageCity: updatedAddress.city || '',
                          district: updatedAddress.area || '',
                          formattedAddress: updatedAddress.formattedAddress || '',
                          isManuallyEdited: updatedAddress.isManuallyEdited || false,
                          lat: updatedAddress.lat !== undefined ? updatedAddress.lat : prev.permanentAddress?.lat,
                          lng: updatedAddress.lng !== undefined ? updatedAddress.lng : prev.permanentAddress?.lng,
                          s2CellId: updatedAddress.s2CellId || prev.permanentAddress?.s2CellId,
                          s2CellIdPrecise: updatedAddress.s2CellIdPrecise || prev.permanentAddress?.s2CellIdPrecise,
                        }
                      }));
                    }}
                  />
                </div>
              )}
            </div>

            <Processing
              type="submit"
              loading={isSaving}
              loadingText="Saving..."
              className="w-full py-2 bg-primary text-white rounded-xl text-xs font-bold"
            >
              Save Address Info
            </Processing>
          </form>
        ) : (
          <div className="space-y-3 text-xs font-bold text-secondary">
            <div>
              <span className="text-neutral-400 block text-[10px]">Current Address</span>
              <span>{profileData.currentAddress?.formattedAddress || profileData.address?.street || '—'}</span>
            </div>
            {!profileData.addressSame && profileData.permanentAddress && (
              <div>
                <span className="text-neutral-400 block text-[10px]">Permanent Address</span>
                <span>{profileData.permanentAddress?.formattedAddress || '—'}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalDetailsTab;
