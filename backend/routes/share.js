const express = require('express');
const mongoose = require('mongoose');
const Note = require('../models/Note');
const { validateShareToken, comparePassword } = require('../utils/tokenUtils');

const router = express.Router();

/**
 * GET /api/share/:token/meta
 * Returns metadata about a share link without accessing the note content.
 * Used by the frontend to know whether to show a password prompt.
 */
router.get('/:token/meta', async (req, res) => {
  try {
    const note = await Note.findByToken(req.params.token);
    if (!note) {
      return res.status(404).json({ error: 'invalid_token', message: 'This share link does not exist.' });
    }

    const shareToken = note.shareTokens.find(t => t.token === req.params.token);
    const validation = validateShareToken(shareToken);

    if (!validation.valid) {
      return res.status(410).json({
        error: validation.reason,
        message: getErrorMessage(validation.reason)
      });
    }

    res.json({
      accessType: shareToken.accessType,
      shareType: shareToken.shareType,
      expiresAt: shareToken.expiresAt
    });
  } catch (err) {
    res.status(500).json({ error: 'server_error', message: 'Server error' });
  }
});

/**
 * POST /api/share/:token/access
 * Access the shared note. Handles public and password-protected access.
 * 
 * Race condition handling for one-time links:
 * Uses MongoDB's findOneAndUpdate with atomic $set to mark token as used,
 * with a query filter that only matches if isUsed === false.
 * If another request already used it, the update returns null → 409 Conflict.
 */
router.post('/:token/access', async (req, res) => {
  try {
    const { password } = req.body;
    const { token } = req.params;

    const note = await Note.findByToken(token);
    if (!note) {
      return res.status(404).json({ error: 'invalid_token', message: 'This share link does not exist.' });
    }

    const shareToken = note.shareTokens.find(t => t.token === token);
    const validation = validateShareToken(shareToken);

    if (!validation.valid) {
      return res.status(410).json({
        error: validation.reason,
        message: getErrorMessage(validation.reason)
      });
    }

    // Password check (does NOT increment view count on failure)
    if (shareToken.accessType === 'password-protected') {
      if (!password) {
        return res.status(401).json({ error: 'password_required', message: 'A password is required.' });
      }
      const isMatch = await comparePassword(password, shareToken.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ error: 'wrong_password', message: 'Incorrect password or access key.' });
      }
    }

    // === ATOMIC ONE-TIME LINK HANDLING ===
    // For one-time links: atomically mark as used only if not already used.
    // This prevents race conditions where two requests arrive simultaneously.
    if (shareToken.shareType === 'one-time') {
      const result = await Note.findOneAndUpdate(
        {
          _id: note._id,
          'shareTokens.token': token,
          'shareTokens.isUsed': false,    // Only matches if NOT already used
          'shareTokens.isRevoked': false,  // Only matches if NOT revoked
        },
        {
          $set: { 'shareTokens.$.isUsed': true },
          $inc: { 'shareTokens.$.viewCount': 1 }
        },
        { new: true }
      );

      if (!result) {
        // Another request beat us to it — the link was already used
        return res.status(409).json({
          error: 'already_used',
          message: 'This one-time link has already been used.'
        });
      }

      // Find the updated note to get content
      const updatedNote = await Note.findById(note._id);
      return res.json({
        title: updatedNote.title,
        content: updatedNote.content,
        accessType: shareToken.accessType,
        shareType: shareToken.shareType,
        viewCount: shareToken.viewCount + 1
      });
    }

    // === TIME-BASED LINK HANDLING ===
    // Atomically increment view count
    await Note.updateOne(
      { _id: note._id, 'shareTokens.token': token },
      { $inc: { 'shareTokens.$.viewCount': 1 } }
    );

    res.json({
      title: note.title,
      content: note.content,
      accessType: shareToken.accessType,
      shareType: shareToken.shareType,
      expiresAt: shareToken.expiresAt,
      viewCount: shareToken.viewCount + 1
    });
  } catch (err) {
    console.error('Share access error:', err);
    res.status(500).json({ error: 'server_error', message: 'Server error' });
  }
});

function getErrorMessage(reason) {
  const messages = {
    invalid_token: 'This share link does not exist.',
    revoked: 'This share link has been revoked by the owner.',
    expired: 'This share link has expired.',
    already_used: 'This one-time link has already been used.'
  };
  return messages[reason] || 'This share link is no longer valid.';
}

module.exports = router;
