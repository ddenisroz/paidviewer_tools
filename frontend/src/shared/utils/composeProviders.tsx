/**
 * Utility для композиции React Context провайдеров
 * Превращает:
 *   <A><B><C>{children}</C></B></A>
 * В:
 *   <Composed>{children}</Composed>
 */

import React, { ComponentType, ReactNode } from 'react';

interface ProviderProps {
    children: ReactNode;
}

export const composeProviders = (...providers: ComponentType<ProviderProps>[]): React.FC<ProviderProps> => {
    return ({ children }) => {
        return providers.reduceRight((acc, Provider) => {
            return <Provider>{acc}</Provider>;
        }, children as React.ReactElement);
    };
};

/**
 * Пример использования:
 *
 * const AppProviders = composeProviders(
 *   ToastProvider,
 *   AuthProvider,
 *   IntegrationsProvider
 * );
 *
 * <AppProviders>
 *   <App />
 * </AppProviders>
 */
