const express = require('express');
const router = express.Router();
const { db } = require('./firebase');
const { log } = console;
const redis = require('./redis');
const fs = require('fs');
const storage = require('./storage'); // Modular storage (Cloudinary)

/**
 * POST /api/profile
 * Update user profile (name, bio, tags)
 */
router.get('/profile/:id', async (req, res) => {
    try {
        const id = req.params.id;
        if (!id) {
            res.status(400).json({ error: 'image ID is required' });
            return;
        }
        // check for image exit or not
        const imagePath = `./assets/${id}`
        if (!fs.existsSync(imagePath)) {
            const defaulPath = `./assets/default.png`
            if (!fs.existsSync(defaulPath)) {
                res.status(404).json({ error: 'image not found' });
                return;
            }
            const image = fs.readFileSync(defaulPath)
            res.send(image);
            return;
        }
        const image = fs.readFileSync(imagePath)
        res.send(image);
    } catch (error) {
        console.error('fetching image error :', error);
        res.status(500).json({ error: 'server error while fetching image' });
    }
});

module.exports = router;
// Export the storage module for use in other parts of the app
module.exports.storage = storage;

