/**Logger pro main process – zapisuje do konzole a souboru.*/
import { app } from "electron";
import path from "path";
import fs from "fs";

type LogLevel = "debug" | "info" | "warn" | "error";

class Logger {
  private _name: string;
  private _logFile: string;

  constructor(name: string) {
    this._name = name;
    const logDir = path.join(app.getPath("userData"), "logs");
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    this._logFile = path.join(logDir, "main.log");
  }

  private _write(level: LogLevel, message: string, meta?: object): void {
    const entry = {
      ts: new Date().toISOString(),
      level,
      name: this._name,
      message,
      ...(meta || {}),
    };
    const line = JSON.stringify(entry);
    console[level === "warn" ? "warn" : level === "error" ? "error" : "log"](line);
    fs.appendFileSync(this._logFile, line + "\n", "utf-8");
  }

  debug(message: string, meta?: object): void { this._write("debug", message, meta); }
  info(message: string, meta?: object): void { this._write("info", message, meta); }
  warn(message: string, meta?: object): void { this._write("warn", message, meta); }
  error(message: string, meta?: object): void { this._write("error", message, meta); }
}

export function createLogger(name: string): Logger {
  return new Logger(name);
}
