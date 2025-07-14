import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { Clock, CheckCircle, XCircle, Play, RotateCcw, Award, AlertCircle } from 'lucide-react';

const ProviderTestPage = () => {
  const { token, API, showToast } = useAuth();
  const [activeTab, setActiveTab] = useState('start');
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [currentTest, setCurrentTest] = useState(null);
  const [testResults, setTestResults] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutes
  const [loading, setLoading] = useState(false);
  const [testHistory, setTestHistory] = useState([]);

  // Timer effect
  useEffect(() => {
    if (currentTest && timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && currentTest) {
      handleSubmitTest();
    }
  }, [timeLeft, currentTest]);

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API}/test/categories`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.success) {
        setCategories(data.data.categories);
        setSubcategories(data.data.subcategories);
      }
    } catch (error) {
      showToast('Error fetching categories', 'error');
    }
  };

  // Fetch test history
  const fetchTestHistory = async () => {
    try {
      const response = await fetch(`${API}/test/results`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.success) {
        setTestHistory(data.data);
      }
    } catch (error) {
      showToast('Error fetching test history', 'error');
    }
  };

  // Start test
  const handleStartTest = async () => {
    if (!selectedCategory && !selectedSubcategory) {
      showToast('Please select a category or subcategory', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API}/test/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          category: selectedCategory,
          subcategory: selectedSubcategory
        })
      });

      const data = await response.json();
      if (data.success) {
        // Fetch test details
        const testResponse = await fetch(`${API}/test/details/${data.testId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        const testData = await testResponse.json();
        
        if (testData.success) {
          setCurrentTest(testData.data);
          setCurrentQuestionIndex(0);
          setAnswers({});
          setTimeLeft(1800);
          setActiveTab('test');
          showToast('Test started successfully!');
        }
      } else {
        showToast(data.message, 'error');
      }
    } catch (error) {
      showToast('Error starting test', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Select answer
  const handleAnswerSelect = (questionId, optionIndex) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: optionIndex
    }));
  };

  // Submit test
  const handleSubmitTest = async () => {
    if (!currentTest) return;

    setLoading(true);
    try {
      const formattedAnswers = Object.entries(answers).map(([questionId, selectedOption]) => ({
        questionId,
        selectedOption
      }));

      const response = await fetch(`${API}/test/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          testId: currentTest.testId,
          answers: formattedAnswers
        })
      });

      const data = await response.json();
      if (data.success) {
        setTestResults(data.results);
        setCurrentTest(null);
        setActiveTab('results');
        showToast('Test submitted successfully!');
        fetchTestHistory();
      } else {
        showToast(data.message, 'error');
      }
    } catch (error) {
      showToast('Error submitting test', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    fetchCategories();
    fetchTestHistory();
  }, []);

  // Get performance color
  const getPerformanceColor = (performance) => {
    switch (performance) {
      case 'Excellent': return 'text-green-600';
      case 'Good': return 'text-blue-600';
      case 'Satisfactory': return 'text-yellow-600';
      default: return 'text-red-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Provider Test Center</h1>
          <p className="text-gray-600">Take your certification test to become a verified provider</p>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <nav className="flex space-x-8 px-6">
            {['start', 'test', 'results', 'history'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                disabled={tab === 'test' && !currentTest}
                className={`py-4 px-2 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                } ${tab === 'test' && !currentTest ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {tab === 'start' && <Play className="w-4 h-4 inline mr-2" />}
                {tab === 'test' && <Clock className="w-4 h-4 inline mr-2" />}
                {tab === 'results' && <Award className="w-4 h-4 inline mr-2" />}
                {tab === 'history' && <RotateCcw className="w-4 h-4 inline mr-2" />}
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Start Test Tab */}
        {activeTab === 'start' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-6">Start New Test</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Category</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subcategory
                </label>
                <select
                  value={selectedSubcategory}
                  onChange={(e) => setSelectedSubcategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Subcategory</option>
                  {subcategories.map((subcategory) => (
                    <option key={subcategory} value={subcategory}>
                      {subcategory}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-blue-900 mb-2">Test Information</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Total Questions: 10</li>
                <li>• Time Limit: 30 minutes</li>
                <li>• Passing Score: 70%</li>
                <li>• You can retake the test if you don't pass</li>
              </ul>
            </div>

            <button
              onClick={handleStartTest}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Starting Test...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Test
                </>
              )}
            </button>
          </div>
        )}

        {/* Test Tab */}
        {activeTab === 'test' && currentTest && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            {/* Test Header */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-semibold">
                  Question {currentQuestionIndex + 1} of {currentTest.questions.length}
                </h2>
                <p className="text-gray-600">
                  {currentTest.category} - {currentTest.subcategory}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-red-600">
                  {formatTime(timeLeft)}
                </div>
                <div className="text-sm text-gray-600">Time Remaining</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / currentTest.questions.length) * 100}%` }}
              ></div>
            </div>

            {/* Question */}
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-4">
                {currentTest.questions[currentQuestionIndex].questionText}
              </h3>
              
              <div className="space-y-3">
                {currentTest.questions[currentQuestionIndex].options.map((option, index) => (
                  <label
                    key={index}
                    className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="radio"
                      name={`question-${currentTest.questions[currentQuestionIndex].questionId}`}
                      value={index}
                      checked={answers[currentTest.questions[currentQuestionIndex].questionId] === index}
                      onChange={() => handleAnswerSelect(currentTest.questions[currentQuestionIndex].questionId, index)}
                      className="mr-3"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
              <button
                onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                disabled={currentQuestionIndex === 0}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              <div className="flex space-x-3">
                {currentQuestionIndex < currentTest.questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={handleSubmitTest}
                    disabled={loading}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Submitting...' : 'Submit Test'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Results Tab */}
        {activeTab === 'results' && testResults && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-center mb-6">
              <div className={`text-4xl font-bold mb-2 ${testResults.passed ? 'text-green-600' : 'text-red-600'}`}>
                {testResults.score}%
              </div>
              <div className="text-lg font-medium mb-2">
                {testResults.passed ? (
                  <span className="text-green-600 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Congratulations! You passed!
                  </span>
                ) : (
                  <span className="text-red-600 flex items-center justify-center">
                    <XCircle className="w-5 h-5 mr-2" />
                    You didn't pass this time
                  </span>
                )}
              </div>
              <div className={`text-sm ${getPerformanceColor(testResults.performance)}`}>
                Performance: {testResults.performance}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">{testResults.correctAnswers}</div>
                <div className="text-sm text-blue-800">Correct Answers</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-gray-600">{testResults.totalQuestions}</div>
                <div className="text-sm text-gray-800">Total Questions</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">{Math.floor(testResults.timeTaken / 60)}m</div>
                <div className="text-sm text-green-800">Time Taken</div>
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={() => setActiveTab('start')}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
              >
                Take Another Test
              </button>
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-6">Test History</h2>
            
            {testHistory.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No test history available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {testHistory.map((test, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium">{test.category} - {test.subcategory}</h3>
                        <p className="text-sm text-gray-600">
                          {new Date(test.date).toLocaleDateString()} at {new Date(test.date).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${test.passed ? 'text-green-600' : 'text-red-600'}`}>
                          {test.score}%
                        </div>
                        <div className={`text-xs ${getPerformanceColor(test.performance)}`}>
                          {test.performance}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm text-gray-600">
                      <span>Time: {Math.floor(test.timeTaken / 60)}m {test.timeTaken % 60}s</span>
                      <span>Questions: {test.questionsAnswered}</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        test.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {test.passed ? 'Passed' : 'Failed'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderTestPage;




