const mongoose = require('mongoose');

const shareTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  shareType: {
    type: String,
    enum: ['one-time', 'time-based'],
    required: true
  },

  accessType: {
    type: String,
    enum: ['public', 'password-protected'],
    required: true
  },

  passwordHash: {
    type: String,
    default: null
  },

  expiresAt: {
    type: Date,
    required: true
  },

  isRevoked: {
    type: Boolean,
    default: false
  },

  isUsed: {
    type: Boolean,
    default: false
  },

  // Views through this particular share link
  viewCount: {
    type: Number,
    default: 0
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

const noteSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },

    content: {
      type: String,
      required: [true, 'Content is required'],
      maxlength: [50000, 'Content cannot exceed 50000 characters']
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    // Total views across all share links
    totalViews: {
      type: Number,
      default: 0
    },

    shareTokens: [shareTokenSchema]
  },
  {
    timestamps: true
  }
);

// Find a note using its share token
noteSchema.statics.findByToken = function (token) {
  return this.findOne({
    'shareTokens.token': token
  });
};

module.exports = mongoose.model('Note', noteSchema);