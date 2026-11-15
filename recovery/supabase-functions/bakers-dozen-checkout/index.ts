import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.4";
const out=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
Deno.serve(async(req)=>{
 if(req.method!=="POST")return out(405,{error:"Method not allowed"});
 const key=Deno.env.get("PAYSTACK_TEST_SECRET_KEY"),url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),anon=Deno.env.get("SUPABASE_ANON_KEY");
 if(!key?.startsWith("sk_test_")||!url||!service||!anon)return out(503,{error:"Test payments not configured"});
 const auth=req.headers.get("authorization")||"";
 if(!/^Bearer\s+\S+$/i.test(auth))return out(401,{error:"Sign in required"});
 const client=createClient(url,anon,{global:{headers:{Authorization:auth}}});
 const {data:{user},error:authError}=await client.auth.getUser();
 if(authError||!user?.id||!user.email)return out(401,{error:"Authenticated email required"});
 let input:{reservation_id?:string};try{input=await req.json()}catch{return out(400,{error:"Invalid JSON"})}
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.reservation_id||""))return out(400,{error:"Invalid reservation ID"});
 const db=createClient(url,service);
 const {data:r}=await db.from("reservations").select("id,customer_id,bakery_id,quantity,unit_price_cents,status,hold_expires_at").eq("id",input.reservation_id).maybeSingle();
 if(!r||r.customer_id!==user.id||r.status!=="held"||new Date(r.hold_expires_at).getTime()<=Date.now())return out(409,{error:"Reservation unavailable"});
 const {data:account}=await db.from("bakery_payment_accounts").select("paystack_subaccount_code,verification_status").eq("bakery_id",r.bakery_id).maybeSingle();
 if(!account||account.verification_status!=="verified"||!/^ACCT_[a-zA-Z0-9]+$/.test(account.paystack_subaccount_code||""))return out(409,{error:"Baker payment account not verified"});
 const amount=Number(r.quantity)*Number(r.unit_price_cents);
 if(!Number.isSafeInteger(amount)||amount<=0)return out(409,{error:"Invalid amount"});
 const {data:existing}=await db.from("bakery_payments").select("status,authorization_url,amount_cents").eq("reservation_id",r.id).maybeSingle();
 if(existing)return out(409,{error:"Payment already started; duplicate checkout blocked"});
 const reference="BDTEST_"+crypto.randomUUID().replaceAll("-","");
 const {error:insertError}=await db.from("bakery_payments").insert({reservation_id:r.id,paystack_reference:reference,amount_cents:amount,status:"pending"});
 if(insertError)return out(409,{error:"Unable to reserve payment reference"});
 const commission=Math.floor((amount*10+50)/100);
 const payload={email:user.email,amount,currency:"ZAR",reference,subaccount:account.paystack_subaccount_code,transaction_charge:commission,bearer:"subaccount",metadata:{reservation_id:r.id,platform:"the-bakers-dozen",mode:"test"}};
 let response:Response;
 try{response=await fetch("https://api.paystack.co/transaction/initialize",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)})}
 catch{return out(502,{error:"Paystack unavailable; retry requires reconciliation"})}
 const result=await response.json().catch(()=>null);
 if(!response.ok||result?.status!==true||!result?.data?.authorization_url||!result?.data?.access_code){
   await db.from("bakery_payments").update({status:"failed"}).eq("paystack_reference",reference).eq("status","pending");
   return out(502,{error:"Paystack initialization rejected; no payment taken"});
 }
 const {error:saveError}=await db.from("bakery_payments").update({status:"initialized",authorization_url:result.data.authorization_url,access_code:result.data.access_code,initialized_at:new Date().toISOString()}).eq("paystack_reference",reference).eq("status","pending");
 if(saveError)return out(503,{error:"Checkout created but could not be safely persisted; contact support"});
 return out(200,{mode:"test",authorization_url:result.data.authorization_url,reference,amount_cents:amount,commission_cents:commission,baker_gross_cents:amount-commission});
});