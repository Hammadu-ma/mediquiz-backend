import { db, admin } from './firebase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, newYear, name } = req.body;

    if (!userId || !newYear || !name) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = userDoc.data();
    const currentYears = user.registeredYears || [];

    if (currentYears.includes(newYear)) {
      return res.status(400).json({ success: false, error: 'Year already registered' });
    }

    if (user.name !== name) {
      return res.status(400).json({ success: false, error: 'Name verification failed' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    await db.collection('users').doc(userId).update({
      registeredYears: [...currentYears, newYear],
      verificationCode: code,
      codeTimestamp: admin.firestore.Timestamp.now(),
      status: 'pending_addition'
    });

    // Send to Telegram
    const telegramMessage = `*Add Year Request*\n*Current Years:* ${currentYears.join(', ')}\n*New Year:* ${newYear}\n*Name:* ${name}\n*Phone:* ${user.phone}\n*Telegram:* ${user.telegram}\n*Additional Fee: 50 ETB*\n*Verification Code:* ${code}`;
    
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

    res.status(200).json({ success: true, code });
  } catch (error) {
    console.error('Add year error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}