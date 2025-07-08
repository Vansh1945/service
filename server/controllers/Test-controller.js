const Question = require('../models/AddQuestion-model');
const ProviderTest = require('../models/Test-model');
const Provider = require('../models/Provider-model');
const { ObjectId } = require('mongoose').Types;

// ===================== PROVIDER FUNCTIONS ===================== //

/**
 * Get available test categories - Provider
 */
const getTestCategories = async (req, res) => {
    try {
        const categories = await Question.distinct('category');
        const subcategories = await Question.distinct('subcategory');

        res.json({
            success: true,
            data: {
                categories,
                subcategories
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Start a new test with selected category - Provider
 */
const startTest = async (req, res) => {
    try {
        const provider = req.provider;
        const { category, subcategory } = req.body;

        // Check if provider has already passed a test
        if (provider.testPassed) {
            return res.status(400).json({
                success: false,
                message: 'You have already passed the test'
            });
        }

        // Check for existing active test
        const activeTest = await ProviderTest.findOne({
            provider: provider._id,
            status: 'in-progress'
        });

        if (activeTest) {
            return res.status(400).json({
                success: false,
                message: 'You already have an active test',
                testId: activeTest._id
            });
        }

        // Build question query
        const query = {
            isActive: true,
            ...(category && { category }),
            ...(subcategory && { subcategory })
        };

        // Get 10 random questions
        const questions = await Question.aggregate([
            { $match: query },
            { $sample: { size: 10 } }
        ]);

        if (questions.length < 10) {
            return res.status(400).json({
                success: false,
                message: 'Not enough questions available for selected criteria'
            });
        }

        // Create new test with proper question structure
        const test = new ProviderTest({
            provider: provider._id,
            questions: questions.map(q => ({
                questionId: q._id,
                questionText: q.questionText,
                options: q.options,
                correctAnswer: q.correctAnswer,
                selectedOption: null,
                isCorrect: false,
                status: 'unanswered'
            })),
            status: 'in-progress',
            testCategory: category || 'general',
            testSubcategory: subcategory || 'all',
            startedAt: new Date()
        });

        await test.save();

        res.status(201).json({
            success: true,
            message: 'Test started successfully',
            testId: test._id,
            totalQuestions: test.questions.length,
            testCategory: test.testCategory,
            testSubcategory: test.testSubcategory,
            startedAt: test.startedAt
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
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

        // Process answers
        let answeredCount = 0;
        let correctCount = 0;

        test.questions.forEach(question => {
            const answer = answers.find(a =>
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

        // Calculate score (based on total questions, not just answered ones)
        const score = Math.round((correctCount / test.questions.length) * 100) || 0;
        const passed = score >= 70;

        // Update test results
        test.score = score;
        test.passed = passed;
        test.status = 'completed';
        test.completedAt = new Date();
        test.timeTaken = Math.floor((test.completedAt - test.startedAt) / 1000);
        test.questionsAnswered = answeredCount;

        await test.save();

        // Update provider status if passed
        if (passed) {
            await Provider.findByIdAndUpdate(
                provider._id,
                {
                    testPassed: true,
                    $inc: { completedBookings: 0 }
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
                testCategory: test.testCategory,
                testSubcategory: test.testSubcategory,
                completedAt: test.completedAt,
                performance: test.score >= 90 ? 'Excellent' :
                    test.score >= 80 ? 'Good' :
                        test.score >= 70 ? 'Satisfactory' : 'Needs Improvement'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
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
            .select('testCategory testSubcategory score passed completedAt timeTaken questionsAnswered')
            .lean();

        const formattedResults = results.map(test => ({
            testId: test._id,
            category: test.testCategory,
            subcategory: test.testSubcategory,
            score: test.score,
            passed: test.passed,
            date: test.completedAt,
            timeTaken: test.timeTaken,
            questionsAnswered: test.questionsAnswered,
            performance: test.score >= 90 ? 'Excellent' :
                test.score >= 80 ? 'Good' :
                    test.score >= 70 ? 'Satisfactory' : 'Needs Improvement'
        }));

        res.json({
            success: true,
            data: formattedResults
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
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

        const test = await ProviderTest.findOne({
            _id: testId,
            provider: provider._id
        }).lean();

        if (!test) {
            return res.status(404).json({
                success: false,
                message: 'Test not found'
            });
        }

        const response = {
            testId: test._id,
            status: test.status,
            score: test.score,
            passed: test.passed,
            category: test.testCategory,
            subcategory: test.testSubcategory,
            startedAt: test.startedAt,
            completedAt: test.completedAt,
            timeTaken: test.timeTaken,
            questions: test.questions.map(q => ({
                questionId: q.questionId,
                questionText: q.questionText,
                options: q.options,
                selectedOption: q.selectedOption,
                correctAnswer: test.status === 'completed' ? q.correctAnswer : undefined,
                isCorrect: test.status === 'completed' ? q.isCorrect : undefined
            })),
            performance: test.score >= 90 ? 'Excellent' :
                test.score >= 80 ? 'Good' :
                    test.score >= 70 ? 'Satisfactory' : 'Needs Improvement'
        };

        res.json({
            success: true,
            data: response
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};




// Add to your exports
module.exports = {
    getTestCategories,
    startTest,
    submitTest,
    getTestResults,
    getTestDetails,

};