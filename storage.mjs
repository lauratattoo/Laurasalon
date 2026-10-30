import {DatabaseSync} from 'node:sqlite';
import {AsyncLocalStorage} from 'node:async_hooks';
export const storageScope=new AsyncLocalStorage();
export function createStorage(filename){
 if(!process.env.STORAGE_URL)return new DatabaseSync(filename);
 if(!process.env.STORAGE_SECRET)throw Error('Missing STORAGE_SECRET');
 const call=async operations=>{
  const response=await fetch(process.env.STORAGE_URL,{method:'POST',headers:{'Content-Type':'application/json','X-Laura-Key':process.env.STORAGE_SECRET},body:JSON.stringify({operations}),signal:AbortSignal.timeout(20000)});
  const result=await response.json();
  if(!response.ok)throw Object.assign(Error(response.status===409?'Čas se překrývá s jinou zakázkou.':'Databáze je dočasně nedostupná. Zkus to znovu.'),{status:response.status===409?409:503});
  return result;
 };
 const operation=(sql,args)=>({sql,params:args.map(v=>Buffer.isBuffer(v)?v.toString('base64'):v)});
 return {
  async exec(sql){const scope=storageScope.getStore();if(sql.startsWith('PRAGMA'))return;
   if(sql==='BEGIN'){if(!scope)throw Error('Transaction outside request');scope.pending=[];return;}
   if(sql==='ROLLBACK'){scope.pending=null;return;}
   if(sql==='COMMIT'){const ops=scope.pending;scope.pending=null;if(ops?.length)await call(ops);return;}
   throw Error('Unknown database operation');
  },
  prepare(sql){return {
   async all(...args){if(storageScope.getStore()?.pending)throw Error('Reads in buffered transaction are unsupported');const result=await call([operation(sql,args)]);return result[0].map(row=>row.bytes?{...row,bytes:Buffer.from(row.bytes,'base64')}:row);},
   async get(...args){return (await this.all(...args))[0];},
   async run(...args){const op=operation(sql,args),pending=storageScope.getStore()?.pending;if(pending){pending.push(op);return;}return call([op]);}
  };}
 };
}
