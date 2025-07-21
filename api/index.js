const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');
const validator = require('validator');
require('dotenv').config();

// Import error sanitizer for secure error handling
let errorSanitizer;
try {
  errorSanitizer = require('../src/utils/error-sanitizer.js');
} catch (err) {
  // Fallback error handling if sanitizer not available
  console.warn('Error sanitizer not available, using basic error handling');
  errorSanitizer = {
    sanitizeError: (error) => ({ error: 'An error occurred', timestamp: new Date().toISOString() }),
    sanitizeValidationErrors: () => ({ error: 'Invalid input data', timestamp: new Date().toISOString() }),
    secureErrorHandler: (err, req, res, next) => {
      console.error('Error:', err);
      res.status(500).json({ error: 'Internal server error', timestamp: new Date().toISOString() });
    }
  };
}

// Import CSRF protection for secure state-changing operations
let csrfProtection;
try {
  csrfProtection = require('../src/utils/csrf-protection.js');
} catch (err) {
  // Fallback CSRF handling if protection not available
  console.warn('CSRF protection not available, using basic fallback');
  csrfProtection = {
    csrfMiddleware: () => (req, res, next) => next(),
    generateTokenResponse: () => ({ csrfToken: 'disabled', message: 'CSRF protection disabled' }),
    cleanupSession: () => {},
    getCSRFStats: () => ({ disabled: true })
  };
}

const app = express();

// Enhanced Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://lingaplink-ph.firebaseapp.com", "https://api.gemini.google.com"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      workerSrc: ["'none'"],
      mediaSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false, // Disable for Firebase compatibility
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: false,
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true
}));

// Additional security middleware
app.use((req, res, next) => {
  // Additional security headers
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=()');
  
  // Prevent caching of sensitive endpoints
  if (req.path.includes('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  
  next();
});

// Request validation and security middleware
app.use((req, res, next) => {
  // Validate request size
  const contentLength = req.headers['content-length'];
  if (contentLength && parseInt(contentLength) > 10485760) { // 10MB
    return res.status(413).json({
      error: 'Request Entity Too Large',
      message: 'Request size exceeds maximum allowed limit'
    });
  }
  
  // Validate content type for POST/PUT requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    if (contentType && !contentType.includes('application/json') && 
        !contentType.includes('application/x-www-form-urlencoded') &&
        !contentType.includes('multipart/form-data')) {
      return res.status(415).json({
        error: 'Unsupported Media Type',
        message: 'Content type not supported'
      });
    }
  }
  
  // Block suspicious user agents
  const userAgent = req.headers['user-agent'];
  const suspiciousAgents = [
    /sqlmap/i,
    /nikto/i,
    /nessus/i,
    /masscan/i,
    /nmap/i,
    /scanner/i,
    /burpsuite/i,
    /zap/i
  ];
  
  if (userAgent && suspiciousAgents.some(pattern => pattern.test(userAgent))) {
    console.warn(`Blocked suspicious user agent: ${userAgent} from IP: ${req.ip}`);
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Request blocked'
    });
  }
  
  // Block requests with suspicious headers
  const suspiciousHeaders = ['x-forwarded-host', 'x-real-ip'];
  for (const header of suspiciousHeaders) {
    if (req.headers[header] && req.headers[header] !== req.headers.host) {
      console.warn(`Blocked request with suspicious header: ${header} from IP: ${req.ip}`);
      return res.status(403).json({
        error: 'Forbidden', 
        message: 'Invalid request headers'
      });
    }
  }
  
  next();
});

// HTTPS Redirect for production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}

