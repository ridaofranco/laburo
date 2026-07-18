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
        
        # -> Open the developer staff login page (http://localhost:3000/dev-login-staff) to create a staff session and reach the Staff Panel.
        await page.goto("http://localhost:3000/dev-login-staff")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Open the staff onboarding page by navigating to the 'Onboarding' page for staff.
        await page.goto("http://localhost:3000/onboarding-staff")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the 'Siguiente' button to advance the onboarding flow and reveal the onboarding fields.
        # Siguiente button
        elem = page.get_by_role('button', name='Siguiente', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the visible 'Siguiente' button to advance the onboarding flow.
        # Siguiente button
        elem = page.get_by_role('button', name='Siguiente', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Comenzar' button to start the onboarding flow and reveal the onboarding fields.
        # Comenzar button
        elem = page.get_by_role('button', name='Comenzar', exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the 'Onboarding' page (Onboarding staff) to inspect whether the onboarding fields and flow are present and functional.
        await page.goto("http://localhost:3000/onboarding-staff")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the 'Siguiente' button on the onboarding page after scrolling down to reveal more content.
        await page.mouse.wheel(0, 300)
        
        # -> Click the 'Siguiente' button on the onboarding page after scrolling down to reveal more content.
        # Siguiente button
        elem = page.get_by_role('button', name='Siguiente', exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the Staff Panel page (navigate to the 'Panel' / 'panel-staff') to verify whether the staff panel is reachable and whether onboarding is required or broken.
        await page.goto("http://localhost:3000/panel-staff")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # --> Assertions to verify final state
        
        # --> Verify the staff panel is displayed
        await page.locator("xpath=/html/body/div[2]/nav[1]/div[2]/a[1]").nth(0).scroll_into_view_if_needed()
        # Assert: Expected the staff panel to show the "Mis eventos" link.
        await expect(page.locator("xpath=/html/body/div[2]/nav[1]/div[2]/a[1]").nth(0)).to_be_visible(timeout=15000), "Expected the staff panel to show the \"Mis eventos\" link."
        await page.locator("xpath=/html/body/div[2]/nav[1]/div[2]/a[2]").nth(0).scroll_into_view_if_needed()
        # Assert: Expected the staff panel to show the "Fichaje" link.
        await expect(page.locator("xpath=/html/body/div[2]/nav[1]/div[2]/a[2]").nth(0)).to_be_visible(timeout=15000), "Expected the staff panel to show the \"Fichaje\" link."
        await page.locator("xpath=/html/body/div[2]/nav[1]/div[2]/a[3]").nth(0).scroll_into_view_if_needed()
        # Assert: Expected the staff panel to show the "Mi perfil" link.
        await expect(page.locator("xpath=/html/body/div[2]/nav[1]/div[2]/a[3]").nth(0)).to_be_visible(timeout=15000), "Expected the staff panel to show the \"Mi perfil\" link."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    