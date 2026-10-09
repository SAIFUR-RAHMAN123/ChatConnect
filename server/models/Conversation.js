const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ],
    // 1-to-1: "<smallerId>_<largerId>" (one conversation per pair). Group: "group_<id>".
    pairKey: { type: String, required: true, unique: true },
    isGroup: { type: Boolean, default: false },
    name: { type: String, trim: true, maxlength: 50, default: '' },
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1, updatedAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);