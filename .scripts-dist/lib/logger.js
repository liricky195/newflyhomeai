"use strict";
/**
 * Structured logger. Replaces all console.log / console.error calls in
 * lib/ files, API routes, and the monitor daemon.
 *
 * Output format: JSON line to stdout (info/warn/debug) or stderr (error).
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = log;
exports.logRequest = logRequest;
function log(level, service, message, meta) {
    // Suppress debug logs in production
    if (level === "debug" && process.env.NODE_ENV === "production")
        return;
    var entry = JSON.stringify(__assign({ timestamp: new Date().toISOString(), level: level, service: service, message: message }, meta));
    if (level === "error") {
        process.stderr.write(entry + "\n");
    }
    else {
        process.stdout.write(entry + "\n");
    }
}
// HARDENED IN STEP 10: structured HTTP request logging
function logRequest(method, path, statusCode, durationMs, userId) {
    log("info", "http", "".concat(method, " ").concat(path, " ").concat(statusCode), __assign({ method: method, path: path, statusCode: statusCode, durationMs: durationMs }, (userId !== undefined && { userId: userId })));
}
