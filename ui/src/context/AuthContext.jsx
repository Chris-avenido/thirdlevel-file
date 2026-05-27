import React, { createContext, useContext, useState, useEffect } from 'react';
import { normalizeRole } from '../utils/roleUtils';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const storedToken = localStorage.getItem('token');
        if (storedUser && storedToken) {
            setUser(JSON.parse(storedUser));
            setToken(storedToken);
        }
        setLoading(false);
    }, []);

    const login = (userData, token) => {
        // Normalize role before storage
        if (userData.role) userData.role = normalizeRole(userData.role);
        if (userData.account_category) userData.account_category = normalizeRole(userData.account_category);

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

    const loginWithCredentials = async (email, password) => {
        const targetUrl = '/insighted-third-level-officials/api/auth/login';
        console.log(`🚀 Attempting login at: ${targetUrl}`);
        
        try {
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            console.log(`📡 Response Status: ${response.status} ${response.statusText}`);
            
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


    const verifyPin = async (email, passcode) => {
        try {
            const response = await fetch('/insighted-third-level-officials/api/auth/pin-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, passcode })
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

    const logout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setUser(null);
        setToken(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, loginWithCredentials, logout, verifyPin, setUser, setToken }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
