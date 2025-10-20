describe('ReactNativeApp - Contentful Optimization SDK', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('App Header', () => {
    it('should display app title', async () => {
      await expect(element(by.id('appTitle'))).toBeVisible();
      await expect(element(by.text('Contentful Optimization'))).toBeVisible();
    });

    it('should display app subtitle', async () => {
      await expect(element(by.id('appSubtitle'))).toBeVisible();
      await expect(element(by.text('React Native SDK Demo'))).toBeVisible();
    });
  });

  describe('SDK Status Card', () => {
    it('should display SDK status card', async () => {
      await expect(element(by.id('sdkStatusCard'))).toBeVisible();
    });

    it('should show SDK initialization or success state', async () => {
      // Wait for either initializing or loaded state
      await waitFor(element(by.id('sdkLoaded')))
        .toBeVisible()
        .withTimeout(10000);

      await expect(element(by.id('sdkLoadedText'))).toBeVisible();
    });
  });

  describe('SDK Configuration Card', () => {
    it('should display configuration card when SDK is loaded', async () => {
      // Wait for SDK to load
      await waitFor(element(by.id('sdkLoaded')))
        .toBeVisible()
        .withTimeout(10000);

      // Configuration card should be visible
      await expect(element(by.id('sdkConfigCard'))).toBeVisible();
    });

    it('should display client ID', async () => {
      await waitFor(element(by.id('clientIdValue')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should display environment', async () => {
      await waitFor(element(by.id('environmentValue')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should display timestamp', async () => {
      await waitFor(element(by.id('timestampValue')))
        .toBeVisible()
        .withTimeout(10000);
    });
  });

  describe('Instructions Card', () => {
    it('should display instructions card', async () => {
      await expect(element(by.id('instructionsCard'))).toBeVisible();
    });

    it('should display instructions text', async () => {
      await expect(element(by.id('instructionsText'))).toBeVisible();
    });
  });

  describe('Error Handling', () => {
    it('should handle SDK errors gracefully', async () => {
      // If there's an error, the error text should be visible
      // This test will pass if no error occurs (normal flow)
      try {
        await expect(element(by.id('sdkError'))).not.toBeVisible();
      } catch (e) {
        // If error is visible, verify the error text element exists
        await expect(element(by.id('sdkErrorText'))).toBeVisible();
      }
    });
  });
});
