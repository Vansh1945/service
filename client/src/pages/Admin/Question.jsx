import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../store/auth';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileText, PlusCircle, Trash2, Edit2, Download, Upload, X, Check,
  Search, Filter, BarChart3, Eye, CheckSquare, Square,
  TrendingUp, Users, Activity, AlertCircle, Loader2,
  ChevronDown, ChevronUp, Star, BookOpen, Zap
} from 'lucide-react';

const AdminQuestions = () => {
  const { token, isAdmin, API, showToast, logoutUser } = useAuth();
  const navigate = useNavigate();

  // Form states
  const [formData, setFormData] = useState({
    questionText: '',
    options: ['', ''],
    correctAnswer: 0,
    category: '',
    isActive: true
  });

  // List states
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    isActive: ''
  });

  // Bulk upload
  const [bulkQuestions, setBulkQuestions] = useState('');
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  // New enhanced states
  const [selectedQuestions, setSelectedQuestions] = useState(new Set());
  const [showStats, setShowStats] = useState(true);
  const [sortBy, setSortBy] = useState('newest');
  const [showPreview, setShowPreview] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState(null);
  const [categories, setCategories] = useState([]);

  // Check admin status
  useEffect(() => {
    if (!isAdmin || !token) {
      showToast('Unauthorized access', 'error');
      navigate('/admin/dashboard');
    }
  }, [isAdmin, navigate, showToast, token]);

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API}/system-setting/categories`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch categories');
      }

      const data = await response.json();
      setCategories(data.data || []);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  useEffect(() => {
    if (token) {
      fetchCategories();
    }
  }, [token]);

  // Fetch questions
  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();

      if (filters.search) queryParams.append('search', filters.search);
      if (filters.category) queryParams.append('category', filters.category);
      if (filters.isActive) queryParams.append('isActive', filters.isActive);

      const response = await fetch(`${API}/question/get?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          logoutUser();
          throw new Error('Session expired. Please login again.');
        }
        throw new Error('Failed to fetch questions');
      }

      const data = await response.json();
      setQuestions(data.questions || []);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchQuestions();
    }
  }, [filters, token]);

  // Handle form changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle option change
  const handleOptionChange = (index, value) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData(prev => ({ ...prev, options: newOptions }));
  };

  // Add option field
  const addOption = () => {
    if (formData.options.length < 5) {
      setFormData(prev => ({ ...prev, options: [...prev.options, ''] }));
    }
  };

  // Remove option field
  const removeOption = (index) => {
    if (formData.options.length > 2) {
      const newOptions = formData.options.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        options: newOptions,
        correctAnswer: prev.correctAnswer >= newOptions.length ? newOptions.length - 1 : prev.correctAnswer
      }));
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      questionText: '',
      options: ['', ''],
      correctAnswer: 0,
      category: '',
      isActive: true
    });
    setEditingId(null);
  };

  // Validate form
  const validateForm = () => {
    if (!formData.questionText.trim()) {
      showToast('Question text is required', 'error');
      return false;
    }

    if (formData.options.some(opt => !opt.trim())) {
      showToast('All options must be filled', 'error');
      return false;
    }

    if (formData.correctAnswer === null || formData.correctAnswer === undefined) {
      showToast('Please select a correct answer', 'error');
      return false;
    }

    if (formData.correctAnswer < 0 || formData.correctAnswer >= formData.options.length) {
      showToast('Correct answer must be one of the provided options', 'error');
      return false;
    }

    return true;
  };

  // Submit question
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const url = editingId
        ? `${API}/question/edit/${editingId}`
        : `${API}/question/`;

      const method = editingId ? 'PUT' : 'POST';

      // Ensure correctAnswer is within bounds
      const payload = {
        ...formData,
        correctAnswer: Math.min(formData.correctAnswer, formData.options.length - 1)
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        if (response.status === 401) {
          logoutUser();
          throw new Error('Session expired. Please login again.');
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save question');
      }

      const data = await response.json();
      showToast(editingId ? 'Question updated successfully' : 'Question added successfully');
      resetForm();
      if (showEditDialog) setShowEditDialog(false);
      fetchQuestions();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // Open edit dialog
  const openEditDialog = (question) => {
    setCurrentQuestion(question);
    setShowEditDialog(true);
    setFormData({
      questionText: question.questionText,
      options: question.options,
      correctAnswer: question.correctAnswer,
      category: question.category?.name || question.category,
      isActive: question.isActive
    });
    setEditingId(question._id);
  };

  // Close edit dialog
  const closeEditDialog = () => {
    setShowEditDialog(false);
    resetForm();
  };

  // Delete question
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;

    try {
      const response = await fetch(`${API}/question/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          logoutUser();
          throw new Error('Session expired. Please login again.');
        }
        throw new Error('Failed to delete question');
      }

      showToast('Question deleted successfully');
      fetchQuestions();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // Toggle question status
  const toggleStatus = async (id, currentStatus) => {
    try {
      const response = await fetch(`${API}/question/edit/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isActive: !currentStatus })
      });

      if (!response.ok) {
        if (response.status === 401) {
          logoutUser();
          throw new Error('Session expired. Please login again.');
        }
        throw new Error('Failed to update question status');
      }

      showToast(`Question ${currentStatus ? 'deactivated' : 'activated'} successfully`);
      fetchQuestions();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // Handle bulk upload
  const handleBulkUpload = async () => {
    if (!bulkQuestions.trim()) {
      showToast('Please enter questions in the required format', 'error');
      return;
    }

    try {
      // Parse bulk questions
      const questionsArray = bulkQuestions.split('\n\n').map(q => {
        const lines = q.split('\n').filter(line => line.trim());
        if (lines.length < 3) return null;

        const questionText = lines[0].replace(/^\d+\.\s*/, '').trim();
        const options = lines.slice(1, -1).map(line =>
          line.replace(/^[a-z]\)\s*/, '').trim()
        );
        const correctAnswerLine = lines[lines.length - 1].toLowerCase();
        const correctAnswerChar = correctAnswerLine.match(/answer:\s*([a-z])/i)?.[1];
        const correctAnswer = correctAnswerChar ?
          correctAnswerChar.charCodeAt(0) - 'a'.charCodeAt(0) : 0;

        return {
          questionText,
          options,
          correctAnswer,
          category: formData.category,
          isActive: formData.isActive
        };
      }).filter(q => q !== null);

      if (questionsArray.length === 0) {
        throw new Error('No valid questions found in the input');
      }

      const response = await fetch(`${API}/question/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ questions: questionsArray })
      });

      if (!response.ok) {
        if (response.status === 401) {
          logoutUser();
          throw new Error('Session expired. Please login again.');
        }
        throw new Error('Failed to upload bulk questions');
      }

      const data = await response.json();
      showToast(`${data.count} questions added successfully`);
      setBulkQuestions('');
      setShowBulkUpload(false);
      fetchQuestions();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // Download PDF
  const handleDownloadPDF = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();

      if (filters.category) queryParams.append('category', filters.category);
      if (filters.subcategory) queryParams.append('subcategory', filters.subcategory);

      const response = await fetch(`${API}/question/download/pdf?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          logoutUser();
          throw new Error('Session expired. Please login again.');
        }
        throw new Error('Failed to download PDF');
      }

      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1].replace(/"/g, '')
        : 'questions.pdf';

      // Convert the response to a blob
      const blob = await response.blob();

      // Create a download link and trigger the download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast('PDF download started', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Statistics calculations
  const statistics = useMemo(() => {
    const total = questions.length;
    const active = questions.filter(q => q.isActive).length;
    const inactive = total - active;
    const byCategory = questions.reduce((acc, q) => {
      const categoryName = q.category?.name || 'Uncategorized';
      acc[categoryName] = (acc[categoryName] || 0) + 1;
      return acc;
    }, {});
    const bySubcategory = questions.reduce((acc, q) => {
      const subcategoryName = q.subcategory || 'No Subcategory';
      acc[subcategoryName] = (acc[subcategoryName] || 0) + 1;
      return acc;
    }, {});

    return {
      total,
      active,
      inactive,
      byCategory,
      bySubcategory,
      activePercentage: total > 0 ? Math.round((active / total) * 100) : 0
    };
  }, [questions]);

  // Sorted and filtered questions
  const sortedQuestions = useMemo(() => {
    let sorted = [...questions];
    
    switch (sortBy) {
      case 'newest':
        sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        break;
      case 'oldest':
        sorted.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
        break;
      case 'alphabetical':
        sorted.sort((a, b) => a.questionText.localeCompare(b.questionText));
        break;
      case 'category':
        sorted.sort((a, b) => a.category.localeCompare(b.category));
        break;
      default:
        break;
    }
    
    return sorted;
  }, [questions, sortBy]);

  return (
    <div className="min-h-screen  p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-secondary flex items-center gap-3">
                <FileText className="text-primary" size={32} />
                Question Bank Management
              </h1>
              <p className="text-gray-600 mt-2">Efficiently manage and organize your test questions</p>
            </div>
            <div className="mt-4 md:mt-0 flex items-center gap-3">
              <button
                onClick={() => setShowStats(!showStats)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  showStats 
                    ? 'bg-primary bg-opacity-10 text-primary' 
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                <BarChart3 size={18} />
                {showStats ? 'Hide Stats' : 'Show Stats'}
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Dashboard */}
        {showStats && (
          <div className="mb-6">
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* Total Questions */}
              <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm font-medium">Total Questions</p>
                    <p className="text-2xl font-bold text-secondary mt-1">{statistics.total}</p>
                  </div>
                  <div className="bg-primary bg-opacity-10 p-2 rounded-lg">
                    <BookOpen className="text-primary" size={20} />
                  </div>
                </div>
              </div>

              {/* Active Questions */}
              <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm font-medium">Active Questions</p>
                    <p className="text-2xl font-bold text-secondary mt-1">{statistics.active}</p>
                    <p className="text-gray-500 text-xs mt-1">{statistics.activePercentage}% of total</p>
                  </div>
                  <div className="bg-green-500 bg-opacity-10 p-2 rounded-lg">
                    <Check className="text-green-500" size={20} />
                  </div>
                </div>
              </div>

              {/* Inactive Questions */}
              <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm font-medium">Inactive Questions</p>
                    <p className="text-2xl font-bold text-secondary mt-1">{statistics.inactive}</p>
                    <p className="text-gray-500 text-xs mt-1">{100 - statistics.activePercentage}% of total</p>
                  </div>
                  <div className="bg-red-500 bg-opacity-10 p-2 rounded-lg">
                    <X className="text-red-500" size={20} />
                  </div>
                </div>
              </div>

              {/* Categories */}
              <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm font-medium">Categories</p>
                    <p className="text-2xl font-bold text-secondary mt-1">{Object.keys(statistics.byCategory).length}</p>
                    <p className="text-gray-500 text-xs mt-1">Different categories</p>
                  </div>
                  <div className="bg-purple-500 bg-opacity-10 p-2 rounded-lg">
                    <TrendingUp className="text-purple-500" size={20} />
                  </div>
                </div>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
              <h3 className="text-lg font-semibold text-secondary mb-3 flex items-center gap-2">
                <BarChart3 className="text-primary" size={20} />
                Questions by Category
              </h3>
              <div className="space-y-2">
                {Object.entries(statistics.byCategory).map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        category === 'electrical' ? 'bg-primary' : 'bg-accent'
                      }`}></div>
                      <span className="text-secondary text-sm capitalize font-medium">{category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-secondary font-semibold">{count}</span>
                      <span className="text-gray-500 text-xs">
                        ({Math.round((count / statistics.total) * 100)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Form */}
          <div className="lg:col-span-1 space-y-4">
            {/* Question Form */}
            <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
              <h2 className="text-xl font-semibold mb-4 text-secondary flex items-center gap-2">
                {editingId ? (
                  <>
                    <Edit2 className="text-primary" size={20} />
                    Edit Question
                  </>
                ) : (
                  <>
                    <PlusCircle className="text-primary" size={20} />
                    Add New Question
                  </>
                )}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-secondary mb-2 font-medium">Question Text *</label>
                  <textarea
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    rows="4"
                    value={formData.questionText}
                    onChange={(e) => handleChange({ target: { name: 'questionText', value: e.target.value } })}
                    required
                    placeholder="Enter your question here..."
                  />
                </div>

                <div>
                  <label className="block text-secondary mb-2 font-medium">Options *</label>
                  <div className="space-y-2">
                    {formData.options.map((option, index) => (
                      <div key={index} className="flex items-center gap-2 group">
                        <input
                          type="radio"
                          name="correctAnswer"
                          checked={formData.correctAnswer === index}
                          onChange={() => setFormData(prev => ({ ...prev, correctAnswer: index }))}
                          className="h-4 w-4 text-primary focus:ring-primary"
                          required
                        />
                        <input
                          type="text"
                          className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                          value={option}
                          onChange={(e) => handleOptionChange(index, e.target.value)}
                          required
                          placeholder={`Option ${index + 1}`}
                        />
                        {formData.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeOption(index)}
                            className="p-1.5 text-red-500 hover:text-red-600 rounded-lg hover:bg-red-50 opacity-70 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {formData.options.length < 5 && (
                    <button
                      type="button"
                      onClick={addOption}
                      className="mt-2 flex items-center gap-1 text-primary hover:text-primary-dark text-sm font-medium"
                    >
                      <PlusCircle size={14} /> Add Option
                    </button>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Minimum 2 options, maximum 5 options</p>
                </div>

                <div>
                  <label className="block text-secondary mb-2 font-medium">Category *</label>
                  <select
                    name="category"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={formData.category}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map((category) => (
                      <option key={category._id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="isActive"
                    className="h-4 w-4 text-primary focus:ring-primary rounded"
                    checked={formData.isActive}
                    onChange={(e) => handleChange({ target: { name: 'isActive', value: e.target.checked } })}
                  />
                  <label className="ml-2 text-secondary text-sm font-medium">Active Question</label>
                </div>

                <div className="flex flex-wrap gap-2 pt-3">
                  <button
                    type="submit"
                    className="flex items-center gap-1 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium shadow-sm hover:shadow-md"
                  >
                    {editingId ? (
                      <>
                        <Edit2 size={14} /> Update
                      </>
                    ) : (
                      <>
                        <PlusCircle size={14} /> Add
                      </>
                    )}
                  </button>

                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="flex items-center gap-1 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium"
                    >
                      <X size={14} /> Cancel
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowBulkUpload(!showBulkUpload)}
                    className="flex items-center gap-1 px-4 py-2 bg-accent hover:bg-accent-dark text-white rounded-lg font-medium"
                  >
                    {showBulkUpload ? (
                      <>
                        <X size={14} /> Hide Bulk
                      </>
                    ) : (
                      <>
                        <Upload size={14} /> Bulk Upload
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Bulk Upload Section */}
            {showBulkUpload && (
              <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
                <h2 className="text-xl font-semibold mb-3 text-secondary flex items-center gap-2">
                  <Upload className="text-primary" size={20} />
                  Bulk Upload Questions
                </h2>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600 mb-2 font-medium">Format example:</p>
                    <pre className="bg-gray-50 p-3 rounded-lg text-xs font-mono text-gray-700 overflow-x-auto border border-gray-200">
                      {`1. What is the color of live wire in electrical wiring?
a) Red
b) Black
c) Green
Correct Answer: a

