import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth';
import {
  DollarSign,
  Users,
  Settings,
  Plus,
  Search,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Percent,
  Info
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/format';
import * as CommissionService from '../../services/CommissionService';
import * as AdminService from '../../services/AdminService';
import * as ZoneService from '../../services/ZoneService';
import Pagination from '../../components/Pagination';

const AdminCommissionPage = () => {
  const { API, token, showToast } = useAuth();
  const [loading, setLoading] = useState(false);

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
    performanceScore: '',
    zoneIds: []
  });

  // Filter Cascade selector state variables
  const [filterStateSearch, setFilterStateSearch] = useState('');
  const [filterStateOpen, setFilterStateOpen] = useState(false);
  const [filterCitySearch, setFilterCitySearch] = useState('');
  const [filterCityOpen, setFilterCityOpen] = useState(false);
  const [filterMicroSearch, setFilterMicroSearch] = useState('');
  const [filterMicroOpen, setFilterMicroOpen] = useState(false);

  const handleFilterZoneToggleCascade = (zone) => {
    const currentSelected = filters.zoneIds || [];
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

    setFilters(prev => ({
      ...prev,
      zoneIds: newZones
    }));
  };

  // Available options matching backend enum
  const performanceScores = ['Bronze', 'Silver', 'Gold', 'Platinum'];
  const applyToOptions = ['all', 'performanceScore', 'specificProvider'];

  // Fetch commission rules
  const fetchCommissionRules = async (page = 1, limit = 10) => {
    setLoading(true);
    try {
      const params = {
        page: page,
        limit: limit,
        ...(filters.isActive && { isActive: filters.isActive }),
        ...(filters.applyTo && { applyTo: filters.applyTo }),
        ...(filters.priorityTier && { priorityTier: filters.priorityTier }),
        ...(filters.performanceScore && { performanceScore: filters.performanceScore }),
        ...(filters.zoneIds && filters.zoneIds.length > 0 && { zoneIds: filters.zoneIds.join(',') })
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
  };

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
    if (!window.confirm('Are you sure you want to delete this commission rule?')) return;

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
  const filteredRules = commissionRules.filter(rule => {
    const matchesSearch = rule.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      rule.description?.toLowerCase().includes(filters.search.toLowerCase());
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
    if (filters.zoneIds && filters.zoneIds.length > 0) {
      matchesZones = rule.zoneId && filters.zoneIds.includes(rule.zoneId);
    }

    let matchesPerformance = true;
    if (filters.performanceScore) {
      matchesPerformance = rule.applyTo === 'performanceScore' && rule.performanceScore === filters.performanceScore;
    }

    return matchesSearch && matchesActive && matchesApplyTo && matchesPriority && matchesZones && matchesPerformance;
  });

  // Initial data fetch
  useEffect(() => {
    fetchCommissionRules();
    fetchProviders();
    fetchZones();
  }, []);

  // Refetch when filters change
  useEffect(() => {
    fetchCommissionRules(1, pagination.limit);
  }, [filters.isActive, filters.applyTo, filters.priorityTier, filters.performanceScore, filters.zoneIds]);

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
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center">
                <div className="p-2 rounded-full bg-green-100">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Active Rules</p>
                  <p className="text-lg font-bold text-secondary">{stats.activeRules}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center">
                <div className="p-2 rounded-full bg-blue-100">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Total Providers</p>
                  <p className="text-lg font-bold text-secondary">{stats.totalProviders}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center">
                <div className="p-2 rounded-full bg-amber-100">
                  <Percent className="w-5 h-5 text-amber-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Avg Commission Rate</p>
                  <p className="text-lg font-bold text-secondary">{stats.avgCommissionRate}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">Search</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search rules..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                  />
                </div>
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

            {/* Hierarchical Zone Selector Filter */}
            <div className="border-t border-gray-100 pt-4">
              <label className="block text-sm font-medium text-secondary mb-2">Filter by Zone (Cascading Dropdown)</label>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. STATE DROPDOWN FOR FILTER */}
                <div className="relative">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">State Selector</label>
                  <div
                    onClick={() => {
                      setFilterStateOpen(!filterStateOpen);
                      setFilterCityOpen(false);
                      setFilterMicroOpen(false);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer flex justify-between items-center text-sm"
                  >
                    <span className="text-gray-700 truncate">
                      {(() => {
                        const sel = (filters.zoneIds || []).filter(id => zones.find(z => z._id === id)?.zoneLevel === 'state');
                        return sel.length === 0 ? 'Select States' : `${sel.length} Selected`;
                      })()}
                    </span>
                    {filterStateOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </div>
                  {filterStateOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto p-2">
                      <input
                        type="text"
                        placeholder="Search state..."
                        value={filterStateSearch}
                        onChange={(e) => setFilterStateSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded mb-2 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <div className="space-y-1">
                        {zones.filter(z => z.zoneLevel === 'state' && z.name.toLowerCase().includes(filterStateSearch.toLowerCase())).map(s => (
                          <label key={s._id} className="flex items-center text-xs font-semibold text-secondary hover:text-primary cursor-pointer py-1 px-1 rounded hover:bg-gray-50" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={filters.zoneIds ? filters.zoneIds.includes(s._id) : false}
                              onChange={() => handleFilterZoneToggleCascade(s)}
                              className="h-3.5 w-3.5 text-primary border-gray-300 rounded mr-2"
                            />
                            {s.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. CITY DROPDOWN FOR FILTER */}
                <div className="relative">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">City Selector</label>
                  <div
                    onClick={() => {
                      setFilterCityOpen(!filterCityOpen);
                      setFilterStateOpen(false);
                      setFilterMicroOpen(false);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer flex justify-between items-center text-sm"
                  >
                    <span className="text-gray-700 truncate">
                      {(() => {
                        const sel = (filters.zoneIds || []).filter(id => zones.find(z => z._id === id)?.zoneLevel === 'city');
                        return sel.length === 0 ? 'Select Cities' : `${sel.length} Selected`;
                      })()}
                    </span>
                    {filterCityOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </div>
                  {filterCityOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto p-2">
                      <input
                        type="text"
                        placeholder="Search city..."
                        value={filterCitySearch}
                        onChange={(e) => setFilterCitySearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded mb-2 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <div className="space-y-1">
                        {(() => {
                          const selectedStateIds = (filters.zoneIds || []).filter(id => zones.find(z => z._id === id)?.zoneLevel === 'state');
                          const cities = selectedStateIds.length > 0
                            ? zones.filter(z => z.zoneLevel === 'city' && selectedStateIds.includes((z.parentZone?._id || z.parentZone || '').toString()))
                            : zones.filter(z => z.zoneLevel === 'city');

                          const filteredCities = cities.filter(c => c.name.toLowerCase().includes(filterCitySearch.toLowerCase()));
                          if (filteredCities.length === 0) {
                            return <p className="text-[10px] text-gray-400 italic text-center py-2">No cities available.</p>;
                          }

                          return filteredCities.map(c => (
                            <label key={c._id} className="flex items-center text-xs font-semibold text-secondary hover:text-primary cursor-pointer py-1 px-1 rounded hover:bg-gray-50" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={filters.zoneIds ? filters.zoneIds.includes(c._id) : false}
                                onChange={() => handleFilterZoneToggleCascade(c)}
                                className="h-3.5 w-3.5 text-primary border-gray-300 rounded mr-2"
                              />
                              {c.name}
                            </label>
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. MICRO ZONE DROPDOWN FOR FILTER */}
                <div className="relative">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Micro Zone Selector</label>
                  <div
                    onClick={() => {
                      setFilterMicroOpen(!filterMicroOpen);
                      setFilterStateOpen(false);
                      setFilterCityOpen(false);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer flex justify-between items-center text-sm"
                  >
                    <span className="text-gray-700 truncate">
                      {(() => {
                        const sel = (filters.zoneIds || []).filter(id => zones.find(z => z._id === id)?.zoneLevel === 'micro');
                        return sel.length === 0 ? 'Select Micro Zones' : `${sel.length} Selected`;
                      })()}
                    </span>
                    {filterMicroOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </div>
                  {filterMicroOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto p-2">
                      <input
                        type="text"
                        placeholder="Search micro zone..."
                        value={filterMicroSearch}
                        onChange={(e) => setFilterMicroSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded mb-2 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <div className="space-y-1">
                        {(() => {
                          const selectedCityIds = (filters.zoneIds || []).filter(id => zones.find(z => z._id === id)?.zoneLevel === 'city');
                          const micros = selectedCityIds.length > 0
                            ? zones.filter(z => z.zoneLevel === 'micro' && selectedCityIds.includes((z.parentZone?._id || z.parentZone || '').toString()))
                            : zones.filter(z => z.zoneLevel === 'micro');

                          const filteredMicros = micros.filter(m => m.name.toLowerCase().includes(filterMicroSearch.toLowerCase()));
                          if (filteredMicros.length === 0) {
                            return <p className="text-[10px] text-gray-400 italic text-center py-2">No micro zones available.</p>;
                          }

                          return filteredMicros.map(m => (
                            <label key={m._id} className="flex items-center text-xs font-medium text-gray-700 hover:text-primary cursor-pointer py-1 px-1 rounded hover:bg-gray-50" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={filters.zoneIds ? filters.zoneIds.includes(m._id) : false}
                                onChange={() => handleFilterZoneToggleCascade(m)}
                                className="h-3.5 w-3.5 text-primary border-gray-300 rounded mr-2"
                              />
                              {m.name}
                            </label>
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Filter Selected Zones Chips */}
              {filters.zoneIds && filters.zoneIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 max-h-24 overflow-y-auto bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                  <span className="text-xs text-gray-500 flex items-center mr-1">Active Zones:</span>
                  {filters.zoneIds.map(id => {
                    const zone = zones.find(z => z._id.toString() === id.toString());
                    if (!zone) return null;

                    let badgeColor = 'bg-teal-50 text-teal-800 border-teal-200';
                    if (zone.zoneLevel === 'city') badgeColor = 'bg-blue-50 text-blue-800 border-blue-200';
                    if (zone.zoneLevel === 'micro') badgeColor = 'bg-purple-50 text-purple-800 border-purple-200';

                    return (
                      <span key={id} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-xs ${badgeColor}`}>
                        <span>{zone.name} ({zone.zoneLevel.toUpperCase()})</span>
                        <button
                          type="button"
                          onClick={() => handleFilterZoneToggleCascade(zone)}
                          className="ml-1 inline-flex items-center justify-center focus:outline-none"
                        >
                          <X className="w-3 h-3 ml-0.5" />
                        </button>
                      </span>
                    );
                  })}
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, zoneIds: [] }))}
                    className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors ml-auto"
                  >
                    Clear All Zones
                  </button>
                </div>
              )}
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
                    Array.from({ length: 5 }).map((_, index) => (
                      <tr key={index} className="animate-pulse">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="h-4 bg-gray-200 rounded w-32"></div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="h-4 bg-gray-200 rounded w-20"></div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="h-4 bg-gray-200 rounded w-24"></div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="h-6 bg-gray-200 rounded-full w-16"></div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="h-4 bg-gray-200 rounded w-20"></div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex space-x-2">
                            <div className="h-8 w-8 bg-gray-200 rounded"></div>
                            <div className="h-8 w-8 bg-gray-200 rounded"></div>
                            <div className="h-8 w-8 bg-gray-200 rounded"></div>
                            <div className="h-8 w-8 bg-gray-200 rounded"></div>
                          </div>
                        </td>
                      </tr>
                    ))
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
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${rule.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                            }`}>
                            {rule.isActive ? 'Active' : 'Inactive'}
                          </span>
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
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-xl font-semibold text-secondary">
                  {editingRule ? 'Edit Commission Rule' : 'Add Commission Rule'}
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">Rule Name *</label>
                  <input
                    type="text"
                    value={ruleForm.name}
                    onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="Enter rule name"
                    maxLength={100}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">Description</label>
                  <textarea
                    value={ruleForm.description}
                    onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    rows="3"
                    placeholder="Enter description"
                    maxLength={500}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1">Commission Type *</label>
                    <select
                      value={ruleForm.type}
                      onChange={(e) => setRuleForm({ ...ruleForm, type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    >
                      <option value="percentage">Percentage</option>
                      <option value="fixed">Fixed Amount</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1">
                      Value * {ruleForm.type === 'percentage' ? '(%)' : '(₹)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step={ruleForm.type === 'percentage' ? '0.1' : '1'}
                      value={ruleForm.value}
                      onChange={(e) => setRuleForm({ ...ruleForm, value: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                      placeholder={ruleForm.type === 'percentage' ? '10.5' : '1000'}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">Applicable Zones (Cascading Selector)</label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* 1. STATE DROPDOWN */}
                    <div className="relative">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">State Selector</label>
                      <div
                        onClick={() => setStateOpen(!stateOpen)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer flex justify-between items-center text-sm"
                      >
                        <span className="text-gray-700 truncate">
                          {(() => {
                            const sel = (ruleForm.zoneIds || []).filter(id => zones.find(z => z._id === id)?.zoneLevel === 'state');
                            return sel.length === 0 ? 'Select States' : `${sel.length} Selected`;
                          })()}
                        </span>
                        {stateOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                      </div>
                      {stateOpen && (
                        <div className="mt-1 bg-gray-50 border border-gray-200 rounded-lg max-h-40 overflow-y-auto p-2">
                          <input
                            type="text"
                            placeholder="Search state..."
                            value={stateSearch}
                            onChange={(e) => setStateSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded mb-2 focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <div className="space-y-1">
                            {zones.filter(z => z.zoneLevel === 'state' && z.name.toLowerCase().includes(stateSearch.toLowerCase())).map(s => (
                              <label key={s._id} className="flex items-center text-xs font-semibold text-secondary hover:text-primary cursor-pointer py-1 px-1 rounded hover:bg-gray-50" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={ruleForm.zoneIds ? ruleForm.zoneIds.includes(s._id) : false}
                                  onChange={() => handleZoneToggleCascade(s)}
                                  className="h-3.5 w-3.5 text-primary border-gray-300 rounded mr-2"
                                />
                                {s.name}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 2. CITY DROPDOWN */}
                    <div className="relative">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">City Selector</label>
                      <div
                        onClick={() => setCityOpen(!cityOpen)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer flex justify-between items-center text-sm"
                      >
                        <span className="text-gray-700 truncate">
                          {(() => {
                            const sel = (ruleForm.zoneIds || []).filter(id => zones.find(z => z._id === id)?.zoneLevel === 'city');
                            return sel.length === 0 ? 'Select Cities' : `${sel.length} Selected`;
                          })()}
                        </span>
                        {cityOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                      </div>
                      {cityOpen && (
                        <div className="mt-1 bg-gray-50 border border-gray-200 rounded-lg max-h-40 overflow-y-auto p-2">
                          <input
                            type="text"
                            placeholder="Search city..."
                            value={citySearch}
                            onChange={(e) => setCitySearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded mb-2 focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <div className="space-y-1">
                            {(() => {
                              const selectedStateIds = (ruleForm.zoneIds || []).filter(id => zones.find(z => z._id === id)?.zoneLevel === 'state');
                              const cities = selectedStateIds.length > 0
                                ? zones.filter(z => z.zoneLevel === 'city' && selectedStateIds.includes((z.parentZone?._id || z.parentZone || '').toString()))
                                : zones.filter(z => z.zoneLevel === 'city');

                              const filteredCities = cities.filter(c => c.name.toLowerCase().includes(citySearch.toLowerCase()));
                              if (filteredCities.length === 0) {
                                return <p className="text-[10px] text-gray-400 italic text-center py-2">No cities available.</p>;
                              }

                              return filteredCities.map(c => (
                                <label key={c._id} className="flex items-center text-xs font-semibold text-secondary hover:text-primary cursor-pointer py-1 px-1 rounded hover:bg-gray-50" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={ruleForm.zoneIds ? ruleForm.zoneIds.includes(c._id) : false}
                                    onChange={() => handleZoneToggleCascade(c)}
                                    className="h-3.5 w-3.5 text-primary border-gray-300 rounded mr-2"
                                  />
                                  {c.name}
                                </label>
                              ));
                            })()}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 3. MICRO ZONE DROPDOWN */}
                    <div className="relative">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Micro Zone Selector</label>
                      <div
                        onClick={() => setMicroOpen(!microOpen)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer flex justify-between items-center text-sm"
                      >
                        <span className="text-gray-700 truncate">
                          {(() => {
                            const sel = (ruleForm.zoneIds || []).filter(id => zones.find(z => z._id === id)?.zoneLevel === 'micro');
                            return sel.length === 0 ? 'Select Micro Zones' : `${sel.length} Selected`;
                          })()}
                        </span>
                        {microOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                      </div>
                      {microOpen && (
                        <div className="mt-1 bg-gray-50 border border-gray-200 rounded-lg max-h-40 overflow-y-auto p-2">
                          <input
                            type="text"
                            placeholder="Search micro zone..."
                            value={microSearch}
                            onChange={(e) => setMicroSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded mb-2 focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <div className="space-y-1">
                            {(() => {
                              const selectedCityIds = (ruleForm.zoneIds || []).filter(id => zones.find(z => z._id === id)?.zoneLevel === 'city');
                              const micros = selectedCityIds.length > 0
                                ? zones.filter(z => z.zoneLevel === 'micro' && selectedCityIds.includes((z.parentZone?._id || z.parentZone || '').toString()))
                                : zones.filter(z => z.zoneLevel === 'micro');

                              const filteredMicros = micros.filter(m => m.name.toLowerCase().includes(microSearch.toLowerCase()));
                              if (filteredMicros.length === 0) {
                                return <p className="text-[10px] text-gray-400 italic text-center py-2">No micro zones available.</p>;
                              }

                              return filteredMicros.map(m => (
                                <label key={m._id} className="flex items-center text-xs font-medium text-gray-700 hover:text-primary cursor-pointer py-1 px-1 rounded hover:bg-gray-50" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={ruleForm.zoneIds ? ruleForm.zoneIds.includes(m._id) : false}
                                    onChange={() => handleZoneToggleCascade(m)}
                                    className="h-3.5 w-3.5 text-primary border-gray-300 rounded mr-2"
                                  />
                                  {m.name}
                                </label>
                              ));
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Selected Zones Displayed as Chips */}
                  <div className="flex flex-wrap gap-2 mt-3 max-h-24 overflow-y-auto">
                    {(ruleForm.zoneIds || []).map(id => {
                      const zone = zones.find(z => z._id.toString() === id.toString());
                      if (!zone) return null;

                      let badgeColor = 'bg-teal-50 text-teal-800 border-teal-200';
                      if (zone.zoneLevel === 'city') badgeColor = 'bg-blue-50 text-blue-800 border-blue-200';
                      if (zone.zoneLevel === 'micro') badgeColor = 'bg-purple-50 text-purple-800 border-purple-200';

                      return (
                        <span key={id} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border shadow-sm ${badgeColor}`}>
                          <span>{zone.name} ({zone.zoneLevel.toUpperCase()})</span>
                          <button
                            type="button"
                            onClick={() => handleZoneToggleCascade(zone)}
                            className="ml-1 inline-flex items-center justify-center focus:outline-none"
                          >
                            <X className="w-3 h-3 ml-0.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">Apply To *</label>
                  <select
                    value={ruleForm.applyTo}
                    onChange={(e) => setRuleForm({ ...ruleForm, applyTo: e.target.value, performanceScore: '', specificProvider: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="all">All Providers</option>
                    <option value="performanceScore">Performance Score</option>
                    <option value="specificProvider">Specific Provider</option>
                  </select>
                </div>

                {ruleForm.applyTo === 'performanceScore' && (
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1">Performance Score *</label>
                    <select
                      value={ruleForm.performanceScore}
                      onChange={(e) => setRuleForm({ ...ruleForm, performanceScore: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
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
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1">Provider ID *</label>
                    <input
                      type="text"
                      value={ruleForm.specificProvider}
                      onChange={(e) => setRuleForm({ ...ruleForm, specificProvider: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                      placeholder="e.g. PROV-XXXXXXXX"
                    />

                    {/* Provider Performance Display */}
                    {ruleForm.specificProvider && providers.find(p => p.providerId === ruleForm.specificProvider) && (
                      <div className="mt-3 p-3 bg-teal-50 border border-teal-100 rounded-xl">
                        {(() => {
                          const provider = providers.find(p => p.providerId === ruleForm.specificProvider);
                          const badgeColor = {
                            'Platinum': 'text-purple-600',
                            'Gold': 'text-amber-500',
                            'Silver': 'text-gray-400',
                            'Bronze': 'text-orange-700'
                          }[provider.performanceBadge] || 'text-secondary';

                          const nextBadge = {
                            'Bronze': { name: 'Silver', rating: 3.5, comp: 85 },
                            'Silver': { name: 'Gold', rating: 4.0, comp: 90 },
                            'Gold': { name: 'Platinum', rating: 4.5, comp: 95 },
                            'Platinum': null
                          }[provider.performanceBadge];

                          let gapInfo = null;
                          if (nextBadge) {
                            const ratingGap = Math.max(0, nextBadge.rating - (provider.averageRating || 0));
                            const compGap = Math.max(0, nextBadge.comp - (provider.completionRate || 0));
                            const onTimeGap = Math.max(0, nextBadge.comp - (provider.onTimeRate || 0));

                            if (ratingGap > 0 || compGap > 0 || onTimeGap > 0) {
                              const gapParts = [];
                              if (ratingGap > 0) gapParts.push(`${ratingGap.toFixed(1)}★`);
                              if (compGap > 0) gapParts.push(`+${compGap}% comp`);
                              if (onTimeGap > 0) gapParts.push(`+${onTimeGap}% on-time`);
                              if (gapParts.length > 0) gapInfo = `Need ${gapParts.join(' & ')} for ${nextBadge.name}`;
                            }
                          }

                          return (
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">Performance</span>
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${provider.performanceBadge === 'Platinum' ? 'bg-purple-500' : provider.performanceBadge === 'Gold' ? 'bg-amber-500' : 'bg-gray-400'}`}></div>
                                  <span className={`text-xs font-bold ${badgeColor}`}>{provider.performanceBadge}</span>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                {[
                                  { label: 'Rating', value: (provider.averageRating || 0).toFixed(1) },
                                  { label: 'Comp %', value: `${provider.completionRate || 0}%` },
                                  { label: 'On-Time', value: `${provider.onTimeRate || 0}%` },
                                ].map((stat) => (
                                  <div key={stat.label} className="bg-white p-1.5 rounded-lg border border-teal-100 text-center shadow-xs">
                                    <p className="text-[9px] text-gray-500 leading-none mb-1">{stat.label}</p>
                                    <p className="text-[11px] font-bold text-secondary leading-none">{stat.value}</p>
                                  </div>
                                ))}
                              </div>
                              {gapInfo && (
                                <p className="text-[9px] text-teal-600 italic font-medium pt-1 border-t border-teal-100/50">{gapInfo}</p>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* Badge Criteria Display */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden mt-1">
                  <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex items-center gap-2">
                    <Info className="w-3 h-3 text-slate-500" />
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Badge Criteria</span>
                  </div>
                  <div className="p-2 grid grid-cols-2 gap-2">
                    {[
                      { name: 'Platinum', criteria: '4.5★ | 95%', color: 'bg-indigo-100 text-indigo-700' },
                      { name: 'Gold', criteria: '4.0★ | 90%', color: 'bg-amber-100 text-amber-700' },
                      { name: 'Silver', criteria: '3.5★ | 85%', color: 'bg-slate-200 text-slate-700' },
                      { name: 'Bronze', criteria: 'Basics / Below', color: 'bg-orange-100 text-orange-700' }
                    ].map((badge) => (
                      <div key={badge.name} className="flex items-center justify-between p-1.5 bg-white rounded border border-slate-100 shadow-xs">
                        <span className={`px-1 rounded text-[8px] font-black ${badge.color}`}>{badge.name.toUpperCase()}</span>
                        <span className="text-[9px] text-slate-500 font-medium">{badge.criteria}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1">Effective From</label>
                    <input
                      type="date"
                      value={ruleForm.effectiveFrom ? new Date(ruleForm.effectiveFrom).toISOString().split('T')[0] : ''}
                      onChange={(e) => setRuleForm({ ...ruleForm, effectiveFrom: new Date(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary mb-1">Effective Until (Optional)</label>
                    <input
                      type="date"
                      value={ruleForm.effectiveUntil ? new Date(ruleForm.effectiveUntil).toISOString().split('T')[0] : ''}
                      onChange={(e) => setRuleForm({ ...ruleForm, effectiveUntil: e.target.value ? new Date(e.target.value) : '' })}
                      min={ruleForm.effectiveFrom ? new Date(ruleForm.effectiveFrom).toISOString().split('T')[0] : ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowRuleModal(false);
                    setEditingRule(null);
                    resetRuleForm();
                  }}
                  className="px-4 py-2 text-sm font-medium text-secondary bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={editingRule ? updateCommissionRule : createCommissionRule}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 transition-colors"
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
              <div className="px-6 py-4 border-b border-gray-200 bg-slate-50 rounded-t-2xl">
                <h3 className="text-xl font-bold text-secondary">Commission Rule Details</h3>
              </div>
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Rule Name</label>
                    <p className="text-base font-semibold text-secondary">{viewingRule.name}</p>
                  </div>

                  {viewingRule.description && (
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Description</label>
                      <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">{viewingRule.description}</p>
                    </div>
                  )}

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Commission Type</label>
                    <p className="text-sm font-bold text-secondary capitalize">{viewingRule.type}</p>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Commission Value</label>
                    <p className="text-lg font-black text-primary">
                      {viewingRule.type === 'percentage' ? `${viewingRule.value}%` : `₹${viewingRule.value.toFixed(2)}`}
                    </p>
                  </div>

                  <div className="md:col-span-2 pb-2 border-b border-gray-100">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Application Scope</label>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-bold">
                        {viewingRule.applyTo === 'all' && 'All Providers'}
                        {viewingRule.applyTo === 'performanceScore' && 'Performance Tier'}
                        {viewingRule.applyTo === 'specificProvider' && 'Specific Provider'}
                      </span>

                      {viewingRule.performanceScore && (
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${viewingRule.performanceScore === 'Platinum' ? 'bg-purple-100 text-purple-700' :
                          viewingRule.performanceScore === 'Gold' ? 'bg-amber-100 text-amber-700' :
                            viewingRule.performanceScore === 'Silver' ? 'bg-slate-200 text-slate-700' :
                              'bg-orange-100 text-orange-700'
                          }`}>
                          {viewingRule.performanceScore} Badge
                        </span>
                      )}

                      {viewingRule.specificProvider && (
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                          {viewingRule.specificProvider.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Status</label>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${viewingRule.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                      }`}>
                      {viewingRule.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Created By</label>
                    <p className="text-sm font-medium text-secondary">{viewingRule.createdBy?.name || 'N/A'}</p>
                  </div>

                  <div className="bg-gray-50 p-2 rounded-lg">
                    <label className="block text-[9px] font-bold text-gray-400 uppercase mb-0.5">Effective From</label>
                    <p className="text-xs font-semibold text-secondary">
                      {viewingRule.effectiveFrom ? format(new Date(viewingRule.effectiveFrom), 'dd MMM yyyy') : 'N/A'}
                    </p>
                  </div>

                  <div className="bg-gray-50 p-2 rounded-lg">
                    <label className="block text-[9px] font-bold text-gray-400 uppercase mb-0.5">Effective Until</label>
                    <p className="text-xs font-semibold text-secondary">
                      {viewingRule.effectiveUntil ? format(new Date(viewingRule.effectiveUntil), 'dd MMM yyyy') : 'No expiration'}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-400 italic">
                  <span>Created: {viewingRule.createdAt ? format(new Date(viewingRule.createdAt), 'dd MMM yyyy HH:mm') : 'N/A'}</span>
                  <span>Updated: {viewingRule.updatedAt ? format(new Date(viewingRule.updatedAt), 'dd MMM yyyy HH:mm') : 'N/A'}</span>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-slate-50 rounded-b-2xl">
                <button
                  onClick={() => {
                    setShowRuleDetailsModal(false);
                    setViewingRule(null);
                  }}
                  className="px-6 py-2 text-sm font-bold text-secondary bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors shadow-sm"
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