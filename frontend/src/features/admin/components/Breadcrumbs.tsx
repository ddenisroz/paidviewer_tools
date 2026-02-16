/**
 * Breadcrumbs Component - РЅР°РІРёРіР°С†РёРѕРЅРЅС‹Рµ С…Р»РµР±РЅС‹Рµ РєСЂРѕС€РєРё РґР»СЏ Р°РґРјРёРЅ РїР°РЅРµР»Рё
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

// Mapping РїСѓС‚РµР№ Рє РЅР°Р·РІР°РЅРёСЏРј
const pathToLabel: Record<string, string> = {
  'dashboard': 'Р“Р»Р°РІРЅР°СЏ',
  'dolbaebadmintts': 'РђРґРјРёРЅ РїР°РЅРµР»СЊ',
  'users': 'РЈРїСЂР°РІР»РµРЅРёРµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏРјРё',
  'voices': 'РЈРїСЂР°РІР»РµРЅРёРµ РіРѕР»РѕСЃР°РјРё',
  'monitoring': 'РњРѕРЅРёС‚РѕСЂРёРЅРі',
  'support': 'РџРѕРґРґРµСЂР¶РєР°',
  'bots': 'РЈРїСЂР°РІР»РµРЅРёРµ Р±РѕС‚Р°РјРё',
  'settings': 'РќР°СЃС‚СЂРѕР№РєРё',
  'logs': 'Р›РѕРіРё',
  'analytics': 'РђРЅР°Р»РёС‚РёРєР°',
};

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className }) => {
  const location = useLocation();

  // Р•СЃР»Рё items РЅРµ РїРµСЂРµРґР°РЅС‹, РіРµРЅРµСЂРёСЂСѓРµРј РёР· С‚РµРєСѓС‰РµРіРѕ РїСѓС‚Рё
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
        title="Р“Р»Р°РІРЅР°СЏ"
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
 * Р“РµРЅРµСЂРёСЂСѓРµС‚ breadcrumbs РёР· pathname
 */
function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];
  let currentPath = '';

  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    
    // РџСЂРѕРїСѓСЃРєР°РµРј РїРµСЂРІС‹Р№ СЃРµРіРјРµРЅС‚ РµСЃР»Рё СЌС‚Рѕ 'dashboard'
    if (index === 0 && segment === 'dashboard') {
      return;
    }

    const label = pathToLabel[segment] || segment;
    
    // РџРѕСЃР»РµРґРЅРёР№ СЌР»РµРјРµРЅС‚ Р±РµР· СЃСЃС‹Р»РєРё
    if (index === segments.length - 1) {
      breadcrumbs.push({ label });
    } else {
      breadcrumbs.push({ label, path: currentPath });
    }
  });

  return breadcrumbs;
}

export default Breadcrumbs;

