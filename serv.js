const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;
const GIST_ID = process.env.GIST_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Use path.join and __dirname for Vercel compatibility
const DATA_PATH = path.join(__dirname, 'words_output.json');
let vocabulary = [];

// Load local vocabulary once at startup
try {
    console.log(`Checking for file at: ${DATA_PATH}`);
    if (fs.existsSync(DATA_PATH)) {
        vocabulary = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
        console.log(`Successfully loaded ${vocabulary.length} words.`);
    } else {
        // Log all files in directory to help debug if it still fails
        const filesInDir = fs.readdirSync(__dirname);
        console.error(`Warning: words_output.json not found. Files present: ${filesInDir.join(', ')}`);
    }
} catch (err) {
    console.error("Critical error loading vocabulary file:", err.message);
}

// GitHub API Headers
const gistHeaders = {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'User-Agent': 'Vocab-API-Service',
    'Accept': 'application/vnd.github.v3+json'
};

const getSeenWords = async () => {
    try {
        const response = await axios.get(`https://api.github.com/gists/${GIST_ID}`, { 
            headers: gistHeaders,
            params: { _t: Date.now() } 
        });
        
        const targetFile = response.data.files['used_words.json'];
        if (targetFile && targetFile.content) {
            return JSON.parse(targetFile.content);
        }
        return [];
    } catch (err) {
        console.error("Error fetching Gist:", err.message);
        return [];
    }
};

const updateGist = async (list) => {
    try {
        await axios.patch(`https://api.github.com/gists/${GIST_ID}`, {
            files: { 'used_words.json': { content: JSON.stringify(list) } }
        }, { headers: gistHeaders });
    } catch (err) {
        console.error("Error updating Gist:", err.message);
    }
};

app.get('/', (req, res) => {
    res.status(200).send("API is active. Use /get to fetch a unique vocabulary object.");
});

app.get('/get', async (req, res) => {
    try {
        // If it failed at startup, try one more time (lazy loading for Vercel)
        if (vocabulary.length === 0 && fs.existsSync(DATA_PATH)) {
            vocabulary = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
        }

        if (vocabulary.length === 0) {
            return res.status(500).json({ 
                error: "Vocabulary data is missing or empty.",
                pathAttempted: DATA_PATH 
            });
        }

        let seenTerms = await getSeenWords();
        let available = vocabulary.filter(w => !seenTerms.includes(w.term));

        if (available.length === 0) {
            seenTerms = [];
            available = vocabulary;
        }

        const randomIndex = Math.floor(Math.random() * available.length);
        const selectedWord = available[randomIndex];

        seenTerms.push(selectedWord.term);
        await updateGist(seenTerms);

        res.status(200).json({
            success: true,
            remaining_unique: available.length - 1,
            data: selectedWord
        });

    } catch (err) {
        console.error("Route Error:", err.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Export for Vercel Serverless Functions
module.exports = app;

// Only listen if not running as a Vercel function
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}