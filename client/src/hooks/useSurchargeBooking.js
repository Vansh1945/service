import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/auth';
import { resolveActiveSurcharges } from '../services/SurgeService';
import { getMergedPrice as getMergedPriceUtil } from '../utils/surge';

const useSurchargeBooking = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSurcharges, setActiveSurcharges] = useState([]);

  // Fetch active surcharges based on user location
  useEffect(() => {
    const fetchSurcharges = async () => {
      try {
        const params = {};
        if (user?.address?.lat && user?.address?.lng) {
          params.lat = user.address.lat;
          params.lng = user.address.lng;
        }
        const response = await resolveActiveSurcharges(params);
        if (response.data?.success) {
          setActiveSurcharges(response.data.data || []);
        }
      } catch (err) {
        console.error("Error fetching active surcharges:", err);
      }
    };
    fetchSurcharges();
  }, [user]);

  // Helper to get merged price (base price + active demand surge)
  const getMergedPrice = (basePrice) => {
    return getMergedPriceUtil(basePrice, activeSurcharges);
  };

  // Helper to handle booking action
  const handleBookNow = (serviceId, isActive) => {
    if (!isActive) {
      toast.error('This service is currently unavailable');
      return;
    }
    if (!user) {
      toast.info('Please login to book a service');
      navigate('/login');
      return;
    }
    navigate(`/customer/services/${serviceId}`, {
      state: { prefillBooking: location.state?.prefillBooking }
    });
  };

  return {
    activeSurcharges,
    getMergedPrice,
    handleBookNow
  };
};

export default useSurchargeBooking;
