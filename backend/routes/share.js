const express = require('express');
const Note = require('../models/Note');
const { validateShareToken, comparePassword } = require('../utils/tokenUtils');

const router = express.Router();

/**
 * GET /api/share/:token/meta
 * Returns metadata about a share link without accessing the note content.
 * Used by the frontend to determine whether a password prompt is required.
 */
router.get('/:token/meta', async (req, res) => {
  try {
    const note = await Note.findByToken(req.params.token);

    if (!note) {
      return res.status(404).json({
        error: 'invalid_token',
        message: 'This share link does not exist.'
      });
    }

    const shareToken = note.shareTokens.find(
      (t) => t.token === req.params.token
    );

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
    console.error(err);
    res.status(500).json({
      error: 'server_error',
      message: 'Server error'
    });
  }
});

/**
 * POST /api/share/:token/access
 * Handles:
 * - Public share
 * - Password-protected share
 * - One-time links
 * - Time-based links
 */
router.post('/:token/access', async (req, res) => {
  try {

    const { password } = req.body;
    const { token } = req.params;

    const note = await Note.findByToken(token);
    console.log("Token:", token);
console.log("Note Found:", note ? "YES" : "NO");

    if (!note) {
      return res.status(404).json({
        error: 'invalid_token',
        message: 'This share link does not exist.'
      });
    }

    const shareToken = note.shareTokens.find(
      (t) => t.token === token
    );
    console.log("Share Token:");
console.log(shareToken);

    const validation = validateShareToken(shareToken);

    if (!validation.valid) {
      return res.status(410).json({
        error: validation.reason,
        message: getErrorMessage(validation.reason)
      });
    }

    // Password protected access
    if (shareToken.accessType === 'password-protected') {

      if (!password) {
        return res.status(401).json({
          error: 'password_required',
          message: 'Password is required.'
        });
      }

      const isMatch = await comparePassword(
        password,
        shareToken.passwordHash
      );

      if (!isMatch) {
        return res.status(401).json({
          error: 'wrong_password',
          message: 'Incorrect password or access key.'
        });
      }
    }

    // ---------- ONE-TIME LINK ----------
    if (shareToken.shareType === 'one-time') {

      const updated = await Note.findOneAndUpdate(
        {
          _id: note._id,
          'shareTokens.token': token,
          'shareTokens.isUsed': false,
          'shareTokens.isRevoked': false
        },
                
        {
          $set: {
            'shareTokens.$.isUsed': true
          },
          $inc: {
            'shareTokens.$.viewCount': 1,
            totalViews: 1
          }
        },
        {
          new: true
        }
      );

      if (!updated) {
        return res.status(409).json({
          error: 'already_used',
          message: 'This one-time link has already been used.'
        });
      }

      const updatedShareToken = updated.shareTokens.find(
        (t) => t.token === token
      );

      return res.json({
        title: updated.title,
        content: updated.content,
        accessType: updatedShareToken.accessType,
        shareType: updatedShareToken.shareType,
        viewCount: updatedShareToken.viewCount,
        totalViews: updated.totalViews
      });
    }

    // ---------- TIME-BASED LINK ----------
    if (req.session?.viewed === token) {
    return res.json({
        title: note.title,
        content: note.content,
        viewCount: shareToken.viewCount,
        totalViews: note.totalViews
    });
}
    const result = await Note.updateOne(
  {
    _id: note._id,
    "shareTokens.token": token
  },
  {
    $inc: {
      "shareTokens.$.viewCount": 1,
      totalViews: 1
    }
  }
);

console.log(result);

    const updatedNote = await Note.findById(note._id);

if (!updatedNote) {
  return res.status(404).json({
    error: 'Note not found'
  });
}

const updatedShareToken = updatedNote.shareTokens.find(
  (t) => t.token === token
);

    res.json({
      title: updatedNote.title,
      content: updatedNote.content,
      accessType: updatedShareToken.accessType,
      shareType: updatedShareToken.shareType,
      expiresAt: updatedShareToken.expiresAt,
      viewCount: updatedShareToken.viewCount,
      totalViews: updatedNote.totalViews
    });

  } catch (err) {
    console.error('Share access error:', err);

    res.status(500).json({
      error: 'server_error',
      message: 'Server error'
    });
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