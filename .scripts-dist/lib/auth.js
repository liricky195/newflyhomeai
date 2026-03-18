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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.authOptions = void 0;
exports.isAdmin = isAdmin;
var google_1 = __importDefault(require("next-auth/providers/google"));
var email_1 = __importDefault(require("next-auth/providers/email"));
var db_1 = require("@/lib/db");
var logger_1 = require("@/lib/logger");
// ─────────────────────────────────────────────────────────────────────────────
// Custom SQLite adapter
// ─────────────────────────────────────────────────────────────────────────────
// NextAuth adapters must implement the Adapter interface from next-auth/adapters.
// We build it entirely on top of the typed functions in lib/db.ts.
// ─────────────────────────────────────────────────────────────────────────────
function toAdapterUser(dbUser) {
    var _a, _b;
    if (!dbUser)
        throw new Error("toAdapterUser: dbUser is null");
    return {
        id: dbUser.id,
        email: dbUser.email,
        name: (_a = dbUser.name) !== null && _a !== void 0 ? _a : null,
        image: (_b = dbUser.image) !== null && _b !== void 0 ? _b : null,
        emailVerified: null, // OAuth users are implicitly verified
    };
}
function sqliteAdapter() {
    return {
        createUser: function (user) {
            return __awaiter(this, void 0, void 0, function () {
                var id, created;
                var _a, _b, _c;
                return __generator(this, function (_d) {
                    id = crypto.randomUUID();
                    created = (0, db_1.createUser)({
                        id: id,
                        email: (_a = user.email) !== null && _a !== void 0 ? _a : "",
                        name: (_b = user.name) !== null && _b !== void 0 ? _b : null,
                        image: (_c = user.image) !== null && _c !== void 0 ? _c : null,
                    });
                    // Every new user gets a free-tier subscription row
                    (0, db_1.createDefaultSubscription)(created.id);
                    return [2 /*return*/, toAdapterUser(created)];
                });
            });
        },
        getUser: function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var user;
                return __generator(this, function (_a) {
                    user = (0, db_1.getUserById)(id);
                    return [2 /*return*/, user ? toAdapterUser(user) : null];
                });
            });
        },
        getUserByEmail: function (email) {
            return __awaiter(this, void 0, void 0, function () {
                var user;
                return __generator(this, function (_a) {
                    user = (0, db_1.getUserByEmail)(email);
                    return [2 /*return*/, user ? toAdapterUser(user) : null];
                });
            });
        },
        getUserByAccount: function (_a) {
            return __awaiter(this, arguments, void 0, function (_b) {
                var _pid = _b.providerAccountId, _prov = _b.provider;
                return __generator(this, function (_c) {
                    // We don't store OAuth accounts separately; identity is keyed by email.
                    // allowDangerousEmailAccountLinking on each provider prevents OAuthAccountNotLinked
                    // when getUserByEmail finds an existing user but no linked account record exists.
                    return [2 /*return*/, null];
                });
            });
        },
        updateUser: function (user) {
            return __awaiter(this, void 0, void 0, function () {
                var updated;
                var _a, _b;
                return __generator(this, function (_c) {
                    // Upsert via createUser which uses ON CONFLICT(email) DO UPDATE
                    if (!user.email)
                        throw new Error("updateUser: user.email is required");
                    updated = (0, db_1.createUser)({
                        id: user.id,
                        email: user.email,
                        name: (_a = user.name) !== null && _a !== void 0 ? _a : null,
                        image: (_b = user.image) !== null && _b !== void 0 ? _b : null,
                    });
                    return [2 /*return*/, toAdapterUser(updated)];
                });
            });
        },
        linkAccount: function (_account) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/];
                });
            });
        },
        createSession: function (session) {
            return __awaiter(this, void 0, void 0, function () {
                var expiresUnix;
                return __generator(this, function (_a) {
                    expiresUnix = Math.floor(new Date(session.expires).getTime() / 1000);
                    (0, db_1.createSession)({
                        id: crypto.randomUUID(),
                        session_token: session.sessionToken,
                        user_id: session.userId,
                        expires: expiresUnix,
                    });
                    return [2 /*return*/, {
                            sessionToken: session.sessionToken,
                            userId: session.userId,
                            expires: session.expires,
                        }];
                });
            });
        },
        getSessionAndUser: function (sessionToken) {
            return __awaiter(this, void 0, void 0, function () {
                var dbSession, nowUnix, dbUser;
                return __generator(this, function (_a) {
                    dbSession = (0, db_1.getSessionByToken)(sessionToken);
                    if (!dbSession)
                        return [2 /*return*/, null];
                    nowUnix = Math.floor(Date.now() / 1000);
                    if (dbSession.expires < nowUnix) {
                        (0, db_1.deleteSession)(sessionToken);
                        return [2 /*return*/, null];
                    }
                    dbUser = (0, db_1.getUserById)(dbSession.user_id);
                    if (!dbUser)
                        return [2 /*return*/, null];
                    return [2 /*return*/, {
                            session: {
                                sessionToken: dbSession.session_token,
                                userId: dbSession.user_id,
                                expires: new Date(dbSession.expires * 1000),
                            },
                            user: toAdapterUser(dbUser),
                        }];
                });
            });
        },
        updateSession: function (session) {
            return __awaiter(this, void 0, void 0, function () {
                var dbSession, newExpires, expiresUnix;
                var _a;
                return __generator(this, function (_b) {
                    dbSession = (0, db_1.getSessionByToken)(session.sessionToken);
                    if (!dbSession)
                        return [2 /*return*/, null];
                    newExpires = (_a = session.expires) !== null && _a !== void 0 ? _a : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                    expiresUnix = Math.floor(newExpires.getTime() / 1000);
                    // UPDATE in place — avoids the window between DELETE and INSERT where a
                    // concurrent getSessionAndUser call would return null and log the user out.
                    (0, db_1.getDb)()
                        .prepare("UPDATE sessions SET expires = ? WHERE session_token = ?")
                        .run(expiresUnix, session.sessionToken);
                    return [2 /*return*/, {
                            sessionToken: session.sessionToken,
                            userId: dbSession.user_id,
                            expires: newExpires,
                        }];
                });
            });
        },
        deleteSession: function (sessionToken) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    (0, db_1.deleteSession)(sessionToken);
                    return [2 /*return*/];
                });
            });
        },
        // ─── Verification Tokens (for Email Provider) ───────────────────────────
        createVerificationToken: function (token) {
            return __awaiter(this, void 0, void 0, function () {
                var conn;
                return __generator(this, function (_a) {
                    conn = (0, db_1.getDb)();
                    conn.prepare("\n        INSERT INTO verification_tokens (identifier, token, expires)\n        VALUES (?, ?, ?)\n      ").run(token.identifier, token.token, Math.floor(new Date(token.expires).getTime() / 1000));
                    return [2 /*return*/, token];
                });
            });
        },
        useVerificationToken: function (_a) {
            return __awaiter(this, arguments, void 0, function (_b) {
                var conn, row;
                var identifier = _b.identifier, token = _b.token;
                return __generator(this, function (_c) {
                    conn = (0, db_1.getDb)();
                    row = conn.prepare("\n        SELECT identifier, token, expires FROM verification_tokens\n        WHERE identifier = ? AND token = ?\n      ").get(identifier, token);
                    if (!row)
                        return [2 /*return*/, null];
                    conn.prepare("\n        DELETE FROM verification_tokens WHERE identifier = ? AND token = ?\n      ").run(identifier, token);
                    return [2 /*return*/, {
                            identifier: row.identifier,
                            token: row.token,
                            expires: new Date(row.expires * 1000),
                        }];
                });
            });
        },
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// NextAuth options
// ─────────────────────────────────────────────────────────────────────────────
exports.authOptions = {
    adapter: sqliteAdapter(),
    providers: [
        (0, google_1.default)({
            clientId: (_a = process.env.GOOGLE_CLIENT_ID) !== null && _a !== void 0 ? _a : "",
            clientSecret: (_b = process.env.GOOGLE_CLIENT_SECRET) !== null && _b !== void 0 ? _b : "",
            allowDangerousEmailAccountLinking: true,
        }),
        (0, email_1.default)({
            server: {
                host: process.env.EMAIL_SERVER_HOST,
                port: Number(process.env.EMAIL_SERVER_PORT),
                auth: {
                    user: process.env.EMAIL_SERVER_USER,
                    pass: process.env.EMAIL_SERVER_PASSWORD,
                },
            },
            from: process.env.EMAIL_FROM,
        }),
    ],
    session: {
        strategy: "database",
        maxAge: 30 * 24 * 60 * 60, // 30 days
        generateSessionToken: function () { return crypto.randomUUID(); },
    },
    callbacks: {
        signIn: function (_a) {
            return __awaiter(this, arguments, void 0, function (_b) {
                var user = _b.user;
                return __generator(this, function (_c) {
                    if (user === null || user === void 0 ? void 0 : user.id) {
                        try {
                            (0, db_1.createDefaultSubscription)(user.id);
                        }
                        catch (err) {
                            (0, logger_1.log)("error", "auth", "createDefaultSubscription error", { err: String(err) });
                        }
                    }
                    return [2 /*return*/, true];
                });
            });
        },
        session: function (_a) {
            return __awaiter(this, arguments, void 0, function (_b) {
                var session = _b.session, user = _b.user;
                return __generator(this, function (_c) {
                    if (session.user) {
                        session.user.id = user.id;
                    }
                    return [2 /*return*/, session];
                });
            });
        },
    },
    pages: {
        signIn: "/auth",
        error: "/auth",
    },
};
/**
 * Canonical admin check. Always performs a synchronous DB read.
 * Never trusts JWT claims or client-supplied data.
 * This is the ONLY authorized way to check admin status in API routes
 * and server components.
 */
function isAdmin(userId) {
    var user = (0, db_1.getUserById)(userId);
    return (user === null || user === void 0 ? void 0 : user.role) === "admin";
}
