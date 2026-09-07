import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { normalizeRole } from '../utils/roleUtils';
import { apiUrl } from '../utils/api';

const AuthContext = createContext();

const INACTIVITY_TIMEOUT_MS = 3 * 60 * 60 * 1000; // 3 continuous hours of inactivity
const ACTIVITY_THROTTLE_MS = 30 * 1000; // Throttle storage writes to once every 30 seconds
const LAST_ACTIVITY_KEY = 'last_activity_time';

const ACTIVITY_EVENTS = [
    'mousemove',
    'mousedown',
    'keydown',
    'scroll',
    'touchstart',
    'touchmove',
    'click',
    'focus'
];

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    const logout = useCallback(() => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        sessionStorage.removeItem('hasSeenRetireesPrompt');
        setUser(null);
        setToken(null);
    }, []);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const storedToken = localStorage.getItem('token');
        const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);

        if (storedUser && storedToken) {
            const now = Date.now();
            const elapsed = lastActivity ? (now - Number(lastActivity)) : Infinity;
            if (elapsed >= INACTIVITY_TIMEOUT_MS) {
                logout();
            } else {
                setUser(JSON.parse(storedUser));
                setToken(storedToken);
            }
        }
        setLoading(false);
    }, [logout]);

    // Inactivity / Idle Timeout Engine
    useEffect(() => {
        if (!user) return;

        let timerId = null;

        const scheduleLogout = (delayMs) => {
            if (timerId) clearTimeout(timerId);
            timerId = setTimeout(() => {
                const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || '0');
                const elapsed = Date.now() - lastActivity;
                if (elapsed >= INACTIVITY_TIMEOUT_MS) {
                    logout();
                } else {
                    scheduleLogout(INACTIVITY_TIMEOUT_MS - elapsed);
                }
            }, Math.max(delayMs, 1000));
        };

        const initialLastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || Date.now());
        const initialElapsed = Date.now() - initialLastActivity;
        if (initialElapsed >= INACTIVITY_TIMEOUT_MS) {
            logout();
            return;
        }
        scheduleLogout(INACTIVITY_TIMEOUT_MS - initialElapsed);

        let lastWrittenTime = initialLastActivity;
        const handleUserActivity = () => {
            const now = Date.now();
            if (now - lastWrittenTime >= ACTIVITY_THROTTLE_MS) {
                lastWrittenTime = now;
                localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
                scheduleLogout(INACTIVITY_TIMEOUT_MS);
            }
        };

        const handleStorageChange = (e) => {
            if (e.key === LAST_ACTIVITY_KEY && e.newValue) {
                const updatedActivity = Number(e.newValue);
                lastWrittenTime = updatedActivity;
                const elapsed = Date.now() - updatedActivity;
                if (elapsed >= INACTIVITY_TIMEOUT_MS) {
                    logout();
                } else {
                    scheduleLogout(INACTIVITY_TIMEOUT_MS - elapsed);
                }
            } else if ((e.key === 'user' || e.key === 'token') && !e.newValue) {
                logout();
            }
        };

        ACTIVITY_EVENTS.forEach((eventName) => {
            window.addEventListener(eventName, handleUserActivity, { passive: true });
        });
        window.addEventListener('storage', handleStorageChange);

        return () => {
            if (timerId) clearTimeout(timerId);
            ACTIVITY_EVENTS.forEach((eventName) => {
                window.removeEventListener(eventName, handleUserActivity);
            });
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [user, logout]);

    const login = (userData, token) => {
        // Normalize role before storage
        if (userData.role) userData.role = normalizeRole(userData.role);
        if (userData.account_category) userData.account_category = normalizeRole(userData.account_category);

        sessionStorage.removeItem('hasSeenRetireesPrompt');

        const now = Date.now();
        localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));

        // Sync secondary storage for main repo logic compatibility
        if (userData.uid) localStorage.setItem('uid', userData.uid);
        if (userData.email) localStorage.setItem('userEmail', userData.email);
        if (userData.role) localStorage.setItem('userRole', userData.role);

        localStorage.setItem('remembered_user', JSON.stringify(userData));

        setUser(userData);
        setToken(token);
    };

    const loginWithCredentials = async (email, password, isCO) => {
        const targetUrl = apiUrl('/api/auth/login');
        try {
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, isCO })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ Server Error Detail:`, errorText);
                let parsedError = null;
                try {
                    parsedError = JSON.parse(errorText)?.error;
                } catch {
                    parsedError = null;
                }
                return { success: false, error: parsedError || `Server returned ${response.status}: ${response.statusText}` };
            }

            const data = await response.json();
            if (data.success) {
                login(data.user, data.token);
                return { success: true, user: data.user };
            } else {
                return { success: false, error: data.error };
            }
        } catch (err) {
            console.error(`🚨 Network/Connection Error:`, err);
            alert(`CONNECTION FAILED: Check if Port 3008 is running. Error: ${err.message}`);
            return { success: false, error: 'Connection failed. Please check server status.' };
        }
    };


    const verifyPin = async (email, passcode, isCO) => {
        try {
            const response = await fetch(apiUrl('/api/auth/pin-login'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, passcode, isCO })
            });
            const data = await response.json();
            if (data.success) {
                login(data.user, data.token);
                return { success: true, user: data.user };
            } else {
                return { success: false, error: data.error };
            }
        } catch (err) {
            return { success: false, error: 'PIN verification failed' };
        }
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, loginWithCredentials, logout, verifyPin, setUser, setToken }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

