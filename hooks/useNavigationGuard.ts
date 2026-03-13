/**
 * Navigation Guard Hook
 * 
 * Provides navigation protection to ensure users can't navigate back to 
 * authentication screens when logged in, and vice versa.
 */

import { useEffect } from 'react';
import { router, usePathname } from 'expo-router';
import { supabase } from '@/lib/supabase';

export function useNavigationGuard() {
  const pathname = usePathname();

  useEffect(() => {
    const checkNavigationPermissions = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const isAuthenticated = !!session?.user;
        
        // Define protected routes
        const authRoutes = ['/welcome', '/Authentication/login', '/Authentication/register'];
        const protectedRoutes = ['/(tabs)', '/unlock'];
        
        // Check if user is on auth route while authenticated
        if (isAuthenticated && authRoutes.some(route => pathname.startsWith(route))) {
          console.log('[NavigationGuard] Redirecting authenticated user from auth route to app');
          router.replace('/(tabs)');
          return;
        }
        
        // Check if user is on protected route while not authenticated
        if (!isAuthenticated && protectedRoutes.some(route => pathname.startsWith(route))) {
          console.log('[NavigationGuard] Redirecting unauthenticated user from protected route to welcome');
          router.replace('/welcome');
          return;
        }
      } catch (error) {
        console.error('[NavigationGuard] Error checking navigation permissions:', error);
      }
    };

    // Small delay to ensure navigation system is ready
    const timer = setTimeout(checkNavigationPermissions, 100);
    
    return () => clearTimeout(timer);
  }, [pathname]);

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const isAuthenticated = !!session?.user;
      
      if (event === 'SIGNED_IN' && isAuthenticated) {
        // User just signed in, redirect to app
        router.replace('/(tabs)');
      } else if (event === 'SIGNED_OUT' && !isAuthenticated) {
        // User just signed out, redirect to welcome
        router.replace('/welcome');
      }
    });

    return () => subscription?.unsubscribe();
  }, []);
}