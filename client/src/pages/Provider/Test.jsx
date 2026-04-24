import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/auth';
import * as TestService from '../../services/TestService';
import {
  Clock, CheckCircle, XCircle, Play, RotateCcw, Award, AlertCircle,
  BookOpen, Target, TrendingUp, Calendar, User, ChevronLeft,
  ChevronRight, Bookmark, BookmarkCheck, RefreshCw, Download,
  Timer, Zap, Star, Trophy, BarChart3, Activity, X, ChevronDown, Loader2
} from 'lucide-react';

const useTestTimer = (initialTime, isActive, onTimeUp) => {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [isWarning, setIsWarning] = useState(false);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(prev => {
          const newTime = prev - 1;
          setIsWarning(newTime <= 120);
          return newTime;
        });
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && isActive) {
      onTimeUp();
    }
  }, [timeLeft, isActive, onTimeUp]);

  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return { timeLeft, formatTime, isWarning, setTimeLeft };
};

const useTestData = (token, API, showToast) => {
  const [testHistory, setTestHistory] = useState([]);

  const fetchTestHistory = useCallback(async () => {
    try {
      const res = await TestService.getTestResults();
      if (res.data?.success) {
        setTestHistory(res.data.data);
      }
    } catch (error) {
      showToast('Error fetching test history', 'error');
    }
  }, [showToast]);

  return {
    testHistory,
    fetchTestHistory
  };
};

const ProgressBar = React.memo(({ current, total, className = "" }) => {
  const percentage = (current / total) * 100;
  return (
    <div className={`w-full bg-gray-200/50 rounded-full h-3 overflow-hidden ${className}`}>
      <div
        className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500 ease-out relative"
        style={{ width: `${percentage}%` }}
      >
        <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
      </div>
    </div>
  );
});

const TimerDisplay = React.memo(({ timeLeft, formatTime, isWarning, className = "" }) => (
  <div className={`text-center ${className}`}>
    <div className={`text-3xl font-bold transition-colors duration-300 ${isWarning ? 'text-red-500 animate-pulse' : 'text-primary'}`}>
      {formatTime(timeLeft)}
    </div>
    <div className="text-sm text-secondary/80 flex items-center justify-center mt-1">
      <Timer className="w-4 h-4 mr-1" />
      Time Remaining
    </div>
    {isWarning && (
      <div className="text-xs text-red-500 mt-1 animate-bounce">
        ⚠️ Hurry up! Less than 2 minutes left
      </div>
    )}
  </div>
));

const QuestionNavigation = React.memo(({
  questions,
  currentIndex,
  answers,
  bookmarkedQuestions,
  onQuestionSelect,
  onToggleBookmark
}) => (
  <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-4 mb-6 border border-white/20">
    <h3 className="text-sm font-medium text-secondary mb-3 flex items-center">
      <BookOpen className="w-4 h-4 mr-2 text-primary" />
      Question Navigator
    </h3>
    <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
      {questions.map((question, index) => {
        const isAnswered = answers[question.questionId] !== undefined;
        const isBookmarked = bookmarkedQuestions.has(question.questionId);
        const isCurrent = index === currentIndex;
        return (
          <button
            key={question.questionId}
            onClick={() => onQuestionSelect(index)}
            className={`relative w-10 h-10 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-110 ${isCurrent
              ? 'bg-primary text-white shadow-lg scale-105 ring-2 ring-primary/30'
              : isAnswered
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100/70 text-secondary/70 hover:bg-gray-200/80'
              }`}
          >
            {index + 1}
            {isBookmarked && (
              <Bookmark className="absolute -top-1 -right-1 w-3 h-3 text-accent fill-current" />
            )}
          </button>
        );
      })}
    </div>
    <div className="flex items-center justify-between mt-3 text-xs text-secondary/60">
      <div className="flex items-center space-x-4">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-green-100 rounded mr-1"></div>
          Answered
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-gray-100 rounded mr-1"></div>
          Not Answered
        </div>
        <div className="flex items-center">
          <Bookmark className="w-3 h-3 text-accent mr-1" />
          Bookmarked
        </div>
      </div>
    </div>
  </div>
));

