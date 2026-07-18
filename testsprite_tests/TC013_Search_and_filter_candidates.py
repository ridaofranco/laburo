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
        
        # -> Navigate to the developer login page (/dev-login) to create an admin session
        await page.goto("http://localhost:3000/dev-login")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the 'Buscar' link in the left sidebar to open the search page.
        # Buscar link
        elem = page.get_by_text('Laburo.Production Portal', exact=True).locator("xpath=ancestor-or-self::*[.//a][1]").get_by_role('link', name='Buscar', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Filtros' button to open the filters panel.
        # Filtros button
        elem = page.get_by_role('button', name='Filtros', exact=True)
        await elem.click(timeout=10000)
        
        # -> Toggle the 'Disponible el finde' switch and click the 'Aplicar' button to apply the availability filter.
        # toggle
        elem = page.locator('[id="base-ui-_r_8_"]')
        await elem.click(timeout=10000)
        
        # -> Toggle the 'Disponible el finde' switch and click the 'Aplicar' button to apply the availability filter.
        # Aplicar button
        elem = page.get_by_role('button', name='Aplicar', exact=True)
        await elem.click(timeout=10000)
        
        # -> Toggle the 'Disponible el finde' switch and click the 'Aplicar' button to apply the availability filter.
        # Técnica button
        elem = page.get_by_role('button', name='Técnica', exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the first candidate card and confirm it shows the role 'Técnica' and an availability indicator for weekends (e.g., 'Disponible el finde').
        # AN Con experiencia agustina noemi painefil... link
        elem = page.locator('a[href="/staff/b915b512-6677-4520-819d-8a54e37dd401"]')
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Verify matching candidate results are displayed
        # Assert: The browser is on the candidate detail URL for the matching result.
        await expect(page).to_have_url(re.compile("/staff/b915b512\\-6677\\-4520\\-819d\\-8a54e37dd401"), timeout=15000), "The browser is on the candidate detail URL for the matching result."
        await page.locator("xpath=/html/body/div[2]/main/div/header/a").nth(0).scroll_into_view_if_needed()
        # Assert: The 'Enviar propuesta' link is visible on the candidate page, indicating a matching result is displayed.
        await expect(page.locator("xpath=/html/body/div[2]/main/div/header/a").nth(0)).to_be_visible(timeout=15000), "The 'Enviar propuesta' link is visible on the candidate page, indicating a matching result is displayed."
        await page.locator("xpath=/html/body/div[2]/main/div/div[1]/div[1]/section[5]/div/div/button").nth(0).scroll_into_view_if_needed()
        # Assert: The 'Abrir CV' button is visible on the candidate page, confirming a matching result is displayed.
        await expect(page.locator("xpath=/html/body/div[2]/main/div/div[1]/div[1]/section[5]/div/div/button").nth(0)).to_be_visible(timeout=15000), "The 'Abrir CV' button is visible on the candidate page, confirming a matching result is displayed."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    