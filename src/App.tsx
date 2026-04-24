/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { VaultProvider } from './contexts/VaultContext';
import { TabsProvider } from './contexts/TabsContext';
import { ActivityProvider } from './contexts/ActivityContext';
import { AppSettingsProvider } from './contexts/AppSettingsContext';
import { LibraryProvider } from './contexts/LibraryContext';
import { ModalProvider } from './components/Modal';
import { Toaster } from './components/ui/sonner';
import { Layout } from './components/Layout';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';

export default function App() {
  return (
    <VaultProvider>
      <TabsProvider>
        <ActivityProvider>
          <AppSettingsProvider>
            <LibraryProvider>
              <ModalProvider>
                <Layout />
                <KeyboardShortcuts />
                <Toaster position="bottom-right" closeButton />
              </ModalProvider>
            </LibraryProvider>
          </AppSettingsProvider>
        </ActivityProvider>
      </TabsProvider>
    </VaultProvider>
  );
}
