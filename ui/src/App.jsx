import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AOS from 'aos';
import 'aos/dist/aos.css';

// Pages
import NexusGate from './pages/NexusGate';
import Login from './pages/Login';
import VacancyLogin from './pages/VacancyLogin';
import Register from './pages/Register';
import OfficialProfiling from './pages/OfficialProfiling';
import OfficialsRegistry from './pages/OfficialsRegistry';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import Settings from './pages/Settings';
import NotableAchievements from './pages/NotableAchievements';
import LoadingScreen from './components/LoadingScreen';
import AllVacancies from './pages/AllVacancies';
import VacancyDashboard from './pages/VacancyDashboard';
import ResetPassword from './pages/ResetPassword';
import CesPlantilla from './pages/CesPlantilla';
import PositionAssignments from './pages/PositionAssignments';
import TloPositions from './pages/TloPositions';

import MainDashboard from './pages/MainDashboard';

// Public Route Component
const PublicRoute = ({ children }) => {
    const { user, loading } = useAuth();
    const location = useLocation();
    if (loading) return <LoadingScreen />;
    if (user) {
        if (location.state?.redirectTo) {
            return <Navigate to={location.state.redirectTo} replace />;
        }
        const activePortal = sessionStorage.getItem('active_portal') || localStorage.getItem('active_portal');
        const roleLower = user.role?.toLowerCase() || '';
        if (activePortal === 'vacancies' || roleLower === 'vacancy applicant') {
            return <Navigate to="/vacancy-dashboard" replace />;
        } else if (['personnel admin', 'super user', 'central office', 'regional office', 'school division office'].includes(roleLower)) {
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
            <Route path="/vacancy-login" element={<PublicRoute><VacancyLogin /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
            
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
            <Route 
                path="/vacancy-dashboard" 
                element={
                    <ProtectedRoute>
                        <VacancyDashboard defaultTab="overview" />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/applicant-dashboard" 
                element={
                    <ProtectedRoute>
                        <VacancyDashboard defaultTab="overview" />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/all-vacancies" 
                element={
                    <ProtectedRoute>
                        <VacancyDashboard defaultTab="vacancies" />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/vacancies" 
                element={
                    <ProtectedRoute>
                        <VacancyDashboard defaultTab="vacancies" />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/my-applications" 
                element={
                    <ProtectedRoute>
                        <VacancyDashboard defaultTab="applications" />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/vacancy-applications" 
                element={
                    <ProtectedRoute>
                        <VacancyDashboard defaultTab="applications" />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/my-applicant-data" 
                element={
                    <ProtectedRoute>
                        <VacancyDashboard defaultTab="profile" />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/applicant-profile" 
                element={
                    <ProtectedRoute>
                        <VacancyDashboard defaultTab="profile" />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/ces-plantilla" 
                element={
                    <ProtectedRoute>
                        <CesPlantilla />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/position-assignments" 
                element={
                    <ProtectedRoute>
                        <PositionAssignments />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/tlo-positions" 
                element={
                    <ProtectedRoute>
                        <TloPositions />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/main-dashboard" 
                element={<Navigate to="/home" replace />} 
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

export default App;
