
const Question = require('../models/AddQuestion-model');
const ProviderTest = require('../models/Test-model');
const Provider = require('../models/Provider-model');
const { Category } = require('../models/SystemSetting');
const { ObjectId } = require('mongoose').Types;

// Test configuration
const TEST_CONFIG = {
    TIME_LIMIT: 10 * 60 * 1000, // 10 minutes in milliseconds
    PASSING_SCORE: 70,
    MIN_QUESTIONS_PER_TEST: 10, // Minimum questions required to start a test
    MAX_ATTEMPTS: 3 // Maximum attempts allowed per category
};

// Helper function to calculate performance rating
function getPerformanceRating(score) {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Very Good';
    if (score >= 70) return 'Good';
    return 'Needs Improvement';
}

// ===================== PROVIDER TEST FUNCTIONS ===================== //

/**
 * Get available test categories - Provider
 */
const getTestCategories = async (req, res) => {
    try {
        const provider = req.provider;
        
        // Get all categories that have questions
        const categories = await Question.distinct('category');

        // Get passed tests
        const passedTests = await ProviderTest.find({
            provider: provider._id,
            passed: true
        }).select('testCategories');

        // Extract all passed category IDs
        const lockedCategories = [];
        passedTests.forEach(test => {
            if (test.testCategories) {
                test.testCategories.forEach(catId => lockedCategories.push(catId.toString()));
            }
        });

        // Get attempt counts for each category
        const attemptCounts = await ProviderTest.aggregate([
            { $match: { provider: provider._id } },
            { $unwind: "$testCategories" },
            { $group: { 
                _id: "$testCategories", 
                attempts: { $sum: 1 },
                passed: { $max: { $cond: ["$passed", 1, 0] } }
            }},
            { $project: {
                category: "$_id",
                attempts: 1,
                passed: { $cond: ["$passed", true, false] },
                attemptsLeft: { $subtract: [TEST_CONFIG.MAX_ATTEMPTS, "$attempts"] }
            }}
        ]);

        res.json({
            success: true,
            data: {
                categories,
                lockedCategories: [...new Set(lockedCategories)],
                attemptCounts
            }
        });
    } catch (error) {
        console.error('Error getting test categories:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch test categories'
        });
    }
};

/**
 * Start a new test with selected category - Provider
 */
