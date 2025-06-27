require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.sendinblue.com',
  port: 587,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

app.post('/ask', async (req, res) => {
  const { question, email } = req.body;
  if (!question || !email) return res.status(400).json({ error: 'question & email required' });

  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful virtual legal assistant. Provide general legal information only.' },
        { role: 'user', content: question }
      ]
    });
    const answer = resp.choices[0].message.content;

    const doc = new PDFDocument();
    const filePath = path.join(__dirname, `../response_${Date.now()}.pdf`);
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    doc.fontSize(14).text('Virtual Legal Assistant Response', { underline: true });
    doc.moveDown().text(`Q: ${question}`).moveDown().text(`A: ${answer}`);
    doc.end();

    stream.on('finish', async () => {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your AI Legal Response PDF',
        text: 'Please see your attached PDF.',
        attachments: [{ filename: 'response.pdf', path: filePath }]
      });
      fs.unlinkSync(filePath);
      res.json({ message: '✅ PDF emailed successfully!' });
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
