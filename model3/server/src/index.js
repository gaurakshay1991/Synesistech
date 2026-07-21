import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import OpenAI from 'openai';
import { z } from 'zod';
import { config, assertProductionConfig } from './config.js';
import {
  organizationId, initializeStorage, getUserByEmail, getUserById, touchLogin,
  updatePassword, listUsers, createUser, setUserActive, getState, mutateState,
  saveDocument, listDocuments, getDocument, updateDocumentStatus, logAudit,
  listAudit, healthStorage
} from './db.js';
import { extractText, analyzeDocument, answerDocumentQuestion } from './analysis.js';

assertProductionConfig();
await initializeStorage();

const app = express();
const SESSION_COOKIE = 'synesis_model3_session';
const openai = config.openaiKey ? new OpenAI({ apiKey: config.openaiKey, timeout: 90000, maxRetries: 1 }) : null;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1, fields: 20 } });
const roles = ['admin','legal','compliance','kyc','risk','business','operations','cyber','procurement','audit','management'];
const route = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);

const loginSchema = z.object({ email:z.string().email(), password:z.string().min(8).max(256) });
const passwordSchema = z.object({ currentPassword:z.string().min(8), newPassword:z.string().min(12).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/) });
const userSchema = z.object({ name:z.string().trim().min(2).max(120), email:z.string().email(), role:z.enum(roles), temporaryPassword:z.string().min(12) });
const questionSchema = z.object({ question:z.string().trim().min(3).max(2000) });

function parse(schema,value) {
  const result=schema.safeParse(value);
  if(result.success) return result.data;
  throw Object.assign(new Error(result.error.issues.map(x=>x.message).join(' ')),{status:400});
}

function publicUser(user) {
  if(!user) return null;
  return { id:user.id,name:user.name,email:user.email,role:user.role,isActive:Boolean(user.is_active),mustChangePassword:Boolean(user.must_change_password),createdAt:user.created_at,lastLoginAt:user.last_login_at };
}

function tokenFor(user) {
  return jwt.sign({ sub:user.id,org:user.organization_id,role:user.role,email:user.email,name:user.name },config.jwtSecret,{ expiresIn:'8h',issuer:'synesis-model3',audience:'synesis-web' });
}
function setCookie(res,token) { res.cookie(SESSION_COOKIE,token,{ httpOnly:true,secure:config.secureCookie,sameSite:'strict',maxAge:8*60*60*1000,path:'/' }); }
function clearCookie(res) { res.clearCookie(SESSION_COOKIE,{ httpOnly:true,secure:config.secureCookie,sameSite:'strict',path:'/' }); }

async function auth(req,res,next) {
  try {
    const raw=req.cookies?.[SESSION_COOKIE]||String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
    if(!raw) return res.status(401).json({error:'Login required.'});
    const claims=jwt.verify(raw,config.jwtSecret,{issuer:'synesis-model3',audience:'synesis-web'});
    const user=await getUserById(claims.sub);
    if(!user?.is_active){clearCookie(res);return res.status(401).json({error:'Account inactive.'});}
    req.user=user; req.orgId=user.organization_id;
    const setup=['/api/auth/session','/api/auth/logout','/api/auth/change-password'].includes(req.path);
    if(user.must_change_password&&!setup) return res.status(428).json({error:'Change the temporary password before using Synesis.'});
    next();
  } catch(error){clearCookie(res);return res.status(401).json({error:'Session expired or invalid.'});}
}
function allow(...allowed){return(req,res,next)=>allowed.includes(req.user?.role)?next():res.status(403).json({error:'Your role cannot perform this action.'});}
async function audit(req,action,entityType=null,entityId=null,metadata={}){await logAudit({orgId:req.orgId,user:req.user,action,entityType,entityId,metadata});}
function clean(value,fallback='',max=300){return String(value??fallback).trim().slice(0,max);}
function recalc(state){state.metrics.attention=state.tasks.filter(x=>x.status!=='Completed').length+state.decisions.filter(x=>!String(x.status).startsWith('Approved')).length;state.metrics.critical=state.obligations.filter(x=>x.risk==='Critical'&&x.status!=='Completed').length;state.metrics.decisionsPending=state.decisions.filter(x=>!String(x.status).startsWith('Approved')&&x.status!=='Rejected').length;state.metrics.controlsAtRisk=state.controls.filter(x=>x.effectiveness<70).length;state.metrics.evidenceCoverage=state.evidence.length?Math.round(state.evidence.filter(x=>x.status==='Verified').length/state.evidence.length*100):0;return state;}

