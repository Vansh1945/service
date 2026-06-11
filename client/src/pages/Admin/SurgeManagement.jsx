import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import Pagination from '../../components/Pagination';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  CheckCircle,
  Clock,
  Globe,
  Save,
  X,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CloudRain,
  Car,
  Moon,
  Flame,
  Wrench,
  MapPin,
  ToggleLeft,
  ToggleRight,
  Coins
} from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../../context/auth';
import { useConfirm } from '../../context/ConfirmContext';
import * as SurgeService from '../../services/SurgeService';
import { getAllZones } from '../../services/ZoneService';
import * as SystemService from '../../services/SystemService';
import { formatCurrency } from '../../utils/format';
import HierarchicalZoneSelector from '../../components/HierarchicalZoneSelector';

// Charge type config — maps UI labels to backend enum values
const CHARGE_TYPES = [
  { value: 'visiting', label: 'Visiting Charge', icon: MapPin, color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { value: 'rain', label: 'Rain Charge', icon: CloudRain, color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { value: 'traffic', label: 'Traffic Charge', icon: Car, color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'night', label: 'Night Charge', icon: Moon, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'demand', label: 'Demand Surge', icon: Flame, color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'platform', label: 'Platform Fee', icon: Coins, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
];

const getChargeTypeConfig = (val) => CHARGE_TYPES.find(t => t.value === val) || { value: val, label: val.charAt(0).toUpperCase() + val.slice(1) + ' Charge', icon: AlertCircle, color: 'bg-slate-50 text-slate-700 border-slate-200' };

const SurgeManagement = () => {
  const { showToast } = useAuth();
  const location = useLocation();
  const confirm = useConfirm();

  // Data
  const [surgeRules, setSurgeRules] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState('all');

  // Stats
  const [stats, setStats] = useState({ total: 0, active: 0, global: 0, zoneSpecific: 0 });

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Zone cascade for create
  const [createStateSearch, setCreateStateSearch] = useState('');
  const [createStateOpen, setCreateStateOpen] = useState(false);
  const [createCitySearch, setCreateCitySearch] = useState('');
  const [createCityOpen, setCreateCityOpen] = useState(false);
  const [createMicroSearch, setCreateMicroSearch] = useState('');
  const [createMicroOpen, setCreateMicroOpen] = useState(false);

  // Zone cascade for edit
  const [editStateSearch, setEditStateSearch] = useState('');
  const [editStateOpen, setEditStateOpen] = useState(false);
  const [editCitySearch, setEditCitySearch] = useState('');
  const [editCityOpen, setEditCityOpen] = useState(false);
  const [editMicroSearch, setEditMicroSearch] = useState('');
  const [editMicroOpen, setEditMicroOpen] = useState(false);

  // Forms
  const defaultForm = {
    chargeType: 'rain',
    scope: 'global',
    zoneId: '',
    zoneIds: [],
    mode: 'flat',
    value: '',
    startTime: '',
    endTime: '',
    maxBookingValue: '',
    active: true
  };
  const [createForm, setCreateForm] = useState({ ...defaultForm });
  const [editForm, setEditForm] = useState({ ...defaultForm });

  // ----- Data Fetching -----
  const fetchSurgeRules = async () => {
    try {
      setLoading(true);
      const response = await SurgeService.listSurgeRules({ limit: 1000 });
      if (response.data?.success) {
        setSurgeRules(response.data.data || []);
      }
    } catch (error) {
      console.error('Fetch surge rules error:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch surge rules');
    } finally {
      setLoading(false);
    }
  };

  const fetchZones = async () => {
    try {
      const response = await getAllZones();
      if (response.data?.success) {
        setZones(response.data.data || response.data.zones || []);
      }
    } catch (error) {
      console.error('Fetch zones error:', error);
    }
  };

  // Customizable Splits state
  const [systemSettings, setSystemSettings] = useState(null);
  const [savingSplits, setSavingSplits] = useState(false);

  const fetchSystemSettings = async () => {
    try {
      const response = await SystemService.getSystemSettingAdmin();
      if (response.data?.success) {
        setSystemSettings(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching system settings:', error);
    }
  };

  const handleSplitChange = (key, value) => {
    setSystemSettings(prev => ({
      ...prev,
      surgeSplitSettings: {
        ...prev?.surgeSplitSettings,
        [key]: Number(value)
      }
    }));
  };

  const saveSplitSettings = async () => {
    try {
      setSavingSplits(true);
      const formData = new FormData();
      formData.append('companyName', systemSettings.companyName || 'Raj Electrical Services');
      formData.append('surgeSplitSettings', JSON.stringify(systemSettings.surgeSplitSettings));

      const response = await SystemService.updateSystemSetting(formData);
      if (response.data?.success) {
        toast.success('Surcharge split settings saved successfully!');
        fetchSystemSettings();
      }
    } catch (error) {
      toast.error('Failed to save split settings');
    } finally {
      setSavingSplits(false);
    }
  };

  useEffect(() => {
    fetchSurgeRules();
    fetchZones();
    fetchSystemSettings();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const prefillZone = params.get('prefillZone');
    if (prefillZone) {
      setCreateForm(prev => ({
        ...prev,
        scope: 'zone',
        zoneId: prefillZone,
        zoneIds: [prefillZone]
      }));
      setShowCreateModal(true);
    }
  }, [location.search]);

  // ----- Stats -----
  useEffect(() => {
    setStats({
      total: surgeRules.length,
      active: surgeRules.filter(r => r.active).length,
      global: surgeRules.filter(r => r.scope === 'global').length,
      zoneSpecific: surgeRules.filter(r => r.scope === 'zone').length
    });
  }, [surgeRules]);

  // ----- Filtering -----
  const filteredRules = useMemo(() => {
    let filtered = [...surgeRules];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(rule =>
        rule.chargeType?.toLowerCase().includes(q) ||
        getChargeTypeConfig(rule.chargeType).label.toLowerCase().includes(q) ||
        rule.scope?.toLowerCase().includes(q)
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(rule => rule.chargeType === typeFilter);
    }

    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      filtered = filtered.filter(rule => rule.active === isActive);
    }

    // Tab filter
    if (activeTab !== 'all') {
      filtered = filtered.filter(rule => rule.chargeType === activeTab);
    }

    return filtered;
  }, [surgeRules, searchTerm, typeFilter, statusFilter, activeTab]);

  // ----- Pagination -----
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentRules = filteredRules.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredRules.length / itemsPerPage);

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, typeFilter, statusFilter, activeTab]);

  // ----- Zone Cascade Logic -----
  const handleZoneToggleCascade = (zone, isCreate) => {
    const form = isCreate ? createForm : editForm;
    const setForm = isCreate ? setCreateForm : setEditForm;
    const currentSelected = form.zoneIds || [];
    const zoneId = zone._id.toString();

    let newZones = [...currentSelected];

    if (currentSelected.includes(zone._id)) {
      newZones = newZones.filter(id => id !== zone._id);

      if (zone.zoneLevel === 'state') {
        const childCities = zones.filter(z => z.zoneLevel === 'city' && (z.parentZone?._id || z.parentZone || '').toString() === zoneId);
        const cityIds = childCities.map(c => c._id.toString());
        newZones = newZones.filter(id => !cityIds.includes(id));
        const childMicros = zones.filter(z => z.zoneLevel === 'micro' && cityIds.includes((z.parentZone?._id || z.parentZone || '').toString()));
        newZones = newZones.filter(id => !childMicros.map(m => m._id.toString()).includes(id));
      } else if (zone.zoneLevel === 'city') {
        const childMicros = zones.filter(z => z.zoneLevel === 'micro' && (z.parentZone?._id || z.parentZone || '').toString() === zoneId);
        newZones = newZones.filter(id => !childMicros.map(m => m._id.toString()).includes(id));
        const parentStateId = (zone.parentZone?._id || zone.parentZone || '').toString();
        if (parentStateId) newZones = newZones.filter(id => id !== parentStateId);
      } else if (zone.zoneLevel === 'micro') {
        const parentCityId = (zone.parentZone?._id || zone.parentZone || '').toString();
        if (parentCityId) {
          newZones = newZones.filter(id => id !== parentCityId);
          const parentCity = zones.find(z => z._id.toString() === parentCityId);
          const parentStateId = parentCity ? (parentCity.parentZone?._id || parentCity.parentZone || '').toString() : '';
          if (parentStateId) newZones = newZones.filter(id => id !== parentStateId);
        }
      }
    } else {
      newZones.push(zone._id);

      if (zone.zoneLevel === 'state') {
        const childCities = zones.filter(z => z.zoneLevel === 'city' && (z.parentZone?._id || z.parentZone || '').toString() === zoneId);
        const cityIds = childCities.map(c => c._id);
        const childMicros = zones.filter(z => z.zoneLevel === 'micro' && cityIds.map(id => id.toString()).includes((z.parentZone?._id || z.parentZone || '').toString()));
        newZones = Array.from(new Set([...newZones, ...cityIds, ...childMicros.map(m => m._id)]));
      } else if (zone.zoneLevel === 'city') {
        const childMicros = zones.filter(z => z.zoneLevel === 'micro' && (z.parentZone?._id || z.parentZone || '').toString() === zoneId);
        newZones = Array.from(new Set([...newZones, ...childMicros.map(m => m._id)]));
        const parentStateId = (zone.parentZone?._id || zone.parentZone || '').toString();
        if (parentStateId) {
          const siblingCities = zones.filter(z => z.zoneLevel === 'city' && (z.parentZone?._id || z.parentZone || '').toString() === parentStateId);
          if (siblingCities.every(c => newZones.includes(c._id.toString()) || newZones.includes(c._id))) newZones.push(parentStateId);
        }
      } else if (zone.zoneLevel === 'micro') {
        const parentCityId = (zone.parentZone?._id || zone.parentZone || '').toString();
        if (parentCityId) {
          const siblingMicros = zones.filter(z => z.zoneLevel === 'micro' && (z.parentZone?._id || z.parentZone || '').toString() === parentCityId);
          if (siblingMicros.every(m => newZones.includes(m._id.toString()) || newZones.includes(m._id))) {
            newZones.push(parentCityId);
            const parentCity = zones.find(z => z._id.toString() === parentCityId);
            const parentStateId = parentCity ? (parentCity.parentZone?._id || parentCity.parentZone || '').toString() : '';
            if (parentStateId) {
              const siblingCities = zones.filter(z => z.zoneLevel === 'city' && (z.parentZone?._id || z.parentZone || '').toString() === parentStateId);
              if (siblingCities.every(c => newZones.includes(c._id.toString()) || newZones.includes(c._id) || c._id.toString() === parentCityId)) {
                newZones.push(parentStateId);
              }
            }
          }
        }
      }
    }

    setForm(prev => ({
      ...prev,
      zoneIds: newZones,
      zoneId: newZones[0] || ''
    }));
  };

  // ----- CRUD -----
  const handleCreateRule = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        chargeType: createForm.chargeType,
        scope: createForm.scope,
        mode: createForm.mode,
        value: Number(createForm.value),
        startTime: createForm.startTime || undefined,
        endTime: createForm.endTime || undefined,
        maxBookingValue: createForm.maxBookingValue ? Number(createForm.maxBookingValue) : null,
        active: createForm.active,
        zoneId: (createForm.scope === 'zone' && createForm.zoneIds?.length > 0) ? createForm.zoneIds[0] : null
      };

      const response = await SurgeService.createSurgeRule(payload);
      if (response.data?.success) {
        toast.success(response.data.message || 'Surge rule created');
        fetchSurgeRules();
        setShowCreateModal(false);
        setCreateForm({ ...defaultForm });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create surge rule');
    }
  };

  const handleUpdateRule = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        chargeType: editForm.chargeType,
        scope: editForm.scope,
        mode: editForm.mode,
        value: Number(editForm.value),
        startTime: editForm.startTime || undefined,
        endTime: editForm.endTime || undefined,
        maxBookingValue: editForm.maxBookingValue ? Number(editForm.maxBookingValue) : null,
        active: editForm.active,
        zoneId: (editForm.scope === 'zone' && editForm.zoneIds?.length > 0) ? editForm.zoneIds[0] : null
      };

      const response = await SurgeService.updateSurgeRule(selectedRule._id, payload);
      if (response.data?.success) {
        toast.success(response.data.message || 'Surge rule updated');
        fetchSurgeRules();
        setShowEditModal(false);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update surge rule');
    }
  };

  const handleToggleRuleStatus = async (id) => {
    try {
      const response = await SurgeService.toggleSurgeRuleStatus(id);
      if (response.data?.success) {
        toast.success(response.data.message);
        fetchSurgeRules();
      }
    } catch (error) {
      toast.error('Failed to toggle surge status');
    }
  };

  const handleDeleteRule = async (id) => {
    const isConfirmed = await confirm({
      title: 'Delete Surge Rule',
      message: 'Are you sure you want to delete this surge rule permanently? This action cannot be undone.',
      type: 'danger',
      confirmText: 'Delete',
    });

    if (!isConfirmed) return;

    try {
      const response = await SurgeService.deleteSurgeRule(id);
      if (response.data?.success) {
        toast.success(response.data.message);
        fetchSurgeRules();
      }
    } catch (error) {
      toast.error('Failed to delete surge rule');
    }
  };

  const handleEditClick = (rule) => {
    setSelectedRule(rule);
    const ruleZoneId = rule.zoneId?._id || rule.zoneId || '';
    setEditForm({
      chargeType: rule.chargeType,
      scope: rule.scope,
      zoneId: ruleZoneId,
      zoneIds: ruleZoneId ? [ruleZoneId] : [],
      mode: rule.mode,
      value: rule.value,
      startTime: rule.startTime || '',
      endTime: rule.endTime || '',
      maxBookingValue: rule.maxBookingValue || '',
      active: rule.active
    });
    setShowEditModal(true);
  };

  const getZoneHierarchyPath = (zoneId) => {
    if (!zoneId) return 'Unknown Zone';
    const zone = zones.find(z => z._id.toString() === zoneId.toString());
    if (!zone) return 'Global/All';
    let path = zone.name;
    let current = zone;
    while (current && current.parentZone) {
      const parentId = typeof current.parentZone === 'object' ? current.parentZone._id : current.parentZone;
      const parent = zones.find(z => z._id.toString() === parentId.toString());
      if (parent) { path = `${parent.name} › ${path}`; current = parent; } else break;
    }
    return path;
  };

  // ----- Zone Cascade Dropdown Component -----
  const ZoneCascadeSelector = ({ isCreate }) => {
    const form = isCreate ? createForm : editForm;
    const stateSearch = isCreate ? createStateSearch : editStateSearch;
    const setStateSearchFn = isCreate ? setCreateStateSearch : setEditStateSearch;
    const stateOpen = isCreate ? createStateOpen : editStateOpen;
    const setStateOpenFn = isCreate ? setCreateStateOpen : setEditStateOpen;
    const citySearch = isCreate ? createCitySearch : editCitySearch;
    const setCitySearchFn = isCreate ? setCreateCitySearch : setEditCitySearch;
    const cityOpen = isCreate ? createCityOpen : editCityOpen;
    const setCityOpenFn = isCreate ? setCreateCityOpen : setEditCityOpen;
    const microSearch = isCreate ? createMicroSearch : editMicroSearch;
    const setMicroSearchFn = isCreate ? setCreateMicroSearch : setEditMicroSearch;
    const microOpen = isCreate ? createMicroOpen : editMicroOpen;
    const setMicroOpenFn = isCreate ? setCreateMicroOpen : setEditMicroOpen;

    return (
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-secondary mb-1">Target Zone (Hierarchical Selector) *</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* STATE */}
          <div className="relative">
            <label className="block text-xs font-semibold text-gray-500 mb-1">State</label>
            <div
              onClick={() => { setStateOpenFn(!stateOpen); setCityOpenFn(false); setMicroOpenFn(false); }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white cursor-pointer flex justify-between items-center text-sm"
            >
              <span className="text-gray-700 truncate">
                {(() => {
                  const sel = (form.zoneIds || []).filter(id => zones.find(z => z._id === id)?.zoneLevel === 'state');
                  return sel.length === 0 ? 'Select States' : `${sel.length} Selected`;
                })()}
              </span>
              {stateOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </div>
            {stateOpen && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-40 overflow-y-auto p-2">
                <input type="text" placeholder="Search state..." value={stateSearch} onChange={(e) => setStateSearchFn(e.target.value)} onClick={(e) => e.stopPropagation()} className="w-full px-2 py-1 text-xs border border-gray-200 rounded mb-2 focus:outline-none focus:ring-1 focus:ring-primary" />
                <div className="space-y-0.5">
                  {zones.filter(z => z.zoneLevel === 'state' && z.name.toLowerCase().includes(stateSearch.toLowerCase())).map(s => (
                    <label key={s._id} className="flex items-center text-xs font-semibold text-secondary hover:text-primary cursor-pointer py-1 px-1 rounded hover:bg-gray-50" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={(form.zoneIds || []).includes(s._id)} onChange={() => handleZoneToggleCascade(s, isCreate)} className="h-3.5 w-3.5 text-primary border-gray-300 rounded mr-2" />
                      {s.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* CITY */}
          <div className="relative">
            <label className="block text-xs font-semibold text-gray-500 mb-1">City</label>
            <div
              onClick={() => { setCityOpenFn(!cityOpen); setStateOpenFn(false); setMicroOpenFn(false); }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white cursor-pointer flex justify-between items-center text-sm"
            >
              <span className="text-gray-700 truncate">
                {(() => {
                  const sel = (form.zoneIds || []).filter(id => zones.find(z => z._id === id)?.zoneLevel === 'city');
                  return sel.length === 0 ? 'Select Cities' : `${sel.length} Selected`;
                })()}
              </span>
              {cityOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </div>
            {cityOpen && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-40 overflow-y-auto p-2">
                <input type="text" placeholder="Search city..." value={citySearch} onChange={(e) => setCitySearchFn(e.target.value)} onClick={(e) => e.stopPropagation()} className="w-full px-2 py-1 text-xs border border-gray-200 rounded mb-2 focus:outline-none focus:ring-1 focus:ring-primary" />
                <div className="space-y-0.5">
                  {(() => {
                    const selectedStateIds = (form.zoneIds || []).filter(id => zones.find(z => z._id === id)?.zoneLevel === 'state');
                    const cities = selectedStateIds.length > 0
                      ? zones.filter(z => z.zoneLevel === 'city' && selectedStateIds.includes((z.parentZone?._id || z.parentZone || '').toString()))
                      : zones.filter(z => z.zoneLevel === 'city');
                    const fc = cities.filter(c => c.name.toLowerCase().includes(citySearch.toLowerCase()));
                    if (fc.length === 0) return <p className="text-[10px] text-gray-400 italic text-center py-2">No cities available.</p>;
                    return fc.map(c => (
                      <label key={c._id} className="flex items-center text-xs font-semibold text-secondary hover:text-primary cursor-pointer py-1 px-1 rounded hover:bg-gray-50" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={(form.zoneIds || []).includes(c._id)} onChange={() => handleZoneToggleCascade(c, isCreate)} className="h-3.5 w-3.5 text-primary border-gray-300 rounded mr-2" />
                        {c.name}
                      </label>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* MICRO */}
          <div className="relative">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Micro Zone</label>
            <div
              onClick={() => { setMicroOpenFn(!microOpen); setStateOpenFn(false); setCityOpenFn(false); }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white cursor-pointer flex justify-between items-center text-sm"
            >
              <span className="text-gray-700 truncate">
                {(() => {
                  const sel = (form.zoneIds || []).filter(id => zones.find(z => z._id === id)?.zoneLevel === 'micro');
                  return sel.length === 0 ? 'Select Micro Zones' : `${sel.length} Selected`;
                })()}
              </span>
              {microOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </div>
            {microOpen && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-40 overflow-y-auto p-2">
                <input type="text" placeholder="Search micro zone..." value={microSearch} onChange={(e) => setMicroSearchFn(e.target.value)} onClick={(e) => e.stopPropagation()} className="w-full px-2 py-1 text-xs border border-gray-200 rounded mb-2 focus:outline-none focus:ring-1 focus:ring-primary" />
                <div className="space-y-0.5">
                  {(() => {
                    const selectedCityIds = (form.zoneIds || []).filter(id => zones.find(z => z._id === id)?.zoneLevel === 'city');
                    const micros = selectedCityIds.length > 0
                      ? zones.filter(z => z.zoneLevel === 'micro' && selectedCityIds.includes((z.parentZone?._id || z.parentZone || '').toString()))
                      : zones.filter(z => z.zoneLevel === 'micro');
                    const fm = micros.filter(m => m.name.toLowerCase().includes(microSearch.toLowerCase()));
                    if (fm.length === 0) return <p className="text-[10px] text-gray-400 italic text-center py-2">No micro zones available.</p>;
                    return fm.map(m => (
                      <label key={m._id} className="flex items-center text-xs font-medium text-gray-700 hover:text-primary cursor-pointer py-1 px-1 rounded hover:bg-gray-50" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={(form.zoneIds || []).includes(m._id)} onChange={() => handleZoneToggleCascade(m, isCreate)} className="h-3.5 w-3.5 text-primary border-gray-300 rounded mr-2" />
                        {m.name}
                      </label>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Zone Chips */}
        {(form.zoneIds || []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 max-h-20 overflow-y-auto p-2 bg-gray-50 rounded-lg border border-gray-100">
            {(form.zoneIds || []).map(id => {
              const zone = zones.find(z => z._id.toString() === id.toString());
              if (!zone) return null;
              let badgeColor = 'bg-teal-50 text-teal-800 border-teal-200';
              if (zone.zoneLevel === 'city') badgeColor = 'bg-blue-50 text-blue-800 border-blue-200';
              if (zone.zoneLevel === 'micro') badgeColor = 'bg-purple-50 text-purple-800 border-purple-200';
              return (
                <span key={id} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border shadow-xs ${badgeColor}`}>
                  {zone.name} ({zone.zoneLevel?.toUpperCase()})
                  <button type="button" onClick={() => handleZoneToggleCascade(zone, isCreate)} className="ml-1 focus:outline-none">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ----- Surge Form Component -----
  const SurgeForm = ({ form, setForm, onSubmit, isCreate, onCancel }) => {
    const handleChange = (e) => {
      const { name, value, type, checked } = e.target;
      setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    return (
      <form onSubmit={onSubmit} className="space-y-5">
        {/* Charge Type Selector — visual cards */}
        <div>
          <label className="block text-sm font-semibold text-secondary mb-2">Charge Type *</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CHARGE_TYPES.map(ct => {
              const Icon = ct.icon;
              const isActive = form.chargeType === ct.value;
              return (
                <button
                  key={ct.value}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, chargeType: ct.value }))}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all duration-200 text-sm font-semibold ${isActive
                    ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/20 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-gray-400'}`} />
                  {ct.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scope + Active Toggle Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-semibold text-secondary mb-1.5">Scope *</label>
            <select
              name="scope"
              value={form.scope}
              onChange={(e) => {
                const val = e.target.value;
                setForm(prev => ({ ...prev, scope: val, zoneId: '', zoneIds: [] }));
              }}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-white font-medium"
            >
              <option value="global">🌐 Global (All Zones)</option>
              <option value="zone">📍 Zone Specific</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-secondary mb-1.5">Status</label>
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, active: !prev.active }))}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border transition-all duration-200 text-sm font-semibold ${form.active
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-600'
                }`}
            >
              <span>{form.active ? 'Active — Rule is live' : 'Inactive — Rule is paused'}</span>
              {form.active
                ? <ToggleRight className="w-6 h-6 text-green-600" />
                : <ToggleLeft className="w-6 h-6 text-red-400" />
              }
            </button>
          </div>
        </div>

        {/* Zone Selector */}
        {form.scope === 'zone' && (
          <HierarchicalZoneSelector
            zones={zones}
            selectedZoneIds={form.zoneIds}
            onChange={(newZoneIds) => {
              if (Array.isArray(newZoneIds)) {
                setForm(prev => ({ ...prev, zoneIds: newZoneIds }));
              } else if (newZoneIds && (newZoneIds._id || newZoneIds.id)) {
                const targetId = (newZoneIds._id || newZoneIds.id).toString();
                setForm(prev => ({ ...prev, zoneIds: (prev.zoneIds || []).filter(id => id.toString() !== targetId) }));
              }
            }}
            label="Target Zone (Hierarchical Selector) *"
          />
        )}

        {/* Charge Mode + Value */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-semibold text-secondary mb-1.5">Charge Mode *</label>
            <select
              name="mode"
              value={form.mode}
              onChange={handleChange}
              required
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-white font-medium"
            >
              <option value="flat">💵 Flat Amount (₹)</option>
              <option value="percentage">📊 Percentage (%)</option>
              <option value="multiplier">✖️ Multiplier (x)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-secondary mb-1.5">
              Charge Value * {form.mode === 'flat' ? '(₹)' : form.mode === 'percentage' ? '(%)' : '(x)'}
            </label>
            <input
              type="number"
              name="value"
              value={form.value}
              onChange={handleChange}
              required
              min="0"
              step="any"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
              placeholder={form.mode === 'flat' ? 'e.g. 50' : form.mode === 'percentage' ? 'e.g. 10' : 'e.g. 1.5'}
            />
          </div>
        </div>

        {/* Time Window */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-semibold text-secondary mb-1.5">Start Time (Optional)</label>
            <input
              type="text"
              name="startTime"
              value={form.startTime}
              onChange={handleChange}
              placeholder="e.g. 18:00"
              pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
              title="Time in HH:MM format"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-secondary mb-1.5">End Time (Optional)</label>
            <input
              type="text"
              name="endTime"
              value={form.endTime}
              onChange={handleChange}
              placeholder="e.g. 23:00"
              pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
              title="Time in HH:MM format"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>
        </div>

        {/* Booking Value Limit */}
        <div>
          <label className="block text-sm font-semibold text-secondary mb-1.5">
            Booking Value Limit (Optional) — Surcharge will NOT apply if order subtotal exceeds this amount
          </label>
          <input
            type="number"
            name="maxBookingValue"
            value={form.maxBookingValue}
            onChange={handleChange}
            min="0"
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
            placeholder="e.g. 500 (Free for orders above 500)"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
          <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors text-sm font-medium">
            Cancel
          </button>
          <button type="submit" className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-semibold flex items-center shadow-md">
            <Save className="w-4 h-4 mr-2" />
            {isCreate ? 'Create Surge Rule' : 'Save Changes'}
          </button>
        </div>
      </form>
    );
  };

  // ----- Tab counts -----
  const tabCounts = useMemo(() => {
    const counts = { all: surgeRules.length };
    CHARGE_TYPES.forEach(ct => {
      counts[ct.value] = surgeRules.filter(r => r.chargeType === ct.value).length;
    });
    return counts;
  }, [surgeRules]);

  return (
    <div className="min-h-screen p-4 md:p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-secondary">Surge & Surcharge Management</h1>
            <p className="text-gray-600 mt-1">Configure dynamic booking surge charges by type and zone</p>
          </div>
          <button
            onClick={() => { setCreateForm({ ...defaultForm }); setShowCreateModal(true); }}
            className="flex items-center bg-primary hover:bg-teal-800 text-white px-4 py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 text-sm font-semibold"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Surge Rule
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
          <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-primary">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Rules</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary mt-1">{stats.total}</p>
              </div>
              <div className="p-3 bg-teal-50 rounded-full">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Active Rules</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary mt-1">{stats.active}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-full">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Global Scopes</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary mt-1">{stats.global}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-full">
                <Globe className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-amber-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Zone-Specific</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary mt-1">{stats.zoneSpecific}</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-full">
                <MapPin className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="overflow-x-auto">
            <div className="flex border-b border-gray-100 px-4 min-w-max">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-3 text-sm font-semibold border-b-2 transition-all duration-200 whitespace-nowrap ${activeTab === 'all'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                All Rules
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-gray-100 text-gray-600">{tabCounts.all}</span>
              </button>
              {CHARGE_TYPES.map(ct => {
                const Icon = ct.icon;
                const count = tabCounts[ct.value] || 0;
                return (
                  <button
                    key={ct.value}
                    onClick={() => setActiveTab(ct.value)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-all duration-200 whitespace-nowrap ${activeTab === ct.value
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {ct.label}
                    {count > 0 && <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-gray-100 text-gray-600">{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search surge rules..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Filter className="text-gray-400 w-5 h-5 shrink-0" />
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-white">
                <option value="all">All Types</option>
                {CHARGE_TYPES.map(ct => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-white">
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Rules Table */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-gray-600 font-medium">Loading rules...</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {currentRules.length === 0 ? (
              <div className="text-center py-16">
                <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-lg font-medium">No surge rules found</p>
                <p className="text-gray-400 mt-2 text-sm">
                  {searchTerm || typeFilter !== 'all' || statusFilter !== 'all' || activeTab !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Create a surge rule to get started'}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Scope</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Zone</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Mode</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Value</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {currentRules.map((rule) => {
                        const ctConfig = getChargeTypeConfig(rule.chargeType);
                        const TypeIcon = ctConfig.icon;
                        return (
                          <tr key={rule._id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${ctConfig.color}`}>
                                <TypeIcon className="w-3.5 h-3.5" />
                                {ctConfig.label}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${rule.scope === 'global' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                                {rule.scope === 'global' ? '🌐 Global' : '📍 Zone'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm font-medium text-gray-700">
                                {rule.scope === 'zone' && rule.zoneId
                                  ? getZoneHierarchyPath(rule.zoneId._id || rule.zoneId)
                                  : <span className="text-gray-400 italic">All Zones</span>
                                }
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-gray-600 capitalize font-medium">{rule.mode}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm font-bold text-secondary">
                                {rule.mode === 'flat' && formatCurrency(rule.value)}
                                {rule.mode === 'percentage' && `${rule.value}%`}
                                {rule.mode === 'multiplier' && `${rule.value}x`}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center text-xs text-gray-600 font-medium">
                                <Clock className="w-3.5 h-3.5 mr-1 text-gray-400" />
                                {rule.startTime && rule.endTime ? `${rule.startTime} – ${rule.endTime}` : '24 Hours'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button
                                onClick={() => handleToggleRuleStatus(rule._id)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors ${rule.active
                                  ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                  : 'bg-red-50 text-red-600 hover:bg-red-100'
                                  }`}
                              >
                                {rule.active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                                {rule.active ? 'Active' : 'Inactive'}
                              </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="flex items-center space-x-3">
                                <button onClick={() => handleEditClick(rule)} className="text-primary hover:text-teal-800 transition-colors" title="Edit">
                                  <Edit className="w-4.5 h-4.5" />
                                </button>
                                <button onClick={() => handleDeleteRule(rule._id)} className="text-red-600 hover:text-red-800 transition-colors" title="Delete">
                                  <Trash2 className="w-4.5 h-4.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-gray-100">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={filteredRules.length}
                    limit={itemsPerPage}
                    onPageChange={setCurrentPage}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Customizable Splits */}
        {systemSettings && (
          <div className="bg-white rounded-xl shadow-sm p-6 mt-8 border border-gray-150">
            <div className="border-b border-gray-100 pb-4 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-secondary font-poppins flex items-center gap-2">
                  <Coins className="w-5 h-5 text-primary" />
                  Provider Surcharge Split Settings (Customizable Splits)
                </h3>
                <p className="text-xs text-gray-500 font-inter mt-1">
                  Define the percentage share of each active surcharge type that is paid out directly to the Service Provider. The remaining percentage will be retained by the Company.
                </p>
              </div>
              <button
                onClick={saveSplitSettings}
                disabled={savingSplits}
                className="flex items-center bg-primary hover:bg-teal-800 text-white px-4 py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 text-xs font-semibold shrink-0"
              >
                <Save className="w-4.5 h-4.5 mr-1.5" />
                {savingSplits ? 'Saving...' : 'Save Splits'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Visiting Share (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={systemSettings.surgeSplitSettings?.visiting ?? 60}
                    onChange={(e) => handleSplitChange('visiting', e.target.value)}
                    min="0"
                    max="100"
                    className="w-full pr-8 pl-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 font-bold text-xs">%</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Rain Share (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={systemSettings.surgeSplitSettings?.rain ?? 70}
                    onChange={(e) => handleSplitChange('rain', e.target.value)}
                    min="0"
                    max="100"
                    className="w-full pr-8 pl-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 font-bold text-xs">%</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Traffic Share (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={systemSettings.surgeSplitSettings?.traffic ?? 70}
                    onChange={(e) => handleSplitChange('traffic', e.target.value)}
                    min="0"
                    max="100"
                    className="w-full pr-8 pl-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 font-bold text-xs">%</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Night Share (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={systemSettings.surgeSplitSettings?.night ?? 70}
                    onChange={(e) => handleSplitChange('night', e.target.value)}
                    min="0"
                    max="100"
                    className="w-full pr-8 pl-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 font-bold text-xs">%</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Demand Share (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={systemSettings.surgeSplitSettings?.demand ?? 50}
                    onChange={(e) => handleSplitChange('demand', e.target.value)}
                    min="0"
                    max="100"
                    className="w-full pr-8 pl-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 font-bold text-xs">%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Add Surge Rule" size="large">
            <SurgeForm
              form={createForm}
              setForm={setCreateForm}
              onSubmit={handleCreateRule}
              isCreate={true}
              onCancel={() => setShowCreateModal(false)}
            />
          </Modal>
        )}

        {/* Edit Modal */}
        {showEditModal && (
          <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Surge Rule" size="large">
            <SurgeForm
              form={editForm}
              setForm={setEditForm}
              onSubmit={handleUpdateRule}
              isCreate={false}
              onCancel={() => setShowEditModal(false)}
            />
          </Modal>
        )}
      </div>
    </div>
  );
};

// Reusable Modal
const Modal = ({ isOpen, onClose, title, children, size = 'medium' }) => {
  if (!isOpen) return null;
  const sizeClasses = { medium: 'sm:max-w-lg', large: 'sm:max-w-2xl', xlarge: 'sm:max-w-4xl' };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={onClose}></div>
        </div>
        <div className={`bg-white rounded-xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 ${sizeClasses[size]} sm:w-full`}>
          <div className="bg-white px-6 py-5 sm:p-7">
            <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                <h3 className="text-lg leading-6 font-bold text-secondary">{title}</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors duration-200">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SurgeManagement;
