import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ViewState, ActivityData } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { supabase } from '@/integrations/supabase/client';
import useLocalStorage from '@/hooks/useLocalStorage';
import AuthScreen from '@/components/health/AuthScreen';
import OnboardingScreen from '@/components/health/OnboardingScreen';
import Dashboard from '@/components/health/Dashboard';
import FoodLens from '@/components/health/FoodLens';
import GPSTracker from '@/components/health/GPSTracker';
import ChatBot from '@/components/health/ChatBot';
import ProfileScreen from '@/components/health/ProfileScreen';
import Navigation from '@/components/health/Navigation';
import WelcomeMotivation from '@/components/health/WelcomeMotivation';
import PreparingAccountOverlay from '@/components/health/PreparingAccountOverlay';
import RoutingDebugBanner from '@/components/health/RoutingDebugBanner';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const EMPTY_ACTIVITY: ActivityData = {
  steps: 0, calories: 0, distance: 0, hydration: 0, caloriesConsumed: 0,
  stepGoal: 10000, calorieGoal: 2000, distanceGoal: 5.0, hydrationGoal: 3.0, history: [],
};

// True when a value parses to a finite, positive number (the only meaningful
// state for biometrics like height/weight/age).
const isFilledNumber = (v: unknown): boolean => {
  if (v === null || v === undefined || v === '') return false;
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
};

