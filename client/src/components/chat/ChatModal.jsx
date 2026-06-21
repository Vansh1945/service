import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/auth';
import { useSocket } from '../../socket/SocketContext';
import axiosInstance from '../../api/axiosInstance';
import {
  Send, Image, X, Phone, User, Check, CheckCheck,
  Clock, MapPin, AlertCircle, Info, ShieldAlert, Loader, Headphones,
  Search, CornerUpLeft, Trash2, Copy
} from 'lucide-react';
import { formatRelativeTime } from '../../utils/format';
import CDNImage from '../CDNImage';
import { getQuickReplies } from './quickReplies';

const ChatModal = ({ bookingId, userRole, isOpen, onClose, roomType = 'provider_customer', complaintId, customerId, providerId }) => {
  const { user, showToast } = useAuth();
  const { socket } = useSocket();

  // State Management
  const [room, setRoom] = useState(null);
  const [booking, setBooking] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  
  // Advanced Features State
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const modalRef = useRef(null);
  const fileInputRef = useRef(null);

  // Helper to format lastSeen nicely
  const formatLastSeen = (dateString) => {
    if (!dateString) return 'Offline';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Offline';
    
    const now = new Date();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (date.toDateString() === now.toDateString()) {
      return `Last seen today at ${timeStr}`;
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Last seen yesterday at ${timeStr}`;
    }
    
    const dateStr = date.toLocaleDateString([], { day: 'numeric', month: 'short' });
    return `Last seen on ${dateStr} at ${timeStr}`;
  };

  // Close on ESC keypress
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 1. Fetch Room and Booking details when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchRoomAndBooking = async () => {
      try {
        setLoading(true);
        setMessages([]);
        setError('');
        setReplyToMessage(null);
        setSearchMode(false);
        setSearchQuery('');

        const isCustomerRole = userRole === 'customer';
        const bookingUrl = bookingId && (isCustomerRole
          ? `/booking/${bookingId}`
          : `/booking/provider-booking/${bookingId}`);

        // Fetch Room and Booking in parallel
        const [roomRes, bookingRes] = await Promise.all([
          axiosInstance.post('/chat/create-room', {
            bookingId,
            roomType,
            complaintId,
            customerId,
            providerId
          }),
          bookingId ? axiosInstance.get(bookingUrl).catch(err => {
            console.error('Error fetching booking details:', err);
            return { data: { success: false } };
          }) : Promise.resolve({ data: { success: false } })
        ]);

        if (roomRes.data?.success) {
          const roomData = roomRes.data.data;
          setRoom(roomData);

          // Determine other user's online status safely
          const otherUser = isCustomerRole ? roomData.providerId : roomData.customerId;
          setOtherOnline(otherUser?.isOnline || false);

          if (bookingRes.data?.success) {
            setBooking(bookingRes.data.data);
          }

          // Fetch Messages
          const messagesRes = await axiosInstance.get(`/chat/messages/${roomData._id}?limit=100`);
          if (messagesRes.data?.success) {
            setMessages(messagesRes.data.data);
          }
        }
      } catch (err) {
        console.error('Error initializing modal chat:', err);
        setError(err.response?.data?.message || 'Failed to initialize chat room');
      } finally {
        setLoading(false);
      }
    };

    fetchRoomAndBooking();
  }, [isOpen, bookingId, userRole, roomType, complaintId, customerId, providerId]);

  // 2. Real-time Socket Event Handlers
  useEffect(() => {
    if (!isOpen || !socket || !room?._id) return;

    // Join Room
    socket.emit('join-chat-room', { roomId: room._id });

    // Mark seen on connect
    socket.emit('chat-seen', { roomId: room._id });
    axiosInstance.patch('/chat/mark-seen', { roomId: room._id }).catch(err => console.warn(err));

    const handleNewMessage = (data) => {
      if (data.roomId === room._id) {
        setMessages((prev) => {
          if (prev.some(m => m._id === data.message._id)) return prev;
          return [...prev, data.message];
        });

        // Mark incoming message as seen
        if (data.message.senderId !== user?._id) {
          socket.emit('chat-seen', { roomId: room._id });
          axiosInstance.patch('/chat/mark-seen', { roomId: room._id }).catch(err => console.warn(err));
        }
      }
    };

    const handleTypingStatus = (data) => {
      if (data.roomId === room._id && data.userId !== user?._id) {
        setOtherTyping(data.isTyping);
      }
    };

    const handleSeenReceipt = (data) => {
      if (data.roomId === room._id && data.seenBy !== user?._id) {
        setMessages((prev) =>
          prev.map((msg) => (msg.senderId === user?._id ? { ...msg, seen: true, status: 'read' } : msg))
        );
      }
    };

    const handleStatusChange = (data) => {
      const isCustomerRole = userRole === 'customer';
      const otherId = isCustomerRole ? room.providerId?._id : room.customerId?._id;
      if (otherId && (data.providerId === otherId || data.userId === otherId)) {
        setOtherOnline(data.isOnline);
      }
    };

    const handleUserOnline = (data) => {
      const isCustomerRole = userRole === 'customer';
      const otherId = isCustomerRole ? room.providerId?._id : room.customerId?._id;
      if (otherId && data.userId === otherId.toString()) {
        setOtherOnline(data.isOnline);
      }
    };

    socket.on('chat:new-message', handleNewMessage);
    socket.on('chat:typing', handleTypingStatus);
    socket.on('chat:seen', handleSeenReceipt);
    socket.on('provider-status-changed', handleStatusChange);
    socket.on('chat:user-online', handleUserOnline);

    return () => {
      socket.off('chat:new-message', handleNewMessage);
      socket.off('chat:typing', handleTypingStatus);
      socket.off('chat:seen', handleSeenReceipt);
      socket.off('provider-status-changed', handleStatusChange);
      socket.off('chat:user-online', handleUserOnline);
    };
  }, [isOpen, socket, room, user, userRole]);

  // 3. Auto Scroll latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, otherTyping, isOpen]);

  // 4. Handle Typing Broadcast
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (!socket || !room?._id) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit('chat-typing', { roomId: room._id, isTyping: true });
      axiosInstance.post('/chat/typing', { roomId: room._id, isTyping: true }).catch(err => console.warn(err));
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('chat-typing', { roomId: room._id, isTyping: false });
      axiosInstance.post('/chat/typing', { roomId: room._id, isTyping: false }).catch(err => console.warn(err));
    }, 2000);
  };

  // 5. Send Message
  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || newMessage).trim();
    if (!text || !room?._id) return;

    const payload = {
      roomId: room._id,
      messageType: 'text',
      content: text,
      replyTo: replyToMessage ? replyToMessage._id : null
    };

    try {
      if (!textToSend) setNewMessage('');
      setReplyToMessage(null);

      await axiosInstance.post('/chat/send', payload);
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  // 5b. Handle Chat File Upload
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !room?._id) return;

    if (file.size > 25 * 1024 * 1024) {
      showToast("File size exceeds 25MB limit.", 'error');
      return;
    }

    try {
      setUploadingFile(true);
      const formData = new FormData();
      formData.append('file', file);

      const res = await axiosInstance.post('/chat/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res.data?.success && res.data.fileUrl) {
        await axiosInstance.post('/chat/send', {
          roomId: room._id,
          messageType: 'image',
          content: '',
          fileUrl: res.data.fileUrl,
          replyTo: replyToMessage ? replyToMessage._id : null
        });
        setReplyToMessage(null);
      }
    } catch (err) {
      console.error('Error uploading chat image:', err);
      showToast(err.response?.data?.message || 'Failed to upload image', 'error');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Copy Message Handler
  const handleCopyMessage = (text) => {
    navigator.clipboard.writeText(text);
    showToast("Message copied to clipboard", "success");
  };

  // Delete For Me Handler
  const handleDeleteMessage = async (messageId) => {
    try {
      await axiosInstance.post('/chat/delete-for-me', {
        roomId: room._id,
        messageId
      });
      setMessages(prev => prev.filter(m => m._id !== messageId));
      showToast("Message deleted for you", "success");
    } catch (err) {
      console.error("Error deleting message:", err);
      showToast("Failed to delete message", "error");
    }
  };

  // Check Lifecycle Lock (24h restriction)
  const isChatLocked = () => {
    if (!booking) return false;
    if (booking.disputeStatus === 'resolved' || booking.status === 'resolved') return true;
    if (booking.hasComplaint || booking.disputeRaised) return false;

    if (booking.status === 'completed') {
      const completedTime = booking.serviceCompletedAt || booking.completedAt || booking.updatedAt;
      if (completedTime) {
        const diffMs = Date.now() - new Date(completedTime).getTime();
        return diffMs > 24 * 60 * 60 * 1000;
      }
    }
    return false;
  };

  if (!isOpen) return null;

  // Resolve Header Details
  const isCustomer = userRole === 'customer';
  const otherParty = isCustomer ? room?.providerId : room?.customerId;
  const isPC = room?.roomType === 'provider_customer' || (!room?.roomType && room?.bookingId);

  let headerName = '';
  let statusText = '';
  let showBookingCode = false;

  const targetRoomType = room?.roomType || roomType;

  if (targetRoomType === 'provider_customer') {
    headerName = otherParty?.name || (isCustomer ? 'Provider' : 'Customer');
    statusText = otherTyping
      ? 'typing...'
      : otherOnline
        ? 'Online'
        : formatLastSeen(otherParty?.lastSeen);
    showBookingCode = true;
  } else if (targetRoomType === 'customer_admin' || targetRoomType === 'provider_admin') {
    headerName = 'Support Team';
    statusText = 'Always enabled';
  } else if (targetRoomType === 'complaint_admin') {
    headerName = 'Complaint Resolution';
    statusText = 'Admin Active';
  } else {
    headerName = otherParty?.name || (isCustomer ? 'Provider' : 'Customer');
    statusText = otherOnline ? 'Online' : formatLastSeen(otherParty?.lastSeen);
  }

  const bookingCode = booking?.bookingId || (bookingId ? bookingId.slice(-8).toUpperCase() : '');
  const isLocked = isChatLocked();
  const quickReplies = getQuickReplies(userRole, booking?.status);

  // Date separating logic & rendering helper
  let lastRenderedDate = '';
  const renderDateSeparator = (createdAt) => {
    const dateObj = new Date(createdAt);
    const dateStrOnly = dateObj.toDateString();
    if (lastRenderedDate === dateStrOnly) return null;
    
    lastRenderedDate = dateStrOnly;
    const now = new Date();
    
    let label = dateObj.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
    if (dateStrOnly === now.toDateString()) {
      label = 'Today';
    } else {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      if (dateStrOnly === yesterday.toDateString()) {
        label = 'Yesterday';
      }
    }

    return (
      <div className="flex justify-center my-3 shrink-0">
        <span className="bg-gray-200/80 backdrop-blur-sm text-gray-600 px-3 py-0.5 rounded-full text-[10px] font-semibold tracking-wide">
          {label}
        </span>
      </div>
    );
  };

  // Client side message filtering
  const filteredMessages = searchQuery.trim()
    ? messages.filter(msg => msg.content && msg.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  // Highlight matches
  const highlightText = (text, query) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() 
            ? <mark key={i} className="bg-yellow-200 text-black px-0.5 rounded">{part}</mark>
            : part
        )}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-end md:items-center justify-center md:justify-end">
      {/* Backdrop overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
      />

      {/* Main chat window container */}
      <div
        ref={modalRef}
        className="relative z-10 bg-white/95 backdrop-blur-md flex flex-col shadow-2xl border border-gray-150 transition-all duration-300 ease-out transform
          w-full h-[80vh] rounded-t-2xl md:mr-6 md:mb-6 md:w-96 md:h-[580px] md:rounded-2xl"
      >
        {/* HEADER PANEL */}
        <div className="flex flex-col bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 shrink-0 rounded-t-2xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                {isPC && otherParty?.profilePicUrl ? (
                  <img
                    src={otherParty.profilePicUrl}
                    alt={headerName}
                    className="w-9 h-9 rounded-full object-cover border-2 border-white ring-2 ring-primary/10"
                  />
                ) : ['customer_admin', 'provider_admin', 'complaint_admin'].includes(targetRoomType) ? (
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <Headphones className="w-4.5 h-4.5" />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <User className="w-4.5 h-4.5" />
                  </div>
                )}
                {isPC && (
                  <span className={`w-2.5 h-2.5 rounded-full absolute -bottom-0.5 -right-0.5 border-2 border-white ${otherOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                )}
              </div>
              <div>
                <h3 className="text-xs font-bold text-secondary">{headerName}</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${isPC && otherOnline ? 'text-green-600' : 'text-gray-400'}`}>
                    {statusText}
                  </span>
                  {showBookingCode && (
                    <>
                      <span className="text-gray-300 text-[10px]">•</span>
                      <span className="text-[9px] text-gray-400 font-mono font-bold">Booking: #{bookingCode}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSearchMode(!searchMode)}
                className={`p-1.5 rounded-full transition-colors ${searchMode ? 'bg-primary/10 text-primary' : 'hover:bg-gray-100 text-gray-400'}`}
                title="Search Messages"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
              {isPC && otherParty?.phone && !isLocked && (
                <a href={`tel:${otherParty.phone}`} className="p-1.5 bg-primary/5 hover:bg-primary/10 rounded-full text-primary transition-colors">
                  <Phone className="w-3.5 h-3.5" />
                </a>
              )}
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Inline Search Bar */}
          {searchMode && (
            <div className="flex items-center gap-2 mt-2 bg-gray-100/80 px-2 py-1 rounded-lg">
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Search text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-xs w-full text-secondary"
                autoFocus
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* MESSAGES THREAD VIEWPORT */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader className="w-6 h-6 text-primary mb-2 animate-spin" />
              <p className="text-xs text-gray-400 font-medium">Securing communication line...</p>
            </div>
          ) : error ? (
            <div className="text-center py-10 px-4 space-y-2">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
              <p className="text-xs text-gray-500">{error}</p>
            </div>
          ) : (
            <>
              {isLocked && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-800 shrink-0">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Conversation Closed</p>
                    <p className="mt-0.5 leading-relaxed">This chat room is archived. You can no longer send messages.</p>
                  </div>
                </div>
              )}

              {filteredMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
                  <Info className="w-6 h-6 opacity-30 mb-1.5" />
                  <p className="text-[11px] font-bold">No messages found.</p>
                </div>
              ) : (
                filteredMessages.map((msg, index) => {
                  const isMe = msg.senderId === user?._id || msg.senderRole === userRole;
                  const isSystem = msg.messageType === 'system';

                  if (isSystem) {
                    return (
                      <div key={msg._id || index} className="text-center py-1.5 shrink-0">
                        <span className="inline-block bg-gray-150 border border-gray-200 text-gray-500 px-3 py-1 rounded-full text-[9px] font-bold tracking-wide uppercase shadow-sm">
                          {msg.content}
                        </span>
                      </div>
                    );
                  }

                  const isImage = msg.messageType === 'image' && msg.fileUrl;
                  const parentMsg = msg.replyTo ? messages.find(m => m._id === msg.replyTo) : null;

                  return (
                    <div key={msg._id || index} className="flex flex-col">
                      {renderDateSeparator(msg.createdAt)}

                      <div
                        className={`flex items-center group relative ${isMe ? 'justify-end' : 'justify-start'}`}
                        onMouseEnter={() => setHoveredMessageId(msg._id)}
                        onMouseLeave={() => setHoveredMessageId(null)}
                      >
                        {/* Message Options Hover Overlay */}
                        {!isLocked && hoveredMessageId === msg._id && (
                          <div className={`absolute top-0 z-20 flex items-center gap-1 bg-white/95 backdrop-blur-sm border border-gray-200 shadow-lg rounded-lg p-1 transition-all ${
                            isMe ? 'right-full mr-2' : 'left-full ml-2'
                          }`}>
                            <button
                              onClick={() => setReplyToMessage(msg)}
                              className="p-1 hover:bg-gray-100 text-gray-500 hover:text-primary rounded transition-colors"
                              title="Reply"
                            >
                              <CornerUpLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleCopyMessage(msg.content)}
                              className="p-1 hover:bg-gray-100 text-gray-500 hover:text-primary rounded transition-colors"
                              title="Copy"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteMessage(msg._id)}
                              className="p-1 hover:bg-gray-100 text-red-500 hover:bg-red-50 rounded transition-colors"
                              title="Delete For Me"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        <div className={`max-w-[75%] rounded-xl px-3 py-2 shadow-sm text-xs border ${isMe
                          ? 'bg-primary text-white border-primary/10 rounded-br-none'
                          : 'bg-white text-secondary border-gray-150 rounded-bl-none'
                          }`}>
                          {/* Replied Quoted Message Box */}
                          {parentMsg && (
                            <div className={`mb-1.5 p-1.5 rounded text-[10px] border-l-4 ${
                              isMe ? 'bg-primary-dark/30 border-white/50 text-white/90' : 'bg-gray-100 border-primary text-gray-600'
                            }`}>
                              <span className="font-bold block text-[9px] mb-0.5">
                                {parentMsg.senderId === user?._id ? 'You' : headerName}
                              </span>
                              <span className="truncate block">{parentMsg.content || '[Attachment]'}</span>
                            </div>
                          )}

                          {isImage ? (
                            <div className="space-y-1">
                              <CDNImage
                                src={msg.fileUrl}
                                alt="Chat attachment"
                                className="max-w-full max-h-48 object-cover rounded-lg"
                                previewable={true}
                              />
                              {msg.content && <p className="leading-relaxed break-words mt-1">{highlightText(msg.content, searchQuery)}</p>}
                            </div>
                          ) : (
                            <p className="leading-relaxed break-words">{highlightText(msg.content, searchQuery)}</p>
                          )}
                          <div className={`flex items-center gap-1 mt-1 justify-end text-[8px] ${isMe ? 'text-white/70' : 'text-gray-400'}`}>
                            <span>{formatRelativeTime(msg.createdAt)}</span>
                            {isMe && (
                              msg.status === 'read' || msg.seen ? (
                                <CheckCheck className="w-3 h-3 text-sky-300" />
                              ) : msg.status === 'delivered' || msg.delivered ? (
                                <CheckCheck className="w-3 h-3 text-white/60" />
                              ) : msg.status === 'sending' ? (
                                <Clock className="w-2.5 h-2.5 text-white/50 animate-pulse" />
                              ) : (
                                <Check className="w-3 h-3 text-white/50" />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {otherTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 text-gray-400 rounded-xl rounded-bl-none px-3 py-2 shadow-sm flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* QUICK ACTION BUBBLES */}
        {!isLocked && !loading && !error && (
          <div className="px-3 py-2 bg-slate-50/50 border-t border-gray-100 flex flex-wrap items-center gap-2 shrink-0">
            {quickReplies.map((reply) => (
              <button
                key={reply}
                onClick={() => handleSendMessage(reply)}
                className="px-3 py-1 bg-white hover:bg-primary/5 text-slate-700 hover:text-primary border border-slate-200 hover:border-primary/50 text-xs font-semibold rounded-full shadow-sm hover:shadow transition-all duration-200 active:scale-95"
              >
                {reply}
              </button>
            ))}
          </div>
        )}

        {/* Reply Quoted Preview Bar */}
        {replyToMessage && (
          <div className="px-3 py-1.5 bg-gray-100 border-t border-gray-200 flex items-center justify-between shrink-0">
            <div className="border-l-4 border-primary pl-2 text-[10px] text-gray-600 truncate">
              <span className="font-bold block text-[9px] text-primary">
                Replying to {replyToMessage.senderId === user?._id ? 'yourself' : headerName}
              </span>
              <span>{replyToMessage.content || '[Attachment]'}</span>
            </div>
            <button onClick={() => setReplyToMessage(null)} className="text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* TEXT INPUT CONTROLLER */}
        <div className="p-2 bg-white border-t border-gray-200 shrink-0 rounded-b-2xl">
          {isLocked ? (
            <div className="flex items-center justify-center p-2 bg-gray-50 rounded-xl border border-gray-150">
              <ShieldAlert className="w-3.5 h-3.5 text-gray-400 mr-1.5" />
              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Chat Archived</span>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-1.5"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/jpeg,image/png,image/jpg,image/heic,image/heif"
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile || loading || error}
                className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-secondary border border-gray-200 rounded-xl transition-colors shrink-0 disabled:opacity-50"
                title="Send Image"
              >
                {uploadingFile ? (
                  <Loader className="w-3.5 h-3.5 text-primary animate-spin" />
                ) : (
                  <Image className="w-3.5 h-3.5" />
                )}
              </button>

              <input
                type="text"
                value={newMessage}
                onChange={handleInputChange}
                disabled={loading || error}
                placeholder="Type message..."
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 focus:border-primary focus:bg-white rounded-xl text-xs outline-none transition-all placeholder-gray-400 text-secondary"
              />

              <button
                type="submit"
                disabled={!newMessage.trim() || loading || error}
                className="p-2 bg-primary hover:bg-primary/95 text-white rounded-xl transition-all shadow-md active:scale-95 disabled:bg-gray-150 disabled:text-gray-400 disabled:shadow-none shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatModal;
