// Optional cloud entry point for exchanging a confirmed Supabase identity.
import { createClient } from 'npm:@supabase/supabase-js@2'
Deno.serve(async (request) => {
  const headers = {
    'Access-Control-Allow-Origin': Deno.env.get('CLUB_ORIGIN') || '',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Content-Type': 'application/json'
  }
  if (request.method === 'OPTIONS') return new Response(null, { headers })
  if (request.method !== 'POST') return new Response(null, {status:405,headers})
  const jwt = request.headers.get('Authorization')?.replace(/^Bearer /, '')
  if (!jwt) return Response.json({error:'Sessão necessária.'},{status:401,headers})
  const auth = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!)
  const {data,error} = await auth.auth.getUser(jwt)
  if(error || !data.user?.email_confirmed_at) return Response.json({error:'Confirme sua conta.'},{status:401,headers})
  const upstream = await fetch(new URL('/api',Deno.env.get('GAME_SERVER_URL')!),{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({cmd:'cloud',jwt})
  })
  return new Response(await upstream.text(),{status:upstream.status,headers})
})
