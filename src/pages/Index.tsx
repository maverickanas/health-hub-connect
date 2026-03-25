import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ViewState, ActivityData } from '@/types';
import useLocalStorage from '@/hooks/useLocalStorage';
import AuthScreen from '@/components/health/AuthScreen';
import Dashboard from '@/components/health/Dashboard';
import BMIHub from '@/components/health/BMIHub';
import ChatBot from '@/components/health/ChatBot';
import ActivityLogger from '@/components/health/ActivityLogger';
import ProfileScreen from '@/components/health/ProfileScreen';
import Navigation from '@/components/health/Navigation';

const Index = () => {
  const [isAuthenticated, setIsAuthenticated] = useLocalStorage('hh_authed', false);
  const [userName, setUserName] = useLocalStorage('hh_username', 'Elite');
  const [userEmail, setUserEmail] = useLocalStorage('hh_email', '');
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [isTracking, setIsTracking] = useState(false);

  const [activityData, setActivityData] = useLocalStorage<ActivityData>('hh_activity', {
    steps: 3247,
    calories: 487,
    distance: 2.1,
    hydration: 1.2,
    caloriesConsumed: 850,
    stepGoal: 10000,
    calorieGoal: 2000,
    distanceGoal: 5.0,
    hydrationGoal: 3.0,
    history: [],
  });

  const [streak] = useLocalStorage('hh_streak', 5);

  const handleLogin = (name: string, email: string) => {
    setUserName(name);
    setUserEmail(email);
    setIsAuthenticated(true);
  };

  const handleGuestLogin = () => {
    setUserName('Guest');
    setUserEmail('guest@healthhub.app');
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentView(ViewState.DASHBOARD);
  };

  const handleUpdateData = (updates: Partial<ActivityData>) => {
    setActivityData(prev => ({ ...prev, ...updates }));
  };

  const handleLogWorkout = (calories: number) => {
    setActivityData(prev => ({
      ...prev,
      calories: prev.calories + calories,
    }));
  };

  if (!isAuthenticated) {
    return <AuthScreen onLogin={handleLogin} onGuestLogin={handleGuestLogin} />;
  }

  const pageTransition = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
    transition: { type: 'spring', damping: 25, stiffness: 200 },
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background text-foreground relative overflow-hidden">
      <main className="flex-1 relative w-full overflow-hidden">
        <AnimatePresence mode="wait">
          {currentView === ViewState.DASHBOARD && (
            <motion.div key="dash" {...pageTransition} className="h-full w-full">
              <Dashboard
                data={activityData}
                userName={userName}
                streak={streak}
                onToggleTracking={() => setIsTracking(!isTracking)}
                isTracking={isTracking}
                onUpdateData={handleUpdateData}
              />
            </motion.div>
          )}
          {currentView === ViewState.BMI_HUB && (
            <motion.div key="bmi" {...pageTransition} className="h-full w-full">
              <BMIHub />
            </motion.div>
          )}
          {currentView === ViewState.CHAT && (
            <motion.div key="chat" {...pageTransition} className="h-full w-full">
              <ChatBot />
            </motion.div>
          )}
          {currentView === ViewState.ACTIVITY_LOG && (
            <motion.div key="log" {...pageTransition} className="h-full w-full">
              <ActivityLogger
                userWeight={70}
                onLogWorkout={handleLogWorkout}
              />
            </motion.div>
          )}
          {currentView === ViewState.PROFILE && (
            <motion.div key="profile" {...pageTransition} className="h-full w-full">
              <ProfileScreen
                userName={userName}
                email={userEmail}
                onLogout={handleLogout}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <Navigation currentView={currentView} setView={setCurrentView} />
    </div>
  );
};

export default Index;
