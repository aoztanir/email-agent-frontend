import { create } from 'zustand';
import { createClient } from '@/utils/supabase/client';
import type { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  initialize: async () => {
    const supabase = createClient();
    
    try {
      // Get current user
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        console.error('Auth error:', error);
        set({ user: null, isLoading: false, isAuthenticated: false });
        return;
      }

      set({ 
        user, 
        isLoading: false, 
        isAuthenticated: !!user 
      });

      // Listen for auth changes
      supabase.auth.onAuthStateChange((_event, session) => {
        const newUser = session?.user || null;
        set({ 
          user: newUser, 
          isLoading: false, 
          isAuthenticated: !!newUser 
        });
      });
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({ user: null, isLoading: false, isAuthenticated: false });
    }
  },

  signOut: async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    set({ user: null, isAuthenticated: false });
  },
}));