'use client';
import React from 'react';
import { Activity } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function Header() {
    const pathname = usePathname();
    const isLoginPage = pathname === '/login';

    return (
        <header style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            backgroundColor: 'var(--glass-bg)',
            backdropFilter: 'blur(var(--glass-blur))',
            borderBottom: '1px solid var(--glass-border)',
            padding: '1rem 2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
        }}>
            <div style={{
                padding: '0.5rem',
                backgroundColor: 'rgba(14, 165, 233, 0.15)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 15px var(--primary-glow)'
            }}>
                <Activity color="hsl(var(--primary))" size={24} />
            </div>
            <div>
                <h1 style={{
                    margin: 0,
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    letterSpacing: '0.5px'
                }}>
                    Pediatric Growth Tracker
                </h1>
                <p style={{
                    margin: 0,
                    fontSize: '0.75rem',
                    color: 'hsl(var(--text-secondary))',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                }}>
                    pediaTrack
                </p>
            </div>

            {/* Action Portal Target */}
            <div id="navbar-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', alignItems: 'center' }}></div>

            {!isLoginPage && (
                <button
                    onClick={() => {
                        import('@/lib/api').then(({ AuthService }) => {
                            AuthService.logout();
                        });
                    }}
                    style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '0.5rem',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        transition: 'all 0.2s ease',
                        marginLeft: '1rem'
                    }}
                    className="hover:bg-red-500/20"
                >
                    Logout
                </button>
            )}
        </header>
    );
}
