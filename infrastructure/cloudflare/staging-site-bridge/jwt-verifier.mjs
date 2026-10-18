import {createRemoteJWKSet,jwtVerify} from 'jose';

export function createAccessJwtVerifier({createKeySet=createRemoteJWKSet}={}) {
 const keySets=new Map();
 return (token,{issuer,audience,currentDate})=>{
  let keys=keySets.get(issuer);
  if(!keys){
   keys=createKeySet(new URL('/cdn-cgi/access/certs',issuer),{timeoutDuration:3000,cooldownDuration:30000});
   keySets.set(issuer,keys);
  }
  return jwtVerify(token,keys,{issuer,audience,currentDate,algorithms:['RS256'],requiredClaims:['exp','iat','sub','type','common_name'],clockTolerance:0});
 };
}
