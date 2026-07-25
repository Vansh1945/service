const mongoose = require('mongoose');
const { Schema } = mongoose;

const testAttemptSchema = new Schema({
  providerId: {
    type: Schema.Types.ObjectId,
    ref: 'Provider',
    required: true,
    index: true
  },
  categories: [{
    type: Schema.Types.ObjectId,
    ref: 'Category'
  }],
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
    categoryName: {
      type: String,
      required: true
    }
  }],
  answers: [{
    questionId: {
      type: Schema.Types.ObjectId,
      required: true
    },
    selectedOption: {
      type: Number,
      required: true
    }
  }],
  score: {
    type: Number,
    default: 0
  },
  passed: {
    type: Boolean,
    default: false
  },
  startTime: {
    type: Date,
    default: Date.now,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  submittedAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'submitted', 'expired'],
    default: 'active',
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('TestAttempt', testAttemptSchema);
