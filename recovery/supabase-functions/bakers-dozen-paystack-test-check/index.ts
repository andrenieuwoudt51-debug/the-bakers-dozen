const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
Deno.serve(async(req)=>{
 if(req.method!=="POST")return reply(405,{ready:false,error:"Method not allowed"});
 const secret=Deno.env.get("PAYSTACK_TEST_SECRET_KEY");
 if(!secret?.startsWith("sk_test_"))return reply(503,{ready:false,reason:"Paystack test secret missing or not a test key"});
 try{
   const response=await fetch("https://api.paystack.co/balance",{method:"GET",headers:{"Authorization":"Bearer "+secret,"Accept":"application/json"},signal:AbortSignal.timeout(8000)});
   const result=await response.json().catch(()=>null);
   if(!response.ok||result?.status!==true)return reply(503,{ready:false,reason:"Paystack rejected test credentials",paystack_http_status:response.status});
   return reply(200,{ready:true,mode:"test",message:"Paystack accepted the test key. Checkout and split settlements are not yet enabled."});
 }catch{return reply(503,{ready:false,reason:"Paystack connection failed"});}
});