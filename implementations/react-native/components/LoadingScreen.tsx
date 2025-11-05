import React from 'react'
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native'
import type { LoadingScreenProps } from '../types'

export function LoadingScreen({ colors, isDarkMode }: LoadingScreenProps): React.JSX.Element {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundColor }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.successColor} />
        <Text style={[styles.loadingText, { color: colors.textColor }]}>
          Loading entries from mock server...
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
})
