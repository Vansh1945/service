import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/auth';
import { useSocket } from '../../socket/SocketContext';
import axiosInstance from '../../api/axiosInstance';
import {
  Send, Image, X, Phone, User, Check, CheckCheck,
  Clock, MapPin, AlertCircle, Info, ShieldAlert, Loader
} from 'lucide-react';
import { formatRelativeTime } from '../../utils/format';
import CDNImage from '../CDNImage';

const ChatModal = ({ bookingId, role, isOpen, onClose, roomType = 'provider_customer', complaintId, customerId, providerId }) => {
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

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const modalRef = useRef(null);
  const fileInputRef = useRef(null);


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

        const isCustomerRole = role === 'customer';
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
  }, [isOpen, bookingId, role, roomType, complaintId, customerId, providerId]);

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
          prev.map((msg) => (msg.senderId === user?._id ? { ...msg, seen: true } : msg))
        );
      }
    };

    const handleStatusChange = (data) => {
      const isCustomerRole = role === 'customer';
      const otherId = isCustomerRole ? room.providerId?._id : room.customerId?._id;
      if (otherId && (data.providerId === otherId || data.userId === otherId)) {
        setOtherOnline(data.isOnline);
      }
    };

    socket.on('chat:new-message', handleNewMessage);
    socket.on('chat:typing', handleTypingStatus);
    socket.on('chat:seen', handleSeenReceipt);
    socket.on('provider-status-changed', handleStatusChange);

    return () => {
      socket.off('chat:new-message', handleNewMessage);
      socket.off('chat:typing', handleTypingStatus);
      socket.off('chat:seen', handleSeenReceipt);
      socket.off('provider-status-changed', handleStatusChange);
    };
  }, [isOpen, socket, room, user, role]);

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

    try {
      if (!textToSend) setNewMessage('');

      await axiosInstance.post('/chat/send', {
        roomId: room._id,
        messageType: 'text',
        content: text
      });

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
          fileUrl: res.data.fileUrl
        });
      }
    } catch (err) {
      console.error('Error uploading chat image:', err);
      showToast(err.response?.data?.message || 'Failed to upload image', 'error');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 6. Check Lifecycle Lock (24h restriction)
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
  const isCustomer = role === 'customer';
  const otherParty = isCustomer ? room?.providerId : room?.customerId;
  const isPC = room?.roomType === 'provider_customer' || (!room?.roomType && room?.bookingId);

  let headerName = '';
  let statusText = '';
  let showBookingCode = false;

  const targetRoomType = room?.roomType || roomType;

  if (targetRoomType === 'provider_customer') {
    headerName = otherParty?.name || (isCustomer ? 'Provider' : 'Customer');
    statusText = otherTyping ? 'typing...' : otherOnline ? 'Online' : 'Offline';
    showBookingCode = true;
  } else if (targetRoomType === 'customer_admin') {
    headerName = 'Admin Support';
    statusText = 'Always enabled';
  } else if (targetRoomType === 'provider_admin') {
    headerName = 'Admin Support';
    statusText = 'Always enabled';
  } else if (targetRoomType === 'complaint_admin') {
    headerName = 'Complaint Resolution';
    statusText = 'Admin Active';
  } else {
    headerName = otherParty?.name || (isCustomer ? 'Provider' : 'Customer');
    statusText = otherOnline ? 'Online' : 'Offline';
  }

  const bookingCode = booking?.bookingId || (bookingId ? bookingId.slice(-8).toUpperCase() : '');
  const isLocked = isChatLocked();

  const getFilteredQuickReplies = () => {
    const status = booking?.status || 'pending';
    if (isCustomer) {
      // Customer
      if (status === 'completed') {
        return ['Call me'];
      }
      if (status === 'pending') {
        return ['Call me'];
      }
      return ['Gate open', 'Call me', 'Reached home'];
    } else {
      // Provider
      let list = ['Arriving in 10 min', 'Reached location', 'Work started', 'Need response'];
      if (status === 'completed') {
        return ['Need response'];
      }
      if (status === 'pending') {
        return ['Need response'];
      }
      if (['accepted', 'confirmed'].includes(status)) {
        list = list.filter(r => r !== 'Work started');
      }
      return list;
    }
  };
  const quickReplies = getFilteredQuickReplies();

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
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 shrink-0 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="relative">
              {isPC && otherParty?.profilePicUrl ? (
                <img
                  src={otherParty.profilePicUrl}
                  alt={headerName}
                  className="w-9 h-9 rounded-full object-cover border-2 border-white ring-2 ring-primary/10"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                  {headerName.charAt(0)}
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

        {/* MESSAGES THREAD VIEWPORT */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader className="w-6 h-6 text-primary animate-spin mb-2" />
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
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-800">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Conversation Closed</p>
                    <p className="mt-0.5 leading-relaxed">This chat room is archived. You can no longer send messages.</p>
                  </div>
                </div>
              )}

              {messages.length === 0 ? (
                targetRoomType === 'customer_admin' || targetRoomType === 'provider_admin' ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
                    <Info className="w-8 h-8 text-primary opacity-40 mb-2" />
                    <p className="text-[12px] font-bold text-secondary">Welcome to Raj Electrical Services Support!</p>
                    <p className="text-[10px] opacity-80 mt-1 max-w-[220px]">Describe your query or issue below, and our administrative team will assist you shortly.</p>
                  </div>
                ) : targetRoomType === 'complaint_admin' ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
                    <ShieldAlert className="w-8 h-8 text-rose-500 opacity-40 mb-2 animate-pulse" />
                    <p className="text-[12px] font-bold text-rose-800">Dispute Investigation Active</p>
                    <p className="text-[10px] opacity-80 mt-1 max-w-[220px]">An administrator is actively reviewing the case. Please describe the issue and upload any screenshots or proof.</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
                    <Info className="w-6 h-6 opacity-30 mb-1.5" />
                    <p className="text-[11px] font-bold">Secure connection established.</p>
                    <p className="text-[9px] opacity-85 mt-0.5">Please maintain a professional tone.</p>
                  </div>
                )
              ) : (
                messages.map((msg, index) => {
                  const isMe = msg.senderRole === role;
                  const isSystem = msg.messageType === 'system';

                  if (isSystem) {
                    return (
                      <div key={msg._id || index} className="text-center py-1.5">
                        <span className="inline-block bg-gray-100 border border-gray-200 text-gray-500 px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase">
                          ⚙️ {msg.content}
                        </span>
                      </div>
                    );
                  }

                  const isImage = msg.messageType === 'image' && msg.fileUrl;

                  return (
                    <div key={msg._id || index} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-xl px-3 py-2 shadow-sm text-xs border ${isMe
                        ? 'bg-primary text-white border-primary/10 rounded-br-none'
                        : 'bg-white text-secondary border-gray-150 rounded-bl-none'
                        }`}>
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
                        <div className={`flex items-center gap-1 mt-1 justify-end text-[8px] ${isMe ? 'text-white/70' : 'text-gray-400'}`}>
                          <span>{formatRelativeTime(msg.createdAt)}</span>
                          {isMe && (
                            msg.seen ? (
                              <CheckCheck className="w-3 h-3 text-emerald-300" />
                            ) : (
                              <Check className="w-3 h-3 opacity-60" />
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {otherTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 text-gray-400 rounded-xl rounded-bl-none px-3 py-2 shadow-sm flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* QUICK ACTION BUBBLES */}
        {!isLocked && !loading && !error && (
          <div className="px-3 py-1.5 bg-white border-t border-gray-100 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-hide">
            {quickReplies.map((reply) => (
              <button
                key={reply}
                onClick={() => handleSendMessage(reply)}
                className="px-2.5 py-1 bg-gray-50 hover:bg-primary hover:text-white border border-gray-200 hover:border-primary text-secondary text-[10px] font-bold rounded-full transition-all shrink-0 active:scale-95 shadow-sm"
              >
                {reply}
              </button>
            ))}
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
                  <Loader className="w-3.5 h-3.5 animate-spin text-primary" />
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
