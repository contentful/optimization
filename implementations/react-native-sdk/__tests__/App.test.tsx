/**
 * @format
 */

import React from 'react'
import 'react-native'
import App from '../App'

// Note: import explicitly to use the types shipped with jest.
import { it } from '@jest/globals'

import { render, screen } from '@testing-library/react-native'

it('renders the loading state after SDK initialization', async () => {
  render(<App />)
  await screen.findByText('Loading...')
})
