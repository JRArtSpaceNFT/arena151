/**
 * Structured logging for Arena 151
 * 
 * In production: sends to log aggregator (Axiom, Logtail, etc.)
 * In development: pretty-prints to console
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  userId?: string
  matchId?: string
  [key: string]: any
}

class Logger {
  private log(level: LogLevel, message: string, context?: LogContext) {
    const entry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      ...context,
    }
    
    if (process.env.NODE_ENV === 'production') {
      // Send to log aggregator via internal API
      // Fire-and-forget to avoid blocking
      fetch('/api/internal/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      }).catch(() => {
        // Fallback to console if logging API fails
        console[level === 'debug' ? 'log' : level](message, context)
      })
    } else {
      // Development: pretty-print to console
      const color = {
        debug: '\x1b[36m', // cyan
        info: '\x1b[32m',  // green
        warn: '\x1b[33m',  // yellow
        error: '\x1b[31m', // red
      }[level]
      
      const reset = '\x1b[0m'
      console[level === 'debug' ? 'log' : level](
        `${color}[${level.toUpperCase()}]${reset} ${message}`,
        context || ''
      )
    }
  }
  
  debug(msg: string, ctx?: LogContext) { this.log('debug', msg, ctx) }
  info(msg: string, ctx?: LogContext) { this.log('info', msg, ctx) }
  warn(msg: string, ctx?: LogContext) { this.log('warn', msg, ctx) }
  error(msg: string, ctx?: LogContext) { this.log('error', msg, ctx) }
}

export const logger = new Logger()
