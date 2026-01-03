const express = require('express');
const fs = require('fs');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;
const GIST_ID = process.env.GIST_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Path to your vocabulary JSON file
const DATA_PATH = './words_output.json';
let vocabulary = [];

// Load local vocabulary once at startup
try {
    if (fs.existsSync(DATA_PATH)) {
        vocabulary = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
        console.log(`Successfully loaded ${vocabulary.length} words.`);
    } else {
        console.error(`Warning: ${DATA_PATH} not found.`);
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

/**
 * Fetches the list of already seen terms from the GitHub Gist.
 * Handles cases where the file might be missing or empty.
 */
const getSeenWords = async () => {
    try {
        const response = await axios.get(`https://api.github.com/gists/${GIST_ID}`, { 
            headers: gistHeaders,
            params: { _t: Date.now() } // Cache busting
        });
        
        const files = response.data.files;
        const targetFile = files['used_words.json'];

        if (targetFile && targetFile.content) {
            try {
                return JSON.parse(targetFile.content);
            } catch (pErr) {
                console.error("JSON Parse error in Gist content. Resetting to empty array.");
                return [];
            }
        }
        return [];
    } catch (err) {
        console.error("Error fetching Gist:", err.response ? err.response.data : err.message);
        return []; // Fallback to empty if Gist fetch fails
    }
};

/**
 * Updates the GitHub Gist with the new list of seen terms.
 */
const updateGist = async (list) => {
    try {
        await axios.patch(`https://api.github.com/gists/${GIST_ID}`, {
            files: { 'used_words.json': { content: JSON.stringify(list) } }
        }, { headers: gistHeaders });
    } catch (err) {
        console.error("Error updating Gist:", err.response ? err.response.data : err.message);
    }
};

/**
 * Health Check Route
 * Returns 200 OK as requested.
 */
app.get('/', (req, res) => {
    res.status(200).send("API is active. Use /get to fetch a unique vocabulary object.");
});

/**
 * Main Data Route
 * Fetches a unique word, manages state via Gist, and returns result.
 */
app.get('/get', async (req, res) => {
    try {
        if (vocabulary.length === 0) {
            return res.status(500).json({ error: "Vocabulary data is missing or empty." });
        }

        // 1. Get seen words from persistent state (Gist)
        let seenTerms = await getSeenWords();

        // 2. Filter out words already seen
        let available = vocabulary.filter(w => !seenTerms.includes(w.term));

        // 3. If all words are used, reset the cycle
        if (available.length === 0) {
            console.log("All words seen. Resetting cycle...");
            seenTerms = [];
            available = vocabulary;
        }

        // 4. Randomly select one unique word
        const randomIndex = Math.floor(Math.random() * available.length);
        const selectedWord = available[randomIndex];

        // 5. Update persistent state
        seenTerms.push(selectedWord.term);
        await updateGist(seenTerms);

        // 6. Respond with the word
        res.status(200).json({
            success: true,
            remaining_unique: available.length - 1,
            data: selectedWord
        });

    } catch (err) {
        console.error("Route Error:", err.message);
        res.status(500).json({ 
            error: "Internal Server Error", 
            message: "Failed to process unique word request." 
        });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Main Endpoint: http://localhost:${PORT}/get`);
});