import test from 'node:test';
import assert from 'node:assert/strict';
import {sergeyRoomImages} from '../app/lib/sergey-gallery.ts';
const photo=name=>'https://www.vii.co.il/gallery/'+name+'.JPG';

test('one verified provider wording alias resolves without generic amenity borrowing',()=>{
 const room={roomID:4146,roomName:"יחידות עם ג'קוזי"};
 const galleries=[{title:"יחידות אירוח עם ג'קוזי",pictures:[photo('correct')]},{title:"מתחם חיצוני עם ג'קוזי",pictures:[photo('outside')]},{title:"יחידות אירוח",pictures:[photo('other')]}];
 assert.deepEqual(sergeyRoomImages(room,galleries),['/api/vii/media/correct.JPG']);
});
test('a foreign roomID and ambiguous wording aliases cannot supply unit photos',()=>{
 const room={roomID:4146,roomName:"יחידות עם ג'קוזי"};
 assert.deepEqual(sergeyRoomImages(room,[{roomID:4147,title:room.roomName,pictures:[photo('foreign')]}]),[]);
 assert.deepEqual(sergeyRoomImages(room,[{title:"יחידות אירוח עם ג'קוזי",pictures:[photo('a')]},{title:"יחידות אירוח עם ג'קוזי",pictures:[photo('b')]}]),[]);
 assert.deepEqual(sergeyRoomImages({roomID:1,roomName:'צימר זוגי'},[{title:'מתחם חיצוני זוגי',pictures:[photo('outside')]}]),[]);
});