async function appendAnalysis(orgId,document,analysis){
  return mutateState(orgId,state=>{
    for(const [index,item] of (analysis.obligations||[]).entries()) state.obligations.unshift({id:crypto.randomUUID(),title:item.title||`Document obligation ${index+1}`,type:item.type||'Contractual',source:document.title,sourceRef:item.source_reference||'Document analysis',owner:item.owner||'Legal',due:item.deadline||'To be determined',status:'Assessment',risk:item.risk||analysis.overall_risk,evidence:0,controls:[]});
    for(const [index,item] of (analysis.required_actions||[]).entries()) state.tasks.unshift({id:crypto.randomUUID(),title:item.title||`Required action ${index+1}`,owner:item.owner||'Matter owner',due:item.due||'To be determined',status:'Not started',priority:analysis.overall_risk,blocker:'',evidenceRequired:item.evidence_required||[]});
    for(const item of (analysis.decision_questions||[])) state.decisions.unshift({id:crypto.randomUUID(),title:item.question||'Decision required',matter:document.matter,risk:analysis.overall_risk,status:'Pending',owner:item.owner||'Management',due:'To be determined',rationale:analysis.recommended_decision,approvals:[]});
    const docNode={id:`doc-${document.id}`,label:document.title,type:'Evidence',risk:analysis.overall_risk};
    if(!state.graph.nodes.some(x=>x.id===docNode.id)) state.graph.nodes.push(docNode);
    recalc(state); return state;
  });
}

async function institutionalAnswer(state,question){
  if(openai){const response=await openai.responses.create({model:config.openaiModel,max_output_tokens:1200,input:`You are Synesis institutional intelligence. Answer from the governed state below. Distinguish evidence from inference, state uncertainty, and never authorise autonomous high-risk action.\nQUESTION:${question}\nSTATE:${JSON.stringify(state)}`});return{answer:response.output_text,engine:`Synesis live institutional Q&A (${config.openaiModel})`};}
  const q=question.toLowerCase();
  if(q.includes('control')) return{answer:`Weakest controls: ${state.controls.slice().sort((a,b)=>a.effectiveness-b.effectiveness).slice(0,3).map(x=>`${x.id} ${x.name} (${x.effectiveness}%)`).join('; ')}.`,engine:'Deterministic institutional-state answer'};
  if(q.includes('evidence')) return{answer:`${state.evidence.filter(x=>x.status!=='Verified').length} evidence items are not verified. Coverage is ${state.metrics.evidenceCoverage}%.`,engine:'Deterministic institutional-state answer'};
  if(q.includes('block')) return{answer:state.tasks.filter(x=>x.blocker).map(x=>`${x.title}: ${x.blocker}`).join('\n')||'No explicit blockers are recorded.',engine:'Deterministic institutional-state answer'};
  return{answer:`${state.metrics.attention} items require attention, including ${state.metrics.critical} critical obligations and ${state.metrics.decisionsPending} pending decisions. Resolve approval gates, blocked remediation and missing evidence first.`,engine:'Deterministic institutional-state answer'};
}

