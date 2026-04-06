import axiosInstance from "../api/axiosInstance";

// Customer related routes
export const createBooking = (data) => {
    return axiosInstance.post("/booking/", data);
};

export const confirmBooking = (data) => {
    return axiosInstance.post("/booking/confirm", data);
};

export const updateBookingStatus = (id, data) => {
    return axiosInstance.patch(`/booking/${id}/status`, data);
};

export const getUserBookings = () => {
    return axiosInstance.get("/booking/user");
};

export const getCustomerBookings = (params) => {
    const queryString = params ? params.toString() : '';
    return axiosInstance.get(`/booking/customer?${queryString}`);
};

export const updateBookingPayment = (id, data) => {
    return axiosInstance.patch(`/booking/${id}/payment`, data);
};

export const getProviderById = (id) => {
    return axiosInstance.get(`/booking/providers/${id}`);
};

export const getServiceById = (id) => {
    return axiosInstance.get(`/booking/services/${id}`);
};

export const getBooking = (id) => {
    return axiosInstance.get(`/booking/${id}`);
};

export const cancelBooking = (id, data) => {
    return axiosInstance.patch(`/booking/bookings/${id}/cancel`, data);
};

export const userUpdateBookingDateTime = (id, data) => {
    return axiosInstance.patch(`/booking/bookings/${id}/reschedule`, data);
};



// Provider related routes
export const getProviderBookingById = (id) => {
    return axiosInstance.get(`/booking/provider-booking/${id}`);
};

export const getBookingsByStatus = (status) => {
    return axiosInstance.get(`/booking/provider/status/${status}`);
};

export const acceptBooking = (id) => {
    return axiosInstance.patch(`/booking/provider/${id}/accept`);
};

export const startBooking = (id) => {
    return axiosInstance.patch(`/booking/provider/${id}/start`);
};

export const rejectBooking = (id) => {
    return axiosInstance.patch(`/booking/provider/${id}/reject`);
};

export const completeBooking = (id) => {
    return axiosInstance.patch(`/booking/provider/${id}/complete`);
};

export const providerBookingReport = () => {
    return axiosInstance.get("/booking/provider/booking-report");
};


// Admin related routes
export const getAllBookings = () => {
    return axiosInstance.get("/booking/admin/bookings");
};

export const getBookingDetails = (id) => {
    return axiosInstance.get(`/booking/bookings/${id}`);
};

export const assignProvider = (id, data) => {
    return axiosInstance.patch(`/booking/admin/${id}/assign`, data);
};

export const deleteBooking = (id) => {
    return axiosInstance.delete(`/booking/admin/${id}`);
};

export const deleteUserBooking = (userId, bookingId) => {
    return axiosInstance.delete(`/booking/admin/user/${userId}/booking/${bookingId}`);
};

export const updateBookingDateTimeAdmin = (id, data) => {
    return axiosInstance.patch(`/booking/admin/${id}/reschedule`, data);
};

export const downloadBookingReport = () => {
    return axiosInstance.get("/booking/admin/booking-report");
};