const startTest = async (req, res) => {
    try {
        const provider = req.provider;
        const { category, categories, services } = req.body;
        
        const categoryList = categories || services || (category ? [category] : []);

        if (categoryList.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Category is required'
            });
        }

        const primaryCategory = categoryList[0];

        const alreadyPassed = await ProviderTest.findOne({
            provider: provider._id,
            testCategories: { $in: categoryList },
            passed: true
        });

        if (alreadyPassed) {
            return res.status(400).json({
                success: false,
                message: 'You have already passed a test for one of these categories'
            });
        }

        const attemptCount = await ProviderTest.countDocuments({
            provider: provider._id,
            testCategories: { $in: categoryList }
        });

        if (attemptCount >= TEST_CONFIG.MAX_ATTEMPTS) {
            return res.status(400).json({
                success: false,
                message: `You have reached the maximum of ${TEST_CONFIG.MAX_ATTEMPTS} attempts for these categories`
            });
        }

        const activeTest = await ProviderTest.findOne({
            provider: provider._id,
            status: 'in-progress'
        });

        if (activeTest) {
            const timeElapsed = new Date() - activeTest.startedAt;
            if (timeElapsed > TEST_CONFIG.TIME_LIMIT) {
                activeTest.status = 'completed';
                activeTest.passed = false;
                activeTest.completedAt = new Date();
                activeTest.timeTaken = TEST_CONFIG.TIME_LIMIT / 1000;
                await activeTest.save();
            } else {
                return res.status(200).json({
                    success: true,
                    message: 'Resuming active test',
                    testId: activeTest._id,
                    timeRemaining: Math.max(0, Math.floor((TEST_CONFIG.TIME_LIMIT - timeElapsed) / 1000)),
                    isResumed: true
                });
            }
        }

        const query = {
            isActive: true,
            category: { $in: categoryList }
        };

        const allQuestions = await Question.find(query);

        if (allQuestions.length < TEST_CONFIG.MIN_QUESTIONS_PER_TEST) {
            return res.status(400).json({
                success: false,
                message: `At least ${TEST_CONFIG.MIN_QUESTIONS_PER_TEST} questions are required.`
            });
        }

        const numQuestions = Math.min(10, allQuestions.length);
        const shuffled = allQuestions.sort(() => 0.5 - Math.random());
        const questions = shuffled.slice(0, numQuestions);

        const test = new ProviderTest({
            provider: provider._id,
            questions: questions.map(q => ({
                questionId: q._id,
                questionText: q.questionText,
                options: q.options,
                correctAnswer: q.correctAnswer,
                categoryId: q.category, // Include category ID
                selectedOption: null,
                isCorrect: false,
                status: 'unanswered'
            })),
            status: 'in-progress',
            testCategories: categoryList,
            startedAt: new Date(),
            expiresAt: new Date(Date.now() + TEST_CONFIG.TIME_LIMIT),
            attemptNumber: attemptCount + 1
        });

        await test.save();

        res.status(201).json({
            success: true,
            message: 'Test started successfully',
            testId: test._id,
            totalQuestions: test.questions.length,
            testCategories: test.testCategories,
            startedAt: test.startedAt,
            expiresAt: test.expiresAt,
            timeLimit: TEST_CONFIG.TIME_LIMIT,
            attemptNumber: test.attemptNumber,
            attemptsRemaining: TEST_CONFIG.MAX_ATTEMPTS - test.attemptNumber
        });
    } catch (error) {
        console.error('Error starting test:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start test'
        });
    }
};

/**
 * Submit test answers - Provider
 */
const submitTest = async (req, res) => {
    try {
        const { testId, answers } = req.body;
        const provider = req.provider;

        // Validate input
        if (!testId || !answers) {
            return res.status(400).json({
                success: false,
                message: 'Test ID and answers are required'
            });
        }

        // Find and validate test
        const test = await ProviderTest.findOne({
            _id: testId,
            provider: provider._id,
            status: 'in-progress'
        });

        if (!test) {
            return res.status(404).json({
                success: false,
                message: 'Test not found or already submitted'
            });
        }

        // Check if test has expired
        const now = new Date();
        if (now > test.expiresAt) {
            test.status = 'completed';
            test.passed = false;
            test.completedAt = now;
            test.timeTaken = TEST_CONFIG.TIME_LIMIT;
            await test.save();
            
            return res.status(400).json({
                success: false,
                message: 'Test time has expired',
                results: {
                    testId: test._id,
                    score: 0,
                    passed: false,
                    correctAnswers: 0,
                    totalQuestions: test.questions.length,
                    timeTaken: TEST_CONFIG.TIME_LIMIT,
                    completedAt: now,
                    attemptsRemaining: TEST_CONFIG.MAX_ATTEMPTS - test.attemptNumber
                }
            });
        }

        // Process answers
        let answeredCount = 0;
        let correctCount = 0;

        test.questions.forEach(question => {
            const answer = answers.find(a =>
                a.questionId && question.questionId &&
                a.questionId.toString() === question.questionId.toString()
            );

            if (answer) {
                question.selectedOption = answer.selectedOption;
                question.isCorrect = answer.selectedOption === question.correctAnswer;
                question.status = 'answered';
                answeredCount++;

                if (question.isCorrect) {
                    correctCount++;
                }
            }
        });

        // Calculate score
        const score = Math.round((correctCount / test.questions.length) * 100) || 0;
        const passed = score >= TEST_CONFIG.PASSING_SCORE;

        // Update test results
        test.score = score;
        test.passed = passed;
        test.status = 'completed';
        test.completedAt = now;
        test.timeTaken = Math.floor((test.completedAt - test.startedAt) / 1000);
        test.questionsAnswered = answeredCount;

        await test.save();

        // Update provider status if passed
        if (passed) {
            await Provider.findByIdAndUpdate(
                provider._id,
                {
                    $addToSet: { passedTestCategories: { $each: test.testCategories } },
                    testScore: score,
                    testCompletionDate: new Date()
                },
                { new: true }
            );
        }

        res.json({
            success: true,
            message: 'Test submitted successfully',
            results: {
                testId: test._id,
                score,
                passed,
                correctAnswers: correctCount,
                totalQuestions: test.questions.length,
                timeTaken: test.timeTaken,
                testCategories: test.testCategories,
                categoryNames: (await Category.find({ _id: { $in: test.testCategories } }).select('name')).map(c => c.name).join(', '),
                completedAt: test.completedAt,
                performance: getPerformanceRating(score),
                attemptNumber: test.attemptNumber,
                attemptsRemaining: passed ? 0 : TEST_CONFIG.MAX_ATTEMPTS - test.attemptNumber
            }
        });
    } catch (error) {
        console.error('Error submitting test:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit test'
        });
    }
};

