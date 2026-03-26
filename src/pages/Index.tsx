import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ViewState, ActivityData } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import useLocalStorage from '@/hooks/useLocalStorage';
import AuthScreen from '@/components/health/AuthScreen';
import Dashboard from '@/components/health/Dashboard';
import BMIHub from '@/components/health/BMIHub';
import ChatBot from '@/components/health/ChatBot';
import ActivityLogger from '@/components/health/ActivityLogger';
import ProfileScreen from '@/components/health/ProfileScreen';
import Navigation from '@/components/health/Navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const Index = () => {
  const { user, loading, signIn, signUp, signOut } = useAuth();
  const profile = useProfile(user);
  const [isGuest, setIsGuest] = useLocalStorage('hh_guest', false);
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [isTracking, setIsTracking] = useState(false);

  const [activityData, setActivityData] = useLocalStorage<ActivityData>('hh_activity', {
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
  });

  const [streak] = useLocalStorage('hh_streak', 5);

  // Load activity data from DB for authenticated users
  useEffect(() => {
    if (!user) return;
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
          steps: data.steps,
          calories: data.calories,
          distance: Number(data.distance),
          hydration: Number(data.hydration),
          caloriesConsumed: data.calories_consumed,
          stepGoal: data.step_goal,
          calorieGoal: data.calorie_goal,
          distanceGoal: Number(data.distance_goal),
          hydrationGoal: Number(data.hydration_goal),
          history: [],
        });
      }
    };
    loadActivity();
  }, [user]);

  const handleSignIn = async (email: string, password: string) => {
    await signIn(email, password);
    setIsGuest(false);
  };

  const handleSignUp = async (email: string, password: string, name: string) => {
    await signUp(email, password, name);
    toast.success('Account created! Check your email to verify.');
    setIsGuest(false);
  };

  const handleGuestLogin = () => {
    setIsGuest(true);
  };

  const handleLogout = async () => {
    if (isGuest) {
      setIsGuest(false);
    } else {
      await signOut();
    }
    setCurrentView(ViewState.DASHBOARD);
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

  const handleLogWorkout = (calories: number) => {
    handleUpdateData({ calories: activityData.calories + calories });
  };

  const isAuthenticated = !!user || isGuest;
  const userName = profile?.display_name || (isGuest ? 'Guest' : 'Elite');
  const userEmail = user?.email || (isGuest ? 'guest@healthhub.app' : '');

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-luxury-neon" size={32} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthScreen
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
        onGuestLogin={handleGuestLogin}
      />
    );
  }

  const pageTransition = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
    transition: { type: 'spring' as const, damping: 25, stiffness: 200 },
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