const Index = () => {
  const { user, loading, profile, profileLoading, refetchProfile, signIn, signUp, signInAsGuest, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.HOME);

  const [isTracking, setIsTracking] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useLocalStorage('hh_notifications', false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [activityData, setActivityData] = useLocalStorage<ActivityData>('hh_activity', EMPTY_ACTIVITY);
  const [streak, setStreak] = useState(0);

  const { requestPermission } = useNotifications({
    waterIntervalMinutes: 30, stepCheckIntervalMinutes: 60,
    stepGoal: activityData.stepGoal, currentSteps: activityData.steps,
    hydration: activityData.hydration, hydrationGoal: activityData.hydrationGoal,
    enabled: notificationsEnabled,
  });

  // Load activity data
  useEffect(() => {
    if (!user) { setDataLoaded(true); return; }
    let isCancelled = false;
    const loadActivity = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase.from('activity_data').select('*').eq('user_id', user.id).eq('date', today).single();
        if (isCancelled) return;
        if (data) {
          setActivityData({
            steps: data.steps ?? 0, calories: data.calories ?? 0,
            distance: Number(data.distance ?? 0), hydration: Number(data.hydration ?? 0),
            caloriesConsumed: data.calories_consumed ?? 0, stepGoal: data.step_goal ?? 10000,
            calorieGoal: data.calorie_goal ?? 2000, distanceGoal: Number(data.distance_goal ?? 5),
            hydrationGoal: Number(data.hydration_goal ?? 3), history: [],
          });
        } else {
          setActivityData(EMPTY_ACTIVITY);
        }
      } catch {
        // ignore fetch errors
      } finally {
        if (!isCancelled) setDataLoaded(true);
      }
    };
    loadActivity();
    return () => { isCancelled = true; };
  }, [user]);

  // Supabase Realtime subscription for cross-device sync
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('activity-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'activity_data',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          const d = payload.new as any;
          const today = new Date().toISOString().split('T')[0];
          if (d.date === today) {
            setActivityData(prev => ({
              ...prev,
              steps: d.steps ?? prev.steps,
              calories: d.calories ?? prev.calories,
              distance: Number(d.distance ?? prev.distance),
              hydration: Number(d.hydration ?? prev.hydration),
              caloriesConsumed: d.calories_consumed ?? prev.caloriesConsumed,
              stepGoal: d.step_goal ?? prev.stepGoal,
              calorieGoal: d.calorie_goal ?? prev.calorieGoal,
              distanceGoal: Number(d.distance_goal ?? prev.distanceGoal),
              hydrationGoal: Number(d.hydration_goal ?? prev.hydrationGoal),
            }));
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Smart routing gate: the profile (preloaded by AuthProvider) is the source of truth.
  // - profile === null  → row truly missing (new user) → Onboarding (a default row
  //   will already be created by AuthProvider.ensureProfileRow).
  // - any of height/weight/age not a finite positive number → Onboarding.
  // - all three numeric biometrics present → Dashboard (returning user).
  const needsOnboarding = useMemo(() => {
    if (!profile) return true;
    return !(
      isFilledNumber(profile.height) &&
      isFilledNumber(profile.weight) &&
      isFilledNumber(profile.age)
    );
  }, [profile]);

  useEffect(() => {
    if (!user || profileLoading) return;
    if (needsOnboarding) {
      console.info('[Routing] Profile incomplete → onboarding wizard.', { profile });
      setShowOnboarding(true);
    } else {
      console.info('[Routing] Returning user with complete profile → dashboard.', { profile });
      setShowOnboarding(false);
    }
  }, [user, profile, profileLoading, needsOnboarding]);


  // Calculate streak
  useEffect(() => {
    if (!user) return;
    const calcStreak = async () => {
      try {
        const { data: rows } = await supabase
          .from('activity_data').select('date, steps, step_goal')
          .eq('user_id', user.id).order('date', { ascending: false }).limit(60);
        if (!rows?.length) { setStreak(0); return; }
        let count = 0;
        const today = new Date();
        for (let i = 0; i < 60; i++) {
          const d = new Date(today); d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          const row = rows.find(r => r.date === dateStr);
          if (row && row.steps >= (row.step_goal || 10000) * 0.5) count++;
          else if (i > 0) break;
        }
        setStreak(count);
      } catch { setStreak(0); }
    };
    calcStreak();
  }, [user, activityData.steps]);

  // Show welcome
  useEffect(() => {
    if (user && dataLoaded && !showOnboarding) {
      const lastWelcome = sessionStorage.getItem('hh_welcome_shown');
      if (!lastWelcome) { setShowWelcome(true); sessionStorage.setItem('hh_welcome_shown', 'true'); }
    }
  }, [user, dataLoaded, showOnboarding]);

  const handleSignIn = async (email: string, password: string) => {
    await signIn(email, password);
    toast.success('Logged in successfully!');
  };

  const handleSignUp = async (email: string, password: string, name: string) => {
    const result = await signUp(email, password, name);
    if (result?.needsEmailConfirmation) {
      // Surface the real backend state instead of a fake success.
      toast.info('Check your inbox to verify your email before logging in.');
      throw new Error('Email verification required. Please check your inbox.');
    }
    toast.success('Account created! Let\'s set up your profile.');
  };

  const handleGuestLogin = async () => {
    await signInAsGuest();
    toast.success('Guest protocol initialized.');
  };

  const handleLogout = async () => {
    await signOut();
    sessionStorage.removeItem('hh_welcome_shown');
    setActivityData(EMPTY_ACTIVITY); setCurrentView(ViewState.HOME);
  };

  const persistToDb = async (merged: ActivityData) => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('activity_data').upsert({
      user_id: user.id, date: today, steps: merged.steps, calories: merged.calories,
      distance: merged.distance, hydration: merged.hydration, calories_consumed: merged.caloriesConsumed,
      step_goal: merged.stepGoal, calorie_goal: merged.calorieGoal,
      distance_goal: merged.distanceGoal, hydration_goal: merged.hydrationGoal,
    }, { onConflict: 'user_id,date' });
  };

  const handleUpdateData = async (updates: Partial<ActivityData>) => {
    const merged = { ...activityData, ...updates };
    setActivityData(merged); // optimistic
    await persistToDb(merged);
  };

  // ADDITIVE workout save from GPS tracker
  const handleWorkoutSave = async (distanceKm: number, caloriesBurned: number, _durationSec: number) => {
    const merged = {
      ...activityData,
      distance: activityData.distance + distanceKm,
      calories: activityData.calories + caloriesBurned,
    };
    setActivityData(merged);
    await persistToDb(merged);
    setCurrentView(ViewState.HOME); // redirect to dashboard
  };

  // Food logged from Lens
  const handleFoodLogged = async (calories: number, _name: string) => {
    const merged = { ...activityData, caloriesConsumed: activityData.caloriesConsumed + calories };
    setActivityData(merged);
    await persistToDb(merged);
  };

  const handleToggleNotifications = useCallback(() => {
    setNotificationsEnabled((prev: boolean) => {
      const next = !prev;
      if (next) toast.success('Reminders enabled!');
      else toast.info('Reminders turned off.');
      return next;
    });
  }, []);

  const handleOnboardingComplete = async () => {
    // Refetch the profile so the routing gate sees the new biometrics immediately,
    // then drop straight into Home (Dashboard).
    try {
      await refetchProfile();
    } catch (err) {
      console.error('[Routing] refetchProfile after onboarding failed:', err);
    }
    setShowOnboarding(false);
    setCurrentView(ViewState.HOME);
    setShowWelcome(true);
    sessionStorage.setItem('hh_welcome_shown', 'true');
  };

  const handleUpdateGoals = async (updates: { stepGoal?: number; calorieGoal?: number; hydrationGoal?: number }) => {
    const merged = { ...activityData, ...updates };
    setActivityData(merged);
    await persistToDb(merged);
    toast.success('Target synchronized');
  };

  const isAuthenticated = !!user;
  const isGuest = !!user?.is_anonymous;
  const userName = profile?.display_name || (isGuest ? 'Guest' : user?.email?.split('@')[0] || 'User');
  void profileLoading;
  const userEmail = user?.email || (isGuest ? 'guest@healthhub.app' : '');

  // Compute which routing rule currently applies — drives the dev debug banner.
  const routingRule: 'loading' | 'returning' | 'onboarding' | 'unauthenticated' =
    !isAuthenticated ? 'unauthenticated'
    : (loading || profileLoading) ? 'loading'
    : needsOnboarding ? 'onboarding'
    : 'returning';

  if (loading) {
    return (
      <>
        <RoutingDebugBanner rule={routingRule} profile={profile} profileLoading={profileLoading} />
        <div className="min-h-[100dvh] flex items-center justify-center bg-background">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <RoutingDebugBanner rule={routingRule} profile={profile} profileLoading={profileLoading} />
        <AuthScreen onSignIn={handleSignIn} onSignUp={handleSignUp} onGuestLogin={handleGuestLogin} />
      </>
    );
  }

  // Wait for the profile to finish loading BEFORE deciding between Dashboard
  // and Onboarding — this guarantees the wizard never flashes for returning users.
  if (profileLoading) {
    return (
      <>
        <RoutingDebugBanner rule={routingRule} profile={profile} profileLoading={profileLoading} />
        <div className="min-h-[100dvh] flex items-center justify-center bg-background">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </>
    );
  }

  // Non-blocking overlay while activity data finishes hydrating after profile is ready.
  const isPreparing = !dataLoaded;

  if (showOnboarding && user) {
    return (
      <>
        <RoutingDebugBanner rule={routingRule} profile={profile} profileLoading={profileLoading} />
        <OnboardingScreen userId={user.id} userName={userName} onComplete={handleOnboardingComplete} />
      </>
    );
  }

      <main className="flex-1 relative w-full overflow-hidden">
        <AnimatePresence mode="wait">
          {currentView === ViewState.HOME && (
            <motion.div key="home" {...pageTransition} className="h-full w-full">
              <Dashboard data={activityData} userName={userName} streak={streak}
                onToggleTracking={() => setIsTracking(!isTracking)} isTracking={isTracking}
                onUpdateData={handleUpdateData} userId={user?.id}
                notificationsEnabled={notificationsEnabled} onToggleNotifications={handleToggleNotifications}
                onRequestNotificationPermission={requestPermission} />
            </motion.div>
          )}
          {currentView === ViewState.LENS && (
            <motion.div key="lens" {...pageTransition} className="h-full w-full">
              <FoodLens onFoodLogged={handleFoodLogged} />
            </motion.div>
          )}
          {currentView === ViewState.TRACK && (
            <motion.div key="track" {...pageTransition} className="h-full w-full">
              <GPSTracker onWorkoutSave={handleWorkoutSave} />
            </motion.div>
          )}
          {currentView === ViewState.COACH && (
            <motion.div key="coach" {...pageTransition} className="h-full w-full">
              <ChatBot onAcceptPlan={(intake) => handleUpdateGoals({ calorieGoal: intake })} />
            </motion.div>
          )}
          {currentView === ViewState.ME && (
            <motion.div key="me" {...pageTransition} className="h-full w-full">
              <ProfileScreen userName={userName} email={userEmail} onLogout={handleLogout}
                stepGoal={activityData.stepGoal} calorieGoal={activityData.calorieGoal}
                hydrationGoal={activityData.hydrationGoal} onUpdateGoals={handleUpdateGoals} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <Navigation currentView={currentView} setView={setCurrentView} />
    </div>
  );
};

export default Index;