// Request Logging with security monitoring
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Security event logging middleware
app.use((req, res, next) => {
  // Track potentially suspicious activity
  const suspiciousPatterns = [
    // SQL injection attempts
    /(union|select|insert|delete|drop|update|exec|script)/i,
    // XSS attempts
    /(<script|javascript:|on\w+\s*=|vbscript:)/i,
    // Path traversal
    /(\.\.\/|\.\.\\)/,
    // Command injection
    /(;|&&|\|\|)/,
    // Template injection
    /(\${|\{\{|\[\[)/
  ];
  
  const checkForSuspiciousContent = (obj, path = '') => {
    if (typeof obj === 'string') {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(obj)) {
          console.warn(`🚨 Suspicious content detected in ${path}: ${obj.substring(0, 100)}... from IP: ${req.ip}`);
          return true;
        }
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        if (checkForSuspiciousContent(value, `${path}.${key}`)) {
          return true;
        }
      }
    }
    return false;
  };
  
  // Check URL parameters
  if (checkForSuspiciousContent(req.query, 'query')) {
    console.warn(`🚨 Suspicious query parameters from IP: ${req.ip}, URL: ${req.url}`);
  }
  
  // Check request body
  if (req.body && checkForSuspiciousContent(req.body, 'body')) {
    console.warn(`🚨 Suspicious request body from IP: ${req.ip}, Method: ${req.method}, URL: ${req.url}`);
  }
  
  // Check headers for suspicious content
  const suspiciousHeaderValue = Object.entries(req.headers).find(([key, value]) => {
    return typeof value === 'string' && suspiciousPatterns.some(pattern => pattern.test(value));
  });
  
  if (suspiciousHeaderValue) {
    console.warn(`🚨 Suspicious header detected: ${suspiciousHeaderValue[0]} from IP: ${req.ip}`);
  }
  
  next();
});

// Rate Limiting - Multiple tiers for different security levels
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // limit each IP to 100 requests per windowMs in production
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60 * 1000
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for CSRF token endpoint and health checks
  skip: (req) => {
    return req.path === '/api/auth/csrf-token' || req.path === '/api/health' || req.path === '/';
  }
});

// Strict limiter for sensitive operations (AI, optimization, authentication)
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs for sensitive endpoints
  message: {
    error: 'Too many requests to this endpoint, please try again later.',
    retryAfter: 15 * 60 * 1000
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Medium security limiter for dashboard and analytics
const mediumLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 requests per windowMs
  message: {
    error: 'Rate limit exceeded for this endpoint. Please try again later.',
    retryAfter: 15 * 60 * 1000
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Light limiter for health checks and public endpoints
const lightLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // limit each IP to 50 requests per 5 minutes
  message: {
    error: 'Too many health check requests, please try again later.',
    retryAfter: 5 * 60 * 1000
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Authentication limiter for login/register endpoints  
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Very strict for auth attempts
  message: {
    error: 'Too many authentication attempts. Please try again later.',
    retryAfter: 15 * 60 * 1000
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful auth attempts
});

// Data modification limiter for POST/PUT/DELETE operations
const modificationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20, // limit data modifications
  message: {
    error: 'Too many data modification requests. Please try again later.',
    retryAfter: 10 * 60 * 1000
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiting to all API routes as baseline
app.use('/api/', limiter);

// Enhanced CORS Configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.NODE_ENV === 'production' 
      ? [
          process.env.CORS_ORIGIN || 'https://your-vercel-domain.vercel.app',
          'https://lingaplink.vercel.app',
          'https://carmen-para-sight.vercel.app'
        ]
      : [
          'http://localhost:5173',
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:8080',
          'http://127.0.0.1:5173',
          'http://127.0.0.1:3000'
        ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400 // 24 hours
}));

// Input Sanitization Middleware
app.use(mongoSanitize());

// Cookie parser for CSRF token handling
const cookieParser = require('cookie-parser');
app.use(cookieParser());

// Body Parser with size limits
app.use(express.json({ 
  limit: '10mb',
  strict: true
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Input Sanitization Utilities
const sanitizeString = (str, maxLength = 1000) => {
  if (!str || typeof str !== 'string') return '';
  // Remove dangerous characters and patterns
  let sanitized = str
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/data:/gi, '') // Remove data: protocol
    .replace(/vbscript:/gi, '') // Remove vbscript: protocol
    .replace(/file:/gi, '') // Remove file: protocol
    .trim()
    .substring(0, maxLength);
  
  return xss(validator.escape(sanitized));
};

const sanitizeEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  const sanitized = email.trim().toLowerCase()
    .replace(/[^\w@\.\-\+]/g, '') // Only allow valid email characters
    .substring(0, 254); // RFC standard max length
  return validator.isEmail(sanitized) ? validator.normalizeEmail(sanitized) : '';
};

const sanitizePhone = (phone) => {
  if (!phone || typeof phone !== 'string') return '';
  // Remove all characters except digits, +, -, (, ), and spaces
  const sanitized = phone.replace(/[^\d\+\-\(\)\s]/g, '').trim().substring(0, 20);
  // Validate basic phone format
  return /^[\+]?[0-9\s\-\(\)]{7,20}$/.test(sanitized) ? sanitized : '';
};

const sanitizeNumber = (num, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = parseFloat(num);
  if (isNaN(parsed) || !isFinite(parsed)) return min;
  return Math.min(Math.max(parsed, min), max);
};

const sanitizeArray = (arr, maxLength = 100, itemValidator = null) => {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, maxLength).map(item => {
    if (typeof item === 'string') {
      return sanitizeString(item, 200);
    } else if (itemValidator && typeof itemValidator === 'function') {
      return itemValidator(item);
    }
    return item;
  }).filter(item => item !== null && item !== undefined);
};

const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  const sanitized = url.trim().substring(0, 2048);
  try {
    const urlObj = new URL(sanitized);
    // Only allow http and https protocols
    if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
      return validator.isURL(sanitized) ? sanitized : '';
    }
  } catch {
    return '';
  }
  return '';
};

const sanitizeFilename = (filename) => {
  if (!filename || typeof filename !== 'string') return '';
  return filename
    .replace(/[^a-zA-Z0-9\.\-\_]/g, '') // Only allow safe filename characters
    .replace(/\.{2,}/g, '.') // Prevent directory traversal
    .substring(0, 255)
    .trim();
};

