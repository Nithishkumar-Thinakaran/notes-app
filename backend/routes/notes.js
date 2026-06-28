const express = require('express');
const Note = require('../models/Note');
const { protect } = require('../middleware/auth');
const {
  generateToken,
  generateAccessKey,
  hashPassword,
  validateShareToken
} = require('../utils/tokenUtils');

const router = express.Router();

// All note routes require authentication
router.use(protect);

// GET /api/notes - Get all notes for the logged-in user
router.get('/', async (req, res) => {
  try {
    const notes = await Note.find({ owner: req.user._id }).sort({ updatedAt: -1 });

    const notesWithSummary = notes.map(note => ({
      _id: note._id,
      title: note.title,
      content: note.content,
      totalViews: note.totalViews,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      shareCount: note.shareTokens.length,
      activeShares: note.shareTokens.filter(token => validateShareToken(token).valid).length
    }));

    res.json({
      notes: notesWithSummary
    });

  } catch (err) {
    res.status(500).json({
      error: 'Failed to fetch notes'
    });
  }
});
// POST /api/notes - Create a new note with a share link
router.post('/', async (req, res) => {
  try {
    const { title, content, expiresAt, shareType, accessType } = req.body;

    if (!title || !content || !expiresAt || !shareType || !accessType) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!['one-time', 'time-based'].includes(shareType)) {
      return res.status(400).json({ error: 'Invalid share type' });
    }

    if (!['public', 'password-protected'].includes(accessType)) {
      return res.status(400).json({ error: 'Invalid access type' });
    }

    const expiry = new Date(expiresAt);
    if (isNaN(expiry.getTime()) || expiry <= new Date()) {
      return res.status(400).json({ error: 'Expiry date must be in the future' });
    }

    // Generate the share token
    const token = generateToken();
    let generatedPassword = null;
    let passwordHash = null;

    if (accessType === 'password-protected') {
      generatedPassword = generateAccessKey();
      passwordHash = await hashPassword(generatedPassword);
    }

    const shareToken = {
  token,
  shareType,
  accessType,
  passwordHash,
  expiresAt: expiry
};

    const note = await Note.create({
      title,
      content,
      owner: req.user._id,
      shareTokens: [shareToken]
    });

    const created = note.shareTokens[0];

    res.status(201).json({
      message: 'Note created successfully',
      note: {
        _id: note._id,
        title: note.title,
        content: note.content,
        createdAt: note.createdAt
      },
      shareLink:{
    token,
    shareType,
    accessType,
    expiresAt:expiry,
    generatedPassword
}
    });

    // Clear the plain-text password from DB after returning it
    if (accessType === 'password-protected') {
      await Note.updateOne(
        { _id: note._id, 'shareTokens.token': token },
        { $set: { 'shareTokens.$.generatedPassword': null } }
      );
    }
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: Object.values(err.errors)[0].message });
    }
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// GET /api/notes/:id - Get a specific note (owner only)
router.get('/:id', async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, owner: req.user._id });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Return note with share token info (without password hashes)
    const shareLinks = note.shareTokens.map(t => {
      const validation = validateShareToken(t);
      return {
        token: t.token,
        shareType: t.shareType,
        accessType: t.accessType,
        expiresAt: t.expiresAt,
        isRevoked: t.isRevoked,
        isUsed: t.isUsed,
        viewCount: t.viewCount,
        createdAt: t.createdAt,
        status: validation.valid ? 'active' : validation.reason
      };
    });

    res.json({
      note: {
        _id: note._id,
        title: note.title,
        content: note.content,
        totalViews: note.totalViews,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        shareLinks
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch note' });
  }
});

// POST /api/notes/:id/share - Generate a new share link for existing note
router.post('/:id/share', async (req, res) => {
  try {
    const { expiresAt, shareType, accessType } = req.body;

    if (!expiresAt || !shareType || !accessType) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!['one-time', 'time-based'].includes(shareType)) {
      return res.status(400).json({ error: 'Invalid share type' });
    }

    if (!['public', 'password-protected'].includes(accessType)) {
      return res.status(400).json({ error: 'Invalid access type' });
    }

    const expiry = new Date(expiresAt);
    if (isNaN(expiry.getTime()) || expiry <= new Date()) {
      return res.status(400).json({ error: 'Expiry date must be in the future' });
    }

    const note = await Note.findOne({ _id: req.params.id, owner: req.user._id });
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const token = generateToken();
    let generatedPassword = null;
    let passwordHash = null;

    if (accessType === 'password-protected') {
      generatedPassword = generateAccessKey();
      passwordHash = await hashPassword(generatedPassword);
    }

    note.shareTokens.push({
      token,
      shareType,
      accessType,
      passwordHash,
      generatedPassword,
      expiresAt: expiry
    });

    await note.save();

    res.json({
      message: 'Share link generated',
      shareLink: {
        token,
        shareType,
        accessType,
        expiresAt: expiry,
        generatedPassword
      }
    });

    // Clear plain-text password
    if (accessType === 'password-protected') {
      await Note.updateOne(
        { _id: note._id, 'shareTokens.token': token },
        { $set: { 'shareTokens.$.generatedPassword': null } }
      );
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate share link' });
  }
});

// PUT /api/notes/:id - Update a note
router.put('/:id', async (req, res) => {
  try {

    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        error: 'Title and content are required'
      });
    }

    const note = await Note.findOne({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!note) {
      return res.status(404).json({
        error: 'Note not found'
      });
    }

    note.title = title;
    note.content = content;

    await note.save();

    res.json({
      message: 'Note updated successfully',
      note
    });

  } catch (err) {
    res.status(500).json({
      error: 'Failed to update note'
    });
  }
});

// DELETE /api/notes/:id/share/:token - Revoke a share link
router.delete('/:id/share/:token', async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, owner: req.user._id });
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const shareToken = note.shareTokens.find(t => t.token === req.params.token);
    if (!shareToken) {
      return res.status(404).json({ error: 'Share link not found' });
    }

    shareToken.isRevoked = true;
    await note.save();

    res.json({ message: 'Share link revoked successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke share link' });
  }
});

// DELETE /api/notes/:id - Delete a note
router.delete('/:id', async (req, res) => {
  try {
    const note = await Note.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json({ message: 'Note deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

module.exports = router;
