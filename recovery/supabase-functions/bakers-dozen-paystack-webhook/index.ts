import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.4";
const respond=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("");
Deno.serve(async(req)=>{
 if(req.method!=="POST")return respond(405,{error:"Method not allowed"});
 const secret=Deno.env.get("PAYSTACK_TEST_SECRET_KEY");
 if(!secret?.startsWith("sk_test_"))return respond(503,{error:"Test payment secret not configured"});
 const raw=await req.arrayBuffer();
 if(raw.byteLength>1000000)return respond(413,{error:"Payload too large"});
 const signature=req.headers.get("x-paystack-signature")?.toLowerCase()||"";
 if(!/^[a-f0-9]{128}$/.test(signature))return respond(401,{error:"Invalid signature"});
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-512"},false,["sign"]);
 const expected=hex(await crypto.subtle.sign("HMAC",key,raw));
 let diff=0;for(let i=0;i<128;i++)diff|=expected.charCodeAt(i)^signature.charCodeAt(i);
 if(diff!==0)return respond(401,{error:"Invalid signature"});
 let event:any;try{event=JSON.parse(new TextDecoder().decode(raw))}catch{return respond(400,{error:"Invalid JSON"})}
 if(event?.event!=="charge.success")return respond(200,{ignored:true});
 const reference=event?.data?.reference;
 if(typeof reference!=="string"||!/^BDTEST_[0-9a-f]{32}$/.test(reference))return respond(200,{ignored:true});
 const url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!service)return respond(503,{error:"Backend not configured"});
 const db=createClient(url,service);
 const {data:payment,error:paymentError}=await db.from("bakery_payments").select("reservation_id,amount_cents,status,currency").eq("paystack_reference",reference).maybeSingle();
 if(paymentError)return respond(503,{error:"Payment lookup unavailable"});
 if(!payment)return respond(200,{ignored:true});
 if(!["initialized","paid"].includes(payment.status))return respond(503,{error:"Payment not ready for verification"});
 let verified:any;
 try{
 const response=await fetch("https://api.paystack.co/transaction/verify/"+encodeURIComponent(reference),{headers:{Authorization:"Bearer "+secret},signal:AbortSignal.timeout(12000)});
 verified=await response.json();
 if(!response.ok||verified?.status!==true)return respond(503,{error:"Paystack verification unavailable"});
 }catch{return respond(503,{error:"Paystack verification unavailable"})}
 const tx=verified.data;
 if(tx?.domain!=="test"||tx?.status!=="success"||tx?.reference!==reference||Number(tx?.amount)!==Number(payment.amount_cents)||tx?.currency!=="ZAR")return respond(409,{error:"Payment verification mismatch"});
 const subaccount=typeof tx?.subaccount==="string"?tx.subaccount:tx?.subaccount?.subaccount_code;
 const {data:result,error:finalizeError}=await db.rpc("finalize_bakery_test_payment",{p_reference:reference,p_amount:payment.amount_cents,p_currency:tx.currency,p_subaccount:subaccount||null});
 if(finalizeError)return respond(503,{error:"Payment confirmation requires retry or reconciliation"});
 return respond(200,result);
});