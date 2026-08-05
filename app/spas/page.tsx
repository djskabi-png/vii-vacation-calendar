import { WorldLanding } from "../components/world-landing";
import { spaPlaces } from "../data/world-data";

export default function SpasPage() {
  return <WorldLanding world="spa" eyebrow="זמן לעצמכם" title="מוצאים את הספא שמתאים לרגע שלכם" description="משווים בין בתי ספא, חבילות וטיפולים ובוחרים לפי אזור, הרכב וסוג החוויה." items={spaPlaces} searchMode="spa" sourceNote="המידע והתמונות נלקחו מעמודי המקור המאומתים של ספא פלוס." />;
}
