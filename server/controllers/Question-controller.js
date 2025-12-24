const mongoose = require('mongoose');
const Question = require('../models/AddQuestion-model');
const PDFDocument = require('pdfkit');
const fs = require('fs');

// Create question (ADMIN)
const createQuestion = async (req, res) => {
  try {
    const { questionText, options, correctAnswer, category } = req.body;

    // Handle category conversion from string to ObjectId
    let categoryId = category;
    if (category && typeof category === 'string') {
      const { Category } = require('../models/SystemSetting');
      let categoryDoc = null;

      // Check if the string is a valid ObjectId
      if (mongoose.isValidObjectId(category)) {
        // First try to find by _id
        categoryDoc = await Category.findById(category);
      }

      // If not found by _id or not a valid ObjectId, try to find by name
      if (!categoryDoc) {
        categoryDoc = await Category.findOne({ name: new RegExp('^' + category + '$', 'i') });
      }

      if (!categoryDoc) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category'
        });
      }
      categoryId = categoryDoc._id;
    }

    const newQuestion = new Question({
      questionText,
      options,
      correctAnswer,
      category: categoryId,
      createdBy: req.admin._id
    });

    await newQuestion.save();

    const populatedQuestion = await Question.findById(newQuestion._id)
    .populate('createdBy', 'name email')
    .populate('category');

    res.status(201).json({
      success: true,
      message: 'Question created successfully',
      data: populatedQuestion
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Update question
const updateQuestion = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { questionText, options, correctAnswer, category, isActive } = req.body;
    const questionId = req.params.id;

    // पहले question को fetch करें
    const question = await Question.findById(questionId).session(session);

    if (!question) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    // Handle category conversion from string or object to ObjectId
    let categoryId = category;
    if (category) {
      if (typeof category === 'string') {
        const { Category } = require('../models/SystemSetting');
        let categoryDoc = null;

        // Check if the string is a valid ObjectId
        if (mongoose.isValidObjectId(category)) {
          // First try to find by _id
          categoryDoc = await Category.findById(category);
        }

        // If not found by _id or not a valid ObjectId, try to find by name
        if (!categoryDoc) {
          categoryDoc = await Category.findOne({ name: new RegExp('^' + category + '$', 'i') });
        }

        if (!categoryDoc) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: 'Invalid category'
          });
        }
        categoryId = categoryDoc._id;
      } else if (typeof category === 'object' && category._id) {
        // Category is an object with _id
        categoryId = category._id;
      } else if (typeof category === 'object' && category.name) {
        // Category is an object with name
        const { Category } = require('../models/SystemSetting');
        let categoryDoc = await Category.findOne({ name: new RegExp('^' + category.name + '$', 'i') });
        if (!categoryDoc) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: 'Invalid category'
          });
        }
        categoryId = categoryDoc._id;
      }
    }

    // मैन्युअल validation
    if (options) {
      // Options की लंबाई चेक करें
      if (options.length < 2 || options.length > 5) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Questions must have between 2-5 options'
        });
      }

      // Correct answer validation
      if (correctAnswer !== undefined) {
        if (correctAnswer < 0 || correctAnswer >= options.length) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: `Correct answer must be between 0 and ${options.length - 1}`
          });
        }
        question.correctAnswer = correctAnswer;
      }
      question.options = options;
    }

    // अन्य fields को अपडेट करें
    if (questionText !== undefined) question.questionText = questionText;
    if (categoryId !== undefined) question.category = categoryId;
    if (isActive !== undefined) question.isActive = isActive;

    // स्कीमा validators को मैन्युअली ट्रिगर करें
    await question.validate();

    // सेव करें
    await question.save({ session });
    await session.commitTransaction();

    // Populate createdBy and category fields
    const populatedQuestion = await Question.findById(question._id)
      .populate('createdBy', 'name email')
      .populate('category');

    res.json({
      success: true,
      message: 'Question updated successfully',
      question: populatedQuestion
    });
  } catch (error) {
    await session.abortTransaction();

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: `Validation error: ${messages.join(', ')}`
      });
    }

    res.status(400).json({
      success: false,
      message: error.message
    });
  } finally {
    session.endSession();
  }
};

