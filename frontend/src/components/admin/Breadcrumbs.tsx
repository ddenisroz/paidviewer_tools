// src/components/admin/Breadcrumbs.tsx
/**
 * Breadcrumbs component for admin navigation
 */
import React from 'react';

import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
    label: string;
    path?: string;
}

interface BreadcrumbsProps {
    items: BreadcrumbItem[];
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
    return (
        <nav className="flex items-center space-x-1 text-sm text-muted-foreground">
            <Link to="/dashboard" className="hover:text-foreground transition-colors">
                <Home className="h-4 w-4" />
            </Link>

            {items.map((item, index) => (
                <React.Fragment key={index}>
                    <ChevronRight className="h-4 w-4" />
                    {item.path ? (
                        <Link
                            to={item.path}
                            className="hover:text-foreground transition-colors"
                        >
                            {item.label}
                        </Link>
                    ) : (
                        <span className="text-foreground font-medium">{item.label}</span>
                    )}
                </React.Fragment>
            ))}
        </nav>
    );
};

export default Breadcrumbs;
