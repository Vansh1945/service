const { body, validationResult } = require('express-validator');

exports.validateQuestion = [
  body('questionText')
    .trim()
    .notEmpty().withMessage('Question text is required')
    .isLength({ min: 10 }).withMessage('Question must be at least 10 characters'),

  body('options')
    .isArray({ min: 2, max: 5 }).withMessage('Must provide between 2-5 options')
    .custom((options) => {
      return options.every(opt => typeof opt === 'string' && opt.trim().length > 0);
    }).withMessage('All options must be non-empty strings'),

  body('correctAnswer')
    .isInt({ min: 0 }).withMessage('Correct answer must be a positive integer')
    .custom((value, { req }) => {
      return value < req.body.options.length;
    }).withMessage('Correct answer index must be within options range'),

  body('category')
    .isIn(['electrical', 'general'])
    .withMessage('Invalid category'),

  body('subcategory')
    .isIn(['wiring', 'ac', 'repair', 'all'])
    .withMessage('Invalid subcategory')
];

exports.validateBulkQuestions = [
  body('questions')
    .isArray({ min: 1 }).withMessage('Questions array is required')
    .custom((questions) => {
      return questions.every(q => 
        q.questionText && 
        q.options && 
        q.options.length >= 2 && 
        q.options.length <= 5 &&
        q.correctAnswer !== undefined &&
        q.correctAnswer < q.options.length &&
        ['electrical', 'general'].includes(q.category) &&
        ['wiring', 'ac', 'repair', 'all'].includes(q.subcategory)
      );
    }).withMessage('All questions must have valid structure')
];