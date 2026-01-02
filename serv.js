const express = require('express');
const fs = require('fs');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;
const GIST_ID = process.env.GIST_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Local vocabulary data
const vocabulary = JSON.parse(fs.readFileSync('./words_output.json', 'utf8'));

// --- GIST HELPERS ---
const getSeenWords = async () => {
    const response = await axios.get(`https://api.github.com/gists/${GIST_ID}`);
    return JSON.parse(response.data.files['used_words.json'].content);
};

const updateGist = async (list) => {
    await axios.patch(`https://api.github.com/gists/${GIST_ID}`, {
        files: { 'used_words.json': { content: JSON.stringify(list) } }
    }, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
};

app.get('/', async (req, res) => {
    try {
        // 1. Fetch persistent state from GitHub Gist
        let seenTerms = await getSeenWords();

        // 2. Filter local vocabulary
        let available = vocabulary.filter(w => !seenTerms.includes(w.term));

        // 3. Reset if all words used
        if (available.length === 0) {
            seenTerms = [];
            available = vocabulary;
        }

        // 4. Pick random word
        const word = available[Math.floor(Math.random() * available.length)];

        // 5. Update state in Gist
        seenTerms.push(word.term);
        await updateGist(seenTerms);

        res.json({
            remaining_unique: available.length - 1,
            data: word
        });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch/update state", detail: err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});