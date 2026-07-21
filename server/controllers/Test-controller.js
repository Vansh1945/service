const TestAttempt = require('../models/TestAttempt-model');
const Question = require('../models/AddQuestion-model');
const { Category } = require('../models/SystemSetting-model');
const Provider = require('../models/Provider-model');

// @desc    Get active categories and provider exam attempt cooldown status
// @route   GET /api/test/categories
// @access  Provider Private
exports.getTestCategories = async (req, res, next) => {
  try {
    const providerId = req.user?._id || req.provider?._id;
    if (!providerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized access' });
    }

    // Fetch active categories
    const categories = await Category.find({ isActive: true }).lean();

    // Check for cooldown (24 hours after a failed attempt)
    const latestAttempt = await TestAttempt.findOne({ providerId })
      .sort({ createdAt: -1 })
      .lean();

    let cooldown = { isCooldown: false, remainingHours: 0, remainingMinutes: 0 };

    if (latestAttempt && latestAttempt.status !== 'active' && !latestAttempt.passed) {
      const timeSinceLastAttempt = Date.now() - new Date(latestAttempt.createdAt).getTime();
      const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 hours

      if (timeSinceLastAttempt < cooldownPeriod) {
        const remainingMs = cooldownPeriod - timeSinceLastAttempt;
        const totalMinutes = Math.ceil(remainingMs / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        cooldown = {
          isCooldown: true,
          remainingHours: hours,
          remainingMinutes: minutes
        };
      }
    }

    res.status(200).json({
      success: true,
      data: {
        categories,
        cooldown
      }
    });
  } catch (error) {
    global.logger.error(`[TestController.getTestCategories] Error: ${error.message}`, error);
    next(error);
  }
};

// @desc    Start a new provider exam test session
// @route   POST /api/test/start
// @access  Provider Private
exports.startTest = async (req, res, next) => {
  try {
    const providerId = req.user?._id || req.provider?._id;
    if (!providerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized access' });
    }

    const { categories } = req.body;

    // 1. Check if there's already an active test session
    const activeSession = await TestAttempt.findOne({ providerId, status: 'active' });
    if (activeSession) {
      // Check if it's expired
      if (Date.now() > new Date(activeSession.endTime).getTime()) {
        activeSession.status = 'expired';
        await activeSession.save();
      } else {
        return res.status(400).json({
          success: false,
          message: 'You already have an active test session. Please resume it.',
          testId: activeSession._id
        });
      }
    }

    // 2. Check total lifetime attempts (max 3)
    const attemptsCount = await TestAttempt.countDocuments({
      providerId,
      status: { $in: ['submitted', 'expired'] }
    });
    if (attemptsCount >= 3) {
      return res.status(400).json({
        success: false,
        message: 'You have used all 3 lifetime test attempts.'
      });
    }

    // 3. Cooldown check
    const latestAttempt = await TestAttempt.findOne({ providerId })
      .sort({ createdAt: -1 })
      .lean();
    if (latestAttempt && latestAttempt.status !== 'active' && !latestAttempt.passed) {
      const timeSinceLastAttempt = Date.now() - new Date(latestAttempt.createdAt).getTime();
      const cooldownPeriod = 24 * 60 * 60 * 1000;
      if (timeSinceLastAttempt < cooldownPeriod) {
        return res.status(400).json({
          success: false,
          message: 'You are currently in cooldown. Please try again later.'
        });
      }
    }

    // 4. Generate random questions for selected categories (5 questions per category)
    const examQuestions = [];
    for (const catId of categories) {
      const cat = await Category.findById(catId).lean();
      if (!cat) continue;

      const questions = await Question.find({ category: catId, isActive: true }).lean();
      if (!questions || questions.length === 0) continue;

      // Select up to 5 random questions
      const shuffled = questions.sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 5);

      selected.forEach(q => {
        examQuestions.push({
          questionId: q._id,
          questionText: q.questionText,
          options: q.options,
          correctAnswer: q.correctAnswer,
          categoryName: cat.name
        });
      });
    }

    if (examQuestions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No questions found for the selected categories.'
      });
    }

    // 5. Create new attempt
    const newAttempt = new TestAttempt({
      providerId,
      categories,
      questions: examQuestions,
      startTime: new Date(),
      endTime: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes session
      status: 'active'
    });

    await newAttempt.save();

    res.status(201).json({
      success: true,
      message: 'Test started successfully',
      testId: newAttempt._id
    });
  } catch (error) {
    global.logger.error(`[TestController.startTest] Error: ${error.message}`, error);
    next(error);
  }
};

