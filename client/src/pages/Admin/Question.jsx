import React, { useState, useEffect, useContext } from 'react';
import { useAuth } from '../../store/auth';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';

const AdminQuestions = () => {
  const { token, isAdmin, API, showToast, logoutUser } = useAuth();
  const navigate = useNavigate();
  
  // Form states
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [correctAnswer, setCorrectAnswer] = useState(0);
  const [category, setCategory] = useState('electrical');
  const [subcategory, setSubcategory] = useState('wiring');
  const [isActive, setIsActive] = useState(true);
  
  // List states
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSubcategory, setFilterSubcategory] = useState('');
  
  // Bulk upload
  const [bulkQuestions, setBulkQuestions] = useState('');
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  // Check admin status
  useEffect(() => {
    if (!isAdmin) {
      showToast('Unauthorized access', 'error');
      navigate('/admin/dashboard');
    }
  }, [isAdmin, navigate, showToast]);

  // Fetch questions
  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (filterCategory) queryParams.append('category', filterCategory);
      if (filterSubcategory) queryParams.append('subcategory', filterSubcategory);
      if (searchTerm) queryParams.append('search', searchTerm);

      const response = await fetch(`${API}/question?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          logoutUser();
          return;
        }
        throw new Error('Failed to fetch questions');
      }

      const data = await response.json();
      setQuestions(data.questions);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [filterCategory, filterSubcategory, searchTerm]);

  // Handle option change
  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  // Add option field
  const addOption = () => {
    if (options.length < 5) {
      setOptions([...options, '']);
    }
  };

  // Remove option field
  const removeOption = (index) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
      if (correctAnswer >= newOptions.length) {
        setCorrectAnswer(newOptions.length - 1);
      }
    }
  };

  // Reset form
  const resetForm = () => {
    setQuestionText('');
    setOptions(['', '']);
    setCorrectAnswer(0);
    setCategory('electrical');
    setSubcategory('wiring');
    setIsActive(true);
    setEditingId(null);
  };

  // Submit question
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!questionText.trim()) {
      showToast('Question text is required', 'error');
      return;
    }

    if (options.some(opt => !opt.trim())) {
      showToast('All options must be filled', 'error');
      return;
    }

    const questionData = {
      questionText,
      options,
      correctAnswer,
      category,
      subcategory,
      isActive
    };

    try {
      let response;
      const url = editingId 
        ? `${API}/question/${editingId}`
        : `${API}/question`;

      const method = editingId ? 'PUT' : 'POST';

      response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(questionData)
      });

      if (!response.ok) {
        if (response.status === 401) {
          logoutUser();
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save question');
      }

      const data = await response.json();
      showToast(editingId ? 'Question updated successfully' : 'Question added successfully');
      resetForm();
      fetchQuestions();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // Edit question
  const handleEdit = (question) => {
    setQuestionText(question.questionText);
    setOptions(question.options);
    setCorrectAnswer(question.correctAnswer);
    setCategory(question.category);
    setSubcategory(question.subcategory);
    setIsActive(question.isActive);
    setEditingId(question._id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete question
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    
    try {
      const response = await fetch(`${API}/question/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          logoutUser();
          return;
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
      const response = await fetch(`${API}/question/${id}`, {
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
          return;
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
          category,
          subcategory,
          isActive
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
          return;
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
      const queryParams = new URLSearchParams();
      if (filterCategory) queryParams.append('category', filterCategory);
      if (filterSubcategory) queryParams.append('subcategory', filterSubcategory);

      window.open(`${API}/question/download/pdf?${queryParams.toString()}`, '_blank');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Manage Test Questions</h1>
      
      {/* Question Form */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">
          {editingId ? 'Edit Question' : 'Add New Question'}
        </h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2" htmlFor="questionText">
              Question Text *
            </label>
            <textarea
              id="questionText"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Options *</label>
            {options.map((option, index) => (
              <div key={index} className="flex items-center mb-2">
                <input
                  type="radio"
                  name="correctAnswer"
                  checked={correctAnswer === index}
                  onChange={() => setCorrectAnswer(index)}
                  className="mr-2"
                />
                <input
                  type="text"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  required
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    className="ml-2 px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            
            {options.length < 5 && (
              <button
                type="button"
                onClick={addOption}
                className="mt-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Add Option
              </button>
            )}
            <p className="text-sm text-gray-500 mt-1">Minimum 2 options, maximum 5 options</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-gray-700 mb-2" htmlFor="category">
                Category *
              </label>
              <select
                id="category"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                <option value="electrical">Electrical</option>
                <option value="general">General</option>
              </select>
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2" htmlFor="subcategory">
                Subcategory *
              </label>
              <select
                id="subcategory"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                required
              >
                <option value="wiring">Wiring</option>
                <option value="ac">AC</option>
                <option value="repair">Repair</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>
          
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                className="form-checkbox h-5 w-5 text-blue-600"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span className="ml-2 text-gray-700">Active</span>
            </label>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {editingId ? 'Update Question' : 'Add Question'}
            </button>
            
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
            )}
            
            <button
              type="button"
              onClick={() => setShowBulkUpload(!showBulkUpload)}
              className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {showBulkUpload ? 'Hide Bulk Upload' : 'Bulk Upload'}
            </button>
          </div>
        </form>
      </div>
      
      {/* Bulk Upload Section */}
      {showBulkUpload && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Bulk Upload Questions</h2>
          
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">
              Enter questions in the following format (one question per block):
            </label>
            <pre className="bg-gray-100 p-4 rounded-md mb-4 text-sm">
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
            
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="10"
              value={bulkQuestions}
              onChange={(e) => setBulkQuestions(e.target.value)}
              placeholder="Paste questions here in the specified format..."
            />
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={handleBulkUpload}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              Upload Questions
            </button>
            
            <button
              onClick={() => setBulkQuestions('')}
              className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Clear
            </button>
          </div>
        </div>
      )}
      
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Filters</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-gray-700 mb-2">Search</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search questions..."
            />
          </div>
          
          <div>
            <label className="block text-gray-700 mb-2">Category</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              <option value="electrical">Electrical</option>
              <option value="general">General</option>
            </select>
          </div>
          
          <div>
            <label className="block text-gray-700 mb-2">Subcategory</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filterSubcategory}
              onChange={(e) => setFilterSubcategory(e.target.value)}
            >
              <option value="">All Subcategories</option>
              <option value="wiring">Wiring</option>
              <option value="ac">AC</option>
              <option value="repair">Repair</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>
        
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleDownloadPDF}
            className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Download as PDF
          </button>
        </div>
      </div>
      
      {/* Questions List */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-700">Questions List</h2>
          <p className="text-gray-600">{questions.length} questions found</p>
        </div>
        
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            <p className="mt-2 text-gray-600">Loading questions...</p>
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No questions found. Add some questions to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Question</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subcategory</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {questions.map((question) => (
                  <tr key={question._id}>
                    <td className="px-6 py-4 whitespace-normal max-w-xs">
                      <div className="text-sm font-medium text-gray-900">{question.questionText}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        {question.options.map((opt, idx) => (
                          <div key={idx} className={idx === question.correctAnswer ? 'font-bold text-green-600' : ''}>
                            {String.fromCharCode(97 + idx)}. {opt}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 capitalize">
                        {question.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap capitalize">
                      {question.subcategory}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span 
                        onClick={() => toggleStatus(question._id, question.isActive)}
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full cursor-pointer ${
                          question.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {question.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(question)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(question._id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminQuestions;