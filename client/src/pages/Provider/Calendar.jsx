import React, { useState, useEffect } from 'react';
import { FiCalendar, FiChevronLeft, FiChevronRight, FiClock, FiUser, FiInfo, FiDollarSign, FiZap, FiAlertTriangle } from 'react-icons/fi';
import axiosInstance from '../../api/axiosInstance';
import LoadingSpinner from '../../components/ui-skeletons/Loader';
import ErrorState from '../../components/Error';

const Calendar = () => {
  const [view, setView] = useState('month'); // 'month' | 'week' | 'day'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get('/booking/provider/status/all?limit=1000');
      if (res.data.success) {
        setBookings(res.data.data || []);
      } else {
        setError(res.data.message || 'Failed to fetch bookings');
      }
    } catch (err) {
      console.error(err);
      setError('Error loading bookings for calendar');
    } finally {
      setLoading(false);
    }
  };

  // Helper: Get start of day
  const startOfDay = (d) => {
    const newD = new Date(d);
    newD.setHours(0, 0, 0, 0);
    return newD;
  };

  // Helper: Format date string YYYY-MM-DD
  const formatDateString = (d) => {
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  };

  // Filter bookings for a specific day
  const getBookingsForDay = (date) => {
    return bookings.filter(b => {
      const bDate = new Date(b.date);
      return formatDateString(bDate) === formatDateString(date);
    });
  };

  // Navigation handlers
  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (view === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (view === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  // Date formatting helpers
  const getMonthYearString = () => {
    return currentDate.toLocaleDateString('default', { month: 'long', year: 'numeric' });
  };

  const getWeekRangeString = () => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);

    const options = { month: 'short', day: 'numeric' };
    return `${startOfWeek.toLocaleDateString('default', options)} - ${endOfWeek.toLocaleDateString('default', options)}, ${currentDate.getFullYear()}`;
  };

  const getDayString = () => {
    return currentDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Render helpers
  const getBookingColor = (type) => {
    switch (type) {
      case 'emergency':
        return {
          bg: 'bg-red-50 hover:bg-red-100',
          border: 'border-red-200',
          text: 'text-red-700',
          badge: 'bg-red-500 text-white'
        };
      case 'instant':
        return {
          bg: 'bg-emerald-50 hover:bg-emerald-100',
          border: 'border-emerald-200',
          text: 'text-emerald-700',
          badge: 'bg-emerald-500 text-white'
        };
      default:
        return {
          bg: 'bg-blue-50 hover:bg-blue-100',
          border: 'border-blue-200',
          text: 'text-blue-700',
          badge: 'bg-blue-500 text-white'
        };
    }
  };

  // Month View Grid Calculation
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days = [];
    // Empty slots for preceding month
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(<div key={`empty-${i}`} className="h-16 sm:h-28 border border-gray-100 bg-gray-50/50" />);
    }

    // Days of the month
    for (let day = 1; day <= totalDays; day++) {
      const thisDate = new Date(year, month, day);
      const dayBookings = getBookingsForDay(thisDate);
      const isToday = formatDateString(thisDate) === formatDateString(new Date());
      const isSelected = formatDateString(thisDate) === formatDateString(selectedDate);

      days.push(
        <div
          key={`day-${day}`}
          onClick={() => setSelectedDate(thisDate)}
          className={`h-16 sm:h-28 border border-gray-100 p-1 sm:p-2 flex flex-col justify-between transition-colors overflow-hidden cursor-pointer ${
            isToday ? 'bg-indigo-50/30' : 'bg-white'
          } ${
            isSelected ? 'ring-2 ring-primary ring-inset' : ''
          }`}
        >
          <div className="flex justify-between items-center mb-0.5 sm:mb-1">
            <span
              className={`text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded-full ${
                isToday
                  ? 'bg-primary text-white'
                  : 'text-gray-700'
              }`}
            >
              {day}
            </span>
            {dayBookings.length > 0 && (
              <span className="hidden sm:inline text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">
                {dayBookings.length} {dayBookings.length === 1 ? 'job' : 'jobs'}
              </span>
            )}
          </div>
          
          {/* Desktop View Bookings */}
          <div className="hidden sm:block flex-1 overflow-y-auto space-y-1 scrollbar-none pr-1">
            {dayBookings.map(b => {
              const colors = getBookingColor(b.bookingType);
              return (
                <div
                  key={b._id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedBooking(b);
                  }}
                  className={`text-[10px] p-1.5 rounded-lg border ${colors.bg} ${colors.border} ${colors.text} font-semibold truncate cursor-pointer transition-all duration-200 shadow-sm`}
                >
                  <span className="mr-1">{b.time || '00:00'}</span>
                  <span>{b.services?.[0]?.service?.title || 'Electrical Job'}</span>
                </div>
              );
            })}
          </div>

          {/* Mobile View Bookings (Dots indicator) */}
          <div className="flex sm:hidden justify-center gap-0.5 mt-auto">
            {dayBookings.slice(0, 3).map(b => {
              const colors = getBookingColor(b.bookingType);
              return (
                <span 
                  key={b._id} 
                  className={`w-1.5 h-1.5 rounded-full ${
                    b.bookingType === 'emergency' ? 'bg-red-500' : b.bookingType === 'instant' ? 'bg-emerald-500' : 'bg-blue-500'
                  }`} 
                />
              );
            })}
            {dayBookings.length > 3 && (
              <span className="w-1 h-1 rounded-full bg-gray-400" />
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-100 text-center bg-gray-50/50 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d}>
              <span className="hidden sm:inline">{d}</span>
              <span className="inline sm:hidden">{d[0]}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days}
        </div>
      </div>
    );
  };

  // Week View Layout
  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      weekDays.push(date);
    }

    return (
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto scrollbar-none">
          <div className="min-w-[640px] md:min-w-0">
            <div className="grid grid-cols-7 border-b border-gray-100 text-center bg-gray-50/50 py-4">
              {weekDays.map(date => {
                const isToday = formatDateString(date) === formatDateString(new Date());
                return (
                  <div key={date.toString()} className="flex flex-col items-center">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      {date.toLocaleDateString('default', { weekday: 'short' })}
                    </span>
                    <span
                      className={`text-sm font-extrabold mt-1 h-7 w-7 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-primary text-white' : 'text-secondary'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-7 divide-x divide-gray-100 min-h-[400px]">
              {weekDays.map((date, idx) => {
                const dayBookings = getBookingsForDay(date);
                return (
                  <div key={idx} className="p-2 space-y-2 bg-white min-h-[400px]">
                    {dayBookings.length === 0 ? (
                      <div className="text-center text-[10px] text-gray-300 py-10">No jobs</div>
                    ) : (
                      dayBookings.map(b => {
                        const colors = getBookingColor(b.bookingType);
                        return (
                          <div
                            key={b._id}
                            onClick={() => setSelectedBooking(b)}
                            className={`p-2.5 rounded-2xl border ${colors.bg} ${colors.border} ${colors.text} cursor-pointer transition-all duration-200 hover:-translate-y-0.5 shadow-sm`}
                          >
                            <div className="flex items-center gap-1 text-[10px] font-bold">
                              <FiClock className="w-3 h-3" />
                              <span>{b.time || 'Anytime'}</span>
                            </div>
                            <div className="text-xs font-extrabold mt-1.5 line-clamp-2 leading-snug">
                              {b.services?.[0]?.service?.title || 'Service Job'}
                            </div>
                            <div className="text-[9px] font-bold bg-white/60 inline-block px-1.5 py-0.5 rounded-full mt-2">
                              ₹{b.providerEarnings || b.netAmount || 0}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Day View Layout
  const renderDayView = () => {
    const dayBookings = getBookingsForDay(currentDate);

    return (
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-bold text-secondary mb-4">Bookings scheduled for today</h2>
        {dayBookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 mb-4">
              <FiCalendar className="w-8 h-8" />
            </div>
            <p className="text-gray-400 font-semibold">No bookings scheduled for this date</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dayBookings.map(b => {
              const colors = getBookingColor(b.bookingType);
              return (
                <div
                  key={b._id}
                  onClick={() => setSelectedBooking(b)}
                  className={`flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl border ${colors.bg} ${colors.border} cursor-pointer transition-all duration-200 hover:scale-[1.01] shadow-sm`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl border border-gray-100 flex flex-col items-center justify-center font-bold text-secondary">
                      <span className="text-xs text-gray-400">TIME</span>
                      <span className="text-xs">{b.time || 'COD'}</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-secondary">
                        {b.services?.[0]?.service?.title || 'Service Job'}
                      </h4>
                      <p className="text-xs text-gray-500 font-semibold flex items-center gap-1.5 mt-1">
                        <FiUser className="w-3.5 h-3.5" />
                        <span>{b.customer?.name || 'Customer'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-3 md:mt-0 justify-between md:justify-end">
                    <span className={`text-[10px] uppercase tracking-wider font-extrabold px-3 py-1 rounded-full ${colors.badge}`}>
                      {b.bookingType}
                    </span>
                    <div className="text-right">
                      <div className="text-sm font-extrabold text-secondary">
                        ₹{b.providerEarnings || b.netAmount || 0}
                      </div>
                      <span className="text-[10px] text-gray-400 font-semibold">Est. Earning</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState title="Error fetching bookings" message={error} onRetry={fetchBookings} />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Calendar Header / Controller */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-secondary flex items-center gap-2">
            <FiCalendar className="text-primary" />
            <span>Job Calendar</span>
          </h1>
          <p className="text-gray-400 text-sm font-semibold mt-1">Manage and view your assigned jobs</p>
        </div>

        {/* Navigation & Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white border border-gray-100 rounded-2xl p-1 shadow-sm">
            <button
              onClick={() => setView('month')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                view === 'month' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                view === 'week' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setView('day')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                view === 'day' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              Day
            </button>
          </div>

          <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-2xl p-1 shadow-sm">
            <button
              onClick={handlePrev}
              className="p-2 text-gray-500 hover:bg-gray-50 rounded-xl"
            >
              <FiChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 rounded-xl"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="p-2 text-gray-500 hover:bg-gray-50 rounded-xl"
            >
              <FiChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Date Title */}
      <div className="mb-6 bg-white border border-gray-100 rounded-2xl py-3 px-5 inline-block shadow-sm">
        <span className="text-sm font-extrabold text-secondary">
          {view === 'month' && getMonthYearString()}
          {view === 'week' && getWeekRangeString()}
          {view === 'day' && getDayString()}
        </span>
      </div>

      {/* Views */}
      {view === 'month' && (
        <>
          {renderMonthView()}
          {/* Mobile Agenda View below month grid */}
          <div className="block sm:hidden mt-6 bg-white rounded-3xl border border-gray-100 p-4 shadow-sm">
            <h3 className="text-sm font-bold text-secondary mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>Jobs: {selectedDate.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </h3>
            {getBookingsForDay(selectedDate).length === 0 ? (
              <p className="text-xs text-gray-400 font-semibold py-4 text-center">No bookings scheduled for this day</p>
            ) : (
              <div className="space-y-2">
                {getBookingsForDay(selectedDate).map(b => {
                  const colors = getBookingColor(b.bookingType);
                  return (
                    <div
                      key={b._id}
                      onClick={() => setSelectedBooking(b)}
                      className={`p-3 rounded-2xl border ${colors.bg} ${colors.border} cursor-pointer transition-all duration-200 shadow-sm flex items-center justify-between`}
                    >
                      <div>
                        <h4 className="text-xs font-extrabold text-secondary">{b.services?.[0]?.service?.title || 'Electrical Job'}</h4>
                        <span className="text-[10px] text-gray-500 font-semibold flex items-center gap-1 mt-1">
                          <FiClock className="w-3 h-3" /> {b.time || 'Flexible'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-extrabold text-secondary block">₹{b.providerEarnings || b.netAmount || 0}</span>
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-gray-400">{b.bookingType}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
      {view === 'week' && renderWeekView()}
      {view === 'day' && renderDayView()}

      {/* Booking Details Dialog Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-secondary/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100">
            {/* Modal Header */}
            <div className="bg-secondary text-white p-6 relative">
              <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full tracking-wider ${
                selectedBooking.bookingType === 'emergency' ? 'bg-red-600 text-white' : 
                (selectedBooking.bookingType === 'instant' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white')
              }`}>
                {selectedBooking.bookingType === 'emergency' ? '🚨 Emergency Booking' : 
                 (selectedBooking.bookingType === 'instant' ? '⚡ Instant Booking' : '📅 Scheduled Booking')}
              </span>
              <h3 className="text-lg font-black mt-3 leading-snug">
                {selectedBooking.services?.[0]?.service?.title || 'Service Job'}
              </h3>
              <p className="text-[11px] text-gray-300 font-semibold mt-1">ID: {selectedBooking.bookingId || selectedBooking._id}</p>
              
              <button 
                onClick={() => setSelectedBooking(null)}
                className="absolute top-6 right-6 text-gray-400 hover:text-white font-extrabold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
                    <FiCalendar className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold block uppercase">Date</span>
                    <span className="text-xs font-extrabold text-secondary">
                      {new Date(selectedBooking.date).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
                    <FiClock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold block uppercase">Time</span>
                    <span className="text-xs font-extrabold text-secondary">{selectedBooking.time || 'Flexible'}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <span className="text-[10px] text-gray-400 font-bold block uppercase mb-2">Customer & Area</span>
                <div className="flex items-center gap-3 bg-gray-50/60 p-3 rounded-2xl border border-gray-50">
                  <FiUser className="w-5 h-5 text-gray-400" />
                  <div>
                    <span className="text-xs font-extrabold text-secondary block">{selectedBooking.customer?.name || 'Client'}</span>
                    <span className="text-[10px] text-gray-500 font-semibold block">Area: {selectedBooking.address?.area || selectedBooking.address?.city || 'Not specified'}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 border-t border-gray-100 pt-4">
                <div className="bg-gray-50/60 p-3 rounded-2xl text-center border border-gray-50">
                  <FiClock className="w-4 h-4 text-primary mx-auto mb-1" />
                  <span className="text-[9px] text-gray-400 font-bold block uppercase">Duration</span>
                  <span className="text-xs font-extrabold text-secondary">
                    {selectedBooking.estimatedDuration || selectedBooking.services?.[0]?.service?.duration || 1} hrs
                  </span>
                </div>
                <div className="bg-gray-50/60 p-3 rounded-2xl text-center border border-gray-50">
                  <FiInfo className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                  <span className="text-[9px] text-gray-400 font-bold block uppercase">Status</span>
                  <span className="text-xs font-extrabold text-emerald-600 capitalize block mt-0.5">
                    {selectedBooking.status}
                  </span>
                </div>
                <div className="bg-gray-50/60 p-3 rounded-2xl text-center border border-gray-50">
                  <FiZap className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                  <span className="text-[9px] text-gray-400 font-bold block uppercase">Surge Bonus</span>
                  <span className="text-xs font-extrabold text-secondary">
                    ₹{selectedBooking.providerSurgeShare || selectedBooking.providerBonus || selectedBooking.surgeCharge || 0}
                  </span>
                </div>
              </div>

              {/* Pricing summary */}
              <div className="bg-secondary/5 rounded-3xl p-4 space-y-2 border border-secondary/5">
                <div className="flex justify-between items-center text-xs font-semibold text-gray-500">
                  <span>Commission amount</span>
                  <span>₹{selectedBooking.commissionAmount || (selectedBooking.commission && selectedBooking.commission.amount) || 0}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-semibold text-gray-500">
                  <span>Surge split share</span>
                  <span>+₹{selectedBooking.providerSurgeShare || 0}</span>
                </div>
                <div className="border-t border-secondary/10 my-2 pt-2 flex justify-between items-center text-sm font-extrabold text-secondary">
                  <span>Estimated Earnings</span>
                  <span className="text-primary text-base">
                    ₹{selectedBooking.providerEarnings || selectedBooking.netAmount || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 p-4 flex justify-end">
              <button
                onClick={() => setSelectedBooking(null)}
                className="px-5 py-2.5 bg-secondary text-white rounded-xl text-xs font-bold hover:bg-secondary/90 transition-all duration-200"
              >
                Close details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
