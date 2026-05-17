'use client';
import React from 'react';
import { Activity } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function Header() {
    const pathname = usePathname();
    const isLoginPage = pathname === '/login';

    if (isLoginPage) return null;

    return (
        <header style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            backgroundColor: '#ffffff',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid hsl(214, 32%, 91%)',
            padding: '0 2rem',
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)'
        }}>
            {/* Logo Icon */}
            <div style={{
                padding: '0.5rem',
                backgroundColor: 'hsl(180, 75%, 19%, 0.1)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid hsl(180, 75%, 19%, 0.15)'
            }}>
                <Activity color="hsl(180, 75%, 22%)" size={20} />
            </div>

            {/* Title */}
            <div>
                <h1 style={{
                    margin: 0,
                    fontSize: '1.0625rem',
                    fontWeight: 700,
                    color: 'hsl(215, 28%, 17%)',
                    letterSpacing: '-0.01em',
                    lineHeight: 1.2
                }}>
                    PediaCare AI
                </h1>
                <p style={{
                    margin: 0,
                    fontSize: '0.6875rem',
                    color: 'hsl(215, 20%, 55%)',
                    fontWeight: 500,
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase'
                }}>
                    Pediatric Clinic Management
                </p>
            </div>

            {/* Spacer + Actions Portal */}
            <div id="navbar-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem', alignItems: 'center' }} />

            {/* Logout */}
            {!isLoginPage && (
                <button
                    onClick={() => {
                        import('@/lib/api').then(({ AuthService }) => {
                            AuthService.logout();
                        });
                    }}
                    style={{
                        padding: '0.4375rem 0.875rem',
                        borderRadius: '0.5rem',
                        backgroundColor: 'transparent',
                        color: 'hsl(215, 20%, 50%)',
                        border: '1px solid hsl(214, 32%, 88%)',
                        cursor: 'pointer',
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        transition: 'all 0.15s ease',
                        marginLeft: '0.5rem'
                    }}
                    onMouseEnter={e => {
                        (e.target as HTMLButtonElement).style.backgroundColor = 'hsl(0, 72%, 98%)';
                        (e.target as HTMLButtonElement).style.color = 'hsl(0, 72%, 45%)';
                        (e.target as HTMLButtonElement).style.borderColor = 'hsl(0, 72%, 80%)';
                    }}
                    onMouseLeave={e => {
                        (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
                        (e.target as HTMLButtonElement).style.color = 'hsl(215, 20%, 50%)';
                        (e.target as HTMLButtonElement).style.borderColor = 'hsl(214, 32%, 88%)';
                    }}
                >
                    Sign out
                </button>
            )}
        </header>
    );
}
