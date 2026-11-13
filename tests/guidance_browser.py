"""Real UI journeys against the runner's disposable database; no production fixtures."""
import os, json, sqlite3, re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE=os.environ['TEST_BASE_URL']
DB=Path(os.environ['DATABASE_PATH']).resolve()
assert '.preview' in DB.parts
OUT=Path('.preview/guidance-browser'); OUT.mkdir(parents=True,exist_ok=True)
checks=[]
def passed(name):
    checks.append(name);print('PASS:',name,flush=True)
def visit(page,route):
    page.goto(BASE+'/#'+route);page.wait_for_load_state('networkidle')
def save(page,name):
    page.get_by_role('button',name=name,exact=True).click()
    expect(page.get_by_text('Saved to your account.',exact=True).first).to_be_visible()

with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True)
    owner=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce')
    page=owner.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    staff_context=browser.new_context(viewport={'width':1440,'height':1000})
    staff=staff_context.new_page();staff.on('pageerror',lambda e:errors.append(str(e)))
    try:
        visit(page,'register')
        page.get_by_role('button',name='Welcome Continue in English English').click()
        for label,value in [('First name','Pilot'),('Last name','Owner'),('Business name','Pilot Bakery'),('Email','pilot@example.test'),('Password','Browser-review-123!')]:page.get_by_label(label,exact=True).fill(value)
        page.get_by_role('checkbox').check();page.locator('form button[type=submit]').click()
        expect(page.get_by_role('heading',name='Mabuhay, Pilot.')).to_be_visible()
        page.get_by_role('button',name='Create business profile',exact=True).click()
        page.get_by_label('Business sector',exact=True).fill('Food')
        page.get_by_label('Business stage',exact=True).select_option('operating')
        page.get_by_label('Products or services',exact=True).fill('Bread')
        save(page,'Save business profile')
        expect(page.get_by_role('heading',name='Calculate product costs',exact=True)).to_be_visible()
        card=page.locator('section').filter(has=page.get_by_role('heading',name='Calculate product costs',exact=True)).last
        card.get_by_label('Action status').select_option('completed');save(card,'Save changes')
        page.reload();page.wait_for_load_state('networkidle')
        expect(page.get_by_label('Action status').first).to_have_value('completed')
        page.get_by_label('Primary goal').select_option('funding');save(page,'Save business profile')
        expect(page.get_by_role('heading',name='Explore reviewed opportunities')).to_be_visible()
        page.get_by_text('Action history and hidden actions',exact=True).click()
        expect(page.get_by_label('Action status').filter(has=page.locator('option:checked[value=completed]'))).to_have_count(1)
        passed('A: profile, three recommendations, completion persistence and preserved history')

        visit(page,'calendar')
        page.get_by_label('Reminder title').fill('Pay packaging supplier');page.get_by_label('Due date',exact=True).fill('2020-01-01')
        page.get_by_label('Category',exact=True).select_option('supplier');save(page,'Save reminder')
        expect(page.get_by_text('Overdue',exact=True).last).to_be_visible()
        page.get_by_role('button',name='Edit / reschedule').click();page.get_by_label('Due date',exact=True).fill('2099-01-01');save(page,'Save reminder')
        page.get_by_role('button',name='Complete',exact=True).click()
        expect(page.get_by_role('button',name='Reopen',exact=True)).to_be_visible()
        page.reload();page.wait_for_load_state('networkidle');expect(page.get_by_role('button',name='Reopen',exact=True)).to_be_visible()
        passed('B: overdue reminder, rescheduling, completion and reload')

        result=staff_context.request.post(BASE+'/api/auth/register',data={'email':'pilot-staff@example.test','password':'Browser-review-123!','firstName':'Pilot','lastName':'Staff','business':'Test desk','municipality':'Tupi','agree':True})
        assert result.ok
        with sqlite3.connect(DB) as db:db.execute("UPDATE users SET role='staff',preferred_language='en' WHERE email='pilot-staff@example.test'")
        staff_context.add_init_script('localStorage.setItem("enterseed_language","en")')
        visit(staff,'staff-opportunities')
        for label,value in [('Opportunity name','Pilot-only program'),('Provider','Fixture provider'),('Description','Synthetic browser fixture'),('Official source URL','https://example.test/program'),('Eligibility requirements','Fixture criteria'),('Geographic coverage','Tupi'),('Sector coverage','Food'),('Application procedure','Read fixture requirements'),('Application deadline','2099-01-01'),('Date last verified','2026-01-01')]:staff.get_by_label(label,exact=True).fill(value)
        staff.get_by_label('Verification status',exact=True).select_option('reviewed');staff.get_by_label('Publish reviewed listing').check();save(staff,'Save opportunity')
        visit(page,'opportunities');expect(page.get_by_role('heading',name='Pilot-only program')).to_be_visible()
        page.get_by_role('button',name='Save opportunity',exact=True).click()
        page.get_by_role('button',name='Create application reminder',exact=True).click()
        expect(page.get_by_role('heading',name='Business calendar')).to_be_visible()
        expect(page.get_by_role('heading',name='Pilot-only program')).to_be_visible()
        passed('C: staff review/publication, owner save and application reminder')

        visit(page,'support');page.get_by_label('Request title').fill('Help with pricing');page.get_by_label('Describe your concern').fill('How should I record delivery costs?');save(page,'Submit request')
        visit(staff,'staff-support');staff.get_by_role('button',name=re.compile('Help with pricing')).click()
        staff.get_by_label('Assigned staff').select_option(label='Pilot Staff');staff.locator('form').get_by_label('Request status').select_option('in_progress');save(staff,'Update request')
        staff.get_by_label('Your response',exact=True).fill('Staff-only confidential note');staff.get_by_label('Internal note — visible only to staff').check();save(staff,'Send response')
        staff.get_by_label('Your response',exact=True).fill('Include delivery in the transport field.');save(staff,'Send response')
        page.reload();page.wait_for_load_state('networkidle');page.get_by_role('button',name=re.compile('Help with pricing')).click()
        expect(page.get_by_text('Include delivery in the transport field.',exact=True)).to_be_visible()
        expect(page.get_by_text('Staff-only confidential note',exact=True)).to_have_count(0)
        passed('D: support submission, assignment, public reply and hidden internal note')

        visit(page,'costing');page.get_by_label('Calculation name').fill('Bread costing');page.get_by_label('Raw materials per batch').fill('100');page.get_by_label('Units produced').fill('10');page.get_by_label('Selling fee (% of revenue)').fill('10');save(page,'Save calculation')
        expect(page.get_by_text('₱14.29',exact=True)).to_be_visible()
        page.reload();page.wait_for_load_state('networkidle');page.get_by_role('button',name='Bread costing',exact=True).click();expect(page.get_by_label('Raw materials per batch')).to_have_value('100')
        visit(page,'quotations');page.get_by_label('Calculation name').fill('Flour comparison');page.get_by_label('Required quantity').fill('50')
        for i in range(2):
            page.get_by_label('Supplier name',exact=True).nth(i).fill('Supplier '+str(i+1));page.get_by_label('Product name',exact=True).nth(i).fill('Flour')
            page.get_by_label('Quoted unit price',exact=True).nth(i).fill(str(5+i));page.get_by_label('Payment terms',exact=True).nth(i).fill('Cash on delivery')
        save(page,'Save calculation');expect(page.get_by_text('₱250.00',exact=True)).to_be_visible()
        page.get_by_role('button',name='Use purchase cost in costing').first.click();expect(page.get_by_label('Raw materials per batch')).to_have_value('250')
        passed('E: fee-aware costing, saved calculations, quote comparison and costing handoff')

        for route in ['plan','calendar','support','opportunities','costing','quotations','guides']:
            page.set_viewport_size({'width':390,'height':844});visit(page,route)
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'),route
            assert page.locator('main h1').count()==1,route
            page.screenshot(path=str(OUT/(route+'-mobile.png')),full_page=True)
        for route in ['staff-support','staff-opportunities','staff-metrics']:
            staff.set_viewport_size({'width':390,'height':844});visit(staff,route)
            assert not staff.evaluate('document.documentElement.scrollWidth > innerWidth'),route
            staff.screenshot(path=str(OUT/(route+'-mobile.png')),full_page=True)
        page.set_viewport_size({'width':1440,'height':1000});visit(page,'plan')
        page.get_by_label('Preferred language',exact=True).select_option('fil');page.get_by_role('button',name='Save business profile',exact=True).click()
        expect(page.get_by_role('heading',name='Plano ng aking negosyo',exact=True)).to_be_visible()
        visit(page,'calendar');expect(page.get_by_role('heading',name='Kalendaryo ng negosyo',exact=True)).to_be_visible()
        page.get_by_label('Pamagat ng paalala',exact=True).fill('Paalala sa negosyo');page.get_by_role('button',name='I-save ang paalala',exact=True).click()
        expect(page.get_by_text('Na-save sa iyong account.',exact=True)).to_be_visible()
        page.screenshot(path=str(OUT/'filipino-calendar.png'),full_page=True)
        passed('Mobile layouts on all new routes; Filipino profile and reminder flow')
        assert not errors,errors
        passed('No JavaScript page errors')
    except Exception:
        page.screenshot(path=str(OUT/'failure-owner.png'),full_page=True)
        staff.screenshot(path=str(OUT/'failure-staff.png'),full_page=True)
        (OUT/'failure-owner.txt').write_text(page.locator('body').inner_text(),encoding='utf-8')
        raise
    finally:
        (OUT/'results.json').write_text(json.dumps({'passed':checks,'errors':errors},indent=2))
        browser.close()
