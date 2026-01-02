const express = require('express');
const fs = require('fs');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;
const GIST_ID = process.env.GIST_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Local vocabulary data - Ensure this filename matches your JSON file exactly
const DATA_PATH = './words_output.json';
let vocabulary = [];

try {
    vocabulary = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    console.log(`Loaded ${vocabulary.length} words from local JSON.`);
} catch (err) {
    console.error("Error loading local JSON file:", err.message);
}

// --- GIST HELPERS ---
// GitHub API requires a User-Agent header and a Token
const gistHeaders = {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'User-Agent': 'Vocab-API-App' 
};

const getSeenWords = async () => {
    try {
        const response = await axios.get(`https://api.github.com/gists/${GIST_ID}`, { headers: gistHeaders });
        const content = response.data.files['used_vocab.json'].content;
        return JSON.parse(content);
    } catch (err) {
        console.error("Gist Fetch Error:", err.response ? err.response.data : err.message);
        throw err;
    }
};

const updateGist = async (list) => {
    try {
        await axios.patch(`https://api.github.com/gists/${GIST_ID}`, {
            files: { 'used_vocab.json': { content: JSON.stringify(list) } }
        }, { headers: gistHeaders });
    } catch (err) {
        console.error("Gist Update Error:", err.response ? err.response.data : err.message);
        throw err;
    }
};

// --- API ENDPOINT ---
app.get('/', async (req, res) => {
    try {
        if (vocabulary.length === 0) {
            return res.status(500).json({ error: "Vocabulary list is empty." });
        }

        // 1. Fetch seen words from GitHub Gist
        let seenTerms = await getSeenWords();

        // 2. Filter local vocabulary to find unique words
        let available = vocabulary.filter(w => !seenTerms.includes(w.term));

        // 3. Reset if all words have been used
        if (available.length === 0) {
            console.log("All words used. Resetting cycle...");
            seenTerms = [];
            available = vocabulary;
        }

        // 4. Pick a random word from available list
        const randomIndex = Math.floor(Math.random() * available.length);
        const selectedWord = available[randomIndex];

        // 5. Update the Gist with the newly seen word
        seenTerms.push(selectedWord.term);
        await updateGist(seenTerms);

        // 6. Return response
        res.json({
            success: true,
            remaining_unique: available.length - 1,
            data: selectedWord
        });

    } catch (err) {
        res.status(500).json({ 
            error: "Failed to manage state via GitHub Gist", 
            message: err.message,
            tip: "Check if GIST_ID and GITHUB_TOKEN are correct in Render Environment Variables."
        });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});