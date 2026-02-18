/**
 * Breadcrumbs Component - навигационные хлебные крошки для админ панели
 */

import React from 'react';

import { ChevronRight, Home } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
}

// Mapping путей к названиям
const pathToLabel: Record<string, string> = {
  'dashboard': 'Главная',
  'dolbaebadmintts': 'Админ панель',
  'users': 'Управление пользователями',
  'voices': 'Управление голосами',
  'monitoring': 'Мониторинг',
  'bots': 'Управление ботами',
  'settings': 'Настройки',
  'logs': 'Логи',
  'analytics': 'Аналитика',
};

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className }) => {
  const location = useLocation();

  // Если items не переданы, генерируем из текущего пути
  const breadcrumbItems = items || generateBreadcrumbs(location.pathname);

  if (breadcrumbItems.length === 0) {
    return null;
  }

  return (
    <nav className={cn('flex items-center space-x-2 text-sm text-muted-foreground', className)}>
      {/* Home icon */}
      <Link
        to="/dashboard"
        className="flex items-center transition-colors hover:text-foreground"
        title="Главная"
      >
        <Home className="h-4 w-4" />
      </Link>

      {breadcrumbItems.map((item, index) => {
        const isLast = index === breadcrumbItems.length - 1;

        return (
          <React.Fragment key={index}>
            <ChevronRight className="h-4 w-4 text-muted-foreground/70" />
            {item.path && !isLast ? (
              <Link
                to={item.path}
                className="transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ) : (
              <span className={cn(
                isLast && 'text-foreground font-medium'
              )}>
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

/**
 * Генерирует breadcrumbs из pathname
 */
function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];
  let currentPath = '';

  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    
    // Пропускаем первый сегмент если это 'dashboard'
    if (index === 0 && segment === 'dashboard') {
      return;
    }

    const label = pathToLabel[segment] || segment;
    
    // Последний элемент без ссылки
    if (index === segments.length - 1) {
      breadcrumbs.push({ label });
    } else {
      breadcrumbs.push({ label, path: currentPath });
    }
  });

  return breadcrumbs;
}

export default Breadcrumbs;
