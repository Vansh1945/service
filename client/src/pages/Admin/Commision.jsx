import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/auth';
import useDebounce from '../../hooks/useDebounce';
import { useConfirm } from '../../context/ConfirmContext';
import AdminSearchBar from '../../components/AdminSearchBar';
import {
  Users,
  Settings,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  X,
  Percent,
  Info,
  Globe,
  Calendar} from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format';
import * as CommissionService from '../../services/CommissionService';
import * as AdminService from '../../services/AdminService';
import * as ZoneService from '../../services/ZoneService';
import Pagination from '../../components/Pagination';
import { useAdminFilter } from '../../context/AdminFilterContext';
import AdminFilterBar from '../../components/AdminFilterBar';
import HierarchicalZoneSelector from '../../components/HierarchicalZoneSelector';
import StatsCard from '../../components/ui/StatsCard';

const AdminCommissionPage = () => {
  const { API, token, showToast } = useAuth();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);

  const {
    filterType,
    year,
    financialYear,
    month,
    quarter,
    zoneIds,
    getMergedQuery
  } = useAdminFilter();

  // Data states
  const [commissionRules, setCommissionRules] = useState([]);
  const [zones, setZones] = useState([]);
  const [providers, setProviders] = useState([]);

  // Stats
  const [stats, setStats] = useState({
    totalProviders: 0,
    activeRules: 0,
    totalProcessedCommissions: 0,
    avgCommissionRate: 0
  });

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });

  // Modal states
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showRuleDetailsModal, setShowRuleDetailsModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [viewingRule, setViewingRule] = useState(null);

  // Form state matching backend model
  const [ruleForm, setRuleForm] = useState({
    name: '',
    description: '',
    type: 'percentage',
    value: 10,
    applyTo: 'all',
    performanceScore: '',
    specificProvider: '',
    zoneId: '',
    zoneIds: [],
    effectiveFrom: new Date(),
    effectiveUntil: ''
  });

  const [stateSearch, setStateSearch] = useState('');
  const [stateOpen, setStateOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [cityOpen, setCityOpen] = useState(false);
  const [microSearch, setMicroSearch] = useState('');
  const [microOpen, setMicroOpen] = useState(false);

  const handleZoneToggleCascade = (zone) => {
    const currentSelected = ruleForm.zoneIds || [];
    const zoneId = zone._id.toString();

    let newZones = [...currentSelected];

    if (currentSelected.includes(zone._id)) {
      // DESELECT logic
      newZones = newZones.filter(id => id !== zone._id);

      if (zone.zoneLevel === 'state') {
        const childCities = zones.filter(z => z.zoneLevel === 'city' && (z.parentZone?._id || z.parentZone || '').toString() === zoneId);
        const cityIds = childCities.map(c => c._id.toString());
        newZones = newZones.filter(id => !cityIds.includes(id));

        const childMicros = zones.filter(z => z.zoneLevel === 'micro' && cityIds.includes((z.parentZone?._id || z.parentZone || '').toString()));
        const microIds = childMicros.map(m => m._id.toString());
        newZones = newZones.filter(id => !microIds.includes(id));
      } else if (zone.zoneLevel === 'city') {
        const childMicros = zones.filter(z => z.zoneLevel === 'micro' && (z.parentZone?._id || z.parentZone || '').toString() === zoneId);
        const microIds = childMicros.map(m => m._id.toString());
        newZones = newZones.filter(id => !microIds.includes(id));

        const parentStateId = (zone.parentZone?._id || zone.parentZone || '').toString();
        if (parentStateId) {
          newZones = newZones.filter(id => id !== parentStateId);
        }
      } else if (zone.zoneLevel === 'micro') {
        const parentCityId = (zone.parentZone?._id || zone.parentZone || '').toString();
        if (parentCityId) {
          newZones = newZones.filter(id => id !== parentCityId);
          const parentCity = zones.find(z => z._id.toString() === parentCityId);
          const parentStateId = parentCity ? (parentCity.parentZone?._id || parentCity.parentZone || '').toString() : '';
          if (parentStateId) {
            newZones = newZones.filter(id => id !== parentStateId);
          }
        }
      }
    } else {
      // SELECT logic
      newZones.push(zone._id);

      if (zone.zoneLevel === 'state') {
        const childCities = zones.filter(z => z.zoneLevel === 'city' && (z.parentZone?._id || z.parentZone || '').toString() === zoneId);
        const cityIds = childCities.map(c => c._id);

        const childMicros = zones.filter(z => z.zoneLevel === 'micro' && cityIds.map(id => id.toString()).includes((z.parentZone?._id || z.parentZone || '').toString()));
        const microIds = childMicros.map(m => m._id);

        newZones = Array.from(new Set([...newZones, ...cityIds, ...microIds]));
      } else if (zone.zoneLevel === 'city') {
        const childMicros = zones.filter(z => z.zoneLevel === 'micro' && (z.parentZone?._id || z.parentZone || '').toString() === zoneId);
        const microIds = childMicros.map(m => m._id);
        newZones = Array.from(new Set([...newZones, ...microIds]));

        const parentStateId = (zone.parentZone?._id || zone.parentZone || '').toString();
        if (parentStateId) {
          const siblingCities = zones.filter(z => z.zoneLevel === 'city' && (z.parentZone?._id || z.parentZone || '').toString() === parentStateId);
          const allSiblingCityIds = siblingCities.map(c => c._id.toString());
          const areAllSelected = allSiblingCityIds.every(id => newZones.includes(id));
          if (areAllSelected) {
            newZones.push(parentStateId);
          }
        }
      } else if (zone.zoneLevel === 'micro') {
        const parentCityId = (zone.parentZone?._id || zone.parentZone || '').toString();
        if (parentCityId) {
          const siblingMicros = zones.filter(z => z.zoneLevel === 'micro' && (z.parentZone?._id || z.parentZone || '').toString() === parentCityId);
          const allSiblingMicroIds = siblingMicros.map(m => m._id.toString());
          const areAllSelected = allSiblingMicroIds.every(id => newZones.includes(id));
          if (areAllSelected) {
            newZones.push(parentCityId);

            const parentCity = zones.find(z => z._id.toString() === parentCityId);
            const parentStateId = parentCity ? (parentCity.parentZone?._id || parentCity.parentZone || '').toString() : '';
            if (parentStateId) {
              const siblingCities = zones.filter(z => z.zoneLevel === 'city' && (z.parentZone?._id || z.parentZone || '').toString() === parentStateId);
              const allSiblingCityIds = siblingCities.map(c => c._id.toString());
              const areAllSelectedCities = allSiblingCityIds.every(id => newZones.includes(id) || id === parentCityId);
              if (areAllSelectedCities) {
                newZones.push(parentStateId);
              }
            }
          }
        }
      }
    }

    setRuleForm(prev => ({
      ...prev,
      zoneIds: newZones,
      zoneId: newZones[0] || ''
    }));
  };

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    isActive: '',
    applyTo: '',
    priorityTier: '',
    performanceScore: ''
  });

  const debouncedSearch = useDebounce(filters.search, 500);

  // Available options matching backend enum
  const performanceScores = ['Bronze', 'Silver', 'Gold', 'Platinum'];
  const applyToOptions = ['all', 'performanceScore', 'specificProvider'];

  // Fetch commission rules
  const fetchCommissionRules = useCallback(async (page = 1, limit = 10) => {
    setLoading(true);
    try {
      const params = {
        page: page,
        limit: limit,
        ...(filters.isActive && { isActive: filters.isActive }),
        ...(filters.applyTo && { applyTo: filters.applyTo }),
        ...(filters.priorityTier && { priorityTier: filters.priorityTier }),
        ...(filters.performanceScore && { performanceScore: filters.performanceScore }),
        ...(zoneIds && zoneIds.length > 0 && { zoneIds: zoneIds.join(',') })
      };

      const response = await CommissionService.listCommissionRules(params);
      const data = response.data;
      if (data.success) {
        setCommissionRules(data.data);
        setPagination(data.pagination);

        const activeCount = data.data.filter(rule => rule.isActive).length;
        setStats(prev => ({
          ...prev,
          activeRules: activeCount,
          totalRules: data.pagination.total
        }));

        if (data.data.length > 0) {
          const percentageRules = data.data.filter(rule => rule.type === 'percentage');
          const avgRate = percentageRules.length > 0
            ? percentageRules.reduce((sum, rule) => sum + rule.value, 0) / percentageRules.length
            : 0;
          setStats(prev => ({ ...prev, avgCommissionRate: avgRate.toFixed(1) }));
        }
      }
    } catch (error) {
      showToast('Failed to fetch commission rules', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters.isActive, filters.applyTo, filters.priorityTier, filters.performanceScore, zoneIds, showToast]);

  // Fetch specific commission rule by ID
  const fetchCommissionRuleById = async (ruleId) => {
    setLoading(true);
    try {
      const response = await CommissionService.getCommissionRuleById(ruleId);
      const data = response.data;
      if (data.success) {
        setViewingRule(data.data);
        setShowRuleDetailsModal(true);
      } else {
        showToast(data.message || 'Failed to fetch rule details', 'error');
      }
    } catch (error) {
      showToast('Failed to fetch rule details', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch providers
  const fetchProviders = async () => {
    try {
      const response = await AdminService.getAllProviders({ limit: 100 });
      const data = response.data;
      if (data.success) {
        setProviders(data.providers || []);
        setStats(prev => ({
          ...prev,
          totalProviders: (data.providers || []).length
        }));
      } else {
        showToast(data.message || 'Failed to fetch providers', 'error');
      }
    } catch (error) {
      showToast('Failed to fetch providers', 'error');
      setProviders([]);
    }
  };

  // Fetch zones
  const fetchZones = async () => {
    try {
      const response = await ZoneService.getAllZones();
      const data = response.data;
      if (data.success) {
        setZones(data.data || data.zones || []);
      } else {
        showToast(data.message || 'Failed to fetch zones', 'error');
      }
    } catch (error) {
      showToast('Failed to fetch zones', 'error');
    }
  };

  // Create commission rule
  const createCommissionRule = async () => {
    if (!ruleForm.name || !ruleForm.value || ruleForm.value < 0) {
      showToast('Please fill all required fields with valid values', 'error');
      return;
    }

    if (ruleForm.type === 'percentage' && ruleForm.value > 100) {
      showToast('Percentage commission cannot exceed 100%', 'error');
      return;
    }

    if (ruleForm.applyTo === 'performanceScore' && !ruleForm.performanceScore) {
      showToast('Performance tier is required when applyTo is performanceScore', 'error');
      return;
    }

    if (ruleForm.applyTo === 'specificProvider' && !ruleForm.specificProvider) {
      showToast('Provider ID (PROV-XXXXXX) is required when applyTo is specificProvider', 'error');
      return;
    }

    if (ruleForm.effectiveUntil && new Date(ruleForm.effectiveUntil) <= new Date(ruleForm.effectiveFrom)) {
      showToast('Effective until date must be after effective from date', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: ruleForm.name,
        description: ruleForm.description,
        type: ruleForm.type,
        value: ruleForm.value,
        applyTo: ruleForm.applyTo,
        zoneId: ruleForm.zoneId,
        ...(ruleForm.applyTo === 'performanceScore' && { performanceScore: ruleForm.performanceScore }),
        ...(ruleForm.applyTo === 'specificProvider' && { specificProvider: ruleForm.specificProvider }),
        effectiveFrom: ruleForm.effectiveFrom,
        ...(ruleForm.effectiveUntil && { effectiveUntil: ruleForm.effectiveUntil })
      };

      const response = await CommissionService.createCommissionRule(payload);
      const data = response.data;
      if (data.success) {
        showToast('Rule created successfully');
        setShowRuleModal(false);
        resetRuleForm();
        fetchCommissionRules(pagination.page, pagination.limit);
      } else {
        showToast(data.message || 'Failed to create rule', 'error');
      }
    } catch (error) {
      showToast('Failed to create rule', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Update commission rule
  const updateCommissionRule = async () => {
    if (!ruleForm.name || !ruleForm.value || ruleForm.value < 0) {
      showToast('Please fill all required fields with valid values', 'error');
      return;
    }

    if (ruleForm.type === 'percentage' && ruleForm.value > 100) {
      showToast('Percentage commission cannot exceed 100%', 'error');
      return;
    }

    if (ruleForm.applyTo === 'performanceScore' && !ruleForm.performanceScore) {
      showToast('Performance tier is required when applyTo is performanceScore', 'error');
      return;
    }

    if (ruleForm.applyTo === 'specificProvider' && !ruleForm.specificProvider) {
      showToast('Provider ID (PROV-XXXXXX) is required when applyTo is specificProvider', 'error');
      return;
    }

    if (ruleForm.effectiveUntil && new Date(ruleForm.effectiveUntil) <= new Date(ruleForm.effectiveFrom)) {
      showToast('Effective until date must be after effective from date', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: ruleForm.name,
        description: ruleForm.description,
        type: ruleForm.type,
        value: ruleForm.value,
        applyTo: ruleForm.applyTo,
        zoneId: ruleForm.zoneId,
        ...(ruleForm.applyTo === 'performanceScore' && { performanceScore: ruleForm.performanceScore }),
        ...(ruleForm.applyTo === 'specificProvider' && { specificProvider: ruleForm.specificProvider }),
        effectiveFrom: ruleForm.effectiveFrom,
        ...(ruleForm.effectiveUntil && { effectiveUntil: ruleForm.effectiveUntil })
      };

      const response = await CommissionService.updateCommissionRule(editingRule._id, payload);
      const data = response.data;
      if (data.success) {
        showToast('Rule updated successfully');
        setShowRuleModal(false);
        setEditingRule(null);
        resetRuleForm();
        fetchCommissionRules(pagination.page, pagination.limit);
      } else {
        showToast(data.message || 'Failed to update rule', 'error');
      }
    } catch (error) {
      showToast('Failed to update rule', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Toggle rule status
  const toggleRuleStatus = async (ruleId) => {
    try {
      const response = await CommissionService.toggleCommissionRuleStatus(ruleId);
      const data = response.data;
      if (data.success) {
        showToast(data.message || 'Rule status updated');
        fetchCommissionRules(pagination.page, pagination.limit);
      } else {
        showToast(data.message || 'Failed to toggle rule status', 'error');
      }
    } catch (error) {
      showToast('Failed to toggle rule status', 'error');
    }
  };

  // Delete commission rule
  const deleteCommissionRule = async (ruleId) => {
    const isConfirmed = await confirm({
      title: 'Delete Commission Rule',
      message: 'Are you sure you want to delete this commission rule? This action cannot be undone.',
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!isConfirmed) return;

    try {
      const response = await CommissionService.deleteCommissionRule(ruleId);
      const data = response.data;
      if (data.success) {
        showToast('Commission rule deleted successfully');
        fetchCommissionRules(pagination.page, pagination.limit);
      } else {
        showToast(data.message || 'Failed to delete rule', 'error');
      }
    } catch (error) {
      showToast('Failed to delete commission rule', 'error');
    }
  };

  // Reset form
  const resetRuleForm = () => {
    setRuleForm({
      name: '',
      description: '',
      type: 'percentage',
      value: 10,
      applyTo: 'all',
      performanceScore: '',
      specificProvider: '',
      zoneId: '',
      zoneIds: [],
      effectiveFrom: new Date(),
      effectiveUntil: ''
    });
  };

  // Open edit modal
  const openEditModal = (rule) => {
    setEditingRule(rule);
    const initialZones = rule.zoneIds || (rule.zoneId ? [rule.zoneId] : []);
    setRuleForm({
      name: rule.name || '',
      description: rule.description || '',
      type: rule.type || 'percentage',
      value: rule.value || 10,
      applyTo: rule.applyTo || 'all',
      performanceScore: rule.performanceScore || '',
      specificProvider: rule.specificProvider?.providerId || rule.specificProvider?._id || '',
      zoneId: rule.zoneId || '',
      zoneIds: initialZones,
      effectiveFrom: rule.effectiveFrom ? new Date(rule.effectiveFrom) : new Date(),
      effectiveUntil: rule.effectiveUntil ? new Date(rule.effectiveUntil) : ''
    });
    setShowRuleModal(true);
  };

  // View rule details
  const viewRuleDetails = (rule) => {
    fetchCommissionRuleById(rule._id);
  };

  // Filter rules
  const filteredRules = useMemo(() => {
    return commissionRules.filter(rule => {
      const matchesSearch = rule.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        rule.description?.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesActive = filters.isActive === '' || rule.isActive.toString() === filters.isActive;
      const matchesApplyTo = filters.applyTo === '' || rule.applyTo === filters.applyTo;

      let matchesPriority = true;
      if (filters.priorityTier === 'global') {
        matchesPriority = !rule.zoneId;
      } else if (filters.priorityTier === 'zone') {
        matchesPriority = !!rule.zoneId;
      } else if (filters.priorityTier === 'performance') {
        matchesPriority = rule.applyTo === 'performanceScore';
      } else if (filters.priorityTier === 'provider') {
        matchesPriority = rule.applyTo === 'specificProvider';
      }

      let matchesZones = true;
      if (zoneIds && zoneIds.length > 0) {
        matchesZones = rule.zoneId && zoneIds.includes(rule.zoneId);
      }

      let matchesPerformance = true;
      if (filters.performanceScore) {
        matchesPerformance = rule.applyTo === 'performanceScore' && rule.performanceScore === filters.performanceScore;
      }

      return matchesSearch && matchesActive && matchesApplyTo && matchesPriority && matchesZones && matchesPerformance;
    });
  }, [commissionRules, debouncedSearch, filters.isActive, filters.applyTo, filters.priorityTier, filters.performanceScore, zoneIds]);

  // Initial data fetch
  useEffect(() => {
    fetchCommissionRules();
    fetchProviders();
    fetchZones();

    const params = new URLSearchParams(window.location.search);
    const prefillZone = params.get('prefillZone');
    if (prefillZone) {
      setRuleForm(prev => ({
        ...prev,
        zoneId: prefillZone,
        zoneIds: [prefillZone]
      }));
      setShowRuleModal(true);
    }
  }, []);


  // Helper functions for targeted providers and zone paths
  const getZoneHierarchyPath = (zoneId) => {
    if (!zoneId) return 'Unknown Zone';
    let currentZone = zones.find(z => z._id.toString() === zoneId.toString());
    const path = [];
    while (currentZone) {
      path.unshift(currentZone.name);
      const parentId = currentZone.parentZone?._id || currentZone.parentZone;
      if (parentId) {
        currentZone = zones.find(z => z._id.toString() === parentId.toString());
      } else {
        currentZone = null;
      }
    }
    return path.join(' > ') || 'Unknown Zone';
  };

  const getDescendantZoneIds = (zoneId, allZones) => {
    if (!zoneId) return [];
    const descendants = [zoneId.toString()];
    let added = true;
    while (added) {
      added = false;
      for (const z of allZones) {
        const parentId = (z.parentZone?._id || z.parentZone || '').toString();
        if (parentId && descendants.includes(parentId) && !descendants.includes(z._id.toString())) {
          descendants.push(z._id.toString());
          added = true;
        }
      }
    }
    return descendants;
  };

  const getTargetedProviders = (rule) => {
    if (!rule) return [];
    let list = [...providers];

    // 1. Filter by specific provider first (since it overrides everything)
    if (rule.applyTo === 'specificProvider') {
      const targetId = (rule.specificProvider?._id || rule.specificProvider || '').toString();
      return list.filter(p => p._id.toString() === targetId || p.providerId === targetId);
    }

    // 2. Filter by Zone (if defined, otherwise global and applies to all zones)
    if (rule.zoneId) {
      const allowedZoneIds = getDescendantZoneIds(rule.zoneId, zones);
      list = list.filter(p => {
        const pZoneId = (p.currentZone?._id || p.currentZone || p.zoneId || '').toString();
        return pZoneId && allowedZoneIds.includes(pZoneId);
      });
    }

    // 3. Filter by Performance Score
    if (rule.applyTo === 'performanceScore') {
      list = list.filter(p => {
        const badge = p.performanceBadge || p.performanceScore?.badge || 'Bronze';
        return badge === rule.performanceScore;
      });
    }

    return list;
  };

  // Refetch when filters change
  useEffect(() => {
    fetchCommissionRules(1, pagination.limit);
  }, [filters.isActive, filters.applyTo, filters.priorityTier, filters.performanceScore, filterType, year, financialYear, month, quarter, zoneIds]);

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-secondary">Commission Management</h1>
              <p className="text-gray-600">Manage commission rules and provider earnings</p>
            </div>
            <button
              onClick={() => {
                resetRuleForm();
                setEditingRule(null);
                setShowRuleModal(true);
              }}
              className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-700 transition-colors shadow-md hover:shadow-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Commission Rule
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
            <StatsCard
              title="Active Rules"
              value={stats.activeRules}
              icon={CheckCircle}
              iconBg="bg-green-100"
              iconColor="text-green-600"
            />
            <StatsCard
              title="Total Providers"
              value={stats.totalProviders}
              icon={Users}
              iconBg="bg-blue-100"
              iconColor="text-blue-600"
            />
            <StatsCard
              title="Avg Commission Rate"
              value={`${stats.avgCommissionRate}%`}
              icon={Percent}
              iconBg="bg-amber-100"
              iconColor="text-amber-600"
            />
          </div>
        </div>

        {/* Reusable Premium Filter Bar */}
        <AdminFilterBar onApply={() => fetchCommissionRules(1, pagination.limit)} />

        {/* Content */}
        <div className="space-y-6">
          {/* Local Filters */}
          <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">Search</label>
                <AdminSearchBar
                  placeholder="Search rules..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  onClear={() => setFilters({ ...filters, search: '' })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-2">Status</label>
                <select
                  value={filters.isActive}
                  onChange={(e) => setFilters({ ...filters, isActive: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                >
                  <option value="">All Statuses</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-2">Rule Priority Category</label>
                <select
                  value={filters.priorityTier}
                  onChange={(e) => setFilters({ ...filters, priorityTier: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                >
                  <option value="">All Categories</option>
                  <option value="global">Global</option>
                  <option value="zone">Zone Based</option>
                  <option value="performance">Provider Performance</option>
                  <option value="provider">Specific Provider</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-2">Provider Performance</label>
                <select
                  value={filters.performanceScore}
                  onChange={(e) => setFilters({ ...filters, performanceScore: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                >
                  <option value="">All Tiers</option>
                  <option value="Bronze">Bronze</option>
                  <option value="Silver">Silver</option>
                  <option value="Gold">Gold</option>
                  <option value="Platinum">Platinum</option>
                </select>
              </div>
            </div>

          </div>

          {/* Rules Table */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h3 className="text-lg font-medium text-secondary">Commission Rules</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                      Rule Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                      Zone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                      Commission
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                      Apply To
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-4">
                        <div className="space-y-4 p-4 animate-pulse">
                          {[1, 2, 3].map(i => (
                            <div key={i} className="h-10 bg-slate-100 rounded-xl w-full" />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ) : filteredRules.length > 0 ? (
                    filteredRules.map((rule) => (
                      <tr key={rule._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-secondary">{rule.name}</div>
                          {rule.description && (
                            <div className="text-sm text-gray-500 truncate max-w-xs">{rule.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            const zone = zones.find(z => z._id === rule.zoneId);
                            return zone ? `${zone.name} (${zone.level})` : 'Global';
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-secondary">
                            {rule.type === 'percentage' ? `${rule.value}%` : formatCurrency(rule.value)}
                          </div>
                          <div className="text-xs text-gray-500 capitalize">{rule.type}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                            {rule.applyTo === 'all' && 'All Providers'}
                            {rule.applyTo === 'performanceScore' && 'Performance Score'}
                            {rule.applyTo === 'specificProvider' && 'Specific Provider'}
                          </span>
                          {rule.performanceScore && rule.applyTo === 'performanceScore' && (
                            <div className="text-xs text-gray-500 mt-1 capitalize">
                              {rule.performanceScore} Score
                            </div>
                          )}
                          {rule.specificProvider && rule.applyTo === 'specificProvider' && (
                            <div className="text-xs text-gray-500 mt-1">
                              {rule.specificProvider.name} [{rule.specificProvider.providerId || 'N/A'}]
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            rule.isActive
                              ? 'bg-green-50 text-green-800 border-green-200'
                              : 'bg-red-50 text-red-800 border-red-200'
                          }`}>{rule.isActive ? 'Active' : 'Inactive'}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(rule.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => viewRuleDetails(rule)}
                              className="text-primary hover:text-teal-700 transition-colors"
                              title="View Details"
                            >
                              <Info className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEditModal(rule)}
                              className="text-primary hover:text-teal-700 transition-colors"
                              title="Edit Rule"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => toggleRuleStatus(rule._id)}
                              className={rule.isActive ? "text-red-600 hover:text-red-800 transition-colors" : "text-green-600 hover:text-green-800 transition-colors"}
                              title={rule.isActive ? 'Deactivate Rule' : 'Activate Rule'}
                            >
                              {rule.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => deleteCommissionRule(rule._id)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                              title="Delete Rule"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center">
                        <div className="flex flex-col items-center">
                          <Settings className="w-12 h-12 text-gray-400 mb-4" />
                          <h3 className="text-lg font-medium text-secondary mb-2">No Commission Rules Found</h3>
                          <p className="text-sm text-gray-500 mb-4">Get started by creating your first commission rule.</p>
                          <button
                            onClick={() => {
                              resetRuleForm();
                              setEditingRule(null);
                              setShowRuleModal(true);
                            }}
                            className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-700 transition-colors shadow-md hover:shadow-lg"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Create First Rule
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.pages}
              totalItems={pagination.total}
              limit={pagination.limit}
              onPageChange={(page) => fetchCommissionRules(page, pagination.limit)}
            />
          </div>
        </div>

        {/* Commission Rule Modal */}
        {showRuleModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center py-8 px-4 sm:px-6">
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl h-fit">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
                <h3 className="text-lg leading-6 font-bold text-secondary flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  {editingRule ? 'Edit Commission Rule' : 'Add Commission Rule'}
                </h3>
                <button
                  onClick={() => {
                    setShowRuleModal(false);
                    setEditingRule(null);
                    resetRuleForm();
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-650 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Section 1: Rule Configuration */}
                <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-1.5 pb-2 border-b border-slate-100/50">
                    📝 Rule Configuration
                  </h4>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Rule Name *
                    </label>
                    <input
                      type="text"
                      value={ruleForm.name}
                      onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold"
                      placeholder="e.g., Standard City Commission"
                      maxLength={100}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Description
                    </label>
                    <textarea
                      value={ruleForm.description}
                      onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold"
                      rows="2.5"
                      placeholder="Describe what this rule applies to..."
                      maxLength={500}
                    />
                  </div>
                </div>

                {/* Section 2: Payout & Coverage */}
                <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-1.5 pb-2 border-b border-slate-100/50">
                    💰 Payout & Coverage
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Commission Type *
                      </label>
                      <select
                        value={ruleForm.type}
                        onChange={(e) => setRuleForm({ ...ruleForm, type: e.target.value })}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold cursor-pointer"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed Amount (₹)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Value * {ruleForm.type === 'percentage' ? '(%)' : '(₹)'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step={ruleForm.type === 'percentage' ? '0.1' : '1'}
                        value={ruleForm.value}
                        onChange={(e) => setRuleForm({ ...ruleForm, value: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold"
                        placeholder={ruleForm.type === 'percentage' ? '10.5' : '1000'}
                      />
                    </div>
                  </div>

                  <div className="pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <HierarchicalZoneSelector
                      zones={zones}
                      selectedZoneIds={ruleForm.zoneIds}
                      onChange={(newZoneIds) => {
                        if (Array.isArray(newZoneIds)) {
                          setRuleForm(prev => ({ ...prev, zoneIds: newZoneIds }));
                        } else if (newZoneIds && (newZoneIds._id || newZoneIds.id)) {
                          const targetId = (newZoneIds._id || newZoneIds.id).toString();
                          setRuleForm(prev => ({ ...prev, zoneIds: (prev.zoneIds || []).filter(id => id.toString() !== targetId) }));
                        }
                      }}
                      label="Applicable Zones (Hierarchical Selector)"
                    />
                  </div>
                </div>

                {/* Section 3: Target Providers & Timeline */}
                <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-1.5 pb-2 border-b border-slate-100/50">
                    🎯 Target Providers & Timeline
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Apply To *
                      </label>
                      <select
                        value={ruleForm.applyTo}
                        onChange={(e) => setRuleForm({ ...ruleForm, applyTo: e.target.value, performanceScore: '', specificProvider: '' })}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold cursor-pointer"
                      >
                        <option value="all">All Providers</option>
                        <option value="performanceScore">Performance Score</option>
                        <option value="specificProvider">Specific Provider</option>
                      </select>
                    </div>

                    {ruleForm.applyTo === 'performanceScore' && (
                      <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                          Performance Score *
                        </label>
                        <select
                          value={ruleForm.performanceScore}
                          onChange={(e) => setRuleForm({ ...ruleForm, performanceScore: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold cursor-pointer"
                        >
                          <option value="">Select tier</option>
                          {performanceScores.map(tier => (
                            <option key={tier} value={tier}>
                              {tier.charAt(0).toUpperCase() + tier.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {ruleForm.applyTo === 'specificProvider' && (
                      <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                          Provider ID *
                        </label>
                        <input
                          type="text"
                          value={ruleForm.specificProvider}
                          onChange={(e) => setRuleForm({ ...ruleForm, specificProvider: e.target.value.toUpperCase() })}
                          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold"
                          placeholder="e.g., PROV-XXXXXXXX"
                        />
                      </div>
                    )}
                  </div>

                  {ruleForm.applyTo === 'specificProvider' && ruleForm.specificProvider && providers.find(p => p.providerId === ruleForm.specificProvider) && (
                    <div className="p-3.5 bg-teal-50 border border-teal-150 rounded-xl animate-in fade-in duration-200">
                      {(() => {
                        const provider = providers.find(p => p.providerId === ruleForm.specificProvider);
                        const badgeColor = {
                          'Platinum': 'text-purple-650 font-black',
                          'Gold': 'text-amber-550 font-black',
                          'Silver': 'text-slate-500 font-black',
                          'Bronze': 'text-orange-750 font-black'
                        }[provider.performanceBadge] || 'text-secondary';

                        return (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center pb-1.5 border-b border-teal-100/50">
                              <span className="text-[9px] font-black text-teal-800 uppercase tracking-widest">Matched Specialist</span>
                              <span className={`text-xs ${badgeColor}`}>{provider.name} ({provider.performanceBadge})</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { label: 'Rating', value: `${(provider.averageRating || 0).toFixed(1)}★` },
                                { label: 'Completion', value: `${provider.completionRate || 0}%` },
                                { label: 'On-Time', value: `${provider.onTimeRate || 0}%` },
                              ].map((stat) => (
                                <div key={stat.label} className="bg-white/80 p-1.5 rounded-lg border border-teal-100/50 text-center shadow-xs">
                                  <p className="text-[8px] text-gray-400 font-bold uppercase tracking-wider leading-none mb-1">{stat.label}</p>
                                  <p className="text-xs font-extrabold text-teal-950">{stat.value}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Badge Criteria Summary */}
                  <div className="bg-slate-100/80 rounded-xl border border-slate-200/60 overflow-hidden">
                    <div className="bg-slate-200/50 px-3 py-2 border-b border-slate-200/80 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-[9px] font-black text-slate-650 uppercase tracking-widest">Badge Tier Performance Thresholds</span>
                    </div>
                    <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { name: 'Platinum', criteria: '4.5★ | 95%', color: 'bg-indigo-50 text-indigo-700 border border-indigo-200/60' },
                        { name: 'Gold', criteria: '4.0★ | 90%', color: 'bg-amber-50 text-amber-700 border border-amber-200/60' },
                        { name: 'Silver', criteria: '3.5★ | 85%', color: 'bg-slate-100 text-slate-700 border border-slate-250/50' },
                        { name: 'Bronze', criteria: '< 3.5★ | < 85%', color: 'bg-orange-50 text-orange-700 border border-orange-200/60' }
                      ].map((badge) => (
                        <div key={badge.name} className="flex flex-col items-center justify-center p-2 bg-white rounded-lg border border-slate-150 shadow-xs">
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider mb-1 ${badge.color}`}>{badge.name}</span>
                          <span className="text-[9px] text-slate-550 font-black tracking-wide">{badge.criteria}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Effective From
                      </label>
                      <input
                        type="date"
                        value={ruleForm.effectiveFrom ? new Date(ruleForm.effectiveFrom).toISOString().split('T')[0] : ''}
                        onChange={(e) => setRuleForm({ ...ruleForm, effectiveFrom: new Date(e.target.value) })}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Effective Until (Optional)
                      </label>
                      <input
                        type="date"
                        value={ruleForm.effectiveUntil ? new Date(ruleForm.effectiveUntil).toISOString().split('T')[0] : ''}
                        onChange={(e) => setRuleForm({ ...ruleForm, effectiveUntil: e.target.value ? new Date(e.target.value) : '' })}
                        min={ruleForm.effectiveFrom ? new Date(ruleForm.effectiveFrom).toISOString().split('T')[0] : ''}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-slate-100">
                <button
                  onClick={() => {
                    setShowRuleModal(false);
                    setEditingRule(null);
                    resetRuleForm();
                  }}
                  className="px-5 py-2.5 text-sm font-bold text-slate-650 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={editingRule ? updateCommissionRule : createCommissionRule}
                  disabled={loading}
                  className="px-5 py-2.5 bg-primary hover:bg-teal-800 text-white text-sm font-bold rounded-xl transition-colors shadow-md hover:shadow-lg disabled:opacity-50"
                >
                  {loading ? 'Saving...' : (editingRule ? 'Update Rule' : 'Create Rule')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Commission Rule Details Modal */}
        {showRuleDetailsModal && viewingRule && (
          <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center py-8 px-4 sm:px-6">
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl h-fit">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
                <h3 className="text-lg leading-6 font-bold text-secondary flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  Commission Rule Details
                </h3>
                <button
                  onClick={() => {
                    setShowRuleDetailsModal(false);
                    setViewingRule(null);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-650 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Visual Card (The "Commission Ticket") */}
                <div className="relative bg-slate-50/50 border border-primary/20 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm overflow-hidden">
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full border-r border-dashed border-primary/30" />
                  <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full border-l border-dashed border-primary/30" />
                  
                  <div className="flex flex-col items-center sm:items-start text-center sm:text-left pl-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20 mb-2.5">
                      {viewingRule.isActive ? 'Active Commission Rule' : 'Inactive Commission Rule'}
                    </span>
                    <h3 className="text-2xl font-black text-secondary tracking-wide">
                      {viewingRule.name}
                    </h3>
                  </div>
                  <div className="flex flex-col items-center sm:items-end text-center sm:text-right pr-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Commission Value</span>
                    <div className="text-3xl font-black text-primary">
                      {viewingRule.type === 'percentage'
                        ? `${viewingRule.value}%`
                        : `₹${viewingRule.value.toFixed(2)}`
                      }
                    </div>
                  </div>
                </div>

                {/* Key Indicators Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 shadow-xs">
                  <div className="text-center p-2 border-r border-slate-200/60">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center justify-center gap-1.5">
                      Status
                    </p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black ${viewingRule.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                      }`}>
                      {viewingRule.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="text-center p-2 sm:border-r border-slate-200/60">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center justify-center gap-1.5">
                      Created By
                    </p>
                    <p className="text-sm font-extrabold text-slate-755 truncate">
                      {viewingRule.createdBy?.name || 'Admin'}
                    </p>
                  </div>

                  <div className="text-center p-2 border-r border-slate-200/60">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center justify-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Start
                    </p>
                    <p className="text-xs font-extrabold text-slate-750">
                      {viewingRule.effectiveFrom ? formatDate(viewingRule.effectiveFrom) : 'Immediate'}
                    </p>
                  </div>

                  <div className="text-center p-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center justify-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Expiration
                    </p>
                    <p className="text-xs font-extrabold text-slate-750 truncate">
                      {viewingRule.effectiveUntil ? formatDate(viewingRule.effectiveUntil) : 'No expiration'}
                    </p>
                  </div>
                </div>

                {viewingRule.description && (
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rule Description</p>
                    <p className="text-sm text-slate-600 font-semibold">{viewingRule.description}</p>
                  </div>
                )}

                {/* Targeting & Geographic Scope */}
                <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-1.5 pb-2 border-b border-slate-100/50">
                    <Globe className="w-4 h-4 text-primary" /> Scope & Application Impact
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Geographic Zone Info */}
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/50 flex flex-col justify-center shadow-xs">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Geographic Zone Constraints</p>
                      <p className="text-xs font-extrabold text-slate-750 flex items-center gap-1 uppercase tracking-wider">
                        {viewingRule.zoneId ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-teal-50 text-teal-800 border border-teal-200/60 shadow-xs">
                            📍 {getZoneHierarchyPath(viewingRule.zoneId)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-blue-50 text-blue-800 border border-blue-200/60 shadow-xs">
                            🌍 Globally Applicable
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Target Provider Group */}
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/50 flex flex-col justify-center shadow-xs">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Targeting Criteria</p>
                      <div className="flex flex-wrap gap-1">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-teal-50 text-teal-800 border border-teal-200/60 shadow-xs">
                          {viewingRule.applyTo === 'all' && 'All Providers'}
                          {viewingRule.applyTo === 'performanceScore' && 'Performance Tier'}
                          {viewingRule.applyTo === 'specificProvider' && 'Specific Provider'}
                        </span>
                        {viewingRule.performanceScore && (
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border shadow-xs ${
                            viewingRule.performanceScore === 'Platinum' ? 'bg-indigo-50 text-indigo-700 border-indigo-200/60' :
                            viewingRule.performanceScore === 'Gold' ? 'bg-amber-50 text-amber-700 border-amber-200/60' :
                            viewingRule.performanceScore === 'Silver' ? 'bg-slate-100 text-slate-700 border-slate-250/50' :
                            'bg-orange-50 text-orange-700 border-orange-200/60'
                          }`}>
                            🏆 {viewingRule.performanceScore} Tier
                          </span>
                        )}
                        {viewingRule.specificProvider && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-purple-50 text-purple-800 border border-purple-200/60 shadow-xs">
                            👤 {viewingRule.specificProvider.name || viewingRule.specificProvider}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Impact Analysis: Matching Providers Count */}
                  <div className="pt-2">
                    {(() => {
                      const matchedProvs = getTargetedProviders(viewingRule);
                      return (
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest">Active Scope Impact</span>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-teal-100 text-teal-900 border border-teal-200/70 shadow-xs">
                              ⚡ Applies to {matchedProvs.length} {matchedProvs.length === 1 ? 'Provider' : 'Providers'}
                            </span>
                          </div>

                          {matchedProvs.length > 0 ? (
                            <div className="bg-white/80 p-3.5 rounded-xl border border-slate-200/60 shadow-xs">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                <Users className="w-3.5 h-3.5 text-slate-500" /> Matched Specialist List
                              </p>
                              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                                {matchedProvs.map(prov => {
                                  const badgeColor = {
                                    'Platinum': 'bg-indigo-50 text-indigo-700 border-indigo-200/65',
                                    'Gold': 'bg-amber-50 text-amber-700 border-amber-200/65',
                                    'Silver': 'bg-slate-100 text-slate-700 border-slate-200/70',
                                    'Bronze': 'bg-orange-50 text-orange-700 border-orange-200/65'
                                  }[prov.performanceBadge] || 'bg-slate-50 text-slate-650 border-slate-150';

                                  return (
                                    <span key={prov._id} className="inline-flex items-center px-2 py-0.8 rounded-full text-[10px] font-bold bg-white text-slate-700 border border-slate-200 hover:border-slate-350 hover:bg-slate-50/50 shadow-xs transition-colors duration-150">
                                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mr-1.5 animate-pulse" />
                                      {prov.name} ({prov.providerId || 'N/A'})
                                      <span className={`ml-2 px-1.5 py-0.2 rounded-full text-[8px] font-black uppercase border ${badgeColor}`}>
                                        {prov.performanceBadge || 'Bronze'}
                                      </span>
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="bg-amber-50/65 p-3.5 rounded-xl border border-amber-150 text-center">
                              <p className="text-xs font-semibold text-amber-800">
                                ⚠️ No active providers currently match this commission rule's targeting parameters.
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 italic">
                  <span>Created: {viewingRule.createdAt ? formatDateTime(viewingRule.createdAt) : 'N/A'}</span>
                  <span>Updated: {viewingRule.updatedAt ? formatDateTime(viewingRule.updatedAt) : 'N/A'}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
                <button
                  onClick={() => {
                    setShowRuleDetailsModal(false);
                    setViewingRule(null);
                  }}
                  className="px-5 py-2.5 text-sm font-bold text-slate-650 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors shadow-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCommissionPage;