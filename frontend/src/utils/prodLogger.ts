const isDevelopment: boolean = !!import.meta.env.DEV;
const isProduction: boolean = !!import.meta.env.PROD;

export const logger = {
  log: (...args: unknown[]) => {
    if (isDevelopment) console.log(...args);
  },
  info: (...args: unknown[]) => {
    if (isDevelopment) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
  debug: (...args: unknown[]) => {
    if (isDevelopment) console.debug(...args);
  },
  table: (...args: unknown[]) => {
    if (isDevelopment && (console as any).table) (console as any).table(...args);
  },
  group: (...args: unknown[]) => {
    if (isDevelopment) console.group(...args);
  },
  groupEnd: () => {
    if (isDevelopment) console.groupEnd();
  },
  time: (label: string) => {
    if (isDevelopment) console.time(label);
  },
  timeEnd: (label: string) => {
    if (isDevelopment) console.timeEnd(label);
  },
};

export const devLog = (...args: unknown[]) => {
  if (isDevelopment) console.log(...args);
};

export const reportError = (error: unknown, context: Record<string, unknown> = {}) => {
  console.error('[ERROR]', error, context);
  // Hook for Sentry later
};

export const perfLog = (label: string, startTime: number) => {
  if (isDevelopment) {
    const duration = performance.now() - startTime;
    console.log(`⏱️ [PERF] ${label}: ${duration.toFixed(2)}ms`);
  }
};

class Logger {
  private module: string;
  constructor(module: string) {
    this.module = module;
  }
  private _log(level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', emoji: string, ...args: unknown[]) {
    const timestamp = new Date().toISOString().split('T')[1]?.slice(0, -1);
    const prefix = `[${timestamp}] ${emoji} [${this.module}]`;
    if (isProduction && (level === 'DEBUG' || level === 'INFO')) return;
    switch (level) {
      case 'DEBUG':
        console.log(prefix, ...args);
        break;
      case 'INFO':
        console.info(prefix, ...args);
        break;
      case 'WARN':
        console.warn(prefix, ...args);
        break;
      case 'ERROR':
        console.error(prefix, ...args);
        break;
    }
  }
  debug(...args: unknown[]) { this._log('DEBUG', '🔍', ...args); }
  info(...args: unknown[]) { this._log('INFO', 'ℹ️', ...args); }
  warn(...args: unknown[]) { this._log('WARN', '⚠️', ...args); }
  error(...args: unknown[]) { this._log('ERROR', '❌', ...args); }
  success(...args: unknown[]) { this._log('INFO', '✅', ...args); }
  api(method: string, endpoint: string, data?: unknown) { this._log('DEBUG', '📡', `${method} ${endpoint}`, data); }
  apiResponse(status: number, endpoint: string, data?: unknown) {
    const emoji = status < 400 ? '✅' : '❌';
    this._log('DEBUG', emoji, `[${status}] ${endpoint}`, data);
  }
  ws(event: string, data?: unknown) { this._log('DEBUG', '🔌', `WS: ${event}`, data); }
  log(...args: unknown[]) { this.info(...args); }
}

export default Logger;

export const authLogger = new Logger('AUTH');
export const ttsLogger = new Logger('TTS');
export const chatLogger = new Logger('CHAT');
export const streamLogger = new Logger('STREAM');
export const youtubeLogger = new Logger('YOUTUBE');
export const dropsLogger = new Logger('DROPS');
export const commandsLogger = new Logger('COMMANDS');
export const apiLogger = new Logger('API');
export const wsLogger = new Logger('WEBSOCKET');

if (isDevelopment) {
  console.log('🔓 Development mode: Full logging enabled');
} else {
  console.log('🔒 Production mode: Limited logging (errors only)');
}