/**
 * Get test results history - Provider
 */
const getTestResults = async (req, res) => {
    try {
        const provider = req.provider;

        const results = await ProviderTest.find({ provider: provider._id })
            .sort({ completedAt: -1 })
            .select('testCategories score passed completedAt timeTaken questionsAnswered status attemptNumber')
            .populate('testCategories', 'name')
            .lean();

        // Calculate attempts remaining for each category
        const attemptsData = await ProviderTest.aggregate([
            { $match: { provider: provider._id } },
            { $unwind: "$testCategories" },
            { $group: { 
                _id: "$testCategories", 
                attempts: { $sum: 1 },
                passed: { $max: { $cond: ["$passed", 1, 0] } }
            }},
            { $project: {
                category: "$_id",
                attempts: 1,
                passed: { $cond: ["$passed", true, false] },
                attemptsLeft: { $subtract: [TEST_CONFIG.MAX_ATTEMPTS, "$attempts"] }
            }}
        ]);

        const formattedResults = results.map(test => {
            const categories = test.testCategories || [];
            const categoryNames = categories.map(c => c.name).join(', ') || 'Unknown';
            
            // Calculate attempts based on first category (approximation)
            const firstCatId = categories[0]?._id?.toString();
            const categoryData = firstCatId 
                ? (attemptsData.find(d => d.category?.toString() === firstCatId) || {})
                : {};
                
            return {
                testId: test._id,
                category: categoryNames,
                subcategory: test.testSubcategory,
                score: test.score || 0,
                passed: test.passed || false,
                status: test.status,
                date: test.completedAt,
                timeTaken: test.timeTaken,
                questionsAnswered: test.questionsAnswered || 0,
                performance: getPerformanceRating(test.score || 0),
                attemptNumber: test.attemptNumber || 1,
                attemptsRemaining: test.passed ? 0 : (categoryData.attemptsLeft || 0)
            };
        });

        res.json({
            success: true,
            data: formattedResults
        });
    } catch (error) {
        console.error('Error getting test results:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch test results'
        });
    }
};

/**
 * Get active test details - Provider
 */
