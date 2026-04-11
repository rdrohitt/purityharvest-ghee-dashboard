import React from 'react';

export function Th({ children, className }: { children: React.ReactNode; className?: string }) {
    return <th className={className ? `fu-th ${className}` : 'fu-th'}>{children}</th>;
}

export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
    return <td className={className ? `fu-td ${className}` : 'fu-td'}>{children}</td>;
}
