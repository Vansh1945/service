const mongoose = require('mongoose');
const { Schema } = mongoose;

const providerTestSchema = new Schema({
  provider: {
    type: Schema.Types.ObjectId,
    ref: 'Provider',
    required: true,
    index: true
  },
  test: {
    type: Schema.Types.ObjectId,
    ref: 'Test',
    required: true
  },
  questions: [{
    questionId: {
      type: Schema.Types.ObjectId,
      ref: 'Question',
      required: true
    },
    selectedOption: Number,
    isCorrect: Boolean
  }],
  score: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  passed: {
    type: Boolean,
    default: false
  },
  timeTaken: { // in seconds
    type: Number,
    min: 0
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'expired'],
    default: 'in-progress'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
providerTestSchema.index({ provider: 1, status: 1 });
providerTestSchema.index({ completedAt: -1 });
providerTestSchema.index({ score: -1 });

// Virtuals
providerTestSchema.virtual('duration').get(function() {
  if (this.completedAt) {
    return Math.floor((this.completedAt - this.startedAt) / 1000); // in seconds
  }
  return null;
});

providerTestSchema.virtual('percentage').get(function() {
  return this.score.toFixed(1);
});

// Pre-save hooks
providerTestSchema.pre('save', function(next) {
  // Auto-calculate passed status if score changes
  if (this.isModified('score')) {
    this.passed = this.score >= 70; // Passing threshold
  }

  // Set completedAt when status changes to completed
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }

  next();
});

// Static Methods
providerTestSchema.statics.findByProvider = function(providerId, options = {}) {
  return this.find({ provider: providerId })
    .sort({ completedAt: -1 })
    .limit(options.limit || 10)
    .populate('test', 'name description')
    .populate('questions.questionId', 'questionText category');
};

providerTestSchema.statics.getProviderStats = async function(providerId) {
  const stats = await this.aggregate([
    { $match: { provider: mongoose.Types.ObjectId(providerId), status: 'completed' } },
    {
      $group: {
        _id: null,
        totalTests: { $sum: 1 },
        passedTests: { $sum: { $cond: ['$passed', 1, 0] } },
        avgScore: { $avg: '$score' },
        bestScore: { $max: '$score' },
        avgTime: { $avg: '$timeTaken' }
      }
    }
  ]);

  return stats[0] || {
    totalTests: 0,
    passedTests: 0,
    avgScore: 0,
    bestScore: 0,
    avgTime: 0
  };
};

// Instance Methods
providerTestSchema.methods.calculateScore = function() {
  const correctCount = this.questions.reduce((count, q) => q.isCorrect ? count + 1 : count, 0);
  this.score = Math.round((correctCount / this.questions.length) * 100);
  return this.save();
};

providerTestSchema.methods.toTestResult = function() {
  return {
    testId: this.test,
    score: this.score,
    passed: this.passed,
    completedAt: this.completedAt,
    timeTaken: this.timeTaken,
    performance: this.getPerformanceCategory()
  };
};

providerTestSchema.methods.getPerformanceCategory = function() {
  if (this.score >= 90) return 'Excellent';
  if (this.score >= 80) return 'Good';
  if (this.score >= 70) return 'Satisfactory';
  return 'Needs Improvement';
};

const ProviderTest = mongoose.model('ProviderTest', providerTestSchema);

module.exports = ProviderTest;