"""Check grouped navigation and the dashboard/supplier alignment regressions."""
import json
import os
import sqlite3
from pathlib import Path
from playwright.sync_api import sync_playwright, expect, TimeoutError as PlaywrightTimeout

BASE = os.environ['TEST_BASE_URL']
DB = Path(os.environ['DATABASE_PATH']).resolve()
assert '.preview' in DB.parts
OUT = Path('.preview/navigation-browser')
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    context = browser.new_context(viewport={'width':1920,'height':1080}, reduced_motion='reduce')
    created = context.request.post(BASE+'/api/auth/register', data={
        'email':'navigation@example.test','password':'Navigation-test-123!',
        'firstName':'Navigation','lastName':'Review','business':'Layout test',
        'municipality':'Tupi','agree':True
    })
    assert created.ok
    context.add_init_script('localStorage.setItem("enterseed_language","en")')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    def visit(route):
        page.goto(BASE+'/#'+route)
        try:
            page.wait_for_load_state('networkidle',timeout=10000)
        except PlaywrightTimeout:
            page.locator('main h1').wait_for()
    try:
        visit('dashboard')
        page.screenshot(path=str(OUT/'dashboard-desktop.png'),full_page=True)
        overview=page.get_by_role('region',name='Business action overview')
        expect(overview.get_by_role('heading',name='Build your business action plan')).to_be_visible()
        expect(overview.get_by_role('progressbar')).to_have_count(0)
        assert '0/0' not in overview.inner_text()
        headings=overview.get_by_role('heading',name='Recommended next actions').bounding_box()
        reminders=overview.get_by_role('button',name='Upcoming reminders').bounding_box()
        assert abs(headings['y']-reminders['y'])<4
        nav=page.get_by_role('navigation',name='Primary navigation',exact=True)
        assert nav.get_by_role('button').count()==6  # Dashboard + five collapsed categories
        market=nav.get_by_role('button',name='Markets & suppliers',exact=True)
        market.focus();page.keyboard.press('Enter')
        expect(market).to_have_attribute('aria-expanded','true')
        quote=nav.get_by_role('button',name='Supplier quotation comparison',exact=True)
        assert quote.evaluate('(el)=>getComputedStyle(el).textAlign')=='left'
        quote.click()
        expect(quote).to_have_attribute('aria-current','page')
        page.reload();page.wait_for_load_state('networkidle')
        expect(nav.get_by_role('button',name='Markets & suppliers',exact=True)).to_have_attribute('aria-expanded','true')
        finance=nav.get_by_role('button',name='Finance',exact=True)
        finance.click()
        expect(nav.get_by_role('button',name='Markets & suppliers',exact=True)).to_have_attribute('aria-expanded','false')
        page.keyboard.press('Control+k')
        search=page.get_by_role('combobox',name='Find a workspace tool')
        search.fill('Supplier Network');search.press('Enter')
        expect(page.get_by_role('heading',name='Local Suppliers',exact=True)).to_be_visible()
        expect(nav.get_by_role('button',name='Markets & suppliers',exact=True)).to_have_attribute('aria-expanded','true')
        page.screenshot(path=str(OUT/'suppliers-desktop.png'),full_page=True)
        heading=page.get_by_role('heading',name='Local Suppliers',exact=True)
        lead=page.get_by_text('Find reviewed producers, packaging specialists, and logistics partners across South Cotabato.',exact=True)
        assert lead.bounding_box()['width']>400
        assert abs(heading.bounding_box()['x']-lead.bounding_box()['x'])<2
        assert page.get_by_role('button',name='Compare supplier quotations',exact=True).bounding_box()['y']>heading.bounding_box()['y']
        assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
        print('PASS: desktop alignment, grouped keyboard navigation, active route expansion and search',flush=True)

        # A populated plan uses a thin, styled progress track and the same aligned rows.
        result=context.request.put(BASE+'/api/guidance/profile',data={
            'businessName':'Layout test','sector':'Food','stage':'operating','size':'micro',
            'location':'Tupi','products':'Bread','goal':'profit','challenges':'','language':'en'
        })
        assert result.ok
        visit('dashboard')
        expect(page.get_by_role('region',name='Business action overview').get_by_role('progressbar')).to_be_visible()
        assert page.get_by_role('region',name='Business action overview').get_by_role('progressbar').bounding_box()['height']==6
        page.screenshot(path=str(OUT/'dashboard-populated.png'),full_page=True)

        for width in [768,390]:
            page.set_viewport_size({'width':width,'height':844})
            for route in ['dashboard','suppliers','quotations']:
                visit(route)
                assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),(width,route)
                page.screenshot(path=str(OUT/f'{route}-{width}.png'),full_page=True)
        page.get_by_role('button',name='Open menu',exact=True).click()
        drawer=page.get_by_role('dialog',name='Menu',exact=True)
        expect(drawer.get_by_role('button',name='Markets & suppliers',exact=True)).to_have_attribute('aria-expanded','true')
        drawer.get_by_role('button',name='Business management',exact=True).click()
        expect(drawer.get_by_role('button',name='Markets & suppliers',exact=True)).to_have_attribute('aria-expanded','false')
        drawer.get_by_role('button',name='Business calendar',exact=True).click()
        expect(drawer).to_have_count(0)
        expect(page.get_by_role('heading',name='Business calendar',exact=True)).to_be_visible()
        page.get_by_role('button',name='Open menu',exact=True).click()
        page.screenshot(path=str(OUT/'mobile-navigation.png'),full_page=True)
        page.keyboard.press('Escape');expect(drawer).to_have_count(0)
        print('PASS: populated dashboard, tablet/mobile layouts and mobile accordion navigation',flush=True)

        with sqlite3.connect(DB) as db:
            db.execute("UPDATE users SET role='staff' WHERE email='navigation@example.test'")
        page.set_viewport_size({'width':1440,'height':1000})
        visit('staff-support')
        page.reload();page.get_by_role('heading',name='Staff follow-up desk',exact=True).wait_for()
        expect(nav.get_by_role('button',name='Staff tools',exact=True)).to_have_attribute('aria-expanded','true')
        expect(nav.get_by_role('button',name='Staff follow-up desk',exact=True)).to_have_attribute('aria-current','page')
        assert not errors,errors
        print('PASS: role-aware staff group and no JavaScript errors',flush=True)
    finally:
        page.screenshot(path=str(OUT/'last-state.png'),full_page=True)
        (OUT/'last-state.txt').write_text(page.locator('body').inner_text(),encoding='utf-8')
        (OUT/'results.json').write_text(json.dumps({'errors':errors},indent=2))
        browser.close()
