import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { useNavigate } from 'react-router-dom';
import { Star, Edit, Trash2, ChevronLeft, Clock, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const CustomerFeedbackPage = () => {
  const { user, token, API, showToast } = useAuth();
  const navigate = useNavigate();
  
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingFeedback, setEditingFeedback] = useState(null);
  const [formData, setFormData] = useState({
    rating: 5,
    comment: ''
  });
  const [activeTab, setActiveTab] = useState('all');

  // Fetch all feedbacks
  useEffect(() => {
    const fetchFeedbacks = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API}/feedback/my-feedbacks`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) throw new Error('Failed to fetch feedbacks');
        
        const data = await response.json();
        setFeedbacks(data.feedbacks || []);
      } catch (error) {
        showToast(error.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchFeedbacks();
  }, [API, token, showToast]);

  // Handle feedback submission
  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API}/feedback/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          bookingId: editingFeedback?.booking?._id,
          rating: formData.rating,
          comment: formData.comment
        })
      });

      if (!response.ok) throw new Error('Failed to submit feedback');

      const data = await response.json();
      showToast('Feedback submitted successfully!', 'success');
      
      // Update local state
      if (editingFeedback) {
        setFeedbacks(feedbacks.map(f => 
          f._id === editingFeedback._id ? data.feedback : f
        ));
      } else {
        setFeedbacks([data.feedback, ...feedbacks]);
      }
      
      resetForm();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // Handle edit feedback
  const handleEditFeedback = (feedback) => {
    setEditingFeedback(feedback);
    setFormData({
      rating: feedback.rating,
      comment: feedback.comment || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reset form
  const resetForm = () => {
    setEditingFeedback(null);
    setFormData({
      rating: 5,
      comment: ''
    });
  };

  // Filter feedbacks by status
  const filteredFeedbacks = feedbacks.filter(feedback => {
    if (activeTab === 'all') return true;
    if (activeTab === 'edited') return feedback.isEdited;
    return true;
  });

  // Render star rating
  const renderStars = (rating) => {
    return (
      <div className="flex items-center">
        {[...Array(5)].map((_, i) => (
          <Star 
            key={i}
            className={`w-5 h-5 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button 
            onClick={() => navigate(-1)} 
            className="flex items-center text-blue-600 hover:text-blue-800 mb-4"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">My Feedback</h1>
          <p className="text-gray-600 mt-2">
            {feedbacks.length} {feedbacks.length === 1 ? 'review' : 'reviews'}
          </p>
        </div>

        {/* Feedback Form */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {editingFeedback ? 'Edit Your Feedback' : 'Submit New Feedback'}
          </h2>
          
          <form onSubmit={handleSubmitFeedback}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rating
              </label>
              <div className="flex items-center space-x-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFormData({...formData, rating: star})}
                    className="focus:outline-none"
                  >
                    <Star
                      className={`w-8 h-8 ${star <= formData.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comments
              </label>
              <textarea
                value={formData.comment}
                onChange={(e) => setFormData({...formData, comment: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                rows="4"
                placeholder="Share your experience..."
                maxLength="500"
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.comment.length}/500 characters
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              {editingFeedback && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {editingFeedback ? 'Update Feedback' : 'Submit Feedback'}
              </button>
            </div>
          </form>
        </div>

        {/* Feedback List */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('all')}
                className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${activeTab === 'all' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                All Feedback
              </button>
              <button
                onClick={() => setActiveTab('edited')}
                className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${activeTab === 'edited' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                Edited
              </button>
            </nav>
          </div>

          {/* Feedback Items */}
          <div className="divide-y divide-gray-200">
            {filteredFeedbacks.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500">
                  {activeTab === 'all' 
                    ? "You haven't submitted any feedback yet."
                    : "You haven't edited any feedback yet."}
                </p>
              </div>
            ) : (
              filteredFeedbacks.map((feedback) => (
                <div key={feedback._id} className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {feedback.service?.title || 'Service'}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {new Date(feedback.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {feedback.isEdited && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          Edited
                        </span>
                      )}
                      <button
                        onClick={() => handleEditFeedback(feedback)}
                        className="text-blue-600 hover:text-blue-800 p-1"
                        title="Edit feedback"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    {renderStars(feedback.rating)}
                    {feedback.comment && (
                      <p className="mt-2 text-gray-700">
                        {feedback.comment}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center text-sm text-gray-500">
                    <div className="flex items-center mr-4">
                      <Clock className="w-4 h-4 mr-1" />
                      <span>
                        {new Date(feedback.booking?.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center">
                      {feedback.booking?.status === 'completed' ? (
                        <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 mr-1 text-red-500" />
                      )}
                      <span className="capitalize">
                        {feedback.booking?.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerFeedbackPage;