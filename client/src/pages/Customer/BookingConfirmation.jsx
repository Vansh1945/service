import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import axios from 'axios';
import { toast } from 'react-toastify';

const BookingConfirmation = () => {
  const { id } = useParams();
  const { token, API } = useAuth();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const res = await axios.get(`${API}/booking/user/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setBooking(res.data);
        setLoading(false);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load booking details');
        navigate('/customer/bookings');
      }
    };

    fetchBooking();
  }, [id, token, API, navigate]);

  
    if (loading) {
        return <div className="text-center py-8">Loading booking details...</div>;
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-8">
            <div className="bg-white rounded-lg shadow p-6">
                <div className="text-center mb-6">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-16 w-16 text-green-500 mx-auto"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                        />
                    </svg>
                    <h1 className="text-2xl font-bold mt-4">Booking Confirmed!</h1>
                    <p className="text-gray-600">Your booking ID: {booking._id}</p>
                </div>

                <div className="border-t pt-4 space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold">Service Details</h2>
                        <p>{booking.service.title}</p>
                        <p className="text-gray-600">{booking.service.category}</p>
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold">Date & Time</h2>
                        <p>
                            {new Date(booking.date).toLocaleDateString()} at {booking.time || 'To be confirmed'}
                        </p>
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold">Service Address</h2>
                        <p>
                            {booking.address.street}, {booking.address.city}<br />
                            {booking.address.state} - {booking.address.postalCode}
                        </p>
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold">Payment Details</h2>
                        <div className="flex justify-between">
                            <span>Service Price:</span>
                            <span>₹{booking.servicePrice.toFixed(2)}</span>
                        </div>
                        {booking.discountAmount > 0 && (
                            <div className="flex justify-between text-green-600">
                                <span>Discount:</span>
                                <span>-₹{booking.discountAmount.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold border-t mt-2 pt-2">
                            <span>Total Amount:</span>
                            <span>
                                ₹{(booking.servicePrice - booking.discountAmount).toFixed(2)}
                            </span>
                        </div>
                        <p className="mt-1">
                            Payment Method: {booking.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment'}
                        </p>
                    </div>
                </div>

                <div className="mt-6 flex justify-between">
                    <button
                        onClick={() => navigate('/customer/services')}
                        className="px-4 py-2 border rounded-lg"
                    >
                        Book Another Service
                    </button>
                    <button
                        onClick={() => navigate(`/customer/bookings/${booking._id}`)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        View Booking Details
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BookingConfirmation;