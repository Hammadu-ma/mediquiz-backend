import { db, admin } from './firebase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ success: false, error: 'Phone and code are required' });
    }
    
    const snapshot = await db.collection('users')
      .where('phone', '==', phone)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    let user = null;
    let userDocId = null;
    
    snapshot.forEach(doc => {
      user = doc.data();
      userDocId = doc.id;
    });

    if (user.verificationCode !== code) {
      return res.status(400).json({ success: false, error: 'Invalid verification code' });
    }

    const codeTimestamp = user.codeTimestamp.toDate();
    const now = new Date();
    const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
    
    if (now - codeTimestamp > twoDaysInMs) {
      return res.status(400).json({ success: false, error: 'Verification code has expired' });
    }

    await db.collection('users').doc(userDocId).update({
      status: 'verified',
      verifiedAt: admin.firestore.Timestamp.now()
    });

    const userResponse = {
      id: userDocId,
      name: user.name,
      phone: user.phone,
      telegram: user.telegram,
      registeredYears: user.registeredYears,
      status: 'verified'
    };

    res.status(200).json({ success: true, user: userResponse });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
}