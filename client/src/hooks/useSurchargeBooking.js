import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from '../components/ui/Toast';

import { useAuth } from '../context/auth';
import { resolveActiveSurcharges } from '../services/SurgeService';
import { getMergedPrice as getMergedPriceUtil } from '../utils/surge';

const useSurchargeBooking = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Fetch active surcharges based on user location via React Query
  const { data: activeSurcharges = [] } = useQuery({
    queryKey: ['activeSurcharges', user?.address?.lat, user?.address?.lng],
    queryFn: async () => {
      const params = {};
      if (user?.address?.lat && user?.address?.lng) {
        params.lat = user.address.lat;
        params.lng = user.address.lng;
      }
      const response = await resolveActiveSurcharges(params);
      return response.data?.data || [];
    },
    staleTime: 30 * 1000,
  });

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
