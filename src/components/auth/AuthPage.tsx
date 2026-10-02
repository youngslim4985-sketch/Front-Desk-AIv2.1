import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

export function AuthPage() {
  const [isSignup, setIsSignup] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              business_name: businessName,
            },
          },
        });

        if (error) throw error;
        setMessage('Account created. Check your email to confirm your account.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <h1 className="text-2xl font-bold">Front-Desk-AI</h1>
        <p className="mt-2 text-slate-400">
          {isSignup ? 'Create your business account' : 'Sign in to your account'}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {isSignup && (
            <input
              type="text"
              required
              placeholder="Business name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
            />
          )}

          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
          />

          <input
            type="password"
            required
            minLength={8}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-amber-500 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
          >
            {loading ? 'Please wait...' : isSignup ? 'Create account' : 'Sign in'}
          </button>
        </form>

        {message && (
          <p className="mt-4 text-sm text-slate-300">{message}</p>
        )}

        <button
          type="button"
          onClick={() => {
            setIsSignup(!isSignup);
            setMessage('');
          }}
          className="mt-6 text-sm text-amber-400"
        >
          {isSignup
            ? 'Already have an account? Sign in'
            : 'Need an account? Sign up'}
        </button>
      </div>
    </div>
  );
}
