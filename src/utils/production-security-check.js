/**
 * Production Security Check - Verify Debug Code is Hidden
 * Comprehensive security audit for production environments
 */

import environment from './environment.js';
import logger from './logger.js';

class ProductionSecurityCheck {
    constructor() {
        this.isProduction = environment.isProduction();
        this.checkResults = [];
        this.securityIssues = [];
    }

    /**
     * Run comprehensive security audit
     */
    async runSecurityAudit() {
        logger.info('🔍 Starting Production Security Audit...');
        
        this.checkResults = [];
        this.securityIssues = [];

        // Run all security checks
        await this.checkDebugElements();
        await this.checkConsoleStatements();
        await this.checkGlobalDebugVariables();
        await this.checkDebugComments();
        await this.checkEnvironmentDetection();
        await this.checkLoggerSafety();

        // Generate audit report
        const auditReport = this.generateAuditReport();
        
        if (this.isProduction) {
            if (auditReport.passed) {
                logger.info('✅ Production Security Audit PASSED - No debug code exposed');
            } else {
                logger.error('❌ Production Security Audit FAILED - Debug code exposure detected!');
                logger.error('Security Issues:', this.securityIssues);
            }
        } else {
            logger.dev('🔧 Development Security Audit Complete');
        }

        return auditReport;
    }

    /**
     * Check for visible debug elements
     */
    async checkDebugElements() {
        const checkName = 'Debug Elements Visibility';
        let passed = true;
        const issues = [];

        try {
            // Check for debug panels
            const debugPanels = document.querySelectorAll('.debug-panel, #debugPanel, [data-debug]');
            const visiblePanels = Array.from(debugPanels).filter(el => 
                el.style.display !== 'none' && 
                el.style.visibility !== 'hidden' &&
                !el.hasAttribute('data-production-hidden')
            );

            if (visiblePanels.length > 0 && this.isProduction) {
                passed = false;
                issues.push({
                    type: 'VISIBLE_DEBUG_PANELS',
                    count: visiblePanels.length,
                    elements: visiblePanels.map(el => ({
                        id: el.id,
                        class: el.className,
                        tag: el.tagName
                    }))
                });
            }

            // Check for debug buttons
            const debugButtons = document.querySelectorAll('.debug-show-btn, .debug-close-btn, [data-debug-trigger]');
            const visibleButtons = Array.from(debugButtons).filter(el => 
                el.style.display !== 'none' && 
                el.style.visibility !== 'hidden' &&
                !el.hasAttribute('data-production-hidden')
            );

            if (visibleButtons.length > 0 && this.isProduction) {
                passed = false;
                issues.push({
                    type: 'VISIBLE_DEBUG_BUTTONS',
                    count: visibleButtons.length,
                    elements: visibleButtons.map(el => ({
                        id: el.id,
                        class: el.className,
                        tag: el.tagName
                    }))
                });
            }

        } catch (error) {
            passed = false;
            issues.push({ type: 'CHECK_ERROR', error: error.message });
        }

        this.addCheckResult(checkName, passed, issues);
    }

    /**
     * Check for console statements in production
     */
    async checkConsoleStatements() {
        const checkName = 'Console Statements Safety';
        let passed = true;
        const issues = [];

        try {
            // Monitor console calls (this is a basic check)
            if (this.isProduction && typeof window.console === 'object') {
                // In production, we should primarily see only errors and warnings
                // This is checked by verifying logger is being used instead of direct console calls
                
                // Check if logger is properly integrated
                const loggerIntegrated = typeof window.signInLogger !== 'undefined' || 
                                       typeof window.signUpLogger !== 'undefined' ||
                                       typeof window.firestoreLogger !== 'undefined';
                
                if (!loggerIntegrated) {
                    passed = false;
                    issues.push({
                        type: 'LOGGER_NOT_INTEGRATED',
                        message: 'Production-safe logger not properly integrated'
                    });
                }
            }

        } catch (error) {
            passed = false;
            issues.push({ type: 'CHECK_ERROR', error: error.message });
        }

        this.addCheckResult(checkName, passed, issues);
    }

    /**
     * Check for exposed global debug variables
     */
    async checkGlobalDebugVariables() {
        const checkName = 'Global Debug Variables';
        let passed = true;
        const issues = [];

        try {
            const debugVariables = [
                'authDebug',
                'debugUtils', 
                '__DEBUG__',
                'DEBUG_MODE',
                'DEVELOPMENT_MODE'
            ];

            const exposedVars = debugVariables.filter(varName => 
                typeof window[varName] !== 'undefined'
            );

            if (exposedVars.length > 0 && this.isProduction) {
                passed = false;
                issues.push({
                    type: 'EXPOSED_DEBUG_VARIABLES',
                    variables: exposedVars,
                    message: 'Global debug variables should not be exposed in production'
                });
            }

        } catch (error) {
            passed = false;
            issues.push({ type: 'CHECK_ERROR', error: error.message });
        }

        this.addCheckResult(checkName, passed, issues);
    }

