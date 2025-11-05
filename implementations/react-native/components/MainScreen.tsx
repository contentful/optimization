import React from 'react'
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native'
import type { MainScreenProps } from '../types'
import { InstructionsCard } from './InstructionsCard'
import { SDKConfigCard } from './SDKConfigCard'
import { SDKStatusCard } from './SDKStatusCard'

export function MainScreen({
  colors,
  isDarkMode,
  sdkLoaded,
  sdkError,
  sdkInfo,
  onTestTracking,
  onTestMergeTags,
}: MainScreenProps): React.JSX.Element {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundColor }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header} testID="appHeader">
          <Text style={[styles.title, { color: colors.textColor }]} testID="appTitle">
            Contentful Optimization
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedTextColor }]} testID="appSubtitle">
            React Native SDK Implementation
          </Text>
        </View>

        <SDKStatusCard sdkLoaded={sdkLoaded} sdkError={sdkError} colors={colors} />

        {sdkInfo && <SDKConfigCard sdkInfo={sdkInfo} colors={colors} />}

        <InstructionsCard
          colors={colors}
          onTestTracking={onTestTracking}
          onTestMergeTags={onTestMergeTags}
        />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 40,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
  },
})
