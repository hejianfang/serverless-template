// 简单的日志工具
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private level: LogLevel;
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor() {
    this.level = (process.env.LOG_LEVEL as LogLevel) || 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.level];
  }

  private format(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...(args.length > 0 && { data: args }),
    };

    // 在 Lambda 中使用 console 输出会自动发送到 CloudWatch
    console.log(JSON.stringify(logData));
  }

  debug(message: string, ...args: unknown[]): void {
    this.format('debug', message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.format('info', message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.format('warn', message, ...args);
  }

  error(message: string, error?: Error | unknown, ...args: unknown[]): void {
    if (error instanceof Error) {
      this.format('error', message, {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        ...args,
      });
    } else {
      this.format('error', message, error, ...args);
    }
  }
}

// 导出单例
export const logger = new Logger();
