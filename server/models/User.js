const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    avatar: { type: String, default: '' },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    // password reset: only the SHA-256 hash of the emailed token is stored
    resetPasswordToken: { type: String, select: false, default: undefined },
    resetPasswordExpires: { type: Date, select: false, default: undefined },
    // tokens issued before this moment are rejected (logs out old sessions after a reset)
    passwordChangedAt: { type: Date, select: false, default: undefined },
  },
  { timestamps: true }
);

userSchema.index({ name: 'text' });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
  if (!this.isNew) this.passwordChangedAt = new Date(Date.now() - 1000); // -1s: JWT iat has 1s resolution
});

userSchema.methods.matchPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.resetPasswordToken;
    delete ret.resetPasswordExpires;
    delete ret.passwordChangedAt;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);