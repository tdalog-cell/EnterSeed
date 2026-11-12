"""Browser regression coverage against a disposable local Enterseed database.

Requires Python Playwright and Edge (or set BROWSER_CHANNEL).
Run with the webapp-testing with_server.py helper; see docs/interface-review.md.
Never point DATABASE_PATH at a real account database.
"""
import json
import os
from pathlib import Path
import re
import sqlite3
import uuid
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('TEST_BASE_URL', 'http://127.0.0.1:3200')
DATABASE = Path(os.environ['DATABASE_PATH']).resolve()
assert '.preview' in DATABASE.parts, 'Use an isolated .preview database.'
ARTIFACTS = Path('.preview/browser-results')
ARTIFACTS.mkdir(parents=True, exist_ok=True)
checks = []

def passed(name):
    checks.append(name)
    print('PASS:', name, flush=True)

def visit(page, route):
    page.goto(BASE + '/#' + route)
    page.wait_for_load_state('networkidle')
    page.locator('main h1, main h2').first.wait_for()

def capture(page, name):
    page.screenshot(path=str(ARTIFACTS / (name + '.png')), full_page=True)

def download(page, button, name):
    with page.expect_download() as event:
        button.click()
    target = ARTIFACTS / (name + Path(event.value.suggested_filename).suffix)
    event.value.save_as(str(target))
    assert target.stat().st_size > 10
    return target

