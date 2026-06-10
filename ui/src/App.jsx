import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Pages
import NexusGate from './pages/NexusGate';
import Login from './pages/Login';
import Register from './pages/Register';
import OfficialProfiling from './pages/OfficialProfiling';
import OfficialsRegistry from './pages/OfficialsRegistry';
import Dashboard from './pages/Dashboard';
import LoadingScreen from './components/LoadingScreen';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return <LoadingScreen />;
    if (!user) return <Navigate to="/" replace />;
    return children;
};

const App = () => {
    return (
        <Routes>
            {/* Entry Point: Nexus Gate */}
            <Route path="/" element={<NexusGate />} />
            
            {/* Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
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

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

export default App;