// Firebase Configuration - using environment variables for security
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || process.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Validate Firebase configuration
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Firebase configuration incomplete. Please check your environment variables.');
  console.log('Required environment variables:');
  console.log('- FIREBASE_API_KEY (or VITE_FIREBASE_API_KEY)');
  console.log('- FIREBASE_PROJECT_ID (or VITE_FIREBASE_PROJECT_ID)');
  console.log('- FIREBASE_AUTH_DOMAIN (or VITE_FIREBASE_AUTH_DOMAIN)');
  process.exit(1);
}

// Initialize Firebase Admin (for server-side authentication)
let adminAuth;
let db;
try {
  if (!admin.apps.length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) : null;
    
    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: firebaseConfig.projectId
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // For production environments like Google Cloud Run/Functions
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: firebaseConfig.projectId
      });
    } else {
      console.warn('⚠️ Firebase Admin SDK not initialized. Missing FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS.');
    }
  }
  
  if (admin.apps.length > 0) {
    adminAuth = admin.auth();
    db = admin.firestore();
    console.log('✅ Firebase Admin SDK initialized successfully.');
  } else {
    // Mocking auth/db for local development without credentials
    console.warn('⚠️ Using mocked Firebase services for development.');
    adminAuth = null;
    db = null;
  }

} catch (error) {
  console.error('❌ Firebase Admin initialization failed:', error);
  // Fallback to mock objects to prevent crashes
  adminAuth = null;
  db = null;
}

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// Authentication Middleware
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'No valid authorization token provided' 
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify Firebase ID token
    if (adminAuth) {
      const decodedToken = await adminAuth.verifyIdToken(token);
      req.user = decodedToken;
    } else {
      // Fallback JWT verification (for development)
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
      req.user = decoded;
    }
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid or expired token' 
    });
  }
};

// Optional Authentication Middleware (for endpoints that can work with or without auth)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      
      if (adminAuth) {
        const decodedToken = await adminAuth.verifyIdToken(token);
        req.user = decodedToken;
      } else {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
        req.user = decoded;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// Role-based authorization middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authentication required' 
      });
    }
    
    const userRole = req.user.role || req.user.custom_claims?.role;
    
    if (!roles.includes(userRole)) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Insufficient permissions' 
      });
    }
    
    next();
  };
};

// Input validation middleware with secure error handling
const validateInput = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const sanitizedResponse = errorSanitizer.sanitizeValidationErrors(errors.array());
    return res.status(400).json(sanitizedResponse);
  }
  next();
};

// CSRF Protection Configuration
const csrfErrorHandler = (err, req, res, next) => {
  if (err.code && err.code.startsWith('CSRF_')) {
    const sanitized = errorSanitizer.sanitizeError(err, { 
      context: 'csrf-protection' 
    });
    return res.status(err.status || 403).json({
      error: 'CSRF protection error',
      message: sanitized.error,
      code: err.code,
      timestamp: sanitized.timestamp
    });
  }
  next(err);
};

// Configure CSRF protection with custom settings
if (csrfProtection.configureCSRFProtection) {
  const csrfOptions = {
    errorHandler: csrfErrorHandler,
    skipRoutes: [
      '/api/auth/csrf-token',
      '/api/health',
      '/api/dashboard/stats', // GET only
      '/api/surgery/queue',    // GET only
      '/api/or/status',        // GET only
      '/api/rural/patients',   // GET only
      '/api/analytics/wait-times', // GET only
      '/api/patient/'          // GET requests only
    ],
    skipMethods: ['GET', 'HEAD', 'OPTIONS'],
    sessionIdExtractor: (req) => {
      // Extract session ID from authenticated user or generate from IP for anonymous users
      return req.user?.uid || req.sessionID || `anonymous_${req.ip}`;
    }
  };
  
  // Apply CSRF middleware
  app.use(csrfProtection.csrfMiddleware(csrfOptions));
  console.log('✅ CSRF protection enabled for state-changing operations');
} else {
  console.warn('⚠️ CSRF protection not available');
}

// Secure error handling middleware
const errorHandler = (err, req, res, next) => {
  // Use the secure error handler from error-sanitizer
  errorSanitizer.secureErrorHandler(err, req, res, next);
};

