'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

function errorMessage(data, fallback) {
  if (!data) return fallback;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.non_field_errors) && data.non_field_errors.length) {
    return data.non_field_errors.join(' ');
  }
  const messages = Object.entries(data)
    .flatMap(([, value]) => (Array.isArray(value) ? value : [value]))
    .filter(Boolean)
    .map(String);
  return messages.length ? messages.join(' ') : fallback;
}

export default function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(event) {
    event.preventDefault();
    setIsPending(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          errorMessage(
            data,
            response.status === 401
              ? 'Invalid username or password.'
              : 'Login failed. Check your credentials.'
          )
        );
        return;
      }
      if (data.token) {
        window.localStorage.setItem('openTuneToken', data.token);
      }
      router.push('/');
    } catch {
      setError(`Could not reach the backend on ${API_BASE}. Is it running?`);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="auth-error" role="alert">
          {error}
        </div>
      )}
      <label>
        Username
        <input
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          required
        />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      <button type="submit" disabled={isPending}>
        Log In
      </button>
    </form>
  );
}