// Disable question (ADMIN) - soft delete
const disableQuestion = async (req, res) => {
  try {
    const question = await Question.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    res.json({
      success: true,
      message: 'Question disabled successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Toggle question status (ADMIN)
const toggleQuestionStatus = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    question.isActive = !question.isActive;
    await question.save();

    res.json({
      success: true,
      message: `Question ${question.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Delete question (ADMIN) - hard delete
const deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findByIdAndDelete(req.params.id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    res.json({
      success: true,
      message: 'Question deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get all questions
const getAllQuestions = async (req, res) => {
  try {
    const { category, subcategory, isActive } = req.query;
    const filter = {};
    
    if (category) filter.category = category;
    if (subcategory) filter.subcategory = subcategory;
    if (isActive) filter.isActive = isActive;

    const questions = await Question.find(filter)
      .populate('createdBy', 'name email')
      .populate('category')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: questions.length,
      questions
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get single question
const getQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('category');

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    res.json({
      success: true,
      question
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Create bulk questions (ADMIN)
const createBulkQuestions = async (req, res) => {
  try {
    const { questions } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Questions array is required'
      });
    }

    const { Category } = require('../models/SystemSetting');

    // Process each question to handle category conversion
    const processedQuestions = [];
    for (const question of questions) {
      if (!question.category || typeof question.category !== 'string' || question.category.trim() === '') {
        return res.status(400).json({
          success: false,
          message: `Category is required for question: ${question.questionText}`
        });
      }
      let categoryId = question.category;

      if (question.category && typeof question.category === 'string') {
        let categoryDoc = null;

        // Check if the string is a valid ObjectId
        if (mongoose.isValidObjectId(question.category)) {
          // First try to find by _id
          categoryDoc = await Category.findById(question.category);
        }

        // If not found by _id or not a valid ObjectId, try to find by name
        if (!categoryDoc) {
          categoryDoc = await Category.findOne({ name: new RegExp('^' + question.category + '$', 'i') });
        }

        if (!categoryDoc) {
          return res.status(400).json({
            success: false,
            message: `Invalid category for question: ${question.questionText}`
          });
        }
        categoryId = categoryDoc._id;
      }

      processedQuestions.push({
        ...question,
        category: categoryId,
        createdBy: req.admin._id
      });
    }

    const result = await Question.insertMany(processedQuestions, { ordered: false });

    res.status(201).json({
      success: true,
      message: `${result.length} questions created successfully`,
      count: result.length
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: `Validation error: ${messages.join(', ')}. Please check that all questions have a category and other required fields.`
      });
    }
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Download questions PDF
const downloadQuestionsPDF = async (req, res) => {
  try {
    const { category, subcategory } = req.query;
    const filter = {};
    
    if (category) filter.category = category;
    if (subcategory) filter.subcategory = subcategory;

    const questions = await Question.find(filter)
      .populate('category')
      .sort({ 'category.name': 1, subcategory: 1 });

    // Create PDF document
    const doc = new PDFDocument();
    const filename = `questions_${Date.now()}.pdf`;
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    
    // Pipe PDF to response
    doc.pipe(res);

    // Add content to PDF
    doc.fontSize(20).text('Question Bank', { align: 'center' });
    doc.moveDown();

    let currentCategory = '';
    let currentSubcategory = '';

    questions.forEach((question, index) => {
      const categoryName = question.category ? question.category.name : 'Uncategorized';
      // Add category heading if changed
      if (categoryName !== currentCategory) {
        currentCategory = categoryName;
        doc.fontSize(16).text(currentCategory.toUpperCase(), { underline: true });
        doc.moveDown();
        currentSubcategory = ''; // Reset subcategory when category changes
      }

      // Add subcategory heading if changed
      if (question.subcategory && question.subcategory !== currentSubcategory) {
        currentSubcategory = question.subcategory;
        doc.fontSize(14).text(currentSubcategory.charAt(0).toUpperCase() + currentSubcategory.slice(1));
        doc.moveDown();
      }

      // Add question
      doc.fontSize(12).text(`${index + 1}. ${question.questionText}`);
      
      // Add options
      question.options.forEach((option, i) => {
        doc.text(`   ${String.fromCharCode(97 + i)}. ${option}`);
      });

      // Add correct answer
      doc.text(`Correct Answer: ${String.fromCharCode(97 + question.correctAnswer)}`, { indent: 20 });
      
      doc.moveDown();
    });

    // Finalize PDF
    doc.end();
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};





module.exports = {
  createQuestion,
  updateQuestion,
  disableQuestion,
  toggleQuestionStatus,
  deleteQuestion,
  getAllQuestions,
  getQuestion,
  createBulkQuestions,
  downloadQuestionsPDF,
};