// Health check endpoint (no auth required) - Light rate limiting
app.get('/api/health', lightLimiter, (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'LingapLink PH API is running',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// CSRF token endpoint (requires authentication) - No rate limiting
app.get('/api/auth/csrf-token', 
  authenticateUser,
  async (req, res) => {
    try {
      const sessionId = req.user?.uid || req.sessionID || `anonymous_${req.ip}`;
      
      if (!csrfProtection.generateTokenResponse) {
        return res.json({
          error: 'CSRF protection not available',
          message: 'CSRF tokens are disabled in this configuration'
        });
      }
      
      const tokenResponse = csrfProtection.generateTokenResponse(req, res, sessionId);
      
      res.json({
        success: true,
        ...tokenResponse,
        message: 'CSRF token generated successfully',
        instructions: {
          header: `Include token in '${tokenResponse.headerName}' header for all state-changing requests`,
          cookie: `Token also set as '${tokenResponse.cookieName}' cookie for double-submit pattern`,
          expiry: 'Token expires in 30 minutes and should be refreshed as needed'
        }
      });
      
    } catch (error) {
      const sanitized = errorSanitizer.sanitizeError(error, { context: 'csrf-token-generation' });
      res.status(500).json({
        error: 'Failed to generate CSRF token',
        ...sanitized
      });
    }
  }
);

// CSRF token refresh endpoint (requires authentication) - Light rate limiting
app.post('/api/auth/csrf-token/refresh',
  lightLimiter,
  authenticateUser,
  async (req, res) => {
    try {
      const sessionId = req.user?.uid || req.sessionID || `anonymous_${req.ip}`;
      
      // Check if current token should be rotated
      const currentToken = req.headers[csrfProtection.CSRF_CONFIG?.HEADER_NAME] || req.body?._csrf;
      const shouldRotate = !currentToken || csrfProtection.shouldRotateToken?.(currentToken);
      
      if (!shouldRotate) {
        return res.json({
          success: true,
          message: 'Current CSRF token is still valid',
          shouldRefresh: false
        });
      }
      
      // Generate new token
      const tokenResponse = csrfProtection.generateTokenResponse(req, res, sessionId);
      
      res.json({
        success: true,
        ...tokenResponse,
        message: 'CSRF token refreshed successfully',
        rotated: true
      });
      
    } catch (error) {
      const sanitized = errorSanitizer.sanitizeError(error, { context: 'csrf-token-refresh' });
      res.status(500).json({
        error: 'Failed to refresh CSRF token',
        ...sanitized
      });
    }
  }
);

// Get dashboard statistics (requires authentication) - Medium rate limiting
app.get('/api/dashboard/stats', 
  mediumLimiter,
  authenticateUser, 
  requireRole(['admin', 'doctor', 'nurse']),
  [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be in ISO8601 format'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be in ISO8601 format'),
    query('hospital')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .matches(/^[a-zA-Z0-9\s\-\_\.]+$/)
      .withMessage('Hospital must be under 100 characters and contain only alphanumeric characters')
  ],
  validateInput,
  async (req, res) => {
  try {
    // In production, this would fetch from Firebase based on user's hospital/clinic
    const userId = req.user.uid;
    const userRole = req.user.role || req.user.custom_claims?.role;
    const { startDate, endDate, hospital } = req.query;
    
    // Demo data - in production, filter by user's access level
    const stats = {
      patientsInQueue: userRole === 'admin' ? 847 : 156,
      averageWaitTime: "89 days",
      orUtilization: "78%",
      urgentCases: 23,
      telemedicineConsultations: 156,
      mobileClinicVisits: 42,
      offlineConsultations: 31,
      lastUpdated: new Date().toISOString()
    };
    
    res.json(stats);
  } catch (error) {
    const sanitized = errorSanitizer.sanitizeError(error, { context: 'fetch-dashboard-stats' });
    res.status(500).json({ 
      error: 'Failed to fetch dashboard statistics',
      ...sanitized
    });
  }
});

// Surgery prioritization endpoints (requires authentication) - Medium rate limiting
app.get('/api/surgery/queue', 
  mediumLimiter,
  authenticateUser, 
  requireRole(['admin', 'doctor', 'surgeon']),
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer'),
    query('urgency')
      .optional()
      .isIn(['Low', 'Medium', 'High', 'Critical'])
      .withMessage('Invalid urgency level'),
    query('specialty')
      .optional()
      .isString()
      .isLength({ min: 1, max: 50 })
      .matches(/^[a-zA-Z\s\-]+$/)
      .withMessage('Specialty must be under 50 characters and contain only letters'),
    query('location')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .matches(/^[a-zA-Z0-9\s\-\,\.]+$/)
      .withMessage('Location must be under 100 characters')
  ],
  validateInput,
  async (req, res) => {
  try {
    const userId = req.user.uid;
    const userRole = req.user.role || req.user.custom_claims?.role;
    const { limit, offset, urgency, specialty, location } = req.query;
    
    // Sample data - in production, fetch from Firebase based on user's hospital/location
    const surgeryQueue = [
      {
        id: '1',
        patientName: 'Maria Santos',
        patientId: 'patient_001',
        procedure: 'Hysterectomy',
        urgency: 'Critical',
        waitTime: 156,
        location: 'Manila',
        urgencyScore: 89,
        estimatedDuration: '2-3 hours',
        requiredSpecialty: 'Gynecology',
        createdAt: new Date().toISOString()
      },
      {
        id: '2',
        patientName: 'Ana Rodriguez',
        patientId: 'patient_002',
        procedure: 'Fibroid Removal',
        urgency: 'High',
        waitTime: 134,
        location: 'Quezon City',
        urgencyScore: 82,
        estimatedDuration: '1-2 hours',
        requiredSpecialty: 'Gynecology',
        createdAt: new Date().toISOString()
      },
      {
        id: '3',
        patientName: 'Carmen Dela Cruz',
        patientId: 'patient_003',
        procedure: 'Ovarian Cyst Surgery',
        urgency: 'High',
        waitTime: 98,
        location: 'Rural Bataan',
        urgencyScore: 78,
        estimatedDuration: '1-2 hours',
        requiredSpecialty: 'Gynecology',
        createdAt: new Date().toISOString()
      }
    ];
    
    // Filter based on user role and location
    const filteredQueue = userRole === 'admin' 
      ? surgeryQueue 
      : surgeryQueue.filter(item => item.location === req.user.location);
    
    res.json({ 
      queue: filteredQueue,
      totalCount: filteredQueue.length,
      lastUpdated: new Date().toISOString()
    });
      } catch (error) {
      const sanitized = errorSanitizer.sanitizeError(error, { context: 'fetch-surgery-queue' });
      res.status(500).json({ 
        error: 'Failed to fetch surgery queue',
        ...sanitized
      });
    }
});

