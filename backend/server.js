const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 5000; //Not running on any platforms only local

app.use(cors());
app.use(express.json()); //set up parsing for interpretation

app.get('/api/test', (req, res) => {
    res.json({ message: 'To infinity... and hopefully not beyond our data!'});
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

