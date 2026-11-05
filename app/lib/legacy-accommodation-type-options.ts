/** Verified old SearchFilter roomTypes IDs, used by the accepted membership
 * snapshot and legacy URL migration. A missing/unknown ID is never guessed. */
export const legacyAccommodationTypeOptions:readonly(readonly[number,string])[]=[
 [1,'בקתות עץ'],[2,'סוויטות'],[6,'צימרים'],[4,'וילות'],[3,'מערות'],
 [12,'מתחמי אירוח'],[16,'צימרים מאבן'],[21,'דירות נופש'],[7,'אוהלים אינדיאנים'],
];
