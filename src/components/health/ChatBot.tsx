import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { ChatMessage } from '@/types';

const ChatBot: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'model',
      text: "Welcome to Health Hub AI Coach! 💪 I'm your personal fitness and nutrition advisor. Ask me anything about workouts, diet plans, BMI guidance, or health tips!",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getAIResponse = (userMessage: string): string => {
    const lower = userMessage.toLowerCase();

    if (lower.includes('bmi') || lower.includes('body mass')) {
      return "BMI (Body Mass Index) is calculated by dividing your weight in kg by your height in meters squared. A healthy BMI range is 18.5-24.9. Head to the BMI tab for instant calculations! 📊";
    }
    if (lower.includes('workout') || lower.includes('exercise') || lower.includes('training')) {
      return "Here's a balanced workout split:\n\n**Mon/Thu**: Upper Body (Push-ups, Rows, Shoulder Press)\n**Tue/Fri**: Lower Body (Squats, Lunges, Deadlifts)\n**Wed/Sat**: Cardio + Core\n**Sun**: Rest & Recovery\n\nAim for 3-4 sets of 8-12 reps per exercise. Start light and progressively overload! 💪";
    }
    if (lower.includes('diet') || lower.includes('nutrition') || lower.includes('eat') || lower.includes('food') || lower.includes('meal')) {
      return "A balanced nutrition plan:\n\n🥩 **Protein**: 1.6-2.2g per kg bodyweight\n🍚 **Carbs**: 3-5g per kg bodyweight\n🥑 **Fats**: 0.8-1g per kg bodyweight\n\n**Meal timing**: Eat every 3-4 hours. Pre-workout meal 1-2 hours before training. Post-workout within 30-60 minutes.";
    }
    if (lower.includes('water') || lower.includes('hydrat')) {
      return "Hydration is crucial! 💧\n\n- Aim for **2-3 liters** of water daily\n- Add 500ml for every 30 min of exercise\n- Check urine color — pale yellow = good hydration\n- Electrolytes are key during intense workouts";
    }
    if (lower.includes('sleep') || lower.includes('rest') || lower.includes('recovery')) {
      return "Recovery is where gains are made! 😴\n\n- **7-9 hours** of sleep per night\n- Keep a consistent sleep schedule\n- Avoid screens 1 hour before bed\n- Cool, dark room (18-20°C)\n- Consider stretching or meditation before sleep";
    }
    if (lower.includes('weight loss') || lower.includes('lose weight') || lower.includes('fat loss')) {
      return "Sustainable weight loss strategy:\n\n1. **Calorie deficit**: 300-500 kcal below maintenance\n2. **High protein**: Preserves muscle mass\n3. **Strength training**: 3-4x per week\n4. **Cardio**: 150 min moderate or 75 min vigorous weekly\n5. **Track progress**: Weekly weigh-ins, same conditions\n\nAim for 0.5-1kg loss per week. Patience is key! 🎯";
    }
    if (lower.includes('muscle') || lower.includes('gain') || lower.includes('bulk')) {
      return "Muscle building essentials:\n\n1. **Calorie surplus**: 200-300 kcal above maintenance\n2. **Protein**: 2g per kg bodyweight\n3. **Progressive overload**: Increase weight/reps weekly\n4. **Compound movements**: Squats, Deadlifts, Bench, Rows\n5. **Rest**: 48 hours between muscle groups\n\nConsistency over perfection! 💪";
    }
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
      return "Hey there, Elite! 👋 Ready to crush your fitness goals today? Ask me about workouts, nutrition, BMI, or any health-related topic!";
    }
    if (lower.includes('step') || lower.includes('walk')) {
      return "Walking is one of the best exercises! 🚶\n\n- Aim for **10,000 steps** daily\n- Every 1,000 steps ≈ 40-50 calories burned\n- Walk after meals to improve digestion\n- Use the step tracker in the Dashboard!";
    }

    return "Great question! 🧠 I'd recommend:\n\n1. Set clear, measurable goals\n2. Track your nutrition and workouts\n3. Stay consistent — small daily improvements compound\n4. Listen to your body and rest when needed\n\nWant me to dive deeper into any specific topic? Just ask!";
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate AI thinking delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    const response = getAIResponse(userMsg.text);

    const botMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: response,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, botMsg]);
    setIsTyping(false);
  };

  return (
    <div className="h-full w-full flex flex-col bg-background">
      {/* Header */}
      <div className="pt-12 pb-4 px-6 text-center border-b border-border">
        <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.5em] mb-2">Neural Advisor</h2>
        <h1 className="text-2xl font-black text-foreground leading-none tracking-tight">
          AI <span className="text-luxury-neon">COACH</span>
        </h1>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4 pb-4">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                msg.role === 'user' ? 'bg-luxury-neon/10' : 'bg-muted'
              }`}>
                {msg.role === 'user' ? (
                  <User size={14} className="text-luxury-neon" />
                ) : (
                  <Bot size={14} className="text-luxury-neon" />
                )}
              </div>
              <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-luxury-neon/10 border border-luxury-neon/20 text-foreground'
                  : 'bg-muted border border-border text-foreground/90'
              }`}>
                {msg.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
              <Sparkles size={14} className="text-luxury-neon animate-pulse" />
            </div>
            <div className="bg-muted border border-border rounded-2xl p-4 flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-luxury-neon/50 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-luxury-neon/50 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-luxury-neon/50 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 pb-20 border-t border-border bg-background/80 backdrop-blur-xl">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask your AI coach..."
            className="flex-1 bg-muted border border-border rounded-2xl px-4 py-3 text-sm text-foreground outline-none focus:border-luxury-neon/30 placeholder:text-muted-foreground transition-colors"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleSend}
            disabled={!input.trim()}
            className="w-12 h-12 rounded-2xl bg-luxury-neon text-primary-foreground flex items-center justify-center disabled:opacity-30 shadow-[0_0_15px_rgba(204,255,0,0.2)]"
          >
            <Send size={18} />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;
