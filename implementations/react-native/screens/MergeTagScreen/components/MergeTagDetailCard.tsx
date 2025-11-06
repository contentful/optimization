/**
 * MergeTagDetailCard - Displays details about merge tags and their resolved values
 */

import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { MergeTagEntry } from '@contentful/optimization-react-native'

import type { ThemeColors } from '../types'

interface MergeTagDetailCardProps {
  mergeTagDetails: MergeTagEntry[]
  resolvedValues: Array<{ id: string; value: unknown }>
  colors: ThemeColors
}

interface DetailRowProps {
  label: string
  value: string
  colors: ThemeColors
  highlight?: boolean
}

function DetailRow({ label, value, colors, highlight = false }: DetailRowProps): React.JSX.Element {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.mutedTextColor }]}>{label}:</Text>
      <Text
        style={[
          highlight ? styles.highlightedValue : styles.detailValue,
          { color: highlight ? colors.successColor : colors.textColor },
        ]}
        numberOfLines={label === 'Profile ID' ? 1 : undefined}
        ellipsizeMode={label === 'Profile ID' ? 'middle' : undefined}
      >
        {value}
      </Text>
    </View>
  )
}

export function MergeTagDetailCard({
  mergeTagDetails,
  resolvedValues,
  colors,
}: MergeTagDetailCardProps): React.JSX.Element | null {
  if (mergeTagDetails.length === 0) return null

  return (
    <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
      <Text style={[styles.title, { color: colors.textColor }]}>Merge Tag Details</Text>
      {mergeTagDetails.map((mergeTag, index) => {
        const tagFields = mergeTag.fields as {
          nt_name: string
          nt_mergetag_id: string
          nt_fallback?: string
        }
        return (
          <View key={index} style={styles.detailSection}>
            <DetailRow label="Name" value={tagFields.nt_name} colors={colors} />
            <DetailRow label="Path" value={tagFields.nt_mergetag_id} colors={colors} />
            <DetailRow label="Fallback" value={tagFields.nt_fallback ?? 'None'} colors={colors} />
            <DetailRow
              label="Resolved Value"
              value={resolvedValues[index]?.value?.toString() ?? 'N/A'}
              colors={colors}
              highlight
            />
          </View>
        )
      })}
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
  detailSection: {
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    width: 120,
  },
  detailValue: {
    fontSize: 14,
    flex: 1,
    fontFamily: 'monospace',
  },
  highlightedValue: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
})
