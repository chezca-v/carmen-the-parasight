// Firebase configuration - centralized config management
// 🔒 SECURITY: This configuration properly uses environment variables only
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

// 🔒 SECURE: Firebase configuration using environment variables only
const firebaseConfig = {
    apiKey: getEnvVar('VITE_FIREBASE_API_KEY', null),
    authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN', null),
    projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID', null),
    storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET', null),
    messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID', null),
    appId: getEnvVar('VITE_FIREBASE_APP_ID', null),
    measurementId: getEnvVar('VITE_FIREBASE_MEASUREMENT_ID', null)
};

// Validate required configuration
const requiredFields = ['apiKey', 'authDomain', 'projectId'];
const missingFields = requiredFields.filter(field => !firebaseConfig[field]);

if (missingFields.length > 0) {
    console.error('🚨 CRITICAL: Missing Firebase environment variables!');
    console.error('Missing required Firebase configuration fields:', missingFields);
    console.error('');
    console.error('🔒 SECURITY: Firebase credentials must be provided via environment variables');
    console.error('');
    console.error('🔧 Setup Instructions:');
    console.error('1. Create a .env file in your project root');
    console.error('2. Add the following environment variables:');
    console.error('   VITE_FIREBASE_API_KEY=your-api-key');
    console.error('   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com');
    console.error('   VITE_FIREBASE_PROJECT_ID=your-project-id');
    console.error('   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com');
    console.error('   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id');
    console.error('   VITE_FIREBASE_APP_ID=your-app-id');
    console.error('   VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id');
    console.error('3. Restart your development server');
    console.error('');
    console.error('⚠️  SECURITY: Never hardcode Firebase credentials in source code!');
    throw new Error(`🚨 Firebase configuration incomplete. Missing: ${missingFields.join(', ')}`);
}

// Production-safe configuration logging
import('../utils/logger.js').then(({ default: logger }) => {
    logger.info('Firebase Config loaded:', {
        projectId: firebaseConfig.projectId ? '***configured***' : 'MISSING',
        authDomain: firebaseConfig.authDomain ? '***configured***' : 'MISSING',
        usingEnvVars: Boolean(getEnvVar('VITE_FIREBASE_API_KEY', null)),
        environment: typeof import.meta !== 'undefined' ? 'vite' : 'browser',
        securityStatus: 'SECURE - Environment variables only'
    });
}).catch(() => {
    // Fallback for when logger is not available (e.g., in Node.js environment)
    if (typeof window === 'undefined') {
        console.log('Firebase Config loaded (server environment)');
    }
});

// Export the configuration for use in other modules
export { firebaseConfig };