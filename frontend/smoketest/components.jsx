import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import ClientCard from '../src/components/ClientCard.jsx';
import SiteRow from '../src/components/SiteRow.jsx';
import FleetOverview from '../src/components/FleetOverview.jsx';
import VersionChip from '../src/components/VersionChip.jsx';
import StatusBadge from '../src/components/StatusBadge.jsx';
import AuthLayout from '../src/components/AuthLayout.jsx';
import { BrandLockup } from '../src/components/BrandMark.jsx';
import * as UI from '../src/components/ui/index.js';

const sites = [
  { id:'1', name:'Everton Engineering', url:'https://everton.example.co.za', status:'ONLINE',
    haVersion:'2025.7.2', latestVersion:'2025.8.0', updateAvailable:true, pendingUpdates:3,
    hasHaToken:true, haTokenStatus:'OK', entityCount:842, unavailableCount:12, integrationCount:41,
    automationCount:63, latencyMs:184, lastSeenAt:new Date().toISOString(), tags:['lodge','solar'],
    locationName:'Everton', backupFilename:'backup.tar.gz', backupSize:734003200, haState:'RUNNING' },
  { id:'2', name:'Offline Site', url:'https://down.example.co.za', status:'OFFLINE',
    hasHaToken:true, haTokenStatus:'UNAUTHORIZED', lastSeenAt:new Date(Date.now()-9e6).toISOString(), tags:[] },
  { id:'3', name:'Never Checked', url:'https://new.example.co.za', status:'UNKNOWN', hasHaToken:false, tags:[] },
];

const checks = [];
function check(name, node) {
  try { renderToString(<MemoryRouter>{node}</MemoryRouter>); checks.push(['ok', name]); }
  catch (e) { checks.push(['FAIL', name + ' :: ' + e.message]); }
}

sites.forEach(s => {
  check('ClientCard ' + s.name, <ClientCard client={s} now={Date.now()} canRefresh />);
  check('SiteRow ' + s.name, <SiteRow client={s} now={Date.now()} canRefresh />);
  check('VersionChip ' + s.name, <VersionChip client={s} />);
  check('StatusBadge ' + s.name, <StatusBadge status={s.status} />);
});

check('FleetOverview', <FleetOverview stats={{total:3,online:1,offline:1,unknown:1,linked:2}} attention={1} updates={1} filter="all" onFilter={()=>{}} />);
check('FleetOverview empty', <FleetOverview stats={{total:0}} attention={0} updates={0} filter="all" onFilter={()=>{}} loading />);
check('AuthLayout', <AuthLayout><div>form</div></AuthLayout>);
check('BrandLockup', <BrandLockup />);
check('Button', <UI.Button variant="primary" icon={undefined}>Go</UI.Button>);
check('IconButton', <UI.IconButton icon={() => null} label="x" />);
check('StatTile', <UI.StatTile label="Online" value="12" tone="live" onClick={()=>{}} />);
check('EmptyState', <UI.EmptyState title="Nothing" description="d" />);
check('Alert', <UI.Alert tone="warning" title="t">body</UI.Alert>);
check('ProgressBar', <UI.ProgressBar value={42} showValue label="Uploading" />);
check('Table', <UI.TableWrap label="t"><UI.Table><UI.THead><UI.TR><UI.TH>A</UI.TH></UI.TR></UI.THead><UI.TBody><UI.TR><UI.TD>1</UI.TD></UI.TR></UI.TBody></UI.Table></UI.TableWrap>);
check('Field', <UI.Field label="L" hint="h">{(a)=><UI.Input {...a} />}</UI.Field>);
check('Field error', <UI.Field label="L" error="bad">{(a)=><UI.Input {...a} />}</UI.Field>);
check('Select', <UI.Select><option>a</option></UI.Select>);
check('PasswordInput', <UI.PasswordInput />);
check('Checkbox', <UI.Checkbox label="l" description="d" />);
check('SearchInput', <UI.SearchInput value="" onChange={()=>{}} />);
check('SegmentedControl', <UI.SegmentedControl value="a" onChange={()=>{}} options={[{value:'a',label:'A'},{value:'b',label:'B'}]} />);
check('FilterChip', <UI.FilterChip label="All" count={3} active onClick={()=>{}} />);
check('PageHeader', <UI.PageHeader kicker="K" title="T" description="d" />);
check('SectionHeader', <UI.SectionHeader label="L" count={2} />);

const fails = checks.filter(c => c[0] === 'FAIL');
console.log(`${checks.length - fails.length}/${checks.length} rendered`);
fails.forEach(f => console.log('  ' + f[1]));
process.exit(fails.length ? 1 : 0);
