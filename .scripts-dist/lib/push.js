"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initVapid = initVapid;
exports.sendPushNotification = sendPushNotification;
var web_push_1 = __importDefault(require("web-push"));
var db_1 = require("./db");
var vapidInitialised = false;
function initVapid() {
    if (vapidInitialised)
        return;
    var publicKey = process.env.VAPID_PUBLIC_KEY;
    var privateKey = process.env.VAPID_PRIVATE_KEY;
    var subject = process.env.VAPID_SUBJECT;
    if (!publicKey || !privateKey || !subject) {
        throw new Error("Missing VAPID configuration. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT in .env");
    }
    web_push_1.default.setVapidDetails(subject, publicKey, privateKey);
    vapidInitialised = true;
}
// Initialise at module load so missing keys are caught early
try {
    initVapid();
}
catch (_a) {
    // Deferred — will throw at runtime when sendPushNotification is called
}
function sendPushNotification(userId, payload) {
    return __awaiter(this, void 0, void 0, function () {
        var subs, jsonPayload, results, _i, results_1, r;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    initVapid();
                    subs = (0, db_1.getPushSubscriptionsByUserId)(userId);
                    if (subs.length === 0)
                        return [2 /*return*/];
                    jsonPayload = JSON.stringify(payload);
                    return [4 /*yield*/, Promise.allSettled(subs.map(function (sub) { return __awaiter(_this, void 0, void 0, function () {
                            var err_1, statusCode;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        _a.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, web_push_1.default.sendNotification({
                                                endpoint: sub.endpoint,
                                                keys: { p256dh: sub.p256dh, auth: sub.auth },
                                            }, jsonPayload)];
                                    case 1:
                                        _a.sent();
                                        return [3 /*break*/, 3];
                                    case 2:
                                        err_1 = _a.sent();
                                        statusCode = err_1.statusCode;
                                        if (statusCode === 410) {
                                            (0, db_1.deletePushSubscription)(sub.endpoint);
                                            return [2 /*return*/];
                                        }
                                        throw err_1;
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); }))];
                case 1:
                    results = _a.sent();
                    // Re-throw the first non-410 error
                    for (_i = 0, results_1 = results; _i < results_1.length; _i++) {
                        r = results_1[_i];
                        if (r.status === "rejected") {
                            throw r.reason;
                        }
                    }
                    return [2 /*return*/];
            }
        });
    });
}
