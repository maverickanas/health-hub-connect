export interface ActivityData {
  steps: number;
  calories: number;
  distance: number;
  hydration: number;
  caloriesConsumed: number;
  stepGoal: number;
  calorieGoal: number;
  distanceGoal: number;
  hydrationGoal: number;
  history: { day: string; steps: number }[];
}

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  FOOD_LENS = 'FOOD_LENS',
  BMI_HUB = 'BMI_HUB',
  MAP_TRACKER = 'MAP_TRACKER',
  CHAT = 'CHAT',
  PROFILE = 'PROFILE',
  ACTIVITY_LOG = 'ACTIVITY_LOG'
}

export type Gender = 'Male' | 'Female' | 'Other';
export type FitnessGoal = 'Weight Loss' | 'Maintain' | 'Muscle Gain';
export type ActivityLevel = 'Sedentary' | 'Lightly Active' | 'Moderately Active' | 'Very Active';

export interface UserMetrics {
  height: number;
  weight: number;
  age?: number;
  gender?: Gender;
  dob?: string;
  activityLevel?: ActivityLevel;
  fitnessGoal?: FitnessGoal;
}

export interface UserProfile {
  id?: string;
  name: string;
  email: string;
  avatarUrl: string;
  metrics?: UserMetrics;
  goals?: {
    stepGoal: number;
    calorieGoal: number;
    distanceGoal: number;
  };
  currentStreak?: number;
  primary_goal?: string;
  penaltySteps?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface FoodAnalysis {
  name: string;
  macros: { calories: number; protein: number; fat: number; carbs: number };
  healthScore: number;
  verdict: 'Excellent' | 'Good' | 'Fair' | 'Avoid';
  advice: string;
}

export interface FoodHistoryItem {
  id: string;
  timestamp: number;
  analysis?: FoodAnalysis;
}
