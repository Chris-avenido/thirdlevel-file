import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AOS from 'aos';
import 'aos/dist/aos.css';

// Pages
import NexusGate from './pages/NexusGate';
import Login from './pages/Login';
import Register from './pages/Register';
import OfficialProfiling from './pages/OfficialProfiling';
import OfficialsRegistry from './pages/OfficialsRegistry';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import Settings from './pages/Settings';
import NotableAchievements from './pages/NotableAchievements';
import LoadingScreen from './components/LoadingScreen';

// Public Route Component
const PublicRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return <LoadingScreen />;
    if (user) {
        const roleLower = user.role?.toLowerCase() || '';
        if (['personnel admin', 'super user', 'central office', 'regional office', 'school division office'].includes(roleLower)) {
            return <Navigate to="/home" replace />;
        } else {
            return <Navigate to="/official-profiling" replace />;
        }
    }
    return children;
};

// Protected Route Component
const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return <LoadingScreen />;
    if (!user) return <Navigate to="/" replace />;
    return children;
};

const App = () => {
    useEffect(() => {
        AOS.init();
    }, []);

    return (
        <Routes>
            {/* Entry Point: Nexus Gate */}
            <Route path="/" element={<PublicRoute><NexusGate /></PublicRoute>} />
            
            {/* Auth Routes */}
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            
            {/* Protected Routes */}
            <Route 
                path="/official-profiling" 
                element={
                    <ProtectedRoute>
                        <OfficialProfiling />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/officials-registry" 
                element={
                    <ProtectedRoute>
                        <OfficialsRegistry />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/dashboard" 
                element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/home" 
                element={
                    <ProtectedRoute>
                        <Home />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/notable-achievements" 
                element={
                    <ProtectedRoute>
                        <NotableAchievements />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/settings" 
                element={
                    <ProtectedRoute>
                        <Settings />
                    </ProtectedRoute>
                } 
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

export default App;
