// Glass Christmas ornaments (transparent PNG cutouts) used to decorate every page
window.ORN = Object.fromEntries(['star', 'tree', 'bauble', 'cane', 'flake']
  .map(k => [k, `<img src="/orn-${k}.png" alt="" draggable="false">`]));
