import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Image,
  Modal,
  PanResponder,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useLiveUpdates } from '../../context/LiveUpdatesContext'
import fabIcon from '../assets/fab-icon.png'
import fabRipple from '../assets/fab-ripple.png'
import { PreviewOverrideProvider } from '../context/PreviewOverrideContext'
import { colors, spacing, typography } from '../styles/theme'
import type { PreviewPanelOverlayProps } from '../types'
import { PreviewPanel } from './PreviewPanel'

const DEFAULT_FAB_POSITION = { bottom: spacing.xxl, right: spacing.xxl }
const DRAG_DISMISS_THRESHOLD = 100
const DRAG_DISMISS_DISTANCE = 300
const ANIMATION_DURATION_MS = 200
const DRAG_HANDLE_HEIGHT = 4

export function PreviewPanelOverlay({
  children,
  fabPosition,
  ...previewPanelProps
}: PreviewPanelOverlayProps): React.JSX.Element {
  const [isVisible, setIsVisible] = useState(false)
  const { current: dragY } = useRef(new Animated.Value(0))
  const liveUpdatesContext = useLiveUpdates()

  // Sync preview panel visibility with LiveUpdatesContext
  // This enables live updates in Personalization components when the panel is open
  useEffect(() => {
    liveUpdatesContext?.setPreviewPanelVisible(isVisible)
  }, [isVisible, liveUpdatesContext])

  const handleOpen = useCallback(() => {
    setIsVisible(true)
  }, [])

  const resetDrag = useCallback(() => {
    dragY.setValue(0)
  }, [dragY])

  const handleClose = useCallback(
    (animate: boolean): void => {
      if (!animate) {
        setIsVisible(false)
        resetDrag()
        return
      }

      Animated.timing(dragY, {
        toValue: DRAG_DISMISS_DISTANCE,
        duration: ANIMATION_DURATION_MS,
        useNativeDriver: true,
      }).start(() => {
        setIsVisible(false)
        resetDrag()
      })
    },
    [dragY, resetDrag],
  )

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > DRAG_HANDLE_HEIGHT,
        onPanResponderMove: (_event, gesture) => {
          if (gesture.dy > 0) {
            dragY.setValue(gesture.dy)
          }
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > DRAG_DISMISS_THRESHOLD) {
            handleClose(true)
            return
          }

          Animated.timing(dragY, {
            toValue: 0,
            duration: ANIMATION_DURATION_MS,
            useNativeDriver: true,
          }).start()
        },
        onPanResponderTerminate: () => {
          Animated.timing(dragY, {
            toValue: 0,
            duration: ANIMATION_DURATION_MS,
            useNativeDriver: true,
          }).start()
        },
      }),
    [dragY, handleClose],
  )

  const fabStyle = [
    styles.fab,
    {
      bottom: fabPosition?.bottom ?? DEFAULT_FAB_POSITION.bottom,
      right: fabPosition?.right ?? DEFAULT_FAB_POSITION.right,
    },
  ]

  return (
    <PreviewOverrideProvider>
      <View style={styles.container}>
        {children}
        <Pressable
          accessibilityLabel="Open Preview Panel"
          accessibilityRole="button"
          android_ripple={null}
          onPress={handleOpen}
          style={() => fabStyle}
        >
          {({ pressed }: { pressed: boolean }) => (
            <>
              {pressed && <Image source={fabRipple} style={styles.fabRipple} />}
              <Image source={fabIcon} style={styles.fabIcon} />
            </>
          )}
        </Pressable>
        <Modal
          animationType="slide"
          onRequestClose={() => {
            handleClose(false)
          }}
          presentationStyle="pageSheet"
          transparent={false}
          visible={isVisible}
        >
          <SafeAreaView style={styles.modalContainer}>
            <Animated.View style={[styles.modalContent, { transform: [{ translateY: dragY }] }]}>
              <View style={styles.modalHeader} {...panResponder.panHandlers}>
                <View style={styles.dragHandle} />
                <Pressable
                  accessibilityLabel="Close Preview Panel"
                  accessibilityRole="button"
                  onPress={() => {
                    handleClose(false)
                  }}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeButtonText}>×</Text>
                </Pressable>
              </View>
              <View style={styles.panelContainer}>
                <PreviewPanel {...previewPanelProps} />
              </View>
            </Animated.View>
          </SafeAreaView>
        </Modal>
      </View>
    </PreviewOverrideProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EADDFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  fabRipple: {
    position: 'absolute',
    width: 56,
    height: 56,
    bottom: -10,
    right: -10,
    resizeMode: 'contain',
  },
  fabIcon: {
    width: 20,
    height: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.secondary,
  },
  closeButton: {
    position: 'absolute',
    right: spacing.lg,
    top: spacing.xs,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  panelContainer: {
    flex: 1,
  },
})
