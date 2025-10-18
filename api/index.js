require('dotenv').config();
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const FormData = require('form-data');

const app = express();

// ==================== SECURE FIREBASE INIT ====================
// Initialize Firebase Admin (KEYS STAY ON SERVER - NOT EXPOSED)
admin.initializeApp({
    credential: admin.credential.cert({
        "type": "service_account",
        "project_id": "medical-quiz-40228",
        "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC4DSMVg4c98kQf\n5sSF8ueD631QgO4SXn0examplekeyheremorechars1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/==\n-----END PRIVATE KEY-----\n",
        "client_email": "firebase-adminsdk-abc123@medical-quiz-40228.iam.gserviceaccount.com"
    })
});
const db = admin.firestore();

// ==================== MIDDLEWARE ====================
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: [
        "https://app-psi-five-32.vercel.app/" // Your frontend URL
    ],
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

// ==================== QUIZ DATA ====================
const quizzes = {
    1: [
        { id: 6, title: "Organic Chemistry", icon: "fas fa-brain", questions: 30, time: 25, difficulty: "intermediate", rating: 4.6, page: "org.html" },
        { id: 7, title: "ENTREPRENUERSHIP", icon: "fas fa-heartbeat", questions: 25, time: 20, difficulty: "intermediate", rating: 4.5, page: "org.html" },
        { id: 8, title: "ECONOMICS", icon: "fas fa-microscope", questions: 20, time: 15, difficulty: "intermediate", rating: 4.3, page: "org.html" },
        { id: 9, title: "CIVIC", icon: "fas fa-flask", questions: 28, time: 22, difficulty: "intermediate", rating: 4.4, page: "org.html" }
    ],
    2: [
        { id: 1, title: "Anatomy", icon: "fas fa-brain", questions: 20, time: 15, difficulty: "beginner", rating: 4.5, page: "org.html" },
        { id: 2, title: "Physiology", icon: "fas fa-microscope", questions: 15, time: 10, difficulty: "beginner", rating: 4.2, page: "org.html" },
        { id: 3, title: "Biochemistry", icon: "fas fa-book", questions: 25, time: 20, difficulty: "beginner", rating: 4.7, page: "org.html" },
        { id: 4, title: "Pathology", icon: "fas fa-flask", questions: 18, time: 15, difficulty: "beginner", rating: 4.3, page: "org.html" },
        { id: 5, title: "Pharmacology", icon: "fas fa-heartbeat", questions: 22, time: 18, difficulty: "beginner", rating: 4.4, page: "org.html" }
    ],
    3: [
        { id: 10, title: "Pathology", icon: "fas fa-virus", questions: 35, time: 30, difficulty: "intermediate", page: "org.html", rating: 4.7 },
        { id: 11, title: "Pharmacology I", icon: "fas fa-pills", questions: 30, time: 25, difficulty: "intermediate", rating: 4.6, page: "org.html" },
        { id: 12, title: "Microbiology", icon: "fas fa-bacteria", questions: 25, time: 20, difficulty: "intermediate", rating: 4.5, page: "org.html" },
        { id: 13, title: "Immunology", icon: "fas fa-shield-virus", questions: 28, time: 22, difficulty: "intermediate", rating: 4.4, page: "org.html" }
    ],
    4: [
        { id: 14, title: "Clinical Medicine I", icon: "fas fa-stethoscope", questions: 40, time: 35, difficulty: "advanced", rating: 4.8, page: "org.html" },
        { id: 15, title: "Surgery Basics", icon: "fas fa-syringe", questions: 35, time: 30, difficulty: "advanced", rating: 4.7, page: "org.html" },
        { id: 16, title: "Pharmacology II", icon: "fas fa-pills", questions: 38, time: 32, difficulty: "advanced", rating: 4.6, page: "org.html" },
        { id: 17, title: "Pathology II", icon: "fas fa-virus", questions: 42, time: 35, difficulty: "advanced", rating: 4.7, page: "org.html" }
    ]
};

const prices = { 1: 100, 2: 120, 3: 140, 4: 160 };

// ==================== HELPER FUNCTIONS ====================
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendToTelegram(photoData, caption) {
    try {
        const formData = new FormData();
        formData.append('chat_id', process.env.TELEGRAM_CHAT_ID);
        
        if (photoData) {
            const buffer = Buffer.from(photoData.split(',')[1], 'base64');
            formData.append('photo', buffer, { filename: 'receipt.jpg' });
        } else {
            formData.append('text', caption);
        }
        
        formData.append('caption', caption);
        formData.append('parse_mode', 'Markdown');

        const response = await axios.post(
            `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendPhoto`,
            formData,
            { headers: formData.getHeaders() }
        );
        
        return { success: true, data: response.data };
    } catch (error) {
        console.error('Telegram error:', error.response?.data || error.message);
        return { success: false, error: error.response?.data?.description || error.message };
    }
}

function generateToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return null;
    }
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }

    req.userId = decoded.userId;
    next();
}

// ==================== FIREBASE DATABASE FUNCTIONS ====================
async function createUser(userData) {
    try {
        const usersRef = db.collection('users');
        const docRef = await usersRef.add({
            ...userData,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'pending'
        });
        return { success: true, userId: docRef.id };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function getUserByPhone(phone) {
    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('phone', '==', phone).get();
        
        if (snapshot.empty) {
            return null;
        }
        
        let user = null;
        snapshot.forEach(doc => {
            user = { id: doc.id, ...doc.data() };
        });
        return user;
    } catch (error) {
        console.error('Error getting user:', error);
        return null;
    }
}

async function updateUser(userId, updates) {
    try {
        const userRef = db.collection('users').doc(userId);
        await userRef.update(updates);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function getUserById(userId) {
    try {
        const userRef = db.collection('users').doc(userId);
        const doc = await userRef.get();
        
        if (!doc.exists) {
            return null;
        }
        
        return { id: doc.id, ...doc.data() };
    } catch (error) {
        console.error('Error getting user by ID:', error);
        return null;
    }
}

// ==================== ROUTES ====================
app.get('/', (req, res) => {
    res.json({ 
        message: 'MediQuiz Secure API with Firebase', 
        status: 'Running',
        version: '1.0.0'
    });
});

app.get('/api/quizzes', authenticateToken, async (req, res) => {
    try {
        const user = await getUserById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const accessibleQuizzes = {};
        user.registeredYears.forEach(year => {
            accessibleQuizzes[year] = quizzes[year] || [];
        });

        res.json({ quizzes: accessibleQuizzes, userYears: user.registeredYears });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/register', async (req, res) => {
    try {
        const { year, name, phone, telegram = 'N/A', receiptImage } = req.body;

        if (!year || !name || !phone || !receiptImage) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if user already exists
        const existingUser = await getUserByPhone(phone);
        if (existingUser) {
            return res.status(400).json({ error: 'User already registered with this phone' });
        }

        const verificationCode = generateVerificationCode();
        
        const userData = {
            name,
            phone,
            telegram,
            registeredYears: [year],
            verificationCode,
            codeTimestamp: Date.now(),
            status: 'pending'
        };

        const result = await createUser(userData);
        
        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        const caption = `*New Registration*\n*Year:* ${year} (${prices[year]} ETB)\n*Name:* ${name}\n*Phone:* ${phone}\n*Telegram:* ${telegram}\n*Verification Code:* ${verificationCode}`;
        
        const telegramResult = await sendToTelegram(receiptImage, caption);
        
        if (!telegramResult.success) {
            // Delete user if Telegram fails
            await db.collection('users').doc(result.userId).delete();
            return res.status(500).json({ error: 'Failed to send registration: ' + telegramResult.error });
        }

        res.json({ 
            success: true, 
            message: 'Registration submitted. Check Telegram for verification code.',
            userId: result.userId
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/verify', async (req, res) => {
    try {
        const { phone, code } = req.body;

        if (!phone || !code) {
            return res.status(400).json({ error: 'Phone and code are required' });
        }

        const user = await getUserByPhone(phone);
        if (!user || user.status !== 'pending') {
            return res.status(404).json({ error: 'User not found or already verified' });
        }

        if (user.verificationCode !== code) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        const now = Date.now();
        const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
        
        if (now - user.codeTimestamp > twoDaysInMs) {
            return res.status(400).json({ error: 'Verification code has expired' });
        }

        await updateUser(user.id, {
            status: 'verified',
            verifiedAt: now
        });

        const token = generateToken(user.id);

        res.json({ 
            success: true, 
            message: 'Verification successful',
            user: {
                id: user.id,
                name: user.name,
                phone: user.phone,
                telegram: user.telegram,
                registeredYears: user.registeredYears,
                status: 'verified'
            },
            token
        });

    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/add-year', authenticateToken, async (req, res) => {
    try {
        const { newYear, receiptImage } = req.body;

        const user = await getUserById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.registeredYears.includes(newYear)) {
            return res.status(400).json({ error: 'Year already registered' });
        }

        const verificationCode = generateVerificationCode();
        
        // Update user with pending year addition
        await updateUser(user.id, {
            pendingYear: newYear,
            verificationCode: verificationCode,
            codeTimestamp: Date.now(),
            status: 'pending_addition'
        });

        const caption = `*Add Year Request*\n*Current Years:* ${user.registeredYears.join(', ')}\n*New Year:* ${newYear}\n*Name:* ${user.name}\n*Phone:* ${user.phone}\n*Telegram:* ${user.telegram}\n*Additional Fee: 50 ETB*\n*Verification Code:* ${verificationCode}`;
        
        const telegramResult = await sendToTelegram(receiptImage, caption);
        
        if (!telegramResult.success) {
            // Revert user status
            await updateUser(user.id, {
                status: 'verified'
            });
            return res.status(500).json({ error: 'Failed to send request: ' + telegramResult.error });
        }

        res.json({ 
            success: true, 
            message: 'Year addition requested. Check Telegram for verification code.'
        });

    } catch (error) {
        console.error('Add year error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.post('/api/verify-year', authenticateToken, async (req, res) => {
    try {
        const { code } = req.body;

        const user = await getUserById(req.userId);
        if (!user || user.status !== 'pending_addition') {
            return res.status(400).json({ error: 'No pending year addition found' });
        }

        if (user.verificationCode !== code) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        const now = Date.now();
        const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
        
        if (now - user.codeTimestamp > twoDaysInMs) {
            return res.status(400).json({ error: 'Verification code has expired' });
        }

        // Add the new year to registered years
        const updatedYears = [...user.registeredYears, user.pendingYear];
        
        await updateUser(user.id, {
            registeredYears: updatedYears,
            status: 'verified',
            verificationCode: null,
            pendingYear: null,
            codeTimestamp: null
        });

        const token = generateToken(user.id);

        res.json({ 
            success: true, 
            message: 'Year added successfully',
            user: {
                id: user.id,
                name: user.name,
                phone: user.phone,
                telegram: user.telegram,
                registeredYears: updatedYears,
                status: 'verified'
            },
            token
        });

    } catch (error) {
        console.error('Verify year error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const user = await getUserById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            user: {
                id: user.id,
                name: user.name,
                phone: user.phone,
                telegram: user.telegram,
                registeredYears: user.registeredYears,
                status: user.status
            }
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.post('/api/comment', authenticateToken, async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const user = await getUserById(req.userId);
        const caption = `*User Comment*\n*Name:* ${user.name}\n*Phone:* ${user.phone}\n*Telegram:* ${user.telegram}\n*Message:* ${message}`;

        const telegramResult = await sendToTelegram(null, caption);
        
        if (!telegramResult.success) {
            return res.status(500).json({ error: 'Failed to send comment: ' + telegramResult.error });
        }

        res.json({ success: true, message: 'Comment sent successfully' });

    } catch (error) {
        console.error('Comment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.post('/api/logout', authenticateToken, async (req, res) => {
    try {
        const user = await getUserById(req.userId);
        const logoutCode = generateVerificationCode();
        
        const caption = `*Logout Request*\n*Years:* ${user.registeredYears.join(', ')}\n*Name:* ${user.name}\n*Phone:* ${user.phone}\n*Telegram:* ${user.telegram}\n*Logout Verification Code:* ${logoutCode}`;

        const telegramResult = await sendToTelegram(null, caption);
        
        if (!telegramResult.success) {
            return res.status(500).json({ error: 'Failed to send logout code: ' + telegramResult.error });
        }

        res.json({ success: true, logoutCode, message: 'Logout code sent to Telegram' });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        database: 'Firebase Firestore',
        security: 'Enabled'
    });
});
// ... (other routes remain similar but use Firebase functions)

// Export for Vercel
module.exports = app;