// OR optimization endpoints (requires authentication) - Medium rate limiting
app.get('/api/or/status', 
  mediumLimiter,
  authenticateUser, 
  requireRole(['admin', 'doctor', 'nurse', 'or_coordinator']),
  [
    query('status')
      .optional()
      .isIn(['Available', 'In Use', 'Maintenance', 'Scheduled'])
      .withMessage('Invalid OR status'),
    query('specialty')
      .optional()
      .isString()
      .isLength({ min: 1, max: 50 })
      .matches(/^[a-zA-Z\s\-]+$/)
      .withMessage('Specialty must be under 50 characters and contain only letters'),
    query('minUtilization')
      .optional()
      .isInt({ min: 0, max: 100 })
      .withMessage('Minimum utilization must be between 0 and 100'),
    query('maxUtilization')
      .optional()
      .isInt({ min: 0, max: 100 })
      .withMessage('Maximum utilization must be between 0 and 100')
  ],
  validateInput,
  async (req, res) => {
  try {
    const userId = req.user.uid;
    const userRole = req.user.role || req.user.custom_claims?.role;
    const { status, specialty, minUtilization, maxUtilization } = req.query;
    
    const orStatus = [
      { 
        id: 'OR-1', 
        status: 'In Use', 
        utilization: 85, 
        specialty: 'Gynecology',
        currentProcedure: 'Hysterectomy',
        estimatedCompletion: '2024-01-15T14:30:00Z',
        lastUpdated: new Date().toISOString()
      },
      { 
        id: 'OR-2', 
        status: 'Available', 
        utilization: 72, 
        specialty: 'General Surgery',
        currentProcedure: null,
        estimatedCompletion: null,
        lastUpdated: new Date().toISOString()
      },
      { 
        id: 'OR-3', 
        status: 'Maintenance', 
        utilization: 45, 
        specialty: 'Orthopedics',
        currentProcedure: null,
        estimatedCompletion: '2024-01-15T16:00:00Z',
        lastUpdated: new Date().toISOString()
      },
      { 
        id: 'OR-4', 
        status: 'In Use', 
        utilization: 92, 
        specialty: 'Gynecology',
        currentProcedure: 'Fibroid Removal',
        estimatedCompletion: '2024-01-15T15:00:00Z',
        lastUpdated: new Date().toISOString()
      },
      { 
        id: 'OR-5', 
        status: 'Scheduled', 
        utilization: 68, 
        specialty: 'Cardiology',
        currentProcedure: null,
        estimatedCompletion: '2024-01-15T13:00:00Z',
        lastUpdated: new Date().toISOString()
      }
    ];
    
    res.json({ 
      orStatus,
      totalRooms: orStatus.length,
      averageUtilization: Math.round(orStatus.reduce((acc, or) => acc + or.utilization, 0) / orStatus.length),
      lastUpdated: new Date().toISOString()
    });
      } catch (error) {
      const sanitized = errorSanitizer.sanitizeError(error, { context: 'fetch-or-status' });
      res.status(500).json({ 
        error: 'Failed to fetch OR status',
        ...sanitized
      });
    }
});

