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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReferralCode = createReferralCode;
exports.getUserReferralCode = getUserReferralCode;
exports.validateReferralCode = validateReferralCode;
exports.applyReferralCode = applyReferralCode;
exports.getUserReferralBalance = getUserReferralBalance;
exports.getReferralStats = getReferralStats;
exports.redeemReferralBalance = redeemReferralBalance;
var db_1 = require("./db");
var referral_1 = require("./referral");
function createReferralCode(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var db, code;
        return __generator(this, function (_a) {
            db = (0, db_1.getDb)();
            code = (0, referral_1.generateReferralCode)();
            db.prepare("INSERT INTO referral_codes (code, referrer_id, expires_at) \n     VALUES (?, ?, datetime('now', '+1 year'))").run(code, userId);
            // Update user's referral code
            db.prepare('UPDATE users SET referral_code = ? WHERE id = ?').run(code, userId);
            return [2 /*return*/, code];
        });
    });
}
function getUserReferralCode(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var db, result;
        return __generator(this, function (_a) {
            db = (0, db_1.getDb)();
            result = db.prepare('SELECT referral_code FROM users WHERE id = ?').get(userId);
            return [2 /*return*/, (result === null || result === void 0 ? void 0 : result.referral_code) || null];
        });
    });
}
function validateReferralCode(code) {
    return __awaiter(this, void 0, void 0, function () {
        var db, result;
        return __generator(this, function (_a) {
            db = (0, db_1.getDb)();
            result = db.prepare("SELECT * FROM referral_codes \n     WHERE code = ? AND is_active = TRUE \n     AND (expires_at IS NULL OR expires_at > datetime('now'))\n     AND referred_id IS NULL").get(code);
            return [2 /*return*/, result || null];
        });
    });
}
function applyReferralCode(referrerId, referredId, code) {
    return __awaiter(this, void 0, void 0, function () {
        var db, transaction;
        return __generator(this, function (_a) {
            db = (0, db_1.getDb)();
            transaction = db.transaction(function () {
                // Update referral code
                db.prepare("UPDATE referral_codes \n       SET referred_id = ?, used_at = datetime('now') \n       WHERE code = ?").run(referredId, code);
                // Update referred user
                db.prepare('UPDATE users SET referred_by = ? WHERE id = ?').run(referrerId, referredId);
                // Get reward amount
                var referralResult = db.prepare('SELECT reward_amount_cents FROM referral_codes WHERE code = ?').get(code);
                var rewardAmount = (referralResult === null || referralResult === void 0 ? void 0 : referralResult.reward_amount_cents) || 500;
                // Add reward to referrer's balance
                db.prepare('UPDATE users SET referral_balance_cents = referral_balance_cents + ? WHERE id = ?').run(rewardAmount, referrerId);
                // Record transaction for referrer
                db.prepare("INSERT INTO referral_transactions (user_id, referral_code_id, amount_cents, type, description)\n       SELECT ?, id, ?, 'earned', 'Referral reward for inviting new user'\n       FROM referral_codes WHERE code = ?").run(referrerId, rewardAmount, code);
                // Give new user signup bonus
                var signupBonus = 500; // $5.00
                db.prepare('UPDATE users SET referral_balance_cents = referral_balance_cents + ? WHERE id = ?').run(signupBonus, referredId);
                // Record transaction for referred user
                db.prepare("INSERT INTO referral_transactions (user_id, referral_code_id, amount_cents, type, description)\n       SELECT ?, id, ?, 'earned', 'Signup bonus from referral'\n       FROM referral_codes WHERE code = ?").run(referredId, signupBonus, code);
            });
            transaction();
            return [2 /*return*/];
        });
    });
}
function getUserReferralBalance(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var db, result;
        return __generator(this, function (_a) {
            db = (0, db_1.getDb)();
            result = db.prepare('SELECT referral_balance_cents FROM users WHERE id = ?').get(userId);
            return [2 /*return*/, (result === null || result === void 0 ? void 0 : result.referral_balance_cents) || 0];
        });
    });
}
function getReferralStats(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var db, userResult, statsResult;
        return __generator(this, function (_a) {
            db = (0, db_1.getDb)();
            userResult = db.prepare('SELECT referral_code, referral_balance_cents FROM users WHERE id = ?').get(userId);
            statsResult = db.prepare("SELECT \n       COUNT(*) as referrals_count,\n       COALESCE(SUM(rt.amount_cents), 0) as total_earned_cents\n     FROM referral_codes rc\n     LEFT JOIN referral_transactions rt ON rc.id = rt.referral_code_id AND rt.type = 'earned'\n     WHERE rc.referrer_id = ?").get(userId);
            return [2 /*return*/, {
                    code: (userResult === null || userResult === void 0 ? void 0 : userResult.referral_code) || null,
                    balance_cents: (userResult === null || userResult === void 0 ? void 0 : userResult.referral_balance_cents) || 0,
                    referrals_count: (statsResult === null || statsResult === void 0 ? void 0 : statsResult.referrals_count) || 0,
                    total_earned_cents: (statsResult === null || statsResult === void 0 ? void 0 : statsResult.total_earned_cents) || 0
                }];
        });
    });
}
function redeemReferralBalance(userId, amountCents) {
    return __awaiter(this, void 0, void 0, function () {
        var db, transaction;
        return __generator(this, function (_a) {
            db = (0, db_1.getDb)();
            transaction = db.transaction(function () {
                // Check balance
                var balanceResult = db.prepare('SELECT referral_balance_cents FROM users WHERE id = ?').get(userId);
                var currentBalance = (balanceResult === null || balanceResult === void 0 ? void 0 : balanceResult.referral_balance_cents) || 0;
                if (currentBalance < amountCents) {
                    throw new Error('Insufficient referral balance');
                }
                // Deduct from balance
                db.prepare('UPDATE users SET referral_balance_cents = referral_balance_cents - ? WHERE id = ?').run(amountCents, userId);
                // Record transaction
                db.prepare("INSERT INTO referral_transactions (user_id, amount_cents, type, description)\n       VALUES (?, ?, 'redeemed', 'Used referral balance for purchase')").run(userId, amountCents);
            });
            transaction();
            return [2 /*return*/];
        });
    });
}
