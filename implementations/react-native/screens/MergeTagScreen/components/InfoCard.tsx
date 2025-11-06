/**
 * InfoCard - Displays informational content in a card layout
 */

import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { ThemeColors } from '../types'

interface InfoCardProps {
  title: string
  content: string
  colors: ThemeColors
  accentBackground?: boolean
}

export function InfoCard({
  title,
  content,
  colors,
  accentBackground = false,
}: InfoCardProps): React.JSX.Element {
  const backgroundColor = accentBackground ? colors.accentColor : colors.cardBackground
  const titleColor = accentBackground ? '#ffffff' : colors.textColor
  const contentColor = accentBackground ? '#ffffff' : colors.mutedTextColor

  return (
    <View style={[styles.card, { backgroundColor }]}>
      <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
      <Text style={[styles.content, { color: contentColor }]}>{content}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  content: {
    fontSize: 14,
    lineHeight: 22,
  },
})

