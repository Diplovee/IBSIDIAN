/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { VaultProvider } from './contexts/VaultContext';
import { TabsProvider } from './contexts/TabsContext';
import { ActivityProvider } from './contexts/ActivityContext';
import { Layout } from './components/Layout';

export default function App() {
  return (
    <VaultProvider>
      <TabsProvider>
        <ActivityProvider>
          <Layout />
        </ActivityProvider>
      </TabsProvider>
    </VaultProvider>
  );
}