const getActiveTest = async (req, res) => {
    try {
        const provider = req.provider;

        const activeTest = await ProviderTest.findOne({
            provider: provider._id,
            status: 'in-progress'
        })
        .populate('testCategories', 'name')
        .populate('questions.categoryId', 'name')
        .lean();

        if (!activeTest) {
            return res.json({
                success: true,
                data: null,
                message: 'No active test found'
            });
        }

        // Check if test has expired
        const now = new Date();
        if (now > activeTest.expiresAt) {
            // Auto-submit expired test
            activeTest.status = 'completed';
            activeTest.passed = false;
            activeTest.completedAt = now;
            activeTest.timeTaken = TEST_CONFIG.TIME_LIMIT / 1000; // Convert to seconds
            await ProviderTest.findByIdAndUpdate(activeTest._id, activeTest);

            return res.json({
                success: true,
                data: null,
                message: 'Test has expired and been auto-submitted',
                expired: true
            });
        }

        // Get attempts data using all categories in this test
        const attemptsData = await ProviderTest.aggregate([
            { $match: {
                provider: provider._id,
                testCategories: { $in: activeTest.testCategories || [] }
            }},
            { $unwind: "$testCategories" },
            { $group: {
                _id: null,
                attempts: { $sum: 1 },
                passed: { $max: { $cond: ["$passed", 1, 0] } }
            }},
            { $project: {
                attempts: 1,
                passed: { $cond: ["$passed", true, false] },
                attemptsLeft: { $subtract: [TEST_CONFIG.MAX_ATTEMPTS, "$attempts"] }
            }}
        ]);

        const timeRemaining = Math.max(0, Math.floor((activeTest.expiresAt - now) / 1000));

        const response = {
            testId: activeTest._id,
            status: activeTest.status,
            categories: activeTest.testCategories,
            startedAt: activeTest.startedAt,
            expiresAt: activeTest.expiresAt,
            timeRemaining,
            questions: activeTest.questions.map(q => ({
                questionId: q.questionId,
                questionText: q.questionText,
                options: q.options,
                selectedOption: q.selectedOption,
                categoryId: q.categoryId?._id || q.categoryId,
                categoryName: q.categoryId?.name
            })),
            attemptNumber: activeTest.attemptNumber,
            attemptsRemaining: attemptsData[0]?.attemptsLeft || 0
        };

        res.json({
            success: true,
            data: response
        });
    } catch (error) {
        console.error('Error getting active test:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch active test'
        });
    }
};

/**
 * Get specific test details - Provider
 */
const getTestDetails = async (req, res) => {
    try {
        const { testId } = req.params;
        const provider = req.provider;

        if (!ObjectId.isValid(testId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid test ID'
            });
        }

        const test = await ProviderTest.findOne({
            _id: testId,
            provider: provider._id
        })
        .populate('testCategories', 'name')
        .populate('questions.categoryId', 'name')
        .lean();

        if (!test) {
            return res.status(404).json({
                success: false,
                message: 'Test not found'
            });
        }

        // Get attempts data
        const attemptsData = await ProviderTest.aggregate([
            { $match: {
                provider: provider._id,
                testCategories: { $in: test.testCategories || [] }
            }},
            { $unwind: "$testCategories" },
            { $group: {
                _id: null,
                attempts: { $sum: 1 },
                passed: { $max: { $cond: ["$passed", 1, 0] } }
            }},
            { $project: {
                attempts: 1,
                passed: { $cond: ["$passed", true, false] },
                attemptsLeft: { $subtract: [TEST_CONFIG.MAX_ATTEMPTS, "$attempts"] }
            }}
        ]);

        const response = {
            testId: test._id,
            status: test.status,
            score: test.score,
            passed: test.passed,
            categories: test.testCategories,
            startedAt: test.startedAt,
            completedAt: test.completedAt,
            expiresAt: test.expiresAt,
            timeTaken: test.timeTaken,
            questions: test.questions.map(q => ({
                questionId: q.questionId,
                questionText: q.questionText,
                options: q.options,
                selectedOption: q.selectedOption,
                categoryId: q.categoryId?._id || q.categoryId,
                categoryName: q.categoryId?.name,
                correctAnswer: test.status === 'completed' ? q.correctAnswer : undefined,
                isCorrect: test.status === 'completed' ? q.isCorrect : undefined
            })),
            performance: getPerformanceRating(test.score),
            attemptNumber: test.attemptNumber,
            attemptsRemaining: test.passed ? 0 : attemptsData[0]?.attemptsLeft || 0
        };

        res.json({
            success: true,
            data: response
        });
    } catch (error) {
        console.error('Error getting test details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch test details'
        });
    }
};

module.exports = {
    getTestCategories,
    startTest,
    submitTest,
    getTestResults,
    getActiveTest,
    getTestDetails
};
