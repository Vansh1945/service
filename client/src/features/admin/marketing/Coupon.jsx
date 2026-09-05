import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Pagination from '../../../components/ui/Pagination';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Loader from '../../../components/ui/Loader';
import EmptyState from '../../../components/ui/EmptyState';
import Badge from '../../../components/ui/Badge';
import usePagination from '../../../hooks/usePagination';
import { Plus, Edit, Trash2, Eye, Filter, CheckCircle, XCircle, Clock, Percent, DollarSign, Users, Globe, Gift, Calendar, Save, X } from 'lucide-react';
import { toast } from '../../../components/ui/Toast';

import { useAuth } from '../../../context/auth';
import * as CouponService from '../../../services/CouponService';
import * as AdminService from '../../../services/AdminService';
import { getAllZones } from '../../../services/ZoneService';
import { formatCurrency, formatDate } from '../../../utils/format';
import HierarchicalZoneSelector from '../../../components/HierarchicalZoneSelector';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import StatCard from '../../../components/ui/StatCard';

const AdminCoupons = () => {
  const { API, _token } = useAuth();

  const {
    filterType,
    year,
    financialYear,
    month,
    quarter,
    zoneIds,
    getComputedDateRange,
    getMergedQuery
  } = useAdminFilter();
  // State management
  const [coupons, setCoupons] = useState([]);
  const [filteredCoupons, setFilteredCoupons] = useState([]);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showHardDeleteModal, setShowHardDeleteModal] = useState(false);
  const [couponToDelete, setCouponToDelete] = useState(null);
  const [searchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') || '';
  const [searchTerm, setSearchTerm] = useState(urlSearch);

  useEffect(() => {
    setSearchTerm(urlSearch);
  }, [urlSearch]);

  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [users, setUsers] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(false);
  const {
    currentPage: couponLogPage,
    onPageChange: onCouponLogPageChange,
    setTotalItems: setCouponLogTotalItems
  } = usePagination(1, 5);

  useEffect(() => {
    if (selectedCoupon?.usedBy) {
      setCouponLogTotalItems(selectedCoupon.usedBy.length);
    }
  }, [selectedCoupon, setCouponLogTotalItems]);

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    expired: 0,
    global: 0,
    firstBooking: 0
  });

  const paginatedRedemptionLogs = useMemo(() => {
    if (!selectedCoupon?.usedBy) return [];
    const start = (couponLogPage - 1) * 5;
    return selectedCoupon.usedBy.slice(start, start + 5);
  }, [selectedCoupon, couponLogPage]);

  // Form states
  const [createForm, setCreateForm] = useState({
    code: '',
    discountType: 'flat',
    discountValue: '',
    expiryDate: '',
    isGlobal: false,
    isFirstBooking: false,
    assignedTo: '',
    usageLimit: '',
    applicableZones: []
  });
  const [editForm, setEditForm] = useState({
    code: '',
    discountType: 'flat',
    discountValue: '',
    expiryDate: '',
    minBookingValue: '',
    isGlobal: false,
    isFirstBooking: false,
    assignedTo: '',
    usageLimit: '',
    isActive: true,
    applicableZones: []
  });

  const [createStateSearch] = useState('');
  const [createStateOpen] = useState(false);
  const [createCitySearch] = useState('');
  const [createCityOpen] = useState(false);
  const [createMicroSearch] = useState('');
  const [createMicroOpen] = useState(false);

  const [editStateSearch] = useState('');
  const [editStateOpen] = useState(false);
  const [editCitySearch] = useState('');
  const [editCityOpen] = useState(false);
  const [editMicroSearch] = useState('');
  const [editMicroOpen] = useState(false);

  const handleZoneToggleCascade = (zone, isCreate) => {
    const form = isCreate ? createForm : editForm;
    const setForm = isCreate ? setCreateForm : setEditForm;
    const currentSelected = form.applicableZones || [];
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

    setForm(prev => ({ ...prev, applicableZones: newZones }));
  };

  // Fetch zones helper
  const fetchZones = async () => {
    try {
      const response = await getAllZones();
      const data = response.data;
      if (data.success) {
        setZones(data.data || []);
      }
    } catch (error) {
      console.error('Fetch zones error:', error);
    }
  };

  // Check admin access
  useEffect(() => {
    fetchCoupons();
    fetchUsers();
    fetchZones();

    const params = new URLSearchParams(window.location.search);
    const prefillZone = params.get('prefillZone');
    if (prefillZone) {
      setCreateForm(prev => ({
        ...prev,
        isGlobal: false,
        applicableZones: [prefillZone]
      }));
      setShowCreateModal(true);
    }
  }, []);


  // Filter and search coupons
  useEffect(() => {
    let filtered = [...coupons];

    // Apply global date filter
    const { startDate, endDate } = getComputedDateRange();
    if (startDate && endDate) {
      const startDateTime = new Date(startDate).getTime();
      const endDateTime = new Date(endDate).getTime();

      filtered = filtered.filter(coupon => {
        const couponDate = new Date(coupon.expiryDate || coupon.createdAt).getTime();
        return couponDate >= startDateTime && couponDate <= endDateTime;
      });
    }

    // Apply global zone filter
    if (zoneIds && zoneIds.length > 0) {
      filtered = filtered.filter(coupon => {
        if (coupon.isGlobal) return true; // Global coupons apply everywhere
        const couponZones = coupon.applicableZones ? coupon.applicableZones.map(z => (z._id || z).toString()) : [];
        return zoneIds.some(id => couponZones.includes(id.toString()));
      });
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(coupon =>
        coupon.code?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      if (typeFilter === 'global') {
        filtered = filtered.filter(coupon => coupon.isGlobal);
      } else if (typeFilter === 'first-booking') {
        filtered = filtered.filter(coupon => coupon.isFirstBooking);
      } else if (typeFilter === 'assigned') {
        filtered = filtered.filter(coupon => coupon.assignedTo);
      }
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      filtered = filtered.filter(coupon => coupon.isActive === isActive);
    }

    setFilteredCoupons(filtered);
  }, [coupons, searchTerm, typeFilter, statusFilter, filterType, year, financialYear, month, quarter, zoneIds]);

  // Calculate stats whenever coupons change
  useEffect(() => {
    const newStats = {
      total: coupons.length,
      active: coupons.filter(c => c.isActive && new Date(c.expiryDate) > new Date()).length,
      expired: coupons.filter(c => new Date(c.expiryDate) <= new Date()).length,
      global: coupons.filter(c => c.isGlobal).length,
      firstBooking: coupons.filter(c => c.isFirstBooking).length
    };
    setStats(newStats);
  }, [coupons]);

  // Fetch all coupons
  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const response = await CouponService.getAllCoupons();
      const data = response.data;
      setCoupons(data.data || data.coupons || []);
    } catch (error) {
      console.error('Fetch coupons error:', error);
      toast.error(error.message || 'Failed to fetch coupons');
    } finally {
      setLoading(false);
    }
  };

  // Fetch users for assignment
  const fetchUsers = async () => {
    try {
      const response = await AdminService.getAllCustomers({ limit: 10000 });
      const data = response.data;

      if (data.success || response.status === 200) {
        const usersList = data.users || data.customers || [];
        setUsers(usersList);
      } else {
        throw new Error(data.message || 'Failed to load users list');
      }
    } catch (error) {
      console.error('Fetch users error:', error);
      toast.error(error.message || 'Error loading users');
    }
  };

  // Handle create form changes
  const handleCreateFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCreateForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Handle edit form changes
  const handleEditFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Create new coupon
  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    try {
      const couponData = {
        ...createForm,
        discountValue: Number(createForm.discountValue),
        minBookingValue: Number(createForm.minBookingValue) || 0,
        usageLimit: createForm.usageLimit ? Number(createForm.usageLimit) : null,
        assignedTo: createForm.assignedTo || null
      };

      const response = await CouponService.createCoupon(couponData);
      const data = response.data;

      setCoupons(prev => [data.data, ...prev]);
      toast.success(data.message);
      resetCreateForm();
      setShowCreateModal(false);
    } catch (error) {
      console.error('Create coupon error:', error);
      toast.error(error.message);
    }
  };

  // Update coupon
  const handleUpdateCoupon = async (e) => {
    e.preventDefault();
    try {
      const updateData = { ...editForm };
      updateData.discountValue = Number(updateData.discountValue);
      updateData.minBookingValue = Number(updateData.minBookingValue) || 0;
      updateData.usageLimit = updateData.usageLimit ? Number(updateData.usageLimit) : null;

      if (selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0) {
        delete updateData.code;
        delete updateData.discountType;
        delete updateData.discountValue;
        delete updateData.isGlobal;
        delete updateData.isFirstBooking;
      }

      const response = await CouponService.updateCoupon(selectedCoupon._id, updateData);
      const data = response.data;
      setCoupons(prev => prev.map(c => c._id === data.data._id ? data.data : c));
      toast.success(data.message);
      setShowEditModal(false);
    } catch (error) {
      console.error('Update coupon error:', error);
      toast.error(error.message);
    }
  };

  // Deactivate coupon
  const handleDeleteCoupon = async (couponId) => {
    const prevCoupons = [...coupons];
    try {
      setCoupons(prev => prev.map(c => c._id === couponId ? { ...c, isActive: false } : c));
      const response = await CouponService.deleteCoupon(couponId);
      const data = response.data;
      toast.success(data.message);
    } catch (error) {
      console.error('Deactivate coupon error:', error);
      toast.error(error.message);
      setCoupons(prevCoupons);
    }
  };

  // Hard delete coupon
  const handleHardDeleteCoupon = (couponId) => {
    setCouponToDelete(couponId);
    setShowHardDeleteModal(true);
  };

  const confirmHardDeleteCoupon = async () => {
    if (!couponToDelete) return;

    const prevCoupons = [...coupons];
    try {
      setCoupons(prev => prev.filter(c => c._id !== couponToDelete));
      const response = await CouponService.hardDeleteCoupon(couponToDelete);
      const data = response.data;
      toast.success(data.message);
    } catch (error) {
      console.error('Delete coupon error:', error);
      toast.error(error.message);
      setCoupons(prevCoupons);
    } finally {
      setShowHardDeleteModal(false);
      setCouponToDelete(null);
    }
  };

  // Reset create form
  const resetCreateForm = () => {
    setCreateForm({
      code: '',
      discountType: 'flat',
      discountValue: '',
      minBookingValue: '',
      isGlobal: false,
      isFirstBooking: false,
      assignedTo: '',
      usageLimit: '',
      applicableZones: []
    });
  };

  // Handle edit click
  const handleEditClick = (coupon) => {
    setSelectedCoupon(coupon);
    setEditForm({
      code: coupon.code || '',
      discountType: coupon.discountType || 'flat',
      discountValue: coupon.discountValue || '',
      expiryDate: coupon.expiryDate ? new Date(coupon.expiryDate).toISOString().split('T')[0] : '',
      minBookingValue: coupon.minBookingValue || '',
      isGlobal: !!coupon.isGlobal,
      isFirstBooking: !!coupon.isFirstBooking,
      assignedTo: coupon.assignedTo ? (coupon.assignedTo._id || coupon.assignedTo) : '',
      usageLimit: coupon.usageLimit || '',
      isActive: !!coupon.isActive,
      applicableZones: coupon.applicableZones ? coupon.applicableZones.map(z => typeof z === 'object' ? z._id : z) : []
    });
    setShowEditModal(true);
  };

  // Handle view click
  const handleViewClick = (coupon) => {
    setSelectedCoupon(coupon);
    setShowViewModal(true);
  };


  // Format address
  const formatAddress = (address) => {
    if (!address) return '';
    const { city, state } = address;
    return [city, state].filter(Boolean).join(', ');
  };


  // Check if coupon is expired
  const isExpired = (expiryDate) => {
    return new Date(expiryDate) < new Date();
  };

  // Get remaining uses
  const getRemainingUses = (coupon) => {
    if (coupon.usageLimit === null) return 'Unlimited';
    return coupon.usageLimit - (coupon.usedBy?.length || 0);
  };

  const getZoneHierarchyPath = (zoneId) => {
    const zone = zones.find(z => z._id.toString() === zoneId.toString());
    if (!zone) return 'Unknown Zone';

    let path = zone.name;
    let current = zone;

    while (current && current.parentZone) {
      const parentId = typeof current.parentZone === 'object' ? current.parentZone._id : current.parentZone;
      const parent = zones.find(z => z._id.toString() === parentId.toString());
      if (parent) {
        path = `${parent.name} > ${path}`;
        current = parent;
      } else {
        break;
      }
    }
    return path;
  };

  const displayApplicableZones = (applicableZones) => {
    if (!applicableZones || applicableZones.length === 0) {
      return <span className="text-gray-500 font-medium">Global</span>;
    }
    const zoneIds = applicableZones.map(z => typeof z === 'object' ? z._id : z);
    if (zoneIds.length === 1) {
      return <span className="text-sm font-medium text-secondary">{getZoneHierarchyPath(zoneIds[0])}</span>;
    }
    const firstPath = getZoneHierarchyPath(zoneIds[0]);
    return (
      <span className="text-sm font-medium text-secondary" title={zoneIds.map(id => getZoneHierarchyPath(id)).join(', ')}>
        {firstPath} <span className="text-primary font-bold">({zoneIds.length} zones)</span>
      </span>
    );
  };

  const renderCouponForm = (formType) => {
    const isEdit = formType === 'edit';
    const form = isEdit ? editForm : createForm;
    const handleChange = isEdit ? handleEditFormChange : handleCreateFormChange;
    const setForm = isEdit ? setEditForm : setCreateForm;

    return (
      <div className="space-y-6">
        {/* Section 1: General Details */}
        <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
          <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-1.5 pb-2 border-b border-slate-100/50">
            <Gift className="w-4 h-4 text-primary" /> General Configuration
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Coupon Code *
              </label>
              <input
                type="text"
                name="code"
                value={form.code}
                onChange={handleChange}
                required
                disabled={isEdit && selectedCoupon?.usedBy && selectedCoupon.usedBy.length > 0}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold font-mono uppercase disabled:bg-slate-100/80 disabled:text-slate-500 disabled:cursor-not-allowed"
                placeholder="e.g., WELCOME20"
                minLength={3}
                maxLength={20}
              />
              {isEdit && selectedCoupon?.usedBy && selectedCoupon.usedBy.length > 0 && (
                <p className="text-[10px] text-amber-600 font-bold uppercase mt-1">Code locked after usage</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Discount Type *
              </label>
              <select
                name="discountType"
                value={form.discountType}
                onChange={handleChange}
                required
                disabled={isEdit && selectedCoupon?.usedBy && selectedCoupon.usedBy.length > 0}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold cursor-pointer disabled:bg-slate-100/80 disabled:text-slate-500 disabled:cursor-not-allowed"
              >
                <option value="flat">Flat Amount (₹)</option>
                <option value="percent">Percentage (%)</option>
              </select>
              {isEdit && selectedCoupon?.usedBy && selectedCoupon.usedBy.length > 0 && (
                <p className="text-[10px] text-amber-600 font-bold uppercase mt-1">Type locked after usage</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Discount Value *
              </label>
              <input
                type="number"
                name="discountValue"
                value={form.discountValue}
                onChange={handleChange}
                required
                min="1"
                step={form.discountType === 'percent' ? "1" : "any"}
                max={form.discountType === 'percent' ? "100" : ""}
                disabled={isEdit && selectedCoupon?.usedBy && selectedCoupon.usedBy.length > 0}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold disabled:bg-slate-100/80 disabled:text-slate-500 disabled:cursor-not-allowed"
                placeholder={form.discountType === 'flat' ? "e.g., 200" : "e.g., 20"}
              />
              {isEdit && selectedCoupon?.usedBy && selectedCoupon.usedBy.length > 0 && (
                <p className="text-[10px] text-amber-600 font-bold uppercase mt-1">Value locked after usage</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Minimum Booking Value (₹)
              </label>
              <input
                type="number"
                name="minBookingValue"
                value={form.minBookingValue}
                onChange={handleChange}
                min="0"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold"
                placeholder="e.g., 1000 (optional)"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Expiry & Limits */}
        <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
          <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-1.5 pb-2 border-b border-slate-100/50">
            <Calendar className="w-4 h-4 text-primary" /> Rules & Restrictions
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Expiry Date *
              </label>
              <input
                type="date"
                name="expiryDate"
                value={form.expiryDate}
                onChange={handleChange}
                required
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Usage Limit
              </label>
              <input
                type="number"
                name="usageLimit"
                value={form.usageLimit}
                onChange={handleChange}
                min="1"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold"
                placeholder="Leave empty for unlimited"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Scope & Targeting */}
        <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
          <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-1.5 pb-2 border-b border-slate-100/50">
            <Globe className="w-4 h-4 text-primary" /> Scope & Targeting
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Coupon Scope *
              </label>
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80 w-full shadow-inner disabled:opacity-50">
                <button
                  type="button"
                  disabled={isEdit && selectedCoupon?.usedBy && selectedCoupon.usedBy.length > 0}
                  onClick={() => setForm(prev => ({ ...prev, isGlobal: true, applicableZones: [] }))}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${form.isGlobal ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-800 disabled:opacity-50'}`}
                >
                  Global
                </button>
                <button
                  type="button"
                  disabled={isEdit && selectedCoupon?.usedBy && selectedCoupon.usedBy.length > 0}
                  onClick={() => setForm(prev => ({ ...prev, isGlobal: false }))}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${!form.isGlobal ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-800 disabled:opacity-50'}`}
                >
                  Zone Specific
                </button>
              </div>
            </div>
            {isEdit ? (
              <div className="grid grid-cols-2 gap-3 pt-5 pl-2">
                <label className="flex items-center space-x-2.5 cursor-pointer select-none bg-white py-2.5 px-3 rounded-xl border border-slate-200 w-full hover:bg-slate-50 transition-colors shadow-sm">
                  <input
                    type="checkbox"
                    name="isFirstBooking"
                    id="editIsFirstBooking"
                    checked={form.isFirstBooking}
                    onChange={handleChange}
                    disabled={selectedCoupon?.usedBy && selectedCoupon.usedBy.length > 0}
                    className="h-4.5 w-4.5 text-primary focus:ring-primary border-slate-350 rounded cursor-pointer accent-primary disabled:opacity-50"
                  />
                  <span className="text-xs font-black text-slate-700 leading-none">First Booking Only</span>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer select-none bg-white py-2.5 px-3 rounded-xl border border-slate-200 w-full hover:bg-slate-50 transition-colors shadow-sm">
                  <input
                    type="checkbox"
                    name="isActive"
                    id="isActive"
                    checked={form.isActive}
                    onChange={handleChange}
                    className="h-4.5 w-4.5 text-primary focus:ring-primary border-slate-350 rounded cursor-pointer accent-primary"
                  />
                  <span className="text-xs font-black text-slate-700 leading-none">Active Coupon</span>
                </label>
              </div>
            ) : (
              <div className="flex items-center pt-5 pl-2">
                <label className="flex items-center space-x-3 cursor-pointer select-none bg-white py-2.5 px-4 rounded-xl border border-slate-200 w-full hover:bg-slate-50 transition-colors shadow-sm">
                  <input
                    type="checkbox"
                    name="isFirstBooking"
                    id="isFirstBooking"
                    checked={form.isFirstBooking}
                    onChange={handleChange}
                    className="h-4.5 w-4.5 text-primary focus:ring-primary border-slate-350 rounded cursor-pointer accent-primary"
                  />
                  <span className="text-sm font-bold text-slate-700">First Booking Only</span>
                </label>
              </div>
            )}
          </div>

          {!form.isGlobal && !form.isFirstBooking && (
            <div className="pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Assign to User (Optional)
              </label>
              {users.length > 0 ? (
                <select
                  name="assignedTo"
                  value={form.assignedTo}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold cursor-pointer"
                >
                  <option value="">Select a user (optional)</option>
                  {users.map(user => {
                    const userObj = typeof user === 'string' ? { _id: user } : user;
                    return (
                      <option key={userObj._id} value={userObj._id}>
                        {getUserDisplayName(userObj)}
                        {userObj.email ? ` - ${userObj.email}` : ''}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <input
                  type="text"
                  name="assignedTo"
                  value={form.assignedTo}
                  onChange={handleChange}
                  placeholder="Enter user ID manually"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold"
                />
              )}
            </div>
          )}

          {!form.isGlobal && (
            <div className="pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <HierarchicalZoneSelector
                zones={zones}
                selectedZoneIds={form.applicableZones}
                onChange={(newZoneIds) => {
                  if (Array.isArray(newZoneIds)) {
                    setForm(prev => ({ ...prev, applicableZones: newZoneIds }));
                  } else if (newZoneIds && (newZoneIds._id || newZoneIds.id)) {
                    const targetId = (newZoneIds._id || newZoneIds.id).toString();
                    setForm(prev => ({ ...prev, applicableZones: (prev.applicableZones || []).filter(id => id.toString() !== targetId) }));
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  // Get user display name
  const getUserDisplayName = (user) => {
    if (!user) return 'Unknown User';

    // Handle different user object structures
    if (typeof user === 'string') return user;

    if (user.name) return user.name;
    if (user.email) return user.email;
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCoupons = filteredCoupons.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredCoupons.length / itemsPerPage);

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-secondary">Coupons Management</h1>
            <p className="text-gray-600 mt-1">Manage discount coupons and promotions</p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            leftIcon={<Plus className="w-4 h-4" />}
            size="md"
          >
            Add Coupon
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 mb-6 md:mb-8">
          <StatCard
            title="Total Coupons"
            value={stats.total}
            icon={Gift}
            iconBg="bg-teal-100"
            iconColor="text-primary"
          />
          <StatCard
            title="Active Coupons"
            value={stats.active}
            icon={CheckCircle}
            iconBg="bg-green-100"
            iconColor="text-green-600"
          />
          <StatCard
            title="Expired Coupons"
            value={stats.expired}
            icon={XCircle}
            iconBg="bg-red-100"
            iconColor="text-red-650"
          />
          <StatCard
            title="Global Coupons"
            value={stats.global}
            icon={Globe}
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
          />
          <StatCard
            title="First Booking"
            value={stats.firstBooking}
            icon={Users}
            iconBg="bg-purple-100"
            iconColor="text-purple-600"
          />
        </div>

        {/* Filters and Search */}

        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row gap-3 md:gap-4">
            <div className="flex items-center gap-2 md:gap-3">
              <Filter className="text-gray-400 w-4 h-4 md:w-5 md:h-5" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="all">All Types</option>
                <option value="global">Global</option>
                <option value="first-booking">First Booking</option>
                <option value="assigned">Assigned</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-xl shadow-md p-8 mb-6 text-center">
            <Loader text="Loading coupons..." />
          </div>
        )}

        {/* Coupons Table */}
        {!loading && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            {currentCoupons.length === 0 ? (
              <EmptyState
                title="No coupons found"
                message={
                  searchTerm || typeFilter !== 'all' || statusFilter !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Create your first coupon to get started'
                }
                icon={Gift}
                actionLabel={searchTerm || typeFilter !== 'all' || statusFilter !== 'all' ? 'Clear Filters' : 'Add Coupon'}
                onAction={() => {
                  if (searchTerm || typeFilter !== 'all' || statusFilter !== 'all') {
                    setSearchTerm('');
                    setTypeFilter('all');
                    setStatusFilter('all');
                  } else {
                    setShowCreateModal(true);
                  }
                }}
                className="py-12 border-0 shadow-none"
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount</th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min. Booking</th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applicable Zones</th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {currentCoupons.map((coupon) => (
                        <tr key={coupon._id} className="hover:bg-gray-50 transition-colors duration-200">
                          <td className="px-4 md:px-6 py-4">
                            <div className="text-sm font-medium text-secondary font-mono">{coupon.code}</div>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {coupon.discountType === 'flat' ? (
                                <DollarSign className="w-3 h-3 md:w-4 md:h-4 text-green-600 mr-1" />
                              ) : (
                                <Percent className="w-3 h-3 md:w-4 md:h-4 text-blue-600 mr-1" />
                              )}
                              <span className="text-sm font-semibold">
                                {coupon.discountType === 'flat'
                                  ? formatCurrency(coupon.discountValue)
                                  : `${coupon.discountValue}%`
                                }
                              </span>
                            </div>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-600">
                              {coupon.minBookingValue ? formatCurrency(coupon.minBookingValue) : 'None'}
                            </span>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Calendar className="w-3 h-3 md:w-4 md:h-4 text-gray-400 mr-1" />
                              <span className={`text-sm ${isExpired(coupon.expiryDate) ? 'text-red-600' : 'text-gray-600'}`}>
                                {formatDate(coupon.expiryDate)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            {coupon.isGlobal ? (
                              <Badge variant="info" size="sm">
                                <Globe className="w-3 h-3 mr-1" />
                                Global
                              </Badge>
                            ) : coupon.isFirstBooking ? (
                              <Badge variant="secondary" size="sm">
                                <Users className="w-3 h-3 mr-1" />
                                First Booking
                              </Badge>
                            ) : coupon.assignedTo ? (
                              <Badge variant="warning" size="sm">Assigned</Badge>
                            ) : coupon.isReferralCoupon ? (
                              <Badge variant="primary" size="sm">Referral</Badge>
                            ) : (
                              <Badge variant="neutral" size="sm">Standard</Badge>
                            )}
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            {displayApplicableZones(coupon.applicableZones)}
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">
                              {coupon.usedBy?.length || 0} / {coupon.usageLimit === null ? '∞' : coupon.usageLimit}
                            </div>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            {coupon.isActive && !isExpired(coupon.expiryDate) ? (
                              <Badge variant="success" size="sm">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="danger" size="sm">
                                <XCircle className="w-3 h-3 mr-1" />
                                {isExpired(coupon.expiryDate) ? 'Expired' : 'Inactive'}
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleViewClick(coupon)}
                                className="text-primary hover:text-teal-800 p-1 rounded transition-colors duration-200"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleEditClick(coupon)}
                                className="text-primary hover:text-teal-800 p-1 rounded transition-colors duration-200"
                                title="Edit Coupon"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteCoupon(coupon._id)}
                                className="text-yellow-600 hover:text-yellow-800 p-1 rounded transition-colors duration-200"
                                title="Deactivate Coupon"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                              {!coupon.isActive || isExpired(coupon.expiryDate) ? (
                                <button
                                  onClick={() => handleHardDeleteCoupon(coupon._id)}
                                  className="text-red-600 hover:text-red-800 p-1 rounded transition-colors duration-200"
                                  title="Delete Coupon Permanently"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  disabled
                                  className="text-slate-300 p-1 rounded cursor-not-allowed"
                                  title="Only inactive or expired coupons can be permanently deleted"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="mt-4 border-t border-gray-200">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={filteredCoupons.length}
                    limit={itemsPerPage}
                    onPageChange={setCurrentPage}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Create Coupon Modal */}
        {showCreateModal && (
          <Modal
            isOpen={showCreateModal}
            onClose={() => {
              setShowCreateModal(false);
              resetCreateForm();
            }}
            title="Create New Coupon"
            size="large"
          >
            <form onSubmit={handleCreateCoupon} className="space-y-6">
              {renderCouponForm('create')}

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetCreateForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  leftIcon={<Save className="w-4 h-4" />}
                >
                  Create Coupon
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* Edit Coupon Modal */}
        {showEditModal && selectedCoupon && (
          <Modal
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            title="Edit Coupon"
            size="large"
          >
            <form onSubmit={handleUpdateCoupon} className="space-y-6">
              {renderCouponForm('edit')}

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  leftIcon={<Save className="w-4 h-4" />}
                >
                  Update Coupon
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* View Coupon Modal */}
        {showViewModal && selectedCoupon && (
          <Modal
            isOpen={showViewModal}
            onClose={() => setShowViewModal(false)}
            title="Coupon Details"
            size="large"
          >
            <div className="space-y-3.5">
              {/* Compact Ticket Header Card */}
              <div className="relative bg-teal-50/40 border border-dashed border-primary/30 p-3.5 sm:p-4 rounded-xl overflow-hidden flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full border-r border-dashed border-primary/30" />
                <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full border-l border-dashed border-primary/30" />

                <div className="flex flex-col items-center sm:items-start text-center sm:text-left pl-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 mb-1">
                    {selectedCoupon.isActive && !isExpired(selectedCoupon.expiryDate) ? 'Active Promo Code' : 'Inactive / Expired Code'}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-secondary tracking-wider font-mono uppercase">
                    {selectedCoupon.code}
                  </h3>
                </div>
                <div className="flex flex-col items-center sm:items-end text-center sm:text-right pr-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Savings Value</span>
                  <div className="text-2xl sm:text-3xl font-black text-primary">
                    {selectedCoupon.discountType === 'flat'
                      ? formatCurrency(selectedCoupon.discountValue)
                      : `${selectedCoupon.discountValue}% OFF`
                    }
                  </div>
                </div>
              </div>

              {/* Key Indicators Grid - Compact */}
              <div className="grid grid-cols-3 gap-3 bg-slate-50/50 p-2.5 sm:p-3 rounded-xl border border-slate-100 shadow-xs">
                <div className="text-center p-1 border-r border-slate-200/60">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5 flex items-center justify-center gap-1">
                    <Calendar className="w-3 h-3" /> Expiry
                  </p>
                  <p className={`text-xs font-extrabold ${isExpired(selectedCoupon.expiryDate) ? 'text-red-500' : 'text-slate-750'}`}>
                    {formatDate(selectedCoupon.expiryDate)}
                  </p>
                  {isExpired(selectedCoupon.expiryDate) && (
                    <span className="inline-block mt-0.5 text-[8px] bg-red-150 text-red-700 px-1.5 py-0.2 rounded font-black uppercase">Expired</span>
                  )}
                </div>

                <div className="text-center p-1 border-r border-slate-200/60">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5 flex items-center justify-center gap-1">
                    <Users className="w-3 h-3" /> Redemptions
                  </p>
                  <p className="text-xs font-extrabold text-slate-750">
                    {selectedCoupon.usedBy?.length || 0} <span className="text-slate-400 font-medium">/</span> {selectedCoupon.usageLimit === null ? '∞' : selectedCoupon.usageLimit}
                  </p>
                  <p className="text-[8px] text-slate-450 font-bold uppercase tracking-wider mt-0.5">Used Count</p>
                </div>

                <div className="text-center p-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5 flex items-center justify-center gap-1">
                    <DollarSign className="w-3 h-3" /> Min Booking
                  </p>
                  <p className="text-xs font-extrabold text-slate-750">
                    {selectedCoupon.minBookingValue ? formatCurrency(selectedCoupon.minBookingValue) : 'No Minimum'}
                  </p>
                  <p className="text-[8px] text-slate-455 font-bold uppercase tracking-wider mt-0.5">Minimum Spend</p>
                </div>
              </div>

              {/* Targeting & Scope Card - Compact */}
              <div className="bg-slate-50/50 p-3.5 sm:p-4 rounded-xl border border-slate-100 space-y-2.5">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5 pb-1.5 border-b border-slate-100/50">
                  <Globe className="w-3.5 h-3.5 text-primary" /> Targeting & Scope
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Coupon Type Info */}
                  <div className="bg-white p-2.5 sm:p-3 rounded-lg border border-slate-200/50 flex items-center gap-2.5 shadow-xs">
                    <div className="p-1.5 bg-primary/10 text-primary rounded-lg border border-primary/20 shrink-0">
                      {selectedCoupon.isGlobal ? (
                        <Globe className="w-4 h-4 text-primary" />
                      ) : selectedCoupon.isFirstBooking ? (
                        <Users className="w-4 h-4 text-purple-650" />
                      ) : selectedCoupon.assignedTo ? (
                        <Users className="w-4 h-4 text-orange-600" />
                      ) : (
                        <Gift className="w-4 h-4 text-slate-650" />
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-slate-750 uppercase tracking-wide leading-none">Campaign Type</p>
                      <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                        {selectedCoupon.isGlobal ? (
                          'Global Promotion'
                        ) : selectedCoupon.isFirstBooking ? (
                          'First Booking Only'
                        ) : selectedCoupon.assignedTo ? (
                          `User-Specific: ${getUserDisplayName(selectedCoupon.assignedTo)}`
                        ) : (
                          'Standard Campaign'
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Applicable Zones Info */}
                  <div className="bg-white p-2.5 sm:p-3 rounded-lg border border-slate-200/50 flex flex-col justify-center shadow-xs">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Geographic Zones</p>
                    {selectedCoupon.applicableZones && selectedCoupon.applicableZones.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-h-14 overflow-y-auto pr-1">
                        {selectedCoupon.applicableZones.map(z => {
                          const zoneId = typeof z === 'object' ? z._id : z;
                          return (
                            <span key={zoneId} className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-teal-50 text-teal-800 border border-teal-200/60 shadow-xs capitalize">
                              📍 {getZoneHierarchyPath(zoneId).split('>').pop().trim()}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-[10px] font-extrabold text-slate-750 flex items-center gap-1 uppercase tracking-wider">🌍 Globally Applicable</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Redemption History Table - ALWAYS PRESENT */}
              <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100/50">
                  <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-primary" /> Redemption Logs ({selectedCoupon.usedBy?.length || 0})
                  </h4>
                  <span className="text-[10px] font-bold text-slate-400">
                    {selectedCoupon.usageLimit ? `Limit: ${selectedCoupon.usageLimit}` : 'Unlimited Redemptions'}
                  </span>
                </div>

                {selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0 ? (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <table className="min-w-full divide-y divide-slate-150">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">User Details</th>
                          <th className="px-4 py-2.5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Booking ID</th>
                          <th className="px-4 py-2.5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Booking Value</th>
                          <th className="px-4 py-2.5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Redeemed At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {paginatedRedemptionLogs.map((usage, index) => (
                          <tr key={index} className="hover:bg-slate-50/40 transition-colors">
                            <td className="px-4 py-2.5">
                              <p className="font-extrabold text-slate-800 leading-none">{getUserDisplayName(usage.user)}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {usage.user?.email && <span className="text-[10px] text-slate-400 font-semibold">{usage.user.email}</span>}
                                {usage.user?.phone && <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200/60">{usage.user.phone}</span>}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 font-mono font-bold text-slate-700">
                              {usage.booking?.bookingId || usage.booking || usage.bookingId || 'N/A'}
                            </td>
                            <td className="px-4 py-2.5 font-extrabold text-slate-800">
                              {formatCurrency(usage.bookingValue || usage.booking?.totalAmount || 0)}
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-slate-500">
                              {formatDate(usage.usedAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {selectedCoupon.usedBy.length > 5 && (
                      <Pagination
                        currentPage={couponLogPage}
                        totalPages={Math.ceil(selectedCoupon.usedBy.length / 5)}
                        totalItems={selectedCoupon.usedBy.length}
                        limit={5}
                        onPageChange={onCouponLogPageChange}
                      />
                    )}
                  </div>
                ) : (
                  <div className="bg-white p-6 rounded-xl border border-dashed border-slate-200 text-center flex flex-col items-center justify-center space-y-1">
                    <div className="p-2.5 bg-slate-100/70 text-slate-400 rounded-full mb-1">
                      <Clock className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-xs font-bold text-slate-700">No Redemptions Logged Yet</p>
                    <p className="text-[11px] text-slate-400 max-w-sm">
                      Once customers redeem this promo code during checkout, their user details, booking ID, booking value, and timestamps will be logged here.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowViewModal(false)}
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setShowViewModal(false);
                    handleEditClick(selectedCoupon);
                  }}
                  leftIcon={<Edit className="w-4 h-4" />}
                >
                  Edit Coupon
                </Button>
              </div>
            </div>
          </Modal>
        )}



        {/* Hard Delete Confirmation Modal */}
        {showHardDeleteModal && (
          <Modal
            isOpen={showHardDeleteModal}
            onClose={() => setShowHardDeleteModal(false)}
            title="Confirm Permanent Deletion"
          >
            <div>
              <p className="text-gray-600 mb-4">Are you sure you want to permanently delete this coupon? This action cannot be undone.</p>
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHardDeleteModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={confirmHardDeleteCoupon}
                  leftIcon={<Trash2 className="w-4 h-4" />}
                >
                  Delete
                </Button>
              </div>
            </div>
          </Modal>
        )}

      </div>
    </div>
  );
};





export default AdminCoupons;