app.disable('x-powered-by');
app.use((req,res,next)=>{req.requestId=req.get('x-request-id')||crypto.randomUUID();res.set('x-request-id',req.requestId);next();});
app.use(helmet({crossOriginResourcePolicy:{policy:'same-origin'},contentSecurityPolicy:false}));
app.use(cors({credentials:true,origin:true}));
app.use((req,res,next)=>{if(['GET','HEAD','OPTIONS'].includes(req.method))return next();const origin=req.get('origin');if(!origin)return next();try{const originHost=new URL(origin).host;const requestHost=req.get('x-forwarded-host')||req.get('host');if(originHost===requestHost||config.clientOrigins.some(x=>new URL(x).host===originHost))return next();}catch{}return res.status(403).json({error:'Request origin is not allowed.'});});
app.use(cookieParser());
app.use(express.json({limit:'3mb'}));
app.use(express.urlencoded({extended:true,limit:'3mb'}));
app.use(rateLimit({windowMs:60000,max:300,standardHeaders:true,legacyHeaders:false}));
const loginLimiter=rateLimit({windowMs:15*60000,max:12,standardHeaders:true,legacyHeaders:false});

app.get('/api/health',(req,res)=>res.json({ok:true,product:'SYNESIS NEW MODEL 3.0',version:'3.0.0',ai:openai?'live-multipass-configured':'explicit-fallback-only',storage:healthStorage(),time:new Date().toISOString()}));
app.post('/api/auth/login',loginLimiter,route(async(req,res)=>{const body=parse(loginSchema,req.body);const user=await getUserByEmail(body.email);if(!user?.is_active||!await bcrypt.compare(body.password,user.password_hash))return res.status(401).json({error:'Invalid email or password.'});await touchLogin(user.id);setCookie(res,tokenFor(user));await logAudit({orgId:user.organization_id,user,action:'auth.login'});res.json({user:publicUser(await getUserById(user.id))});}));
app.get('/api/auth/session',auth,(req,res)=>res.json({user:publicUser(req.user)}));
app.post('/api/auth/logout',auth,route(async(req,res)=>{await audit(req,'auth.logout');clearCookie(res);res.json({ok:true});}));
app.post('/api/auth/change-password',auth,route(async(req,res)=>{const body=parse(passwordSchema,req.body);if(!await bcrypt.compare(body.currentPassword,req.user.password_hash))return res.status(400).json({error:'Current password is incorrect.'});await updatePassword(req.user.id,await bcrypt.hash(body.newPassword,12));const user=await getUserById(req.user.id);setCookie(res,tokenFor(user));await audit(req,'auth.password.changed');res.json({user:publicUser(user)});}));

app.get('/api/bootstrap',auth,route(async(req,res)=>res.json({user:publicUser(req.user),state:recalc(await getState(req.orgId)),documents:await listDocuments(req.orgId,200)})));
app.get('/api/documents',auth,route(async(req,res)=>res.json({documents:await listDocuments(req.orgId,Math.min(300,Number(req.query.limit||100)))})));
app.get('/api/documents/:id',auth,route(async(req,res)=>{const document=await getDocument(req.orgId,req.params.id,false);if(!document)return res.status(404).json({error:'Document not found.'});res.json({document});}));
app.post('/api/documents/analyze',auth,allow(...roles),upload.single('file'),route(async(req,res)=>{const extracted=await extractText(req.file,req.body.text);const options={title:clean(req.body.title,extracted.fileName.replace(/\.[^.]+$/,''),'200'),matter:clean(req.body.matter,'General review',200),documentType:clean(req.body.documentType,'Auto-detect',100),jurisdiction:clean(req.body.jurisdiction,'India',80),riskAppetite:clean(req.body.riskAppetite,'Conservative',60),analysisMode:clean(req.body.analysisMode,'Deep',30),objective:clean(req.body.objective,'Identify obligations, decisions, impacts and actions.',800)};const analysis=await analyzeDocument({client:openai,model:config.openaiModel,text:extracted.text,options});const document=await saveDocument({orgId:req.orgId,userId:req.user.id,title:options.title,fileName:extracted.fileName,mimeType:extracted.mimeType,hash:extracted.hash,documentType:options.documentType,jurisdiction:options.jurisdiction,matter:options.matter,sourceText:extracted.text,analysis});const state=await appendAnalysis(req.orgId,document,analysis);await audit(req,'document.analysed','document',document.id,{engine:analysis.engine,risk:analysis.overall_risk});res.status(201).json({document:{...document,analysis},state});}));
app.post('/api/documents/:id/ask',auth,route(async(req,res)=>{const {question}=parse(questionSchema,req.body);const document=await getDocument(req.orgId,req.params.id,true);if(!document)return res.status(404).json({error:'Document not found.'});const answer=await answerDocumentQuestion({client:openai,model:config.openaiModel,document,question});res.json({answer,engine:openai?`Synesis document Q&A (${config.openaiModel})`:'Document-analysis fallback'});}));
app.post('/api/ask',auth,route(async(req,res)=>{const {question}=parse(questionSchema,req.body);res.json(await institutionalAnswer(await getState(req.orgId),question));}));
app.patch('/api/documents/:id/status',auth,route(async(req,res)=>{const status=clean(req.body.status,'In Legal Review',80);const document=await updateDocumentStatus(req.orgId,req.params.id,status);if(!document)return res.status(404).json({error:'Document not found.'});await audit(req,'document.status.changed','document',document.id,{status});res.json({document});}));

