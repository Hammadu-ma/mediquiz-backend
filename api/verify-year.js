import { db, admin } from './firebase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      return res.status(400).json({ success: false, error: 'User ID and code are required' });
    }
    
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = userDoc.data();

    if (user.verificationCode !== code) {
      return res.status(400).json({ success: false, error: 'Invalid verification code' });
    }

    const codeTimestamp = user.codeTimestamp.toDate();
    const now = new Date();
    const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
    
    if (now - codeTimestamp > twoDaysInMs) {
      return res.status(400).json({ success: false, error: 'Verification code has expired' });
    }

    await db.collection('users').doc(userId).update({
      status: 'verified'
    });

    const updatedUser = {
      id: userId,
      name: user.name,
      phone: user.phone,
      telegram: user.telegram,
      registeredYears: user.registeredYears,
      status: 'verified'
    };

    res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Verify year error:', error);
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
}