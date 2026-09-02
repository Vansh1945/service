const mongoose = require('mongoose');

const templateVersionSchema = new mongoose.Schema({
  version: { type: Number, required: true },
  title: { type: String, default: '' }, // For PDF: main title; For Email: subject line
  subtitle: { type: String, default: '' },
  hasLetterHead: { type: Boolean, default: true },
  headerText: { type: String, default: '' },
  body: { type: String, default: '' },
  footerText: { type: String, default: '' },
  terms: { type: String, default: '' },
  notes: { type: String, default: '' },
  authorizedSignatory: { type: String, default: '' },
  hasCompanySeal: { type: Boolean, default: true },
  hasQrSection: { type: Boolean, default: true },
  hasWatermark: { type: Boolean, default: true },
  isActive: { type: Boolean, default: false }, // only one version should have isActive = true
  createdBy: { type: String, default: 'System' },
  updatedAt: { type: Date, default: Date.now }
});

const templateSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // e.g. 'agreement', 'approval_letter', 'appointment_letter', 'warning_letter', 'suspension_letter', 'rejection_letter', 'welcome_letter', etc.
  name: { type: String, required: true },
  type: { type: String, enum: ['pdf', 'email'], required: true },
  description: { type: String },
  allowedVariables: [{ type: String }],
  versions: [templateVersionSchema],
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null, index: true },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null }
}, { timestamps: true });

templateSchema.index({ isDeleted: 1, deletedAt: -1 });

module.exports = mongoose.model('Template', templateSchema);
