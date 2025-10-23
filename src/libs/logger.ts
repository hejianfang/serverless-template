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

  /**
   * 安全地序列化值，处理 Error 对象、AWS SDK 错误和循环引用
   */
  private serializeValue(value: unknown, seen = new WeakSet()): unknown {
    // 处理原始类型
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value !== 'object') {
      return value;
    }

    // 处理 Error 对象
    if (value instanceof Error) {
      const errorObj: Record<string, unknown> = {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
      if (value.cause) {
        errorObj.cause = this.serializeValue(value.cause, seen);
      }
      return errorObj;
    }

    // 处理日期
    if (value instanceof Date) {
      return value.toISOString();
    }

    // 防止循环引用
    if (seen.has(value as object)) {
      return '[Circular Reference]';
    }
    seen.add(value as object);

    // 处理数组
    if (Array.isArray(value)) {
      return value.map((item) => this.serializeValue(item, seen));
    }

    // 处理普通对象和 AWS SDK 错误对象
    const serialized: Record<string, unknown> = {};
    const obj = value as Record<string, unknown>;

    // 添加对象类型信息（如果不是普通对象）
    const constructorName = obj.constructor?.name;
    if (constructorName && constructorName !== 'Object') {
      serialized._type = constructorName;
    }

    // 获取所有属性（包括非枚举属性），但排除内部属性
    try {
      const allKeys = Object.getOwnPropertyNames(value);
      const relevantKeys = allKeys.filter(
        (key) => !key.startsWith('_') && key !== 'constructor'
      );

      // 如果没有可枚举属性但是看起来像错误对象，尝试提取常见的错误属性
      if (relevantKeys.length === 0 || Object.keys(value).length === 0) {
        const errorProps = ['name', 'message', 'code', 'statusCode', '$metadata', 'time'];
        for (const prop of errorProps) {
          if (prop in obj && obj[prop] !== undefined) {
            serialized[prop] = this.serializeValue(obj[prop], seen);
          }
        }
      } else {
        // 序列化所有相关属性
        for (const key of relevantKeys) {
          try {
            const val = obj[key];
            serialized[key] = this.serializeValue(val, seen);
          } catch (error) {
            serialized[key] = '[Serialization Error]';
          }
        }
      }
    } catch (error) {
      // 如果获取属性失败，尝试使用 Object.entries 作为后备
      for (const [key, val] of Object.entries(value)) {
        try {
          serialized[key] = this.serializeValue(val, seen);
        } catch (error) {
          serialized[key] = '[Serialization Error]';
        }
      }
    }

    // 如果最终还是空对象，尝试调用 toString()
    if (Object.keys(serialized).length === 0) {
      try {
        const str = String(value);
        if (str && str !== '[object Object]') {
          return str;
        }
      } catch (e) {
        // 忽略 toString 错误
      }
      return '[Empty Object]';
    }

    return serialized;
  }

  private format(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();

    // 安全地序列化所有参数
    const serializedArgs = args.map((arg) => this.serializeValue(arg));

    const logData = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...(serializedArgs.length > 0 && { data: serializedArgs }),
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

  error(message: string, ...args: unknown[]): void {
    this.format('error', message, ...args);
  }
}

// 导出单例
export const logger = new Logger();
