const expected = "01978a8478c3fd1bf90f02bbf92ff4e574e6721001296923c1e6ae2847105797";
Deno.serve(async req => {
 if(req.method!=="POST")return new Response("Method not allowed",{status:405});
 const key=req.headers.get("X-Laura-Key")||"";
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(key)))).map(v=>v.toString(16).padStart(2,"0")).join("");
 if(digest!==expected)return new Response("Unauthorized",{status:401});
 try{
 const text=await req.text();if(text.length>8*1024*1024)return Response.json({error:"Too large"},{status:413});
 const body=JSON.parse(text);
 const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const response=await fetch(Deno.env.get("SUPABASE_URL")+"/rest/v1/rpc/laura_query",{method:"POST",headers:{apikey:serviceKey,Authorization:"Bearer "+serviceKey,"Content-Type":"application/json"},body:JSON.stringify(body)});
 const data=await response.json();
 if(!response.ok)return Response.json({error:"Database operation failed",code:data.code},{status:["23P01","40P01","40001","23505"].includes(data.code)?409:500});
 return Response.json(data,{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"Storage unavailable"},{status:503});}
});
