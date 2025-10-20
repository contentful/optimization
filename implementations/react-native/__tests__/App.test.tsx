/**
 * @format
 */

import React from 'react';
import 'react-native';
import App from '../App';

// Note: import explicitly to use the types shipped with jest.
import {it} from '@jest/globals';

import {render} from '@testing-library/react-native';

it('renders correctly', () => {
  render(<App />);
});
