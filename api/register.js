import { db, admin } from './firebase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, phone, telegram, year, price } = req.body;
    
    if (!name || !phone || !year || !price) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    const userRecord = {
      name,
      phone,
      telegram: telegram || 'N/A',
      year,
      price,
      verificationCode: code,
      codeTimestamp: admin.firestore.Timestamp.now(),
      registeredYears: [year],
      createdAt: admin.firestore.Timestamp.now(),
      status: 'pending'
    };

    const docRef = await db.collection('users').add(userRecord);
    
    // Send to Telegram
    const telegramMessage = `*New Registration*\n*Year:* ${year} (${price} ETB)\n*Name:* ${name}\n*Phone:* ${phone}\n*Telegram:* ${telegram || 'N/A'}\n*Verification Code:* ${code}`;
    
    try {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: telegramMessage,
          parse_mode: 'Markdown'
        })
      });
    } catch (telegramError) {
      console.error('Telegram notification failed:', telegramError);
    }
    
    res.status(200).json({ 
      success: true, 
      userId: docRef.id, 
      code 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}