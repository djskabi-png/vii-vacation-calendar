import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose';
import {createAccessJwtVerifier} from './jwt-verifier.mjs';

const issuer='https://example.cloudflareaccess.com', audience='a'.repeat(64), clientId='b'.repeat(32)+'.access';
const now=Date.parse('2026-10-18T10:00:00Z');
const base={type:'app',sub:'',common_name:clientId,iat:now/1000-1,exp:now/1000+300};
async function fixture(){
 const {privateKey,publicKey}=await generateKeyPair('RS256');
 const jwk=await exportJWK(publicKey);jwk.kid='stage-test';
 const verify=createAccessJwtVerifier({createKeySet:()=>createLocalJWKSet({keys:[jwk]})});
 const sign=(claims=base, key=privateKey, alg='RS256', tokenIssuer=issuer, tokenAudience=audience)=>new SignJWT(claims).setProtectedHeader({alg,kid:'stage-test',typ:'JWT'}).setIssuer(tokenIssuer).setAudience(tokenAudience).setIssuedAt(base.iat).setExpirationTime(base.exp).sign(alg==='HS256'?new TextEncoder().encode('test-secret'):key);
 return{verify,sign,privateKey};
}
test('production verifier accepts an actually signed RS256 service JWT',async()=>{const f=await fixture();const token=await f.sign();const r=await f.verify(token,{issuer,audience,currentDate:new Date(now)});assert.equal(r.payload.common_name,clientId);});
test('production verifier rejects wrong signature, issuer, audience and algorithm',async()=>{const f=await fixture();const other=await generateKeyPair('RS256');for(const token of [await f.sign(base,other.privateKey),await f.sign(base,f.privateKey,'RS256','https://wrong.cloudflareaccess.com'),await f.sign(base,f.privateKey,'RS256',issuer,'wrong'),await f.sign(base,f.privateKey,'HS256')])await assert.rejects(()=>f.verify(token,{issuer,audience,currentDate:new Date(now)}));});
