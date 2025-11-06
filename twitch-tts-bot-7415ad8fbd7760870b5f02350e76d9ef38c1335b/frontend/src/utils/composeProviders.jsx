/**
 * Utility для композиции React Context провайдеров
 * Превращает:
 *   <A><B><C>{children}</C></B></A>
 * В:
 *   <Composed>{children}</Composed>
 */

export const composeProviders = (...providers) => {
  return ({ children }) => {
    return providers.reduceRight((acc, Provider) => {
      return <Provider>{acc}</Provider>;
    }, children);
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