with sync_playwright() as p:
    browser = p.chromium.launch(channel=os.environ.get('BROWSER_CHANNEL', 'msedge'), headless=True)
    context = browser.new_context(viewport={'width':1440, 'height':1000}, reduced_motion='reduce')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.set_default_timeout(12000)
    run_id = uuid.uuid4().hex[:8]
    email = f'owner-{run_id}@example.test'
    password = 'Browser-review-123!'
    try:
        # Real registration through the UI, not simulated account storage.
        visit(page, 'register')
        page.get_by_role('button', name='Welcome Continue in English English').click()
        page.get_by_label('First name', exact=True).fill('Review')
        page.get_by_label('Last name', exact=True).fill('Owner')
        page.get_by_label('Business name', exact=True).fill('Review Coffee')
        page.get_by_label('Email', exact=True).fill(email)
        page.get_by_label('Password', exact=True).fill(password)
        page.get_by_role('button', name='Show password').click()
        expect(page.get_by_label('Password', exact=True)).to_have_attribute('type', 'text')
        page.get_by_role('button', name='Hide password').click()
        page.get_by_role('checkbox').check()
        page.locator('form button[type=submit]').click()
        expect(page.get_by_role('heading', name='Mabuhay, Review.')).to_be_visible()
        passed('Account registration, password visibility, and authenticated routing')

        page.get_by_role('button', name='Start your financial checkup').click()
        dialog = page.get_by_role('dialog')
        for label, value in [('Monthly sales','30000'),('Monthly operating expenses','12000'),('Cash available now','54000')]:
            dialog.get_by_label(label, exact=True).fill(value)
        dialog.get_by_label('Tax registration status').select_option('current')
        dialog.get_by_role('checkbox').check()
        dialog.get_by_role('button',name='Save my checkup').click()
        expect(page.get_by_text('1 of 3 started',exact=True)).to_be_visible()
        page.reload(); page.wait_for_load_state('networkidle')
        expect(page.get_by_text('₱30,000',exact=True)).to_be_visible()
        passed('Financial checkup persists and dashboard progress reflects it')

        # Keyboard-only tool navigation and skip link must not mutate the route.
        page.get_by_role('link',name='Skip to content').focus()
        page.keyboard.press('Enter')
        assert page.url.endswith('#dashboard')
        expect(page.locator('#workspace-content')).to_be_focused()
        page.keyboard.press('Control+k')
        search = page.get_by_role('combobox',name='Find a workspace tool')
        search.fill('cash')
        search.press('Enter')
        expect(page.get_by_role('heading',name='Business finances')).to_be_visible()
        passed('Skip link and keyboard command search')

        page.get_by_label('Opening cash balance').fill('1000')
        page.get_by_label('Description',exact=True).fill('Browser test sale')
        page.get_by_label('Amount (PHP)',exact=True).fill('2500')
        page.get_by_role('button',name='Record Entry',exact=True).click()
        row=page.get_by_role('row').filter(has_text='Browser test sale')
        row.get_by_role('button',name='Edit entry').click()
        dialog=page.get_by_role('dialog')
        dialog.get_by_label('Amount (PHP)',exact=True).fill('3000.50')
        dialog.get_by_role('button',name='Save Changes').click()
        page.get_by_role('button',name='Save workspace',exact=True).click()
        expect(page.get_by_text('Workspace up to date',exact=True)).to_be_visible()
        page.reload(); page.wait_for_load_state('networkidle')
        expect(page.get_by_role('row').filter(has_text='Browser test sale')).to_contain_text('3,000.5')
        download(page,page.get_by_role('button',name='Export CSV'), 'finance-ledger')
        import_file=ARTIFACTS/'import-ledger.csv'
        transaction_date=page.get_by_label('Transaction date').input_value()
        import_file.write_text('Date,Type,Category,Description,Amount\n'+transaction_date+',Cash-Out,Packaging,Imported packaging,120.50\n',encoding='utf-8')
        page.locator('input[type=file]').set_input_files(str(import_file))
        imported=page.get_by_role('row').filter(has_text='Imported packaging')
        expect(imported).to_contain_text('120.5')
        imported.get_by_role('button',name='Delete entry').click()
        expect(imported).to_have_count(0)
        page.get_by_role('button',name='Save workspace',exact=True).click()
        expect(page.get_by_text('Workspace up to date',exact=True)).to_be_visible()
        passed('Cash ledger create, decimal edit, save, reload, CSV import/export, and deletion')

        page.get_by_role('button',name='Debt Management',exact=True).click()
        page.get_by_label('Lending Institution / Creditor').fill('Test cooperative')
        page.get_by_label('Principal Balance (PHP)').fill('10000')
        page.get_by_label('Monthly Payment (PHP)').fill('500')
        page.locator('form button[type=submit]').click()
        expect(page.get_by_text('Test cooperative',exact=True)).to_be_visible()
        page.get_by_role('button',name='Tax Checklist',exact=True).click()
        page.get_by_role('checkbox').first.check()
        page.get_by_role('button',name='Equipment ROI',exact=True).click()
        expect(page.get_by_role('heading',name='Investment Option A')).to_be_visible()
        page.get_by_label('Equipment / Purchase Name',exact=True).first.fill('Coffee grinder')
        page.get_by_label('Total Capital Cost (PHP)',exact=True).first.fill('12000')
        page.get_by_label('Est. Monthly Benefit (PHP)',exact=True).first.fill('1000')
        page.get_by_role('button',name='Financial Summaries',exact=True).click()
        page.get_by_role('button',name='Save workspace',exact=True).click()
        expect(page.get_by_text('Workspace up to date',exact=True)).to_be_visible()
        passed('Debt tracking, tax checklist, equipment comparison, and financial summaries')

        visit(page,'marketing')
        page.get_by_label('Product or offer').fill('Roasted coffee beans')
        page.get_by_label('Prices, pickup, and delivery').fill('250g for PHP 280, pickup in Tupi')
        for format_name in ['Facebook post','Promotional message','Price list']:
            page.get_by_role('button',name=re.compile('^'+format_name)).click()
            page.get_by_role('button',name='Create draft',exact=True).click()
            expect(page.get_by_role('button',name='Copy text')).to_be_enabled()
        page.reload(); page.wait_for_load_state('networkidle')
        expect(page.get_by_label('Product or offer')).to_have_value('Roasted coffee beans')
        expect(page.get_by_role('button',name='Copy text')).to_be_enabled()
        passed('All three marketing formats generate and survive reload')

        visit(page,'documents')
        page.get_by_label('Industry Sector').fill('Coffee retail')
        page.get_by_label('Target Customer Base & Market Reach').fill('Households and local cafes in Tupi')
        page.get_by_role('button',name='Create document draft').click()
        page.get_by_role('button',name='Save to Library').click()
        expect(page.get_by_text('Saved in Library',exact=True)).to_be_visible()
        download(page,page.get_by_role('button',name='PDF',exact=True),'business-plan')
        visit(page,'dashboard')
        expect(page.get_by_text('2 of 3 started',exact=True)).to_be_visible()
        page.get_by_label('Filter saved work').select_option('documents')
        page.locator('section[aria-labelledby=saved-work-title] li button').first.click()
        expect(page.get_by_text('Saved in Library',exact=True)).to_be_visible()
        passed('Document generation, library save, PDF export, and dashboard resume')
        for document_type in ['Feasibility Study','Loan Proposal']:
            page.get_by_role('radio',name=document_type,exact=True).click()
            page.get_by_label('Industry Sector').fill('Coffee retail')
            page.get_by_label('Target Customer Base & Market Reach').fill('Households and local cafes in Tupi')
            page.get_by_role('button',name='Create document draft').click()
            page.get_by_role('button',name='Save to Library').click()
            expect(page.get_by_text('Saved in Library',exact=True)).to_be_visible()
        page.get_by_role('button',name='Edit Text',exact=True).click()
        editor=page.get_by_label('Edit document content')
        editor.fill(editor.input_value()+'<p>Reviewed by the business owner.</p>')
        page.get_by_role('button',name='Done Editing',exact=True).click()
        page.get_by_role('button',name='Save to Library').click()
        expect(page.get_by_text('Saved in Library',exact=True)).to_be_visible()
        passed('Feasibility and loan drafts, document editing, and resaving')

        visit(page,'efiling')
        page.get_by_label('Registered Enterprise Name',exact=True).fill('Review Coffee Registered')
        page.get_by_role('button',name='Save preparation draft').click()
        expect(page.get_by_text(re.compile('Your preparation draft is saved'))).to_be_visible()
        page.reload(); page.wait_for_load_state('networkidle')
        expect(page.get_by_label('Registered Enterprise Name',exact=True)).to_have_value('Review Coffee Registered')
        page.get_by_role('button',name='Official Portals',exact=True).click()
        assert page.locator('main a[target=_blank]').count() >= 6
        page.get_by_role('button',name='Grants & Credit Matcher',exact=True).click()
        page.get_by_label('Business Sector',exact=True).fill('Coffee processing')
        with page.expect_response('**/api/referrals/subsidy-check') as result:
            page.get_by_role('button',name='Evaluate Grants & Subsidies').click()
        assert result.value.ok, result.value.text()
        page.get_by_role('radio',name='2. Bank & Microfinance Matcher').click()
        page.get_by_label('Desired Capital / Loan Amount (PHP)').fill('100000')
        page.get_by_label('Average Monthly Gross Revenue (PHP)').fill('30000')
        with page.expect_response('**/api/referrals/credit-match') as result:
            page.get_by_role('button',name='Match Credit Facilities').click()
        assert result.value.ok, result.value.text()
        passed('Grant and credit matcher forms return local results')
        visit(page,'dashboard')
        expect(page.get_by_text('3 of 3 started',exact=True)).to_be_visible()
        page.get_by_label('Filter saved work').select_option('efiling')
        expect(page.locator('section[aria-labelledby=saved-work-title]')).to_contain_text('Review Coffee Registered')
        capture(page,'owner-dashboard-desktop')
        passed('Registration draft save/reload, official links, and dashboard progress')

        visit(page,'boss-nana')
        page.get_by_role('button',name='How do I register a business name with DTI BNRS?').click()
        expect(page.get_by_role('button',name='Export Transcript (.TXT)')).to_be_visible()
        page.get_by_role('button',name=re.compile('Yes')).first.wait_for()
        download(page,page.get_by_role('button',name='Export Transcript (.TXT)'),'chat-transcript')
        passed('Boss Narra question, fallback response, and transcript export')

        # Owner submits a local application for the staff review journey.
        visit(page,'suppliers')
        page.get_by_role('button',name='List Your Business').click()
        dialog=page.get_by_role('dialog')
        for label,value in [('Business Name','Review Packaging '+run_id),('Contact Person','Test Applicant'),('Email for Staff Verification',email),('Products, Services & Order Minimums','Boxes for local coffee producers; minimum 100 pieces.')]:
            dialog.get_by_label(label,exact=True).fill(value)
        dialog.get_by_role('checkbox').check()
        dialog.get_by_role('button',name='Submit for Review').click()
        expect(dialog.get_by_role('button',name='Done')).to_be_visible()
        dialog.get_by_role('button',name='Done').click()
        passed('Supplier application submitted through the owner UI')

        visit(page,'about')
        page.get_by_label('Your name',exact=True).fill('Test Owner')
        page.get_by_label('Email',exact=True).fill(email)
        page.get_by_label('Topic',exact=True).fill('Browser review '+run_id)
        page.get_by_label('Message',exact=True).fill('Local browser test inquiry for the staff review queue.')
        page.get_by_role('checkbox').check()
        page.get_by_role('button',name='Send message',exact=True).click()
        expect(page.get_by_role('status')).to_be_visible()
        passed('Support inquiry saved to the local review queue')

        visit(page,'settings')
        page.get_by_role('radio',name=re.compile('^Dark')).click()
        expect(page.locator('html')).to_have_attribute('data-theme','dark')
        page.reload(); page.wait_for_load_state('networkidle')
        expect(page.locator('html')).to_have_attribute('data-theme','dark')
        capture(page,'settings-dark')
        page.get_by_role('radio',name=re.compile('^Light')).click()
        for label,code in [('Filipino','fil'),('Bisaya','ceb'),('Hiligaynon','hil'),('English','en')]:
            page.get_by_role('button',name=re.compile('^Language:')).first.click()
            with page.expect_response('**/api/auth/language') as language_response:
                page.get_by_role('menuitemradio',name=label,exact=True).click()
            assert language_response.value.ok
            page.reload(); page.wait_for_load_state('networkidle')
            expect(page.locator('html')).to_have_attribute('lang',code)
        passed('All four language choices persist to the signed-in account')
        passed('Theme selection and persistence')
        visit(page,'pricing')
        page.get_by_role('radio',name='Yearly',exact=True).click()
        expect(page.get_by_role('radio',name='Yearly',exact=True)).to_have_attribute('aria-checked','true')
        page.get_by_role('radio',name='Monthly',exact=True).click()
        passed('Pricing period controls')

        for route in ['dashboard','finance','marketing','suppliers','documents','efiling','boss-nana','settings','pricing','about','privacy','admin']:
            visit(page,route)
            page.set_viewport_size({'width':390,'height':844})
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), route+' overflows'
            capture(page,route+'-mobile')
            page.set_viewport_size({'width':1440,'height':1000})
        expect(page.get_by_role('heading',name='Staff Console Restricted')).to_be_visible()
        page.set_viewport_size({'width':390,'height':844})
        page.get_by_role('button',name='Open menu').click()
        expect(page.get_by_role('dialog',name='Menu')).to_be_visible()
        page.keyboard.press('Escape')
        expect(page.get_by_role('dialog',name='Menu')).to_have_count(0)
        page.set_viewport_size({'width':1440,'height':1000})
        passed('All 12 workspace routes at mobile width, mobile drawer, and owner staff-access guard')

        visit(page,'privacy')
        export_path=download(page,page.get_by_role('button',name='Export My Data',exact=True),'account-export')
        export=json.loads(export_path.read_text(encoding='utf-8'))
        assert 'marketingDraft' in export
        page.get_by_role('button',name='Delete My Data',exact=True).click()
        page.get_by_role('dialog').get_by_role('button',name='Cancel').click()
        passed('Privacy export includes saved work and account deletion can be canceled')

        # A verified staff fixture exists ONLY in the disposable local database.
        staff_email=f'staff-{run_id}@example.test'
        response=context.request.post(BASE+'/api/auth/register',data={'email':staff_email,'password':password,'firstName':'Review','lastName':'Staff','business':'Local review desk','municipality':'Tupi','agree':True})
        assert response.status == 201, response.text()
        staff_token=response.json()['sessionToken']
        with sqlite3.connect(DATABASE) as db:
            db.execute("UPDATE users SET role='staff', preferred_language='en' WHERE email=?",(staff_email,))
        staff_context=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce')
        staff_context.add_init_script('localStorage.setItem("enterseed_language","en");sessionStorage.setItem("enterseed_token",'+json.dumps(staff_token)+');')
        staff=staff_context.new_page()
        staff.on('pageerror',lambda error:errors.append(str(error)))
        visit(staff,'admin')
        expect(staff.get_by_role('tab',name=re.compile('^Applications'))).to_be_visible()
        expect(staff.get_by_label('Admin key')).to_have_count(0)
        staff.get_by_label('Search queue').fill(run_id)
        expect(staff.get_by_text('Review Packaging '+run_id,exact=True)).to_be_visible()
        staff.get_by_label('Search queue').fill('no-such-business')
        expect(staff.get_by_text(re.compile('No applications match'))).to_be_visible()
        staff.get_by_role('button',name='Clear filters').click()
        staff.get_by_label('Sort by').select_option('name')
        staff.get_by_role('button',name='Review and approve').last.click()
        dialog=staff.get_by_role('dialog')
        expect(dialog.get_by_role('button',name='Approve and publish')).to_be_disabled()
        for checkbox in dialog.get_by_role('checkbox').all(): checkbox.check()
        dialog.get_by_label('Review notes').fill('Identity, evidence, contact, location and consent checked in this isolated test.')
        dialog.get_by_role('button',name='Approve and publish').click()
        expect(staff.get_by_text('Application approved and published.',exact=True)).to_be_visible()
        passed('Staff account access, queue search/sort, five-check approval, and publication')

        visit(page,'suppliers')
        page.get_by_label('Search suppliers').fill(run_id)
        page.get_by_label('Filter category').select_option('packaging')
        page.get_by_label('Sort suppliers').select_option('name')
        page.get_by_role('button',name='Prepare inquiry',exact=True).click()
        dialog=page.get_by_role('dialog')
        dialog.get_by_label('Message & Requirements (Specifications, Volumes, Timelines)').fill('Please quote 100 boxes for our local coffee business.')
        dialog.get_by_role('button',name='Save inquiry',exact=True).click()
        expect(dialog.get_by_role('status')).to_contain_text('Inquiry saved')
        dialog.get_by_role('button',name='Cancel').click()
        page.get_by_role('button',name='Reviews',exact=True).click()
        dialog=page.get_by_role('dialog')
        dialog.get_by_role('button',name='Rate 4 stars').click()
        dialog.get_by_label('Your supplier review').fill('Isolated local test review of packaging quality.')
        dialog.get_by_role('button',name='Post Review').click()
        expect(dialog.get_by_role('status')).to_contain_text('Your review has been published')
        expect(dialog.get_by_text('4',exact=True)).to_be_visible()
        dialog.get_by_role('button',name='Close',exact=True).last.click()
        page.get_by_role('button',name='Show on map').click()
        expect(page.locator('.leaflet-container')).to_be_visible()
        slider=page.get_by_label('Monthly courier spend')
        slider.fill('2000')
        expect(page.get_by_text('₱350',exact=True)).to_be_visible()
        passed('Supplier filters, saved inquiry, review rating, map, and shipping calculator')

        response=context.request.post(BASE+'/api/supplier-applications',data={'businessName':'Rejected test '+run_id,'contactName':'Test Applicant','contactEmail':email,'publishContact':False,'category':'packaging','location':'Tupi','products':'Test boxes and packaging materials','consent':True})
        assert response.status==201,response.text()
        staff.get_by_role('button',name='Refresh',exact=True).click()
        staff.get_by_label('Search queue').fill('Rejected test '+run_id)
        staff.get_by_role('button',name='Reject',exact=True).click()
        dialog=staff.get_by_role('dialog')
        expect(dialog.get_by_role('button',name='Reject application')).to_be_disabled()
        dialog.get_by_label('Reason').fill('Missing commercial evidence in this test fixture.')
        dialog.get_by_role('button',name='Reject application').click()
        expect(staff.get_by_text('Application rejected.',exact=True)).to_be_visible()
        passed('Staff rejection requires a written reason and updates the queue')

        staff.get_by_role('tab',name=re.compile('^Suppliers')).click()
        staff.get_by_label('Search queue').fill(run_id)
        staff.get_by_label('Listing status').select_option('active')
        capture(staff,'staff-desktop')
        staff.set_viewport_size({'width':390,'height':844})
        assert not staff.evaluate('document.documentElement.scrollWidth > innerWidth')
        capture(staff,'staff-mobile')
        staff.set_viewport_size({'width':1440,'height':1000})
        staff.get_by_role('button',name='Withdraw',exact=True).click()
        staff.get_by_role('button',name='Yes',exact=True).click()
        expect(staff.get_by_text('Supplier withdrawn.',exact=True)).to_be_visible()
        staff.get_by_label('Listing status').select_option('withdrawn')
        expect(staff.get_by_role('row').filter(has_text='Review Packaging '+run_id)).to_be_visible()
        staff.get_by_role('tab',name=re.compile('^Inquiries')).click()
        staff.get_by_label('Search queue').fill(run_id)
        expect(staff.get_by_role('link',name='Reply by email')).to_have_attribute('href',re.compile('^mailto:'))
        staff.get_by_role('button',name='Delete',exact=True).click()
        staff.get_by_role('button',name='Yes',exact=True).click()
        expect(staff.get_by_text('Record deleted.',exact=True)).to_be_visible()
        passed('Staff listing status filters, withdrawal, inquiry review, and deletion')

        staff.route('**/api/admin/inquiries',lambda route:route.fulfill(status=503,content_type='application/json',body='{"error":"Test queue temporarily unavailable"}'))
        staff.get_by_role('button',name='Refresh',exact=True).click()
        expect(staff.get_by_role('alert')).to_contain_text('Test queue temporarily unavailable')
        staff.unroute('**/api/admin/inquiries')
        staff.get_by_role('button',name='Retry loading').click()
        expect(staff.get_by_role('tab',name=re.compile('^Applications'))).to_be_visible()
        passed('Staff HTTP failure is visible and retry recovers')

        # End the owner journey with logout / login and deletion of this test account.
        page.get_by_role('button',name='Account menu').click()
        page.get_by_role('menuitem',name=re.compile('Sign out|Log out')).click()
        page.get_by_label('Email',exact=True).fill(email)
        page.get_by_label('Password',exact=True).fill(password)
        page.locator('form button[type=submit]').click()
        expect(page.get_by_role('heading',name='Mabuhay, Review.')).to_be_visible()
        visit(page,'privacy')
        page.get_by_role('button',name='Delete My Data',exact=True).click()
        page.get_by_role('button',name='Yes, Delete My Data').click()
        expect(page.get_by_role('button',name='Account menu')).to_have_count(0)
        page.get_by_role('button',name='Sign in',exact=True).click()
        expect(page.get_by_role('heading',name='Sign in to your workspace')).to_be_visible()
        passed('Logout, login, and deletion of the isolated test account')

        assert not errors, errors
        passed('No browser JavaScript errors')
    except Exception:
        capture(page,'failure-owner')
        (ARTIFACTS/'failure-dom.txt').write_text(page.locator('body').inner_text(),encoding='utf-8')
        if 'staff' in locals():
            capture(staff,'failure-staff')
            (ARTIFACTS/'failure-staff-dom.txt').write_text(staff.locator('body').inner_text(),encoding='utf-8')
        raise
    finally:
        (ARTIFACTS/'results.json').write_text(json.dumps({'passed':checks,'errors':errors},indent=2),encoding='utf-8')
        browser.close()
