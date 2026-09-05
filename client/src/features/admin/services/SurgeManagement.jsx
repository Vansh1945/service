import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import Pagination from '../../../components/ui/Pagination';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Alert from '../../../components/ui/Alert';
import Loader from '../../../components/ui/Loader';
import EmptyState from '../../../components/ui/EmptyState';
import Badge from '../../../components/ui/Badge';
import {
  Plus,
  Edit,
  Trash2,
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
import { toast } from '../../../components/ui/Toast';

import { useAuth } from '../../../context/auth';
import { useConfirm } from '../../../context/ConfirmContext';
import * as SurgeService from '../../../services/SurgeService';
import { getAllZones } from '../../../services/ZoneService';
import * as SystemService from '../../../services/SystemService';
import { formatCurrency } from '../../../utils/format';
import HierarchicalZoneSelector from '../../../components/HierarchicalZoneSelector';
import StatCard from '../../../components/ui/StatCard';

// Charge type config — maps UI labels to backend enum values
const CHARGE_TYPES = [
  { value: 'visiting', label: 'Visiting Charge', icon: MapPin, color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { value: 'rain', label: 'Rain Charge', icon: CloudRain, color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { value: 'traffic', label: 'Traffic Charge', icon: Car, color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'night', label: 'Night Charge', icon: Moon, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'demand', label: 'Demand Surge', icon: Flame, color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'festival', label: 'Festival Surge', icon: Flame, color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'custom', label: 'Custom Charge', icon: Wrench, color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'platform', label: 'Platform Fee', icon: Coins, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
];

const getChargeTypeConfig = (val) => CHARGE_TYPES.find(t => t.value === val) || { value: val, label: val.charAt(0).toUpperCase() + val.slice(1) + ' Charge', icon: AlertCircle, color: 'bg-slate-50 text-slate-700 border-slate-200' };

const SurgeManagement = () => {
  const { showToast } = useAuth();
  const loc = useLocation();
  const confirm = useConfirm();

  // Data
  const [surgeRules, setSurgeRules] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [togglingRuleId, setTogglingRuleId] = useState(null);
  // Tabs
  const [activeTab, setActiveTab] = useState('all');

  // Stats
  const [stats, setStats] = useState({ total: 0, active: 0, global: 0, zoneSpecific: 0 });

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);

  // Filters
  const [searchParams] = useSearchParams();
  const searchParamQuery = searchParams.get('search') || '';
  const [searchTerm, setSearchTerm] = useState(searchParamQuery);

  useEffect(() => {
    setSearchTerm(searchParamQuery);
  }, [searchParamQuery]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

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
    effectiveFrom: '',
    effectiveUntil: '',
    daysOfWeek: [],
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

  const handleEmergencySurgeChargeChange = (value) => {
    setSystemSettings(prev => ({
      ...prev,
      bookingSettings: {
        ...prev?.bookingSettings,
        emergencySurgeCharge: Number(value)
      }
    }));
  };

  const handleChargeVisitingOnEmergencyToggle = (checked) => {
    setSystemSettings(prev => ({
      ...prev,
      bookingSettings: {
        ...prev?.bookingSettings,
        chargeVisitingOnEmergency: checked
      }
    }));
  };

  const saveSplitSettings = async () => {
    try {
      setSavingSplits(true);
      const formData = new FormData();
      formData.append('companyName', systemSettings.companyName || 'Raj Electrical Services');
      formData.append('surgeSplitSettings', JSON.stringify(systemSettings.surgeSplitSettings));
      if (systemSettings.bookingSettings) {
        formData.append('bookingSettings', JSON.stringify(systemSettings.bookingSettings));
      }

      const response = await SystemService.updateSystemSetting(formData);
      if (response.data?.success) {
        toast.success('Surcharge split settings saved successfully!');
        fetchSystemSettings();
      }
    } catch (error) {
      console.error(error);
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
    const params = new URLSearchParams(loc.search);
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
  }, [loc.search]);

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

  // ----- Derived Status Helper -----
  const getRuleDisplayStatus = (rule) => {
    const isActive = rule && (rule.active === true || rule.active === 'true');
    if (!rule || !isActive) {
      return { label: 'Inactive', badgeClass: 'bg-red-50 text-red-600 border border-red-200' };
    }
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    if (rule.effectiveFrom && todayStr < rule.effectiveFrom) {
      return { label: 'Scheduled', badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200' };
    }
    if (rule.effectiveUntil && todayStr > rule.effectiveUntil) {
      return { label: 'Expired', badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200' };
    }
    return { label: 'Active Now', badgeClass: 'bg-green-50 text-green-700 border border-green-200' };
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
        effectiveFrom: createForm.effectiveFrom || undefined,
        effectiveUntil: createForm.effectiveUntil || undefined,
        daysOfWeek: createForm.daysOfWeek || [],
        maxBookingValue: createForm.maxBookingValue ? Number(createForm.maxBookingValue) : null,
        active: createForm.active,
        zoneId: (createForm.scope === 'zone' && createForm.zoneIds?.length > 0) ? createForm.zoneIds[0] : null
      };

      const response = await SurgeService.createSurgeRule(payload);
      if (response.data?.success) {
        const newRule = response.data.data;
        toast.success(response.data.message || 'Surge rule created');
        // Immediately prepend the new rule and switch to 'all' tab so it's visible right away
        setSurgeRules(prev => [newRule, ...prev]);
        setShowCreateModal(false);
        setCreateForm({ ...defaultForm });
        setActiveTab('all');
        setTypeFilter('all');
        setStatusFilter('all');
        setSearchTerm('');
        setCurrentPage(1);
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
        effectiveFrom: editForm.effectiveFrom || undefined,
        effectiveUntil: editForm.effectiveUntil || undefined,
        daysOfWeek: editForm.daysOfWeek || [],
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
    if (togglingRuleId === id) return; // prevent double-click
    setTogglingRuleId(id);

    // Optimistic update: immediately flip active in local state
    let previousRules;
    setSurgeRules(prev => {
      previousRules = prev;
      return prev.map(r => r._id === id ? { ...r, active: !r.active } : r);
    });

    try {
      const response = await SurgeService.toggleSurgeRuleStatus(id);
      if (response.data?.success) {
        // Merge server data (has populated zoneId)
        const serverRule = response.data.data;
        setSurgeRules(prev => prev.map(r => r._id === id ? { ...r, ...serverRule } : r));
        toast.success(response.data.message);
      } else {
        // Revert if not successful
        setSurgeRules(previousRules);
        toast.error('Failed to toggle surge status');
      }
    } catch (error) {
      // Rollback on error
      setSurgeRules(previousRules);
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to toggle surge status');
    } finally {
      setTogglingRuleId(null);
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
      console.error(error);
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
      effectiveFrom: rule.effectiveFrom || '',
      effectiveUntil: rule.effectiveUntil || '',
      daysOfWeek: rule.daysOfWeek || [],
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
      <div className="w-full">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-secondary">Surge & Surcharge Management</h1>
            <p className="text-gray-600 mt-1">Configure dynamic booking surge charges by type and zone</p>
          </div>
          <Button
            onClick={() => { setCreateForm({ ...defaultForm }); setShowCreateModal(true); }}
            leftIcon={<Plus className="w-4 h-4" />}
            size="md"
          >
            Add Surge Rule
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
          <StatCard
            title="Total Rules"
            value={stats.total}
            icon={TrendingUp}
            iconBg="bg-teal-50"
            iconColor="text-primary"
          />
          <StatCard
            title="Active Rules"
            value={stats.active}
            icon={CheckCircle}
            iconBg="bg-green-50"
            iconColor="text-green-600"
          />
          <StatCard
            title="Global Scopes"
            value={stats.global}
            icon={Globe}
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
          />
          <StatCard
            title="Zone-Specific"
            value={stats.zoneSpecific}
            icon={MapPin}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
          />
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


        {/* Rules Table */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Loader text="Loading surge rules..." />
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {currentRules.length === 0 ? (
              <EmptyState
                title="No surge rules found"
                message={
                  searchTerm || typeFilter !== 'all' || statusFilter !== 'all' || activeTab !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Create a surge rule to get started'
                }
                actionLabel={activeTab !== 'all' || searchTerm ? 'Clear Filters' : 'Add Surge Rule'}
                onAction={() => {
                  if (activeTab !== 'all' || searchTerm) {
                    setActiveTab('all');
                    setSearchTerm('');
                    setTypeFilter('all');
                    setStatusFilter('all');
                  } else {
                    setCreateForm({ ...defaultForm });
                    setShowCreateModal(true);
                  }
                }}
                className="py-12 border-0 shadow-none"
              />
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
                              <div className="flex flex-col text-xs text-gray-600 font-medium gap-0.5">
                                <div className="flex items-center">
                                  <Clock className="w-3.5 h-3.5 mr-1 text-gray-400" />
                                  {rule.startTime && rule.endTime ? `${rule.startTime} – ${rule.endTime}` : '24 Hours'}
                                </div>
                                {(rule.effectiveFrom || rule.effectiveUntil) && (
                                  <div className="text-[11px] text-gray-500">
                                    🗓️ {rule.effectiveFrom || 'Start'} to {rule.effectiveUntil || 'End'}
                                  </div>
                                )}
                                {Array.isArray(rule.daysOfWeek) && rule.daysOfWeek.length > 0 && (
                                  <div className="text-[10px] text-teal-700 font-semibold">
                                    📅 Days: {rule.daysOfWeek.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {(() => {
                                const statusInfo = getRuleDisplayStatus(rule);
                                const isActive = rule.active === true || rule.active === 'true';
                                return (
                                  <div className="flex items-center gap-2">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${statusInfo.badgeClass}`}>
                                      {statusInfo.label}
                                    </span>
                                    <button
                                      onClick={() => handleToggleRuleStatus(rule._id)}
                                      className="text-gray-400 hover:text-gray-600 transition-colors"
                                      title={isActive ? 'Deactivate Rule' : 'Activate Rule'}
                                    >
                                      {isActive ? (
                                        <ToggleRight className="w-5 h-5 text-green-600" />
                                      ) : (
                                        <ToggleLeft className="w-5 h-5 text-red-400" />
                                      )}
                                    </button>
                                  </div>
                                );
                              })()}
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
              <Button
                onClick={saveSplitSettings}
                isLoading={savingSplits}
                leftIcon={<Save className="w-4 h-4" />}
                size="sm"
              >
                Save Splits
              </Button>
            </div>

            {/* All split fields in one unified row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 items-end">

              {/* Emergency Flat Rate */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Emergency Rate (₹)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">₹</span>
                  <input
                    type="number"
                    value={systemSettings.bookingSettings?.emergencySurgeCharge ?? 0}
                    onChange={(e) => handleEmergencySurgeChargeChange(e.target.value)}
                    min="0"
                    className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  />
                </div>
              </div>

              {/* Charge Visiting Fee toggle */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Visiting on Emergency</label>
                <label htmlFor="chargeVisitingOnEmergency" className="flex items-center gap-2.5 w-full px-3 py-2 border border-gray-200 rounded-lg bg-white cursor-pointer select-none" style={{minHeight:'38px'}}>
                  <input
                    type="checkbox"
                    id="chargeVisitingOnEmergency"
                    checked={systemSettings.bookingSettings?.chargeVisitingOnEmergency ?? false}
                    onChange={(e) => handleChargeVisitingOnEmergencyToggle(e.target.checked)}
                    className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer shrink-0"
                  />
                  <span className="text-sm font-semibold text-gray-600">Apply fee</span>
                </label>
              </div>

              {/* Visiting Share */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Visiting Share (%)</label>
                <div className="relative">
                  <input type="number" value={systemSettings.surgeSplitSettings?.visiting ?? 60} onChange={(e) => handleSplitChange('visiting', e.target.value)} min="0" max="100" className="w-full pr-8 pl-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">%</span>
                </div>
              </div>

              {/* Rain Share */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Rain Share (%)</label>
                <div className="relative">
                  <input type="number" value={systemSettings.surgeSplitSettings?.rain ?? 70} onChange={(e) => handleSplitChange('rain', e.target.value)} min="0" max="100" className="w-full pr-8 pl-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">%</span>
                </div>
              </div>

              {/* Traffic Share */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Traffic Share (%)</label>
                <div className="relative">
                  <input type="number" value={systemSettings.surgeSplitSettings?.traffic ?? 70} onChange={(e) => handleSplitChange('traffic', e.target.value)} min="0" max="100" className="w-full pr-8 pl-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">%</span>
                </div>
              </div>

              {/* Night Share */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Night Share (%)</label>
                <div className="relative">
                  <input type="number" value={systemSettings.surgeSplitSettings?.night ?? 70} onChange={(e) => handleSplitChange('night', e.target.value)} min="0" max="100" className="w-full pr-8 pl-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">%</span>
                </div>
              </div>

              {/* Demand Share */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Demand Share (%)</label>
                <div className="relative">
                  <input type="number" value={systemSettings.surgeSplitSettings?.demand ?? 50} onChange={(e) => handleSplitChange('demand', e.target.value)} min="0" max="100" className="w-full pr-8 pl-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">%</span>
                </div>
              </div>

              {/* Festival Share */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Festival Share (%)</label>
                <div className="relative">
                  <input type="number" value={systemSettings.surgeSplitSettings?.festival ?? 70} onChange={(e) => handleSplitChange('festival', e.target.value)} min="0" max="100" className="w-full pr-8 pl-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">%</span>
                </div>
              </div>

              {/* Custom Share */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Custom Share (%)</label>
                <div className="relative">
                  <input type="number" value={systemSettings.surgeSplitSettings?.custom ?? 70} onChange={(e) => handleSplitChange('custom', e.target.value)} min="0" max="100" className="w-full pr-8 pl-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">%</span>
                </div>
              </div>

              {/* Platform Share */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Platform Share (%)</label>
                <div className="relative">
                  <input type="number" value={systemSettings.surgeSplitSettings?.platform ?? 0} onChange={(e) => handleSplitChange('platform', e.target.value)} min="0" max="100" className="w-full pr-8 pl-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">%</span>
                </div>
              </div>

              {/* Emergency Share */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Emergency Share (%)</label>
                <div className="relative">
                  <input type="number" value={systemSettings.surgeSplitSettings?.emergency ?? 85} onChange={(e) => handleSplitChange('emergency', e.target.value)} min="0" max="100" className="w-full pr-8 pl-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">%</span>
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
              zones={zones}
              existingRules={surgeRules}
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
              zones={zones}
              existingRules={surgeRules}
              editingRuleId={selectedRule?._id}
            />
          </Modal>
        )}
      </div>
    </div>
  );
};



// ----- Zone Cascade Dropdown Component -----
const ZoneCascadeSelector = ({
  form,
  stateSearch,
  setStateSearchFn,
  stateOpen,
  setStateOpenFn,
  citySearch,
  setCitySearchFn,
  cityOpen,
  setCityOpenFn,
  microSearch,
  setMicroSearchFn,
  microOpen,
  setMicroOpenFn,
  zones,
  handleZoneToggleCascade,
  isCreate
}) => {
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
const SurgeForm = ({ form, setForm, onSubmit, isCreate, onCancel, zones, existingRules = [], editingRuleId = null }) => {
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  // Detect conflict: same chargeType + scope + zoneId already exists
  const conflictRule = existingRules.find(r => {
    if (editingRuleId && r._id === editingRuleId) return false; // exclude self when editing
    if (r.chargeType !== form.chargeType) return false;
    if (r.scope !== form.scope) return false;
    if (form.scope === 'zone') {
      const rZoneId = (r.zoneId?._id || r.zoneId || '').toString();
      const fZoneId = (form.zoneIds && form.zoneIds[0]) ? form.zoneIds[0].toString() : '';
      return rZoneId === fZoneId && fZoneId !== '';
    }
    return true; // global scope conflict
  });

  const hasConflict = !!conflictRule;

  return (
    <form onSubmit={hasConflict ? (e) => e.preventDefault() : onSubmit} className="space-y-5">
      {/* Conflict Warning Banner */}
      {hasConflict && (
        <Alert
          type="warning"
          title="Duplicate Rule Detected"
          message={`A ${getChargeTypeConfig(form.chargeType).label} rule already exists ${form.scope === 'global' ? 'for Global scope' : 'for this zone'}. Only one rule per charge type is allowed. Please edit the existing rule instead.`}
        />
      )}
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

      {/* Date Range Scheduling */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-primary" />
          Date & Calendar Scheduling (Optional)
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Effective From (YYYY-MM-DD)</label>
            <input
              type="date"
              name="effectiveFrom"
              value={form.effectiveFrom || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Effective Until (YYYY-MM-DD)</label>
            <input
              type="date"
              name="effectiveUntil"
              value={form.effectiveUntil || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Days of Week Selection */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Active Days of Week (Leave empty for All Days)</label>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 1, label: 'Mon' },
              { id: 2, label: 'Tue' },
              { id: 3, label: 'Wed' },
              { id: 4, label: 'Thu' },
              { id: 5, label: 'Fri' },
              { id: 6, label: 'Sat' },
              { id: 0, label: 'Sun' }
            ].map((day) => {
              const selectedDays = form.daysOfWeek || [];
              const isSelected = selectedDays.includes(day.id);
              return (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => {
                    const newDays = isSelected
                      ? selectedDays.filter(d => d !== day.id)
                      : [...selectedDays, day.id];
                    setForm(prev => ({ ...prev, daysOfWeek: newDays }));
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Daily Time Window */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-semibold text-secondary mb-1.5">Start Time (HH:MM)</label>
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
          <label className="block text-sm font-semibold text-secondary mb-1.5">End Time (HH:MM)</label>
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
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={hasConflict}
          size="sm"
          leftIcon={<Save className="w-4 h-4" />}
        >
          {isCreate ? 'Create Surge Rule' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
};

export default SurgeManagement;
