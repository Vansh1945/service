import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaEdit, FaTrash, FaDownload, FaUpload, FaPlus, FaTimes, FaCheck } from 'react-icons/fa';
import { FileText, PlusCircle, Trash2, Edit2, Download, Upload } from 'lucide-react';

const AdminQuestions = () => {
  const { token, isAdmin, API, showToast, logoutUser } = useAuth();
  const navigate = useNavigate();

  // Form states
  const [formData, setFormData] = useState({
    questionText: '',
    options: ['', ''],
    correctAnswer: 0,
    category: 'electrical',
    subcategory: 'wiring',
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
    subcategory: '',
    isActive: ''
  });

  // Bulk upload
  const [bulkQuestions, setBulkQuestions] = useState('');
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  // Check admin status
  useEffect(() => {
    if (!isAdmin || !token) {
      showToast('Unauthorized access', 'error');
      navigate('/admin/dashboard');
    }
  }, [isAdmin, navigate, showToast, token]);

  // Fetch questions
  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();

      if (filters.search) queryParams.append('search', filters.search);
      if (filters.category) queryParams.append('category', filters.category);
      if (filters.subcategory) queryParams.append('subcategory', filters.subcategory);
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
      category: 'electrical',
      subcategory: 'wiring',
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
      category: question.category,
      subcategory: question.subcategory,
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
          subcategory: formData.subcategory,
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

  return (
    <div className="min-h-screen bg-blue-50 p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto"
      >
        {/* Header */}
        <div className="bg-blue-900 rounded-xl p-6 mb-6 shadow-lg">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <FileText className="text-yellow-400" size={32} />
            Question Bank Management
          </h1>
          <p className="text-blue-200 mt-2">Manage all test questions in one place</p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Form */}
          <div className="lg:col-span-1 space-y-6">
            {/* Question Form */}
            <motion.div
              whileHover={{ scale: 1.01 }}
              className="bg-white rounded-xl shadow-md p-6 border border-blue-200"
            >
              <h2 className="text-xl font-semibold mb-4 text-blue-900 flex items-center gap-2">
                {editingId ? (
                  <>
                    <Edit2 className="text-blue-600" size={20} />
                    Edit Question
                  </>
                ) : (
                  <>
                    <PlusCircle className="text-blue-600" size={20} />
                    Add New Question
                  </>
                )}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Question Text *</label>
                  <textarea
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    rows="3"
                    value={formData.questionText}
                    onChange={(e) => handleChange({ target: { name: 'questionText', value: e.target.value } })}
                    required
                    placeholder="Enter your question here..."
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Options *</label>
                  <div className="space-y-2">
                    {formData.options.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="correctAnswer"
                          checked={formData.correctAnswer === index}
                          onChange={() => setFormData(prev => ({ ...prev, correctAnswer: index }))}
                          className="h-5 w-5 text-blue-600 focus:ring-blue-500"
                          required
                        />
                        <input
                          type="text"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                          value={option}
                          onChange={(e) => handleOptionChange(index, e.target.value)}
                          required
                          placeholder={`Option ${index + 1}`}
                        />
                        {formData.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeOption(index)}
                            className="p-2 text-red-600 hover:text-red-800 rounded-full hover:bg-red-50"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {formData.options.length < 5 && (
                    <button
                      type="button"
                      onClick={addOption}
                      className="mt-2 flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      <FaPlus size={14} /> Add Option
                    </button>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Minimum 2 options, maximum 5 options</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 mb-2 font-medium">Category *</label>
                    <select
                      name="category"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      value={formData.category}
                      onChange={handleChange}
                      required
                    >
                      <option value="electrical">Electrical</option>
                      <option value="general">General</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-700 mb-2 font-medium">Subcategory *</label>
                    <select
                      name="subcategory"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      value={formData.subcategory}
                      onChange={handleChange}
                      required
                    >
                      <option value="wiring">Wiring</option>
                      <option value="ac">AC</option>
                      <option value="repair">Repair</option>
                      <option value="all">All</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="isActive"
                    className="h-5 w-5 text-blue-600 focus:ring-blue-500 rounded"
                    checked={formData.isActive}
                    onChange={(e) => handleChange({ target: { name: 'isActive', value: e.target.checked } })}
                  />
                  <label className="ml-2 text-gray-700">Active Question</label>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    {editingId ? (
                      <>
                        <FaEdit /> Update
                      </>
                    ) : (
                      <>
                        <FaPlus /> Add
                      </>
                    )}
                  </button>

                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                    >
                      <FaTimes /> Cancel
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowBulkUpload(!showBulkUpload)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                  >
                    {showBulkUpload ? (
                      <>
                        <FaTimes /> Hide Bulk
                      </>
                    ) : (
                      <>
                        <FaUpload /> Bulk Upload
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>

            {/* Bulk Upload Section */}
            {showBulkUpload && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-white rounded-xl shadow-md p-6 border border-blue-200"
              >
                <h2 className="text-xl font-semibold mb-4 text-blue-900 flex items-center gap-2">
                  <Upload className="text-blue-600" size={20} />
                  Bulk Upload Questions
                </h2>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-700 mb-2">Format example:</p>
                    <pre className="bg-blue-50 p-3 rounded-lg text-xs overflow-x-auto">
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    rows="8"
                    value={bulkQuestions}
                    onChange={(e) => setBulkQuestions(e.target.value)}
                    placeholder="Paste questions here in the specified format..."
                  />

                  <div className="flex gap-3">
                    <button
                      onClick={handleBulkUpload}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex-1"
                    >
                      <FaUpload /> Upload
                    </button>

                    <button
                      onClick={() => setBulkQuestions('')}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                    >
                      <FaTimes /> Clear
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Right Column - Questions List */}
          <div className="lg:col-span-2 space-y-6">
            {/* Filters */}
            <motion.div
              whileHover={{ scale: 1.01 }}
              className="bg-white rounded-xl shadow-md p-6 border border-blue-200"
            >
              <h2 className="text-xl font-semibold mb-4 text-blue-900">Filters</h2>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2 text-sm font-medium">Search</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    placeholder="Search questions..."
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2 text-sm font-medium">Category</label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    value={filters.category}
                    onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  >
                    <option value="">All Categories</option>
                    <option value="electrical">Electrical</option>
                    <option value="general">General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 mb-2 text-sm font-medium">Subcategory</label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    value={filters.subcategory}
                    onChange={(e) => setFilters({ ...filters, subcategory: e.target.value })}
                  >
                    <option value="">All Subcategories</option>
                    <option value="wiring">Wiring</option>
                    <option value="ac">AC</option>
                    <option value="repair">Repair</option>
                    <option value="all">All</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 mb-2 text-sm font-medium">Status</label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
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
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  <FaDownload /> Download PDF
                </button>
              </div>
            </motion.div>

            {/* Questions List */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-xl shadow-md p-6 border border-blue-200"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-blue-900">Questions List</h2>
                <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  {questions.length} questions found
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-600">Loading questions...</p>
                </div>
              ) : questions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4">
                    <FileText size={48} className="mx-auto" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-700">No questions found</h3>
                  <p className="text-gray-500 mt-1">Add some questions to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {questions.map((question) => (
                    <motion.div
                      key={question._id}
                      whileHover={{ scale: 1.005 }}
                      className="bg-blue-50 rounded-lg p-4 border border-blue-200"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-blue-900">{question.questionText}</h3>
                          <div className="mt-2 space-y-1">
                            {question.options.map((opt, idx) => (
                              <div
                                key={idx}
                                className={`flex items-center text-sm ${idx === question.correctAnswer ? 'font-bold text-green-600' : 'text-gray-600'}`}
                              >
                                <span className="w-6">{String.fromCharCode(97 + idx)}.</span>
                                <span>{opt}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col items-end space-y-2">
                          <div className="flex gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${question.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                              {question.isActive ? 'Active' : 'Inactive'}
                            </span>
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium capitalize">
                              {question.category}
                            </span>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => openEditDialog(question)}
                              className="p-2 text-blue-600 hover:text-blue-800 rounded-lg hover:bg-blue-100"
                              title="Edit"
                            >
                              <FaEdit size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(question._id)}
                              className="p-2 text-red-600 hover:text-red-800 rounded-lg hover:bg-red-100"
                              title="Delete"
                            >
                              <FaTrash size={16} />
                            </button>
                            <button
                              onClick={() => toggleStatus(question._id, question.isActive)}
                              className={`p-2 rounded-lg ${question.isActive ? 'text-yellow-600 hover:text-yellow-800 hover:bg-yellow-100' : 'text-green-600 hover:text-green-800 hover:bg-green-100'}`}
                              title={question.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {question.isActive ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Edit Dialog */}
      {showEditDialog && currentQuestion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-blue-900">Edit Question</h2>
                <button
                  onClick={closeEditDialog}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <FaTimes size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Question Text</label>
                  <textarea
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    rows="3"
                    value={formData.questionText}
                    onChange={(e) => handleChange({ target: { name: 'questionText', value: e.target.value } })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Options</label>
                  <div className="space-y-2">
                    {formData.options.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="correctAnswer"
                          checked={formData.correctAnswer === index}
                          onChange={() => setFormData(prev => ({ ...prev, correctAnswer: index }))}
                          className="h-5 w-5 text-blue-600 focus:ring-blue-500"
                          required
                        />
                        <input
                          type="text"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                          value={option}
                          onChange={(e) => handleOptionChange(index, e.target.value)}
                          required
                        />
                        {formData.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeOption(index)}
                            className="p-2 text-red-600 hover:text-red-800 rounded-full hover:bg-red-50"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {formData.options.length < 5 && (
                    <button
                      type="button"
                      onClick={addOption}
                      className="mt-2 flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      <FaPlus size={14} /> Add Option
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 mb-2 font-medium">Category</label>
                    <select
                      name="category"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      value={formData.category}
                      onChange={handleChange}
                      required
                    >
                      <option value="electrical">Electrical</option>
                      <option value="general">General</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-700 mb-2 font-medium">Subcategory</label>
                    <select
                      name="subcategory"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      value={formData.subcategory}
                      onChange={handleChange}
                      required
                    >
                      <option value="wiring">Wiring</option>
                      <option value="ac">AC</option>
                      <option value="repair">Repair</option>
                      <option value="all">All</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="isActive"
                    className="h-5 w-5 text-blue-600 focus:ring-blue-500 rounded"
                    checked={formData.isActive}
                    onChange={(e) => handleChange({ target: { name: 'isActive', value: e.target.checked } })}
                  />
                  <label className="ml-2 text-gray-700">Active Question</label>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeEditDialog}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdminQuestions;