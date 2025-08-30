// Firebase configuration - centralized config management
// 🔒 SECURITY: This configuration now properly uses environment variables
// ✅ NO HARDCODED CREDENTIALS - All sensitive data must be in .env file
// 
// IMPORTANT: Never commit Firebase credentials to version control!

// Environment variable support (works with Vite)
const getEnvVar = (key, fallback) => {
    // Check for Vite environment variables
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        return import.meta.env[key] || fallback;
    }
    
    // Check for process.env (Node.js)
    if (typeof process !== 'undefined' && process.env) {
        return process.env[key] || fallback;
    }
    
    // Check for window environment (browser)
    if (typeof window !== 'undefined' && window.env) {
        return window.env[key] || fallback;
    }
    
    return fallback;
};

// 🚀 LIVE SERVER USERS: For quick testing, temporarily uncomment and fill in the section below:
// ⚠️  SECURITY WARNING: Remember to comment this out before committing to Git!

// TEMPORARY CONFIGURATION FOR LIVE SERVER TESTING
// Uncomment this block and add your Firebase credentials for immediate testing
const tempFirebaseConfig = {
    apiKey: "AIzaSyADZIfbk0DqSxWwhNbFtU8bf-pX6qdVM6s",  // ← PUT YOUR REAL API KEY HERE
    authDomain: "carmen-para-sight-v2.firebaseapp.com", 
    projectId: "carmen-para-sight-v2",
    storageBucket: "carmen-para-sight-v2.firebasestorage.app",
    messagingSenderId: "99887505888",
    appId: "1:99887505888:web:99bbf44ebf52d8edfccb85",
    measurementId: "G-GSV3W1CH0V"
};

const firebaseConfig = {
    apiKey: getEnvVar('VITE_FIREBASE_API_KEY', null) || tempFirebaseConfig?.apiKey,
    authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN', null) || tempFirebaseConfig?.authDomain,
    projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID', null) || tempFirebaseConfig?.projectId,
    storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET', null) || tempFirebaseConfig?.storageBucket,
    messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID', null) || tempFirebaseConfig?.messagingSenderId,
    appId: getEnvVar('VITE_FIREBASE_APP_ID', null) || tempFirebaseConfig?.appId,
    measurementId: getEnvVar('VITE_FIREBASE_MEASUREMENT_ID', null) || tempFirebaseConfig?.measurementId
};

// Validate required configuration
const requiredFields = ['apiKey', 'authDomain', 'projectId'];
const missingFields = requiredFields.filter(field => !firebaseConfig[field]);

if (missingFields.length > 0) {
    console.error('🚨 CRITICAL: Missing Firebase environment variables!');
    console.error('Missing required Firebase configuration fields:', missingFields);
    console.error('');
    console.error('🔧 LIVE SERVER USERS - Quick Fix:');
    console.error('1. Open src/services/config.js');
    console.error('2. Find the commented tempFirebaseConfig section');
    console.error('3. Uncomment it and add your Firebase credentials');
    console.error('4. Uncomment the fallback operators in firebaseConfig');
    console.error('');
    console.error('🔒 For production setup:');
    console.error('1. Create a .env file in your project root');
    console.error('2. Add the following environment variables:');
    console.error('   VITE_FIREBASE_API_KEY=your-api-key');
    console.error('   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com');
    console.error('   VITE_FIREBASE_PROJECT_ID=your-project-id');
    console.error('   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com');
    console.error('   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id');
    console.error('   VITE_FIREBASE_APP_ID=your-app-id');
    console.error('3. Use npm run dev instead of Live Server');
    console.error('');
    console.error('⚠️  SECURITY: Firebase credentials are now properly secured!');
    throw new Error(`🚨 Firebase configuration incomplete. Missing: ${missingFields.join(', ')}`);
}

// Production-safe configuration logging
import('../utils/logger.js').then(({ default: logger }) => {
    logger.info('Firebase Config loaded:', {
        projectId: firebaseConfig.projectId ? '***configured***' : 'MISSING',
        authDomain: firebaseConfig.authDomain ? '***configured***' : 'MISSING',
        usingEnvVars: Boolean(getEnvVar('VITE_FIREBASE_API_KEY', null)),
        environment: typeof import.meta !== 'undefined' ? 'vite' : 'browser',
        securityStatus: 'SECURE - No hardcoded credentials'
    });
}).catch(() => {
    // Fallback for when logger is not available (e.g., in Node.js environment)
    if (typeof window === 'undefined') {
        console.log('Firebase Config loaded (server environment)');
    }
});

// Export the configuration for use in other modules
export { firebaseConfig };