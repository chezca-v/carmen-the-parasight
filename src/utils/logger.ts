/**
 * Production-Safe Logger Utility
 * Provides logging that respects production environment settings
 * TypeScript implementation with strict typing
 */

import environment from './environment';

// Log level types
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

// Log level configuration
export interface LogLevelConfig {
  readonly error: 0;
  readonly warn: 1;
  readonly info: 2;
  readonly debug: 3;
  readonly trace: 4;
}

// Log entry interface
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  args: unknown[];
  context?: Record<string, unknown>;
}

// Logger configuration interface
export interface LoggerConfig {
  isProduction: boolean;
  isDevelopment: boolean;
  currentLevel: number;
  enableTimestamps: boolean;
  enableIcons: boolean;
  maxLogEntries: number;
}

// Logger class with TypeScript support
export class Logger {
  private readonly isProduction: boolean;
  private readonly isDevelopment: boolean;
  private readonly levels: LogLevelConfig;
  private currentLevel: number;
  private readonly enableTimestamps: boolean;
  private readonly enableIcons: boolean;
  private readonly maxLogEntries: number;
  private logHistory: LogEntry[] = [];

  constructor(config?: Partial<LoggerConfig>) {
    this.isProduction = config?.isProduction ?? environment.isProduction();
    this.isDevelopment = config?.isDevelopment ?? environment.isDevelopment();
    
    // Log levels (lower number = higher priority)
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    } as const;

    // Set default log level based on environment
    this.currentLevel = config?.currentLevel ?? (this.isProduction ? this.levels.warn : this.levels.debug);
    
