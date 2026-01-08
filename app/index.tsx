import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../db/supabase';
import { Session } from '@supabase/supabase-js';
export default function EntryScreen() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (session) {
    return <Redirect href="/translation" />;
  }
  
  return <Redirect href="/auth/signin" />;
}