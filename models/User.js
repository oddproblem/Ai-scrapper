import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    displayName: { type: String, default: '' },
    avatar: { type: String, default: '' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    alerts: {
      enabled: { type: Boolean, default: false },
      keywords: { type: String, default: '' },
      types: [{ type: String }],
      sources: [{ type: String }],
      frequency: { type: String, enum: ['realtime', 'daily', 'weekly'], default: 'daily' },
    },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);
export default User;
