import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/auth';
import { useSocket } from '../../socket/SocketContext';
import axiosInstance from '../../api/axiosInstance';
import {
  MessageSquare, AlertCircle, ShieldAlert, Award,
  Check, Play, User, Phone, ArrowLeft, Send, Loader,
  TrendingUp, Activity, Inbox, Eye, Megaphone, CheckCircle, X,
  Search, Filter
} from 'lucide-react';
import { formatRelativeTime } from '../../utils/format';
import CDNImage from '../../components/CDNImage';

const AdminChatMonitor = () => {
  const { user, showToast } = useAuth();
  const { socket, isConnected } = useSocket();

  // State Management
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  // Real-time alert toast for new customer-provider chat room initiations
  const [activeAlert, setActiveAlert] = useState(null);

  // Ref to ensure socket listeners always see the freshest selected room
  const selectedRoomRef = useRef(null);
  useEffect(() => {
    selectedRoomRef.current = selectedRoom;
  }, [selectedRoom]);

  const messagesEndRef = useRef(null);

  // 1. Fetch Active Chat Rooms on Mount
  const fetchRooms = async () => {
    try {
      const res = await axiosInstance.get('/chat/admin-monitor');
      if (res.data?.success) {
        setRooms(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching admin monitor rooms:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  // 2. Setup Socket Listeners
  useEffect(() => {
    if (!socket) return;

    // Join admin_live_room to listen for all active telemetry changes
    socket.emit('join-chat-room', { roomId: 'admin_live_room' });

    const handleNewMessageGlobal = (data) => {
      const currentSelected = selectedRoomRef.current;
      const isCurrentRoom = currentSelected?._id === data.roomId;

      // Update room lastMessage and unread count in sidebar
      setRooms((prev) => {
        const exists = prev.some((r) => r._id === data.roomId);
        if (!exists) {
          // If the room doesn't exist, trigger a refetch of all rooms
          fetchRooms();
          return prev;
        }

        return prev.map((r) => {
          if (r._id === data.roomId) {
            return {
              ...r,
              lastMessage: data.lastMessage,
              unreadAdmin: isCurrentRoom ? 0 : (data.unreadAdmin ?? (r.unreadAdmin + 1)),
              updatedAt: new Date()
            };
          }
          return r;
        }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      });

      // If selected room has a new message, push to messages array
      if (isCurrentRoom) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === data.message._id)) return prev;
          return [...prev, data.message];
        });

        // Auto mark seen
        socket.emit('chat-seen', { roomId: currentSelected._id });
        axiosInstance.patch('/chat/mark-seen', { roomId: currentSelected._id }).catch(err => console.warn(err));
      }
    };

    const handleSeenGlobal = (data) => {
      const currentSelected = selectedRoomRef.current;
      if (currentSelected?._id === data.roomId) {
        // If participant marked seen, update seen state for admin messages
        setMessages((prev) =>
          prev.map((m) => (m.senderRole === 'admin' ? { ...m, seen: true } : m))
        );
      }
    };

    const handleTypingGlobal = (data) => {
      const currentSelected = selectedRoomRef.current;
      if (currentSelected?._id === data.roomId) {
        setTypingUsers((prev) => ({
          ...prev,
          [data.userId]: data.isTyping
        }));
      }
    };

    const handleAdminAlert = (data) => {
      setActiveAlert(data);
      // Dynamically fetch rooms to load the new conversation into the sidebar in real-time
      fetchRooms();
      // Auto dismiss the alert toast after 6 seconds
      setTimeout(() => {
        setActiveAlert((curr) => (curr?.roomId === data.roomId ? null : curr));
      }, 6000);
    };

    socket.on('chat:new-message', handleNewMessageGlobal);
    socket.on('chat:seen', handleSeenGlobal);
    socket.on('chat:typing', handleTypingGlobal);
    socket.on('admin:alert', handleAdminAlert);

    return () => {
      socket.off('chat:new-message', handleNewMessageGlobal);
      socket.off('chat:seen', handleSeenGlobal);
      socket.off('chat:typing', handleTypingGlobal);
      socket.off('admin:alert', handleAdminAlert);
    };
  }, [socket]);

  // 3. Scroll to bottom on messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // 4. Load messages for selected room
  const handleSelectRoom = async (room) => {
    try {
      setSelectedRoom(room);
      setMessagesLoading(true);
      setMessages([]);
      setTypingUsers({});

      // Join room socket
      if (socket) {
        socket.emit('join-chat-room', { roomId: room._id });
        socket.emit('chat-seen', { roomId: room._id });
      }

      // Mark seen on backend
      await axiosInstance.patch('/chat/mark-seen', { roomId: room._id });

      // Fetch messages
      const res = await axiosInstance.get(`/chat/messages/${room._id}?limit=100`);
      if (res.data?.success) {
        setMessages(res.data.data);
      }

      // Reset local unreadAdmin count for sidebar
      setRooms((prev) =>
        prev.map((r) => (r._id === room._id ? { ...r, unreadAdmin: 0 } : r))
      );

    } catch (err) {
      console.error('Error opening thread:', err);
    } finally {
      setMessagesLoading(false);
    }
  };

  // 5. Admin Join Action
  const handleJoinChat = async () => {
    if (!selectedRoom?._id) return;
    try {
      const res = await axiosInstance.post(`/chat/admin-join/${selectedRoom._id}`);
      if (res.data?.success) {
        // Refetch booking status locally
        setSelectedRoom((prev) => ({ ...prev, adminJoined: true }));
        setRooms((prev) =>
          prev.map((r) => (r._id === selectedRoom._id ? { ...r, adminJoined: true } : r))
        );
      }
    } catch (err) {
      console.error('Error joining chat:', err);
    }
  };

  // 6. Admin Message Send
  const handleAdminSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedRoom?._id) return;

    try {
      const text = newMessage;
      setNewMessage('');

      await axiosInstance.post('/chat/send', {
        roomId: selectedRoom._id,
        messageType: 'text',
        content: text
      });

    } catch (err) {
      console.error('Error sending administrative message:', err);
    }
  };

  // 7. Warn Provider Mock Action
  const handleWarnProvider = () => {
    showToast(`⚠️ Warning dispatch issued to provider: ${selectedRoom?.providerId?.name}. Performance score holds have been applied.`, 'warning');
  };

  // 8. Resolve Complaint Mock Action
  const handleResolveComplaint = async () => {
    try {
      showToast(`✅ Dispute resolved! Chat room will be safely locked in 24 hours.`, 'success');
    } catch (err) {
      console.error(err);
    }
  };

  // 9. Resolve Ticket Mock Action for pure support chats
  const handleResolveTicket = () => {
    showToast(`✅ Support ticket resolved! Conversation remains archived for reference.`, 'success');
  };

  // ─── Analytics Metrics Calculations ───
  const activeChats = rooms.length;
  const complaintsCount = rooms.filter((r) => r.bookingId?.hasComplaint || r.status === 'complaint').length;
  const totalUnread = rooms.reduce((sum, r) => sum + (r.unreadAdmin || 0), 0);
  const interventionsCount = rooms.filter((r) => r.adminJoined).length;

  const headerDetails = selectedRoom ? (() => {
    const type = selectedRoom.roomType || 'provider_customer';
    const customerName = selectedRoom.customerId?.name || 'N/A';
    const providerName = selectedRoom.providerId?.name || 'N/A';
    const bookingIdCode = selectedRoom.bookingId?.bookingId || selectedRoom._id.slice(-8).toUpperCase();

    if (type === 'customer_admin') {
      return {
        title: `Customer Support Chat - Client: ${customerName}`,
        subtitle: `Direct support line for client-facing questions & issue resolution`,
        badgeText: 'Direct Support',
        badgeClass: 'bg-blue-100 text-blue-700 border-blue-200'
      };
    } else if (type === 'provider_admin') {
      return {
        title: `Provider Support Chat - Partner: ${providerName}`,
        subtitle: `Direct support line for partner-facing operations & platform queries`,
        badgeText: 'Partner Support',
        badgeClass: 'bg-orange-100 text-orange-700 border-orange-200'
      };
    } else if (type === 'complaint_admin') {
      return {
        title: `Complaint Resolution - Booking ID #${bookingIdCode}`,
        subtitle: `Dispute investigation: Client ${customerName} ↔ Partner ${providerName}`,
        badgeText: 'Dispute Room',
        badgeClass: 'bg-red-100 text-red-700 border-red-200'
      };
    } else {
      const providerDisplay = providerName + (selectedRoom.providerId?.providerId ? ` (${selectedRoom.providerId.providerId})` : '');
      return {
        title: `Active Overseer: Booking ID #${bookingIdCode}`,
        subtitle: `Customer: ${customerName} (Customer) | Provider: ${providerDisplay} (Provider)`,
        badgeText: selectedRoom.adminJoined ? 'Admin Injected' : 'Spy Oversight',
        badgeClass: selectedRoom.adminJoined ? 'bg-indigo-150 text-indigo-700' : 'bg-gray-150 text-gray-500'
      };
    }
  })() : null;

  const isInputLocked = selectedRoom ? (selectedRoom.roomType === 'provider_customer' || !selectedRoom.roomType) && !selectedRoom.adminJoined : false;

  // Filter conversations in real-time
  const filteredRooms = rooms.filter((room) => {
    const clientName = room.customerId?.name?.toLowerCase() || '';
    const providerName = room.providerId?.name?.toLowerCase() || '';
    const bookingId = room.bookingId?.bookingId?.toLowerCase() || '';
    const roomId = room._id?.toLowerCase() || '';
    const search = searchTerm.toLowerCase().trim();

    const matchesSearch = !search ||
      clientName.includes(search) ||
      providerName.includes(search) ||
      bookingId.includes(search) ||
      roomId.includes(search);

    if (!matchesSearch) return false;

    if (activeFilter === 'all') return true;
    if (activeFilter === 'customer_admin') return room.roomType === 'customer_admin';
    if (activeFilter === 'provider_admin') return room.roomType === 'provider_admin';
    if (activeFilter === 'complaint') {
      return room.roomType === 'complaint_admin' || room.status === 'complaint' || room.bookingId?.hasComplaint;
    }
    if (activeFilter === 'oversight') {
      return room.roomType === 'provider_customer' || !room.roomType;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6 font-sans relative">
      {/* 0. REAL-TIME ALERT TOAST */}
      {activeAlert && (
        <div className="fixed top-6 right-6 z-50 max-w-md bg-white border-l-4 border-indigo-600 rounded-xl shadow-2xl p-4 animate-in fade-in slide-in-from-top-4 duration-300 flex gap-3 items-start border border-gray-150 animate-bounce-short">
          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
            <Megaphone className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-black text-secondary uppercase tracking-wider">{activeAlert.title}</h4>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{activeAlert.message}</p>
            {activeAlert.roomId && (
              <button
                onClick={() => {
                  const targetRoom = rooms.find(r => r._id === activeAlert.roomId);
                  if (targetRoom) {
                    handleSelectRoom(targetRoom);
                  } else {
                    fetchRooms().then(() => {
                      const refreshedRoom = rooms.find(r => r._id === activeAlert.roomId);
                      if (refreshedRoom) handleSelectRoom(refreshedRoom);
                    });
                  }
                  setActiveAlert(null);
                }}
                className="mt-2 text-[10px] font-black text-indigo-600 hover:underline uppercase tracking-wider block"
              >
                View Conversation &rarr;
              </button>
            )}
          </div>
          <button
            onClick={() => setActiveAlert(null)}
            className="p-1 hover:bg-gray-150 rounded-full text-gray-400 hover:text-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. TOP ANALYTICS TILES */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Active Chats', value: activeChats, icon: MessageSquare, color: 'text-primary bg-primary/10 border-primary/20' },
          { label: 'Unresolved Complaints', value: complaintsCount, icon: ShieldAlert, color: 'text-red-600 bg-red-50 border-red-200' },
          { label: 'Admin Unread', value: totalUnread, icon: Inbox, color: totalUnread > 0 ? 'text-amber-600 bg-amber-50 border-amber-200 animate-pulse' : 'text-gray-500 bg-gray-50 border-gray-200' },
          { label: 'Interventions Injected', value: interventionsCount, icon: Award, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' }
        ].map((tile, i) => {
          const Icon = tile.icon;
          return (
            <div key={i} className="bg-white rounded-2xl p-4 border border-gray-150 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-black tracking-wider text-gray-400 mb-1">{tile.label}</p>
                <h3 className="text-xl font-black text-secondary">{tile.value}</h3>
              </div>
              <div className={`${tile.color} p-2.5 rounded-xl border`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. CORE DASHBOARD SPLIT INTERFACE */}
      <div className="flex flex-col lg:flex-row border border-gray-200 rounded-3xl overflow-hidden bg-white shadow-sm h-[600px]">
        {/* LEFT PANEL: Active chat room list (35% width) */}
        <div className={`w-full lg:w-96 border-r border-gray-200 flex flex-col h-full bg-slate-50/50 ${selectedRoom ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-4 bg-white border-b border-gray-200 shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-secondary flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-primary" /> Active Direct Conversations
              </h3>
              {filteredRooms.length !== rooms.length && (
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                  {filteredRooms.length} of {rooms.length}
                </span>
              )}
            </div>

            {/* Elegant Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search by client, provider, ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-150 focus:border-primary focus:bg-white rounded-xl text-xs outline-none transition-all placeholder-gray-400 text-secondary"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 p-0.5 hover:bg-gray-200 rounded-full text-gray-400 hover:text-secondary transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Sleek Category Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-2 px-2 scrollbar-none">
              {[
                { id: 'all', label: 'All' },
                { id: 'customer_admin', label: 'Clients' },
                { id: 'provider_admin', label: 'Partners' },
                { id: 'complaint', label: 'Disputes' },
                { id: 'oversight', label: 'Oversight' },
              ].map((tab) => {
                const isActive = activeFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFilter(tab.id)}
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all border ${isActive
                      ? 'bg-primary border-primary text-white shadow-sm'
                      : 'bg-gray-50 border-gray-150 hover:bg-gray-100 text-gray-500 hover:text-secondary'
                      }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader className="w-6 h-6 text-primary " />
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-xs italic">
                {rooms.length === 0 ? 'No active direct chat logs' : 'No conversations match your search or filter'}
              </div>
            ) : (
              filteredRooms.map((room) => {
                const customer = room.customerId || {};
                const provider = room.providerId || {};
                const booking = room.bookingId || {};
                const isSelected = selectedRoom?._id === room._id;

                let typeLabel = 'Customer ↔ Provider';
                let typeColor = 'bg-gray-150 text-gray-700 border-gray-200';

                if (room.roomType === 'customer_admin') {
                  typeLabel = 'Customer Support';
                  typeColor = 'bg-blue-100 text-blue-700 border-blue-200';
                } else if (room.roomType === 'provider_admin') {
                  typeLabel = 'Provider Support';
                  typeColor = 'bg-orange-100 text-orange-700 border-orange-200';
                } else if (room.roomType === 'complaint_admin' || room.status === 'complaint') {
                  typeLabel = 'Complaint Resolution';
                  typeColor = 'bg-red-100 text-red-700 border-red-200';
                }

                return (
                  <div
                    key={room._id}
                    onClick={() => handleSelectRoom(room)}
                    className={`p-3 rounded-2xl cursor-pointer border transition-all flex flex-col gap-2 relative overflow-hidden ${isSelected
                      ? 'bg-primary/5 border-primary shadow-sm'
                      : room.unreadAdmin > 0
                        ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300 shadow-sm border-l-4 border-l-amber-500'
                        : 'bg-white hover:bg-gray-50 border-gray-150 hover:border-gray-200 shadow-sm'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black font-mono uppercase bg-gray-100 px-2 py-0.5 border border-gray-200 text-secondary rounded">
                        {room.roomType === 'provider_admin' && provider.providerId
                          ? `#${provider.providerId}`
                          : `#${booking.bookingId || room._id.slice(-8).toUpperCase()}`
                        }
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 border text-[8px] font-black uppercase rounded-full ${typeColor}`}>
                          {typeLabel}
                        </span>
                        {room.unreadAdmin > 0 && (
                          <span className="w-5 h-5 flex items-center justify-center bg-accent text-white text-[10px] font-black rounded-full shadow-sm animate-bounce">
                            {room.unreadAdmin}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      {room.roomType !== 'provider_admin' && customer.name && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-500 font-bold">Client:</span>
                          <span className={`truncate max-w-[150px] ${room.unreadAdmin > 0 ? 'font-black text-secondary' : 'font-semibold text-secondary'}`}>{customer.name}</span>
                        </div>
                      )}
                      {room.roomType !== 'customer_admin' && provider.name && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-500 font-bold">Provider:</span>
                          <span className={`truncate max-w-[150px] ${room.unreadAdmin > 0 ? 'font-black text-secondary' : 'font-semibold text-secondary'}`}>
                            {provider.name}{provider.providerId ? ` (${provider.providerId})` : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-gray-100 pt-2 flex justify-between items-center text-[9px] text-gray-400 font-extrabold uppercase tracking-wide">
                      <span className={`truncate max-w-[200px] ${room.unreadAdmin > 0 ? 'text-secondary font-black' : 'italic'}`}>
                        {room.lastMessage ? `Last: ${room.lastMessage}` : 'No messages exchanged yet'}
                      </span>
                      <span>{formatRelativeTime(room.updatedAt)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* CENTER PANEL: Live Chat Thread oversight */}
        <div className={`flex-1 flex flex-col h-full bg-white ${selectedRoom ? 'flex' : 'hidden lg:flex'}`}>
          {selectedRoom ? (
            <>
              {/* Thread Header Control Panel */}
              <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="flex items-center gap-3 w-full md:w-auto">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setSelectedRoom(null)}
                    className="lg:hidden p-2 -ml-1 text-gray-400 hover:text-secondary rounded-full hover:bg-gray-150 transition-colors shrink-0"
                    title="Back to Conversations"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-black text-secondary">
                        {headerDetails.title}
                      </h3>
                      <span className={`px-2 py-0.5 rounded border text-[8px] font-black uppercase tracking-wider ${headerDetails.badgeClass}`}>
                        {headerDetails.badgeText}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-bold uppercase tracking-wider">
                      {headerDetails.subtitle}
                    </p>
                  </div>
                </div>

                {/* Control Action Buttons */}
                <div className="flex items-center gap-1.5 self-stretch md:self-auto justify-end">
                  {/* Direct support chats */}
                  {(selectedRoom.roomType === 'customer_admin' || selectedRoom.roomType === 'provider_admin') && (
                    <button
                      onClick={handleResolveTicket}
                      className="px-3.5 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Resolve Ticket
                    </button>
                  )}

                  {/* Complaint admin chat */}
                  {selectedRoom.roomType === 'complaint_admin' && (
                    <>
                      <button
                        onClick={handleResolveComplaint}
                        className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-xl hover:bg-emerald-700 transition-all flex items-center gap-1 shrink-0"
                      >
                        <Check className="w-3 h-3" /> Resolve Complaint
                      </button>
                      <button
                        onClick={handleWarnProvider}
                        className="px-3 py-1.5 bg-red-600 text-white text-[10px] font-bold rounded-xl hover:bg-red-700 transition-all flex items-center gap-1 shrink-0"
                      >
                        <Megaphone className="w-3 h-3" /> Warn Provider
                      </button>
                    </>
                  )}

                  {/* Customer-Provider overseer chats */}
                  {(selectedRoom.roomType === 'provider_customer' || !selectedRoom.roomType) && (
                    !selectedRoom.adminJoined ? (
                      <button
                        onClick={handleJoinChat}
                        className="px-3.5 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 animate-pulse" /> Intervene Chat
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={handleResolveComplaint}
                          className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-xl hover:bg-emerald-700 transition-all flex items-center gap-1 shrink-0"
                        >
                          <Check className="w-3 h-3" /> Resolve Complaint
                        </button>
                        <button
                          onClick={handleWarnProvider}
                          className="px-3 py-1.5 bg-red-600 text-white text-[10px] font-bold rounded-xl hover:bg-red-700 transition-all flex items-center gap-1 shrink-0"
                        >
                          <Megaphone className="w-3 h-3" /> Warn Provider
                        </button>
                      </>
                    )
                  )}
                </div>
              </div>

              {/* Messages viewport */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
                {messagesLoading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader className="w-8 h-8 text-primary " />
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isSystem = msg.messageType === 'system';
                    const isMe = msg.senderRole === 'admin';

                    if (isSystem) {
                      return (
                        <div key={msg._id || index} className="text-center py-2">
                          <span className="inline-block bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase">
                            🛡️ {msg.content}
                          </span>
                        </div>
                      );
                    }

                    // Format message label based on role
                    let label = 'User';
                    let bubbleColor = 'bg-white text-secondary border-gray-150 rounded-bl-none';
                    let alignClass = 'justify-start';

                    if (msg.senderRole === 'customer') {
                      label = 'Customer';
                      bubbleColor = 'bg-blue-50 text-blue-900 border-blue-200 rounded-bl-none';
                    } else if (msg.senderRole === 'provider') {
                      label = 'Provider';
                      bubbleColor = 'bg-emerald-50 text-emerald-950 border-emerald-200 rounded-bl-none';
                    } else if (isMe) {
                      label = 'Support Team';
                      bubbleColor = 'bg-indigo-900 text-white border-indigo-950 rounded-br-none';
                      alignClass = 'justify-end';
                    }

                    const isImage = msg.messageType === 'image' && msg.fileUrl;

                    return (
                      <div key={msg._id || index} className={`flex ${alignClass}`}>
                        <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm text-sm border flex flex-col gap-0.5 ${bubbleColor}`}>
                          <span className="text-[8px] font-black uppercase tracking-wider block opacity-70 mb-0.5">
                            {label}
                          </span>
                          {isImage ? (
                            <div className="space-y-1">
                              <CDNImage
                                src={msg.fileUrl}
                                alt="Chat attachment"
                                className="max-w-full max-h-48 object-cover rounded-lg"
                                previewable={true}
                              />
                              {msg.content && <p className="leading-relaxed break-words mt-1">{msg.content}</p>}
                            </div>
                          ) : (
                            <p className="leading-relaxed break-words">{msg.content}</p>
                          )}
                          <span className="text-[8px] mt-1 text-right block opacity-60">
                            {formatRelativeTime(msg.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Show any typing states */}
                {Object.entries(typingUsers).map(([userId, typing]) => {
                  if (!typing) return null;
                  const isProvider = selectedRoom?.providerId?._id === userId;
                  const name = isProvider ? selectedRoom?.providerId?.name : selectedRoom?.customerId?.name;

                  return (
                    <div key={userId} className="flex justify-start text-[10px] text-gray-400 italic font-bold">
                      {name} is typing...
                    </div>
                  );
                })}

                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Panel (Locked until join for customer-provider chats) */}
              <div className="p-3 bg-white border-t border-gray-200 shrink-0">
                {isInputLocked ? (
                  <div className="p-3 bg-slate-50 border border-gray-200 text-center rounded-xl text-xs text-gray-400 font-bold uppercase tracking-wider">
                    🔒 Oversight Mode Active. Intervene Chat to participate in conversation.
                  </div>
                ) : (
                  <form onSubmit={handleAdminSendMessage} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Send message or official administrative note here..."
                      className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-primary focus:bg-white rounded-xl text-sm outline-none transition-all placeholder-gray-400 text-secondary"
                    />

                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="p-3 bg-indigo-900 hover:bg-indigo-950 text-white rounded-xl transition-all shadow-md active:scale-95 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-gray-400">
              <Inbox className="w-12 h-12 opacity-30 mb-2" />
              <h3 className="font-bold text-secondary text-sm">No thread selected</h3>
              <p className="text-xs text-gray-400 mt-0.5">Select a direct conversation list on the left to monitor the chat stream.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminChatMonitor;
