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
        
        # -> Open the developer login page by navigating to the /dev-login URL to create an admin session.
        await page.goto("http://localhost:3000/dev-login")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the 'Buscar' link in the sidebar to open the staff search page.
        # Buscar link
        elem = page.get_by_text('Laburo.Production Portal', exact=True).locator("xpath=ancestor-or-self::*[.//a][1]").get_by_role('link', name='Buscar', exact=True)
        await elem.click(timeout=10000)
        
        # -> Type 'zzzz-notfound-1234' into the 'ID DE CANDIDATO, ROL O HABILIDAD' search field and submit the search by pressing Enter to produce no matches.
        # Buscar candidatos text field
        elem = page.get_by_label('Buscar candidatos', exact=True)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("zzzz-notfound-1234")
        
        # --> Assertions to verify final state
        
        # --> Verify a no-results state is visible
        # Assert: URL contains the search query that produced no results.
        await expect(page).to_have_url(re.compile("q=zzzz\\-notfound\\-1234"), timeout=15000), "URL contains the search query that produced no results."
        # Assert: Search input contains the query used to produce no results.
        await expect(page.locator("xpath=/html/body/div[2]/main/div/section/header/div/input").nth(0)).to_have_value("zzzz-notfound-1234", timeout=15000), "Search input contains the query used to produce no results."
        await page.locator("xpath=/html/body/div[2]/main/div/section/div[2]/button").nth(0).scroll_into_view_if_needed()
        # Assert: The 'Limpiar filtros' button is visible on the no-results page.
        await expect(page.locator("xpath=/html/body/div[2]/main/div/section/div[2]/button").nth(0)).to_be_visible(timeout=15000), "The 'Limpiar filtros' button is visible on the no-results page."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    