const PerformanceAnalytics = React.memo(({ testResults, testHistory }) => {
  const analytics = useMemo(() => {
    if (!testHistory.length) return null;
    const avgScore = testHistory.reduce((sum, test) => sum + test.score, 0) / testHistory.length;
    const passRate = (testHistory.filter(test => test.passed).length / testHistory.length) * 100;
    const improvement = testHistory.length > 1
      ? testResults.score - testHistory[testHistory.length - 2].score
      : 0;
    return { avgScore, passRate, improvement };
  }, [testHistory, testResults]);

  if (!analytics) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm p-4 rounded-xl border border-white/20 shadow-sm hover:shadow-md transition-all duration-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-primary font-medium">Average Score</p>
            <p className="text-2xl font-bold text-primary">{analytics.avgScore.toFixed(1)}%</p>
          </div>
          <BarChart3 className="w-8 h-8 text-primary/70" />
        </div>
      </div>
      <div className="bg-gradient-to-r from-green-100/30 to-green-100/10 backdrop-blur-sm p-4 rounded-xl border border-white/20 shadow-sm hover:shadow-md transition-all duration-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-green-700 font-medium">Pass Rate</p>
            <p className="text-2xl font-bold text-green-700">{analytics.passRate.toFixed(1)}%</p>
          </div>
          <Target className="w-8 h-8 text-green-600/70" />
        </div>
      </div>
      <div className="bg-gradient-to-r from-purple-100/30 to-purple-100/10 backdrop-blur-sm p-4 rounded-xl border border-white/20 shadow-sm hover:shadow-md transition-all duration-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-purple-700 font-medium">Improvement</p>
            <p className={`text-2xl font-bold ${analytics.improvement >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {analytics.improvement > 0 ? '+' : ''}{analytics.improvement.toFixed(1)}%
            </p>
          </div>
          <TrendingUp className="w-8 h-8 text-purple-600/70" />
        </div>
      </div>
    </div>
  );
});

const MultiCategorySelect = React.memo(({ selectedCategories, onToggleCategory, categories, maxSelection = 3 }) => {
  const [isOpen, setIsOpen] = useState(false);

  const selectedNames = categories
    .filter(c => selectedCategories.includes(c._id))
    .map(c => c.name)
    .join(', ');

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
        Categories * <span className="text-xs text-secondary/60 ml-1">(Select 1-{maxSelection})</span>
      </label>

      <div
        className="w-full px-4 py-3 border border-gray-300 rounded-lg cursor-pointer bg-white flex items-center justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`text-sm ${selectedCategories.length > 0 ? 'text-secondary' : 'text-gray-400'}`}>
          {selectedCategories.length > 0 ? selectedNames : 'Select categories...'}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {categories.map(category => (
            <label
              key={category._id}
              className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
            >
              <input
                type="checkbox"
                checked={selectedCategories.includes(category._id)}
                onChange={() => onToggleCategory(category._id)}
                disabled={!selectedCategories.includes(category._id) && selectedCategories.length >= maxSelection}
                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary mr-3"
              />
              <span className={`text-sm ${!selectedCategories.includes(category._id) && selectedCategories.length >= maxSelection ? 'text-gray-400' : 'text-secondary'}`}>
                {category.name}
              </span>
            </label>
          ))}
        </div>
      )}

      {selectedCategories.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selectedCategories.map(id => {
            const category = categories.find(c => c._id === id);
            return category ? (
              <span key={id} className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary text-xs rounded-full">
                {category.name}
                <button onClick={() => onToggleCategory(id)} className="hover:text-primary/70">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ) : null;
          })}
        </div>
      )}

      <p className="text-xs text-secondary/50 mt-1">
        {selectedCategories.length}/{maxSelection} categories selected
      </p>
    </div>
  );
});

const ProviderTestPage = () => {
  const { token, API, showToast } = useAuth();

  const [activeTab, setActiveTab] = useState('start');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [currentTest, setCurrentTest] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState(new Set());
  const [testAttemptsLeft, setTestAttemptsLeft] = useState(3);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('saved');
  const [categories, setCategories] = useState([]);
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [testQuestions, setTestQuestions] = useState([]);
  const [allTestData, setAllTestData] = useState({});
  const [cooldown, setCooldown] = useState(null);

  const { timeLeft, formatTime, isWarning, setTimeLeft } = useTestTimer(
    600,
    !!currentTest,
    () => handleSubmitTest()
  );

  const { testHistory, fetchTestHistory } = useTestData(token, API, showToast);

  useEffect(() => {
    if (currentTest && Object.keys(answers).length > 0) {
      setAutoSaveStatus('saving');
      const timer = setTimeout(() => {
        localStorage.setItem(`test_answers_${currentTest.testId}`, JSON.stringify(answers));
        setAutoSaveStatus('saved');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [answers, currentTest]);

  useEffect(() => {
    if (currentTest) {
      const savedAnswers = localStorage.getItem(`test_answers_${currentTest.testId}`);
      if (savedAnswers) {
        setAnswers(JSON.parse(savedAnswers));
      }
    }
  }, [currentTest]);

  const getPerformanceColor = useCallback((performance) => {
    const colors = {
      'Excellent': 'text-green-600',
      'Good': 'text-primary',
      'Satisfactory': 'text-yellow-600',
      'Poor': 'text-red-600'
    };
    return colors[performance] || 'text-secondary';
  }, []);

  const handleToggleCategory = useCallback((categoryId) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      } else {
        if (prev.length < 3) {
          return [...prev, categoryId];
        }
        return prev;
      }
    });
  }, []);



  const handleStartTest = useCallback(async () => {
    if (selectedCategories.length === 0) {
      showToast('Please select at least one category', 'error');
      return;
    }

    if (testAttemptsLeft <= 0) {
      showToast('You have used all 3 lifetime test attempts', 'error');
      return;
    }

    try {
      // Start test with all selected categories in one request
      const res = await TestService.startTest({ categories: selectedCategories });
      const data = res.data;

      if (data.success) {
        // Fetch the full test details including questions
        const testId = data.testId;
        const detailsRes = await TestService.getTestDetails(testId);
        const detailsData = detailsRes.data;
        
        if (detailsData.success) {
          const testData = detailsData.data;
          
          setCurrentTest(testData);
          setCurrentQuestionIndex(0);
          setAnswers({});
          setBookmarkedQuestions(new Set());
          setTimeLeft(600);
          setActiveTab('test');
          showToast('Test started successfully! 10 minute timer has begun.', 'success');
        } else {
          showToast(detailsData.message || 'Failed to load test questions', 'error');
        }
      } else {
        showToast(data.message || 'Failed to start test', 'error');
      }
    } catch (error) {
      console.error('Error starting test:', error);
      showToast('Error starting test', 'error');
    }
  }, [selectedCategories, testAttemptsLeft, showToast, setTimeLeft]);

  const handleAnswerSelect = useCallback((questionId, optionIndex) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: optionIndex
    }));
  }, []);

  const handleToggleBookmark = useCallback((questionId) => {
    setBookmarkedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  }, []);

  const handleSubmitTest = useCallback(async () => {
    if (!currentTest) return;

    try {
      const formattedAnswers = Object.entries(answers).map(([questionId, selectedOption]) => ({
        questionId,
        selectedOption
      }));

      const res = await TestService.submitTest({
        testId: currentTest.testId,
        answers: formattedAnswers
      });

      const data = res.data;
      if (data.success) {
        setTestResults(data.results);
        setCurrentTest(null);
        setActiveTab('results');
        setShowConfirmSubmit(false);
        localStorage.removeItem(`test_answers_${currentTest.testId}`);
        showToast('Test submitted successfully!', 'success');
        fetchTestHistory();
      } else {
        showToast(data.message || 'Failed to submit test', 'error');
      }
    } catch (error) {
      showToast('Error submitting test', 'error');
    }
  }, [currentTest, answers, showToast, fetchTestHistory]);

  useEffect(() => {
    const checkActiveTest = async () => {
      try {
        const res = await TestService.getActiveTest();
        const data = res.data;

        if (data.success && data.data) {
          const activeTest = data.data;
          setCurrentTest(activeTest);
          setCurrentQuestionIndex(0);
          setTimeLeft(activeTest.timeRemaining);
          setActiveTab('test');

          const savedAnswers = localStorage.getItem(`test_answers_${activeTest.testId}`);
          if (savedAnswers) {
            setAnswers(JSON.parse(savedAnswers));
          }

          showToast('Resumed your active test!', 'info');
        } else if (data.expired) {
          showToast('Your previous test has expired and been submitted.', 'warning');
          fetchTestHistory();
        }
      } catch (error) {
        console.error('Error checking active test:', error);
      }
    };

    fetchTestHistory();
    checkActiveTest();
  }, [showToast, fetchTestHistory]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await TestService.getTestCategories();
        const data = res.data;
        if (data.success) {
          setCategories(data.data.categories || []);
          setCooldown(data.data.cooldown || null);
        }
      } catch (error) {
        console.error('Fetch categories error:', error);
        showToast(error.response?.data?.message || 'Failed to fetch categories', 'error');
      }
    };
    fetchCategories();
  }, [showToast]);

  useEffect(() => {
    const attemptsUsed = testHistory.length;
    setTestAttemptsLeft(Math.max(0, 3 - attemptsUsed));
  }, [testHistory]);

  const tabs = [
    { id: 'start', label: 'Start Test', icon: Play, disabled: false },
    { id: 'test', label: 'Test', icon: Clock, disabled: !currentTest },
    { id: 'results', label: 'Results', icon: Award, disabled: !testResults },
    { id: 'history', label: 'History', icon: RotateCcw, disabled: false }
  ];

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 mb-6 border border-white/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-secondary mb-2 flex items-center">
                <Trophy className="w-8 h-8 mr-3 text-primary" />
                Provider Test Center
              </h1>
              <p className="text-secondary/80 flex items-center">
                <Zap className="w-4 h-4 mr-2 text-accent" />
                You have <span className="font-semibold text-primary mx-1">{testAttemptsLeft}</span>
                lifetime test attempts remaining
              </p>
            </div>
            <div className="mt-4 sm:mt-0">
              <div className="flex items-center space-x-2 text-sm text-secondary/70">
                <Activity className="w-4 h-4" />
                <span>Auto-save: </span>
                <span className={`font-medium ${autoSaveStatus === 'saved' ? 'text-green-600' : 'text-yellow-600'}`}>
                  {autoSaveStatus === 'saved' ? '✓ Saved' : '⏳ Saving...'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg mb-6 border border-white/20 overflow-hidden">
          <nav className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => !tab.disabled && setActiveTab(tab.id)}
                  disabled={tab.disabled}
                  className={`flex-1 py-4 px-6 font-medium text-sm transition-all duration-200 relative ${activeTab === tab.id
                    ? 'bg-primary text-white shadow-lg'
                    : tab.disabled
                      ? 'text-secondary/40 cursor-not-allowed bg-gray-50/50'
                      : 'text-secondary/80 hover:text-primary hover:bg-primary/10'
                    }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </div>
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary/70"></div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {activeTab === 'start' && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-white/20">
            <div className="flex items-center mb-6">
              <Play className="w-6 h-6 text-primary mr-3" />
              <h2 className="text-2xl font-semibold text-secondary">Start New Test</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="space-y-2">
                <MultiCategorySelect
                  selectedCategories={selectedCategories}
                  onToggleCategory={handleToggleCategory}
                  categories={categories}
                  maxSelection={3}
                />
              </div>
            </div>

            <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-6 mb-8 backdrop-blur-sm">
              <h3 className="font-semibold text-primary mb-4 flex items-center">
                <AlertCircle className="w-5 h-5 mr-2" />
                Test Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center space-x-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span className="text-sm text-primary">5-10 Questions per category</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-sm text-primary">10 Minutes</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="text-sm text-primary">70% to Pass</span>
                </div>
                <div className="flex items-center space-x-2">
                  <RefreshCw className="w-4 h-4 text-primary" />
                  <span className="text-sm text-primary">{testAttemptsLeft} Attempts Left</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleStartTest}
                disabled={testAttemptsLeft <= 0 || selectedCategories.length === 0 || cooldown?.isCooldown}
                className={`flex-1 sm:flex-none px-8 py-4 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center space-x-2 transform hover:scale-105 ${testAttemptsLeft <= 0 || selectedCategories.length === 0 || cooldown?.isCooldown
                  ? 'bg-red-500 text-white cursor-not-allowed opacity-75'
                  : 'bg-primary text-white hover:bg-primary/90 hover:shadow-lg'
                  }`}
              >
                {cooldown?.isCooldown ? (
                  <>
                    <Clock className="w-5 h-5" />
                    <span>Wait {cooldown.remainingHours}h {cooldown.remainingMinutes}m</span>
                  </>
                ) : testAttemptsLeft <= 0 ? (
                  <>
                    <XCircle className="w-5 h-5" />
                    <span>No Attempts Remaining</span>
                  </>
                ) : selectedCategories.length === 0 ? (
                  <>
                    <AlertCircle className="w-5 h-5" />
                    <span>Select Categories</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    <span>Start Test ({selectedCategories.length} {selectedCategories.length === 1 ? 'category' : 'categories'})</span>
                  </>
                )}
              </button>

              {testAttemptsLeft > 0 && (
                <button
                  onClick={() => fetchTestHistory()}
                  className="px-6 py-4 border border-gray-300/70 rounded-lg font-medium text-secondary hover:bg-white/50 transition-all duration-200 flex items-center justify-center space-x-2 backdrop-blur-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh</span>
                </button>
              )}
            </div>

            {testAttemptsLeft <= 0 && (
              <div className="mt-6 p-4 bg-red-50/80 border border-red-200/50 rounded-lg backdrop-blur-sm">
                <div className="flex items-center text-red-800">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  <span className="font-medium">
                    You have used all 3 lifetime test attempts and cannot take more tests.
                  </span>
                </div>
              </div>
            )}

            {cooldown?.isCooldown && (
              <div className="mt-6 p-4 bg-yellow-50/80 border border-yellow-200/50 rounded-lg backdrop-blur-sm">
                <div className="flex items-center text-yellow-800">
                  <Clock className="w-5 h-5 mr-2" />
                  <span className="font-medium">
                    Test attempt failed. To ensure quality, please review the material and try again after {cooldown.remainingHours}h {cooldown.remainingMinutes}m.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'test' && currentTest && (
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-white/20">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-secondary mb-2">
                    Question {currentQuestionIndex + 1} of {currentTest.questions.length}
                  </h2>
                    <p className="text-secondary/80 flex items-center">
                      <BookOpen className="w-4 h-4 mr-2" />
                      {currentTest.questions[currentQuestionIndex]?.categoryName || 
                       categories.find(cat => cat._id === currentTest.questions[currentQuestionIndex]?.categoryId)?.name || 
                       'Category'}
                    </p>
                </div>
                <TimerDisplay
                  timeLeft={timeLeft}
                  formatTime={formatTime}
                  isWarning={isWarning}
                />
              </div>

              <div className="mt-6">
                <ProgressBar
                  current={currentQuestionIndex + 1}
                  total={currentTest.questions.length}
                />
                <div className="flex justify-between text-sm text-secondary/70 mt-2">
                  <span>Progress</span>
                  <span>{Math.round(((currentQuestionIndex + 1) / currentTest.questions.length) * 100)}%</span>
                </div>
              </div>
            </div>

            <QuestionNavigation
              questions={currentTest.questions}
              currentIndex={currentQuestionIndex}
              answers={answers}
              bookmarkedQuestions={bookmarkedQuestions}
              onQuestionSelect={setCurrentQuestionIndex}
              onToggleBookmark={handleToggleBookmark}
            />

            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-white/20">
              <div className="flex items-start justify-between mb-6">
                <h3 className="text-xl font-medium text-secondary flex-1 pr-4">
                  {currentTest.questions[currentQuestionIndex].questionText}
                </h3>
                <button
                  onClick={() => handleToggleBookmark(currentTest.questions[currentQuestionIndex].questionId)}
                  className={`p-2 rounded-lg transition-colors duration-200 ${bookmarkedQuestions.has(currentTest.questions[currentQuestionIndex].questionId)
                    ? 'text-accent bg-accent/10 hover:bg-accent/20'
                    : 'text-secondary/50 hover:text-accent hover:bg-accent/10'
                    }`}
                >
                  {bookmarkedQuestions.has(currentTest.questions[currentQuestionIndex].questionId) ? (
                    <BookmarkCheck className="w-5 h-5" />
                  ) : (
                    <Bookmark className="w-5 h-5" />
                  )}
                </button>
              </div>

              <div className="space-y-3">
                {currentTest.questions[currentQuestionIndex].options.map((option, index) => (
                  <label
                    key={index}
                    className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${answers[currentTest.questions[currentQuestionIndex].questionId] === index
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-gray-200/70 hover:border-primary/50 hover:bg-primary/5'
                      }`}
                  >
                    <input
                      type="radio"
                      name={`question-${currentTest.questions[currentQuestionIndex].questionId}`}
                      value={index}
                      checked={answers[currentTest.questions[currentQuestionIndex].questionId] === index}
                      onChange={() => handleAnswerSelect(currentTest.questions[currentQuestionIndex].questionId, index)}
                      className="w-4 h-4 text-primary border-gray-300 focus:ring-primary mr-4"
                    />
                    <span className="text-secondary flex-1">{option}</span>
                    {answers[currentTest.questions[currentQuestionIndex].questionId] === index && (
                      <CheckCircle className="w-5 h-5 text-primary ml-2" />
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-white/20">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <button
                  onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="w-full sm:w-auto px-6 py-3 text-secondary border border-gray-300/70 rounded-lg hover:bg-white/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2 backdrop-blur-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <div className="flex items-center space-x-4">
                  <span className="text-sm text-secondary/70">
                    {Object.keys(answers).length} of {currentTest.questions.length} answered
                  </span>

                  {currentQuestionIndex < currentTest.questions.length - 1 ? (
                    <button
                      onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
                      className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all duration-200 flex items-center space-x-2 transform hover:scale-105"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowConfirmSubmit(true)}
                      className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 flex items-center space-x-2 transform hover:scale-105"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Submit Test</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {showConfirmSubmit && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                <div className="bg-white/95 backdrop-blur-md rounded-xl p-6 max-w-md w-full border border-white/20 shadow-2xl">
                  <h3 className="text-lg font-semibold text-secondary mb-4">Submit Test?</h3>
                  <p className="text-secondary/80 mb-6">
                    Are you sure you want to submit your test? You have answered {Object.keys(answers).length} out of {currentTest.questions.length} questions.
                  </p>
                  <div className="flex space-x-4">
                    <button
                      onClick={() => setShowConfirmSubmit(false)}
                      className="flex-1 px-4 py-2 border border-gray-300/70 rounded-lg text-secondary hover:bg-gray-50/80 transition-all duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitTest}
                      className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all duration-200 transform hover:scale-105"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'results' && testResults && (
          <div className="space-y-6">
            <PerformanceAnalytics testResults={testResults} testHistory={testHistory} />

            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-8 border border-white/20 text-center">
              <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 ${testResults.passed ? 'bg-green-100/80' : 'bg-red-100/80'}`}>
                {testResults.passed ? (
                  <CheckCircle className="w-10 h-10 text-green-600" />
                ) : (
                  <XCircle className="w-10 h-10 text-red-600" />
                )}
              </div>

              <div className={`text-5xl font-bold mb-4 ${testResults.passed ? 'text-green-600' : 'text-red-600'}`}>
                {testResults.score.toFixed(1)}%
              </div>

              <div className="text-xl font-semibold mb-2">
                {testResults.passed ? (
                  <span className="text-green-600 flex items-center justify-center">
                    <Trophy className="w-6 h-6 mr-2" />
                    Congratulations! You passed!
                  </span>
                ) : (
                  <span className="text-red-600 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 mr-2" />
                    You didn't pass this time
                  </span>
                )}
              </div>

              <div className={`text-lg mb-4 ${getPerformanceColor(testResults.performance)}`}>
                Performance: {testResults.performance}
              </div>

              <div className="text-secondary/80 mb-8">
                Attempts remaining: <span className="font-semibold">{testAttemptsLeft}</span>
              </div>

              {testResults.categoryResults && testResults.categoryResults.length > 0 && (
                <div className="mb-8">
                  <h4 className="font-semibold text-secondary mb-3">Results by Category</h4>
                  <div className="space-y-2">
                    {testResults.categoryResults.map((result, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-secondary">{result.categoryName}</span>
                        <span className={`text-sm font-medium ${result.passed ? 'text-green-600' : 'text-red-600'}`}>
                          {result.score}% {result.passed ? '✓' : '✗'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-primary/10 p-6 rounded-xl border border-primary/20 backdrop-blur-sm hover:shadow-md transition-all duration-300">
                  <div className="text-3xl font-bold text-primary mb-2">{testResults.correctAnswers}</div>
                  <div className="text-sm text-primary font-medium">Correct Answers</div>
                </div>
                <div className="bg-gray-100/50 p-6 rounded-xl border border-gray-200/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
                  <div className="text-3xl font-bold text-secondary mb-2">{testResults.totalQuestions}</div>
                  <div className="text-sm text-secondary font-medium">Total Questions</div>
                </div>
                <div className="bg-green-100/50 p-6 rounded-xl border border-green-200/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
                  <div className="text-3xl font-bold text-green-700 mb-2">
                    {Math.floor(testResults.timeTaken / 60)}m {testResults.timeTaken % 60}s
                  </div>
                  <div className="text-sm text-green-700 font-medium">Time Taken</div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => setActiveTab('start')}
                  disabled={testAttemptsLeft <= 0}
                  className={`px-8 py-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 ${testAttemptsLeft <= 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-primary text-white hover:bg-primary/90 hover:shadow-lg'
                    }`}
                >
                  {testAttemptsLeft <= 0 ? 'No Attempts Remaining' : 'Take Another Test'}
                </button>

                <button
                  onClick={() => setActiveTab('history')}
                  className="px-8 py-3 border border-gray-300/70 rounded-lg font-semibold text-secondary hover:bg-white/50 transition-all duration-200 backdrop-blur-sm"
                >
                  View History
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-secondary flex items-center">
                <RotateCcw className="w-6 h-6 mr-3 text-primary" />
                Test History
              </h2>
              {testHistory.length > 0 && (
                <button
                  onClick={() => showToast('Export feature coming soon!', 'info')}
                  className="px-4 py-2 text-primary border border-primary rounded-lg hover:bg-primary/10 transition-all duration-200 flex items-center space-x-2 backdrop-blur-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </button>
              )}
            </div>

            {testHistory.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-24 h-24 bg-gray-100/50 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                  <AlertCircle className="w-12 h-12 text-secondary/40" />
                </div>
                <h3 className="text-lg font-medium text-secondary mb-2">No test history available</h3>
                <p className="text-secondary/80 mb-6">Take your first test to see your results here</p>
                <button
                  onClick={() => setActiveTab('start')}
                  className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all duration-200 transform hover:scale-105"
                >
                  Start Your First Test
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {testHistory.map((test, index) => (
                  <div key={index} className="border border-gray-200/50 rounded-xl p-6 hover:shadow-md transition-all duration-200 backdrop-blur-sm bg-white/50">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <h3 className="font-semibold text-secondary mr-3">
                            {test.category}
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${test.passed
                            ? 'bg-green-100/80 text-green-800'
                            : 'bg-red-100/80 text-red-800'
                            }`}>
                            {test.passed ? 'Passed' : 'Failed'}
                          </span>
                        </div>
                        <div className="flex items-center text-sm text-secondary/70 space-x-4">
                          <span className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {new Date(test.date).toLocaleDateString()}
                          </span>
                          <span className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {Math.floor(test.timeTaken / 60)}m {test.timeTaken % 60}s
                          </span>
                          <span className="flex items-center">
                            <BookOpen className="w-4 h-4 mr-1" />
                            {test.questionsAnswered} questions
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className={`text-2xl font-bold mb-1 ${test.passed ? 'text-green-600' : 'text-red-600'}`}>
                          {test.score}%
                        </div>
                        <div className={`text-sm font-medium ${getPerformanceColor(test.performance)}`}>
                          {test.performance}
                        </div>
                      </div>
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