app.patch('/api/decisions/:id',auth,route(async(req,res)=>{const status=clean(req.body.status,'Challenge',80);const note=clean(req.body.approvalNote,'',2000);if(['Approved','Approved with controls','Rejected'].includes(status)&&note.length<12)return res.status(400).json({error:'Record a substantive approval or rejection note.'});const state=await mutateState(req.orgId,s=>{const item=s.decisions.find(x=>x.id===req.params.id);if(!item)throw Object.assign(new Error('Decision not found.'),{status:404});item.status=status;item.approvalNote=note;item.decidedBy=req.user.email;item.decidedAt=new Date().toISOString();recalc(s);return s;});await audit(req,'decision.updated','decision',req.params.id,{status});res.json({state});}));
app.patch('/api/tasks/:id',auth,route(async(req,res)=>{const status=clean(req.body.status,'In progress',80);const state=await mutateState(req.orgId,s=>{const item=s.tasks.find(x=>x.id===req.params.id);if(!item)throw Object.assign(new Error('Task not found.'),{status:404});item.status=status;item.updatedAt=new Date().toISOString();recalc(s);return s;});await audit(req,'task.updated','task',req.params.id,{status});res.json({state});}));
app.post('/api/evidence',auth,route(async(req,res)=>{const title=clean(req.body.title,'',200),entity=clean(req.body.entity,'',200);if(!title||!entity)return res.status(400).json({error:'Evidence title and linked entity are required.'});const state=await mutateState(req.orgId,s=>{s.evidence.unshift({id:crypto.randomUUID(),title,entity,status:'Pending verification',verifiedBy:null,date:new Date().toISOString(),note:clean(req.body.note,'',1000)});recalc(s);return s;});await audit(req,'evidence.created','evidence',null,{title,entity});res.status(201).json({state});}));
app.patch('/api/evidence/:id',auth,allow('admin','legal','compliance','risk','audit','management'),route(async(req,res)=>{const status=clean(req.body.status,'Verified',40),note=clean(req.body.note,'',1000);const state=await mutateState(req.orgId,s=>{const item=s.evidence.find(x=>x.id===req.params.id);if(!item)throw Object.assign(new Error('Evidence not found.'),{status:404});item.status=status;item.verificationNote=note;item.verifiedBy=req.user.email;item.verifiedAt=new Date().toISOString();recalc(s);return s;});await audit(req,'evidence.verified','evidence',req.params.id,{status});res.json({state});}));
app.post('/api/simulations',auth,route(async(req,res)=>{const name=clean(req.body.name,'',200),probability=Math.max(1,Math.min(100,Number(req.body.probability||30))),impact=Math.max(1,Math.min(100,Number(req.body.impact||70)));if(!name)return res.status(400).json({error:'Scenario name is required.'});const readiness=Math.max(20,Math.min(95,Math.round(100-(probability*.35+impact*.45))));const simulation={id:crypto.randomUUID(),name,probability,impact,readiness,recommendation:readiness<55?'Create an immediate governed response plan and resolve control gaps.':'Document triggers, owners, communications and completion evidence.'};const state=await mutateState(req.orgId,s=>{s.simulations.unshift(simulation);return s;});await audit(req,'simulation.completed','simulation',simulation.id,{readiness});res.status(201).json({simulation,state});}));
app.post('/api/simulations/:id/response-plan',auth,route(async(req,res)=>{const state=await mutateState(req.orgId,s=>{const sim=s.simulations.find(x=>x.id===req.params.id);if(!sim)throw Object.assign(new Error('Simulation not found.'),{status:404});s.tasks.unshift({id:crypto.randomUUID(),title:`Response plan: ${sim.name}`,owner:'Risk / Business Continuity',due:'To be determined',status:'Not started',priority:sim.impact>=80?'Critical':'High',blocker:'Confirm accountable owners and approval gates',evidenceRequired:['Approved response plan','Test evidence','Closure attestation']});recalc(s);return s;});await audit(req,'simulation.response-plan.created','simulation',req.params.id);res.status(201).json({state});}));
app.post('/api/regulatory-change',auth,allow('admin','legal','compliance','risk','audit','management'),route(async(req,res)=>{const title=clean(req.body.title,'',220);if(!title)return res.status(400).json({error:'Change title is required.'});const state=await mutateState(req.orgId,s=>{s.impacts.unshift({id:crypto.randomUUID(),title,source:clean(req.body.source,'Controlled source pending verification',180),effectiveDate:clean(req.body.effectiveDate,'To be determined',40),severity:clean(req.body.severity,'High',20),status:'New impact assessment',affected:{documents:0,controls:0,products:0,vendors:0,systems:0,teams:0},confidence:50});return s;});await audit(req,'regulatory-change.registered','change',null,{title});res.status(201).json({state});}));
app.get('/api/reports/assurance-pack',auth,allow('admin','legal','compliance','risk','audit','management'),route(async(req,res)=>{const state=recalc(await getState(req.orgId));const documents=await listDocuments(req.orgId,300);res.json({report:{generatedAt:new Date().toISOString(),organisation:config.organizationName,metrics:state.metrics,openObligations:state.obligations.filter(x=>x.status!=='Completed'),pendingDecisions:state.decisions.filter(x=>!String(x.status).startsWith('Approved')),unverifiedEvidence:state.evidence.filter(x=>x.status!=='Verified'),documents}});}));
app.get('/api/admin/users',auth,allow('admin'),route(async(req,res)=>res.json({users:(await listUsers(req.orgId)).map(publicUser)})));
app.post('/api/admin/users',auth,allow('admin'),route(async(req,res)=>{const body=parse(userSchema,req.body);const user=await createUser({orgId:req.orgId,name:body.name,email:body.email,role:body.role,passwordHash:await bcrypt.hash(body.temporaryPassword,12)});await audit(req,'user.created','user',user.id,{role:user.role});res.status(201).json({user:publicUser(user)});}));
app.patch('/api/admin/users/:id',auth,allow('admin'),route(async(req,res)=>{await setUserActive(req.params.id,Boolean(req.body.isActive));await audit(req,'user.status.changed','user',req.params.id,{isActive:Boolean(req.body.isActive)});res.json({ok:true});}));
app.get('/api/admin/audit',auth,allow('admin','audit','management'),route(async(req,res)=>res.json({audit:await listAudit(req.orgId,Math.min(500,Number(req.query.limit||300)))})));

if(fs.existsSync(config.clientDist)){app.use(express.static(config.clientDist));app.get('*',(req,res,next)=>req.path.startsWith('/api/')?next():res.sendFile(path.join(config.clientDist,'index.html')));}
app.use((req,res)=>res.status(404).json({error:'Not found.'}));
app.use((error,req,res,next)=>{console.error(error);res.status(error.status||500).json({error:error.status?error.message:'Synesis could not complete the request.',requestId:req.requestId});});
app.listen(config.port,()=>console.log(`SYNESIS NEW MODEL 3.0 running on port ${config.port}`));
