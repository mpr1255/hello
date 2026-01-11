const { chromium } = require('playwright');

(async () => {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

  console.log('Launching Chromium...');

  // Parse proxy URL to extract credentials
  let proxyConfig = null;
  if (proxyUrl) {
    try {
      const url = new URL(proxyUrl);
      proxyConfig = {
        server: `${url.protocol}//${url.host}`,
        username: url.username,
        password: url.password
      };
      console.log('Proxy server:', proxyConfig.server);
      console.log('Proxy username:', proxyConfig.username ? proxyConfig.username.substring(0, 30) + '...' : 'none');
    } catch (e) {
      console.log('Could not parse proxy URL, using as-is');
      proxyConfig = { server: proxyUrl };
    }
  }

  const launchOptions = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--ignore-certificate-errors',
      '--disable-web-security'
    ]
  };

  if (proxyConfig) {
    launchOptions.proxy = proxyConfig;
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    ignoreHTTPSErrors: true
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to ChatGPT shared conversation...');

    // Navigate to the ChatGPT shared conversation
    await page.goto('https://chatgpt.com/share/69636a2f-e610-800a-abb9-70985338edea', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    console.log('Page loaded, waiting for content...');

    // Wait for content to load
    await page.waitForTimeout(10000);

    // Take a screenshot for debugging
    await page.screenshot({ path: '/home/user/hello/chatgpt_screenshot.png', fullPage: true });
    console.log('Screenshot saved to chatgpt_screenshot.png');

    // Try to get the conversation content
    const content = await page.evaluate(() => {
      // Try multiple selectors that ChatGPT might use
      const selectors = [
        '[data-message-author-role]',
        '.markdown',
        '.text-base',
        '.prose',
        '[class*="message"]',
        'article',
        '.group'
      ];

      let messages = [];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          elements.forEach(el => {
            const text = el.innerText?.trim();
            if (text && text.length > 10) {
              messages.push(text);
            }
          });
          if (messages.length > 0) break;
        }
      }

      // If no specific messages found, get the main content
      if (messages.length === 0) {
        const main = document.querySelector('main') || document.body;
        return main.innerText;
      }

      return messages.join('\n\n---\n\n');
    });

    console.log('=== CONVERSATION CONTENT ===\n');
    console.log(content);

  } catch (error) {
    console.error('Error:', error.message);

    // Try to get whatever content is on the page
    try {
      await page.screenshot({ path: '/home/user/hello/chatgpt_error.png', fullPage: true });
      console.log('Error screenshot saved');
      const fallbackContent = await page.content();
      console.log('\n=== PAGE HTML (first 3000 chars) ===\n');
      console.log(fallbackContent.substring(0, 3000));
    } catch (e) {
      console.error('Could not get page content:', e.message);
    }
  } finally {
    await browser.close();
  }
})();
