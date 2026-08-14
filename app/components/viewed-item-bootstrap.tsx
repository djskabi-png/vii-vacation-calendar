import type { SavedWorld } from "../lib/saved-items";

type Props = {
  id: string;
  world: SavedWorld;
  name: string;
  location: string;
  image?: string;
  href: string;
  meta?: string;
};

export function ViewedItemBootstrap(item: Props) {
  const payload = JSON.stringify(item).replaceAll("<", "\\u003c");
  const source = `(function(){try{var item=${payload};var key=item.world+":"+item.id;var storageKey="vii-viewed-items-v1";var current=JSON.parse(localStorage.getItem(storageKey)||"[]");if(!Array.isArray(current))current=[];var next=Object.assign({},item,{key:key,viewedAt:new Date().toISOString()});localStorage.setItem(storageKey,JSON.stringify([next].concat(current.filter(function(entry){return entry&&entry.key!==key;})).slice(0,60)));window.dispatchEvent(new Event("vii-viewed-items-change"));}catch(_){}})();`;
  return <script data-viewed-item-bootstrap={item.world} dangerouslySetInnerHTML={{ __html: source }} />;
}
