import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ViewState, ActivityData } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useNotifications } from '@/hooks/useNotifications';
import { supabase } from '@/integrations/supabase/client';
import useLocalStorage from '@/hooks/useLocalStorage';
import AuthScreen from '@/components/health/AuthScreen';
import Dashboard from '@/components/health/Dashboard';
import FoodLens from '@/components/health/FoodLens';
import GPSTracker from '@/components/health/GPSTracker';
import ChatBot from '@/components/health/ChatBot';
import ProfileScreen from '@/components/health/ProfileScreen';
import Navigation from '@/components/health/Navigation';
import WelcomeMotivation from '@/components/health/WelcomeMotivation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const EMPTY_ACTIVITY: ActivityData = {
  steps: 0,
  calories: 0,
  distance: 0,
  hydration: 0,
  caloriesConsumed: 0,
  stepGoal: 10000,
  calorieGoal: 2000,
  distanceGoal: 5.0,
  hydrationGoal: 3.0,
  history: [],
};

const Index = () => {
  const { user, loading, signIn, signUp, signOut } = useAuth();
  const profile = useProfile(user);
  const [isGuest, setIsGuest] = useLocalStorage('hh_guest', false);
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.HOME);
  const [isTracking, setIsTracking] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useLocalStorage('hh_notifications', false);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [activityData, setActivityData] = useLocalStorage<ActivityData>('hh_activity', EMPTY_ACTIVITY);

  // Calculate real streak from DB
  const [streak, setStreak] = useState(0);

  // Notifications hook
  const { requestPermission, sendNotification } = useNotifications({
    waterIntervalMinutes: 30,
    stepCheckIntervalMinutes: 60,
    stepGoal: activityData.stepGoal,
    currentSteps: activityData.steps,
    hydration: activityData.hydration,
    hydrationGoal: activityData.hydrationGoal,
    enabled: notificationsEnabled,
  });

  // Load real activity data from DB
  useEffect(() => {
    if (!user) {
      setDataLoaded(true);
      return;
    }
    const loadActivity = async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('activity_data')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      if (data) {
        setActivityData({
          steps: data.steps ?? 0,
          calories: data.calories ?? 0,
          distance: Number(data.distance ?? 0),
          hydration: Number(data.hydration ?? 0),
          caloriesConsumed: data.calories_consumed ?? 0,
          stepGoal: data.step_goal ?? 10000,
          calorieGoal: data.calorie_goal ?? 2000,
          distanceGoal: Number(data.distance_goal ?? 5),
          hydrationGoal: Number(data.hydration_goal ?? 3),
          history: [],
        });
      } else {
        // No data for today yet — start fresh
        setActivityData(EMPTY_ACTIVITY);
      }
      setDataLoaded(true);
    };
    loadActivity();
  }, [user]);

  // Calculate streak from DB
  useEffect(() => {
    if (!user) return;
    const calcStreak = async () => {
      const { data: rows } = await supabase
        .from('activity_data')
        .select('date, steps, step_goal')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(60);

      if (!rows?.length) { setStreak(0); return; }

      let count = 0;
      const today = new Date();
      for (let i = 0; i < 60; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const row = rows.find(r => r.date === dateStr);
        if (row && row.steps >= (row.step_goal || 10000) * 0.5) {
          count++;
        } else if (i > 0) {
          break; // streak broken
        }
        // Allow today to not count as broken
      }
      setStreak(count);
    };
    calcStreak();
  }, [user, activityData.steps]);

  // Show welcome on login
  useEffect(() => {
    if (user && dataLoaded) {
      const lastWelcome = sessionStorage.getItem('hh_welcome_shown');
      if (!lastWelcome) {
        setShowWelcome(true);
        sessionStorage.setItem('hh_welcome_shown', 'true');
      }
    }
  }, [user, dataLoaded]);

  const handleSignIn = async (email: string, password: string) => {
    await signIn(email, password);
    setIsGuest(false);
  };

  const handleSignUp = async (email: string, password: string, name: string) => {
    await signUp(email, password, name);
    toast.success('Account created! You are now logged in.');
    setIsGuest(false);
  };

  const handleGuestLogin = () => setIsGuest(true);

  const handleLogout = async () => {
    if (isGuest) {
      setIsGuest(false);
    } else {
      await signOut();
    }
    sessionStorage.removeItem('hh_welcome_shown');
    setActivityData(EMPTY_ACTIVITY);
    setCurrentView(ViewState.HOME);
  };

  const handleUpdateData = async (updates: Partial<ActivityData>) => {
    setActivityData(prev => ({ ...prev, ...updates }));
    if (user) {
      const today = new Date().toISOString().split('T')[0];
      const merged = { ...activityData, ...updates };
      await supabase.from('activity_data').upsert({
        user_id: user.id,
        date: today,
        steps: merged.steps,
        calories: merged.calories,
        distance: merged.distance,
        hydration: merged.hydration,
        calories_consumed: merged.caloriesConsumed,
        step_goal: merged.stepGoal,
        calorie_goal: merged.calorieGoal,
        distance_goal: merged.distanceGoal,
        hydration_goal: merged.hydrationGoal,
      }, { onConflict: 'user_id,date' });
    }
  };

  const handleToggleNotifications = useCallback(() => {
    setNotificationsEnabled((prev: boolean) => {
      const next = !prev;
      if (next) {
        toast.success('Reminders enabled! You\'ll get water & step notifications.');
      } else {
        toast.info('Reminders turned off.');
      }
      return next;
    });
  }, []);

  const isAuthenticated = !!user || isGuest;
  const userName = profile?.display_name || (isGuest ? 'Guest' : user?.email?.split('@')[0] || 'User');
  const userEmail = user?.email || (isGuest ? 'guest@healthhub.app' : '');

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-luxury-neon" size={32} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen onSignIn={handleSignIn} onSignUp={handleSignUp} onGuestLogin={handleGuestLogin} />;
  }

  const pageTransition = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
    transition: { type: 'spring' as const, damping: 25, stiffness: 200 },
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background text-foreground relative overflow-hidden">
      {/* Welcome Motivation Overlay */}
      {showWelcome && (
        <WelcomeMotivation
          userName={userName}
          onDismiss={() => setShowWelcome(false)}
        />
      )}

      <main className="flex-1 relative w-full overflow-hidden">
        <AnimatePresence mode="wait">
          {currentView === ViewState.HOME && (
            <motion.div key="home" {...pageTransition} className="h-full w-full">
              <Dashboard
                data={activityData}
                userName={userName}
                streak={streak}
                onToggleTracking={() => setIsTracking(!isTracking)}
                isTracking={isTracking}
                onUpdateData={handleUpdateData}
                userId={user?.id}
                notificationsEnabled={notificationsEnabled}
                onToggleNotifications={handleToggleNotifications}
                onRequestNotificationPermission={requestPermission}
              />
            </motion.div>
          )}
          {currentView === ViewState.LENS && (
            <motion.div key="lens" {...pageTransition} className="h-full w-full">
              <FoodLens />
            </motion.div>
          )}
          {currentView === ViewState.TRACK && (
            <motion.div key="track" {...pageTransition} className="h-full w-full">
              <GPSTracker />
            </motion.div>
          )}
          {currentView === ViewState.COACH && (
            <motion.div key="coach" {...pageTransition} className="h-full w-full">
              <ChatBot />
            </motion.div>
          )}
          {currentView === ViewState.ME && (
            <motion.div key="me" {...pageTransition} className="h-full w-full">
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