2. What does AC stand for?
a) Alternating Current
b) Actual Current
c) Active Current
Correct Answer: a`}
                    </pre>
                  </div>

                  <textarea
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    rows="6"
                    value={bulkQuestions}
                    onChange={(e) => setBulkQuestions(e.target.value)}
                    placeholder="Paste questions here in the specified format..."
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={handleBulkUpload}
                      className="flex items-center gap-1 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium flex-1"
                    >
                      <Upload size={14} /> Upload
                    </button>

                    <button
                      onClick={() => setBulkQuestions('')}
                      className="flex items-center gap-1 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium"
                    >
                      <X size={14} /> Clear
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Questions List */}
          <div className="lg:col-span-2 space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
              <h2 className="text-xl font-semibold mb-3 text-secondary">Filters</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-secondary mb-1 text-sm font-medium">Search</label>
                  <input
                    type="text"
                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    placeholder="Search questions..."
                  />
                </div>

                <div>
                  <label className="block text-secondary mb-1 text-sm font-medium">Category</label>
                  <select
                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={filters.category}
                    onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  >
                    <option value="">All Categories</option>
                    {categories.map((category) => (
                      <option key={category._id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-secondary mb-1 text-sm font-medium">Status</label>
                  <select
                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={filters.isActive}
                    onChange={(e) => setFilters({ ...filters, isActive: e.target.value })}
                  >
                    <option value="">All Statuses</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-1 px-4 py-2 bg-accent hover:bg-accent-dark text-white rounded-lg font-medium"
                >
                  <Download size={14} /> Download PDF
                </button>
              </div>
            </div>

            {/* Questions List */}
            <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-secondary">Questions List</h2>
                <div className="bg-primary bg-opacity-10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                  {questions.length} questions found
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full mb-3 animate-spin" />
                  <p className="text-gray-600">Loading questions...</p>
                </div>
              ) : questions.length === 0 ? (
                <div className="text-center py-8">
                  <FileText size={40} className="mx-auto text-gray-400 mb-3" />
                  <h3 className="text-lg font-medium text-secondary">No questions found</h3>
                  <p className="text-gray-500 mt-1">Add some questions to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {questions.map((question) => (
                    <div
                      key={question._id}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-primary transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-medium text-secondary">{question.questionText}</h3>
                          <div className="mt-2 space-y-1">
                            {question.options.map((opt, idx) => (
                              <div
                                key={idx}
                                className={`flex items-center text-sm ${idx === question.correctAnswer ? 'font-semibold text-green-600' : 'text-gray-600'}`}
                              >
                                <span className="w-5">{String.fromCharCode(97 + idx)}.</span>
                                <span>{opt}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2 mt-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${question.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {question.isActive ? 'Active' : 'Inactive'}
                            </span>
                            <span className="px-2 py-0.5 bg-primary bg-opacity-10 text-primary rounded-full text-xs font-medium capitalize">
                              {question.category?.name || 'Uncategorized'}
                            </span>

                          </div>
                        </div>

                        <div className="flex flex-col items-end ml-3 gap-2">
                          <div className="flex gap-1">
                            <button
                              onClick={() => openEditDialog(question)}
                              className="p-1.5 text-primary hover:text-primary-dark hover:bg-primary hover:bg-opacity-10 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(question._id)}
                              className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                            <button
                              onClick={() => toggleStatus(question._id, question.isActive)}
                              className={`p-1.5 rounded-lg ${question.isActive ? 'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-100' : 'text-green-500 hover:text-green-600 hover:bg-green-100'} transition-colors`}
                              title={question.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {question.isActive ? (
                                <X size={16} />
                              ) : (
                                <Check size={16} />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      {showEditDialog && currentQuestion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-secondary">Edit Question</h2>
                <button
                  onClick={closeEditDialog}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-secondary mb-2 font-medium">Question Text</label>
                  <textarea
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    rows="4"
                    value={formData.questionText}
                    onChange={(e) => handleChange({ target: { name: 'questionText', value: e.target.value } })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-secondary mb-2 font-medium">Options</label>
                  <div className="space-y-2">
                    {formData.options.map((option, index) => (
                      <div key={index} className="flex items-center gap-2 group">
                        <input
                          type="radio"
                          name="correctAnswer"
                          checked={formData.correctAnswer === index}
                          onChange={() => setFormData(prev => ({ ...prev, correctAnswer: index }))}
                          className="h-4 w-4 text-primary focus:ring-primary"
                          required
                        />
                        <input
                          type="text"
                          className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                          value={option}
                          onChange={(e) => handleOptionChange(index, e.target.value)}
                          required
                        />
                        {formData.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeOption(index)}
                            className="p-1.5 text-red-500 hover:text-red-600 rounded-lg hover:bg-red-50 opacity-70 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {formData.options.length < 5 && (
                    <button
                      type="button"
                      onClick={addOption}
                      className="mt-2 flex items-center gap-1 text-primary hover:text-primary-dark text-sm font-medium"
                    >
                      <PlusCircle size={14} /> Add Option
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-secondary mb-2 font-medium">Category</label>
                  <select
                    name="category"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={formData.category}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map((category) => (
                      <option key={category._id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="isActive"
                    className="h-4 w-4 text-primary focus:ring-primary rounded"
                    checked={formData.isActive}
                    onChange={(e) => handleChange({ target: { name: 'isActive', value: e.target.checked } })}
                  />
                  <label className="ml-2 text-secondary text-sm font-medium">Active Question</label>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={closeEditDialog}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminQuestions;