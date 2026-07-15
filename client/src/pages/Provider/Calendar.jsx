import React, { useState, useEffect } from 'react';
import { FiCalendar, FiChevronLeft, FiChevronRight, FiClock, FiUser, FiActivity, FiDollarSign, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
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

  // Helper: Format date string YYYY-MM-DD
  const formatDateString = (d) => {
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  };

  // Filter bookings for a day
  const getBookingsForDay = (date) => {
    return bookings.filter(b => formatDateString(new Date(b.date)) === formatDateString(date));
  };

  const handleToday = () => setCurrentDate(new Date());

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (view === 'month') newDate.setMonth(newDate.getMonth() - 1);
    else if (view === 'week') newDate.setDate(newDate.getDate() - 7);
    else newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (view === 'month') newDate.setMonth(newDate.getMonth() + 1);
    else if (view === 'week') newDate.setDate(newDate.getDate() + 7);
    else newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const getMonthYearString = () => currentDate.toLocaleDateString('default', { month: 'long', year: 'numeric' });
  const getWeekRangeString = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    return `${startOfWeek.toLocaleDateString('default', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('default', { month: 'short', day: 'numeric' })}, ${currentDate.getFullYear()}`;
  };
  const getDayString = () => currentDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  // Map booking status and type to semantic colors
  const getIndicatorColor = (b) => {
    if (b.status?.toLowerCase() === 'completed') return 'bg-neutral-400';
    switch (b.bookingType) {
      case 'emergency': return 'bg-accent'; // Orange
      case 'instant': return 'bg-info'; // Blue
      default: return 'bg-success'; // Green (Scheduled)
    }
  };

  // Month View Grid Calculation
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(<div key={`empty-${i}`} className="h-10 sm:h-14 border border-neutral-100/50 bg-neutral-50/10" />);
    }

    for (let day = 1; day <= totalDays; day++) {
      const thisDate = new Date(year, month, day);
      const dayBookings = getBookingsForDay(thisDate);
      const isToday = formatDateString(thisDate) === formatDateString(new Date());
      const isSelected = formatDateString(thisDate) === formatDateString(selectedDate);
      const hasBookings = dayBookings.length > 0;

      days.push(
        <div
          key={`day-${day}`}
          onClick={() => setSelectedDate(thisDate)}
          className={`h-10 sm:h-14 border border-neutral-100/50 p-1 flex flex-col justify-between transition-colors overflow-hidden cursor-pointer relative ${
            isSelected 
              ? '!bg-primary text-white' 
              : hasBookings 
              ? 'bg-neutral-50/50 hover:bg-neutral-100/40' 
              : 'hover:bg-neutral-50/20'
          }`}
        >
          <div className="flex justify-between items-center w-full">
            <span
              className={`text-[10px] sm:text-xs font-bold w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center rounded-full ${
                isSelected
                  ? 'text-white'
                  : isToday
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : hasBookings
                  ? 'text-neutral-800 font-black'
                  : 'text-neutral-300 font-medium'
              }`}
            >
              {day}
            </span>
            {isToday && !isSelected && (
              <span className="w-1 h-1 rounded-full bg-primary" />
            )}
          </div>
          
          {hasBookings && (
            <div className="flex flex-wrap gap-0.5 justify-start mt-auto max-h-3 sm:max-h-5 overflow-hidden">
              {dayBookings.slice(0, 3).map(b => (
                <span 
                  key={b._id} 
                  className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${isSelected ? 'bg-white' : getIndicatorColor(b)}`} 
                />
              ))}
              {dayBookings.length > 3 && (
                <span className={`text-[8px] font-black leading-none ${isSelected ? 'text-white' : 'text-neutral-450'}`}>+</span>
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="bg-white rounded-xl border border-neutral-100 shadow-sm overflow-hidden animate-fade-in">
        <div className="grid grid-cols-7 border-b border-neutral-100 text-center bg-neutral-50/50 py-2 text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d}>
              <span className="hidden sm:inline">{d}</span>
              <span className="inline sm:hidden">{d[0]}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">{days}</div>
      </div>
    );
  };

  // Week View Layout
  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      weekDays.push(date);
    }

    return (
      <div className="bg-white rounded-xl border border-neutral-100 shadow-sm overflow-hidden animate-fade-in">
        <div className="overflow-x-auto scrollbar-none">
          <div className="min-w-[600px] md:min-w-0">
            <div className="grid grid-cols-7 border-b border-neutral-100 text-center bg-neutral-50/50 py-2">
              {weekDays.map(date => {
                const isToday = formatDateString(date) === formatDateString(new Date());
                const isSelected = formatDateString(date) === formatDateString(selectedDate);
                return (
                  <div 
                    key={date.toString()} 
                    onClick={() => setSelectedDate(date)}
                    className={`flex flex-col items-center py-1 cursor-pointer transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-neutral-50/30'}`}
                  >
                    <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
                      {date.toLocaleDateString('default', { weekday: 'short' })}
                    </span>
                    <span
                      className={`text-xs font-bold mt-1 h-5.5 w-5.5 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-primary text-white' : 'text-neutral-700'
                      } ${isSelected && !isToday ? 'border border-primary text-primary' : ''}`}
                    >
                      {date.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-7 divide-x divide-neutral-100 min-h-[220px]">
              {weekDays.map((date, idx) => {
                const dayBookings = getBookingsForDay(date);
                return (
                  <div key={idx} className="p-1 space-y-1 bg-white min-h-[220px]">
                    {dayBookings.length === 0 ? (
                      <div className="text-center text-[8px] text-neutral-300 py-6">No jobs</div>
                    ) : (
                      dayBookings.map(b => (
                        <div
                          key={b._id}
                          onClick={() => setSelectedBooking(b)}
                          className={`p-1.5 rounded-lg border border-neutral-150 cursor-pointer transition-all hover:scale-[1.02] shadow-sm text-left`}
                        >
                          <div className="text-[9px] font-bold truncate leading-tight text-neutral-800">
                            {b.services?.[0]?.service?.title || 'Job'}
                          </div>
                          <div className="text-[8px] font-bold text-neutral-400 mt-0.5">{b.time || 'Flexible'}</div>
                        </div>
                      ))
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
      <div className="bg-white rounded-xl border border-neutral-100 shadow-sm p-3 animate-fade-in text-left">
        <h2 className="text-xs font-bold text-neutral-850 mb-2">Bookings for Selected Day</h2>
        {dayBookings.length === 0 ? (
          <p className="text-[10px] text-neutral-400 py-6 text-center">No bookings scheduled</p>
        ) : (
          <div className="space-y-1.5">
            {dayBookings.map(renderJobCard)}
          </div>
        )}
      </div>
    );
  };

  // Get upcoming bookings (future ones, limit to 3)
  const getUpcomingBookings = () => {
    return bookings
      .filter(b => {
        const bDate = new Date(b.date);
        const selDate = new Date(selectedDate);
        selDate.setHours(23, 59, 59, 999);
        return bDate > selDate && b.status?.toLowerCase() !== 'completed';
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 3);
  };

  const renderJobCard = (b) => {
    const isCompleted = b.status?.toLowerCase() === 'completed';
    const typeColor = b.bookingType === 'emergency' 
      ? 'text-accent border-accent/20 bg-accent/5' 
      : b.bookingType === 'instant' 
      ? 'text-info border-info/20 bg-info/5' 
      : 'text-success border-success/20 bg-success/5';

    return (
      <div
        key={b._id}
        onClick={() => setSelectedBooking(b)}
        className="p-3 bg-white hover:bg-neutral-50/50 border border-neutral-100 rounded-xl shadow-sm cursor-pointer transition-all duration-150 flex items-center justify-between gap-3 text-left animate-fade-in"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-neutral-850 truncate">
              {b.services?.[0]?.service?.title || 'Service Job'}
            </span>
            <span className={`text-[8px] font-bold px-1.5 py-0.25 rounded border uppercase shrink-0 ${typeColor}`}>
              {b.bookingType}
            </span>
          </div>
          
          <div className="flex items-center gap-2 mt-1 text-[10px] font-semibold text-neutral-400">
            <span className="flex items-center gap-0.5">
              <FiClock className="w-3 h-3 text-neutral-300" />
              {b.time || 'Flexible'}
            </span>
            <span>•</span>
            <span className="truncate">{b.customer?.name || 'Client'}</span>
          </div>
        </div>

        <div className="text-right shrink-0 flex flex-col items-end gap-1">
          <span className="text-xs font-bold text-neutral-800">
            ₹{b.providerEarnings || b.netAmount || 0}
          </span>
          <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.25 rounded-full ${
            isCompleted ? 'bg-neutral-100 text-neutral-450' : 'bg-primary/10 text-primary'
          }`}>
            {b.status}
          </span>
        </div>
      </div>
    );
  };

  const selectedDayBookings = getBookingsForDay(selectedDate);
  const upcomingBookings = getUpcomingBookings();

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState title="Error fetching bookings" message={error} onRetry={fetchBookings} />;
  const todayBookings = getBookingsForDay(selectedDate);
  const todayJobsCount = todayBookings.length;
  const todayEarnings = todayBookings.reduce((sum, b) => sum + (b.providerEarnings || b.netAmount || 0), 0);
  const emergencyJobsCount = todayBookings.filter(b => b.bookingType === 'emergency').length;
  const upcomingJobsCount = bookings.filter(b => {
    const bDate = new Date(b.date);
    const now = new Date();
    return bDate > now && b.status?.toLowerCase() !== 'completed';
  }).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-left space-y-4">
      {/* Compact Operational Provider Summary Section */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Today's Jobs */}
        <div className="bg-white border border-neutral-100 p-3 rounded-xl shadow-sm flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <FiActivity className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] text-neutral-400 font-bold block uppercase tracking-wider leading-none">Day's Jobs</span>
            <span className="text-sm sm:text-base font-black text-neutral-800 mt-1 block leading-none">{todayJobsCount}</span>
            <span className="text-[8px] text-neutral-400 font-medium block leading-none mt-0.5">for selected day</span>
          </div>
        </div>

        {/* Today's Earnings */}
        <div className="bg-white border border-neutral-100 p-3 rounded-xl shadow-sm flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-success/10 text-success flex items-center justify-center shrink-0">
            <FiDollarSign className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] text-neutral-400 font-bold block uppercase tracking-wider leading-none">Day's Earnings</span>
            <span className="text-sm sm:text-base font-black text-success mt-1 block leading-none">₹{todayEarnings}</span>
            <span className="text-[8px] text-neutral-400 font-medium block leading-none mt-0.5">estimated</span>
          </div>
        </div>

        {/* Emergency Jobs */}
        <div className="bg-white border border-neutral-100 p-3 rounded-xl shadow-sm flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <FiAlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] text-neutral-400 font-bold block uppercase tracking-wider leading-none">Emergency Jobs</span>
            <span className="text-sm sm:text-base font-black text-danger mt-1 block leading-none">{emergencyJobsCount}</span>
            <span className="text-[8px] text-neutral-400 font-medium block leading-none mt-0.5">urgent</span>
          </div>
        </div>

        {/* Upcoming Jobs */}
        <div className="bg-white border border-neutral-100 p-3 rounded-xl shadow-sm flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-info/10 text-info flex items-center justify-center shrink-0">
            <FiCheckCircle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] text-neutral-400 font-bold block uppercase tracking-wider leading-none">Upcoming Jobs</span>
            <span className="text-sm sm:text-base font-black text-primary mt-1 block leading-none">{upcomingJobsCount}</span>
            <span className="text-[8px] text-neutral-400 font-medium block leading-none mt-0.5">scheduled ahead</span>
        </div>
      </div>

      </div>

      {/* Header Controller */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-neutral-100 shadow-sm">
        <h1 className="text-md sm:text-lg font-bold text-neutral-800 flex items-center gap-1.5">
          <FiCalendar className="text-primary" />
          <span>Job Calendar</span>
        </h1>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Month / Week / Day view selectors */}
          <div className="flex items-center bg-neutral-50 border border-neutral-100 rounded-lg p-0.5">
            {['month', 'week', 'day'].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase transition-all ${
                  view === v ? 'bg-primary text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Month Navigator */}
          <div className="flex items-center gap-0.5 bg-neutral-50 border border-neutral-100 rounded-lg p-0.5 text-[10px] font-bold">
            <button onClick={handlePrev} className="p-1 text-neutral-500 hover:bg-neutral-100 rounded">
              <FiChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleToday} className="px-2 py-0.5 text-neutral-600 hover:bg-neutral-100 rounded uppercase">
              Today
            </button>
            <button onClick={handleNext} className="p-1 text-neutral-500 hover:bg-neutral-100 rounded">
              <FiChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Date Banner Title */}
      <div className="mb-4 bg-primary/5 border border-primary/10 rounded-lg py-1.5 px-3 inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
        <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
          {view === 'month' && getMonthYearString()}
          {view === 'week' && getWeekRangeString()}
          {view === 'day' && getDayString()}
        </span>
      </div>

      {/* Responsive layout: Grid where Calendar takes 60% and Job List takes 40% on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-5 items-start">
        
        {/* Calendar Grid Container (Col span 6) */}
        <div className="lg:col-span-6 space-y-3.5">
          {view === 'month' && renderMonthView()}
          {view === 'week' && renderWeekView()}
          {view === 'day' && renderDayView()}

          {/* Compact Legend */}
          <div className="flex flex-wrap items-center gap-3 mt-1.5 px-1 text-[9px] font-bold text-neutral-450 uppercase tracking-wider">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" /> Scheduled</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-info" /> Instant</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent" /> Emergency</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-neutral-400" /> Completed</span>
          </div>
        </div>

        {/* Selected & Upcoming Job Lists Container (Col span 4) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Selected Date List */}
          <div className="bg-neutral-50/30 rounded-xl border border-neutral-100 p-3 space-y-2">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-1.5">
              <h3 className="text-[10px] font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>Selected Date Jobs</span>
              </h3>
              <span className="text-[10px] font-bold text-neutral-500">
                {selectedDate.toLocaleDateString('default', { month: 'short', day: 'numeric' })}
              </span>
            </div>

            {selectedDayBookings.length === 0 ? (
              <div className="py-6 text-center bg-white rounded-lg border border-dashed border-neutral-100">
                <p className="text-[10px] text-neutral-400 font-semibold">No bookings today</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-0.5 scrollbar-thin">
                {selectedDayBookings.map(renderJobCard)}
              </div>
            )}
          </div>

          {/* Upcoming Jobs */}
          <div className="bg-neutral-50/30 rounded-xl border border-neutral-100 p-3 space-y-2">
            <h3 className="text-[10px] font-bold text-neutral-755 uppercase tracking-wider flex items-center gap-1 border-b border-neutral-100 pb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              <span>Upcoming Bookings</span>
            </h3>

            {upcomingBookings.length === 0 ? (
              <div className="py-6 text-center bg-white rounded-lg border border-dashed border-neutral-100">
                <p className="text-[10px] text-neutral-400 font-semibold">No upcoming bookings</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-0.5 scrollbar-thin">
                {upcomingBookings.map(renderJobCard)}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Redesigned Light Job Details Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-900/5 animate-fade-in">
          <div className="bg-white rounded-xl max-w-md w-full overflow-hidden shadow-xl border border-neutral-100 animate-scale-up text-left">
            
            {/* Header */}
            <div className="px-4 py-3.5 border-b border-neutral-100 flex items-center justify-between">
              <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                selectedBooking.bookingType === 'emergency' ? 'bg-accent/10 text-accent' : 
                (selectedBooking.bookingType === 'instant' ? 'bg-info/10 text-info' : 'bg-success/10 text-success')
              }`}>
                {selectedBooking.bookingType} booking
              </span>
              <button 
                onClick={() => setSelectedBooking(null)}
                className="text-neutral-400 hover:text-neutral-600 text-sm p-1 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3.5">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-neutral-850 leading-snug">
                  {selectedBooking.services?.[0]?.service?.title || 'Service Job'}
                </h3>
                <p className="text-[9px] text-neutral-400 font-semibold mt-0.5">Booking ID: {selectedBooking.bookingId || selectedBooking._id}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-neutral-50/50 p-2.5 rounded-xl border border-neutral-100/50">
                <div>
                  <span className="text-[8px] text-neutral-400 font-bold block uppercase tracking-wider">Customer</span>
                  <span className="text-xs font-bold text-neutral-800 truncate block">
                    {selectedBooking.customer?.name || 'Client'}
                  </span>
                </div>
                <div>
                  <span className="text-[8px] text-neutral-400 font-bold block uppercase tracking-wider">Time / Date</span>
                  <span className="text-xs font-bold text-neutral-800 block truncate">
                    {selectedBooking.time || 'Flexible'} ({new Date(selectedBooking.date).toLocaleDateString()})
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-neutral-50/30 p-2 rounded-lg text-center border border-neutral-100/50">
                  <span className="text-[8px] text-neutral-400 font-bold block uppercase tracking-wider">Duration</span>
                  <span className="text-[10px] font-bold text-neutral-800 block mt-0.5">
                    {selectedBooking.estimatedDuration || selectedBooking.services?.[0]?.service?.duration || 1} hrs
                  </span>
                </div>
                <div className="bg-neutral-50/30 p-2 rounded-lg text-center border border-neutral-100/50">
                  <span className="text-[8px] text-neutral-400 font-bold block uppercase tracking-wider">Status</span>
                  <span className="text-[10px] font-bold text-success capitalize block mt-0.5">
                    {selectedBooking.status}
                  </span>
                </div>
                <div className="bg-neutral-50/30 p-2 rounded-lg text-center border border-neutral-100/50">
                  <span className="text-[8px] text-neutral-400 font-bold block uppercase tracking-wider">Est. Earnings</span>
                  <span className="text-[10px] font-bold text-primary block mt-0.5">
                    ₹{selectedBooking.providerEarnings || selectedBooking.netAmount || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer with Sticky Action Button */}
            <div className="bg-neutral-50/50 px-4 py-3 border-t border-neutral-100 flex justify-end">
              <button
                onClick={() => setSelectedBooking(null)}
                className="w-full sm:w-auto px-4 py-2 bg-primary hover:bg-primary/95 text-white rounded-lg text-xs font-bold transition-colors text-center"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
