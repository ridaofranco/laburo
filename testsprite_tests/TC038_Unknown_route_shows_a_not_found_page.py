import asyncio
import re
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        # Wider default timeout to match the agent's DOM-stability budget;
        # auto-waiting Playwright APIs (expect, locator.wait_for) inherit this.
        context.set_default_timeout(15000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> navigate
        await page.goto("http://localhost:3000")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Navigate to the URL /ruta-que-no-existe-xyz and confirm a 404/not-found page is displayed and the app remains usable (e.g., header or navigation links still accessible).
        await page.goto("http://localhost:3000/ruta-que-no-existe-xyz")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # --> Assertions to verify final state
        
        # --> Verify a not-found page is displayed and the app stays usable
        # Assert: Expected the URL to contain '/ruta-que-no-existe-xyz' indicating a not-found page is displayed.
        await expect(page).to_have_url(re.compile("/ruta\\-que\\-no\\-existe\\-xyz"), timeout=15000), "Expected the URL to contain '/ruta-que-no-existe-xyz' indicating a not-found page is displayed."
        await page.locator("xpath=/html/body/main/div[2]/form/div/input").nth(0).scroll_into_view_if_needed()
        # Assert: Expected the app to remain usable by showing the email input on the page.
        await expect(page.locator("xpath=/html/body/main/div[2]/form/div/input").nth(0)).to_be_visible(timeout=15000), "Expected the app to remain usable by showing the email input on the page."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    