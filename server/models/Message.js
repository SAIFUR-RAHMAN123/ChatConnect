const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    filename: String, // stored (random) name on disk, never sent to clients
    originalName: String,
    mimeType: String,
    size: Number,
  },
  { _id: false }
);

const reactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    emoji: { type: String, required: true },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
    content: { type: String, trim: true, maxlength: 2000, default: '' },
    attachment: { type: attachmentSchema, default: undefined },
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
    readAt: { type: Date, default: null },
    // per-recipient tracking (needed for group chats); status is derived from these
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    reactions: [reactionSchema],
    edited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, sender: 1, status: 1 });

messageSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    delete ret.deliveredTo;
    if (ret.attachment) delete ret.attachment.filename;
    return ret;
  },
});

module.exports = mongoose.model('Message', messageSchema);