// AI-powered optimization suggestions (requires authentication and strict rate limiting)
app.post('/api/or/optimize', 
  strictLimiter, 
  authenticateUser, 
  requireRole(['admin', 'or_coordinator']),
  [
    body('orData').isArray().withMessage('OR data must be an array'),
    body('orData.*.id').notEmpty().withMessage('OR ID is required'),
    body('orData.*.utilization').isNumeric().withMessage('Utilization must be a number'),
    body('demandData').optional().isObject().withMessage('Demand data must be an object')
  ],
  validateInput,
  async (req, res) => {
    try {
      const { orData, demandData } = req.body;
      
      // Input sanitization
      const sanitizedOrData = orData.map(or => ({
        id: or.id,
        status: or.status,
        utilization: Math.min(Math.max(or.utilization, 0), 100),
        specialty: or.specialty
      }));
      
      if (!genAI) {
        return res.status(503).json({ 
          error: 'AI Service Unavailable',
          message: 'Gemini AI is not configured. Please check your API key.'
        });
      }
      
      const prompt = `
      As an AI healthcare optimization specialist, analyze this OR utilization data and provide optimization suggestions:
      
      Operating Rooms: ${JSON.stringify(sanitizedOrData)}
      Demand Data: ${JSON.stringify(demandData || {})}
      
      Provide 4-5 specific, actionable recommendations to improve OR utilization and reduce surgical wait times in Philippine hospitals.
      Focus on:
      1. Scheduling optimization
      2. Resource allocation
      3. Staff efficiency
      4. Equipment utilization
      5. Maintenance scheduling
      
      Format as a JSON array of objects with 'suggestion' and 'impact' properties.
      Keep suggestions practical and implementable.
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let suggestions = response.text();
      
      // Try to parse as JSON, fallback to default suggestions if parsing fails
      try {
        suggestions = JSON.parse(suggestions);
      } catch {
        suggestions = [
          { 
            suggestion: "Reschedule OR-3 maintenance to off-peak hours (6 PM - 6 AM)", 
            impact: "+12% utilization",
            priority: "High",
            estimatedImplementationTime: "1 week"
          },
          { 
            suggestion: "Cross-train staff for gynecology procedures to reduce bottlenecks", 
            impact: "+8% efficiency",
            priority: "Medium",
            estimatedImplementationTime: "2-3 months"
          },
          { 
            suggestion: "Extend OR-1 operating hours on Wednesdays to handle backlog", 
            impact: "+15% capacity",
            priority: "High",
            estimatedImplementationTime: "2 weeks"
          },
          { 
            suggestion: "Implement rapid turnover protocols between procedures", 
            impact: "+20 min saved per surgery",
            priority: "Medium",
            estimatedImplementationTime: "1 month"
          }
        ];
      }
      
      res.json({ 
        suggestions,
        generatedAt: new Date().toISOString(),
        basedOn: {
          orRoomsAnalyzed: sanitizedOrData.length,
          averageUtilization: Math.round(sanitizedOrData.reduce((acc, or) => acc + or.utilization, 0) / sanitizedOrData.length)
        }
      });
    } catch (error) {
      const sanitized = errorSanitizer.sanitizeError(error, { context: 'generate-optimization-suggestions' });
      res.status(500).json({ 
        error: 'Failed to generate optimization suggestions',
        ...sanitized
      });
    }
  }
);

// Telemedicine and rural patient endpoints (requires authentication and query validation) - Medium rate limiting
app.get('/api/telemedicine/patients', 
  mediumLimiter,
  authenticateUser, 
  requireRole(['admin', 'doctor', 'nurse', 'chw']), 
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer'),
    query('location')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Location must be under 100 characters'),
    query('urgency')
      .optional()
      .isIn(['Low', 'Medium', 'High', 'Critical'])
      .withMessage('Invalid urgency level')
  ],
  validateInput,
  async (req, res) => {
    try {
      const userId = req.user.uid;
      const userRole = req.user.role || req.user.custom_claims?.role;
      const { limit = 50, offset = 0, location, urgency } = req.query;
    
    const ruralPatients = [
      {
        id: '1',
        name: 'Rosa Dela Cruz',
        location: 'Siquijor Island',
        distance: 623,
        condition: 'Heavy Menstrual Bleeding',
        urgency: 'High',
        connectivity: 'None',
        communicationMethod: 'Radio',
        hasSmartphone: false,
        nearestHealthCenter: 'Siquijor Provincial Hospital',
        communityHealthWorker: 'Aling Nena Villanueva',
        lastContact: '2024-01-10',
        status: 'Waiting for consultation'
      },
      {
        id: '2',
        name: 'Luz Mendoza',
        location: 'Basilan, Isabela City',
        distance: 789,
        condition: 'Pregnancy Complications',
        urgency: 'Critical',
        connectivity: 'None',
        communicationMethod: 'CHW',
        hasSmartphone: false,
        nearestHealthCenter: 'Basilan General Hospital',
        communityHealthWorker: 'Mang Tony Ramos',
        lastContact: '2024-01-12',
        status: 'Emergency referral needed'
      }
    ];
    
    // Apply filters
    let filteredPatients = ruralPatients;
    if (location) {
      filteredPatients = filteredPatients.filter(p => 
        p.location.toLowerCase().includes(location.toLowerCase())
      );
    }
    if (urgency) {
      filteredPatients = filteredPatients.filter(p => p.urgency === urgency);
    }
    
    // Apply pagination
    const paginatedPatients = filteredPatients.slice(offset, offset + parseInt(limit));
    
    res.json({ 
      patients: paginatedPatients,
      totalCount: filteredPatients.length,
      limit: parseInt(limit),
      offset: parseInt(offset),
      lastUpdated: new Date().toISOString()
    });
      } catch (error) {
      const sanitized = errorSanitizer.sanitizeError(error, { context: 'fetch-rural-patients' });
      res.status(500).json({ 
        error: 'Failed to fetch rural patients',
        ...sanitized
      });
    }
});

// Schedule offline consultation (NOW WITH PROPER VALIDATION) - Data modification rate limiting
app.post('/api/telemedicine/schedule-offline', 
  modificationLimiter,
  authenticateUser,
  requireRole(['admin', 'doctor', 'nurse', 'chw']),
  [
    body('patientId')
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('Patient ID is required and must be under 50 characters'),
    body('method')
      .isIn(['Radio', 'CHW', 'Mobile Clinic', 'Offline Form', 'SMS'])
      .withMessage('Invalid consultation method'),
    body('scheduledDate')
      .isISO8601()
      .toDate()
      .withMessage('Valid scheduled date is required'),
    body('notes')
      .optional()
      .isString()
      .isLength({ max: 1000 })
      .withMessage('Notes must be under 1000 characters'),
    body('priority')
      .optional()
      .isIn(['Low', 'Medium', 'High', 'Critical'])
      .withMessage('Invalid priority level')
  ],
  validateInput,
  async (req, res) => {
    try {
      const { patientId, method, scheduledDate, notes, priority } = req.body;
      const userId = req.user.uid;
      
      // Sanitize inputs
      const sanitizedData = {
        patientId: sanitizeString(patientId, 50),
        method: sanitizeString(method, 50),
        scheduledDate: new Date(scheduledDate),
        notes: sanitizeString(notes || '', 1000),
        priority: sanitizeString(priority || 'Medium', 20),
        scheduledBy: userId
      };
      
      // Validate date is in the future
      if (sanitizedData.scheduledDate <= new Date()) {
        return res.status(400).json({
          error: 'Invalid Date',
          message: 'Scheduled date must be in the future'
        });
      }
      
      // In production, save to Firebase
      const consultation = {
        id: `consult_${Date.now()}`,
        ...sanitizedData,
        status: 'scheduled',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      res.json({ 
        success: true, 
        message: `${sanitizedData.method} consultation scheduled successfully`,
        consultation 
      });
    } catch (error) {
      const sanitized = errorSanitizer.sanitizeError(error, { context: 'schedule-offline-consultation' });
      res.status(500).json({ 
        error: 'Failed to schedule consultation',
        ...sanitized
      });
    }
  }
);

// AI health consultation endpoint (requires authentication and strict rate limiting)
app.post('/api/ai/consultation', 
  strictLimiter,
  authenticateUser,
  requireRole(['admin', 'doctor', 'nurse', 'patient']),
  [
    body('symptoms').isString().isLength({ min: 10, max: 1000 }).withMessage('Symptoms must be between 10 and 1000 characters'),
    body('patientHistory').optional().isString().isLength({ max: 2000 }).withMessage('Patient history must be less than 2000 characters'),
    body('urgency').isIn(['Low', 'Medium', 'High', 'Critical']).withMessage('Urgency must be Low, Medium, High, or Critical')
  ],
  validateInput,
  async (req, res) => {
    try {
      const { symptoms, patientHistory, urgency } = req.body;
      const userId = req.user.uid;
      
      // Input sanitization
      const sanitizedSymptoms = symptoms.trim().substring(0, 1000);
      const sanitizedHistory = patientHistory ? patientHistory.trim().substring(0, 2000) : '';
      
      if (!genAI) {
        return res.status(503).json({ 
          error: 'AI Service Unavailable',
          message: 'AI consultation service is temporarily unavailable. Please consult with a healthcare provider directly.'
        });
      }
      
      const prompt = `
      As a medical AI assistant for LingapLink PH, provide a preliminary assessment for a Filipino patient:
      
      Symptoms: ${sanitizedSymptoms}
      Patient History: ${sanitizedHistory}
      Urgency Level: ${urgency}
      
      Please provide:
      1. Preliminary assessment (non-diagnostic)
      2. Recommended urgency level (Low/Medium/High/Critical)
      3. Suggested next steps
      4. Whether immediate medical attention is needed
      5. Telemedicine suitability
      
      Important: This is not a medical diagnosis. Always recommend consulting with healthcare professionals.
      Respond in JSON format with clear, patient-friendly language in English and Filipino.
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let assessment = response.text();
      
      // Try to parse as JSON, fallback to structured response
      try {
        assessment = JSON.parse(assessment);
      } catch {
        assessment = {
          preliminaryAssessment: "Based on the symptoms provided, further medical evaluation is recommended.",
          recommendedUrgency: urgency,
          nextSteps: [
            "Schedule consultation with healthcare provider",
            "Monitor symptoms closely",
            "Seek immediate care if symptoms worsen",
            "Consider telemedicine consultation"
          ],
          immediateAttention: urgency === 'Critical' || urgency === 'High',
          telemedicineSuitable: true,
          disclaimer: "This is not a medical diagnosis. Please consult with a qualified healthcare professional."
        };
      }
      
      res.json({ 
        assessment,
        consultationId: `consult_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: userId
      });
    } catch (error) {
      const sanitized = errorSanitizer.sanitizeError(error, { context: 'generate-ai-consultation' });
      res.status(500).json({ 
        error: 'Failed to generate consultation',
        ...sanitized
      });
    }
  }
);

// Patient portal endpoints (requires authentication and parameter validation) - Medium rate limiting
app.get('/api/patient/:id', 
  mediumLimiter,
  authenticateUser,
  requireRole(['admin', 'doctor', 'nurse', 'patient']),
  [
    param('id')
      .isString()
      .isLength({ min: 1, max: 50 })
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Invalid patient ID format')
  ],
  validateInput,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.uid;
      const userRole = req.user.role || req.user.custom_claims?.role;
      
      // Sanitize patient ID
      const sanitizedId = sanitizeString(id, 50);
      
      // Authorization check: patients can only access their own data
      if (userRole === 'patient' && sanitizedId !== userId) {
        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'You can only access your own patient data'
        });
      }
      
      // Sample patient data - in production, fetch from Firebase
      const patient = {
        id: sanitizedId,
        name: 'Maria Santos',
        age: 34,
        condition: 'Uterine Fibroids',
        nextAppointment: '2024-01-15',
        lastVisit: '2023-12-10',
        medications: ['Ibuprofen 400mg', 'Iron supplements'],
        documents: [
          { name: 'Lab Results', type: 'PDF', date: '2024-01-10' },
          { name: 'Ultrasound Report', type: 'PDF', date: '2023-12-08' }
        ],
        contactInfo: {
          email: 'maria.santos@email.com',
          phone: '+63 917 123 4567'
        },
        emergencyContact: {
          name: 'Juan Santos',
          relationship: 'Spouse',
          phone: '+63 917 987 6543'
        },
        lastUpdated: new Date().toISOString()
      };
      
      res.json(patient);
    } catch (error) {
      const sanitized = errorSanitizer.sanitizeError(error, { context: 'fetch-patient-data' });
      res.status(500).json({ 
        error: 'Failed to fetch patient data',
        ...sanitized
      });
    }
  }
);

// Analytics endpoints (requires authentication and query validation) - Medium rate limiting
app.get('/api/analytics/wait-times', 
  mediumLimiter,
  authenticateUser,
  requireRole(['admin', 'doctor', 'analyst']),
  [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be in ISO8601 format'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be in ISO8601 format'),
    query('department')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Department must be under 100 characters')
  ],
  validateInput,
  async (req, res) => {
    try {
      const userId = req.user.uid;
      const userRole = req.user.role || req.user.custom_claims?.role;
      const { startDate, endDate, department } = req.query;
      
      const waitTimeData = [
        { month: 'Sep', averageWait: 165, target: 120, improvement: -27 },
        { month: 'Oct', averageWait: 158, target: 120, improvement: -4 },
        { month: 'Nov', averageWait: 142, target: 120, improvement: -10 },
        { month: 'Dec', averageWait: 128, target: 120, improvement: -10 },
        { month: 'Jan', averageWait: 89, target: 120, improvement: -30 }
      ];
      
      res.json({ 
        data: waitTimeData,
        totalImprovement: 46, // percentage improvement from Sep to Jan
        trend: 'decreasing',
        filters: {
          startDate: startDate || null,
          endDate: endDate || null,
          department: department || 'All'
        },
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      const sanitized = errorSanitizer.sanitizeError(error, { context: 'fetch-wait-time-analytics' });
      res.status(500).json({ 
        error: 'Failed to fetch wait time analytics',
        ...sanitized
      });
    }
  }
);

// Save patient data (requires authentication and validation) - Data modification rate limiting
app.post('/api/patient', 
  modificationLimiter,
  authenticateUser,
  requireRole(['admin', 'doctor', 'nurse']),
  [
    body('name').isString().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('age').isInt({ min: 0, max: 150 }).withMessage('Age must be a valid number between 0 and 150'),
    body('condition').optional().isString().isLength({ max: 500 }).withMessage('Condition must be less than 500 characters'),
    body('medications').optional().isArray().withMessage('Medications must be an array'),
    body('contactInfo.email').optional().isEmail().withMessage('Please provide a valid email'),
    body('contactInfo.phone').optional().isString().isLength({ min: 10, max: 20 }).withMessage('Phone number must be between 10 and 20 characters')
  ],
  validateInput,
  async (req, res) => {
    try {
      const patientData = req.body;
      const userId = req.user.uid;
      
      // Input sanitization
      const sanitizedData = {
        ...patientData,
        name: patientData.name.trim(),
        age: parseInt(patientData.age),
        condition: patientData.condition ? patientData.condition.trim() : '',
        medications: patientData.medications || [],
        contactInfo: {
          email: patientData.contactInfo?.email?.trim() || '',
          phone: patientData.contactInfo?.phone?.trim() || ''
        },
        createdBy: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // In production, save to Firebase
      const docRef = db.collection('patients').doc(patientData.id || Date.now().toString());
      await docRef.set(sanitizedData);
      
      res.json({ 
        success: true, 
        message: 'Patient data saved successfully',
        patientId: docRef.id,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const sanitized = errorSanitizer.sanitizeError(error, { context: 'save-patient-data' });
      res.status(500).json({ 
        error: 'Failed to save patient data',
        ...sanitized
      });
    }
  }
);

// Apply the comprehensive error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'API endpoint not found',
    message: 'The requested endpoint does not exist',
    timestamp: new Date().toISOString()
  });
});

const port = process.env.PORT || 3001;

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`🚀 LingapLink PH API server running on port ${port}`);
    console.log(`🔒 Security features enabled`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🏥 Firebase project: ${firebaseConfig.projectId}`);
  });
}

module.exports = app; 