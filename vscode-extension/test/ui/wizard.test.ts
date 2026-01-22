import { expect } from 'chai';
import {
  VSBrowser,
  WebDriver,
  WebView,
  Workbench,
  EditorView
} from 'vscode-extension-tester';

describe('Qlik Model Builder UI Tests', function () {
  this.timeout(60000); // VS Code takes time to load
  let driver: WebDriver;

  before(async () => {
    driver = VSBrowser.instance.driver;
  });

  it('Should open the Wizard via command palette', async () => {
    // 1. Execute command to open wizard
    const workbench = new Workbench();
    await workbench.executeCommand('Qlik: Open Model Builder Wizard');

    // Wait for panel to open
    await driver.sleep(2000);

    // 2. Check that a webview exists
    const editorView = new EditorView();
    const titles = await editorView.getOpenEditorTitles();

    // The wizard should create a panel with title containing "Qlik"
    const hasWizard = titles.some(t => t.includes('Qlik') || t.includes('Model'));
    expect(hasWizard).to.be.true;
  });

  it('Should show skip connection button and click it', async () => {
    // Get the webview
    const webview = new WebView();
    await webview.switchToFrame();

    try {
      // Find the skip connection button by ID
      const skipButton = await webview.findWebElement({ id: 'btnSkipConnection' });
      const isDisplayed = await skipButton.isDisplayed();
      expect(isDisplayed).to.be.true;

      // Click the skip button
      await skipButton.click();
      await driver.sleep(500);

      // After clicking skip, we should see the dashboard with upload button
      const uploadButton = await webview.findWebElement({ id: 'btnUploadSpec' });
      const uploadVisible = await uploadButton.isDisplayed();
      expect(uploadVisible).to.be.true;

    } finally {
      await webview.switchBack();
    }
  });

  it('Should have Generate Script button visible after skip', async () => {
    const webview = new WebView();
    await webview.switchToFrame();

    try {
      // Look for the generate script button by its onclick handler text
      const buttons = await webview.findWebElements({ css: 'button' });

      let foundGenerateScript = false;
      for (const btn of buttons) {
        const text = await btn.getText();
        if (text.includes('סקריפט') || text.includes('Script')) {
          foundGenerateScript = true;
          break;
        }
      }

      expect(foundGenerateScript).to.be.true;

    } finally {
      await webview.switchBack();
    }
  });

  it('Should show error when generating script without tables', async () => {
    const webview = new WebView();
    await webview.switchToFrame();

    try {
      // Find and click generate script button
      const buttons = await webview.findWebElements({ css: 'button' });

      for (const btn of buttons) {
        const onclick = await btn.getAttribute('onclick');
        if (onclick && onclick.includes('generateScript')) {
          await btn.click();
          break;
        }
      }

      await driver.sleep(500);

    } finally {
      await webview.switchBack();
    }

    // Check for VS Code notification (error message)
    const workbench = new Workbench();
    const notifications = await workbench.getNotifications();

    // Should have at least one notification
    expect(notifications.length).to.be.greaterThan(0);
  });
});
