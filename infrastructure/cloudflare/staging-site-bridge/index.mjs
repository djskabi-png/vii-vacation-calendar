import {Client} from 'pg';
import {createBridgeHandler} from './handler.mjs';
import {createAccessJwtVerifier} from './jwt-verifier.mjs';
const verifyJwt=createAccessJwtVerifier();
export default {fetch:createBridgeHandler({Client,verifyJwt})};
