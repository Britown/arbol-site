// Pure relationship operations, shared by the editor and tests.
export function addRelative(people, anchorId, relation, fields, options = {}) {
  const next = structuredClone(people), anchor = next[anchorId];
  if (!anchor) throw new Error('La persona de origen ya no existe.');
  if (!['father','mother','partner','child','sibling'].includes(relation)) throw new Error('Relación inválida.');
  const name = String(fields.name || '').trim();
  if (!name || name.length > 200) throw new Error('Ingresa un nombre de hasta 200 caracteres.');
  const id = options.id;
  if (!id || next[id]) throw new Error('Identificador inválido o duplicado.');
  const person = {id, name, birth:fields.birth || {}, death:fields.death || {}, marriage:fields.marriage || {}, parents:[], partners:[], children:[], siblings:[]};
  next[id] = person;
  const link = (a, key, b) => { if (!a[key].includes(b)) a[key].push(b); };
  const parent = (parentId, childId) => {
    link(next[parentId], 'children', childId); link(next[childId], 'parents', parentId);
    for (const otherId of next[parentId].children) if (otherId !== childId) {
      link(next[otherId], 'siblings', childId); link(next[childId], 'siblings', otherId);
    }
  };
  if (relation === 'father' || relation === 'mother') {
    if (anchor.parentRoles?.[relation]) throw new Error('Ese rol ya está registrado. Edita la persona existente.');
    parent(id, anchorId);
    anchor.parentRoles = {...anchor.parentRoles, [relation]:id};
  } else if (relation === 'partner') {
    link(anchor, 'partners', id); link(person, 'partners', anchorId);
  } else if (relation === 'child') {
    parent(anchorId, id);
    if (options.coParent) {
      if (!anchor.partners.includes(options.coParent) || !next[options.coParent]) throw new Error('La pareja seleccionada cambió. Reabre el formulario.');
      parent(options.coParent, id);
    }
  } else {
    link(anchor, 'siblings', id); link(person, 'siblings', anchorId);
    for (const parentId of options.sharedParents || []) {
      if (!anchor.parents.includes(parentId) || !next[parentId]) throw new Error('El progenitor seleccionado cambió.');
      parent(parentId, id);
    }
  }
  return next;
}
export function editPerson(people, id, fields) {
  if (!people[id]) throw new Error('La persona ya no existe.');
  const name = String(fields.name || '').trim();
  if (!name || name.length > 200) throw new Error('Ingresa un nombre de hasta 200 caracteres.');
  const next = structuredClone(people);
  for (const key of ['birth','death','marriage']) next[id][key] = {...next[id][key], ...fields[key]};
  next[id].name = name;
  return next;
}
