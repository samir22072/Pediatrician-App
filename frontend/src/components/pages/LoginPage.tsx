import React, { useState } from 'react';
import { AuthService } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { User, Lock, Activity, AlertCircle } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await AuthService.login({ username, password });
            const { token, role, patientId } = res.data;

            localStorage.setItem('token', token);
            localStorage.setItem('role', role);
            localStorage.setItem('actualRole', role);
            if (patientId) localStorage.setItem('patientId', patientId);

            window.location.href = '/';
        } catch (err: any) {
            console.error(err);
            setError('Invalid username or password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, hsl(210, 40%, 97%) 0%, hsl(180, 30%, 94%) 50%, hsl(210, 40%, 96%) 100%)',
            padding: '1.5rem',
            fontFamily: 'Inter, sans-serif'
        }}>
            {/* Decorative background circles */}
            <div style={{
                position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0
            }}>
                <div style={{
                    position: 'absolute', top: '-10%', right: '-5%',
                    width: '500px', height: '500px', borderRadius: '50%',
                    background: 'radial-gradient(circle, hsl(180, 75%, 19%, 0.06) 0%, transparent 70%)'
                }} />
                <div style={{
                    position: 'absolute', bottom: '-10%', left: '-5%',
                    width: '400px', height: '400px', borderRadius: '50%',
                    background: 'radial-gradient(circle, hsl(180, 60%, 85%, 0.25) 0%, transparent 70%)'
                }} />
            </div>

            {/* Card */}
            <div style={{
                position: 'relative', zIndex: 1,
                width: '100%', maxWidth: '420px',
                backgroundColor: '#ffffff',
                borderRadius: '1.25rem',
                border: '1px solid hsl(214, 32%, 91%)',
                boxShadow: '0 20px 60px -10px rgba(12, 74, 80, 0.12), 0 8px 20px -8px rgba(0,0,0,0.08)',
                overflow: 'hidden'
            }}>
                {/* Card top accent bar */}
                <div style={{
                    height: '4px',
                    background: 'linear-gradient(90deg, hsl(180, 75%, 19%) 0%, hsl(180, 60%, 30%) 100%)'
                }} />

                {/* Card Header */}
                <div style={{ padding: '2rem 2rem 1.5rem', textAlign: 'center' }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: '64px', height: '64px', borderRadius: '16px',
                        backgroundColor: 'hsl(180, 75%, 19%, 0.08)',
                        border: '1.5px solid hsl(180, 75%, 19%, 0.15)',
                        marginBottom: '1.25rem'
                    }}>
                        <Activity size={28} color="hsl(180, 75%, 22%)" />
                    </div>
                    <h1 style={{
                        margin: 0,
                        fontSize: '1.625rem',
                        fontWeight: 800,
                        color: 'hsl(215, 28%, 15%)',
                        letterSpacing: '-0.02em'
                    }}>
                        PediaCare AI
                    </h1>
                    <p style={{
                        margin: '0.375rem 0 0',
                        fontSize: '0.8125rem',
                        color: 'hsl(215, 20%, 52%)',
                        fontWeight: 500
                    }}>
                        Pediatric Clinic Management System
                    </p>
                </div>

                {/* Divider */}
                <div style={{ height: '1px', backgroundColor: 'hsl(214, 32%, 93%)', margin: '0 2rem' }} />

                {/* Form */}
                <form onSubmit={handleLogin} style={{ padding: '1.75rem 2rem 2rem' }}>
                    {/* Username */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{
                            display: 'block', fontSize: '0.8125rem', fontWeight: 600,
                            color: 'hsl(215, 28%, 25%)', marginBottom: '0.375rem', letterSpacing: '0.01em'
                        }}>
                            Username
                        </label>
                        <div style={{ position: 'relative' }}>
                            <User size={15} style={{
                                position: 'absolute', left: '0.875rem', top: '50%',
                                transform: 'translateY(-50%)', color: 'hsl(215, 20%, 55%)'
                            }} />
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                required
                                autoComplete="username"
                                placeholder="Enter your username"
                                style={{
                                    width: '100%', boxSizing: 'border-box',
                                    height: '2.625rem', paddingLeft: '2.5rem', paddingRight: '0.875rem',
                                    borderRadius: '0.5rem', fontSize: '0.875rem',
                                    border: '1.5px solid hsl(214, 32%, 88%)',
                                    backgroundColor: 'hsl(210, 40%, 98%)',
                                    color: 'hsl(215, 28%, 17%)',
                                    outline: 'none',
                                    transition: 'border-color 0.15s, box-shadow 0.15s',
                                    fontFamily: 'Inter, sans-serif'
                                }}
                                onFocus={e => {
                                    e.target.style.borderColor = 'hsl(180, 75%, 22%)';
                                    e.target.style.boxShadow = '0 0 0 3px hsl(180, 75%, 22%, 0.10)';
                                    e.target.style.backgroundColor = '#ffffff';
                                }}
                                onBlur={e => {
                                    e.target.style.borderColor = 'hsl(214, 32%, 88%)';
                                    e.target.style.boxShadow = 'none';
                                    e.target.style.backgroundColor = 'hsl(210, 40%, 98%)';
                                }}
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div style={{ marginBottom: '1.375rem' }}>
                        <label style={{
                            display: 'block', fontSize: '0.8125rem', fontWeight: 600,
                            color: 'hsl(215, 28%, 25%)', marginBottom: '0.375rem', letterSpacing: '0.01em'
                        }}>
                            Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={15} style={{
                                position: 'absolute', left: '0.875rem', top: '50%',
                                transform: 'translateY(-50%)', color: 'hsl(215, 20%, 55%)'
                            }} />
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                                placeholder="Enter your password"
                                style={{
                                    width: '100%', boxSizing: 'border-box',
                                    height: '2.625rem', paddingLeft: '2.5rem', paddingRight: '0.875rem',
                                    borderRadius: '0.5rem', fontSize: '0.875rem',
                                    border: '1.5px solid hsl(214, 32%, 88%)',
                                    backgroundColor: 'hsl(210, 40%, 98%)',
                                    color: 'hsl(215, 28%, 17%)',
                                    outline: 'none',
                                    transition: 'border-color 0.15s, box-shadow 0.15s',
                                    fontFamily: 'Inter, sans-serif'
                                }}
                                onFocus={e => {
                                    e.target.style.borderColor = 'hsl(180, 75%, 22%)';
                                    e.target.style.boxShadow = '0 0 0 3px hsl(180, 75%, 22%, 0.10)';
                                    e.target.style.backgroundColor = '#ffffff';
                                }}
                                onBlur={e => {
                                    e.target.style.borderColor = 'hsl(214, 32%, 88%)';
                                    e.target.style.boxShadow = 'none';
                                    e.target.style.backgroundColor = 'hsl(210, 40%, 98%)';
                                }}
                            />
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{
                            display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
                            padding: '0.75rem 0.875rem', marginBottom: '1rem',
                            backgroundColor: 'hsl(0, 86%, 97%)', border: '1px solid hsl(0, 72%, 90%)',
                            borderRadius: '0.5rem', color: 'hsl(0, 65%, 40%)',
                            fontSize: '0.8125rem', fontWeight: 500
                        }}>
                            <AlertCircle size={15} style={{ marginTop: '0.05rem', flexShrink: 0 }} />
                            {error}
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%', height: '2.75rem',
                            borderRadius: '0.5625rem', border: 'none',
                            background: loading
                                ? 'hsl(180, 75%, 30%)'
                                : 'linear-gradient(135deg, hsl(180, 75%, 19%) 0%, hsl(180, 65%, 25%) 100%)',
                            color: '#ffffff', fontSize: '0.9375rem', fontWeight: 700,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            letterSpacing: '0.01em',
                            boxShadow: loading ? 'none' : '0 4px 14px 0 hsl(180, 75%, 19%, 0.30)',
                            transition: 'all 0.15s ease',
                            fontFamily: 'Inter, sans-serif',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                        }}
                    >
                        {loading ? (
                            <>
                                <span style={{
                                    width: '16px', height: '16px', borderRadius: '50%',
                                    border: '2px solid rgba(255,255,255,0.3)',
                                    borderTopColor: '#fff',
                                    animation: 'spin 0.7s linear infinite',
                                    display: 'inline-block'
                                }} />
                                Signing in...
                            </>
                        ) : 'Sign In'}
                    </button>

                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </form>

                {/* Footer Note */}
                <div style={{
                    textAlign: 'center', padding: '0 2rem 1.5rem',
                    fontSize: '0.75rem', color: 'hsl(215, 20%, 60%)'
                }}>
                    Authorized medical personnel only
                </div>
            </div>
        </div>
    );
}
