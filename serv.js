const express = require('express');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// --- STATE MANAGEMENT ---
let vocabulary = [];
let availableIndices = [];

function initializeVocabulary() {
    try {
        const data = fs.readFileSync('./words_output.json', 'utf8');
        vocabulary = JSON.parse(data);
        
        // Create an array of indices [0, 1, 2, ... n]
        availableIndices = [...Array(vocabulary.length).keys()];
        
        // Fisher-Yates Shuffle for true randomness
        for (let i = availableIndices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableIndices[i], availableIndices[j]] = [availableIndices[j], availableIndices[i]];
        }
        
        console.log("Vocabulary loaded and shuffled.");
    } catch (err) {
        console.error("Error loading JSON:", err);
    }
}


initializeVocabulary();

// --- API ENDPOINT ---
app.get('/', (req, res) => {
    if (vocabulary.length === 0) {
        return res.status(500).json({ error: "No data found" });
    }

    // If we've used all words, reshuffle and start over
    if (availableIndices.length === 0) {
        console.log("Cycle complete. Reshuffling...");
        initializeVocabulary();
    }

    // Pop the last index from the shuffled list (unique every time)
    const targetIndex = availableIndices.pop();
    const word = vocabulary[targetIndex];

    res.json({
        remainingInCycle: availableIndices.length,
        data: word
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Endpoint: http://localhost:${PORT}/api/next-word`);
});