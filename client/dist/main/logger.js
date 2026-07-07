"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = createLogger;
/**Logger pro main process – zapisuje do konzole a souboru.*/
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
class Logger {
    _name;
    _logFile;
    constructor(name) {
        this._name = name;
        const logDir = path_1.default.join(electron_1.app.getPath("userData"), "logs");
        if (!fs_1.default.existsSync(logDir))
            fs_1.default.mkdirSync(logDir, { recursive: true });
        this._logFile = path_1.default.join(logDir, "main.log");
    }
    _write(level, message, meta) {
        const entry = {
            ts: new Date().toISOString(),
            level,
            name: this._name,
            message,
            ...(meta || {}),
        };
        const line = JSON.stringify(entry);
        console[level === "warn" ? "warn" : level === "error" ? "error" : "log"](line);
        fs_1.default.appendFileSync(this._logFile, line + "\n", "utf-8");
    }
    debug(message, meta) { this._write("debug", message, meta); }
    info(message, meta) { this._write("info", message, meta); }
    warn(message, meta) { this._write("warn", message, meta); }
    error(message, meta) { this._write("error", message, meta); }
}
function createLogger(name) {
    return new Logger(name);
}
