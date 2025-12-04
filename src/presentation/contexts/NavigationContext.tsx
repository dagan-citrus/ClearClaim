/**
 * Navigation context for tab switching and action triggers
 */

import React, { createContext, useContext } from 'react';

type TabType = 'dashboard' | 'profiles' | 'insurers' | 'claims' | 'new-claim';

interface NavigationContextType {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  shouldOpenFilePicker: boolean;
  setShouldOpenFilePicker: (should: boolean) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
};

interface NavigationProviderProps {
  children: React.ReactNode;
  value: NavigationContextType;
}

export const NavigationProvider: React.FC<NavigationProviderProps> = ({ children, value }) => {
  return (
    <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
  );
};
