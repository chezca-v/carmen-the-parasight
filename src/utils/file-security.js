/**
 * File Upload Security Manager
 * Prevents file upload validation bypasses and ensures secure file handling
 */

class FileSecurityManager {
    constructor() {
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
        this.allowedFileTypes = {
            image: {
                extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
                mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
                maxSize: 5 * 1024 * 1024 // 5MB for images
            },
            document: {
                extensions: ['pdf', 'doc', 'docx', 'txt'],
                mimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
                maxSize: 10 * 1024 * 1024 // 10MB for documents
            },
            medical: {
                extensions: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
                mimeTypes: [
                    'application/pdf',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'image/jpeg',
                    'image/png'
                ],
                maxSize: 10 * 1024 * 1024 // 10MB for medical files
            }
        };
        
        this.dangerousExtensions = [
            'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar',
            'php', 'asp', 'aspx', 'jsp', 'pl', 'py', 'rb', 'sh', 'ps1'
        ];
        
        this.dangerousMimeTypes = [
            'application/x-executable',
            'application/x-msdownload',
            'application/x-msi',
            'application/x-msdos-program',
            'application/x-msi',
            'application/x-msi-installer'
        ];
        
        this.suspiciousPatterns = [
            /\.\./, // Directory traversal
            /[<>:"|?*]/, // Invalid filename characters
            /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Reserved Windows names
            /\.(php|asp|aspx|jsp|pl|py|rb|sh|ps1)$/i, // Script files
            /\.(exe|bat|cmd|com|pif|scr|vbs|js|jar)$/i // Executable files
        ];
    }

    /**
     * Comprehensive file validation
     */
    async validateFile(file, allowedType = 'medical', customMaxSize = null) {
        if (!file || !(file instanceof File)) {
            return { valid: false, error: 'File is required' };
        }

        const validationResults = [];
        
        // 1. Basic file validation
        const basicValidation = this.validateBasicFile(file);
        if (!basicValidation.valid) {
            return basicValidation;
        }
        
        // 2. File size validation
        const sizeValidation = this.validateFileSize(file, allowedType, customMaxSize);
        if (!sizeValidation.valid) {
            return sizeValidation;
        }
        
        // 3. File type validation
        const typeValidation = this.validateFileType(file, allowedType);
        if (!typeValidation.valid) {
            return typeValidation;
        }
        
        // 4. Filename security validation
        const filenameValidation = this.validateFilename(file.name);
        if (!filenameValidation.valid) {
            return filenameValidation;
        }
        
        // 5. Content validation
        const contentValidation = await this.validateFileContent(file);
        if (!contentValidation.valid) {
            return contentValidation;
        }
        
        // 6. Virus scan simulation (in production, integrate with real antivirus API)
        const virusValidation = this.simulateVirusScan(file);
        if (!virusValidation.valid) {
            return virusValidation;
        }
        
        return {
            valid: true,
            file: file,
            sanitizedFilename: this.sanitizeFilename(file.name),
            fileType: allowedType,
            fileSize: file.size,
            mimeType: file.type,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Basic file validation
     */
    validateBasicFile(file) {
        // Check if file exists and is a File object
        if (!file) {
            return { valid: false, error: 'No file provided' };
        }
        
        if (!(file instanceof File)) {
            return { valid: false, error: 'Invalid file object' };
        }
        
        // Check if file is empty
        if (file.size === 0) {
            return { valid: false, error: 'File is empty' };
        }
        
        // Check if file is too large (absolute maximum)
        if (file.size > this.maxFileSize) {
            return { 
                valid: false, 
                error: `File size exceeds maximum allowed size of ${Math.round(this.maxFileSize / 1024 / 1024)}MB` 
            };
        }
        
        return { valid: true };
    }

    /**
     * Validate file size
     */
    validateFileSize(file, allowedType, customMaxSize) {
        const maxSize = customMaxSize || this.allowedFileTypes[allowedType]?.maxSize || this.maxFileSize;
        
        if (file.size > maxSize) {
            return { 
                valid: false, 
                error: `File size exceeds maximum allowed size of ${Math.round(maxSize / 1024 / 1024)}MB` 
            };
        }
        
        return { valid: true };
    }

    /**
     * Validate file type
     */
    validateFileType(file, allowedType) {
        const allowedTypes = this.allowedFileTypes[allowedType];
        if (!allowedTypes) {
            return { valid: false, error: `Invalid file type category: ${allowedType}` };
        }
        
        // Get file extension
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        if (!fileExtension) {
            return { valid: false, error: 'File has no extension' };
        }
        
        // Check if extension is allowed
        if (!allowedTypes.extensions.includes(fileExtension)) {
            return { 
                valid: false, 
                error: `File type not allowed. Allowed types: ${allowedTypes.extensions.join(', ')}` 
            };
        }
        
        // Check if MIME type is allowed
        if (file.type && !allowedTypes.mimeTypes.includes(file.type)) {
            return { 
                valid: false, 
                error: `MIME type not allowed: ${file.type}` 
            };
        }
        
        // Check for dangerous extensions
        if (this.dangerousExtensions.includes(fileExtension)) {
            return { valid: false, error: 'File type is not allowed for security reasons' };
        }
        
        return { valid: true };
    }

    /**
     * Validate filename security
     */
    validateFilename(filename) {
        if (!filename || typeof filename !== 'string') {
            return { valid: false, error: 'Invalid filename' };
        }
        
        // Check for suspicious patterns
        for (const pattern of this.suspiciousPatterns) {
            if (pattern.test(filename)) {
                return { valid: false, error: 'Filename contains suspicious patterns' };
            }
        }
        
        // Check filename length
        if (filename.length > 255) {
            return { valid: false, error: 'Filename is too long' };
        }
        
        // Check for null bytes
        if (filename.includes('\0')) {
            return { valid: false, error: 'Filename contains null bytes' };
        }
        
        return { valid: true };
    }

    /**
     * Validate file content
     */
    async validateFileContent(file) {
        try {
            // Read first few bytes to check file signature
            const buffer = await this.readFileHeader(file, 8);
            const signature = this.getFileSignature(buffer);
            
            // Check if signature matches expected file type
            const fileExtension = file.name.split('.').pop()?.toLowerCase();
            if (signature && !this.isValidFileSignature(signature, fileExtension)) {
                return { valid: false, error: 'File content does not match file extension' };
            }
            
            // Check for executable content
            if (this.isExecutableContent(buffer)) {
                return { valid: false, error: 'File contains executable content' };
            }
            
            return { valid: true };
            
        } catch (error) {
            return { valid: false, error: 'Unable to validate file content' };
        }
    }

    /**
     * Read file header
     */
    readFileHeader(file, bytes) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const arrayBuffer = reader.result;
                const uint8Array = new Uint8Array(arrayBuffer);
                resolve(uint8Array.slice(0, bytes));
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file.slice(0, bytes));
        });
    }

    /**
     * Get file signature from header
     */
    getFileSignature(buffer) {
        if (buffer.length < 4) return null;
        
        const signatures = {
            // Images
            '89504E47': 'png', // PNG
            'FFD8FF': 'jpeg', // JPEG
            '47494638': 'gif', // GIF
            '52494646': 'webp', // WebP
            
            // Documents
            '25504446': 'pdf', // PDF
            'D0CF11E0': 'doc', // DOC
            '504B0304': 'docx', // DOCX
            '504B0506': 'docx', // DOCX
            '504B0708': 'docx' // DOCX
        };
        
        const hex = Array.from(buffer.slice(0, 4))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('').toUpperCase();
        
        for (const [signature, type] of Object.entries(signatures)) {
            if (hex.startsWith(signature)) {
                return { type, signature: hex };
            }
        }
        
        return null;
    }

    /**
     * Check if file signature is valid for extension
     */
    isValidFileSignature(signature, extension) {
        const validSignatures = {
            'png': ['89504E47'],
            'jpg': ['FFD8FF'],
            'jpeg': ['FFD8FF'],
            'gif': ['47494638'],
            'webp': ['52494646'],
            'pdf': ['25504446'],
            'doc': ['D0CF11E0'],
            'docx': ['504B0304', '504B0506', '504B0708']
        };
        
        const validSigs = validSignatures[extension];
        return validSigs && validSigs.includes(signature.signature);
    }

    /**
     * Check if content is executable
     */
    isExecutableContent(buffer) {
        // Check for common executable signatures
        const executableSignatures = [
            '4D5A', // MZ (Windows executable)
            '7F454C46', // ELF (Linux executable)
            'FEEDFACE', // Mach-O (macOS executable)
            'CAFEBABE' // Java class file
        ];
        
        const hex = Array.from(buffer.slice(0, 4))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('').toUpperCase();
        
        return executableSignatures.some(sig => hex.startsWith(sig));
    }

    /**
     * Simulate virus scan
     */
    simulateVirusScan(file) {
        // In production, integrate with real antivirus API
        // For now, simulate basic checks
        
        // Check file size (very large files might be suspicious)
        if (file.size > 100 * 1024 * 1024) { // 100MB
            return { valid: false, error: 'File size is suspiciously large' };
        }
        
        // Check for suspicious patterns in filename
        const suspiciousKeywords = ['virus', 'malware', 'trojan', 'backdoor', 'keylogger'];
        const filename = file.name.toLowerCase();
        if (suspiciousKeywords.some(keyword => filename.includes(keyword))) {
            return { valid: false, error: 'Filename contains suspicious keywords' };
        }
        
        return { valid: true };
    }

    /**
     * Sanitize filename
     */
    sanitizeFilename(filename) {
        if (!filename) return '';
        
        let sanitized = filename
            .replace(/[<>:"|?*]/g, '') // Remove invalid characters
            .replace(/\.\./g, '') // Remove directory traversal
            .replace(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])/i, 'file_$1') // Fix reserved names
            .trim();
        
        // Ensure filename has extension
        if (!sanitized.includes('.')) {
            sanitized += '.txt';
        }
        
        // Limit length
        if (sanitized.length > 255) {
            const extension = sanitized.split('.').pop();
            const name = sanitized.substring(0, sanitized.lastIndexOf('.'));
            sanitized = name.substring(0, 255 - extension.length - 1) + '.' + extension;
        }
        
        return sanitized;
    }

    /**
     * Create secure file upload configuration
     */
    createUploadConfig(allowedType = 'medical', customMaxSize = null) {
        const config = this.allowedFileTypes[allowedType];
        if (!config) {
            throw new Error(`Invalid file type: ${allowedType}`);
        }
        
        return {
            allowedExtensions: config.extensions,
            allowedMimeTypes: config.mimeTypes,
            maxFileSize: customMaxSize || config.maxSize,
            maxFileSizeMB: Math.round((customMaxSize || config.maxSize) / 1024 / 1024),
            dangerousExtensions: this.dangerousExtensions,
            suspiciousPatterns: this.suspiciousPatterns.map(p => p.toString()),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get file security statistics
     */
    getSecurityStats() {
        return {
            maxFileSize: this.maxFileSize,
            allowedFileTypes: Object.keys(this.allowedFileTypes),
            dangerousExtensions: this.dangerousExtensions.length,
            suspiciousPatterns: this.suspiciousPatterns.length,
            timestamp: new Date().toISOString()
        };
    }
}

// Create singleton instance
const fileSecurityManager = new FileSecurityManager();

export default fileSecurityManager;



