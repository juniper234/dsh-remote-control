import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

export function registerTools(ctx,controller) {
  const remote={type:'string',description:'Configured device ID or name; omit for the default device.'};
  const sessionId={type:'string',description:'Remote chat ID from remote_sessions.'};
  const output={schema:{type:'object',required:['text'],additionalProperties:false,properties:{text:{type:'string'}}},render:(_args,value)=>[{type:'text',text:value.text}]};
  const definitions=[
    {name:'remote_instances',description:'List configured remote devices without credentials, or probe one. Add pairing links in the Remote Control panel.',properties:{remote,action:{type:'string',enum:['list','probe']}},run:args=>controller.action({action:args.action==='probe'?'devices.probe':'devices.list',remoteId:args.remote})},
    {name:'remote_sessions',description:'Read-only: list DSH chats on a configured remote device. Does not take ownership of a chat.',properties:{remote,query:{type:'string'},limit:{type:'integer',minimum:1,maximum:200}},async run(args){const value=await controller.action({action:'sessions.list',remoteId:args.remote});const query=(args.query??'').toLowerCase();return {items:value.items.filter(x=>`${x.title} ${x.cwd}`.toLowerCase().includes(query)).slice(0,args.limit??30)};}},
    {name:'remote_transcript',description:'Read-only: read the visible user/assistant messages of a remote DSH chat.',properties:{remote,sessionId,maxMessages:{type:'integer',minimum:1,maximum:500}},required:['sessionId'],run:args=>controller.action({action:'sessions.page',remoteId:args.remote,sessionId:args.sessionId,maxMessages:args.maxMessages})},
    {name:'remote_status',description:'Read-only: inspect the running state and metadata of one remote chat.',properties:{remote,sessionId},required:['sessionId'],async run(args){const {items}=await controller.action({action:'sessions.list',remoteId:args.remote});return items.find(x=>x.sessionId===args.sessionId)??{error:'Chat not found'};}},
    {name:'remote_create_session',description:'Create a new DSH chat on the configured remote machine. This writes remote session state.',properties:{remote,title:{type:'string'},cwd:{type:'string'}},run:args=>controller.action({action:'sessions.create',remoteId:args.remote,title:args.title,cwd:args.cwd})},
    {name:'remote_cancel',description:'Stop the running task in a remote DSH chat. Mutates the remote session; use only when requested.',properties:{remote,sessionId},required:['sessionId'],run:args=>controller.action({action:'sessions.cancel',remoteId:args.remote,sessionId:args.sessionId})},
    {name:'remote_prompt',description:'Send an authorized prompt to a remote DSH chat. Uses that device’s model quota and tools. Mutates remote state; never retry automatically after an ambiguous failure. Existing web-owned chats may require the desktop companion.',properties:{remote,sessionId,text:{type:'string'},mode:{type:'string',enum:['queue','steer']},requestId:{type:'string'},wait:{type:'boolean'},timeoutSeconds:{type:'integer',minimum:1,maximum:300}},required:['sessionId','text'],async run(args,execution){
      const before=await controller.action({action:'sessions.page',remoteId:args.remote,sessionId:args.sessionId,maxMessages:10});
      const seq=before.messages.at(-1)?.seq??-1;
      const accepted=await controller.action({action:'sessions.prompt',remoteId:args.remote,sessionId:args.sessionId,text:args.text,mode:args.mode,requestId:args.requestId??randomUUID()});
      if(args.wait===false)return accepted;
      const until=Date.now()+(args.timeoutSeconds??120)*1000;
      while(Date.now()<until){await delay(1000,undefined,{signal:execution?.signal});const {items}=await controller.action({action:'sessions.list',remoteId:args.remote});const session=items.find(x=>x.sessionId===args.sessionId);const page=await controller.action({action:'sessions.page',remoteId:args.remote,sessionId:args.sessionId,maxMessages:30});const reply=page.messages.filter(x=>x.role==='assistant'&&(x.seq??0)>seq).at(-1);if(reply&&!session?.running)return {...accepted,reply:reply.text};}
      return {...accepted,status:'Still running or awaiting a remote reply. Use remote_status or remote_transcript; do not resend the prompt.'};
    }},
  ];
  for(const d of definitions)ctx.tools.register({name:d.name,description:d.description,parameters:{type:'object',additionalProperties:false,properties:d.properties,...(d.required?{required:d.required}:{})},output,async execute(args,execution){return {text:JSON.stringify(await d.run(args,execution),null,2)};}});
}
