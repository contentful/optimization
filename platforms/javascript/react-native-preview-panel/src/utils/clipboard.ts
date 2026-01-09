import Clipboard from '@react-native-clipboard/clipboard'
import { Alert } from 'react-native'

/**
 * Copies text to the clipboard and shows an alert.
 *
 * @param text The text to copy
 * @param label A label describing the text (used in the alert)
 */
export const copyToClipboard = (text: string, label: string): void => {
  Clipboard.setString(text)
  Alert.alert('Copied', `${label} copied to clipboard`)
}
