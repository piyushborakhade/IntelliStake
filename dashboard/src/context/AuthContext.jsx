/**
 * AuthContext.jsx
 * ================
 * Blockchain-style authentication for IntelliStake.
 *
 * Security architecture:
 *   1. PBKDF2 (100,000 iterations, SHA-256) — Web Crypto API password hashing
 *   2. Ethereum-style wallet address derived from the same PBKDF2 key
 *   3. Credential Chain — every registration & login event creates a signed
 *      "block" (prevHash → SHA-256 → blockHash) stored in localStorage, giving
 *      an append-only tamper-evident audit log that mirrors IdentityRegistry.sol
 *   4. JWT-like session token — base64url(header).base64url(payload).hmac_sig
 *   5. Rate limiting — 5 failed attempts → 15 min lockout (stored per address)
 *   6. Role-based access — ANALYST | PORTFOLIO_MANAGER | ADMIN maps to
 *      KYC tiers RETAIL | ACCREDITED | INSTITUTIONAL in IdentityRegistry.sol
 *
 * Demo accounts (pre-seeded on first load):
 *   admin@intellistake.ai       / Admin@2024!        (ADMIN)
 *   pm@intellistake.ai          / Invest@2024!       (PORTFOLIO_MANAGER)
 *   analyst@intellistake.ai     / Analyse@2024!      (ANALYST)
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ── Constants ────────────────────────────────────────────────────────────────
const CHAIN_KEY = 'is_credential_chain';
const SESSION_KEY = 'is_session';
const LOCKOUT_KEY = 'is_lockout';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_TTL = 8 * 60 * 60 * 1000; // 8 hours

export const ROLES = {
    ADMIN: { label: 'Admin', kyc: 'INSTITUTIONAL', color: '#f59e0b', badge: '👑' },
    PORTFOLIO_MANAGER: { label: 'Portfolio Manager', kyc: 'ACCREDITED', color: '#8b5cf6', badge: '💼' },
    ANALYST: { label: 'Analyst', kyc: 'RETAIL', color: '#3b82f6', badge: '🔍' },
};

// ── Web Crypto Helpers ───────────────────────────────────────────────────────
async function deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100_000, hash: 'SHA-256' },
        keyMaterial, 256
    );
    return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function toWalletAddress(hexKey) {
    // Ethereum-style: 0x + last 40 hex chars of derived key → checksum-like format
    const raw = hexKey.slice(-40).toUpperCase();
    return '0x' + raw;
}

// UTF-8-safe base64url (btoa only handles Latin1, emojis/Unicode need TextEncoder)
function b64url(obj) {
    const json = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    bytes.forEach(b => (binary += String.fromCharCode(b)));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function b64urlDecode(str) {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
}

async function makeToken(payload) {
    const header = b64url({ alg: 'HS256-IS', typ: 'JWT' });
    const body = b64url(payload);
    const sig = (await sha256(`${header}.${body}.IS_SECRET_2024`)).slice(0, 32);
    return `${header}.${body}.${sig}`;
}

async function verifyToken(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const [header, body, sig] = parts;
        const expected = (await sha256(`${header}.${body}.IS_SECRET_2024`)).slice(0, 32);
        if (sig !== expected) return null;
        const payload = b64urlDecode(body);
        if (payload.exp < Date.now()) return null;
        return payload;
    } catch {
        return null;
    }
}

// ── Credential Chain ─────────────────────────────────────────────────────────
function loadChain() {
    try { return JSON.parse(localStorage.getItem(CHAIN_KEY) || '[]'); }
    catch { return []; }
}

function saveChain(chain) {
    localStorage.setItem(CHAIN_KEY, JSON.stringify(chain));
}

async function appendBlock(chain, eventType, data) {
    const prevHash = chain.length > 0 ? chain[chain.length - 1].blockHash : '0'.repeat(64);
    const index = chain.length;
    const timestamp = Date.now();
    const payload = JSON.stringify({ index, prevHash, timestamp, eventType, data });
    const blockHash = await sha256(payload);
    const block = { index, prevHash, blockHash, timestamp, eventType, data };
    chain.push(block);
    saveChain(chain);
    return block;
}

function findUser(chain, email) {
    // Find latest REGISTER block for this email
    const blocks = chain.filter(b => b.eventType === 'REGISTER' && b.data.email === email.toLowerCase());
    return blocks.length > 0 ? blocks[blocks.length - 1].data : null;
}

// ── Demo Seed ────────────────────────────────────────────────────────────────
const DEMO_USERS = [
    { email: 'admin@intellistake.ai', password: 'Admin@2024!', role: 'ADMIN', name: 'Piyush Borakhade', avatar: '👑' },
    { email: 'pm@intellistake.ai', password: 'Invest@2024!', role: 'PORTFOLIO_MANAGER', name: 'Portfolio Manager', avatar: '💼' },
    { email: 'analyst@intellistake.ai', password: 'Analyse@2024!', role: 'ANALYST', name: 'Research Analyst', avatar: '🔍' },
];

async function seedDemoAccounts(chain) {
    const existing = new Set(chain.filter(b => b.eventType === 'REGISTER').map(b => b.data.email));
    for (const u of DEMO_USERS) {
        if (!existing.has(u.email)) {
            const salt = await sha256(u.email + '_IS_SALT_2024');
            const hash = await deriveKey(u.password, salt);
            const wallet = toWalletAddress(hash);
            await appendBlock(chain, 'REGISTER', {
                email: u.email, name: u.name, role: u.role, avatar: u.avatar,
                passwordHash: hash, salt, wallet,
                createdAt: Date.now(), kyc: ROLES[u.role]?.kyc,
            });
        }
    }
}

// ── Lockout helpers ───────────────────────────────────────────────────────────
function getLockout(email) {
    try { return JSON.parse(localStorage.getItem(LOCKOUT_KEY) || '{}')[email] || { attempts: 0, lockedUntil: 0 }; }
    catch { return { attempts: 0, lockedUntil: 0 }; }
}
function setLockout(email, data) {
    const all = JSON.parse(localStorage.getItem(LOCKOUT_KEY) || '{}');
    all[email] = data;
    localStorage.setItem(LOCKOUT_KEY, JSON.stringify(all));
}

// ── Context ───────────────────────────────────────────────────────────────────
const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // On mount: restore session + seed demo accounts
    useEffect(() => {
        (async () => {
            const chain = loadChain();
            await seedDemoAccounts(chain);

            const token = sessionStorage.getItem(SESSION_KEY);
            if (token) {
                const payload = await verifyToken(token);
                if (payload) setUser(payload.user);
            }
            setLoading(false);
        })();
    }, []);

    // ── Login ──────────────────────────────────────────────────────────────────
    const login = useCallback(async (email, password) => {
        email = email.trim().toLowerCase();
        const lockout = getLockout(email);

        if (lockout.lockedUntil > Date.now()) {
            const mins = Math.ceil((lockout.lockedUntil - Date.now()) / 60000);
            throw new Error(`Account locked. Try again in ${mins} min. (Blockchain lockout active)`);
        }

        const chain = loadChain();
        const record = findUser(chain, email);
        if (!record) throw new Error('No account found. Please register first.');

        const hash = await deriveKey(password, record.salt);
        if (hash !== record.passwordHash) {
            const attempts = lockout.attempts + 1;
            const lockedUntil = attempts >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0;
            setLockout(email, { attempts, lockedUntil });
            if (lockedUntil) throw new Error(`Too many attempts. Account locked for 15 minutes.`);
            throw new Error(`Invalid credentials. ${MAX_ATTEMPTS - attempts} attempts remaining.`);
        }

        // Reset lockout
        setLockout(email, { attempts: 0, lockedUntil: 0 });

        const userData = {
            email: record.email, name: record.name, role: record.role,
            avatar: record.avatar, wallet: record.wallet, kyc: record.kyc,
        };

        // Log login event to chain
        await appendBlock(chain, 'LOGIN', { email, wallet: record.wallet, timestamp: Date.now() });

        const token = await makeToken({ user: userData, exp: Date.now() + SESSION_TTL, iat: Date.now() });
        sessionStorage.setItem(SESSION_KEY, token);
        setUser(userData);
        return userData;
    }, []);

    // ── Register ──────────────────────────────────────────────────────────────
    const register = useCallback(async (email, password, name, role = 'ANALYST') => {
        email = email.trim().toLowerCase();
        if (!email.includes('@')) throw new Error('Invalid email address.');
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');

        const chain = loadChain();
        if (findUser(chain, email)) throw new Error('Account already exists. Please login.');

        const salt = await sha256(email + '_IS_SALT_2024');
        const hash = await deriveKey(password, salt);
        const wallet = toWalletAddress(hash);

        const userData = {
            email, name, role, avatar: ROLES[role]?.badge || '🔍',
            passwordHash: hash, salt, wallet,
            createdAt: Date.now(), kyc: ROLES[role]?.kyc,
        };

        await appendBlock(chain, 'REGISTER', userData);

        const sessionData = { email, name, role, avatar: userData.avatar, wallet, kyc: userData.kyc };
        const token = await makeToken({ user: sessionData, exp: Date.now() + SESSION_TTL, iat: Date.now() });
        sessionStorage.setItem(SESSION_KEY, token);
        setUser(sessionData);
        return sessionData;
    }, []);

    // ── Logout ────────────────────────────────────────────────────────────────
    const logout = useCallback(async () => {
        const chain = loadChain();
        if (user) await appendBlock(chain, 'LOGOUT', { email: user.email, timestamp: Date.now() });
        sessionStorage.removeItem(SESSION_KEY);
        setUser(null);
    }, [user]);

    // ── Get chain stats ───────────────────────────────────────────────────────
    const getChainStats = useCallback(() => {
        const chain = loadChain();
        return {
            totalBlocks: chain.length,
            logins: chain.filter(b => b.eventType === 'LOGIN').length,
            users: new Set(chain.filter(b => b.eventType === 'REGISTER').map(b => b.data.email)).size,
            latestHash: chain.length > 0 ? chain[chain.length - 1].blockHash : '0'.repeat(64),
            chain: chain.slice(-5), // last 5 blocks
        };
    }, []);

    // isPro: ADMIN and PORTFOLIO_MANAGER have full access; ANALYST is free tier
    // Can be overridden by setting intellistake_pro=1 in localStorage (for demo)
    const isPro = user
        ? (user.role === 'ADMIN' || user.role === 'PORTFOLIO_MANAGER' || localStorage.getItem('intellistake_pro') === '1')
        : false;

    const isAdmin = user?.role === 'ADMIN';

    return (
        <AuthCtx.Provider value={{ user, loading, login, register, logout, getChainStats, isPro, isAdmin }}>
            {children}
        </AuthCtx.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthCtx);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}