// @desc    Get the details of a specific test session (hides correctAnswer for security)
// @route   GET /api/test/details/:testId
// @access  Provider Private
exports.getTestDetails = async (req, res, next) => {
  try {
    const providerId = req.user?._id || req.provider?._id;
    const { testId } = req.params;

    const attempt = await TestAttempt.findOne({ _id: testId, providerId });
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Test attempt not found' });
    }

    // Check expiry
    if (attempt.status === 'active' && Date.now() > new Date(attempt.endTime).getTime()) {
      attempt.status = 'expired';
      await attempt.save();
      return res.status(400).json({ success: false, message: 'Test session has expired' });
    }

    // Format questions to hide correctAnswer index for exam integrity
    const secureQuestions = attempt.questions.map(q => ({
      questionId: q.questionId,
      questionText: q.questionText,
      options: q.options,
      categoryName: q.categoryName
    }));

    res.status(200).json({
      success: true,
      data: {
        testId: attempt._id,
        questions: secureQuestions
      }
    });
  } catch (error) {
    global.logger.error(`[TestController.getTestDetails] Error: ${error.message}`, error);
    next(error);
  }
};

// @desc    Get active/ongoing test session of the provider
// @route   GET /api/test/active
// @access  Provider Private
exports.getActiveTest = async (req, res, next) => {
  try {
    const providerId = req.user?._id || req.provider?._id;
    if (!providerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized access' });
    }

    const attempt = await TestAttempt.findOne({ providerId, status: 'active' });
    if (!attempt) {
      return res.status(200).json({ success: true, data: null });
    }

    // Check expiry
    if (Date.now() > new Date(attempt.endTime).getTime()) {
      attempt.status = 'expired';
      await attempt.save();
      return res.status(200).json({ success: true, expired: true });
    }

    const timeRemaining = Math.max(0, Math.floor((new Date(attempt.endTime).getTime() - Date.now()) / 1000));

    // Format questions to hide correctAnswer index
    const secureQuestions = attempt.questions.map(q => ({
      questionId: q.questionId,
      questionText: q.questionText,
      options: q.options,
      categoryName: q.categoryName
    }));

    res.status(200).json({
      success: true,
      data: {
        testId: attempt._id,
        timeRemaining,
        questions: secureQuestions
      }
    });
  } catch (error) {
    global.logger.error(`[TestController.getActiveTest] Error: ${error.message}`, error);
    next(error);
  }
};

// @desc    Submit answers and evaluate results
// @route   POST /api/test/submit
// @access  Provider Private
exports.submitTest = async (req, res, next) => {
  try {
    const providerId = req.user?._id || req.provider?._id;
    const { testId, answers } = req.body;

    const attempt = await TestAttempt.findOne({ _id: testId, providerId });
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Test attempt not found' });
    }

    if (attempt.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Test is already submitted or expired' });
    }

    // Check if time expired
    if (Date.now() > new Date(attempt.endTime).getTime()) {
      attempt.status = 'expired';
      await attempt.save();
      return res.status(400).json({ success: false, message: 'Test session has expired' });
    }

    // Evaluate answers
    const answersMap = new Map();
    answers.forEach(ans => {
      answersMap.set(ans.questionId.toString(), ans.selectedOption);
    });

    let correctCount = 0;
    const totalQuestions = attempt.questions.length;

    attempt.questions.forEach(q => {
      const selected = answersMap.get(q.questionId.toString());
      if (selected !== undefined && selected === q.correctAnswer) {
        correctCount++;
      }
    });

    const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
    const passed = score >= 70; // 70% passing grade

    // Update attempt record
    attempt.answers = answers;
    attempt.score = score;
    attempt.passed = passed;
    attempt.status = 'submitted';
    attempt.submittedAt = new Date();
    await attempt.save();

    // If passed, update Provider object
    if (passed) {
      await Provider.findOneAndUpdate(
        { _id: providerId },
        { testPassed: true },
        { new: true }
      );
    }

    res.status(200).json({
      success: true,
      results: {
        score,
        passed,
        correctCount,
        totalCount: totalQuestions
      }
    });
  } catch (error) {
    global.logger.error(`[TestController.submitTest] Error: ${error.message}`, error);
    next(error);
  }
};

// @desc    Get all exam attempts history of the provider
// @route   GET /api/test/results
// @access  Provider Private
exports.getTestResults = async (req, res, next) => {
  try {
    const providerId = req.user?._id || req.provider?._id;
    if (!providerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized access' });
    }

    const history = await TestAttempt.find({ providerId })
      .populate('categories', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const formattedHistory = history.map(h => ({
      testId: h._id,
      score: h.score,
      passed: h.passed,
      status: h.status,
      categories: h.categories?.map(c => c.name) || [],
      submittedAt: h.submittedAt || h.createdAt,
      createdAt: h.createdAt
    }));

    res.status(200).json({
      success: true,
      data: formattedHistory
    });
  } catch (error) {
    global.logger.error(`[TestController.getTestResults] Error: ${error.message}`, error);
    next(error);
  }
};