    /**
     * Check for debug comments in HTML
     */
    async checkDebugComments() {
        const checkName = 'Debug Comments Cleanup';
        let passed = true;
        const issues = [];

        try {
            const walker = document.createTreeWalker(
                document.body || document.documentElement,
                NodeFilter.SHOW_COMMENT,
                null,
                false
            );

            const debugComments = [];
            let node;

            while (node = walker.nextNode()) {
                const comment = node.textContent.toLowerCase();
                if (comment.includes('debug') || 
                    comment.includes('remove in production') ||
                    comment.includes('dev only') ||
                    comment.includes('development')) {
                    debugComments.push(node.textContent);
                }
            }

            if (debugComments.length > 0 && this.isProduction) {
                passed = false;
                issues.push({
                    type: 'DEBUG_COMMENTS_PRESENT',
                    count: debugComments.length,
                    comments: debugComments.slice(0, 5) // Show first 5
                });
            }

        } catch (error) {
            passed = false;
            issues.push({ type: 'CHECK_ERROR', error: error.message });
        }

        this.addCheckResult(checkName, passed, issues);
    }

    /**
     * Check environment detection accuracy
     */
    async checkEnvironmentDetection() {
        const checkName = 'Environment Detection';
        let passed = true;
        const issues = [];

        try {
            const envInfo = environment.getInfo();
            
            // Verify environment detection is working
            if (!envInfo.environment || 
                (envInfo.environment !== 'production' && envInfo.environment !== 'development')) {
                passed = false;
                issues.push({
                    type: 'INVALID_ENVIRONMENT_DETECTION',
                    detected: envInfo.environment,
                    message: 'Environment detection returned invalid value'
                });
            }

            // Check consistency
            if (this.isProduction !== envInfo.isProduction) {
                passed = false;
                issues.push({
                    type: 'ENVIRONMENT_INCONSISTENCY',
                    message: 'Environment detection inconsistency detected'
                });
            }

        } catch (error) {
            passed = false;
            issues.push({ type: 'CHECK_ERROR', error: error.message });
        }

        this.addCheckResult(checkName, passed, issues);
    }

    /**
     * Check logger safety and configuration
     */
    async checkLoggerSafety() {
        const checkName = 'Logger Safety Configuration';
        let passed = true;
        const issues = [];

        try {
            // Check if logger is configured for production
            if (this.isProduction) {
                // Verify logger exists and is properly configured
                if (typeof logger === 'undefined') {
                    passed = false;
                    issues.push({
                        type: 'LOGGER_MISSING',
                        message: 'Logger is not available in production'
                    });
                } else {
                    // Check if logger respects production environment
                    if (typeof logger.isProduction === 'function' && !logger.isProduction()) {
                        passed = false;
                        issues.push({
                            type: 'LOGGER_MISCONFIGURED',
                            message: 'Logger not properly configured for production'
                        });
                    }
                }
            }

        } catch (error) {
            passed = false;
            issues.push({ type: 'CHECK_ERROR', error: error.message });
        }

        this.addCheckResult(checkName, passed, issues);
    }

    /**
     * Add check result
     */
    addCheckResult(checkName, passed, issues) {
        const result = {
            checkName,
            passed,
            issues,
            timestamp: new Date().toISOString()
        };

        this.checkResults.push(result);

        if (!passed) {
            this.securityIssues.push(...issues);
        }

        // Log result
        if (passed) {
            logger.info(`✅ ${checkName}: PASSED`);
        } else {
            logger.warn(`❌ ${checkName}: FAILED`, issues);
        }
    }

    /**
     * Generate comprehensive audit report
     */
    generateAuditReport() {
        const totalChecks = this.checkResults.length;
        const passedChecks = this.checkResults.filter(r => r.passed).length;
        const failedChecks = totalChecks - passedChecks;

        const report = {
            timestamp: new Date().toISOString(),
            environment: environment.getEnvironment(),
            summary: {
                totalChecks,
                passedChecks,
                failedChecks,
                passed: failedChecks === 0
            },
            checks: this.checkResults,
            securityIssues: this.securityIssues,
            recommendations: this.generateRecommendations()
        };

        return report;
    }

    /**
     * Generate security recommendations
     */
    generateRecommendations() {
        const recommendations = [];

        if (this.securityIssues.length === 0) {
            recommendations.push('✅ All security checks passed. No action required.');
        } else {
            this.securityIssues.forEach(issue => {
                switch (issue.type) {
                    case 'VISIBLE_DEBUG_PANELS':
                        recommendations.push('🔧 Hide debug panels using debug manager or remove from production build');
                        break;
                    case 'VISIBLE_DEBUG_BUTTONS':
                        recommendations.push('🔧 Hide debug buttons using data-debug attributes');
                        break;
                    case 'EXPOSED_DEBUG_VARIABLES':
                        recommendations.push('🔧 Remove global debug variables in production');
                        break;
                    case 'DEBUG_COMMENTS_PRESENT':
                        recommendations.push('🔧 Remove debug comments from production HTML');
                        break;
                    case 'LOGGER_NOT_INTEGRATED':
                        recommendations.push('🔧 Integrate production-safe logger in all modules');
                        break;
                    default:
                        recommendations.push('🔧 Review and fix identified security issue');
                }
            });
        }

        return recommendations;
    }
}

// Auto-run security check in production
if (environment.isProduction()) {
    // Run security check after page load
    window.addEventListener('load', async () => {
        setTimeout(async () => {
            const securityCheck = new ProductionSecurityCheck();
            const auditReport = await securityCheck.runSecurityAudit();
            
            // Store audit report for review
            window.__SECURITY_AUDIT__ = auditReport;
        }, 2000);
    });
}

export default ProductionSecurityCheck; 