import mongoose from 'mongoose';

const opportunitySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    source: {
      type: String,
      required: true,
      enum: ['devfolio', 'f6s', 'unstop', 'startupIndia', 'custom'],
    },
    sourceUrl: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: ['hackathon', 'accelerator', 'grant', 'challenge', 'incubator', 'program', 'other'],
      default: 'other',
    },
    deadline: { type: Date, default: null },
    location: { type: String, default: '' },
    mode: { type: String, enum: ['remote', 'on-site', 'hybrid', ''], default: '' },
    tags: [{ type: String }],
    sector: [{ type: String }],
    stage: [{ type: String }],
    fundingAmount: { type: String, default: '' },
    equity: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    organizer: { type: String, default: '' },
    prize: { type: String, default: '' },
    eligibility: { type: String, default: '' },
    scrapedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast querying
opportunitySchema.index({ source: 1 });
opportunitySchema.index({ type: 1 });
opportunitySchema.index({ deadline: 1 });
opportunitySchema.index({ tags: 1 });
opportunitySchema.index({ isActive: 1 });
opportunitySchema.index(
  { title: 'text', description: 'text' },
  { weights: { title: 10, description: 5 } }
);

const Opportunity = mongoose.model('Opportunity', opportunitySchema);
export default Opportunity;
