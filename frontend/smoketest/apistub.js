const SITES = [
  { id:'1', name:'Everton Engineering', url:'https://everton.example.co.za', status:'ONLINE',
    haVersion:'2025.7.2', latestVersion:'2025.8.0', updateAvailable:true, pendingUpdates:3,
    hasHaToken:true, haTokenStatus:'OK', haTokenMask:'eyJh…9f2c', entityCount:842, unavailableCount:12,
    integrationCount:41, automationCount:63, latencyMs:184, lastSeenAt:new Date().toISOString(),
    tags:['lodge','solar'], locationName:'Everton', backupFilename:'ha-backup.tar.gz',
    backupSize:734003200, haState:'RUNNING', group:'Gauteng', notes:'Solar inverter on Modbus.' },
  { id:'2', name:'Riverside Lodge', url:'https://river.example.co.za', status:'OFFLINE',
    hasHaToken:true, haTokenStatus:'UNAUTHORIZED', lastSeenAt:new Date(Date.now()-9e6).toISOString(), tags:[] },
  { id:'3', name:'New Install', url:'https://new.example.co.za', status:'UNKNOWN', hasHaToken:false, tags:[] },
  { id:'4', name:'Bushveld Cottage', url:'https://bush.example.co.za', status:'ONLINE',
    haVersion:'2025.8.0', hasHaToken:true, haTokenStatus:'OK', entityCount:210, integrationCount:18,
    automationCount:9, latencyMs:96, lastSeenAt:new Date().toISOString(), tags:['cottage'], haState:'RUNNING' },
];
const STATS = { total:4, online:2, offline:1, unknown:1, updatesAvailable:1, linked:3, userCount:2 };
const USERS = [
  { id:'u1', username:'marsh', email:'marsh@example.co.za', role:'ADMIN', active:true, lastLoginAt:new Date().toISOString(), clientIds:[] },
  { id:'u2', username:'tech', email:null, role:'USER', active:true, lastLoginAt:null, clientIds:['1','4'] },
];
const LOGS = { total:3, page:1, pageSize:50, items:[
  { id:'l1', level:'ERROR', category:'client', message:'Riverside Lodge became unreachable', createdAt:new Date().toISOString(), user:null },
  { id:'l2', level:'AUDIT', category:'user', message:'User created: tech (USER)', createdAt:new Date(Date.now()-3.6e6).toISOString(), user:{username:'marsh'} },
  { id:'l3', level:'INFO', category:'system', message:'Status sweep completed', createdAt:new Date(Date.now()-9e7).toISOString(), user:null },
]};

function match(url) {
  if (url.startsWith('/clients') && url.includes('/backup')) return { backup:{ filename:'ha-backup.tar.gz', size:734003200, uploadedAt:new Date().toISOString(), uploadedBy:'marsh' }, maxSize:838860800, key:{ content:'abcd-efgh', updatedAt:new Date().toISOString(), updatedBy:'marsh' } };
  if (url.startsWith('/clients')) return { clients: SITES };
  if (url.startsWith('/system/stats')) return STATS;
  if (url.startsWith('/system/update/status')) return { local:{version:'1.12.0'}, state:null, repo:'https://github.com/marsh4200/ha-hub.git' };
  if (url.startsWith('/users')) return { users: USERS };
  if (url.startsWith('/logs')) return LOGS;
  if (url.startsWith('/auth/me')) return { user:{ id:'u1', username:'marsh', role:'ADMIN' } };
  if (url.startsWith('/auth/setup-status')) return { needsSetup:false };
  return {};
}
const api = {
  get: async (url) => ({ data: match(url) }),
  post: async (url) => ({ data: { client: SITES[0] } }),
  patch: async () => ({ data: {} }),
  put: async () => ({ data: {} }),
  delete: async () => ({ data: { deleted: 0 } }),
};
export default api;
