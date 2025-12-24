const mongoose = require('mongoose');
const { Schema } = mongoose;

const testSchema = new Schema({
  provider: {
    type: Schema.Types.ObjectId,
    ref: 'Provider',
    required: true
  },
  questions: [{
    questionId: {
      type: Schema.Types.ObjectId,
      ref: 'Question',
      required: true
    },
    questionText: {
      type: String,
      required: true
    },
    options: {
      type: [String],
      required: true
    },
    correctAnswer: {
      type: Number,
      required: true
    },
    selectedOption: {
      type: Number,
      default: null
    },
    isCorrect: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['unanswered', 'answered'],
      default: 'unanswered'
    }
  }],
  status: {
    type: String,
    enum: ['in-progress', 'completed'],
    default: 'in-progress'
  },
  testCategory: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  expiresAt: {
    type: Date
  },
  timeTaken: {
    type: Number // in seconds
  },
  score: {
    type: Number,
    min: 0,
    max: 100
  },
  passed: {
    type: Boolean,
    default: false
  },
  questionsAnswered: {
    type: Number,
    default: 0
  },
  attemptNumber: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
testSchema.index({ provider: 1, status: 1 });
testSchema.index({ testCategory: 1 });

const ProviderTest = mongoose.model('ProviderTest', testSchema);
module.exports = ProviderTest;