    // Configuration options
    this.enableTimestamps = config?.enableTimestamps ?? !this.isProduction;
    this.enableIcons = config?.enableIcons ?? !this.isProduction;
    this.maxLogEntries = config?.maxLogEntries ?? 1000;
  }

  /**
   * Check if a log level should be displayed
   */
  shouldLog(level: LogLevel): boolean {
    return this.levels[level] <= this.currentLevel;
  }

  /**
   * Set the current log level
   */
  setLogLevel(level: LogLevel): void {
    this.currentLevel = this.levels[level];
  }

  /**
   * Get the current log level
   */
  getLogLevel(): LogLevel {
    for (const [level, value] of Object.entries(this.levels)) {
      if (value === this.currentLevel) {
        return level as LogLevel;
      }
    }
    return 'info';
  }

  /**
   * Format log message with timestamp and level
   */
  private formatMessage(level: LogLevel, message: string, ...args: unknown[]): string[] {
    if (this.isProduction) {
      // In production, return minimal formatting
      return [message, ...args].map(arg => String(arg));
    }

    // In development, add rich formatting
    const parts: string[] = [];
    
    if (this.enableIcons) {
      const levelIcon: Record<LogLevel, string> = {
        error: '❌',
        warn: '⚠️',
        info: 'ℹ️',
        debug: '🐛',
        trace: '🔍'
      };
      parts.push(levelIcon[level]);
    }
    
    if (this.enableTimestamps) {
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
      parts.push(`[${timestamp}]`);
    }
    
    parts.push(message);
    
    return [parts.join(' '), ...args.map(arg => String(arg))];
  }

  /**
   * Add log entry to history
   */
  private addToHistory(level: LogLevel, message: string, args: unknown[]): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      args
    };

    this.logHistory.push(entry);
    
    // Maintain log history size
    if (this.logHistory.length > this.maxLogEntries) {
      this.logHistory = this.logHistory.slice(-this.maxLogEntries);
    }
  }

  /**
   * Error logging - always shown (even in production for critical errors)
   */
  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      const formattedMessage = this.formatMessage('error', message, ...args);
      console.error(...formattedMessage);
      this.addToHistory('error', message, args);
    }
  }

  /**
   * Warning logging - shown in production for important warnings
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      const formattedMessage = this.formatMessage('warn', message, ...args);
      console.warn(...formattedMessage);
      this.addToHistory('warn', message, args);
    }
  }

  /**
   * Info logging - hidden in production
   */
  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      const formattedMessage = this.formatMessage('info', message, ...args);
      console.info(...formattedMessage);
      this.addToHistory('info', message, args);
    }
  }

  /**
   * Debug logging - only in development
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      const formattedMessage = this.formatMessage('debug', message, ...args);
      console.debug(...formattedMessage);
      this.addToHistory('debug', message, args);
    }
  }

  /**
   * Trace logging - only in development for detailed debugging
   */
  trace(message: string, ...args: unknown[]): void {
    if (this.shouldLog('trace')) {
      const formattedMessage = this.formatMessage('trace', message, ...args);
      console.trace(...formattedMessage);
      this.addToHistory('trace', message, args);
    }
  }

  /**
   * Log with context (useful for structured logging)
   */
  logWithContext(level: LogLevel, message: string, context: Record<string, unknown>, ...args: unknown[]): void {
    if (this.shouldLog(level)) {
      const contextStr = Object.entries(context)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(' ');
      
      const fullMessage = `${message} ${contextStr}`;
      const formattedMessage = this.formatMessage(level, fullMessage, ...args);
      
      switch (level) {
        case 'error':
          console.error(...formattedMessage);
          break;
        case 'warn':
          console.warn(...formattedMessage);
          break;
        case 'info':
          console.info(...formattedMessage);
          break;
        case 'debug':
          console.debug(...formattedMessage);
          break;
        case 'trace':
          console.trace(...formattedMessage);
          break;
      }
      
      this.addToHistory(level, message, args);
    }
  }

  /**
   * Group logs together (useful for related operations)
   */
  group(label: string, callback: () => void): void {
    if (this.isDevelopment) {
      console.group(label);
      callback();
      console.groupEnd();
    } else {
      callback();
    }
  }

  /**
   * Group collapsed logs (useful for large groups)
   */
  groupCollapsed(label: string, callback: () => void): void {
    if (this.isDevelopment) {
      console.groupCollapsed(label);
      callback();
      console.groupEnd();
    } else {
      callback();
    }
  }

  /**
   * Get log history
   */
  getLogHistory(): readonly LogEntry[] {
    return [...this.logHistory];
  }

  /**
   * Clear log history
   */
  clearLogHistory(): void {
    this.logHistory = [];
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logHistory, null, 2);
  }

  /**
   * Filter logs by level
   */
  filterLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logHistory.filter(entry => entry.level === level);
  }

  /**
   * Filter logs by time range
   */
  filterLogsByTimeRange(startTime: Date, endTime: Date): LogEntry[] {
    return this.logHistory.filter(entry => {
      const entryTime = new Date(entry.timestamp);
      return entryTime >= startTime && entryTime <= endTime;
    });
  }

  /**
   * Search logs by message content
   */
  searchLogs(query: string): LogEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.logHistory.filter(entry => 
      entry.message.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get log statistics
   */
  getLogStats(): {
    total: number;
    byLevel: Record<LogLevel, number>;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    const byLevel: Record<LogLevel, number> = {
      error: 0,
      warn: 0,
      info: 0,
      debug: 0,
      trace: 0
    };

    this.logHistory.forEach(entry => {
      byLevel[entry.level]++;
    });

    const timestamps = this.logHistory.map(entry => new Date(entry.timestamp));
    const oldestEntry = timestamps.length > 0 ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : null;
    const newestEntry = timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : null;

    return {
      total: this.logHistory.length,
      byLevel,
      oldestEntry,
      newestEntry
    };
  }
}

// Create and export default logger instance
const logger = new Logger();

// Export the logger class for custom instances
export { Logger };

// Export utility functions
export const logError = (message: string, ...args: unknown[]): void => logger.error(message, ...args);
export const logWarn = (message: string, ...args: unknown[]): void => logger.warn(message, ...args);
export const logInfo = (message: string, ...args: unknown[]): void => logger.info(message, ...args);
export const logDebug = (message: string, ...args: unknown[]): void => logger.debug(message, ...args);
export const logTrace = (message: string, ...args: unknown[]): void => logger.trace(message, ...args);

// Export context logging utilities
export const logWithContext = (level: LogLevel, message: string, context: Record<string, unknown>, ...args: unknown[]): void => 
  logger.logWithContext(level, message, context, ...args);

// Export group logging utilities
export const logGroup = (label: string, callback: () => void): void => logger.group(label, callback);
export const logGroupCollapsed = (label: string, callback: () => void): void => logger.groupCollapsed(label, callback);

// Export log management utilities
export const getLogHistory = (): readonly LogEntry[] => logger.getLogHistory();
export const clearLogHistory = (): void => logger.clearLogHistory();
export const exportLogs = (): string => logger.exportLogs();
export const getLogStats = () => logger.getLogStats();

// Default export
export default logger;



