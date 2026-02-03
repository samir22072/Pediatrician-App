'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface NavbarActionsProps {
    children: React.ReactNode;
}

export default function NavbarActions({ children }: NavbarActionsProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!mounted) return null;

    const target = document.getElementById('navbar-actions');
    if (!target) return null;

    return createPortal(children, target);
}
