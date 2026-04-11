'use client';

import React from 'react';

interface CommandCardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export function CommandCard({ children, title, className = '' }: CommandCardProps) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br from-[#141419] to-[#1a1a21] border border-white/5 p-6 transition-all hover:border-indigo-500/10 hover:shadow-lg hover:shadow-indigo-500/5 ${className}`}>
      {title && (
        <h2 className="text-lg font-semibold text-gray-100 mb-4">{title}</h2>
      )}
      {children}
    </div>
  );
}
